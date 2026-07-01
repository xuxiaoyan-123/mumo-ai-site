import { createFileRoute } from "@tanstack/react-router";
import { migrationPending } from "@/lib/placeholder-response";

export const Route = createFileRoute("/api/auth/login")({
  server: { handlers: { POST: async () => migrationPending("Login") } },
});
