export const metadata = {
  title: "Terms & Conditions — Farmyzest",
  description: "The terms governing your use of the Farmyzest website and purchases.",
};

// Standard e-commerce Terms & Conditions. Plain hardcoded JSX, mirroring the
// privacy-policy / returns page layout. Business-specific details (legal entity
// name, registered address, GSTIN) are confirmed via the Contact page until the
// owner finalises them.
export default function TermsPage() {
  return (
    <main className="bg-nate-grey-100 min-h-screen font-sans">
      <section className="bg-nate-grey-800 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-accent-highlight text-sm font-medium tracking-widest uppercase mb-3">
            Legal
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-white leading-tight">
            Terms &amp; Conditions
          </h1>
          <p className="text-nate-grey-400 mt-4 text-lg">
            Last updated: June 2026. Please read these terms carefully before using our website.
          </p>
        </div>
      </section>

      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-14 space-y-12 max-w-[1100px] mx-auto text-nate-grey-700 leading-relaxed text-base">
        <p>
          These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the
          website <strong>www.farmyzest.com</strong> and the purchase of products from{" "}
          <strong>Farmyzest</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
          By browsing, registering, or placing an order, you agree to be bound by these Terms.
        </p>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">1. Eligibility &amp; Account</h2>
          <p>
            You must be at least 18 years of age, or accessing the Platform under the supervision of
            a parent or legal guardian, to place an order. You are responsible for maintaining the
            confidentiality of your account and for all activity that occurs under it.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">2. Products, Pricing &amp; Availability</h2>
          <p className="space-y-2">
            All prices are listed in Indian Rupees (₹) and are inclusive of applicable taxes unless
            stated otherwise. We make every effort to display product colours, descriptions, and
            prices accurately, but we do not warrant that product descriptions or other content are
            error-free. Products are subject to availability; we reserve the right to limit
            quantities, correct pricing errors, or withdraw any product from sale at any time. In the
            event of an evident pricing error, we may cancel the affected order and issue store
            credit for any amount already paid.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">3. Orders &amp; Acceptance</h2>
          <p>
            Your order constitutes an offer to purchase. An order confirmation acknowledges receipt
            of your order; a contract is formed only when the products are dispatched. We reserve the
            right to accept or decline any order, including where stock is unavailable, where payment
            is not authorised, or where we suspect fraudulent activity.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">4. Payments</h2>
          <p>
            Online payments (UPI, debit/credit cards, and net banking) are processed securely through
            our payment-gateway partner, <strong>PayU (PayU Payments Private Limited)</strong>. We do
            not store your full card details on our servers. Cash on Delivery (COD) may be available
            on eligible orders. By making a payment you confirm that the payment instrument used is
            lawfully yours.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">5. Shipping &amp; Delivery</h2>
          <p>
            Shipping timelines, charges, and serviceable areas are described in our{" "}
            <a href="/shipping" className="text-accent underline">Shipping Policy</a>. Delivery dates
            are estimates and not guaranteed; we are not liable for delays caused by courier partners
            or events beyond our reasonable control.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">6. Returns &amp; Exchanges</h2>
          <p>
            Returns and exchanges are governed by our{" "}
            <a href="/returns" className="text-accent underline">Returns &amp; Exchange Policy</a>.
            Approved returns are resolved as a replacement exchange or as store credit for a future
            order; we do not issue cash refunds to the original payment method.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">7. Intellectual Property</h2>
          <p>
            All content on this website — including logos, product imagery, text, and design — is the
            property of Farmyzest or its licensors and is protected by applicable intellectual
            property laws. You may not reproduce, distribute, or use it without our prior written
            permission.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, our total liability arising out of any order
            shall not exceed the value of that order. We are not liable for indirect, incidental, or
            consequential damages.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">9. Governing Law &amp; Disputes</h2>
          <p>
            These Terms are governed by the laws of India. Any dispute shall be subject to the
            exclusive jurisdiction of the competent courts at New Delhi.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">10. Contact</h2>
          <div className="bg-white border border-nate-grey-300 rounded-xl p-6 space-y-2">
            <p className="font-medium text-nate-grey-800">Farmyzest</p>
            <p>14, Shahpur Jat, South Delhi, Delhi – 110049</p>
            <p>
              Email: <strong>hello@farmyzest.com</strong>
            </p>
            <p>
              Questions? Reach us via our{" "}
              <a href="/contact" className="text-accent underline">Contact page</a>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
