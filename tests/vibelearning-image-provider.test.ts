import { describe, expect, test } from "bun:test";

import type { ImageGenerationInput } from "../src/lib/generation.schemas";
import { ImageProviderError } from "../src/lib/providers/image-provider.server";
import {
  resolveProviderSize,
  VibeLearningImageProvider,
} from "../src/lib/providers/vibelearning-image.server";

type FetchCall = {
  input: RequestInfo | URL;
  init?: RequestInit;
};

const MOCK_API_KEY = "mock-api-key-for-tests";
const MOCK_ENV = {
  VIBELEARNING_IMAGE_API_BASE_URL: "https://mock.vibelearning.test/v1/",
  VIBELEARNING_IMAGE_API_KEY: MOCK_API_KEY,
};

function input(
  referenceImages: ImageGenerationInput["referenceImages"] = [],
): ImageGenerationInput {
  return {
    model: "gpt-image-2",
    prompt: "a quiet reading room",
    aspectRatio: "1:1",
    quality: "1K",
    referenceImages,
    count: 1,
  };
}

function reference(filename: string, value: number) {
  return {
    bytes: new Uint8Array([value, value + 1, value + 2]),
    filename,
    mimeType: "image/png" as const,
  };
}

function mockFetch(...responses: Response[]) {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (requestInput: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input: requestInput, init });
    const response = responses.shift();
    if (!response) throw new Error("unexpected mock fetch call");
    return response;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, { status });
}

describe("VibeLearningImageProvider", () => {
  test("creates text-to-image tasks with JSON and automatic routing", async () => {
    const mock = mockFetch(jsonResponse({ task_id: "text-task", status: "queued" }));
    const provider = new VibeLearningImageProvider({ env: MOCK_ENV, fetchImpl: mock.fetchImpl });

    const created = await provider.createTask(input());

    expect(created).toEqual({ taskId: "text-task", mode: "text-to-image", status: "queued" });
    expect(String(mock.calls[0].input)).toBe(
      "https://mock.vibelearning.test/v1/images/generations/tasks",
    );
    const headers = new Headers(mock.calls[0].init?.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("authorization")).toBe(`Bearer ${MOCK_API_KEY}`);
    expect(JSON.parse(String(mock.calls[0].init?.body))).toEqual({
      model: "gpt-image-2",
      prompt: "a quiet reading room",
      size: "1024x1024",
      n: 1,
      response_format: "url",
      output_format: "webp",
    });
  });

  test("uses image for one image-to-image reference", async () => {
    const mock = mockFetch(jsonResponse({ data: { task_id: "single-task" } }));
    const provider = new VibeLearningImageProvider({ env: MOCK_ENV, fetchImpl: mock.fetchImpl });

    const created = await provider.createTask(input([reference("one.png", 1)]));

    expect(created.mode).toBe("image-to-image");
    expect(String(mock.calls[0].input)).toBe(
      "https://mock.vibelearning.test/v1/images/edits/tasks",
    );
    const body = mock.calls[0].init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.getAll("image")).toHaveLength(1);
    expect(body.getAll("image[]")).toHaveLength(0);
    expect((body.get("image") as File).name).toBe("one.png");
    expect(new Headers(mock.calls[0].init?.headers).has("content-type")).toBe(false);
  });

  test("uses repeated image[] fields for multiple references", async () => {
    const mock = mockFetch(jsonResponse({ task_id: "multi-task" }));
    const provider = new VibeLearningImageProvider({ env: MOCK_ENV, fetchImpl: mock.fetchImpl });

    await provider.createImageToImageTask(
      input([reference("one.png", 1), reference("two.png", 2)]),
    );

    const body = mock.calls[0].init?.body as FormData;
    expect(body.getAll("image")).toHaveLength(0);
    expect(body.getAll("image[]")).toHaveLength(2);
    expect(body.getAll("image[]").map((entry) => (entry as File).name)).toEqual([
      "one.png",
      "two.png",
    ]);
  });

  test("reads completed URL images from response.data", async () => {
    const mock = mockFetch(
      jsonResponse({ status: "completed", data: [{ url: "https://cdn.example/result.webp" }] }),
    );
    const provider = new VibeLearningImageProvider({ env: MOCK_ENV, fetchImpl: mock.fetchImpl });

    const result = await provider.pollTextToImageTask("task/url");

    expect(String(mock.calls[0].input)).toBe(
      "https://mock.vibelearning.test/v1/images/generations/tasks/task%2Furl",
    );
    expect(result).toEqual({
      taskId: "task/url",
      status: "completed",
      images: [{ kind: "url", url: "https://cdn.example/result.webp" }],
    });
  });

  test("normalizes b64_json images as bytes", async () => {
    const mock = mockFetch(jsonResponse({ status: "success", data: [{ b64_json: "AQIDBA==" }] }));
    const provider = new VibeLearningImageProvider({ env: MOCK_ENV, fetchImpl: mock.fetchImpl });

    const result = await provider.pollTask({
      taskId: "base64-task",
      mode: "image-to-image",
    });

    expect(String(mock.calls[0].input)).toBe(
      "https://mock.vibelearning.test/v1/images/edits/tasks/base64-task",
    );

    expect(result.status).toBe("completed");
    expect(result.images[0]).toEqual({
      kind: "base64",
      bytes: new Uint8Array([1, 2, 3, 4]),
      mimeType: "image/webp",
    });
  });

  test("normalizes failed task status without exposing the API key", async () => {
    const mock = mockFetch(
      jsonResponse({
        status: "failed",
        error: { code: "MODEL_ERROR", message: `upstream rejected ${MOCK_API_KEY}` },
      }),
    );
    const provider = new VibeLearningImageProvider({ env: MOCK_ENV, fetchImpl: mock.fetchImpl });

    const result = await provider.pollImageToImageTask("failed-task");

    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({
      code: "PROVIDER_TASK_FAILED",
      providerCode: "MODEL_ERROR",
      retryable: false,
    });
    expect(result.error?.message).toContain("[REDACTED]");
    expect(result.error?.message).not.toContain(MOCK_API_KEY);
  });

  test("normalizes non-2xx provider errors", async () => {
    const mock = mockFetch(
      jsonResponse({ error: { code: "RATE_LIMIT", message: "try later" } }, 429),
    );
    const provider = new VibeLearningImageProvider({ env: MOCK_ENV, fetchImpl: mock.fetchImpl });

    const promise = provider.createTextToImageTask(input());

    await expect(promise).rejects.toMatchObject({
      code: "PROVIDER_HTTP_ERROR",
      httpStatus: 429,
      providerCode: "RATE_LIMIT",
      retryable: true,
    });
  });

  test("rejects unconfirmed size mappings before fetch", async () => {
    let fetchCalled = false;
    const fetchImpl = (async () => {
      fetchCalled = true;
      return jsonResponse({ task_id: "unexpected" });
    }) as typeof fetch;
    const provider = new VibeLearningImageProvider({ env: MOCK_ENV, fetchImpl });

    await expect(
      provider.createTask({ ...input(), aspectRatio: "16:9", quality: "2K" }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_PROVIDER_SIZE" });
    expect(fetchCalled).toBe(false);
    expect(() => resolveProviderSize("1:1", "1K")).not.toThrow();
  });

  test("rejects invalid base64 and empty completed results", async () => {
    const mock = mockFetch(
      jsonResponse({ status: "completed", data: [{ b64_json: "not-base64!" }] }),
      jsonResponse({ status: "completed", data: [] }),
    );
    const provider = new VibeLearningImageProvider({ env: MOCK_ENV, fetchImpl: mock.fetchImpl });

    await expect(provider.pollTextToImageTask("bad-base64")).rejects.toMatchObject({
      code: "INVALID_PROVIDER_BASE64",
    });
    await expect(provider.pollTextToImageTask("empty-data")).rejects.toMatchObject({
      code: "EMPTY_PROVIDER_RESULT",
    });
  });

  test("does not fetch when the API key is missing", async () => {
    let fetchCalled = false;
    const fetchImpl = (async () => {
      fetchCalled = true;
      return jsonResponse({ task_id: "unexpected" });
    }) as typeof fetch;
    const provider = new VibeLearningImageProvider({
      env: { VIBELEARNING_IMAGE_API_BASE_URL: "https://mock.vibelearning.test/v1" },
      fetchImpl,
    });

    await expect(provider.createTextToImageTask(input())).rejects.toBeInstanceOf(
      ImageProviderError,
    );
    await expect(provider.createTextToImageTask(input())).rejects.toMatchObject({
      code: "CONFIGURATION_ERROR",
    });
    expect(fetchCalled).toBe(false);
  });

  test("enforces a configured provider reference-image limit", async () => {
    const mock = mockFetch(jsonResponse({ task_id: "unexpected" }));
    const provider = new VibeLearningImageProvider({
      env: MOCK_ENV,
      fetchImpl: mock.fetchImpl,
      maxReferenceImages: 1,
    });

    await expect(
      provider.createTask(input([reference("one.png", 1), reference("two.png", 2)])),
    ).rejects.toMatchObject({ code: "TOO_MANY_REFERENCE_IMAGES" });
    expect(mock.calls).toHaveLength(0);
  });
});
