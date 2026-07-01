import axios from "axios";

const authApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });
const gameApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_GAME_URL });
const walletApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_WALLET_URL });

export const login = (email: string, password: string) =>
  authApi.post("/api/auth/login", { email, password });

export const register = (username: string, email: string, password: string) =>
  authApi.post("/api/auth/register", { username, email, password });

export const getBalance = (token: string) =>
  walletApi.get("/api/wallet/balance", { headers: { Authorization: `Bearer ${token}` } });

export const placeBet = (token: string, amount: number) =>
  walletApi.post("/api/wallet/bet", { amount }, { headers: { Authorization: `Bearer ${token}` } });

export const creditWin = (token: string, amount: number, reference: string) =>
  walletApi.post("/api/wallet/win", { amount, reference }, { headers: { Authorization: `Bearer ${token}` } });

export const spinGame = (token: string, betAmount: number, isFreeSpinMode: boolean, userId: string) =>
  gameApi.post("/api/game/spin", { userId, betAmount, isFreeSpinMode }, { headers: { Authorization: `Bearer ${token}` } });
