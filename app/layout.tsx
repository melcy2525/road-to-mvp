import type { Metadata, Viewport } from "next";
import AmbientBackground from "@/components/ambient-background";
import "./globals.css";
import "./refinement.css";
export const viewport: Viewport = {
  themeColor: "#090f19",
  viewportFit: "cover",
};
export const metadata: Metadata = {
  title: "ROAD TO MVP | 営業管理",
  description:
    "2027年10月、表彰の舞台へ。日々の行動を成果につなぐ営業管理アプリ。",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body><AmbientBackground />{children}</body>
    </html>
  );
}
