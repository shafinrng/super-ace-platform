import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { executeSpinSaga, getSaga } from "./saga";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 1000, keyGenerator: (req) => req.body?.playerId || req.ip});
app.use(limiter);

app.post("/saga/spin", async (req, res) => {
  try {
    const { playerId, sessionId, betAmount, currency, clientSeed, reelLengths } = req.body;
    if (!playerId || !sessionId || betAmount === undefined || !currency || !clientSeed || !reelLengths) {
      return res.status(400).json({ error: "Missing saga parameters" });
    }
    const saga = await executeSpinSaga({ playerId, sessionId, betAmount, currency, clientSeed, reelLengths });
    if (saga.status === "completed") res.json({ success: true, saga });
    else res.status(500).json({ success: false, saga });
  } catch (err) { console.error(err); res.status(500).json({ error: "Saga execution failed" }); }
});

app.get("/saga/:sagaId", async (req, res) => {
  const saga = await getSaga(req.params.sagaId);
  if (!saga) return res.status(404).json({ error: "Saga not found" });
  res.json(saga);
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "saga-service" }));

const PORT = process.env.PORT || 3009;
app.listen(PORT, () => console.log(`Saga Service running on port ${PORT}`));
