"use client";

import { usePathname } from "next/navigation";
import { Header1 } from "@/components/layout/Header1";
import { Header2 } from "@/components/layout/Header2";
import { Header3 } from "@/components/layout/Header3";
import { Footer1 } from "@/components/layout/Footer1";
import { Footer2 } from "@/components/layout/Footer2";
import { Footer3 } from "@/components/layout/Footer3";

// Variant registry for /design/[N] preview routes.
// Adding a new variant — e.g. /design/4 — is now a single-row addition:
//   { slugSegment: "/design/4", Header: Header4, Footer: Footer4 }
// no need to extend the lookup logic each time.
type DesignVariant = {
  slugSegment: string;
  Header: React.ComponentType;
  Footer: React.ComponentType;
};

const DESIGN_VARIANTS: DesignVariant[] = [
  { slugSegment: "/design/1", Header: Header1, Footer: Footer1 },
  { slugSegment: "/design/2", Header: Header2, Footer: Footer2 },
  { slugSegment: "/design/3", Header: Header3, Footer: Footer3 },
];

const DEFAULT_VARIANT = DESIGN_VARIANTS[0];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const variant =
    DESIGN_VARIANTS.find((v) => pathname.includes(v.slugSegment)) ?? DEFAULT_VARIANT;
  const { Header, Footer } = variant;

  return (
    <>
      <Header />
      <main className="pt-16">{children}</main>
      <Footer />
    </>
  );
}
