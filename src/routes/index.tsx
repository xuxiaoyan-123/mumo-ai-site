import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/studio/Studio";

export const Route = createFileRoute("/")({
  component: Studio,
  head: () => ({
    meta: [
      { title: "沐莫 AI 创作工作台 — Mumo" },
      { name: "description", content: "沐莫为创作者提供专业、专注的 AI 图像创作体验。" },
      { property: "og:title", content: "沐莫 AI 创作工作台 — Mumo" },
      { property: "og:description", content: "沐莫为创作者提供专业、专注的 AI 图像创作体验。" },
      { name: "twitter:title", content: "沐莫 AI 创作工作台 — Mumo" },
      { name: "twitter:description", content: "沐莫为创作者提供专业、专注的 AI 图像创作体验。" },
    ],
  }),
});
