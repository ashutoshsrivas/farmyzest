import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true },
  });
  if (!user) redirect("/auth/login");

  return (
    <>
      <div className="mb-2">
        <h1 className="text-3xl font-serif text-nate-grey-800">Profile</h1>
        <p className="text-nate-grey-500 mt-1 text-sm">Manage your personal details.</p>
      </div>
      <ProfileForm name={user.name} email={user.email} phone={user.phone ?? ""} />
    </>
  );
}
