import type { Metadata } from "next";
import "./globals.css";
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
      <body>{children}</body>
    </html>
  );
}
