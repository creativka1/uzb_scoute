import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UzStat Talent Tracker | Платформа скаутинга Узбекистана",
  description: "Продвинутая аналитика и скаутинг молодых талантов Суперлиги Узбекистана (xG, xA, Shot Maps, Radars)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className="antialiased bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
