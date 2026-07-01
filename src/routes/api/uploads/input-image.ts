import { createFileRoute } from "@tanstack/react-router";
import { migrationPending } from "@/lib/placeholder-response";

export const Route = createFileRoute("/api/uploads/input-image")({
  server: { handlers: { POST: async () => migrationPending("Input image upload") } },
});
