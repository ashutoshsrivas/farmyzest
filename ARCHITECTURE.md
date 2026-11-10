# Farmyzest — System Architecture
## ERP + POS + Online Store (Unified Platform)

> One database, three interfaces: Admin Panel, POS Billing Screen, Customer-facing Online Store.

---

## Stack Decisions

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Server Actions, API Routes, SSR/SSG for SEO |
| Language | **TypeScript** | Full-stack type safety |
| Database | **AWS RDS PostgreSQL 16** | Single source of truth for POS + online + inventory |
| ORM | **Prisma** | Migrations, type-safe queries |
| Object Storage | **AWS S3** | Product images, receipt PDFs, barcode label exports |
| CDN | **AWS S3** | Product images served directly from S3 via public bucket URLs; `next/image` loader uses S3 domain |
| Email | **AWS SES** | Transactional emails (order confirm, shipping, supplier alerts) |
| WhatsApp | **Interakt** (WhatsApp Business API) | Order updates, invoice sharing, customer reminders |
| Payments | **Razorpay** | Online checkout + POS card/UPI via gateway |
| Auth | **NextAuth.js v5** | Staff login (admin/POS), customer login (online store) |
| Styling | **Tailwind CSS** | Nate Grey (#C4B99F) + White theme throughout |
| State | **Zustand** | Cart, POS cart, UI state |
| Deployment | **EC2 t3.small** (dev) → **EC2 t3.large + ALB** (prod) + GitHub Actions CI/CD |

---

## AWS Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS (ap-south-1 / Mumbai)                 │
│                                                             │
│  ┌────────────────┐       ┌──────────────┐                  │
│  │   AWS S3       │──────▶│   Browser    │                  │
│  │   (images/PDF) │       │   (direct)   │                  │
│  └────────────────┘       └──────────────┘                  │
│         │                                                     │
│  ┌──────▼───────────────────────────────────────────────┐   │
│  │               Next.js App (EC2 + ALB)                │   │
│  │                                                       │   │
│  │   Admin (/admin)  ·  POS (/pos)  ·  Store (/shop)    │   │
│  │   App Router  ·  API Routes  ·  Server Actions      │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │            AWS RDS PostgreSQL 16                     │   │
│  │   (Single DB — POS, Online Store, Admin all share)  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  AWS SES  ·  AWS Secrets Manager  ·  CloudWatch             │
└─────────────────────────────────────────────────────────────┘
```

---

## Three Interfaces

### 1. Admin Panel (`/admin`)
Internal tool for staff/owners. Sidebar navigation with icon shortcuts.
Accessible only to `admin` role users.

| Module | Description |
|---|---|
| **Dashboard** | Revenue today/week/month, stock value, top products, daily sales chart |
| **Products** | Add/edit/delete products with images, variants, pricing (MRP, sale price, selling price, online price), barcode generation (single + bulk), season tags (Summer/Winter), tax slab assignment |
| **Inventory** | Stock levels per variant, low-stock alerts, bulk stock update, stock history log |
| **Categories** | Nested categories (parent → child), sort order |
| **Collections** | Summer/Winter/Seasonal collections — admin decides what ranks higher on website homepage |
| **Barcode Generator** | Generate CODE128 barcodes per product or bulk. Print-ready labels (PDF export) |
| **POS Users** | Manage staff accounts (name, phone, role). Set commission rate per salesman |
| **Tax Slabs** | Add/edit tax slabs (e.g., 5%, 18%). Assignable per product |
| **Suppliers** | Supplier profiles, add stock received from supplier, generate supplier bills, track payable balance |
| **Reports** | Daily register, profit & loss (pre-GST and post-GST), stock inventory, revenue by category, salesman commission report, cash vs gateway breakdown |
| **Orders** | All orders (POS + online), update status, print invoice, handle returns |
| **Loyalty** | Configure: points per ₹100 spent, points-to-rupee conversion, minimum redeem amount |
| **Settings** | Store name, logo, GST number, address, WhatsApp Interakt config |

### 2. POS Screen (`/pos`)
Billing screen for the showroom counter. Opened in a dedicated browser tab.
Staff selects their name from a dropdown at the top, then scans barcodes to build the cart.

| Feature | Description |
|---|---|
| **Salesman Selector** | Dropdown at top — selecting name tracks commission on all bills |
| **Barcode Scanner** | Physical USB scanner reads CODE128 → auto-adds product to cart (no Enter key needed, works like a keyboard) |
| **Cart** | Scanned items listed with name, qty, price, total. Edit qty, remove item inline |
| **Cash Items** | Quick-add items not in catalog — type name, enter price, add to bill |
| **Tax Auto-Calculate** | Tax applied per item based on product's assigned slab (5% or 18%) |
| **Subtotal / Tax / Total** | Running totals shown live |
| **Payment Methods** | Cash (POS machine used separately) / Gateway (Razorpay — card, UPI, wallets) |
| **Complete Sale** | Deducts stock from DB (online + POS share inventory), records salesman, creates order |
| **Print Receipt** | Browser print dialog — prints formatted receipt (thermal or A4) |
| **Hold Bill** | Save a cart to retrieve later without completing |
| **Clear Cart** | Reset for next customer |
| **Search** | Manual product search if barcode doesn't exist or scanner fails |

### 3. Online Store (`/`)
Customer-facing website. Same product database as POS and admin.

| Page | Description |
|---|---|
| **Homepage** | Hero banner, Summer/Winter/Seasonal collection at top (admin-controlled ranking), New Arrivals, Best Sellers |
| **Product Listing** | Category filter, season filter (Summer/Winter), sort (price, newest, popular) |
| **Product Detail** | Image gallery, size/color variants, online price shown, add to cart, related products |
| **Cart & Checkout** | Cart drawer, multi-step checkout, Razorpay (UPI/Card/NetBanking/Wallet/COD) |
| **Account** | Login/register, order history, saved addresses, loyalty points balance |
| **Order Status** | Real-time status updates, WhatsApp notification on dispatch |

---

## Database Schema

### Core Entities

```prisma
// Users — staff (admin/POS) and customers
User {
  id           String   @id @default(cuid())
  email        String   @unique
  password     String   // bcrypt hashed
  name         String
  phone        String?
  role         Role     @default(CUSTOMER)  // CUSTOMER | ADMIN | POS_STAFF
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

// Role enum
Role { CUSTOMER ADMIN POS_STAFF }
```

```prisma
// Salesmen (POS users) — separate from User for commission tracking
Salesman {
  id             String   @id @default(cuid())
  name           String
  phone          String?
  email          String?
  commissionRate Float    @default(0)  // percentage, e.g. 2.5 = 2.5%
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
}
```

```prisma
// Tax slabs — admin configurable
TaxSlab {
  id          String   @id @default(cuid())
  name        String   // e.g. "5%", "18%"
  percentage  Float    // 5.0, 18.0
  isActive    Boolean  @default(true)
  products    Product[]
}
```

```prisma
// Categories — nested (parent → child)
Category {
  id         String     @id @default(cuid())
  name       String
  slug       String     @unique
  parentId   String?    // self-reference for nesting
  parent     Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children   Category[] @relation("CategoryTree")
  imageUrl   String?
  sortOrder  Int        @default(0)
  products   Product[]
}
```

```prisma
// Collections (Summer, Winter, Seasonal) — admin controls homepage ranking
Collection {
  id         String          @id @default(cuid())
  name       String
  slug       String          @unique
  type       CollectionType  // SUMMER | WINTER | SEASONAL | CUSTOM
  isActive   Boolean         @default(true)
  rankOnHome Boolean         @default(false)  // show at top of homepage
  bannerUrl  String?
  products   CollectionProduct[]
}

CollectionType { SUMMER WINTER SEASONAL CUSTOM }
```

```prisma
// Products
Product {
  id              String              @id @default(cuid())
  name            String
  slug            String             @unique
  description     String?
  categoryId      String
  category        Category           @relation(fields: [categoryId], references: [id])

  // Pricing
  mrp             Float              // Maximum Retail Price (printed on barcode)
  salePrice       Float?             // Special sale price
  sellingPrice    Float?             // Internal selling price (used for profit calc)
  onlinePrice     Float?             // Price shown on website

  // Tax
  taxSlabId       String?
  taxSlab         TaxSlab?           @relation(fields: [taxSlabId], references: [id])

  // Metadata
  brand           String?
  tags            String[]           // season tags, internal search tags (hidden from customers)
  season          Season?            // SUMMER | WINTER | ALL
  status          ProductStatus      @default(DRAFT)  // DRAFT | ACTIVE | ARCHIVED

  // SEO
  metaTitle       String?
  metaDescription String?

  // Relations
  images          ProductImage[]
  variants        ProductVariant[]
  reviews         Review[]
  collections     CollectionProduct[]

  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
}

ProductStatus { DRAFT ACTIVE ARCHIVED }
Season { SUMMER WINTER ALL }
```

```prisma
// Product images
ProductImage {
  id         String   @id @default(cuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  url        String   // S3 URL, served directly from S3
  alt        String?
  sortOrder  Int      @default(0)
  isPrimary  Boolean  @default(false)
}
```

```prisma
// Product variants (size × color matrix)
ProductVariant {
  id           String   @id @default(cuid())
  productId    String
  product      Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  sku          String   @unique  // internal stock-keeping unit
  barcode      String   @unique  // CODE128 barcode value — scanned at POS

  size         String?  // S, M, L, XL, 28, 30, etc.
  color        String?  // Blue, Red, etc.
  colorHex     String?  // #FF0000

  priceOverride Float?  // override product-level price for this variant
  comparePrice  Float?  // strikethrough price for display

  stock        Int      @default(0)
  lowStockThreshold Int @default(5)

  images       ProductImage[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

```prisma
// Collection ↔ Product junction (for collections/Summer/Winter pages)
CollectionProduct {
  id           String    @id @default(cuid())
  collectionId String
  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  productId    String
  product      Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  sortOrder    Int       @default(0)

  @@unique([collectionId, productId])
}
```

```prisma
// Customer reviews
Review {
  id          String      @id @default(cuid())
  productId   String
  product     Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  userId      String
  orderId     String?
  rating      Int         // 1-5
  title       String?
  body        String?
  photos      String[]    // S3 URLs
  helpfulVotes Int        @default(0)
  status      ReviewStatus @default(PENDING)  // PENDING | APPROVED | REJECTED
  createdAt   DateTime    @default(now())
}

ReviewStatus { PENDING APPROVED REJECTED }
```

---

### POS & Orders

```prisma
// Orders — shared between POS and online store
Order {
  id           String      @id @default(cuid())

  // Who bought it
  userId       String?
  user         User?       @relation(fields: [userId], references: [id])

  // POS context (null for online orders)
  salesmanId   String?     // who sold it (null for online)
  source       OrderSource @default(ONLINE)  // ONLINE | POS
  posOrderNum  String?     // POS-local order number (e.g. "SS-00042")

  // Status & Payment
  status       OrderStatus @default(PENDING)
  paymentMethod PaymentMethod
  paymentStatus PaymentStatus @default(PENDING)

  // Razorpay
  razorpayOrderId   String?
  razorpayPaymentId String?

  // Money
  subtotal     Float
  taxAmount    Float
  discount     Float      @default(0)
  total        Float

  // Billing address (snapshot)
  billingName    String?
  billingPhone   String?
  billingAddress String?
  billingCity    String?
  billingState   String?
  billingPincode String?

  // Shipping address (snapshot)
  shippingName    String?
  shippingPhone   String?
  shippingAddress String?
  shippingCity    String?
  shippingState   String?
  shippingPincode String?

  notes         String?
  couponId      String?

  items        OrderItem[]

  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

OrderSource { ONLINE POS }
OrderStatus { PENDING PROCESSING SHIPPED OUT_FOR_DELIVERY DELIVERED CANCELLED RETURNED }
PaymentMethod { CASH GATEWAY ONLINE COD }
PaymentStatus { PENDING PAID FAILED REFUNDED PARTIAL_REFUND }
```

```prisma
// Order items — captures product snapshot at time of sale
OrderItem {
  id           String  @id @default(cuid())
  orderId      String
  order        Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)

  productId    String
  variantId    String?

  // Snapshot of product at time of purchase
  productName  String
  variantLabel  String?  // "Blue / M"
  sku          String?
  barcode      String?
  imageUrl     String?

  quantity     Int
  unitPrice    Float    // price per unit at time of sale
  taxPercent   Float?   // tax slab applied
  totalPrice   Float    // quantity × unitPrice + tax
}
```

```prisma
// Shipments
Shipment {
  id            String      @id @default(cuid())
  orderId       String
  courier       String?
  trackingNumber String?
  trackingUrl   String?
  status        ShipmentStatus @default(PENDING)
  shippedAt    DateTime?
  deliveredAt  DateTime?
  createdAt    DateTime @default(now())
}

ShipmentStatus { PENDING SHIPPED OUT_FOR_DELIVERY DELIVERED RETURNED }
```

```prisma
// Returns
Return {
  id            String        @id @default(cuid())
  orderId       String
  order         Order         @relation(fields: [orderId], references: [id])
  userId        String
  reason        String
  status        ReturnStatus  @default(REQUESTED)
  refundAmount  Float
  refundStatus  RefundStatus  @default(PENDING)
  notes         String?
  createdAt     DateTime      @default(now())
}

ReturnStatus { REQUESTED APPROVED REJECTED RECEIVED }
RefundStatus { PENDING PROCESSING COMPLETED FAILED }
```

---

### Suppliers & Stock

```prisma
// Suppliers
Supplier {
  id          String   @id @default(cuid())
  name        String
  phone       String?
  email       String?
  address     String?
  gstin       String?  // GST registration number
  balance     Float    @default(0)  // amount owed to supplier
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  bills       SupplierBill[]
}
```

```prisma
// Supplier bills — tracks what you owe each supplier
SupplierBill {
  id         String         @id @default(cuid())
  supplierId String
  supplier   Supplier       @relation(fields: [supplierId], references: [id])

  billNumber String         @unique  // e.g. "SUP-2025-001"
  date       DateTime       @default(now())

  subtotal   Float
  taxAmount  Float
  total      Float

  status     SupplierBillStatus @default(PENDING)  // PENDING | PARTIAL | PAID

  items      SupplierBillItem[]
  payments   SupplierPayment[]

  createdAt  DateTime @default(now())
}

SupplierBillStatus { PENDING PARTIAL PAID }
```

```prisma
// Supplier bill line items
SupplierBillItem {
  id           String       @id @default(cuid())
  billId       String
  bill         SupplierBill @relation(fields: [billId], references: [id], onDelete: Cascade)

  productId    String?
  variantId    String?

  description  String   // e.g. "Blue T-Shirt, Size M"
  quantity     Int
  rate         Float    // purchase rate per unit
  amount       Float    // quantity × rate
}
```

```prisma
// Supplier payments (when you pay the supplier)
SupplierPayment {
  id         String       @id @default(cuid())
  billId     String
  bill       SupplierBill @relation(fields: [billId], references: [id])
  amount     Float
  method     String       // CASH | UPI | BANK_TRANSFER
  reference  String?
  date       DateTime     @default(now())
}
```

---

### Stock Transfer

```prisma
// Stock locations (showroom, warehouse)
Location {
  id        String  @id @default(cuid())
  name      String  // "Showroom", "Warehouse A"
  type      LocationType @default(SHOWROOM)  // SHOWROOM | WAREHOUSE
  isActive  Boolean @default(true)
  transfersFrom StockTransfer[] @relation("TransferFrom")
  transfersTo   StockTransfer[] @relation("TransferTo")
}

LocationType { SHOWROOM WAREHOUSE }
```

```prisma
// Stock transfers between locations
StockTransfer {
  id           String   @id @default(cuid())
  transferNumber String @unique

  fromLocationId String
  fromLocation   Location @relation("TransferFrom", fields: [fromLocationId], references: [id])
  toLocationId   String
  toLocation     Location @relation("TransferTo", fields: [toLocationId], references: [id])

  status       TransferStatus @default(PENDING)
  notes        String?
  createdAt    DateTime @default(now())
  completedAt  DateTime?

  items        StockTransferItem[]
}

TransferStatus { PENDING IN_TRANSIT COMPLETED CANCELLED }
```

```prisma
// Stock transfer line items
StockTransferItem {
  id             String        @id @default(cuid())
  transferId     String
  transfer       StockTransfer @relation(fields: [transferId], references: [id], onDelete: Cascade)
  variantId      String
  quantity       Int
  quantitySent   Int?
  quantityReceived Int?
}
```

---

### Loyalty & Cart

```prisma
// Loyalty system config (admin settings)
LoyaltyConfig {
  id                   String  @id @default(cuid())
  pointsPer100Rupees   Float   @default(1)  // 1 point per ₹100 spent
  rupeeValuePerPoint    Float   @default(0.25)  // 1 point = ₹0.25
  minRedeemAmount      Float   @default(100)  // min ₹100 to redeem points
  isActive             Boolean @default(true)
}
```

```prisma
// Loyalty points per customer
UserLoyalty {
  id            String @id @default(cuid())
  userId        String @unique
  pointsBalance Float  @default(0)
  updatedAt     DateTime @updatedAt
}
```

```prisma
// Loyalty transactions (earn/redeem)
LoyaltyTransaction {
  id          String    @id @default(cuid())
  userId      String
  orderId     String?
  type        LoyaltyType  // EARN | REDEEM
  points      Float
  description String
  createdAt   DateTime  @default(now())
}

LoyaltyType { EARN REDEEM }
```

```prisma
// Wishlist
Wishlist {
  id        String   @id @default(cuid())
  userId    String
  variantId String?
  createdAt DateTime @default(now())

  @@unique([userId, variantId])
}
```

```prisma
// Coupons
Coupon {
  id             String    @id @default(cuid())
  code           String    @unique
  type           CouponType // PERCENT | FLAT | FREE_SHIPPING
  value          Float
  minCartValue   Float     @default(0)
  maxDiscount    Float?
  usageLimit     Int?
  perUserLimit   Int?
  timesUsed      Int       @default(0)
  validFrom      DateTime?
  validUntil     DateTime?
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
}

CouponType { PERCENT FLAT FREE_SHIPPING }
```

```prisma
// Customer addresses
Address {
  id        String  @id @default(cuid())
  userId    String
  name      String
  phone     String
  line1     String
  line2     String?
  city      String
  state     String
  pincode   String
  isDefault Boolean @default(false)
  createdAt DateTime @default(now())
}
```

```prisma
// Newsletters
Newsletter {
  id       String   @id @default(cuid())
  email    String   @unique
  isActive Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

---

## POS Session & Commission

```prisma
// POS session — tracks a salesman's shift
PosSession {
  id          String   @id @default(cuid())
  salesmanId  String
  date        DateTime @default(now())
  startTime   DateTime @default(now())
  endTime     DateTime?

  totalSales  Float   @default(0)  // total revenue
  totalCash   Float   @default(0)  // cash collected
  totalGateway Float  @default(0)  // gateway collected
  orderCount  Int     @default(0)
}
```

---

## API Routes

### Auth
```
POST   /api/auth/[...nextauth]         # NextAuth handler (customer + staff login)
POST   /api/auth/register               # Customer registration
POST   /api/auth/forgot-password        # Send reset email via SES
```

### Public / Online Store
```
GET    /api/products                   # list with filters (category, season, price, search)
GET    /api/products/[slug]            # product detail
POST   /api/cart                       # add item
PUT    /api/cart                       # update qty
DELETE /api/cart                       # remove item
GET    /api/cart                       # get cart
POST   /api/orders                     # create order (online)
POST   /api/payments/create            # Razorpay order creation
POST   /api/payments/verify            # verify payment + finalize order
POST   /api/reviews                    # submit review
GET    /api/collections                # list collections for homepage
```

### POS (accessed from /pos page, authenticated via session)
```
POST   /api/pos/barcode                # lookup product by barcode → add to cart
POST   /api/pos/cash-item              # add quick cash item
POST   /api/pos/complete               # complete sale → create order, deduct stock
GET    /api/pos/search                 # manual product search in POS
POST   /api/pos/hold                   # hold cart
GET    /api/pos/hold/[id]              # retrieve held cart
GET    /api/pos/salesmen               # list active salesmen for dropdown
```

### Admin
```
# Products
GET    /api/admin/products
POST   /api/admin/products
PUT    /api/admin/products/[id]
DELETE /api/admin/products/[id]
POST   /api/admin/products/[id]/barcode    # generate barcode for variant
POST   /api/admin/products/bulk-barcode     # bulk generate barcodes
POST   /api/admin/products/bulk-import      # CSV import

# Inventory
GET    /api/admin/inventory
PUT    /api/admin/inventory/bulk-update

# Categories & Collections
GET    /api/admin/categories
POST   /api/admin/categories
PUT    /api/admin/categories/[id]
GET    /api/admin/collections
POST   /api/admin/collections
PUT    /api/admin/collections/[id]
PUT    /api/admin/collections/rank-homepage  # reorder homepage collections

# Salesmen & Commission
GET    /api/admin/salesmen
POST   /api/admin/salesmen
PUT    /api/admin/salesmen/[id]
GET    /api/admin/commissions              # commission report

# Tax Slabs
GET    /api/admin/tax-slabs
POST   /api/admin/tax-slabs
PUT    /api/admin/tax-slabs/[id]

# Suppliers
GET    /api/admin/suppliers
POST   /api/admin/suppliers
PUT    /api/admin/suppliers/[id]
GET    /api/admin/suppliers/[id]/bills
POST   /api/admin/suppliers/[id]/bills      # create supplier bill
PUT    /api/admin/supplier-bills/[id]       # update/add items to bill
POST   /api/admin/supplier-bills/[id]/pay    # record payment to supplier

# Orders
GET    /api/admin/orders
PUT    /api/admin/orders/[id]/status
POST   /api/admin/orders/[id]/ship          # add shipment/tracking
GET    /api/admin/orders/[id]/invoice       # generate invoice PDF

# Reports
GET    /api/admin/reports/daily             # daily register
GET    /api/admin/reports/profit            # P&L report
GET    /api/admin/reports/inventory         # stock inventory
GET    /api/admin/reports/stock-value        # total stock value
GET    /api/admin/reports/cash-gateway       # cash vs gateway breakdown

# Loyalty
GET    /api/admin/loyalty-config
PUT    /api/admin/loyalty-config
GET    /api/admin/customers/[id]/loyalty    # customer loyalty detail

# Settings
PUT    /api/admin/settings

# Stock Transfer
GET    /api/admin/stock-transfers
POST   /api/admin/stock-transfers
PUT    /api/admin/stock-transfers/[id]

# Barcode PDF
GET    /api/admin/barcodes/[variantId]      # generate barcode label PDF
GET    /api/admin/barcodes/bulk             # bulk barcode PDF

# File Upload
POST   /api/upload/presign                  # S3 presigned URL
```

---

## Key Flows

### POS Barcode Scanning
```
Barcode scanner (USB) → types barcode + Enter
  → Hidden input captures keystrokes
  → On Enter: lookup barcode in variants table
  → If found: add to POS cart (instant, no modal)
  → If not found: show "Product not found — add as cash item?"
  → Complete sale → deduct stock → print receipt
```

### Receipt Printing
```
Sale complete → generate receipt data (order items, totals, salesman, date)
  → Browser window.print() with @media print CSS
  → Format: 80mm thermal width (CSS @page size)
  → For A4: separate print layout
  → No third-party PDF generation needed — CSS print is sufficient
```

### Stock Sync (POS + Online)
```
Every order (POS or online):
  → transaction: deduct stock from ProductVariant
  → same DB, same table — instant sync
  → no polling, no webhooks needed
  → if stock = 0 → product shows as "Out of Stock" on website
```

### Supplier Bill Flow
```
1. Admin creates supplier profile
2. Admin adds items received (quantity, purchase rate)
3. Admin generates supplier bill → bill created with line items
4. Stock automatically increases (items received into inventory)
5. Admin records payment to supplier → balance reduces
6. Reports show outstanding to each supplier
```

### Tax Calculation
```
Product has taxSlabId (e.g., 5%)
Cart item: (sellingPrice × quantity) → subtotal
Tax: subtotal × (taxSlab.percentage / 100)
Total: subtotal + tax

All prices shown to customer are inclusive of tax (MRP system).
Backend stores tax breakdown separately for reporting.
```

---

## Colour Theme

**Nate Grey + White** — sophisticated, minimal, premium feel.

| Token | Hex | Usage |
|---|---|---|
| `--nate-grey-100` | `#F7F6F3` | Page background |
| `--nate-grey-200` | `#EEEDE9` | Cards, panels |
| `--nate-grey-300` | `#D8D6CE` | Borders, dividers |
| `--nate-grey-400` | `#AEA99F` | Placeholder text |
| `--nate-grey-500` | `#8C8678` | Secondary text |
| `--nate-grey-600` | `#5E5A52` | Body text |
| `--nate-grey-700` | `#3D3A34` | Headings |
| `--nate-grey-800` | `#1F1E1B` | Dark accents |
| `--white` | `#FFFFFF` | Cards, modals, inputs |
| `--accent` | `#C4B99F` | Brand accent (buttons, highlights) |

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://farmyzest.com
NEXTAUTH_ADMIN_EMAIL=admin@farmyzest.com
NEXTAUTH_ADMIN_PASSWORD=

# AWS
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_PUBLIC=ss-product-images
S3_BUCKET_PRIVATE=ss-private
S3_DOMAIN=https://farmyzest-images.s3.ap-south-1.amazonaws.com

# Email (AWS SES)
SES_FROM_EMAIL=noreply@farmyzest.com
SES_FROM_NAME=Farmyzest

# WhatsApp (Interakt)
INTERAKT_API_KEY=
INTERAKT_WA_TEMPLATE_ID_ORDER_CONFIRM=
INTERAKT_WA_TEMPLATE_ID_SHIPPED=
INTERAKT_WA_TEMPLATE_ID_DELIVERED=

# Payments (Razorpay)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# App
NEXT_PUBLIC_APP_URL=https://farmyzest.com
NEXT_PUBLIC_S3_URL=https://farmyzest-images.s3.ap-south-1.amazonaws.com
```

---

## Build Phases

| Phase | Scope | Output |
|---|---|---|
| **0** | Repo setup, AWS infra, DB migrations, auth | Next.js scaffold with Prisma schema running on EC2 |
| **1** | Products + Inventory (admin) | Add/edit products, variants, stock, barcode generator |
| **2** | Collections + Summer/Winter tagging + homepage ranking | Admin controls what shows on website homepage |
| **3** | POS screen | Billing screen with barcode scan, cart, payment, receipt print |
| **4** | Online Store — core | Homepage, PLP, PDP, cart, customer login |
| **5** | Online Store — checkout | Razorpay checkout, COD, order confirmation email |
| **6** | Admin — POS Users, Salesmen, Commission | Salesman management, commission tracking in POS |
| **7** | Admin — Tax Slabs, Supplier Bills | Tax config, supplier management, payable tracking |
| **8** | Admin — Reports | Daily register, P&L, stock value, cash vs gateway |
| **9** | Admin — Loyalty | Points config, earn/redeem logic |
| **10** | Stock Transfers, Add-on Products | Warehouse/showroom transfer, complementary product suggestions |
| **11** | WhatsApp (Interakt) | Order update notifications, invoice sharing |
| **12** | Polish + Launch | SEO, performance, Interakt, SES full setup, staging → prod |