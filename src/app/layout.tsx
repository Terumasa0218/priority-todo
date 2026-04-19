import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrioriTodo",
  description: "次にやることが、すぐ分かる。優先順位自動整理タスク管理アプリ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PrioriTodo",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
