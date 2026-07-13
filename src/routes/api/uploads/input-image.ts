import { createFileRoute } from "@tanstack/react-router";
import { apiError, jsonResponse } from "@/lib/placeholder-response";

export const Route = createFileRoute("/api/uploads/input-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { InputImageUploadError, uploadInputImageFromRequest } =
          await import("@/lib/input-image.server");
        try {
          const asset = await uploadInputImageFromRequest(request);
          return jsonResponse({ ok: true, ...asset }, 201);
        } catch (error) {
          if (error instanceof InputImageUploadError) {
            return apiError(error.code, error.message, error.status);
          }
          return apiError("INPUT_IMAGE_UPLOAD_FAILED", "参考图上传失败，请稍后重试。", 500);
        }
      },
      DELETE: async ({ request }) => {
        const { InputImageUploadError, deleteInputImageAssetFromRequest } =
          await import("@/lib/input-image.server");
        try {
          const asset = await deleteInputImageAssetFromRequest(request);
          return jsonResponse({ ok: true, ...asset });
        } catch (error) {
          if (error instanceof InputImageUploadError) {
            return apiError(error.code, error.message, error.status);
          }
          return apiError("INPUT_IMAGE_DELETE_FAILED", "参考图删除失败，请稍后重试。", 500);
        }
      },
    },
  },
});
