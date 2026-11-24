import { db } from "@/lib/db";
import { mergeHomeContent, type HomeContent } from "@/lib/home-content";

export const HOME_CONTENT_ID = "homepage";

/** Homepage content as edited in admin, with defaults for anything unsaved. */
export async function getHomeContent(): Promise<HomeContent> {
  try {
    const row = await db.storeSetting.findUnique({ where: { id: HOME_CONTENT_ID } });
    return mergeHomeContent(row?.data ?? {});
  } catch {
    return mergeHomeContent({});
  }
}
