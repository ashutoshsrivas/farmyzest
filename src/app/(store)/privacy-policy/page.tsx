// src/app/(store)/privacy-policy/page.tsx
import type { Metadata } from "next";
import { readStoreSettings } from "@/lib/store-settings";
import { STORE_PHONE } from "@/lib/company";

export const metadata: Metadata = {
  title: "Privacy Policy — Farmyzest",
  description:
    "Understand how Farmyzest collects, uses, and protects your personal information in compliance with Indian data protection laws.",
};

// Pull the real store phone (admin → Settings) at request time instead of a
// hard-coded placeholder.
export const dynamic = "force-dynamic";

export default async function PrivacyPolicyPage() {
  const settings = await readStoreSettings();
  const phone = (settings.storePhone || STORE_PHONE).trim();
  return (
    <main className="bg-nate-grey-100 min-h-screen font-sans">
      {/* Hero */}
      <section className="bg-nate-grey-800 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-accent-highlight text-sm font-medium tracking-widest uppercase mb-3">
            Legal
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-white leading-tight">
            Privacy Policy
          </h1>
          <p className="text-nate-grey-400 mt-4 text-lg">
            Last updated: January 2025 · In compliance with the Digital Personal
            Data Protection Act, 2023 (DPDP Act)
          </p>
        </div>
      </section>

      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-14 space-y-12 max-w-[1600px] mx-auto">
        {/* Intro */}
        <p className="text-nate-grey-700 leading-relaxed text-base">
          At <strong>Farmyzest</strong> (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or
          &ldquo;company&rdquo;), we are committed to protecting your privacy and
          ensuring your personal data is handled responsibly. This Privacy Policy
          explains how we collect, use, disclose, and safeguard your information
          when you use our website{' '}
          <strong>www.farmyzest.com</strong> and our mobile application
          (collectively, the &ldquo;Platform&rdquo;). By using our Platform, you agree
          to the terms outlined herein.
        </p>

        {/* Section 1 */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            1. Information We Collect
          </h2>
          <div className="space-y-4 text-nate-grey-700 leading-relaxed text-base">
            <p>
              We collect the following categories of personal information in
              compliance with the DPDP Act, 2023:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong>Identity Data:</strong> Name, date of birth, gender
              </li>
              <li>
                <strong>Contact Data:</strong> Email address, phone number,
                shipping address, billing address
              </li>
              <li>
                <strong>Payment Data:</strong> UPI ID, bank account details,
                card last 4 digits — processed through PCI-DSS compliant payment
                gateways; we do not store full card numbers
              </li>
              <li>
                <strong>Order Data:</strong> Products purchased, order value,
                GSTIN (if provided for business purchases), order history
              </li>
              <li>
                <strong>Device &amp; Usage Data:</strong> IP address, browser
                type, device identifiers, pages visited, time spent — collected
                via cookies and analytics
              </li>
              <li>
                <strong>Voluntary Data:</strong> Garden type, plant and product
                preferences, surveys, wishlist data you actively share
              </li>
            </ul>
          </div>
        </section>

        <hr className="border-nate-grey-300" />

        {/* Section 2 */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            2. How We Use Your Information
          </h2>
          <div className="space-y-4 text-nate-grey-700 leading-relaxed text-base">
            <p>We use your personal information for the following purposes:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Processing and fulfilling your orders, including GST-compliant invoicing</li>
              <li>Managing shipments through our logistics partners (Delhivery, BlueDart)</li>
              <li>Sending transactional communications (order confirmation, dispatch updates, delivery alerts)</li>
              <li>Responding to queries, complaints, and return/exchange requests under Indian consumer law</li>
              <li>Personalising your shopping experience and recommending products</li>
              <li>Marketing communications (with your explicit consent), in compliance with TRAI and IT Act norms</li>
              <li>Detecting and preventing fraud, in accordance with RBI and payment ecosystem guidelines</li>
              <li>Compliance with legal obligations under the GST Act, 2017, and Consumer Protection Act, 2019</li>
            </ul>
            <p className="bg-nate-grey-200 border-l-4 border-accent-highlight p-4 rounded-r-sm text-sm">
              <strong>Legal Basis:</strong> We process your data primarily on the basis of
              performance of contract (placing an order) and our legitimate interest
              (fraud prevention, customer service). Marketing is conducted only with
              your explicit, freely given consent.
            </p>
          </div>
        </section>

        <hr className="border-nate-grey-300" />

        {/* Section 3 */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            3. Cookies &amp; Tracking Technologies
          </h2>
          <div className="space-y-4 text-nate-grey-700 leading-relaxed text-base">
            <p>
              Our Platform uses cookies and similar technologies to enhance your
              browsing experience. Under the IT Act, 2000 (as amended), consent
              for non-essential cookies is obtained at the time of your first visit.
            </p>
            <div className="grid gap-4">
              <div className="bg-white border border-nate-grey-300 rounded-lg p-4">
                <h3 className="font-medium text-nate-grey-800 mb-1">Essential Cookies</h3>
                <p className="text-sm text-nate-grey-600">
                  Required for cart, checkout, and session management. Cannot be disabled.
                </p>
              </div>
              <div className="bg-white border border-nate-grey-300 rounded-lg p-4">
                <h3 className="font-medium text-nate-grey-800 mb-1">Analytics Cookies</h3>
                <p className="text-sm text-nate-grey-600">
                  Help us understand how visitors interact with our Platform. You may
                  opt out in your account settings or browser preferences.
                </p>
              </div>
              <div className="bg-white border border-nate-grey-300 rounded-lg p-4">
                <h3 className="font-medium text-nate-grey-800 mb-1">Marketing Cookies</h3>
                <p className="text-sm text-nate-grey-600">
                  Used to deliver relevant ads on third-party platforms. You may opt out
                  at any time via our consent manager or by contacting us directly.
                </p>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-nate-grey-300" />

        {/* Section 4 */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            4. Sharing with Third Parties
          </h2>
          <div className="space-y-4 text-nate-grey-700 leading-relaxed text-base">
            <p>
              We do not sell your personal data. We share your information only with:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong>Logistics Partners:</strong> Delhivery, BlueDart, India Post —
                for order delivery, in accordance with your shipping preferences
              </li>
              <li>
                <strong>Payment Gateway:</strong> PayU (PayU Payments Private Limited) — for
                processing UPI, card, and net banking transactions; PCI-DSS compliant
              </li>
              <li>
                <strong>Cloud &amp; Infrastructure Providers:</strong> AWS India for
                secure data hosting within Indian data centres, in compliance with
                data localisation requirements
              </li>
              <li>
                <strong>Marketing Platforms:</strong> Google, Meta (only with your
                consent for retargeting and personalised advertising)
              </li>
              <li>
                <strong>Legal Authorities:</strong> When required by law, court order,
                or under the IT Act, 2000, or for compliance with GST audits
              </li>
            </ul>
            <p className="text-sm text-nate-grey-500">
              All third-party data processors are bound by appropriate data processing
              agreements that ensure your data is handled only as we instruct.
            </p>
          </div>
        </section>

        <hr className="border-nate-grey-300" />

        {/* Section 5 */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            5. Your Rights Under DPDP Act, 2023
          </h2>
          <div className="space-y-4 text-nate-grey-700 leading-relaxed text-base">
            <p>As an Indian consumer, you have the right to:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong>Access</strong> a copy of your personal data held by us
              </li>
              <li>
                <strong>Correct</strong> inaccurate or incomplete personal data
              </li>
              <li>
                <strong>Withdraw consent</strong> for data processing at any time
              </li>
              <li>
                <strong>Port</strong> your data in a machine-readable format
              </li>
              <li>
                <strong>Erase</strong> your personal data (&ldquo;right to be
                forgotten&rdquo;), subject to legal retention obligations under the
                Companies Act and GST Act
              </li>
              <li>
                <strong>Grieve</strong> with our grievance officer and, if
                unresolved, escalate to the Data Protection Board of India
              </li>
            </ul>
            <p>
              To exercise any of these rights, please contact our Data Protection
              Officer (see Section 7).
            </p>
          </div>
        </section>

        <hr className="border-nate-grey-300" />

        {/* Section 6 */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            6. Data Retention
          </h2>
          <div className="space-y-4 text-nate-grey-700 leading-relaxed text-base">
            <p>
              We retain your personal data only for as long as necessary to fulfil
              the purposes outlined in this policy, subject to:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong>GST records:</strong> Retained for 8 years as per the CGST Act, 2017
              </li>
              <li>
                <strong>Order &amp; transaction data:</strong> Retained for minimum 3
                years for consumer protection and dispute resolution under the
                Consumer Protection Act, 2019
              </li>
              <li>
                <strong>Marketing preferences:</strong> Retained until you withdraw consent
              </li>
            </ul>
            <p>
              After the retention period, your data is securely deleted or anonymised
              in accordance with our data retention policy.
            </p>
          </div>
        </section>

        <hr className="border-nate-grey-300" />

        {/* Section 7 */}
        <section>
          <h2 className="font-serif text-2xl text-nate-grey-800 mb-4">
            7. Contact &amp; Grievance Redressal
          </h2>
          <div className="bg-nate-grey-200 rounded-xl p-6 space-y-3 text-nate-grey-700">
            <p className="font-medium text-nate-grey-800">
              Data Protection Officer (DPO)
            </p>
            <p>
              <strong>Email:</strong> privacy@farmyzest.com
            </p>
            {phone && (
              <p>
                <strong>Phone:</strong> {phone} (Mon–Sat, 10 AM – 7 PM IST)
              </p>
            )}
            <p>
              <strong>Address:</strong> Farmyzest, C-12, Sector 8, Noida,
              Gautam Buddha Nagar, Uttar Pradesh – 201301
            </p>
            <p className="text-sm pt-2 border-t border-nate-grey-300">
              We acknowledge all data-related grievances within{" "}
              <strong>48 hours</strong> and resolve them within{" "}
              <strong>30 days</strong> as mandated by the DPDP Act, 2023.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}