import { Router, Request, Response } from "express";
import { spin, calculateWinFromStops } from "../engine/SuperAceGame";
import { getTargetRtp, setTargetRtp, getActualRtp, resetRtpStats, getPlayerRtp, setPlayerRtp, deletePlayerRtp, getAllPlayerRtps } from "../engine/RtpController";

const router = Router();

router.post("/spin", async (req: Request, res: Response) => {
  try {
    const { userId, betAmount, isFreeSpinMode, freeSpinMultiplier } = req.body;
    if (!userId || !betAmount || betAmount <= 0) {
      return res.status(400).json({ error: "Invalid spin request" });
    }
    const result = await spin({ userId, betAmount, isFreeSpinMode, freeSpinMultiplier });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Used by saga-service: takes provably-fair stops (from rng-service) and computes
// the actual grid + wins from the published reel strips. This is the decomposed
// counterpart to /spin, used when the caller already has verified stops.
router.post("/calculate-win", async (req: Request, res: Response) => {
  try {
    const { stops, betAmount, playerId, isFreeSpinMode, freeSpinMultiplier } = req.body;
    if (!Array.isArray(stops) || !betAmount || betAmount <= 0 || !playerId) {
      return res.status(400).json({ error: "stops, betAmount, and playerId are required" });
    }
    const result = await calculateWinFromStops(stops, betAmount, playerId, isFreeSpinMode, freeSpinMultiplier);
    res.json({ success: true, winAmount: result.totalWin, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/config", async (_req: Request, res: Response) => {
  res.json({
    reels: 5,
    rows: 4,
    ways: 1024,
    minBet: 0.1,
    maxBet: 1000,
    rtp: await getTargetRtp(),
  });
});

router.get("/rtp", async (_req: Request, res: Response) => {
  try {
    const target = await getTargetRtp();
    const actual = await getActualRtp();
    res.json({ success: true, target, ...actual });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/rtp", async (req: Request, res: Response) => {
  try {
    const { target } = req.body;
    if (typeof target !== "number") return res.status(400).json({ error: "target must be a number" });
    await setTargetRtp(target);
    res.json({ success: true, target });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.post("/rtp/reset", async (_req: Request, res: Response) => {
  try {
    await resetRtpStats();
    res.json({ success: true, message: "RTP stats reset" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Per-player RTP endpoints
router.get("/rtp/players", async (_req: Request, res: Response) => {
  try {
    const overrides = await getAllPlayerRtps();
    res.json({ success: true, overrides });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/rtp/players/:id", async (req: Request, res: Response) => {
  try {
    const rtp = await getPlayerRtp(String(req.params.id));
    res.json({ success: true, userId: req.params.id, rtp });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/rtp/players/:id", async (req: Request, res: Response) => {
  try {
    const { rtp } = req.body;
    if (typeof rtp !== "number") return res.status(400).json({ error: "rtp must be a number" });
    await setPlayerRtp(String(req.params.id), rtp);
    res.json({ success: true, userId: req.params.id, rtp });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.delete("/rtp/players/:id", async (req: Request, res: Response) => {
  try {
    await deletePlayerRtp(String(req.params.id));
    res.json({ success: true, message: "Player RTP override removed" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
