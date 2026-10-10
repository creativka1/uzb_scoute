import type { Metadata } from "next";
import "./globals.css";
import { MvpShell } from '@/components/mvp/shell';

export const metadata: Metadata = {
  title: "Uzstat | Поиск и сравнение футболистов",
  description: "Простой скаутинг: подбор футболиста, избранное и сравнение по подтверждённым данным.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <MvpShell>{children}</MvpShell>
      </body>
    </html>
  );
}
