"use client";

import { useState } from "react";
import { MapPin, Phone, Mail, Clock, ArrowRight } from "lucide-react";
import { STORE_ADDRESS, STORE_EMAIL, STORE_PHONE } from "@/lib/company";

// Map embed searches the store address (no API key needed). Replace with the
// Google Maps "Embed a map" URL once the listing exists.
const MAP_SRC = `https://www.google.com/maps?q=${encodeURIComponent(STORE_ADDRESS)}&output=embed`;
const DIRECTIONS = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_ADDRESS)}`;

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSubmitted(true);
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    "w-full border border-nate-grey-300 bg-white px-4 py-3 text-[15px] text-nate-grey-800 placeholder:text-nate-grey-400 transition-colors focus:border-nate-grey-800 focus:outline-none";

  return (
    <div className="min-h-screen bg-nate-grey-100">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="bg-nate-grey-900 text-white">
        <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-20 md:py-28">
          <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.3em] text-nate-grey-400">
            Farmyzest
          </p>
          <h1 className="mt-4 text-4xl md:text-6xl font-serif leading-[1.05]">
            Get in touch
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-nate-grey-300">
            Visit our store, call for advice on seeds, plant care or machinery, or drop us
            a note — we usually reply within a day.
          </p>
        </div>
      </div>

      {/* ── Info rail + form ─────────────────────────────────── */}
      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-20">
          {/* Left: contact details */}
          <div>
            <h2 className="text-2xl md:text-3xl font-serif text-nate-grey-900">
              The store
            </h2>
            <div className="mt-8 h-px w-16 bg-nate-grey-300" />

            <ul className="mt-8 space-y-8">
              <li className="flex gap-4">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-nate-grey-900" strokeWidth={1.5} />
                <div>
                  <h3 className="text-[12px] font-sans font-semibold uppercase tracking-[0.15em] text-nate-grey-500">
                    Address
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-nate-grey-800">
                    {STORE_ADDRESS}
                  </p>
                  <a
                    href={DIRECTIONS}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-nate-grey-900 underline underline-offset-4 hover:text-nate-grey-600"
                  >
                    Get directions <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </a>
                </div>
              </li>

              <li className="flex gap-4">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-nate-grey-900" strokeWidth={1.5} />
                <div>
                  <h3 className="text-[12px] font-sans font-semibold uppercase tracking-[0.15em] text-nate-grey-500">
                    Phone
                  </h3>
                  <a
                    href={`tel:${STORE_PHONE.replace(/\s/g, "")}`}
                    className="mt-2 block text-[15px] text-nate-grey-800 hover:text-nate-grey-900"
                  >
                    {STORE_PHONE}
                  </a>
                </div>
              </li>

              <li className="flex gap-4">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-nate-grey-900" strokeWidth={1.5} />
                <div>
                  <h3 className="text-[12px] font-sans font-semibold uppercase tracking-[0.15em] text-nate-grey-500">
                    Email
                  </h3>
                  <a
                    href={`mailto:${STORE_EMAIL}`}
                    className="mt-2 block text-[15px] text-nate-grey-800 hover:text-nate-grey-900"
                  >
                    {STORE_EMAIL}
                  </a>
                </div>
              </li>

              <li className="flex gap-4">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-nate-grey-900" strokeWidth={1.5} />
                <div>
                  <h3 className="text-[12px] font-sans font-semibold uppercase tracking-[0.15em] text-nate-grey-500">
                    Hours
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-nate-grey-800">
                    Mon – Sat · 9:30 AM — 7:30 PM
                  </p>
                </div>
              </li>
            </ul>
          </div>

          {/* Right: form card */}
          <div className="border border-nate-grey-200 bg-white p-8 md:p-10">
            {submitted ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-nate-grey-900 text-2xl text-white">
                  ✓
                </div>
                <h2 className="mt-6 text-2xl font-serif text-nate-grey-900">Message sent</h2>
                <p className="mt-3 max-w-sm text-[15px] text-nate-grey-500">
                  Thank you for reaching out. We&apos;ll get back to you within a day.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl md:text-3xl font-serif text-nate-grey-900">
                  Send a message
                </h2>
                <p className="mt-2 text-[15px] text-nate-grey-500">
                  Have a question about a product or an order? Write to us below.
                </p>
                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <label className="mb-2 block text-[12px] font-sans font-semibold uppercase tracking-[0.15em] text-nate-grey-500">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="mb-2 block text-[12px] font-sans font-semibold uppercase tracking-[0.15em] text-nate-grey-500">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[12px] font-sans font-semibold uppercase tracking-[0.15em] text-nate-grey-500">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-[12px] font-sans font-semibold uppercase tracking-[0.15em] text-nate-grey-500">
                      Message
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="group flex w-full items-center justify-center gap-2 bg-nate-grey-900 py-4 text-[12px] font-sans font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-nate-grey-700 disabled:opacity-60"
                  >
                    {sending ? "Sending…" : "Send message"}
                    {!sending && (
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Map ──────────────────────────────────────────────── */}
      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 pb-20 md:pb-28">
        <div className="overflow-hidden border border-nate-grey-200">
          <iframe
            src={MAP_SRC}
            title="Farmyzest — Nidhi Enterprises store location"
            className="h-[380px] w-full md:h-[460px]"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </div>
  );
}
