import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "@/lib/placeholder-response";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async () => jsonResponse({ user: null, profile: null, message: "Authentication is not available yet." }, 401),
    },
  },
});
