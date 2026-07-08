import { v4 as uuidv4 } from "uuid";
import { Pool } from "pg";
import crypto from "crypto";

const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: 5432,
  database: "superace_db",
  user: "superace",
  password: "superace123",
});

// ── Ensure tables exist ──
export async function initDB(): Promise<void> {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS audit_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sequence_number BIGSERIAL UNIQUE,
      timestamp TIMESTAMP DEFAULT NOW(),
      event_type VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_type VARCHAR(20) DEFAULT 'system' CHECK (actor_type IN ('player', 'admin', 'system', 'service')),
      action VARCHAR(50) NOT NULL,
      details JSONB NOT NULL DEFAULT '{}',
      before_state JSONB,
      after_state JSONB,
      ip_address INET,
      user_agent TEXT,
      previous_hash TEXT,
      entry_hash TEXT NOT NULL,
      verified BOOLEAN DEFAULT TRUE
    );
    
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_entries(entity_type, entity_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_entries(actor_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_entries(event_type, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_entries(timestamp DESC);
  `);
}

export interface AuditEntryInput {
  eventType: string;      // e.g., "transaction", "kyc", "game_spin", "security"
  entityType: string;     // e.g., "wallet", "user", "session", "jackpot"
  entityId: string;       // e.g., wallet ID, user ID
  actorId: string;        // who did it
  actorType: "player" | "admin" | "system" | "service";
  action: string;         // e.g., "bet_placed", "withdrawal_approved", "kyc_verified"
  details: Record<string, any>;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// ── Hash chain: each entry hashes the previous entry's hash ──
async function getPreviousHash(): Promise<string> {
  const result = await pgPool.query(
    `SELECT entry_hash FROM audit_entries ORDER BY sequence_number DESC LIMIT 1`
  );
  return result.rows.length > 0 ? result.rows[0].entry_hash : "genesis";
}

function computeHash(entry: any, previousHash: string): string {
  const data = JSON.stringify({
    sequence: entry.sequence_number,
    timestamp: entry.timestamp,
    eventType: entry.event_type,
    entityType: entry.entity_type,
    entityId: entry.entity_id,
    actorId: entry.actor_id,
    action: entry.action,
    details: entry.details,
    beforeState: entry.before_state,
    afterState: entry.after_state,
    previousHash,
  });
  return crypto.createHash("sha256").update(data).digest("hex");
}

// ── Append entry ──
export async function appendEntry(input: AuditEntryInput): Promise<{
  id: string;
  sequenceNumber: number;
  hash: string;
}> {
  const previousHash = await getPreviousHash();
  
  // Insert without hash first to get sequence number
  const insertResult = await pgPool.query(
    `INSERT INTO audit_entries (
      event_type, entity_type, entity_id, actor_id, actor_type,
      action, details, before_state, after_state, ip_address, user_agent, previous_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id, sequence_number, timestamp, event_type, entity_type, entity_id, actor_id, action, details, before_state, after_state`,
    [
      input.eventType, input.entityType, input.entityId, input.actorId, input.actorType,
      input.action, JSON.stringify(input.details),
      input.beforeState ? JSON.stringify(input.beforeState) : null,
      input.afterState ? JSON.stringify(input.afterState) : null,
      input.ipAddress || null, input.userAgent || null,
      previousHash,
    ]
  );
  
  const row = insertResult.rows[0];
  
  // Compute hash with the now-known sequence number
  const entryHash = computeHash(row, previousHash);
  
  // Update with the computed hash
  await pgPool.query(
    `UPDATE audit_entries SET entry_hash = $1 WHERE id = $2`,
    [entryHash, row.id]
  );
  
  return {
    id: row.id,
    sequenceNumber: row.sequence_number,
    hash: entryHash,
  };
}

// ── Verify chain integrity ──
export async function verifyChain(): Promise<{
  valid: boolean;
  totalEntries: number;
  brokenAt?: number;
  expectedHash?: string;
  actualHash?: string;
}> {
  const entries = await pgPool.query(
    `SELECT sequence_number, entry_hash, previous_hash, event_type, entity_id, action
     FROM audit_entries ORDER BY sequence_number ASC`
  );
  
  if (entries.rows.length === 0) return { valid: true, totalEntries: 0 };
  
  let previousHash = "genesis";
  
  for (const row of entries.rows) {
    const computed = computeHash(row, previousHash);
    
    if (computed !== row.entry_hash) {
      return {
        valid: false,
        totalEntries: entries.rows.length,
        brokenAt: row.sequence_number,
        expectedHash: computed,
        actualHash: row.entry_hash,
      };
    }
    
    previousHash = row.entry_hash;
  }
  
  return { valid: true, totalEntries: entries.rows.length };
}

// ── Query entries ──
export async function getEntries(filters: {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  eventType?: string;
  action?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (filters.entityType) { conditions.push(`entity_type = $${paramIndex++}`); values.push(filters.entityType); }
  if (filters.entityId) { conditions.push(`entity_id = $${paramIndex++}`); values.push(filters.entityId); }
  if (filters.actorId) { conditions.push(`actor_id = $${paramIndex++}`); values.push(filters.actorId); }
  if (filters.eventType) { conditions.push(`event_type = $${paramIndex++}`); values.push(filters.eventType); }
  if (filters.action) { conditions.push(`action = $${paramIndex++}`); values.push(filters.action); }
  if (filters.fromDate) { conditions.push(`timestamp >= $${paramIndex++}`); values.push(filters.fromDate); }
  if (filters.toDate) { conditions.push(`timestamp <= $${paramIndex++}`); values.push(filters.toDate); }
  
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  
  const result = await pgPool.query(
    `SELECT * FROM audit_entries ${where} ORDER BY sequence_number DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset]
  );
  
  return result.rows;
}

// ── Export for regulator ──
export async function exportForRegulator(fromDate: Date, toDate: Date, format: "json" | "csv" = "json"): Promise<any> {
  const entries = await getEntries({ fromDate, toDate, limit: 100000 });
  
  if (format === "csv") {
    const headers = ["sequence_number", "timestamp", "event_type", "entity_type", "entity_id", "actor_id", "actor_type", "action", "details", "entry_hash"];
    const rows = entries.map(e => [
      e.sequence_number, e.timestamp, e.event_type, e.entity_type, e.entity_id,
      e.actor_id, e.actor_type, e.action, JSON.stringify(e.details), e.entry_hash
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    
    return { format: "csv", data: [headers.join(","), ...rows].join("\n") };
  }
  
  return { format: "json", entries };
}

// ── Get entry by hash (for verification) ──
export async function getEntryByHash(hash: string): Promise<any | null> {
  const result = await pgPool.query(
    `SELECT * FROM audit_entries WHERE entry_hash = $1`, [hash]
  );
  return result.rows[0] || null;
}