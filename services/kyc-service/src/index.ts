import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  initDB, submitKYC, getKYCStatus, reviewKYC,
  runAMLScreening, checkTransactionRisk,
  getPendingKYCs, getAMLScreenings,
} from "./kyc";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 600});
app.use(limiter);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/"),
  filename: (_req, file, cb) => {
    const unique = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

app.post("/kyc/submit", upload.fields([
  { name: "idFront", maxCount: 1 },
  { name: "idBack", maxCount: 1 },
  { name: "selfie", maxCount: 1 },
  { name: "proofOfAddress", maxCount: 1 },
]), async (req, res) => {
  try {
    const files = req.files as Record<string, Express.Multer.File[]>;
    const body = req.body;
    if (!body.userId || !body.fullName || !body.dateOfBirth || !body.idType || !body.idNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const result = await submitKYC({
      userId: body.userId,
      fullName: body.fullName,
      dateOfBirth: body.dateOfBirth,
      nationality: body.nationality,
      idType: body.idType,
      idNumber: body.idNumber,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      postalCode: body.postalCode,
      country: body.country,
    }, {
      idFront: files.idFront?.[0]?.filename || "",
      idBack: files.idBack?.[0]?.filename,
      selfie: files.selfie?.[0]?.filename || "",
      proofOfAddress: files.proofOfAddress?.[0]?.filename,
    });
    res.status(201).json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: "KYC submission failed" }); }
});

app.get("/kyc/status/:userId", async (req, res) => {
  try {
    const status = await getKYCStatus(req.params.userId);
    if (!status) return res.json({ status: "unverified" });
    res.json(status);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/kyc/aml-screen", async (req, res) => {
  try {
    const { userId, fullName } = req.body;
    if (!userId || !fullName) return res.status(400).json({ error: "userId and fullName required" });
    const result = await runAMLScreening(userId, fullName);
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: "AML screening failed" }); }
});

app.post("/kyc/tx-check", async (req, res) => {
  try {
    const { userId, amount, currency, type } = req.body;
    if (!userId || !amount || !currency || !type) {
      return res.status(400).json({ error: "userId, amount, currency, type required" });
    }
    const result = await checkTransactionRisk(userId, amount, currency, type);
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: "Risk check failed" }); }
});

app.post("/kyc/admin/review", async (req, res) => {
  try {
    const { userId, status, reviewedBy, rejectionReason, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });
    if (!userId || !status || !reviewedBy) return res.status(400).json({ error: "Missing fields" });
    if (!["verified", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const success = await reviewKYC(userId, status, reviewedBy, rejectionReason);
    res.json({ success });
  } catch (err) { console.error(err); res.status(500).json({ error: "Review failed" }); }
});

app.get("/kyc/admin/pending", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const pending = await getPendingKYCs(limit);
    res.json({ success: true, count: pending.length, submissions: pending });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.get("/kyc/admin/aml", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const screenings = await getAMLScreenings(userId, limit);
    res.json({ success: true, count: screenings.length, screenings });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "kyc-service" }));

initDB().then(() => {
  const PORT = process.env.PORT || 3014;
  app.listen(PORT, () => console.log(`KYC/AML Service running on port ${PORT}`));
});