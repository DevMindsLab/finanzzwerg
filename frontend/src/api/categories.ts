import client from "./client";
import type { Category, CategoryCreate, CategoryUpdate } from "@/types";

export const categoriesApi = {
  list: async (): Promise<Category[]> => {
    const { data } = await client.get<Category[]>("/categories/");
    return data;
  },

  get: async (id: number): Promise<Category> => {
    const { data } = await client.get<Category>(`/categories/${id}`);
    return data;
  },

  create: async (payload: CategoryCreate): Promise<Category> => {
    const { data } = await client.post<Category>("/categories/", payload);
    return data;
  },

  update: async (id: number, payload: CategoryUpdate): Promise<Category> => {
    const { data } = await client.patch<Category>(`/categories/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/categories/${id}`);
  },
};
