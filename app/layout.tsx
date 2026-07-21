import type { Metadata } from "next";
import { Oswald, Inter } from "next/font/google";
import "./globals.css";
import LenisProvider from "./lenis-provider";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "block",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Parts Bin — React scroll-animation components",
  description:
    "A token-driven, brand-agnostic, reduced-motion-safe library of React/Next.js scroll-animation section components.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${oswald.variable} ${inter.variable}`}>
      <body>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
