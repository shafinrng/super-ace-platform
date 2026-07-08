import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  createSession, getSession, getSessionByPlayer, updateSession,
  lockSession, unlockSession, endSession,
} from "./session";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use(limiter);

app.post("/session", async (req, res) => {
  try {
    const { playerId, gameId, betAmount, currency, serverSeedHash, clientSeed } = req.body;
    if (!playerId || !gameId || betAmount === undefined || !currency || !serverSeedHash || !clientSeed) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const existing = await getSessionByPlayer(playerId);
    if (existing && existing.status !== "completed") {
      return res.status(409).json({ error: "Player already has an active session", sessionId: existing.sessionId });
    }
    const session = await createSession(playerId, gameId, betAmount, currency, serverSeedHash, clientSeed);
    res.status(201).json(session);
  } catch (err) { console.error(err); res.status(500).json({ error: "Session creation failed" }); }
});

app.get("/session/:sessionId", async (req, res) => {
  const session = await getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(session);
});

app.get("/session/player/:playerId", async (req, res) => {
  const session = await getSessionByPlayer(req.params.playerId);
  if (!session) return res.status(404).json({ error: "No active session" });
  res.json(session);
});

app.patch("/session/:sessionId", async (req, res) => {
  try {
    const { status, nonce } = req.body;
    const session = await updateSession(req.params.sessionId, { status, nonce });
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  } catch (err) { console.error(err); res.status(500).json({ error: "Update failed" }); }
});

app.post("/session/:sessionId/lock", async (req, res) => {
  const acquired = await lockSession(req.params.sessionId);
  res.json({ acquired });
});

app.post("/session/:sessionId/unlock", async (req, res) => {
  await unlockSession(req.params.sessionId);
  res.json({ unlocked: true });
});

app.delete("/session/:sessionId", async (req, res) => {
  await endSession(req.params.sessionId);
  res.json({ ended: true });
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "session-service" }));

const PORT = process.env.PORT || 3008;
app.listen(PORT, () => console.log(`Session Service running on port ${PORT}`));

