export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ChevronLeft, ReceiptText, Barcode } from "lucide-react";
import { PrintButton } from "./PrintButton";
import { BillStatusControl, DeleteBillButton } from "../_components/BillActions";

function inr(n: number) {
  return `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

// Line descriptions read "BASE — COLOR / SIZE" (e.g. "PRESTIGE CLASSIC SHIRT —
// BLACK / L-38"). Colour and size are optional. We use this to group each
// product's variants by colour, then by size — instead of the raw insertion
// order, which interleaves colours within a size.
const SIZE_RANK: Record<string, number> = {
  XS: 1, S: 2, M: 3, L: 4, XL: 5, XXL: 6, "2XL": 6, "3XL": 7, "4XL": 8, "5XL": 9,
};

function parseDesc(desc: string) {
  const emIdx = desc.indexOf("—"); // em dash separates base from colour/size
  const base = emIdx >= 0 ? desc.slice(0, emIdx).trim() : desc.trim();
  const rest = emIdx >= 0 ? desc.slice(emIdx + 1).trim() : "";
  const slashIdx = rest.indexOf("/");
  const color = slashIdx >= 0 ? rest.slice(0, slashIdx).trim() : "";
  const size = (slashIdx >= 0 ? rest.slice(slashIdx + 1) : rest).trim();
  // Size sort key: prefer the trailing number (38/40/42…), else a letter rank.
  const num = size.match(/(\d+)/);
  const letters = size.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const sizeKey = num ? parseInt(num[1], 10) : SIZE_RANK[letters] ?? 999;
  return { base, color, size, sizeKey };
}

// Sort items by (product block in first-appearance order, colour A→Z, size ↑),
// keeping each product's rows contiguous and stable within equal keys.
function sortBillItems<T extends { description: string }>(items: T[]): T[] {
  const groupOrder = new Map<string, number>();
  const parsed = items.map((it, i) => {
    const p = parseDesc(it.description);
    if (!groupOrder.has(p.base)) groupOrder.set(p.base, groupOrder.size);
    return { it, i, group: groupOrder.get(p.base)!, color: p.color, sizeKey: p.sizeKey };
  });
  parsed.sort(
    (a, b) =>
      a.group - b.group ||
      a.color.localeCompare(b.color) ||
      a.sizeKey - b.sizeKey ||
      a.i - b.i,
  );
  return parsed.map((p) => p.it);
}

export default async function SupplierBillDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const { id } = await params;
  const bill = await db.supplierBill.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: true,
      payments: { orderBy: { date: "desc" } },
    },
  });
  if (!bill) notFound();

  // Resolve each line's variant code (SKU/barcode) for display.
  const variantIds = bill.items.map((i) => i.variantId).filter((v): v is string => !!v);
  const variants = variantIds.length
    ? await db.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, sku: true, barcode: true } })
    : [];
  const codeByVariant = new Map(variants.map((v) => [v.id, v.sku || v.barcode]));

  const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
  const due = Math.max(0, bill.total - paid);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/purchases"
          className="inline-flex items-center gap-1 text-sm text-nate-grey-500 hover:text-nate-grey-800 mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to purchases
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nate-grey-100 flex items-center justify-center text-nate-grey-700">
              <ReceiptText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif text-2xl text-nate-grey-900">
                {bill.billNumber}
              </h1>
              <p className="text-sm text-nate-grey-500">
                {bill.supplier.name}
                {bill.refBillNo ? ` · Ref ${bill.refBillNo}` : ""}
                {" · "}
                {new Date(bill.date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BillStatusControl billId={bill.id} current={bill.status} />
            <Link
              href={`/admin/purchases/${bill.id}/barcodes`}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-nate-grey-300 text-nate-grey-700 font-medium hover:bg-nate-grey-50"
            >
              <Barcode className="w-3.5 h-3.5" />
              Print barcodes
            </Link>
            <Link
              href={`/admin/purchases/${bill.id}/edit`}
              className="text-xs px-3 py-1.5 rounded-lg border border-nate-grey-300 text-nate-grey-700 font-medium hover:bg-nate-grey-50"
            >
              Edit
            </Link>
            <PrintButton />
            <DeleteBillButton
              billId={bill.id}
              billNumber={bill.billNumber}
              variant="button"
              redirectTo="/admin/purchases"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Supplier">
          <p className="text-sm font-medium text-nate-grey-800">
            {bill.supplier.name}
          </p>
          <p className="text-xs text-nate-grey-500 mt-1">
            {bill.supplier.gstin ? `GSTIN ${bill.supplier.gstin}` : "No GSTIN"}
          </p>
          {bill.supplier.phone && (
            <p className="text-xs text-nate-grey-500">{bill.supplier.phone}</p>
          )}
          {bill.supplier.address && (
            <p className="text-xs text-nate-grey-500 mt-1">
              {bill.supplier.address}
            </p>
          )}
        </Card>

        <Card title="Dates & terms">
          <KV k="Bill date" v={fmtDate(bill.date)} />
          <KV
            k="Shipping date"
            v={bill.shippingDate ? fmtDate(bill.shippingDate) : "—"}
          />
          <KV k="Due date" v={bill.dueDate ? fmtDate(bill.dueDate) : "—"} />
          <KV k="Payment term" v={bill.paymentTerm ?? "—"} />
          <KV
            k="Reverse charge"
            v={bill.reverseCharge ? "Yes" : "No"}
          />
          <KV k="Tax type" v={bill.taxType ?? "Default"} />
        </Card>

        <Card title="Money">
          <KV k="Gross" v={inr(bill.subtotal)} />
          <KV
            k={`Flat discount${
              bill.flatDiscountIsPct ? " (% applied)" : ""
            }`}
            v={`− ${inr(bill.flatDiscount)}`}
          />
          <KV k="Taxable" v={inr(bill.taxableAmount)} />
          <KV k="Tax" v={inr(bill.taxAmount)} />
          <KV k="Round-off" v={inr(bill.roundOff)} />
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-nate-grey-100">
            <span className="text-sm font-medium text-nate-grey-800">
              Net amount
            </span>
            <span className="font-serif text-xl tabular-nums text-nate-grey-900">
              {inr(bill.total)}
            </span>
          </div>
          {paid > 0 && (
            <p className="text-xs text-green-700 mt-2">
              Paid {inr(paid)} — Due {inr(due)}
            </p>
          )}
        </Card>
      </div>

      <div className="bg-white rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-nate-grey-100">
          <h2 className="text-sm font-medium text-nate-grey-800">
            Items ({bill.items.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-nate-grey-50 text-[10px] uppercase tracking-wider text-nate-grey-500">
              <tr>
                <th className="text-left px-5 py-3">Description</th>
                <th className="text-left px-5 py-3">Code</th>
                <th className="text-left px-5 py-3">HSN</th>
                <th className="text-right px-5 py-3">Qty</th>
                <th className="text-right px-5 py-3">Free</th>
                <th className="text-right px-5 py-3">Unit cost</th>
                <th className="text-right px-5 py-3">Net rate</th>
                <th className="text-right px-5 py-3">Tax %</th>
                <th className="text-right px-5 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nate-grey-100">
              {sortBillItems(bill.items).map((it) => (
                <tr key={it.id} className="hover:bg-nate-grey-50/40">
                  <td className="px-5 py-3 text-nate-grey-800">
                    <p className="font-medium">{it.description}</p>
                    {(it.discount1Pct > 0 || it.discount2Pct > 0) && (
                      <p className="text-xs text-nate-grey-500 mt-0.5">
                        Discount: {it.discount1Pct}%
                        {it.discount2Pct > 0 ? ` + ${it.discount2Pct}%` : ""}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-nate-grey-700 whitespace-nowrap">
                    {it.variantId ? codeByVariant.get(it.variantId) ?? "—" : "—"}
                  </td>
                  <td className="px-5 py-3 text-nate-grey-500 text-xs font-mono">
                    {it.hsnCode ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-right">{it.quantity}</td>
                  <td className="px-5 py-3 text-right text-nate-grey-500">
                    {it.freeQuantity || "—"}
                  </td>
                  <td className="px-5 py-3 text-right">{inr(it.unitCost)}</td>
                  <td className="px-5 py-3 text-right">{inr(it.netRate)}</td>
                  <td className="px-5 py-3 text-right text-nate-grey-500">
                    {it.taxPercent ? `${it.taxPercent}%` : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    {inr(it.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(bill.notes || bill.termsAndConditions) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {bill.notes && (
            <Card title="Notes">
              <p className="text-sm text-nate-grey-700 whitespace-pre-line">
                {bill.notes}
              </p>
            </Card>
          )}
          {bill.termsAndConditions && (
            <Card title="Terms & conditions">
              <p className="text-sm text-nate-grey-700 whitespace-pre-line">
                {bill.termsAndConditions}
              </p>
            </Card>
          )}
        </div>
      )}

      {bill.payments.length > 0 && (
        <div className="bg-white rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-nate-grey-100">
            <h2 className="text-sm font-medium text-nate-grey-800">Payments</h2>
          </div>
          <div className="divide-y divide-nate-grey-100">
            {bill.payments.map((p) => (
              <div
                key={p.id}
                className="px-5 py-3 flex items-center justify-between text-sm"
              >
                <div>
                  <p className="font-medium text-nate-grey-800">
                    {inr(p.amount)}{" "}
                    <span className="text-xs text-nate-grey-500 font-normal">
                      via {p.method}
                    </span>
                  </p>
                  <p className="text-xs text-nate-grey-500">{fmtDate(p.date)}</p>
                </div>
                {p.reference && (
                  <p className="text-xs text-nate-grey-500 font-mono">
                    {p.reference}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-nate-grey-500 mb-3">
        {title}
      </p>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span className="text-nate-grey-500">{k}</span>
      <span className="text-nate-grey-800 tabular-nums">{v}</span>
    </div>
  );
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
