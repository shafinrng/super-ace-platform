import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import Redis from "ioredis";
import {
  generateServerSeed,
  hashServerSeed,
  generateReelStop,
  verifySpin,
  ProvablyFairParams,
} from "./rng";

const app = express();
const redis = new Redis({ host: process.env.REDIS_HOST || "localhost", port: 6379, retryStrategy: () => 2000 });

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Ã¢â€â‚¬Ã¢â€â‚¬ Health Ã¢â€â‚¬Ã¢â€â‚¬
app.get("/health", (_req, res) => res.json({ status: "ok", service: "rng-service" }));

// Ã¢â€â‚¬Ã¢â€â‚¬ Generate Server Seed Ã¢â€â‚¬Ã¢â€â‚¬
// Returns hashed seed immediately; stores raw seed in Redis (expires in 24h)
app.post("/seed", async (req, res) => {
  try {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });

    const serverSeed = generateServerSeed();
    const hashedSeed = hashServerSeed(serverSeed);
    const nonce = 0;

    // Store raw seed securely (TTL 24h). In production, encrypt this at rest.
    await redis.setex(`seed:${playerId}`, 86400, serverSeed);
    await redis.set(`nonce:${playerId}`, nonce);

    res.json({ hashedSeed, nonce });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Seed generation failed" });
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬ Generate Spin Result Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/spin", async (req, res) => {
  try {
    const { playerId, clientSeed, reelLengths } = req.body;
    if (!playerId || !clientSeed || !Array.isArray(reelLengths)) {
      return res.status(400).json({ error: "playerId, clientSeed, reelLengths required" });
    }

    const serverSeed = await redis.get(`seed:${playerId}`);
    if (!serverSeed) return res.status(400).json({ error: "No active seed. Call /seed first." });

    let nonce = parseInt((await redis.get(`nonce:${playerId}`)) || "0", 10);

    const stops = reelLengths.map((length: number, cursor: number) => {
      const params: ProvablyFairParams = { serverSeed, clientSeed, nonce, cursor };
      return generateReelStop(params, length);
    });

    // Increment nonce for next spin
    await redis.set(`nonce:${playerId}`, nonce + 1);

    res.json({
      stops,
      nonce,           // nonce used for THIS spin
      nextNonce: nonce + 1,
      hashedSeed: hashServerSeed(serverSeed), // player can verify
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Spin generation failed" });
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬ Verify Spin (Public) Ã¢â€â‚¬Ã¢â€â‚¬
// Anyone can call this to verify fairness after serverSeed is revealed
app.post("/verify", (req, res) => {
  try {
    const { serverSeed, clientSeed, nonce, reelLengths } = req.body;
    if (!serverSeed || !clientSeed || nonce === undefined || !reelLengths) {
      return res.status(400).json({ error: "Missing verification params" });
    }

    const stops = verifySpin(serverSeed, clientSeed, nonce, reelLengths);
    res.json({ verified: true, stops });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬ Reveal Server Seed (after session ends / player requests) Ã¢â€â‚¬Ã¢â€â‚¬
app.post("/reveal", async (req, res) => {
  try {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });

    const serverSeed = await redis.get(`seed:${playerId}`);
    if (!serverSeed) return res.status(404).json({ error: "Seed expired or not found" });

    res.json({ serverSeed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Reveal failed" });
  }
});

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => console.log(`RNG Service running on port ${PORT}`));


