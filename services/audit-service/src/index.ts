import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  initDB, appendEntry, verifyChain, getEntries,
  exportForRegulator, getEntryByHash,
} from "./audit";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use(limiter);

// ── Append Audit Entry (called by other services) ──
app.post("/audit/append", async (req, res) => {
  try {
    const { eventType, entityType, entityId, actorId, actorType, action, details, beforeState, afterState, ipAddress, userAgent, serviceKey } = req.body;
    
    if (serviceKey !== process.env.SERVICE_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    if (!eventType || !entityType || !entityId || !actorId || !action) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const result = await appendEntry({
      eventType, entityType, entityId, actorId, actorType: actorType || "system",
      action, details: details || {}, beforeState, afterState, ipAddress, userAgent,
    });
    
    res.status(201).json({ success: true, ...result });
  } catch (err) { console.error(err); res.status(500).json({ error: "Append failed" }); }
});

// ── Query Audit Log ──
app.get("/audit/query", async (req, res) => {
  try {
    const entries = await getEntries({
      entityType: req.query.entityType as string,
      entityId: req.query.entityId as string,
      actorId: req.query.actorId as string,
      eventType: req.query.eventType as string,
      action: req.query.action as string,
      fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
      toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      limit: parseInt(req.query.limit as string) || 100,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json({ success: true, count: entries.length, entries });
  } catch (err) { console.error(err); res.status(500).json({ error: "Query failed" }); }
});

// ── Verify Chain Integrity ──
app.get("/audit/verify", async (_req, res) => {
  try {
    const result = await verifyChain();
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: "Verification failed" }); }
});

// ── Regulator Export ──
app.get("/audit/export", async (req, res) => {
  try {
    const { from, to, format, regulatorKey } = req.query as any;
    if (regulatorKey !== process.env.REGULATOR_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!from || !to) return res.status(400).json({ error: "from and to dates required" });
    
    const result = await exportForRegulator(new Date(from), new Date(to), format || "json");
    
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="audit_${from}_${to}.csv"`);
      res.send(result.data);
    } else {
      res.json(result);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: "Export failed" }); }
});

// ── Get Entry by Hash ──
app.get("/audit/entry/:hash", async (req, res) => {
  try {
    const entry = await getEntryByHash(req.params.hash);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json({ success: true, entry });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// ── Health ──
app.get("/health", (_req, res) => res.json({ status: "ok", service: "audit-service" }));

initDB().then(() => {
  const PORT = process.env.PORT || 3015;
  app.listen(PORT, () => console.log(`Audit Trail Service running on port ${PORT}`));
});