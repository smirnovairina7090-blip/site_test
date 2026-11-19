import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Дневник достижений | Креайтивика",
  description: "Посещай занятия, собирай компьютер, отмечай навыки и открывай награды. Личный прогресс сохраняется между устройствами.",
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
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
