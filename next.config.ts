import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles server.js + minimal node_modules so the CI runner
  // can build once and SCP just the artifact — no npm install on the EC2 server.
  output: "standalone",
  // Build output dir is overridable so the deploy can build to a staging dir
  // (NEXT_DIST_DIR=.next-build) and atomically swap it into ".next", instead of
  // building over the live ".next" the running app holds open (which caused the
  // recurring partial-`.next` type/manifest build errors). Runtime leaves the
  // env unset, so it serves from ".next" as usual.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "farmyzest-images.s3.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.us-east-1.amazonaws.com",
      },
      // Stock placeholder imagery (category/department tiles, hero fallbacks)
      // is served from Unsplash. Without this the <Image> optimiser rejects the
      // host and the tile renders blank/grey even though the URL is valid.
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
};

export default nextConfig;