import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Package, ChevronRight, ShoppingBag } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  RETURNED: "bg-orange-100 text-orange-800",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const orders = await db.order.findMany({
    where: { userId: session.user.id },
    include: {
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      {/* Wrappers (bg, container, sidebar) live in (store)/account/layout.tsx. */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif text-nate-grey-800">My Orders</h1>
          <p className="text-nate-grey-500 mt-1 text-sm">
            {orders.length} {orders.length === 1 ? "order" : "orders"} placed
          </p>
        </div>
        <Link
          href="/account"
          className="text-sm text-nate-grey-500 hover:text-accent transition-colors"
        >
          ← Back to Account
        </Link>
      </div>

      {orders.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-nate-grey-100 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-nate-grey-400" />
            </div>
            <h2 className="text-lg font-serif text-nate-grey-700 mb-2">
              No orders yet
            </h2>
            <p className="text-sm text-nate-grey-400 mb-6">
              When you place an order, it will appear here.
            </p>
            <Link
              href="/shop"
              className="inline-block px-6 py-2.5 bg-nate-grey-800 text-white text-sm rounded-lg hover:bg-nate-grey-700 transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const orderNum = order.razorpayOrderId
                ? order.razorpayOrderId.slice(-8).toUpperCase()
                : order.id.slice(-8).toUpperCase();

              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* Order header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-nate-grey-100">
                    <div className="flex flex-wrap gap-6">
                      <div>
                        <p className="text-xs text-nate-grey-400 uppercase tracking-wide font-medium">
                          Order ID
                        </p>
                        <p className="text-sm font-medium text-nate-grey-800 mt-0.5">
                          #{orderNum}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-nate-grey-400 uppercase tracking-wide font-medium">
                          Date
                        </p>
                        <p className="text-sm text-nate-grey-600 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-nate-grey-400 uppercase tracking-wide font-medium">
                          Total
                        </p>
                        <p className="text-sm font-medium text-nate-grey-800 mt-0.5">
                          ₹{order.total.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-nate-grey-400 uppercase tracking-wide font-medium">
                          Payment
                        </p>
                        <p className="text-sm text-nate-grey-600 mt-0.5 capitalize">
                          {order.paymentMethod.toLowerCase().replace("_", " ")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          STATUS_COLORS[order.status] ?? "bg-nate-grey-100 text-nate-grey-600"
                        }`}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                      <Link
                        href={`/account/orders/${order.id}`}
                        className="flex items-center gap-1 text-sm font-medium text-nate-grey-700 hover:text-accent transition-colors"
                      >
                        View
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Order items preview */}
                  <div className="px-6 py-4">
                    <div className="flex items-center gap-3 overflow-x-auto">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="w-16 h-16 rounded-lg overflow-hidden bg-nate-grey-100 shrink-0 flex items-center justify-center"
                        >
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-nate-grey-300" />
                          )}
                        </div>
                      ))}
                      {order.items.length > 0 && (
                        <div className="text-xs text-nate-grey-400 shrink-0">
                          {order.items.length} {order.items.length === 1 ? "item" : "items"}
                        </div>
                      )}
                    </div>

                    {order.items.length === 0 && (
                      <p className="text-sm text-nate-grey-400">No items found</p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </>
  );
}