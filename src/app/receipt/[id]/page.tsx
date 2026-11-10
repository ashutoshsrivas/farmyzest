// The bill is standardised on the A5 GST tax invoice everywhere. This route is
// kept (it's linked from older WhatsApp confirmations) but now redirects to the
// canonical invoice so every shared/printed bill is identical.
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/invoice/${id}`);
}
