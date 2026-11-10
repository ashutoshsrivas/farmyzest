import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { NumericInputGuard } from "@/components/ui/NumericInputGuard";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Farmyzest — Plants, Seeds, Fertilisers, Garden Tools & Machinery",
  description: "Farmyzest by Nidhi Enterprises (Est. 1962) — your one-stop shop for gardening, agricultural and horticultural products: plants, seeds, manures, fertilisers, pesticides, spray pumps, pots, garden tools, lawn mowers, brush cutters and chainsaws.",
  keywords: ["gardening", "plants", "seeds", "fertilizer", "pesticides", "spray pump", "lawn mower", "brush cutter", "garden tools", "India"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${playfair.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-nado text-grey-700 antialiased">
        <Providers>
          <NumericInputGuard />
          {children}
        </Providers>
      </body>
    </html>
  );
}