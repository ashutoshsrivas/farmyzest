-- CreateEnum
CREATE TYPE "Segment" AS ENUM ('GARDEN', 'FARM', 'BOTH');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "quickNav" "Segment",
ADD COLUMN     "quickNavOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "segment" "Segment" NOT NULL DEFAULT 'BOTH';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specs" JSONB;
