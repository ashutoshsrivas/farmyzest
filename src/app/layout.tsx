import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { NumericInputGuard } from "@/components/ui/NumericInputGuard";

// Self-hosted (src/app/fonts, OFL) so builds never depend on a Google Fonts
// download. Manrope (variable, 200–800) for headings and text; IBM Plex Mono
// only for SKUs and spec figures.
const manrope = localFont({
  variable: "--font-manrope",
  src: [{ path: "./fonts/manrope-latin-wght-normal.woff2", weight: "200 800", style: "normal" }],
  display: "swap",
  adjustFontFallback: "Arial",
});

const plexMono = localFont({
  variable: "--font-plex-mono",
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Farmyzest | Garden and farm supplies since 1962",
  description: "Farmyzest by Nidhi Enterprises, trading since 1962. Seeds, plants, manures, fertilisers, pesticides, spray pumps, pots, hand tools, lawn mowers, brushcutters and chainsaws for home gardens and farms across India.",
  keywords: ["gardening", "plants", "seeds", "fertilizer", "pesticides", "spray pump", "lawn mower", "brush cutter", "garden tools", "India"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${manrope.variable} ${plexMono.variable} h-full`} suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) add
          attributes to <body> before React loads. */}
      <body className="min-h-full flex flex-col bg-nado text-grey-700 antialiased" suppressHydrationWarning>
        <Providers>
          <NumericInputGuard />
          {children}
        </Providers>
      </body>
    </html>
  );
}