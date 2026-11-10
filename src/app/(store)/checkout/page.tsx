"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useCartStore } from "@/lib/store";
import Link from "next/link";

interface LoyaltyState {
  balance: number;
  rupeeValuePerPoint: number;
  minRedeemAmount: number;
}

export default function CheckoutPage() {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";
  const { items, total, clearCart } = useCartStore();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    name: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    paymentMethod: "ONLINE",
  });
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState("");

  // Loyalty: pulls balance + active config for the logged-in user. Endpoint
  // returns 401 for guests — we just hide the redeem block in that case.
  const [loyalty, setLoyalty] = useState<LoyaltyState | null>(null);
  const [redeemPoints, setRedeemPoints] = useState<number>(0);

  // Wallet store credit: balance (in rupees) for the logged-in customer.
  // /api/wallet/me returns 401 for guests — we just hide the block in that case.
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [useWallet, setUseWallet] = useState<boolean>(false);

  // Discount: automatic spend-tier (no code) + an optional entered coupon code,
  // quoted server-side against the live cart by /api/coupons/validate.
  type Quote = {
    autoDiscount: number;
    autoLabel: string | null;
    code:
      | null
      | { valid: true; code: string; extra: number }
      | { valid: false; message: string };
    discount: number;
    freeShipping: boolean;
  };
  const [quote, setQuote] = useState<Quote | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  // Admin-controlled checkout options. Hidden until the config loads.
  const [codEnabled, setCodEnabled] = useState(false);
  const [partialEnabled, setPartialEnabled] = useState(false);
  const [partialPercent, setPartialPercent] = useState(0);

  useEffect(() => {
    fetch("/api/store-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setCodEnabled(!!d.codEnabled);
        setPartialEnabled(!!d.partialPaymentEnabled);
        setPartialPercent(Number(d.partialPaymentPercent) || 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/loyalty/balance")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.config) return;
        setLoyalty({
          balance: Math.floor(data.balance ?? 0),
          rupeeValuePerPoint: data.config.rupeeValuePerPoint ?? 0,
          minRedeemAmount: data.config.minRedeemAmount ?? 0,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wallet/me")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setWalletBalance(Math.max(0, data.balance ?? 0));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Logged-in shoppers: prefill ALL contact + address details from their saved
  // profile / most recent order. (Guests only get name autofilled, on blur.)
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    fetch("/api/account/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setFormData((prev) => ({
          ...prev,
          name: prev.name.trim() || d.name || prev.name,
          email: prev.email.trim() || d.email || prev.email,
          phone: prev.phone.trim() || d.phone || prev.phone,
          address: prev.address.trim() || d.address || prev.address,
          city: prev.city.trim() || d.city || prev.city,
          state: prev.state.trim() || d.state || prev.state,
          pincode: prev.pincode.trim() || d.pincode || prev.pincode,
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const subtotal = total();
  const eligibleToRedeem = !!loyalty && subtotal >= loyalty.minRedeemAmount && loyalty.balance > 0;
  const maxRedeemable = useMemo(() => {
    if (!loyalty) return 0;
    const byBalance = loyalty.balance;
    const byValue = Math.floor(subtotal / Math.max(0.01, loyalty.rupeeValuePerPoint));
    return Math.max(0, Math.min(byBalance, byValue));
  }, [loyalty, subtotal]);
  const safeRedeem = Math.max(0, Math.min(redeemPoints, maxRedeemable));
  const discountFromPoints = loyalty
    ? Math.round(safeRedeem * loyalty.rupeeValuePerPoint * 100) / 100
    : 0;
  const cartSig = items.map((i) => `${i.variantId}:${i.quantity}`).join("|");

  // Re-quote the cart whenever it changes or a code is applied/cleared. setState
  // only runs inside .then callbacks, so the effect never sets state synchronously.
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        code: appliedCode || undefined,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((q: Quote | null) => {
        if (cancelled || !q) return;
        setQuote(q);
        // Drop an applied code that no longer beats the automatic discount.
        if (appliedCode && !(q.code && q.code.valid)) setAppliedCode(null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cartSig, appliedCode]);

  const autoDiscount = quote?.autoDiscount ?? 0;
  const codeExtra = quote?.code && quote.code.valid ? quote.code.extra : 0;
  const couponDiscount = quote?.discount ?? 0; // total = auto + any code extra
  const couponError = quote?.code && !quote.code.valid ? quote.code.message : "";
  // Free shipping site-wide — no delivery charge on the bill.
  const shipping = 0;
  // Coupon + loyalty come off first; store credit then applies to what's left.
  const totalBeforeWallet = Math.max(
    0,
    subtotal + shipping - discountFromPoints - couponDiscount
  );
  const walletApplied = useWallet ? Math.min(walletBalance, totalBeforeWallet) : 0;
  const finalTotal = Math.max(0, totalBeforeWallet - walletApplied);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponBusy(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          code,
        }),
      });
      const q: Quote | null = res.ok ? await res.json() : null;
      if (q) {
        setQuote(q);
        setAppliedCode(q.code && q.code.valid ? code.toUpperCase() : null);
      }
    } finally {
      setCouponBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          redeemPoints: safeRedeem,
          redeemWallet: walletApplied,
          couponCode: appliedCode ?? undefined,
          items: items.map((item) => ({
            variantId: item.variantId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.price,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSubmitError(data.error ?? "Could not place your order. Please try again.");
        return;
      }

      // Cash on Delivery → order is placed immediately.
      if (formData.paymentMethod === "COD") {
        setOrderId(data.orderId);
        setOrderPlaced(true);
        clearCart();
        return;
      }

      // Online (PayU) → fetch the signed params and hand the shopper to PayU's
      // hosted page via an auto-submitting form. The cart is cleared on the
      // success page, so a failed/abandoned payment leaves it intact for a retry.
      const initRes = await fetch("/api/payu/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: data.orderId }),
      });
      const init = await initRes.json();
      if (!initRes.ok || !init.action || !init.params) {
        setSubmitError(init.error ?? "Could not start the online payment. Please try again.");
        return;
      }
      const form = document.createElement("form");
      form.method = "POST";
      form.action = init.action;
      for (const [k, v] of Object.entries(init.params as Record<string, string>)) {
        const field = document.createElement("input");
        field.type = "hidden";
        field.name = k;
        field.value = String(v);
        form.appendChild(field);
      }
      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      console.error("Order failed:", error);
      setSubmitError("Something went wrong. Please try again.");
    }
  };

  // Guest autofill: when a returning guest types a known email or phone, fill in
  // ONLY their name (privacy — we don't reveal a stranger's saved address from a
  // typed-in email). Logged-in shoppers are fully prefilled from their own
  // account, so the guest lookup is skipped for them.
  const lookupCustomer = async (by: "email" | "phone") => {
    if (isLoggedIn) return;
    const value = (by === "email" ? formData.email : formData.phone).trim();
    if (by === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return;
    if (by === "phone" && value.replace(/\D/g, "").length < 10) return;
    try {
      const res = await fetch(`/api/customer/lookup?${by}=${encodeURIComponent(value)}`);
      if (!res.ok) return;
      const d = await res.json();
      if (!d.found || !d.name) return;
      setFormData((prev) => ({ ...prev, name: prev.name.trim() ? prev.name : d.name }));
    } catch {
      /* ignore — autofill is best-effort */
    }
  };

  if (items.length === 0 && !orderPlaced) {
    return (
      <div className="min-h-screen py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-serif mb-4">Your Cart is Empty</h1>
          <Link href="/shop" className="text-accent hover:underline">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="text-6xl mb-6">✓</div>
          <h1 className="text-3xl font-serif mb-4">Order Placed!</h1>
          <p className="text-nate-grey-500 mb-2">Order ID: {orderId}</p>
          <p className="text-nate-grey-500 mb-8">
            Thank you for your order. You will receive a confirmation shortly.
          </p>
          <Link
            href="/account/orders"
            className="inline-block bg-nate-grey-800 text-white px-8 py-4 rounded-lg hover:bg-nate-grey-700 transition-colors"
          >
            View Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-serif mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg p-6">
              <form onSubmit={handleSubmit}>
                <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      onBlur={() => lookupCustomer("email")}
                      className="w-full border rounded-lg px-4 py-3"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      onBlur={() => lookupCustomer("phone")}
                      className="w-full border rounded-lg px-4 py-3"
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>
                </div>

                <h2 className="text-lg font-semibold mb-4">Shipping Address</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded-lg px-4 py-3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Address</label>
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full border rounded-lg px-4 py-3"
                      placeholder="Street address"
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">City</label>
                      <input
                        type="text"
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full border rounded-lg px-4 py-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">State</label>
                      <input
                        type="text"
                        required
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="w-full border rounded-lg px-4 py-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Pincode</label>
                      <input
                        type="text"
                        required
                        value={formData.pincode}
                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        className="w-full border rounded-lg px-4 py-3"
                      />
                    </div>
                  </div>
                </div>

                <h2 className="text-lg font-semibold mt-8 mb-4">Payment Method</h2>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:border-accent">
                    <input
                      type="radio"
                      name="payment"
                      value="ONLINE"
                      checked={formData.paymentMethod === "ONLINE"}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    />
                    <span className="font-medium">Pay Online</span>
                    <span className="text-sm text-nate-grey-500 ml-auto">UPI, Cards, NetBanking · via PayU</span>
                  </label>
                  {partialEnabled && partialPercent > 0 && (() => {
                    const advance = Math.round((finalTotal * partialPercent) / 100);
                    const balance = Math.max(0, finalTotal - advance);
                    return (
                      <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:border-accent">
                        <input
                          type="radio"
                          name="payment"
                          value="PARTIAL"
                          checked={formData.paymentMethod === "PARTIAL"}
                          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                        />
                        <span className="font-medium">Pay {partialPercent}% Now</span>
                        <span className="text-sm text-nate-grey-500 ml-auto text-right">
                          ₹{advance.toFixed(2)} online now · ₹{balance.toFixed(2)} on delivery
                        </span>
                      </label>
                    );
                  })()}
                  {codEnabled && (
                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:border-accent">
                      <input
                        type="radio"
                        name="payment"
                        value="COD"
                        checked={formData.paymentMethod === "COD"}
                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                      />
                      <span className="font-medium">Cash on Delivery</span>
                      <span className="text-sm text-nate-grey-500 ml-auto">Pay when you receive</span>
                    </label>
                  )}
                </div>

                {/* Loyalty points — only visible to logged-in customers
                    whose subtotal meets the configured minimum. */}
                {loyalty && (
                  <div className="mt-8 p-4 border border-nate-grey-200 rounded-lg bg-nate-grey-50">
                    <h3 className="text-sm font-semibold mb-2">Loyalty points</h3>
                    <p className="text-xs text-nate-grey-500 mb-3">
                      You have <strong>{loyalty.balance}</strong> points
                      (worth ₹{(loyalty.balance * loyalty.rupeeValuePerPoint).toFixed(0)}).
                      {!eligibleToRedeem && (
                        <>
                          {" "}Spend at least ₹{loyalty.minRedeemAmount} to redeem.
                        </>
                      )}
                    </p>
                    {eligibleToRedeem && (
                      <div className="flex items-center gap-3">
                        <input
                          type="text" inputMode="decimal"
                          min={0}
                          max={maxRedeemable}
                          value={redeemPoints}
                          onChange={(e) =>
                            setRedeemPoints(
                              Math.max(
                                0,
                                Math.min(maxRedeemable, parseInt(e.target.value) || 0)
                              )
                            )
                          }
                          className="w-24 border rounded-lg px-3 py-2 text-sm"
                          placeholder="0"
                        />
                        <span className="text-xs text-nate-grey-500">
                          ≤ {maxRedeemable} (= ₹
                          {(maxRedeemable * loyalty.rupeeValuePerPoint).toFixed(0)})
                        </span>
                        {safeRedeem > 0 && (
                          <button
                            type="button"
                            onClick={() => setRedeemPoints(0)}
                            className="ml-auto text-xs text-nate-grey-500 hover:text-nate-grey-800"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Store credit (wallet) — only visible to logged-in
                    customers with a positive balance. */}
                {walletBalance > 0 && (
                  <div className="mt-8 p-4 border border-nate-grey-200 rounded-lg bg-nate-grey-50">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useWallet}
                        onChange={(e) => setUseWallet(e.target.checked)}
                      />
                      <span className="text-sm font-semibold">Use store credit</span>
                      <span className="text-xs text-nate-grey-500 ml-auto">
                        Balance: ₹{walletBalance.toFixed(2)}
                      </span>
                    </label>
                    {useWallet && walletApplied > 0 && (
                      <p className="text-xs text-nate-grey-500 mt-2">
                        Applying ₹{walletApplied.toFixed(2)} to this order.
                      </p>
                    )}
                  </div>
                )}

                {/* Discount coupon — applied on top of the automatic spend discount */}
                <div className="mt-8 p-4 border border-nate-grey-200 rounded-lg">
                  <h3 className="text-sm font-semibold mb-2">Discount coupon</h3>
                  {appliedCode ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-700">
                        <strong>{appliedCode}</strong> applied
                        {codeExtra > 0 && <> — extra ₹{codeExtra.toFixed(2)} off</>}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedCode(null);
                          setCouponInput("");
                        }}
                        className="text-xs text-nate-grey-500 hover:text-nate-grey-800"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Enter code"
                        className="flex-1 border rounded-lg px-3 py-2 text-sm uppercase"
                      />
                      <button
                        type="button"
                        onClick={applyCoupon}
                        disabled={couponBusy || !couponInput.trim()}
                        className="px-4 py-2 text-sm bg-nate-grey-800 text-white rounded-lg hover:bg-nate-grey-700 disabled:opacity-60"
                      >
                        {couponBusy ? "…" : "Apply"}
                      </button>
                    </div>
                  )}
                  {couponError && <p className="text-xs text-red-600 mt-2">{couponError}</p>}
                </div>

                {submitError && (
                  <p className="mt-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full mt-8 bg-nate-grey-800 text-white py-4 rounded-lg font-medium hover:bg-nate-grey-700 transition-colors"
                >
                  {formData.paymentMethod === "COD"
                    ? `Place Order — ₹${finalTotal.toFixed(2)}`
                    : formData.paymentMethod === "PARTIAL"
                    ? `Pay ₹${Math.round((finalTotal * partialPercent) / 100).toFixed(2)} Now`
                    : `Pay ₹${finalTotal.toFixed(2)}`}
                </button>
              </form>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg h-fit sticky top-24">
            <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
            <div className="space-y-3 text-sm max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div key={item.variantId} className="flex justify-between">
                  <span className="text-nate-grey-500">
                    {item.name}
                    {item.variantLabel ? ` (${item.variantLabel})` : ""} × {item.quantity}
                  </span>
                  <span className={item.isSpecial ? "price-special font-medium" : ""}>₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t mt-4 pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-nate-grey-500">Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-nate-grey-500">Shipping</span>
                <span>{shipping === 0 ? "Free" : `₹${shipping}`}</span>
              </div>
              {discountFromPoints > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Loyalty discount ({safeRedeem} pts)</span>
                  <span>−₹{discountFromPoints.toFixed(2)}</span>
                </div>
              )}
              {autoDiscount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>{quote?.autoLabel ?? "Spend discount"}</span>
                  <span>−₹{autoDiscount.toFixed(2)}</span>
                </div>
              )}
              {codeExtra > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Coupon ({appliedCode})</span>
                  <span>−₹{codeExtra.toFixed(2)}</span>
                </div>
              )}
              {walletApplied > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Store credit</span>
                  <span>−₹{walletApplied.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total</span>
                <span>₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}