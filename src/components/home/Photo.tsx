"use client";

import Image, { type ImageLoaderProps, type ImageProps } from "next/image";

// Unsplash serves resized, re-encoded images from its own CDN, so those photos
// skip our server's optimiser (slow on the small EC2 box, and its cache is
// wiped on every deploy). Everything else — admin uploads on S3, /public —
// still goes through next/image as usual.
const UNSPLASH = "https://images.unsplash.com/";

function unsplashLoader({ src, width, quality }: ImageLoaderProps) {
  const url = new URL(src);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 70));
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "crop");
  return url.toString();
}

export function Photo(props: ImageProps) {
  const fromUnsplash = typeof props.src === "string" && props.src.startsWith(UNSPLASH);
  // eslint-disable-next-line jsx-a11y/alt-text -- alt is passed through in props
  return <Image {...props} loader={fromUnsplash ? unsplashLoader : props.loader} />;
}
