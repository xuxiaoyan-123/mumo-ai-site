import { createFileRoute } from "@tanstack/react-router";
import { migrationPending } from "@/lib/placeholder-response";

export const Route = createFileRoute("/api/uploads/avatar")({
  server: { handlers: { POST: async () => migrationPending("Avatar upload") } },
});
