import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/studio/Studio";

export const Route = createFileRoute("/")({
  component: Studio,
  head: () => ({
    meta: [
      { title: "沐莫电商视觉工作台 — Mumo" },
      { name: "description", content: "沐莫为电商创作者提供商品主图、场景视觉与批量处理工作台。" },
      { property: "og:title", content: "沐莫电商视觉工作台 — Mumo" },
      { property: "og:description", content: "沐莫为电商创作者提供商品主图、场景视觉与批量处理工作台。" },
      { name: "twitter:title", content: "沐莫电商视觉工作台 — Mumo" },
      { name: "twitter:description", content: "沐莫为电商创作者提供商品主图、场景视觉与批量处理工作台。" },
    ],
  }),
});
