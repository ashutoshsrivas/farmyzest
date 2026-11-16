import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { NumericInputGuard } from "@/components/ui/NumericInputGuard";

// Self-hosted (src/app/fonts, OFL) so builds never depend on a Google Fonts
// download. Newsreader = headings, IBM Plex Sans = body/UI, IBM Plex Mono =
// SKUs, specs and catalogue labels.
const newsreader = localFont({
  variable: "--font-newsreader",
  src: [
    { path: "./fonts/newsreader-latin-wght-normal.woff2", weight: "200 800", style: "normal" },
    { path: "./fonts/newsreader-latin-wght-italic.woff2", weight: "200 800", style: "italic" },
  ],
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const plexSans = localFont({
  variable: "--font-plex-sans",
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
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
    <html lang="en" data-scroll-behavior="smooth" className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-nado text-grey-700 antialiased">
        <Providers>
          <NumericInputGuard />
          {children}
        </Providers>
      </body>
    </html>
  );
}