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
  row: Awaited<ReturnType<typeof db.convertSettings.get>>,
): Required<ConvertOptions> {
  if (!row) return DEFAULT_CONVERT_OPTIONS;
  const result = {} as Record<string, unknown>;
  for (const key of OPTION_KEYS) {
    result[key] =
      row[key as keyof typeof row] ?? DEFAULT_CONVERT_OPTIONS[key];
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
    });
  }
}
