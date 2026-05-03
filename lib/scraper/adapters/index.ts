import type { SiteAdapter } from "../types";
import { STVAdapter } from "./STV";
import { UukanshuAdapter } from "./Uukanshu";
import { PiaotiaAdapter } from "./Piaotia";
import { CuocengAdapter } from "./Cuoceng";

const adapters: SiteAdapter[] = [
  STVAdapter,
  UukanshuAdapter,
  PiaotiaAdapter,
  CuocengAdapter,
];

/** Find the adapter that matches the given URL, or null. */
export function detectAdapter(url: string): SiteAdapter | null {
  return adapters.find((a) => a.urlPattern.test(url)) ?? null;
}

/** Get all registered adapters (for UI display). */
export function getAdapters(): SiteAdapter[] {
  return adapters;
}

export { STVAdapter, UukanshuAdapter, PiaotiaAdapter, CuocengAdapter };
