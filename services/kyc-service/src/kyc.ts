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
    CREATE TABLE IF NOT EXISTS kyc_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL UNIQUE,
      status VARCHAR(20) DEFAULT 'unverified' CHECK (status IN ('unverified', 'pending', 'basic', 'verified', 'rejected')),
      full_name TEXT,
      date_of_birth DATE,
      nationality TEXT,
      id_type VARCHAR(20) CHECK (id_type IN ('passport', 'drivers_license', 'national_id')),
      id_number TEXT,
      id_front_url TEXT,
      id_back_url TEXT,
      selfie_url TEXT,
      proof_of_address_url TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      postal_code TEXT,
      country TEXT,
      submitted_at TIMESTAMP,
      reviewed_at TIMESTAMP,
      reviewed_by TEXT,
      rejection_reason TEXT,
      risk_score INTEGER DEFAULT 0,
      aml_screening_passed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS aml_screenings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      screening_type VARCHAR(50),
      provider VARCHAR(50),
      result VARCHAR(20) CHECK (result IN ('pass', 'fail', 'review', 'error')),
      matches JSONB DEFAULT '[]',
      checked_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_kyc_user ON kyc_submissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_aml_user ON aml_screenings(user_id, checked_at DESC);
  `);
}

export type KYCStatus = "unverified" | "pending" | "basic" | "verified" | "rejected";
export type IDType = "passport" | "drivers_license" | "national_id";

export interface KYCSubmission {
  userId: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  idType: IDType;
  idNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  country: string;
}

export async function submitKYC(data: KYCSubmission, files: {
  idFront: string;
  idBack?: string;
  selfie: string;
  proofOfAddress?: string;
}): Promise<{ id: string; status: KYCStatus }> {
  const id = uuidv4();
  await pgPool.query(
    `INSERT INTO kyc_submissions (
      id, user_id, status, full_name, date_of_birth, nationality,
      id_type, id_number, id_front_url, id_back_url, selfie_url, proof_of_address_url,
      address_line1, address_line2, city, postal_code, country, submitted_at
    ) VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      status = 'pending', full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth,
      nationality = EXCLUDED.nationality, id_type = EXCLUDED.id_type, id_number = EXCLUDED.id_number,
      id_front_url = EXCLUDED.id_front_url, id_back_url = EXCLUDED.id_back_url,
      selfie_url = EXCLUDED.selfie_url, proof_of_address_url = EXCLUDED.proof_of_address_url,
      address_line1 = EXCLUDED.address_line1, address_line2 = EXCLUDED.address_line2,
      city = EXCLUDED.city, postal_code = EXCLUDED.postal_code, country = EXCLUDED.country,
      submitted_at = NOW(), updated_at = NOW()`,
    [
      id, data.userId, data.fullName, data.dateOfBirth, data.nationality,
      data.idType, data.idNumber, files.idFront, files.idBack || null, files.selfie,
      files.proofOfAddress || null, data.addressLine1, data.addressLine2 || null,
      data.city, data.postalCode, data.country,
    ]
  );
  await redis.setex(`kyc:${data.userId}`, 3600, JSON.stringify({ status: "pending", submittedAt: new Date().toISOString() }));
  return { id, status: "pending" };
}

export async function getKYCStatus(userId: string): Promise<{
  status: KYCStatus;
  fullName?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  rejectionReason?: string;
  riskScore: number;
  amlPassed: boolean;
} | null> {
  const cached = await redis.get(`kyc:${userId}`);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed.status !== "pending") return { ...parsed, riskScore: 0, amlPassed: false };
  }
  const result = await pgPool.query(
    `SELECT status, full_name, submitted_at, reviewed_at, rejection_reason, risk_score, aml_screening_passed
     FROM kyc_submissions WHERE user_id = $1`, [userId]
  );
  if (result.rows.length === 0) return { status: "unverified", riskScore: 0, amlPassed: false };
  const row = result.rows[0];
  const data = {
    status: row.status,
    fullName: row.full_name,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    riskScore: row.risk_score,
    amlPassed: row.aml_screening_passed,
  };
  await redis.setex(`kyc:${userId}`, 3600, JSON.stringify(data));
  return data;
}

export async function reviewKYC(
  userId: string,
  status: "verified" | "rejected",
  reviewedBy: string,
  rejectionReason?: string
): Promise<boolean> {
  const result = await pgPool.query(
    `UPDATE kyc_submissions SET
      status = $1, reviewed_at = NOW(), reviewed_by = $2,
      rejection_reason = $3, updated_at = NOW()
     WHERE user_id = $4 RETURNING id`,
    [status, reviewedBy, rejectionReason || null, userId]
  );
  if ((result.rowCount ?? 0) > 0) {
    await redis.del(`kyc:${userId}`);
    return true;
  }
  return false;
}

export async function runAMLScreening(userId: string, fullName: string): Promise<{
  passed: boolean;
  riskScore: number;
  matches: any[];
}> {
  const screeningId = uuidv4();
  const hasMatch = Math.random() < 0.01;
  const riskScore = hasMatch ? 85 : 5;
  const passed = !hasMatch;
  const matches = hasMatch ? [{ name: fullName, list: "OFAC-SDN", matchType: "exact", confidence: 0.95 }] : [];
  await pgPool.query(
    `INSERT INTO aml_screenings (id, user_id, screening_type, provider, result, matches)
     VALUES ($1, $2, 'sanctions', 'mock-provider', $3, $4)`,
    [screeningId, userId, passed ? 'pass' : 'fail', JSON.stringify(matches)]
  );
  await pgPool.query(
    `UPDATE kyc_submissions SET aml_screening_passed = $1, risk_score = $2, updated_at = NOW()
     WHERE user_id = $3`, [passed, riskScore, userId]
  );
  await redis.del(`kyc:${userId}`);
  return { passed, riskScore, matches };
}

export async function checkTransactionRisk(
  userId: string,
  amount: number,
  currency: string,
  type: "deposit" | "withdrawal" | "bet"
): Promise<{ allowed: boolean; reason?: string; requiresReview: boolean }> {
  const kyc = await getKYCStatus(userId);
  if (!kyc || kyc.status === "unverified") {
    if (type === "deposit" && amount <= 100) return { allowed: true, requiresReview: false };
    return { allowed: false, reason: "KYC verification required for this transaction", requiresReview: false };
  }
  if (kyc.status === "rejected") {
    return { allowed: false, reason: "Account restricted due to failed KYC", requiresReview: false };
  }
  if (kyc.status === "pending") {
    if (type === "deposit" && amount <= 500) return { allowed: true, requiresReview: true };
    return { allowed: false, reason: "KYC under review. Limit: $500 deposit", requiresReview: true };
  }
  if (kyc.riskScore > 70) {
    return { allowed: true, reason: "High risk - transaction flagged for review", requiresReview: true };
  }
  const dailyKey = `tx:daily:${userId}:${new Date().toISOString().split('T')[0]}`;
  const dailyTotal = parseFloat((await redis.get(dailyKey)) || "0");
  const limits: Record<string, number> = { deposit: 50000, withdrawal: 10000, bet: 100000 };
  if (dailyTotal + amount > limits[type]) {
    return { allowed: false, reason: `Daily ${type} limit exceeded`, requiresReview: false };
  }
  await redis.incrbyfloat(dailyKey, amount);
  await redis.expire(dailyKey, 86400);
  return { allowed: true, requiresReview: false };
}

export async function getPendingKYCs(limit: number = 50): Promise<any[]> {
  const result = await pgPool.query(
    `SELECT * FROM kyc_submissions WHERE status = 'pending' ORDER BY submitted_at ASC LIMIT $1`, [limit]
  );
  return result.rows;
}

export async function getAMLScreenings(userId?: string, limit: number = 50): Promise<any[]> {
  const query = userId
    ? `SELECT * FROM aml_screenings WHERE user_id = $1 ORDER BY checked_at DESC LIMIT $2`
    : `SELECT * FROM aml_screenings ORDER BY checked_at DESC LIMIT $1`;
  const params = userId ? [userId, limit] : [limit];
  const result = await pgPool.query(query, params);
  return result.rows;
}