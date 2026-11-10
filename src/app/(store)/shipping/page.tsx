export const metadata = {
  title: "Shipping Policy — Farmyzest",
  description: "Delivery timelines, charges, and serviceable areas for Farmyzest orders.",
};

// Shipping Policy. Charges mirror the checkout logic (free over ₹999, else ₹99).
export default function ShippingPage() {
  return (
    <main className="bg-nate-grey-100 min-h-screen font-sans">
      <section className="bg-nate-grey-800 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-accent-highlight text-sm font-medium tracking-widest uppercase mb-3">
            Policies
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-white leading-tight">
            Shipping Policy
          </h1>
          <p className="text-nate-grey-400 mt-4 text-lg">
            How and when your order reaches you.
          </p>
        </div>
      </section>

      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-14 space-y-12 max-w-[1100px] mx-auto text-nate-grey-700 leading-relaxed text-base">
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">Shipping Charges</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>
              <strong>Free shipping</strong> on all orders across India — prepaid and Cash on Delivery.
            </li>
            <li>No minimum order value. There are no delivery charges at checkout.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">Dispatch &amp; Delivery Timelines</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>Orders are processed and dispatched within <strong>1–3 business days</strong> of confirmation.</li>
            <li>
              Estimated delivery is <strong>3–7 business days</strong> after dispatch, depending on
              your location. Metro cities are usually faster than remote pin codes.
            </li>
            <li>
              You will receive a tracking link by email/WhatsApp once your order ships. Delivery
              estimates are indicative and not guaranteed.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">Serviceable Areas</h2>
          <p>
            We ship across India to all pin codes serviceable by our courier partners. If your pin
            code is not serviceable for prepaid or COD, this will be indicated at checkout. We
            currently do not ship internationally.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">Order Tracking</h2>
          <p>
            You can track your order any time from{" "}
            <a href="/account/orders" className="text-accent underline">My Orders</a> in your
            account, or via the tracking link sent to you on dispatch.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">Delays &amp; Failed Delivery</h2>
          <p>
            Deliveries may occasionally be delayed by weather, regional disruptions, or courier
            constraints — we appreciate your patience in such cases. If a delivery attempt fails (for
            example, no one available to receive, or the address is incorrect), the courier will
            usually re-attempt. Repeated failed attempts may result in the parcel being returned to
            us, after which we will contact you to re-ship or issue store credit.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">Need Help?</h2>
          <div className="bg-white border border-nate-grey-300 rounded-xl p-6 space-y-2">
            <p>
              For any shipping query, email <strong>hello@farmyzest.com</strong> or reach us via
              our <a href="/contact" className="text-accent underline">Contact page</a>. Please keep
              your order number handy.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
