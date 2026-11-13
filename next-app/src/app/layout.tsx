import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GMI Cloud · Pilot Cluster Ops",
  description: "單一 GPU 叢集與 vLLM 部署的唯讀營運展示介面。所有數值均為合成模擬資料。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
