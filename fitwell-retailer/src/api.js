const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "The request could not be completed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function signIn(email, password) {
  return request("/retailer/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getCatalog(token) {
  return request("/retailer/catalog", { token });
}

export function getOrders(token) {
  return request("/retailer/orders", { token });
}

export function submitOrder(token, order) {
  return request("/retailer/orders", {
    method: "POST",
    token,
    body: JSON.stringify(order),
  });
}
