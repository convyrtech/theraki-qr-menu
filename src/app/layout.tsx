import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Raki — меню",
  description:
    "Раки, камчатский краб, дикие креветки и икра. Меню раковарни The Raki.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b3237",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
