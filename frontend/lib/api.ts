import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const authApi = axios.create({ baseURL: API_BASE });
const walletApi = axios.create({ baseURL: API_BASE });
const gameApi = axios.create({ baseURL: API_BASE });

export const login = (email: string, password: string) =>
  authApi.post("/api/auth/login", { email, password });

export const register = (username: string, email: string, password: string) =>
  authApi.post("/api/auth/register", { username, email, password });

export const getBalance = (token: string) =>
  walletApi.get("/api/wallet/balance", { headers: { Authorization: Bearer  } });

export const createBet = (token: string, amount: number) =>
  walletApi.post("/api/wallet/bet", { amount }, { headers: { Authorization: Bearer  } });

export const recordWin = (token: string, amount: number, reference: string) =>
  walletApi.post("/api/wallet/win", { amount, reference }, { headers: { Authorization: Bearer  } });

export const createGameSession = (token: string, userId: string, betAmount: number, isFreeSpinMode: boolean = false) =>
  gameApi.post("/api/game/spin", { userId, betAmount, isFreeSpinMode }, { headers: { Authorization: Bearer  } });

export const spinSaga = (token: string, userId: string, betAmount: number, isFreeSpinMode: boolean = false) =>
  gameApi.post("/api/game/spin", { userId, betAmount, isFreeSpinMode }, { headers: { Authorization: Bearer  } });

export const getJackpots = () =>
  gameApi.get("/api/jackpot");
