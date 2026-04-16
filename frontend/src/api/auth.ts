import client from "./client";
import type { TokenResponse, User } from "@/types";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<TokenResponse> => {
    const { data } = await client.post<TokenResponse>("/auth/login", payload);
    return data;
  },

  register: async (payload: RegisterPayload): Promise<TokenResponse> => {
    const { data } = await client.post<TokenResponse>("/auth/register", payload);
    return data;
  },

  me: async (): Promise<User> => {
    const { data } = await client.get<User>("/auth/me");
    return data;
  },
};
