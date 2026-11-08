import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "딸기마을 — 온라인 딸기 농장",
  description: "온라인 딸기 농장. 함께 딸기를 키우고 수확해보세요.",
  metadataBase: new URL("https://strawberry-village.web.app"),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
