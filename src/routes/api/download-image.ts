import { createFileRoute } from "@tanstack/react-router";

const CLOUDFLARE_ENV_GLOBAL_KEY = "__MUMO_CLOUDFLARE_ENV__";
const ALLOWED_PATH_PREFIX = "/generated/";
const FALLBACK_FILENAME = "mumo-generated-image.png";

function getR2PublicBaseUrl(): URL | null {
  const globalEnv = (globalThis as Record<string, unknown>)[CLOUDFLARE_ENV_GLOBAL_KEY];
  const cloudflareEnv = globalEnv && typeof globalEnv === "object"
    ? (globalEnv as { R2_PUBLIC_BASE_URL?: string })
    : undefined;
  const value = cloudflareEnv?.R2_PUBLIC_BASE_URL ??
    (typeof process !== "undefined" ? process.env.R2_PUBLIC_BASE_URL : undefined);
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getSafeFilename(url: URL) {
  const rawName = url.pathname.split("/").filter(Boolean).pop() ?? "";
  let decoded = rawName;
  try {
    decoded = decodeURIComponent(rawName);
  } catch {
    decoded = rawName;
  }
  const safe = decoded.replace(/[^a-zA-Z0-9._-]/g, "");
  return safe || FALLBACK_FILENAME;
}

function getAllowedImageUrl(request: Request) {
  const publicBaseUrl = getR2PublicBaseUrl();
  if (!publicBaseUrl) return null;

  const requestUrl = new URL(request.url);
  const value = requestUrl.searchParams.get("url") ?? requestUrl.searchParams.get("imageUrl");
  if (!value) return null;

  let target: URL;
  try {
    target = new URL(value);
  } catch {
    return null;
  }

  if (target.origin !== publicBaseUrl.origin || !target.pathname.startsWith(ALLOWED_PATH_PREFIX)) {
    return null;
  }

  return target;
}

export const Route = createFileRoute("/api/download-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = getAllowedImageUrl(request);
        if (!target) {
          return new Response("Forbidden", { status: 403 });
        }

        const upstream = await fetch(target.href);
        if (!upstream.ok || !upstream.body) {
          return new Response("Download source unavailable", { status: upstream.status || 502 });
        }

        const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
        const filename = getSafeFilename(target);
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "private, max-age=0, no-store",
          },
        });
      },
    },
  },
});
