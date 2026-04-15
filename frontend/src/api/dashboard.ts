import client from "./client";
import type { DashboardResponse } from "@/types";

export const dashboardApi = {
  get: async (year?: number, month?: number): Promise<DashboardResponse> => {
    const { data } = await client.get<DashboardResponse>("/dashboard/", {
      params: {
        ...(year ? { year } : {}),
        ...(month ? { month } : {}),
      },
    });
    return data;
  },
};
