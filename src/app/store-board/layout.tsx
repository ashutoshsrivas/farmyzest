import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Store Board · Farmyzest",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Standalone mobile shell — no storefront header/footer, no admin chrome.
export default function StoreBoardLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-nate-grey-50 text-nate-grey-900">{children}</div>;
}
