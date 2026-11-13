import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import FeedbackWidget from "./ui/FeedbackWidget";

export const metadata: Metadata = {
  title: "빠른답지 — 한 번에 풀고, 한 번에 채점",
  description: "답만 따다닥 입력하면 바로 채점. 정답은 숨기고 틀린 번호만 알려줍니다.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="top">
          <Link href="/" className="logo">
            빠른답지
          </Link>
          <nav>
            <Link href="/wrong">내 오답</Link>
            <Link href="/register">문제집 등록</Link>
          </nav>
        </header>
        <main>{children}</main>
        <FeedbackWidget />
      </body>
    </html>
  );
}
