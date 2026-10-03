import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UzStat Talent Tracker | Футбольная аналитика",
  description: "Скаутинг и сравнение игроков Узбекистана и Казахстана по подтверждённым матчевым данным с указанием источника, сезона и покрытия.",
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
