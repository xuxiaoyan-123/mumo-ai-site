import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/studio/Studio";

export const Route = createFileRoute("/")({
  component: Studio,
  head: () => ({
    meta: [
      { title: "沐莫 — 专业电商 AI 商品图生成工作台" },
      { name: "description", content: "沐莫专为电商卖家打造的 AI 商品图工作台，一站式生成高质量主图、场景图与商业级视觉内容。" },
      { property: "og:title", content: "沐莫 — 专业电商 AI 商品图生成工作台" },
      { property: "og:description", content: "沐莫专为电商卖家打造的 AI 商品图工作台，一站式生成高质量主图、场景图与商业级视觉内容。" },
      { name: "twitter:title", content: "沐莫 — 专业电商 AI 商品图生成工作台" },
      { name: "twitter:description", content: "沐莫专为电商卖家打造的 AI 商品图工作台，一站式生成高质量主图、场景图与商业级视觉内容。" },
    ],
  }),
});
