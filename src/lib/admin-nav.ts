import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Tags,
  Award,
  Users,
  Settings,
  BarChart3,
  Truck,
  CreditCard,
  Receipt,
  Boxes,
  Layers,
  Mail,
  Barcode,
  ReceiptText,
  RefreshCw,
  UserRound,
  UserCog,
  LayoutTemplate,
  Navigation as NavIcon,
  LineChart,
  Ticket,
  Undo2,
  PackageX,
  Store,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";

// Canonical admin navigation. Shared between the admin dashboard sidebar and
// the POS side drawer so the two stay identical.
export interface AdminNavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

export const adminNavItems: AdminNavItem[] = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/products", icon: Package, label: "Products" },
  { href: "/admin/inventory", icon: Boxes, label: "Inventory" },
  { href: "/admin/orders", icon: ShoppingBag, label: "Orders" },
  { href: "/admin/customers", icon: UserRound, label: "Customers" },
  { href: "/admin/users", icon: UserCog, label: "Users & Access" },
  { href: "/admin/resellers", icon: Store, label: "Resellers" },
  { href: "/admin/exchanges/new", icon: RefreshCw, label: "Exchange" },
  { href: "/admin/goods-returns/customer", icon: Undo2, label: "Customer Return" },
  { href: "/admin/goods-returns/supplier", icon: PackageX, label: "Supplier Return" },
  { href: "/admin/collections", icon: Layers, label: "Collections" },
  { href: "/admin/landing", icon: LayoutTemplate, label: "Landing Page" },
  { href: "/admin/navigation", icon: NavIcon, label: "Navigation" },
  { href: "/admin/categories", icon: Tags, label: "Categories" },
  { href: "/admin/brands", icon: Award, label: "Brands" },
  { href: "/admin/salesmen", icon: Users, label: "Salesmen" },
  { href: "/admin/suppliers", icon: Truck, label: "Suppliers" },
  { href: "/admin/purchases", icon: ReceiptText, label: "Purchases" },
  { href: "/admin/register", icon: NotebookPen, label: "Daily Register" },
  { href: "/admin/loyalty", icon: CreditCard, label: "Loyalty" },
  { href: "/admin/coupons", icon: Ticket, label: "Coupons" },
  { href: "/admin/reports", icon: BarChart3, label: "Reports" },
  { href: "/admin/online-reports", icon: LineChart, label: "Online Reports" },
  { href: "/admin/taxes", icon: Receipt, label: "Taxes" },
  { href: "/admin/barcodes", icon: Barcode, label: "Barcodes" },
  { href: "/admin/contact", icon: Mail, label: "Messages" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];
