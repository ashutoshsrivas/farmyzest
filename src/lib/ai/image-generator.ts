/**
 * NVIDIA Flux Image Generator
 * Uses Black Forest Labs Flux.2 Klein 4B via NVIDIA NIM API
 * Model: black-forest-labs/flux.2-klein-4b
 *
 * Setup:
 * 1. Get NVIDIA API key from https://build.nvidia.com/
 * 2. Set NVIDIA_API_KEY in .env
 *
 * Usage:
 * npx tsx prisma/generate-products-images.ts
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";

const prisma = new PrismaClient();
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY!;
const AWS_REGION = process.env.AWS_REGION || "ap-south-1";
const S3_BUCKET = process.env.S3_BUCKET_NAME || "farmyzest-images";

// AWS SDK v3
const s3 = new S3Client({ region: AWS_REGION });

function buildPrompt(
  name: string,
  category: string,
  color: string,
  season?: string
): string {
  const seasonPrefix = season === "SUMMER"
    ? "summer fashion, light breathable fabric, bright styling"
    : season === "WINTER"
    ? "winter fashion, cozy layered look, warm styling"
    : "versatile all-season fashion";

  return [
    `professional fashion product photography, ${color.toLowerCase()} ${name.toLowerCase()}`,
    `${seasonPrefix}, ${category.toLowerCase()} collection`,
    `studio white background, clean minimal lighting, shot on medium format camera`,
    `high fashion editorial, product only, no model, no mannequin, no text, no watermark`,
    `sharp focus, premium fabric texture visible, soft shadow`,
    `masterpiece, studio quality, ultra detailed`,
  ].join(", ");
}

async function generateImage(prompt: string): Promise<Buffer | null> {
  try {
    const res = await fetch(
      "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          prompt: prompt,
          width: 768,
          height: 1024,
          seed: Math.floor(Math.random() * 1000000),
          steps: 4,
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`  API ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }

    const data = (await res.json()) as { artifacts?: { base64: string }[] };
    const b64 = data.artifacts?.[0]?.base64;
    return b64 ? Buffer.from(b64, "base64") : null;
  } catch (err) {
    console.error("  Fetch error:", err);
    return null;
  }
}

async function uploadToS3(imageBuffer: Buffer, key: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: imageBuffer,
    ContentType: "image/jpeg",
    ACL: "public-read",
  });

  await s3.send(command);
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!NVIDIA_API_KEY) {
    console.error("❌ NVIDIA_API_KEY not set in .env");
    process.exit(1);
  }

  // Get all products that don't have a primary image yet
  const products = await prisma.product.findMany({
    where: {
      images: { none: { isPrimary: true } },
    },
    include: {
      category: true,
      variants: true,
    },
  });

  console.log(`\n🎨 Generating images for ${products.length} products...\n`);

  if (products.length === 0) {
    // Fall back to all products for demo
    const allProducts = await prisma.product.findMany({
      include: { category: true, variants: true, images: true },
    });
    console.log(`All products have images. Total: ${allProducts.length}`);
    await prisma.$disconnect();
    return;
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const variant = product.variants[0];
    const color = variant?.color || "neutral";
    const categoryName = product.category?.name || "clothing";

    const safeName = product.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const filename = `${safeName}-${Date.now()}.jpg`;
    const s3Key = `products/${filename}`;

    process.stdout.write(`[${i + 1}/${products.length}] ${product.name} (${color})... `);

    try {
      const prompt = buildPrompt(product.name, categoryName, color, product.season);
      const imageBuffer = await generateImage(prompt);

      if (imageBuffer) {
        const url = await uploadToS3(imageBuffer, s3Key);

        // Create product image record
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url,
            alt: product.name,
            sortOrder: 0,
            isPrimary: true,
          },
        });

        console.log("✓ uploaded");
        success++;
      } else {
        console.log("✗ generation failed");
        failed++;
      }

      // Respect rate limits (~2 req/s)
      await delay(600);
    } catch (err) {
      console.error(`✗ error: ${err}`);
      failed++;
    }
  }

  console.log(`\n✅ Done — ${success} generated, ${skipped} skipped, ${failed} failed`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});