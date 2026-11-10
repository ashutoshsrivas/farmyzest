# Farmyzest — by Nidhi Enterprises (Est. 1962)

Online + in-store platform for **Nidhi Enterprises**, a one-stop shop for gardening,
agricultural and horticultural products. Storefront brand: **Farmyzest**
(<https://farmyzest.com>). Design reference: ugaoo.com.

## Catalogue

| Department | Covers |
|---|---|
| Plants | indoor, outdoor, flowering, fruit, succulents |
| Seeds | vegetable, flower, herb, lawn, field crop |
| Pots & Planters | plastic, ceramic, terracotta, hanging, **pot stands** |
| Fertilizers & Manures | organic manures, vermicompost, fertilisers, growth promoters, potting mix |
| Crop Protection | pesticides, insecticides, fungicides, herbicides / weedicides |
| Spray Pumps | 1 L – 16 L sprayers, pressure pumps, battery sprayers |
| Garden Machinery | lawn mowers (manual / electric / engine), hedge trimmers, battery grass cutters, brush cutters, chainsaws |
| Garden Tools | complete range of manual tools, pruners, digging, watering |

The taxonomy is seeded by `prisma/seed.ts` and editable in **Admin → Categories**.

## Brand & theme

- Palette: green & earthy. Tokens live in `src/app/globals.css` (`@theme`):
  `black` = deep forest green `#1F3B2B`, grey ramp = warm soil/sand,
  `accent` `#2F6B3A`, plus `leaf`, `moss`, `soil`, `terracotta`, `sand`.
- Company identity (legal name, address, phone, GSTIN, return text): `src/lib/company.ts`.
- Placeholder photography until real banners are uploaded: `src/lib/placeholder-images.ts`.

## Getting started

```bash
npm install
# create .env with DATABASE_URL, AUTH_SECRET, AUTH_TRUST_HOST, NEXTAUTH_URL, NEXT_PUBLIC_BASE_URL
npx prisma migrate dev      # creates the schema in your local Postgres
npm run db:seed             # categories, collections, tax slabs, admin user
npm run dev                 # http://localhost:3000
```

Seeded admin: `admin@farmyzest.com` / `admin123` — **change it immediately** on any shared DB.

See `CLAUDE.md` / `AGENTS.md` for architecture and deployment rules.
