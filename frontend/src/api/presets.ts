import client from "./client";
import type { UploadOptions } from "./imports";
import type { ImportPreset } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Preset with profile already converted to frontend UploadOptions */
export type ResolvedPreset = Omit<ImportPreset, "profile"> & { profile: UploadOptions };

/** Shape of an exported .flpreset.json file */
interface PresetFilePayload {
  finanzzwerg_preset: string;
  name: string;
  profile: Record<string, unknown>;
}

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

// ── Import / Export helpers ───────────────────────────────────────────────────

/** Trigger a browser download of the preset as a .flpreset.json file */
export function exportPreset(preset: ResolvedPreset): void {
  const payload: PresetFilePayload = {
    finanzzwerg_preset: "1.0",
    name: preset.name,
    profile: toBackendProfile(preset.profile),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${preset.name.replace(/[^a-z0-9_-]/gi, "_")}.flpreset.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Read a .flpreset.json file and return resolved name + UploadOptions */
export function parsePresetFile(file: File): Promise<{ name: string; profile: UploadOptions }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string) as PresetFilePayload;
        if (!json.finanzzwerg_preset || !json.name || typeof json.profile !== "object") {
          reject(new Error("invalid"));
          return;
        }
        resolve({ name: json.name, profile: toFrontendOpts(json.profile) });
      } catch {
        reject(new Error("invalid"));
      }
    };
    reader.onerror = () => reject(new Error("read_error"));
    reader.readAsText(file);
  });
}

type RawPreset = {
  id: number;
  name: string;
  profile: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

function normalise(raw: RawPreset): ResolvedPreset {
  return { ...raw, profile: toFrontendOpts(raw.profile) };
}

// ── API ───────────────────────────────────────────────────────────────────────

export const presetsApi = {
  list: async (): Promise<ResolvedPreset[]> => {
    const { data } = await client.get<RawPreset[]>("/presets/");
    return data.map(normalise);
  },

  create: async (name: string, opts: UploadOptions): Promise<ResolvedPreset> => {
    const { data } = await client.post<RawPreset>("/presets/", { name, profile: toBackendProfile(opts) });
    return normalise(data);
  },

  update: async (id: number, name: string, opts: UploadOptions): Promise<ResolvedPreset> => {
    const { data } = await client.put<RawPreset>(`/presets/${id}`, { name, profile: toBackendProfile(opts) });
    return normalise(data);
  },

  setDefault: async (id: number): Promise<ResolvedPreset> => {
    const { data } = await client.post<{
      id: number; name: string; profile: Record<string, unknown>; is_default: boolean; created_at: string; updated_at: string;
    }>(`/presets/${id}/set-default`);
    return normalise(data);
  },

  clearDefault: async (): Promise<void> => {
    await client.delete("/presets/default");
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/presets/${id}`);
  },
};
