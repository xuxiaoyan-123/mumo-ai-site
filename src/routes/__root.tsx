import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";

function NotFoundComponent() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <section className="text-center">
        <p className="text-7xl font-bold">404</p>
        <h1 className="mt-4 text-xl font-semibold">页面不存在</h1>
        <Link className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground" to="/">
          返回沐莫首页
        </Link>
      </section>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <section className="max-w-md text-center">
        <h1 className="text-xl font-semibold">页面暂时无法加载</h1>
        <p className="mt-2 text-sm text-muted-foreground">沐莫正在重建相关服务，请稍后重试。</p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={reset} type="button">
            重试
          </button>
          <Link className="rounded-md border border-border px-4 py-2" to="/">返回首页</Link>
        </div>
      </section>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "沐莫 AI — 电商商品图生成平台" },
      { name: "description", content: "沐莫为电商创作者提供 AI 商品图生成工具。" },
      { property: "og:title", content: "沐莫 AI — 电商商品图生成平台" },
      { property: "og:description", content: "沐莫为电商创作者提供 AI 商品图生成工具。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "沐莫 AI — 电商商品图生成平台" },
      { name: "twitter:description", content: "沐莫为电商创作者提供 AI 商品图生成工具。" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const preventFileDrop = (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragover", preventFileDrop);
    window.addEventListener("drop", preventFileDrop);
    return () => {
      window.removeEventListener("dragover", preventFileDrop);
      window.removeEventListener("drop", preventFileDrop);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors theme="dark" position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
