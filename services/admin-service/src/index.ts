import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import adminRoutes from "./routes/admin.routes";

const REQUIRED_ENVS = ["DATABASE_URL", "JWT_SECRET"];
const missing = REQUIRED_ENVS.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌ Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.ADMIN_PORT || 3006;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3007" }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/admin", limiter);

app.use("/api/admin", adminRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok", service: "admin-service", timestamp: new Date() }));

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ error: err.message || "Internal Server Error" });
});

app.listen(PORT, () => console.log(`✅ Admin Service running on port ${PORT}`));
export default app;
