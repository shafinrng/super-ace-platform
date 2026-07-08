import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  initDB, setSelfExclusion, checkSelfExclusion, liftSelfExclusion,
  setDepositLimits, checkDepositLimit, recordDeposit,
  setLossLimits, checkLossLimit, recordLoss,
  setRealityCheck, checkRealityCheck,
  playerHealthCheck,
} from "./rg";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(limiter);

// ── Self Exclusion ──
app.post("/rg/self-exclude", async (req, res) => {
  try {
    const { userId, type, durationHours, reason } = req.body;
    if (!userId || !type || !["temporary", "permanent"].includes(type)) {
      return res.status(400).json({ error: "userId and type (temporary/permanent) required" });
    }
    const result = await setSelfExclusion(userId, type, durationHours, reason);
    res.json({ success: true, ...result });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.get("/rg/self-exclusion/:userId", async (req, res) => {
  try {
    const result = await checkSelfExclusion(req.params.userId);
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/rg/lift-exclusion", async (req, res) => {
  try {
    const { userId, liftedBy, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });
    const success = await liftSelfExclusion(userId, liftedBy);
    res.json({ success });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// ── Deposit Limits ──
app.post("/rg/deposit-limits", async (req, res) => {
  try {
    const { userId, daily, weekly, monthly } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    await setDepositLimits(userId, daily, weekly, monthly);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/rg/check-deposit", async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) return res.status(400).json({ error: "userId and amount required" });
    const result = await checkDepositLimit(userId, amount);
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/rg/record-deposit", async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) return res.status(400).json({ error: "userId and amount required" });
    await recordDeposit(userId, amount);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// ── Loss Limits ──
app.post("/rg/loss-limits", async (req, res) => {
  try {
    const { userId, dailyLoss, sessionLoss } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    await setLossLimits(userId, dailyLoss, sessionLoss);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/rg/check-loss", async (req, res) => {
  try {
    const { userId, lossAmount } = req.body;
    if (!userId || lossAmount === undefined) return res.status(400).json({ error: "userId and lossAmount required" });
    const result = await checkLossLimit(userId, lossAmount);
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/rg/record-loss", async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) return res.status(400).json({ error: "userId and amount required" });
    await recordLoss(userId, amount);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// ── Reality Checks ──
app.post("/rg/reality-check", async (req, res) => {
  try {
    const { userId, intervalMinutes, enabled } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    await setRealityCheck(userId, intervalMinutes || 60, enabled !== false);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.get("/rg/reality-check/:userId", async (req, res) => {
  try {
    const result = await checkRealityCheck(req.params.userId);
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// ── Full Health Check (called before bet/deposit) ──
app.post("/rg/health-check", async (req, res) => {
  try {
    const { userId, amount, type } = req.body;
    if (!userId || !amount || !type || !["bet", "deposit"].includes(type)) {
      return res.status(400).json({ error: "userId, amount, and type (bet/deposit) required" });
    }
    const result = await playerHealthCheck(userId, amount, type as "bet" | "deposit");
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// ── Health ──
app.get("/health", (_req, res) => res.json({ status: "ok", service: "responsible-gaming-service" }));

initDB().then(() => {
  const PORT = process.env.PORT || 3016;
  app.listen(PORT, () => console.log(`Responsible Gaming Service running on port ${PORT}`));
});