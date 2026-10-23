const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const defaultApiUrl = import.meta.env.DEV ? "http://localhost:5000/api" : "";

export const API_BASE_URL = (configuredApiUrl || defaultApiUrl).replace(/\/+$/, "");

export function getApiUrl(path = "") {
  if (!API_BASE_URL) {
    throw new Error("The admin API URL is not configured. Set the VITE_API_URL repository variable to your deployed backend URL.");
  }

  return `${API_BASE_URL}${path}`;
}
