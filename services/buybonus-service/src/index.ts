import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { executeBuyBonus, calculateCost, BUY_BONUS_COST_MULTIPLIER } from "./buybonus";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
app.use(limiter);

// ── Get Buy Bonus Cost ──
app.post("/buybonus/cost", async (req, res) => {
  try {
    const { baseBet } = req.body;
    if (!baseBet || baseBet <= 0) {
      return res.status(400).json({ error: "Valid baseBet required" });
    }
    
    const cost = await calculateCost(baseBet);
    res.json({
      baseBet,
      cost,
      multiplier: BUY_BONUS_COST_MULTIPLIER,
      freeSpins: 10,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cost calculation failed" });
  }
});

// ── Execute Buy Bonus ──
app.post("/buybonus/purchase", async (req, res) => {
  try {
    const { playerId, baseBet, currency, clientSeed } = req.body;
    if (!playerId || !baseBet || !currency || !clientSeed) {
      return res.status(400).json({ error: "Missing required fields: playerId, baseBet, currency, clientSeed" });
    }

    const result = await executeBuyBonus({ playerId, baseBet, currency, clientSeed });
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Buy Bonus purchase failed" });
  }
});

// ── Health ──
app.get("/health", (_req, res) => res.json({ status: "ok", service: "buybonus-service" }));

const PORT = process.env.PORT || 3012;
app.listen(PORT, () => console.log(`Buy Bonus Service running on port ${PORT}`));