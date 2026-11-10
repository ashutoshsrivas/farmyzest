"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Method = "wa" | "email";

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("wa");

  // Shared email (used by both password login and email-OTP login)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Email OTP
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function routeAfterLogin() {
    const session = await getSession();
    router.push((session?.user as any)?.role === "ADMIN" ? "/admin" : "/account");
    router.refresh();
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) setError("Invalid email or password");
    else await routeAfterLogin();
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Couldn't send the code.");
      else setOtpSent(true);
    } catch {
      setError("Network error. Try again.");
    }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("otp", { email, code, redirect: false });
    setLoading(false);
    if (result?.error) setError("Incorrect or expired code.");
    else await routeAfterLogin();
  };

  const inputCls =
    "w-full px-4 py-2.5 border border-nate-grey-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent";
  const tabCls = (active: boolean) =>
    `flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
      active ? "bg-nate-grey-800 text-white" : "bg-nate-grey-100 text-nate-grey-600 hover:bg-nate-grey-200"
    }`;

  return (
    <div className="min-h-screen bg-nate-grey-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-sm text-nate-grey-500 hover:text-nate-grey-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-center mb-6">
            <Link href="/" className="text-2xl font-serif text-nate-grey-800">
              Farmyzest
            </Link>
            <p className="text-sm text-nate-grey-500 mt-2">Sign in to your account</p>
          </div>

          {/* Method tabs */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => { setMethod("wa"); setError(""); }}
              className={tabCls(method === "wa")}
            >
              Email code
            </button>
            <button
              type="button"
              onClick={() => { setMethod("email"); setError(""); }}
              className={tabCls(method === "email")}
            >
              Password
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {method === "email" ? (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="john@example.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" required />
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors disabled:opacity-50">
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          ) : !otpSent ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" required />
                <p className="text-xs text-nate-grey-400 mt-1.5">We&apos;ll email a one-time code to this address.</p>
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors disabled:opacity-50">
                {loading ? "Sending code..." : "Email me a code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">Enter the code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className={`${inputCls} tracking-[0.3em] text-center text-lg`}
                  placeholder="••••••"
                  required
                />
                <p className="text-xs text-nate-grey-400 mt-1.5">Sent to {email} by email.</p>
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors disabled:opacity-50">
                {loading ? "Verifying..." : "Verify & sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setCode(""); setError(""); }}
                className="w-full text-xs text-nate-grey-500 hover:text-nate-grey-800"
              >
                Change number / resend
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
