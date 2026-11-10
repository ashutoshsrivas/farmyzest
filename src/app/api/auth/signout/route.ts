import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export async function POST() {
  try {
    await signOut({ redirectTo: "/" });
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"));
  } catch {
    return NextResponse.json({ error: "Sign out failed" }, { status: 500 });
  }
}