import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsForm } from "./_components/SettingsForm";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Store Settings</h1>
      </div>

      <SettingsForm />
    </div>
  );
}