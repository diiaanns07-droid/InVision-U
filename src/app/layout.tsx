import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "inVision U: Грантовое высшее образование для будущих лидеров",
  description:
    "inVision U — это инновационный университет грантового обучения, готовящий лидеров завтрашнего дня через практическое обучение и междисциплинарные программы.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
