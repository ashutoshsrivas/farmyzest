import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { whatsappLink, type StoreContact } from "@/lib/contact";
import { WRAP } from "./ui";

/** Help block: WhatsApp and phone appear only when set in admin → Settings. */
export function AskUs({ contact, number }: { contact: StoreContact; number: string }) {
  return (
    <section className={`${WRAP} pb-16 md:pb-24`}>
      <div className="grid gap-8 border border-charcoal bg-bone/80 p-6 md:grid-cols-[1.2fr_1fr] md:p-10">
        <div>
          <p className="cat-label text-stone">{number} · Ask before you buy</p>
          <h2 className="mt-3 font-serif text-[1.9rem] md:text-[2.4rem] leading-[1.08] text-balance">
            Not sure what fits? Send us a photo of the plant, pest or machine.
          </h2>
          <p className="mt-3 text-base text-stone max-w-[52ch]">
            We&apos;ll suggest the product, size or spare that suits. For estates, institutions and bulk orders, tell us the
            quantity and location and we&apos;ll send a quote.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:justify-center">
          {contact.whatsapp && (
            <a
              href={whatsappLink(contact.whatsapp, "Hello Farmyzest, I need help choosing a product.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-seg-ink px-6 text-[15px] font-medium text-bone hover:bg-accent-dark"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={1.75} /> Chat on WhatsApp
            </a>
          )}
          {contact.phone && contact.phoneHref && (
            <a
              href={contact.phoneHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 border border-seg-ink px-6 text-[15px] font-medium text-seg-ink hover:bg-seg-tint"
            >
              <Phone className="h-4 w-4" strokeWidth={1.75} /> Call {contact.phone}
            </a>
          )}
          <Link
            href="/contact"
            className={`inline-flex min-h-12 items-center justify-center px-6 text-[15px] font-medium ${
              contact.whatsapp || contact.phone
                ? "text-charcoal underline underline-offset-4 decoration-1"
                : "bg-seg-ink text-bone hover:bg-accent-dark"
            }`}
          >
            Write to us or request a bulk quote
          </Link>
          {contact.address && <p className="text-sm text-stone text-center">{contact.address}</p>}
        </div>
      </div>
    </section>
  );
}
