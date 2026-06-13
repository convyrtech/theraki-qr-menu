import type { Metadata, Viewport } from "next";
import {
  Cormorant_Garamond,
  Golos_Text,
  JetBrains_Mono,
  Manrope,
  Prata,
  Spectral,
} from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

// Двухголосая display-пара (выбор владельцев, 2026-06-12): Prata — прямой
// голос заголовков и названий; Cormorant Garamond — курсивный голос
// (у Prata курсива не существует). Латиница («The Raki», 70/90, S-XXL)
// всегда уходит во Fraunces через unicode-range в globals.css.
const prata = Prata({
  subsets: ["latin", "cyrillic"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display-italic",
  display: "swap",
});

// Прототип-направление «Прейскурантъ» (/v2): институциональная пара —
// Spectral (редакционная антиква, голос) + Golos Text (русский гротеск,
// метки и форма ведомости). Цифры — JetBrains Mono, как котировки.
const spectral = Spectral({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

const golos = Golos_Text({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-golos",
  display: "swap",
});

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
    <html
      lang="ru"
      className={[
        manrope.variable,
        jetbrainsMono.variable,
        prata.variable,
        cormorant.variable,
        spectral.variable,
        golos.variable,
      ].join(" ")}
    >
      <body>{children}</body>
    </html>
  );
}
