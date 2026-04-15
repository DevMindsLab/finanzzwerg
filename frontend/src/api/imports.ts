import client from "./client";
import type { ImportJob } from "@/types";

export interface UploadOptions {
  delimiter?: string;
  encoding?: string;
  skip_rows?: number;
  date_column?: string;
  date_format?: string;
  amount_column?: string;
  debit_column?: string;
  credit_column?: string;
  decimal_separator?: string;
  thousands_separator?: string;
  description_columns?: string;
  description_join?: string;
  negate_amount?: boolean;
}

export const importsApi = {
  list: async (): Promise<ImportJob[]> => {
    const { data } = await client.get<ImportJob[]>("/imports/");
    return data;
  },

  get: async (id: number): Promise<ImportJob> => {
    const { data } = await client.get<ImportJob>(`/imports/${id}`);
    return data;
  },

  upload: async (file: File, options: UploadOptions = {}): Promise<ImportJob> => {
    const form = new FormData();
    form.append("file", file);

    // Build query params from options
    const params = new URLSearchParams();
    Object.entries(options).forEach(([k, v]) => {
      if (v !== undefined && v !== "") {
        params.set(k, String(v));
      }
    });

    const { data } = await client.post<ImportJob>(
      `/imports/upload?${params.toString()}`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },
};
