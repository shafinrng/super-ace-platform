import axios from "axios";

const API_URL = "http://localhost:3006/api/admin";
const AUTH_URL = "http://localhost:3001/api/auth";
const WS_URL = "ws://localhost:3005";

let token = "";
if (typeof window !== "undefined") {
  token = localStorage.getItem("admin_token") || "";
}

const api = axios.create({
  baseURL: API_URL,
  headers: { Authorization: `Bearer ${token}` },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const login = async (email: string, password: string) => {
  const { data } = await axios.post(`${AUTH_URL}/login`, { email, password });
  token = data.token;
  if (typeof window !== "undefined") {
    localStorage.setItem("admin_token", token);
  }
  api.defaults.headers.Authorization = `Bearer ${token}`;
  return data;
};

export const getDashboard = () => api.get("/dashboard").then((r) => r.data);
export const getPlayers = (page = 1, search = "") => api.get(`/players?page=${page}&search=${search}`).then((r) => r.data);
export const togglePlayer = (id: string) => api.patch(`/players/${id}/toggle`).then((r) => r.data);
export const adjustBalance = (id: string, amount: number, reason: string) => api.patch(`/players/${id}/balance`, { amount, reason }).then((r) => r.data);
export const makeAdmin = (id: string) => api.patch(`/players/${id}/make-admin`).then((r) => r.data);
export const getTransactions = (page = 1) => api.get(`/transactions?page=${page}`).then((r) => r.data);
export const getPayments = (page = 1, status = "") => api.get(`/payments?page=${page}&status=${status}`).then((r) => r.data);
export const approveWithdrawal = (id: string) => api.patch(`/payments/${id}/approve`).then((r) => r.data);
export const getRtp = () => api.get("/rtp").then((r) => r.data);
export const setRtp = (target: number) => api.put("/rtp", { target }).then((r) => r.data);
export const resetRtp = () => api.post("/rtp/reset").then((r) => r.data);
export const getPlayerRtps = () => api.get("/rtp/players").then((r) => r.data);
export const setPlayerRtp = (id: string, rtp: number) => api.put(`/rtp/players/${id}`, { rtp }).then((r) => r.data);
export const deletePlayerRtp = (id: string) => api.delete(`/rtp/players/${id}`).then((r) => r.data);
export const getAlerts = () => api.get("/alerts").then((r) => r.data);
export const checkRtpAlert = () => api.get("/alerts/check").then((r) => r.data);
export const clearAlerts = () => api.post("/alerts/clear").then((r) => r.data);

export const createWebSocket = (onMessage: (data: any) => void) => {
  if (typeof window === "undefined") return null;
  const ws = new WebSocket(`${WS_URL}?userId=admin_panel`);
  ws.onopen = () => console.log("✅ Admin WS connected");
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("📨 WS message:", data.type);
      onMessage(data);
    } catch (e) {
      console.error("WS parse error:", e);
    }
  };
  ws.onerror = (err) => console.error("❌ WS error:", err);
  ws.onclose = () => console.log("🔌 Admin WS disconnected");
  return ws;
};

export const isAuthenticated = () => typeof window !== "undefined" && !!localStorage.getItem("admin_token");
export const logout = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("admin_token");
    token = "";
    window.location.href = "/login";
  }
};
