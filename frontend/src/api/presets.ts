import client from "./client";
import type { UploadOptions } from "./imports";
import type { ImportPreset } from "@/types";

// ── Conversion helpers ────────────────────────────────────────────────────────

/** Frontend UploadOptions → backend CSVProfile (description_columns as list) */
function toBackendProfile(opts: UploadOptions): Record<string, unknown> {
  return {
    ...opts,
    description_columns: opts.description_columns
      ? opts.description_columns
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : ["description"],
  };
}

/** Backend CSVProfile → frontend UploadOptions (description_columns as string) */
function toFrontendOpts(profile: Record<string, unknown>): UploadOptions {
  const cols = profile.description_columns;
  return {
    ...(profile as UploadOptions),
    description_columns: Array.isArray(cols)
      ? (cols as string[]).join(", ")
      : (cols as string) ?? "description",
  };
}

function normalise(raw: {
  id: number;
  name: string;
  profile: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}): ImportPreset & { profile: UploadOptions } {
  return { ...raw, profile: toFrontendOpts(raw.profile) };
}

// ── API ───────────────────────────────────────────────────────────────────────

export const presetsApi = {
  list: async (): Promise<(ImportPreset & { profile: UploadOptions })[]> => {
    const { data } = await client.get("/presets/");
    return (data as ReturnType<typeof normalise>[]).map(normalise);
  },

  create: async (
    name: string,
    opts: UploadOptions,
  ): Promise<ImportPreset & { profile: UploadOptions }> => {
    const { data } = await client.post("/presets/", {
      name,
      profile: toBackendProfile(opts),
    });
    return normalise(data);
  },

  update: async (
    id: number,
    name: string,
    opts: UploadOptions,
  ): Promise<ImportPreset & { profile: UploadOptions }> => {
    const { data } = await client.put(`/presets/${id}`, {
      name,
      profile: toBackendProfile(opts),
    });
    return normalise(data);
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/presets/${id}`);
  },
};
