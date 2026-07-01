import { createFileRoute } from "@tanstack/react-router";
import { migrationPending } from "@/lib/placeholder-response";

export const Route = createFileRoute("/api/auth/request-password-reset")({
  server: { handlers: { POST: async () => migrationPending("Password reset") } },
});
