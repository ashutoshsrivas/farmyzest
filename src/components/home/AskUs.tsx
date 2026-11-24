import Image from "next/image";
import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { whatsappLink, type StoreContact } from "@/lib/contact";
import { ASK_IMAGE } from "@/lib/home-content";
import { Reveal } from "./Reveal";
import { WRAP } from "./ui";

/** Photo band with help options. WhatsApp and phone show only when set in admin → Settings. */
export function AskUs({ contact, number }: { contact: StoreContact; number: string }) {
  return (
    <section className="relative overflow-hidden bg-moss text-bone">
      <Image src={ASK_IMAGE.src} alt={ASK_IMAGE.alt} fill sizes="100vw" className="parallax-img object-cover" />
      <div className="absolute inset-0 bg-[#121810]/55" />
      <div className={`${WRAP} relative py-20 md:py-28`}>
        <Reveal className="max-w-2xl">
          <p className="cat-label text-bone/70">{number} · Ask before you buy</p>
          <h2 className="mt-4 font-serif text-[2.2rem] leading-[1.05] tracking-[-0.02em] sm:text-[3rem] lg:text-[3.6rem] text-balance">
            Not sure what fits? Send us a photo of the plant, pest or machine.
          </h2>
          <p className="mt-5 max-w-[52ch] text-[17px] text-bone/85">
            We&apos;ll suggest the product, size or spare that suits. For estates, institutions and bulk orders, tell us the
            quantity and location and we&apos;ll send a quote.
          </p>
        </Reveal>
        <Reveal delay={150} className="mt-8 flex flex-wrap gap-3">
          {contact.whatsapp && (
            <a
              href={whatsappLink(contact.whatsapp, "Hello Farmyzest, I need help choosing a product.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-2 bg-bone px-6 text-[15px] font-medium text-moss hover:bg-parchment"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={1.75} /> Chat on WhatsApp
            </a>
          )}
          {contact.phone && contact.phoneHref && (
            <a href={contact.phoneHref} className="inline-flex min-h-12 items-center gap-2 border border-bone/60 px-6 text-[15px] font-medium hover:bg-bone hover:text-moss">
              <Phone className="h-4 w-4" strokeWidth={1.75} /> Call {contact.phone}
            </a>
          )}
          <Link
            href="/contact"
            className={`inline-flex min-h-12 items-center px-6 text-[15px] font-medium ${
              contact.whatsapp || contact.phone ? "border border-bone/60 hover:bg-bone hover:text-moss" : "bg-bone text-moss hover:bg-parchment"
            }`}
          >
            Write to us or request a bulk quote
          </Link>
        </Reveal>
        {contact.address && <p className="mt-6 text-sm text-bone/70">{contact.address}</p>}
      </div>
    </section>
  );
}
