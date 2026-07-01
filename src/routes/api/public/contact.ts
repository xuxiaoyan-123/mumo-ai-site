import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "@/lib/placeholder-response";

export const Route = createFileRoute("/api/public/contact")({
  server: {
    handlers: {
      GET: async () => jsonResponse({ wechat: "", qq: "", message: "Mumo contact information is not configured yet." }),
    },
  },
});
