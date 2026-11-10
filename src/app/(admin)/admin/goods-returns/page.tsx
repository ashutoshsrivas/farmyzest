import { redirect } from "next/navigation";

// Goods returns are now split by direction; default to the customer flow.
export default function GoodsReturnsIndex() {
  redirect("/admin/goods-returns/customer");
}
