# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ Deployment rules live in `AGENTS.md` (imported above). **Never** run `npm run build` / `next build` on the EC2 server — it takes the live site down. Deploy only by pushing to `main` (CI/CD in `.github/workflows/deploy.yml`).

## What this is

**Farmyzest** (farmyzest.com) — the e-commerce + POS platform of **Nidhi Enterprises (Est. 1962)**, a gardening / agricultural / horticultural retailer (plants, seeds, manures, fertilisers, crop protection, spray pumps, pots, tools, garden machinery) with a **physical store + online storefront**. Design reference: ugaoo.com; palette is green & earthy (tokens in `src/app/globals.css`, company identity in `src/lib/company.ts`). This codebase was forked from an earlier fashion store, so stray fashion wording/variants (size/colour) may still surface — adapt them to garden products when found. It is one Next.js app serving four distinct surfaces from one Prisma/Postgres database, so online and in-store share stock, customers, orders, loyalty, and wallets.

## Commands

```bash
npm run dev            # dev server (localhost:3000, 4GB heap)
npm run lint           # eslint (flat config, eslint.config.mjs)
npm run build          # LOCAL ONLY — never on the server
npx prisma generate    # after any schema.prisma change (or the app 500s at runtime)
npm run db:migrate     # prisma migrate dev — create/apply a migration locally
npm run db:studio      # prisma studio
npm run db:seed        # tsx prisma/seed.ts
```

There is **no test suite**. One-off data/inventory jobs go in `scripts/` or `prisma/` and are run ad hoc with `tsx`. Invariant: `ProductVariant.sku == barcode` (what the POS scans). Migrations were squashed into a single baseline (`prisma/migrations/20261110000000_init`) when the project was forked — always add new changes with `npm run db:migrate`, never `db push`, so prod (`migrate deploy`) stays in sync.

## Stack

Next.js **16.2.6** App Router (`output: "standalone"`), React 19, TypeScript, Tailwind v4, Prisma 5 + PostgreSQL, NextAuth v5 (beta), Zustand (client cart/UI state), Zod + react-hook-form. `@/*` → `src/*`.

> ⚠️ This Next.js version has breaking changes vs. common training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing App Router / routing / config code, and heed deprecation notices (per `AGENTS.md`).

## Architecture

### Four surfaces, one app — route groups under `src/app/`

- **`(store)`** — public storefront: shop, product, cart, checkout, account, wishlist, returns. Customer-facing.
- **`(admin)/admin`** — back office: products, inventory, orders, purchases, suppliers, coupons, loyalty, resellers, salesmen, reports, settings, etc.
- **`(pos)/pos`** — in-store point of sale: barcode scan, billing, cash control, credit notes, wallet, salesman commission.
- **`(auth)/auth`** — login/register (password + passwordless email OTP).
- Plus standalone print/kiosk routes: `invoice/`, `receipt/`, `store-board/`, `design/`.

### Auth & authorization

- NextAuth config: `src/lib/auth.ts`. JWT sessions. Two providers: **Credentials** (bcrypt password) and **email OTP** (`src/lib/otp.ts`, consumed once in `authorize`).
- Roles (`enum Role`): `CUSTOMER`, `ADMIN`, `POS_STAFF`, `RESELLER`.
- **There is no `middleware.ts`.** Section access is gated in each route group's `layout.tsx` (`(admin)/admin/layout.tsx`, `(pos)/layout.tsx`), which re-checks the role **against the DB, not just the JWT**, so grants/revokes take effect on next navigation. Follow this pattern for new protected sections.

### Data layer

- Single Prisma client singleton: `src/lib/db.ts` (import `{ db }`). ~50 models in `prisma/schema.prisma` (1300+ lines) — the domain core: `Product`/`ProductVariant`/`ProductImage`, `Order`/`OrderItem`/`Shipment`, `Supplier`/`SupplierBill`, `Coupon`, `LoyaltyConfig`/`LoyaltyTransaction`, `Wallet`/`WalletTransaction`, `Exchange`, `CreditNote`, `GoodsReturn`, `PosSession`, `Salesman`, `Location`/`StockTransfer`.
- **Inventory:** stock is deducted only at fulfilment (Shipped/OFD/Delivered), idempotent via `Order.stockDeducted`. Logic in `src/lib/order-transition.ts` (server-only) and `order-status.ts`.

### Business logic lives in `src/lib/` (not in route handlers)

Route handlers under `src/app/api/**` stay thin and delegate to `src/lib/`. Key modules: `pricing.ts` / `discount.ts` / `last-piece.ts` / `tax-rules.ts` (money math), `salesman-earnings.ts` (commission), `invoice.ts`, `wallet.ts`, `quikshipx.ts` (courier), `payu.ts` (payments), `sns.ts` (SMS OTP), `email.ts` (SMTP), `whatsapp*.ts` / `interakt.ts`. When adding a feature, put the domain logic in a `lib/` module and call it from both the API route and any server component that needs it.

### External integrations

- **Payments:** PayU hosted checkout (`src/lib/payu.ts`, `api/payu/*`). Replaced Razorpay.
- **Delivery:** QuikShipX courier (`src/lib/quikshipx.ts`, `api/quikshipx/*`) — book shipment from order detail.
- **Messaging:** AWS SNS for SMS/OTP (`src/lib/sns.ts`); Hostinger SMTP for transactional email (`src/lib/email.ts`), sender `info@farmyzest.com`.
- **Storage/images:** S3 bucket from `S3_BUCKET_NAME` (default `farmyzest-images`, ap-south-1). Allowed image hosts are whitelisted in `next.config.ts` — add new hosts there or `<Image>` renders blank.

### Runtime config — two stores, know the difference

1. **`.env` files** — infra/secrets, injected into the process at launch. In prod the standalone server (`node server.js`) does **not** read `.env` at runtime, so `scripts/start-server.sh` sources `.env.production` + `.env.production.local` and injects them into pm2. Add new prod env vars to those on-box files (gitignored), not to `deploy.yml`.
2. **`data/*.json`** — runtime-mutable store written by the admin **Settings** page (store profile, GST, SMTP overrides, feature flags like COD / partial-payment). Read via `src/lib/store-settings.ts`. The `data/` dir is gitignored (contains keys) — never commit it.

## Deploy / server

- Prod: single Ubuntu EC2 box `32.237.50.32`, user `ubuntu`, key `farmyzest-key.pem` in the repo root (gitignored). GitHub secrets `EC2_HOST` / `EC2_USER` / `EC2_SSH_KEY`; repo variable `PUBLIC_BASE_URL` sets `NEXT_PUBLIC_BASE_URL` at build. App lives in `/home/ubuntu/farmyzest` (env files there — migrations read `DATABASE_URL` from `.env.production`), prisma CLI in `/home/ubuntu/farmyzest-migrate`; runs under **pm2** as `farmyzest` on port 3000 behind **nginx** (port 80, `/etc/nginx/sites-available/farmyzest`); Postgres is local on the box. Launched by `scripts/start-server.sh`.
- Push to `main` → GitHub Actions builds the standalone bundle on the runner, SCPs it, runs `prisma migrate deploy` on the box (DB is private to it), atomically swaps the runtime dir, relaunches via `scripts/start-server.sh`, and smoke-tests `/`.
- On the server you may only: `pm2 logs farmyzest`, `pm2 status`, `pm2 restart farmyzest` (after a CI deploy), `df -h`, `free -m`. See `AGENTS.md`.
- Repo receives pushes from multiple machines — **always `git fetch` + rebase `origin/main` before pushing.**
