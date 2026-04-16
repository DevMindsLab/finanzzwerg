import client from "./client";
import type { Budget, BudgetCreate, BudgetUpdate } from "@/types";

export const budgetsApi = {
  list: async (year?: number, month?: number): Promise<Budget[]> => {
    const params = new URLSearchParams();
    if (year)  params.set("year",  String(year));
    if (month) params.set("month", String(month));
    const { data } = await client.get<Budget[]>(`/budgets/?${params}`);
    return data;
  },

  create: async (payload: BudgetCreate): Promise<Budget> => {
    const { data } = await client.post<Budget>("/budgets/", payload);
    return data;
  },

  update: async (id: number, payload: BudgetUpdate): Promise<Budget> => {
    const { data } = await client.put<Budget>(`/budgets/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/budgets/${id}`);
  },
};
