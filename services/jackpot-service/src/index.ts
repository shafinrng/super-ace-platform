import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  initPools,
  getPoolValues,
  contribute,
  checkJackpotWin,
  setPoolValue,
  JackpotTier,
} from "./jackpot";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use(limiter);

// Initialize pools on startup
initPools().then(() => console.log("Jackpot pools initialized"));

// ── Get Current Pool Values ──
app.get("/jackpots", async (_req, res) => {
  try {
    const pools = await getPoolValues();
    res.json({
      grand:  { value: pools.grand,  minBet: 1.0,  label: "Grand Jackpot" },
      major:  { value: pools.major,  minBet: 0.5,  label: "Major Jackpot" },
      minor:  { value: pools.minor,  minBet: 0.2,  label: "Minor Jackpot" },
      mini:   { value: pools.mini,   minBet: 0.1,  label: "Mini Jackpot" },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch jackpots" });
  }
});

// ── Contribute to Pools (called by Saga after bet) ──
app.post("/jackpots/contribute", async (req, res) => {
  try {
    const { betAmount } = req.body;
    if (!betAmount || betAmount <= 0) {
      return res.status(400).json({ error: "Valid betAmount required" });
    }
    
    const contributions = await contribute(betAmount);
    res.json({ success: true, contributions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Contribution failed" });
  }
});

// ── Check Jackpot Win (called by Saga after spin) ──
app.post("/jackpots/check", async (req, res) => {
  try {
    const { playerId, betAmount, clientSeed, nonce } = req.body;
    if (!playerId || !betAmount || !clientSeed || nonce === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const result = await checkJackpotWin(playerId, betAmount, clientSeed, nonce);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Jackpot check failed" });
  }
});

// ── Admin: Set Pool Value ──
app.post("/jackpots/admin/set", async (req, res) => {
  try {
    const { tier, value, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!["grand", "major", "minor", "mini"].includes(tier)) {
      return res.status(400).json({ error: "Invalid tier" });
    }
    
    await setPoolValue(tier as JackpotTier, value);
    const pools = await getPoolValues();
    res.json({ success: true, pools });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to set pool" });
  }
});

// ── Health ──
app.get("/health", (_req, res) => res.json({ status: "ok", service: "jackpot-service" }));

const PORT = process.env.PORT || 3011;
app.listen(PORT, () => console.log(`Jackpot Service running on port ${PORT}`));
