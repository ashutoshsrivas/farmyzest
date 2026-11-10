"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export function ProfileForm({
  name: initialName,
  email,
  phone: initialPhone,
}: {
  name: string;
  email: string;
  phone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);

  const inputCls =
    "w-full border border-nate-grey-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save your profile");
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    } catch {
      toast.error("Couldn't save your profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="bg-white rounded-xl p-6 shadow-sm space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">Email</label>
        <input
          value={email}
          disabled
          className={`${inputCls} bg-nate-grey-50 text-nate-grey-500 cursor-not-allowed`}
        />
        <p className="text-xs text-nate-grey-400 mt-1.5">
          Your email is your login ID and can&apos;t be changed here.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-nate-grey-700 mb-1.5">Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          placeholder="+91 XXXXX XXXXX"
          className={inputCls}
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="bg-nate-grey-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-nate-grey-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
