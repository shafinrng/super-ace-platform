import Redis from "ioredis";

const pub = new Redis(process.env.REDIS_URL || "redis://:superace123@localhost:6379");
const ACTIVITY_CHANNEL = "game:activity";

pub.on("error", (err) => console.error("Redis pub error:", err));
pub.on("connect", () => console.log("Redis pub connected"));

export async function recordSpin(userId: string, username: string, betAmount: number, winAmount: number): Promise<void> {
  const activity = {
    type: "SPIN",
    userId,
    username,
    betAmount,
    winAmount,
    timestamp: new Date().toISOString(),
  };
  try {
    const listeners = await pub.publish(ACTIVITY_CHANNEL, JSON.stringify(activity));
    console.log(`📢 Published spin to ${listeners} listeners`);
  } catch (err) {
    console.error("Failed to publish spin:", err);
  }
}
