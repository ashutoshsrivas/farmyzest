// src/app/(store)/returns/page.tsx
import type { Metadata } from "next";
import { readStoreSettings } from "@/lib/store-settings";
import { STORE_PHONE } from "@/lib/company";

export const metadata: Metadata = {
  title: "Returns & Exchange Policy — Farmyzest",
  description:
    "Hassle-free returns and exchanges within 7 days. Learn about our conditions, process, and exchange & store-credit timelines for your Farmyzest orders.",
};

// Reads the admin-set store phone at request time, so the contact details are
// always the real number (or omitted) rather than a hard-coded placeholder.
export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const settings = await readStoreSettings();
  const phone = (settings.storePhone || STORE_PHONE).trim();
  return (
    <main className="bg-nate-grey-100 min-h-screen font-sans">
      {/* Hero */}
      <section className="bg-nate-grey-800 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-accent-highlight text-sm font-medium tracking-widest uppercase mb-3">
            Policies
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-white leading-tight">
            Returns &amp; Exchanges
          </h1>
          <p className="text-nate-grey-400 mt-4 text-lg">
            We want every order to help you grow. If something isn&apos;t quite right,
            we make it right — fairly and quickly.
          </p>
        </div>
      </section>

      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-14 space-y-12 max-w-[1600px] mx-auto">
        {/* 7-Day Window Callout */}
        <div className="bg-nate-grey-800 rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-shrink-0 text-center">
            <span className="text-accent-highlight font-serif text-5xl font-bold">
              7
            </span>
            <p className="text-accent-highlight font-serif text-2xl">Days</p>
          </div>
          <div>
            <h2 className="text-white font-serif text-xl mb-2">
              Return Window
            </h2>
            <p className="text-nate-grey-400 leading-relaxed">
              From the date of delivery, you have{" "}
              <strong className="text-white">7 calendar days</strong> to initiate
              a return or exchange. Orders delivered via our logistics partners are
              eligible from the date marked as &ldquo;Delivered&rdquo; in your
              tracking — verified through our courier partner&apos;s proof of
              delivery records.
            </p>
          </div>
        </div>

        {/* Conditions */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            Return Conditions
          </h2>
          <p className="text-nate-grey-700 leading-relaxed mb-6">
            To ensure quality for every customer, all returned items must meet
            our conditions. These align with your rights under the{" "}
            <strong>Consumer Protection Act, 2019</strong>.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                label: "Unused",
                desc: "Tools and machinery must be unused — no fuel, oil, soil or grass residue — with all accessories and manuals included.",
                ok: true,
              },
              {
                label: "Seals & Labels Intact",
                desc: "Product seals, labels, warranty cards and barcodes must be intact. Opened chemical or fertiliser packs cannot be returned.",
                ok: true,
              },
              {
                label: "Original Packaging",
                desc: "Return items in their original packaging — bag, box, or carton as applicable.",
                ok: true,
              },
              {
                label: "No Live or Consumable Goods",
                desc: "Live plants, seeds and opened consumables cannot be returned — if a plant arrives damaged, tell us within 48 hours with photos.",
                ok: false,
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-xl border p-5 ${
                  item.ok
                    ? "bg-white border-nate-grey-300"
                    : "bg-nate-grey-200 border-nate-grey-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      item.ok
                        ? "bg-green-100 text-green-700"
                        : "bg-nate-grey-400 text-white"
                    }`}
                  >
                    {item.ok ? "✓" : "✗"}
                  </span>
                  <div>
                    <h3 className="font-medium text-nate-grey-800">{item.label}</h3>
                    <p className="text-sm text-nate-grey-600 mt-1">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-nate-grey-300" />

        {/* Return Process */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-6">
            How to Return an Item — Step by Step
          </h2>
          <div className="space-y-6">
            {[
              {
                step: "01",
                title: "Raise a Return Request",
                desc: "Log in to your Farmyzest account. Go to My Orders → select the order → click &ldquo;Return/Exchange.&rdquo; Alternatively, email returns@farmyzest.com with your order ID. Requests must be raised within 7 days of delivery.",
              },
              {
                step: "02",
                title: "Select Reason & Upload Images",
                desc: "Choose a return reason from the dropdown (e.g., wrong product, damaged in transit, defective). Upload 2–3 clear photos of the item showing the concern. This helps us process your request within 24 hours.",
              },
              {
                step: "03",
                title: "Receive Approval & Reverse Pickup",
                desc: "Once our team approves your request (within 24 hours), we will schedule a reverse pickup via Delhivery at no extra cost. You will receive an SMS and email with the pickup date and tracking AWB.",
              },
              {
                step: "04",
                title: "Pack & Hand Over",
                desc: "Pack the item securely in its original packaging and attach the return label (sent to your email). Hand the package to the courier executive on the scheduled date.",
              },
              {
                step: "05",
                title: "Exchange / Store Credit Processed",
                desc: "Once we receive and inspect the item (1–2 business days), your resolution is initiated. Choose a replacement, or take the full value as store credit for your next order.",
              },
            ].map((s, i) => (
              <div key={i} className="flex gap-5">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-nate-grey-800 flex items-center justify-center">
                  <span className="text-accent-highlight font-serif text-lg font-bold">
                    {s.step}
                  </span>
                </div>
                <div className="pt-1">
                  <h3 className="font-medium text-nate-grey-800 text-lg">{s.title}</h3>
                  <p className="text-nate-grey-700 leading-relaxed mt-1">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-nate-grey-300" />

        {/* Exchange Process */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            Exchange — Replacement or Different Variant
          </h2>
          <div className="bg-white border border-nate-grey-300 rounded-xl p-6 space-y-4 text-nate-grey-700 leading-relaxed">
            <p>
              We offer a direct exchange for a replacement or a different variant (pack size, capacity or model) where stock is
              available. Exchanges are processed directly and save you the waiting
              period of returning an item first.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-nate-grey-100 rounded-lg p-4">
                <h4 className="font-medium text-nate-grey-800 mb-1">Damaged / Defective</h4>
                <p>Items damaged in transit or with a manufacturing defect are replaced at no cost. Machinery is also covered by the brand warranty.</p>
              </div>
              <div className="bg-nate-grey-100 rounded-lg p-4">
                <h4 className="font-medium text-nate-grey-800 mb-1">Variant Exchange</h4>
                <p>Swap for a different pack size, capacity or model of the same product, subject to availability.</p>
              </div>
            </div>
            <p className="text-sm text-nate-grey-500">
              If the exchange item is of higher value, you will be asked to pay the
              difference before dispatch. For lower-value exchanges, the difference
              is added to your store credit after we receive the original item.
            </p>
          </div>
        </section>

        <hr className="border-nate-grey-300" />

        {/* Exchange & Store-Credit Timeline */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            Exchange &amp; Store-Credit Timeline
          </h2>
          <div className="bg-white border border-nate-grey-300 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-nate-grey-700">
              <thead>
                <tr className="bg-nate-grey-200">
                  <th className="text-left px-5 py-3 font-medium text-nate-grey-800">
                    Resolution
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-nate-grey-800">
                    Timeline
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-nate-grey-800">
                    How it works
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nate-grey-200">
                {[
                  {
                    method: "Exchange — replacement / different variant",
                    timeline: "Dispatched in 2–4 business days",
                    mode: "Sent once the original item is received & inspected",
                  },
                  {
                    method: "Store Credit",
                    timeline: "Instant on approval",
                    mode: "Credited to your Farmyzest account",
                  },
                  {
                    method: "Lower-value exchange difference",
                    timeline: "1–2 business days after inspection",
                    mode: "Added to your store credit balance",
                  },
                ].map((row) => (
                  <tr key={row.method} className="hover:bg-nate-grey-100 transition-colors">
                    <td className="px-5 py-3">{row.method}</td>
                    <td className="px-5 py-3 font-medium text-nate-grey-800">{row.timeline}</td>
                    <td className="px-5 py-3">{row.mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-nate-grey-500 mt-3">
            Exchanges and store credit are processed after we receive and inspect
            the returned item. Bank holidays and weekends may affect timelines. As
            we issue exchanges and store credit rather than cash refunds, the full
            order value — including GST — is retained as store credit for your next
            purchase, so no GST value is lost to you.
          </p>
        </section>

        <hr className="border-nate-grey-300" />

        {/* Non-Returnable Note */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            Items That Cannot Be Returned
          </h2>
          <div className="bg-nate-grey-200 rounded-xl p-6 space-y-2 text-nate-grey-700 text-sm">
            {[
              "Live plants and saplings (damage on arrival is replaced if reported within 48 hours)",
              "Seeds, bulbs and other perishable planting material",
              "Items marked as &apos;Final Sale&apos; or &apos;Non-Returnable&apos; at checkout",
              "Opened pesticides, insecticides, herbicides, fertilisers and manures",
              "Gift cards and digital download purchases",
              "Items returned after the 7-day window",
              "Tools or machinery that have been used, fuelled or show signs of wear",
            ].map((item) => (
              <div key={item} className="flex gap-3">
                <span className="text-nate-grey-400 mt-0.5">—</span>
                <span dangerouslySetInnerHTML={{ __html: item }} />
              </div>
            ))}
          </div>
        </section>

        <hr className="border-nate-grey-300" />

        {/* Defective / Wrong Product */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            Defective or Wrong Product
          </h2>
          <div className="bg-white border border-nate-grey-300 rounded-xl p-6 text-nate-grey-700 leading-relaxed">
            <p>
              If you receive a <strong>defective, damaged, or wrong item</strong>, we
              offer a <strong>priority exchange or full store credit</strong> at no cost
              to you. Please report this within{" "}
              <strong>48 hours of delivery</strong> by:
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>Emailing images to returns@farmyzest.com with subject line &ldquo;DEFECTIVE — Order #[Your Order ID]&rdquo;</li>
              {phone && (
                <li>Calling our helpline at {phone} (Mon–Sat, 10 AM – 7 PM IST)</li>
              )}
            </ul>
            <p className="mt-3 text-sm text-nate-grey-500">
              We will arrange an immediate pickup and prioritised replacement or store
              credit, without waiting for the standard 7-day processing window. This is
              in accordance with your rights under the{" "}
              <strong>Consumer Protection Act, 2019 (E-Commerce Rules)</strong>.
            </p>
          </div>
        </section>

        <hr className="border-nate-grey-300" />

        {/* Contact */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            Contact Our Returns Team
          </h2>
          <div className="bg-nate-grey-200 rounded-xl p-6 space-y-3 text-nate-grey-700">
            <p>
              <strong className="text-nate-grey-800">Email:</strong>{" "}
              returns@farmyzest.com
            </p>
            {phone && (
              <p>
                <strong className="text-nate-grey-800">Phone:</strong> {phone}
              </p>
            )}
            <p>
              <strong className="text-nate-grey-800">Hours:</strong> Monday –
              Saturday, 10 AM – 7 PM IST
            </p>
            <p>
              <strong className="text-nate-grey-800">Response Time:</strong> Within
              24 hours of your request
            </p>
            <p className="text-sm text-nate-grey-500 pt-2 border-t border-nate-grey-300">
              Please include your order ID, images of the item, and your preferred
              resolution (exchange or store credit) in your first communication.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}