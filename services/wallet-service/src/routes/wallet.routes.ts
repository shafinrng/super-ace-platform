import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getBalance, placeBet, creditWin, getTransactions } from "../controllers/wallet.controller";
const router = Router();
router.get("/balance", authenticate, getBalance);
router.post("/bet", authenticate, placeBet);
router.post("/win", authenticate, creditWin);
router.get("/transactions", authenticate, getTransactions);
export default router;