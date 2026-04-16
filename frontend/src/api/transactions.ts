import client from "./client";
import type {
  BulkCategorize,
  Transaction,
  TransactionCategorize,
  TransactionFilters,
  TransactionListResponse,
} from "@/types";

export const transactionsApi = {
  list: async (filters: TransactionFilters = {}): Promise<TransactionListResponse> => {
    const { data } = await client.get<TransactionListResponse>("/transactions/", {
      params: filters,
    });
    return data;
  },

  inbox: async (filters: TransactionFilters = {}): Promise<TransactionListResponse> => {
    const { data } = await client.get<TransactionListResponse>("/transactions/inbox", {
      params: filters,
    });
    return data;
  },

  inboxCount: async (): Promise<number> => {
    const { data } = await client.get<{ count: number }>("/transactions/inbox/count");
    return data.count;
  },

  get: async (id: number): Promise<Transaction> => {
    const { data } = await client.get<Transaction>(`/transactions/${id}`);
    return data;
  },

  categorize: async (id: number, payload: TransactionCategorize): Promise<Transaction> => {
    const { data } = await client.post<Transaction>(
      `/transactions/${id}/categorize`,
      payload,
    );
    return data;
  },

  bulkCategorize: async (payload: BulkCategorize): Promise<{ updated: number }> => {
    const { data } = await client.post<{ updated: number }>(
      "/transactions/bulk-categorize",
      payload,
    );
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/transactions/${id}`);
  },
};
