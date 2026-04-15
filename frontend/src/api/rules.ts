import client from "./client";
import type { Rule, RuleCreate, RuleUpdate } from "@/types";

export const rulesApi = {
  list: async (activeOnly = false): Promise<Rule[]> => {
    const { data } = await client.get<Rule[]>("/rules/", {
      params: activeOnly ? { active_only: true } : {},
    });
    return data;
  },

  get: async (id: number): Promise<Rule> => {
    const { data } = await client.get<Rule>(`/rules/${id}`);
    return data;
  },

  create: async (payload: RuleCreate): Promise<Rule> => {
    const { data } = await client.post<Rule>("/rules/", payload);
    return data;
  },

  update: async (id: number, payload: RuleUpdate): Promise<Rule> => {
    const { data } = await client.patch<Rule>(`/rules/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/rules/${id}`);
  },

  applyAll: async (): Promise<{ categorized: number }> => {
    const { data } = await client.post<{ categorized: number }>("/rules/apply");
    return data;
  },
};
