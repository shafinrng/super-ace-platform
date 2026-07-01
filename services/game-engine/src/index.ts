import express from "express";
import cors from "cors";
import helmet from "helmet";
import gameRoutes from "./routes/game.routes";
const app = express();
const PORT = process.env.GAME_ENGINE_PORT || 3002;
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/api/game", gameRoutes);
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "game-engine", timestamp: new Date() });
});
app.listen(PORT, () => console.log(`✅ Game Engine running on port ${PORT}`));
export default app;