"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { ConvertOptions } from "@/lib/workers/qt-engine.types";
import { DEFAULT_CONVERT_OPTIONS } from "@/lib/workers/qt-engine.types";

const SINGLETON_ID = "convert-settings";

const OPTION_KEYS = Object.keys(
  DEFAULT_CONVERT_OPTIONS,
) as (keyof ConvertOptions)[];

function mergeConvertSettingsRow(
  row: any,
): Required<ConvertOptions> {
  const result = { ...DEFAULT_CONVERT_OPTIONS } as any;
  if (row) {
    for (const key of Object.keys(row)) {
      if (key === "id") continue;
      result[key] = row[key];
    }
  }
  return result as Required<ConvertOptions>;
}

export function useConvertSettings(): Required<ConvertOptions> {
  const row = useLiveQuery(() => db.convertSettings.get(SINGLETON_ID), []);

  return useMemo(() => mergeConvertSettingsRow(row), [row]);
}

export async function getConvertSettings(): Promise<Required<ConvertOptions>> {
  const row = await db.convertSettings.get(SINGLETON_ID);
  return mergeConvertSettingsRow(row);
}

export async function updateConvertSettings(
  patch: Partial<ConvertOptions>,
): Promise<void> {
  const existing = await db.convertSettings.get(SINGLETON_ID);
  if (existing) {
    await db.convertSettings.update(SINGLETON_ID, patch);
  } else {
    await db.convertSettings.put({
      id: SINGLETON_ID,
      ...DEFAULT_CONVERT_OPTIONS,
      ...patch,
    } as any);
  }
}
