import { v4 as uuidv4 } from "uuid";
import { Pool } from "pg";
import Redis from "ioredis";

const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: 5432,
  database: "superace_db",
  user: "superace",
  password: "superace123",
});

const redis = new Redis({ host: process.env.REDIS_HOST || "localhost", port: 6379 });

export async function initDB(): Promise<void> {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS self_exclusions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL UNIQUE,
      type VARCHAR(20) NOT NULL CHECK (type IN ('temporary', 'permanent')),
      duration_hours INTEGER,
      reason TEXT,
      excluded_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP,
      lifted_at TIMESTAMP,
      lifted_by TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS deposit_limits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL UNIQUE,
      daily_limit DECIMAL(18,8),
      weekly_limit DECIMAL(18,8),
      monthly_limit DECIMAL(18,8),
      current_daily DECIMAL(18,8) DEFAULT 0,
      current_weekly DECIMAL(18,8) DEFAULT 0,
      current_monthly DECIMAL(18,8) DEFAULT 0,
      daily_reset_at TIMESTAMP,
      weekly_reset_at TIMESTAMP,
      monthly_reset_at TIMESTAMP,
      last_updated TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS loss_limits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL UNIQUE,
      daily_loss_limit DECIMAL(18,8),
      session_loss_limit DECIMAL(18,8),
      current_daily_loss DECIMAL(18,8) DEFAULT 0,
      current_session_loss DECIMAL(18,8) DEFAULT 0,
      session_started_at TIMESTAMP,
      last_updated TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS reality_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL UNIQUE,
      interval_minutes INTEGER DEFAULT 60,
      last_shown_at TIMESTAMP,
      enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_se_user ON self_exclusions(user_id);
    CREATE INDEX IF NOT EXISTS idx_dl_user ON deposit_limits(user_id);
    CREATE INDEX IF NOT EXISTS idx_ll_user ON loss_limits(user_id);
    CREATE INDEX IF NOT EXISTS idx_rc_user ON reality_checks(user_id);
  `);
}

// ── Self Exclusion ──
export async function setSelfExclusion(
  userId: string,
  type: "temporary" | "permanent",
  durationHours?: number,
  reason?: string
): Promise<{ id: string; expiresAt?: Date }> {
  const id = uuidv4();
  const excludedAt = new Date();
  const expiresAt = type === "temporary" && durationHours
    ? new Date(excludedAt.getTime() + durationHours * 60 * 60 * 1000)
    : null;
  
  await pgPool.query(
    `INSERT INTO self_exclusions (id, user_id, type, duration_hours, reason, excluded_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET
       type = EXCLUDED.type, duration_hours = EXCLUDED.duration_hours,
       reason = EXCLUDED.reason, excluded_at = EXCLUDED.excluded_at,
       expires_at = EXCLUDED.expires_at, lifted_at = NULL, lifted_by = NULL`,
    [id, userId, type, durationHours || null, reason || null, excludedAt, expiresAt]
  );
  
  // Cache in Redis for fast checks
  const ttl = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 1000) : 31536000; // 1 year for permanent
  await redis.setex(`exclusion:${userId}`, ttl, JSON.stringify({ type, expiresAt }));
  
  return { id, expiresAt: expiresAt || undefined };
}

export async function checkSelfExclusion(userId: string): Promise<{
  excluded: boolean;
  type?: string;
  expiresAt?: Date;
  reason?: string;
}> {
  // Check cache first
  const cached = await redis.get(`exclusion:${userId}`);
  if (cached) {
    const data = JSON.parse(cached);
    return { excluded: true, type: data.type, expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined };
  }
  
  const result = await pgPool.query(
    `SELECT type, expires_at, reason FROM self_exclusions
     WHERE user_id = $1 AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId]
  );
  
  if (result.rows.length === 0) return { excluded: false };
  
  const row = result.rows[0];
  return {
    excluded: true,
    type: row.type,
    expiresAt: row.expires_at,
    reason: row.reason,
  };
}

export async function liftSelfExclusion(userId: string, liftedBy: string): Promise<boolean> {
  const result = await pgPool.query(
    `UPDATE self_exclusions SET lifted_at = NOW(), lifted_by = $1 WHERE user_id = $2 AND lifted_at IS NULL`,
    [liftedBy, userId]
  );
  await redis.del(`exclusion:${userId}`);
  return (result.rowCount ?? 0) > 0;
}

// ── Deposit Limits ──
export async function setDepositLimits(
  userId: string,
  daily?: number,
  weekly?: number,
  monthly?: number
): Promise<boolean> {
  const now = new Date();
  const dailyReset = new Date(now); dailyReset.setHours(24, 0, 0, 0);
  const weeklyReset = new Date(now); weeklyReset.setDate(weeklyReset.getDate() + (7 - weeklyReset.getDay())); weeklyReset.setHours(0, 0, 0, 0);
  const monthlyReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  
  await pgPool.query(
    `INSERT INTO deposit_limits (user_id, daily_limit, weekly_limit, monthly_limit, daily_reset_at, weekly_reset_at, monthly_reset_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET
       daily_limit = COALESCE(EXCLUDED.daily_limit, deposit_limits.daily_limit),
       weekly_limit = COALESCE(EXCLUDED.weekly_limit, deposit_limits.weekly_limit),
       monthly_limit = COALESCE(EXCLUDED.monthly_limit, deposit_limits.monthly_limit),
       last_updated = NOW()`,
    [userId, daily || null, weekly || null, monthly || null, dailyReset, weeklyReset, monthlyReset]
  );
  
  return true;
}

export async function checkDepositLimit(userId: string, amount: number): Promise<{
  allowed: boolean;
  reason?: string;
  dailyRemaining?: number;
  weeklyRemaining?: number;
  monthlyRemaining?: number;
}> {
  // Reset counters if needed
  const now = new Date();
  await pgPool.query(
    `UPDATE deposit_limits SET
       current_daily = CASE WHEN daily_reset_at < $1 THEN 0 ELSE current_daily END,
       current_weekly = CASE WHEN weekly_reset_at < $1 THEN 0 ELSE current_weekly END,
       current_monthly = CASE WHEN monthly_reset_at < $1 THEN 0 ELSE current_monthly END,
       daily_reset_at = CASE WHEN daily_reset_at < $1 THEN $2 ELSE daily_reset_at END,
       weekly_reset_at = CASE WHEN weekly_reset_at < $1 THEN $3 ELSE weekly_reset_at END,
       monthly_reset_at = CASE WHEN monthly_reset_at < $1 THEN $4 ELSE monthly_reset_at END
     WHERE user_id = $5`,
    [now, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
     new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay()) + 1),
     new Date(now.getFullYear(), now.getMonth() + 1, 1), userId]
  );
  
  const result = await pgPool.query(
    `SELECT daily_limit, weekly_limit, monthly_limit, current_daily, current_weekly, current_monthly
     FROM deposit_limits WHERE user_id = $1`, [userId]
  );
  
  if (result.rows.length === 0) return { allowed: true }; // No limits set
  
  const row = result.rows[0];
  const dl = Number(row.daily_limit) || Infinity;
  const wl = Number(row.weekly_limit) || Infinity;
  const ml = Number(row.monthly_limit) || Infinity;
  const cd = Number(row.current_daily);
  const cw = Number(row.current_weekly);
  const cm = Number(row.current_monthly);
  
  if (cd + amount > dl) return { allowed: false, reason: "Daily deposit limit exceeded", dailyRemaining: dl - cd };
  if (cw + amount > wl) return { allowed: false, reason: "Weekly deposit limit exceeded", weeklyRemaining: wl - cw };
  if (cm + amount > ml) return { allowed: false, reason: "Monthly deposit limit exceeded", monthlyRemaining: ml - cm };
  
  return { allowed: true, dailyRemaining: dl - cd - amount, weeklyRemaining: wl - cw - amount, monthlyRemaining: ml - cm - amount };
}

export async function recordDeposit(userId: string, amount: number): Promise<void> {
  await pgPool.query(
    `UPDATE deposit_limits SET
       current_daily = current_daily + $1,
       current_weekly = current_weekly + $1,
       current_monthly = current_monthly + $1,
       last_updated = NOW()
     WHERE user_id = $2`,
    [amount, userId]
  );
}

// ── Loss Limits ──
export async function setLossLimits(userId: string, dailyLoss?: number, sessionLoss?: number): Promise<boolean> {
  await pgPool.query(
    `INSERT INTO loss_limits (user_id, daily_loss_limit, session_loss_limit, session_started_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       daily_loss_limit = COALESCE(EXCLUDED.daily_loss_limit, loss_limits.daily_loss_limit),
       session_loss_limit = COALESCE(EXCLUDED.session_loss_limit, loss_limits.session_loss_limit),
       last_updated = NOW()`,
    [userId, dailyLoss || null, sessionLoss || null]
  );
  return true;
}

export async function checkLossLimit(userId: string, lossAmount: number): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const now = new Date();
  await pgPool.query(
    `UPDATE loss_limits SET
       current_daily_loss = CASE WHEN session_started_at < $1 - INTERVAL '1 day' THEN 0 ELSE current_daily_loss END,
       current_session_loss = 0,
       session_started_at = CASE WHEN session_started_at < $1 - INTERVAL '1 day' THEN $1 ELSE session_started_at END
     WHERE user_id = $2`,
    [now, userId]
  );
  
  const result = await pgPool.query(
    `SELECT daily_loss_limit, session_loss_limit, current_daily_loss, current_session_loss
     FROM loss_limits WHERE user_id = $1`, [userId]
  );
  
  if (result.rows.length === 0) return { allowed: true };
  
  const row = result.rows[0];
  const dl = Number(row.daily_loss_limit) || Infinity;
  const sl = Number(row.session_loss_limit) || Infinity;
  const cdl = Number(row.current_daily_loss);
  const csl = Number(row.current_session_loss);
  
  if (cdl + lossAmount > dl) return { allowed: false, reason: "Daily loss limit exceeded" };
  if (csl + lossAmount > sl) return { allowed: false, reason: "Session loss limit exceeded" };
  
  return { allowed: true };
}

export async function recordLoss(userId: string, amount: number): Promise<void> {
  await pgPool.query(
    `UPDATE loss_limits SET
       current_daily_loss = current_daily_loss + $1,
       current_session_loss = current_session_loss + $1,
       last_updated = NOW()
     WHERE user_id = $2`,
    [amount, userId]
  );
}

// ── Reality Checks ──
export async function setRealityCheck(userId: string, intervalMinutes: number, enabled: boolean = true): Promise<boolean> {
  await pgPool.query(
    `INSERT INTO reality_checks (user_id, interval_minutes, enabled, last_shown_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       interval_minutes = EXCLUDED.interval_minutes,
       enabled = EXCLUDED.enabled,
       last_shown_at = CASE WHEN reality_checks.enabled = FALSE AND EXCLUDED.enabled = TRUE THEN NOW() ELSE reality_checks.last_shown_at END`,
    [userId, intervalMinutes, enabled]
  );
  return true;
}

export async function checkRealityCheck(userId: string): Promise<{
  showCheck: boolean;
  timePlayed?: number;
  netResult?: number;
  message?: string;
}> {
  const result = await pgPool.query(
    `SELECT interval_minutes, last_shown_at, enabled FROM reality_checks WHERE user_id = $1`, [userId]
  );
  
  if (result.rows.length === 0 || !result.rows[0].enabled) {
    return { showCheck: false };
  }
  
  const row = result.rows[0];
  const intervalMs = row.interval_minutes * 60 * 1000;
  const lastShown = new Date(row.last_shown_at).getTime();
  
  if (Date.now() - lastShown < intervalMs) {
    return { showCheck: false };
  }
  
  // Update last shown
  await pgPool.query(
    `UPDATE reality_checks SET last_shown_at = NOW() WHERE user_id = $1`, [userId]
  );
  
  // In production, query wallet for net result during session
  return {
    showCheck: true,
    timePlayed: Math.floor((Date.now() - lastShown) / 60000),
    netResult: 0, // Placeholder - fetch from wallet service
    message: "You've been playing for a while. Take a break?",
  };
}

// ── Full Player Check (called before every bet/deposit) ──
export async function playerHealthCheck(userId: string, amount: number, type: "bet" | "deposit"): Promise<{
  allowed: boolean;
  reason?: string;
  checks: Record<string, any>;
}> {
  const checks: Record<string, any> = {};
  
  // 1. Self-exclusion
  const exclusion = await checkSelfExclusion(userId);
  checks.selfExclusion = exclusion;
  if (exclusion.excluded) {
    return { allowed: false, reason: `Self-excluded: ${exclusion.type}${exclusion.expiresAt ? ` until ${exclusion.expiresAt}` : ""}`, checks };
  }
  
  // 2. Deposit limits (for deposits)
  if (type === "deposit") {
    const depositCheck = await checkDepositLimit(userId, amount);
    checks.depositLimit = depositCheck;
    if (!depositCheck.allowed) {
      return { allowed: false, reason: depositCheck.reason, checks };
    }
  }
  
  // 3. Loss limits (for bets)
  if (type === "bet") {
    const lossCheck = await checkLossLimit(userId, amount);
    checks.lossLimit = lossCheck;
    if (!lossCheck.allowed) {
      return { allowed: false, reason: lossCheck.reason, checks };
    }
  }
  
  // 4. Reality check (informational)
  const reality = await checkRealityCheck(userId);
  checks.realityCheck = reality;
  
  return { allowed: true, checks };
}