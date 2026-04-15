import axios from "axios";

// In production the nginx reverse proxy forwards /api → backend:8000,
// so we don't need an absolute URL. In dev Vite's proxy does the same.
const client = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message: string =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(message));
  },
);

export default client;
