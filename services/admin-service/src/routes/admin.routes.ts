import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { auditLog } from "../middleware/audit";
import {
  getDashboard, getPlayers, getPlayer, togglePlayerStatus,
  adjustBalance, getTransactions, getPayments, approveWithdrawal, makeAdmin,
  getRtpConfig, setRtpConfig, resetRtpStats,
  getPlayerRtps, getPlayerRtp, setPlayerRtp, deletePlayerRtp,
  getAlerts, checkRtpAlert, clearAlerts
} from "../controllers/admin.controller";

const router = Router();
router.use(authenticate, requireAdmin, auditLog);

router.get("/dashboard", getDashboard);
router.get("/players", getPlayers);
router.get("/players/:id", getPlayer);
router.patch("/players/:id/toggle", togglePlayerStatus);
router.patch("/players/:id/balance", adjustBalance);
router.patch("/players/:id/make-admin", makeAdmin);
router.get("/transactions", getTransactions);
router.get("/payments", getPayments);
router.patch("/payments/:id/approve", approveWithdrawal);
router.get("/rtp", getRtpConfig);
router.put("/rtp", setRtpConfig);
router.post("/rtp/reset", resetRtpStats);
router.get("/rtp/players", getPlayerRtps);
router.get("/rtp/players/:id", getPlayerRtp);
router.put("/rtp/players/:id", setPlayerRtp);
router.delete("/rtp/players/:id", deletePlayerRtp);
router.get("/alerts", getAlerts);
router.get("/alerts/check", checkRtpAlert);
router.post("/alerts/clear", clearAlerts);

export default router;
