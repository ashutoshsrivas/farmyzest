"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, Loader2, Eye, EyeOff } from "lucide-react";

export default function StoreBoardLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/store-board/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Trim — phone keyboards/autofill love to add stray spaces.
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Sign in failed");
        return;
      }
      router.replace("/store-board");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full border border-nate-grey-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-nate-grey-400 bg-white";

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-nate-grey-900 text-white grid place-items-center mx-auto mb-4">
          <Store className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-serif text-nate-grey-900">Store Board</h1>
        <p className="text-sm text-nate-grey-500 mt-1">Sign in to view stock</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          inputMode="email"
          name="sb-email"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            name="sb-pass"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputCls} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            aria-label={showPw ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-nate-grey-400 hover:text-nate-grey-700"
          >
            {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 px-1">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-nate-grey-900 text-white py-3.5 rounded-xl font-semibold text-base hover:bg-black active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
