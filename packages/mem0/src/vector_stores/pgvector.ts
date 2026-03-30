import type { Pool } from "pg";
import { randomUUID } from "crypto";
import { SearchFilters, VectorStoreConfig, VectorStoreResult } from "../types.js";
import { VectorStore } from "./base.js";

type PgVectorStoreConfig = VectorStoreConfig & {
  pool: Pool;
  companyId: string;
  dimension?: number;
  table?: string;
  userTable?: string;
};

export class PgVectorStore implements VectorStore {
  private readonly pool: Pool;
  private readonly companyId: string;
  private readonly dimension: number;
  private readonly tableName: string;
  private readonly userTableName: string;

  constructor(config: VectorStoreConfig) {
    const typedConfig = config as PgVectorStoreConfig;
    if (!typedConfig.pool) {
      throw new Error("PgVectorStore requires config.pool");
    }
    if (!typedConfig.companyId) {
      throw new Error("PgVectorStore requires config.companyId");
    }
    this.pool = typedConfig.pool;
    this.companyId = typedConfig.companyId;
    this.dimension = typedConfig.dimension || 1536;
    this.tableName = typedConfig.table || "mem0_vectors";
    this.userTableName = typedConfig.userTable || "mem0_user_state";
  }

  private formatVector(vector: number[]): string {
    return `[${vector.join(",")}]`;
  }

  private assertDimension(vector: number[], context: string): void {
    if (vector.length !== this.dimension) {
      throw new Error(
        `${context} dimension mismatch. Expected ${this.dimension}, got ${vector.length}`,
      );
    }
  }

  async insert(
    vectors: number[][],
    ids: string[],
    payloads: Record<string, any>[],
  ): Promise<void> {
    for (let i = 0; i < vectors.length; i++) {
      this.assertDimension(vectors[i]!, "Vector");
      await this.pool.query(
        `INSERT INTO ${this.tableName} (id, company_id, embedding, payload)
         VALUES ($1, $2, $3::vector, $4::jsonb)
         ON CONFLICT (id) DO UPDATE
         SET embedding = EXCLUDED.embedding, payload = EXCLUDED.payload, updated_at = now()`,
        [ids[i], this.companyId, this.formatVector(vectors[i]!), JSON.stringify(payloads[i])],
      );
    }
  }

  async search(
    query: number[],
    limit: number = 10,
    filters?: SearchFilters,
  ): Promise<VectorStoreResult[]> {
    this.assertDimension(query, "Query");
    const clauses: string[] = ["company_id = $1"];
    const values: unknown[] = [this.companyId, this.formatVector(query), limit];

    if (filters && Object.keys(filters).length) {
      clauses.push("payload @> $4::jsonb");
      values.push(JSON.stringify(filters));
    }

    const rows = await this.pool.query<{
      id: string;
      payload: Record<string, any>;
      score: number;
    }>(
      `SELECT id, payload, (1 - (embedding <=> $2::vector)) AS score
       FROM ${this.tableName}
       WHERE ${clauses.join(" AND ")}
       ORDER BY embedding <=> $2::vector
       LIMIT $3`,
      values,
    );
    return rows.rows.map((row) => ({
      id: row.id,
      payload: row.payload,
      score: Number(row.score),
    }));
  }

  async get(vectorId: string): Promise<VectorStoreResult | null> {
    const rows = await this.pool.query<{ id: string; payload: Record<string, any> }>(
      `SELECT id, payload
       FROM ${this.tableName}
       WHERE id = $1 AND company_id = $2`,
      [vectorId, this.companyId],
    );
    const row = rows.rows[0];
    if (!row) return null;
    return { id: row.id, payload: row.payload };
  }

  async update(
    vectorId: string,
    vector: number[],
    payload: Record<string, any>,
  ): Promise<void> {
    this.assertDimension(vector, "Vector");
    await this.pool.query(
      `UPDATE ${this.tableName}
       SET embedding = $1::vector, payload = $2::jsonb, updated_at = now()
       WHERE id = $3 AND company_id = $4`,
      [this.formatVector(vector), JSON.stringify(payload), vectorId, this.companyId],
    );
  }

  async delete(vectorId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM ${this.tableName}
       WHERE id = $1 AND company_id = $2`,
      [vectorId, this.companyId],
    );
  }

  async deleteCol(): Promise<void> {
    await this.pool.query(
      `DELETE FROM ${this.tableName}
       WHERE company_id = $1`,
      [this.companyId],
    );
  }

  async list(
    filters?: SearchFilters,
    limit: number = 100,
  ): Promise<[VectorStoreResult[], number]> {
    const clauses: string[] = ["company_id = $1"];
    const values: unknown[] = [this.companyId];
    if (filters && Object.keys(filters).length) {
      clauses.push("payload @> $2::jsonb");
      values.push(JSON.stringify(filters));
    }

    const countRows = await this.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM ${this.tableName}
       WHERE ${clauses.join(" AND ")}`,
      values,
    );
    const total = Number(countRows.rows[0]?.count ?? 0);

    const dataRows = await this.pool.query<{ id: string; payload: Record<string, any> }>(
      `SELECT id, payload
       FROM ${this.tableName}
       WHERE ${clauses.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${values.length + 1}`,
      [...values, limit],
    );

    return [dataRows.rows.map((row) => ({ id: row.id, payload: row.payload })), total];
  }

  async getUserId(): Promise<string> {
    const rows = await this.pool.query<{ user_id: string }>(
      `SELECT user_id FROM ${this.userTableName} WHERE company_id = $1`,
      [this.companyId],
    );
    if (rows.rows[0]?.user_id) {
      return rows.rows[0].user_id;
    }
    const generated = randomUUID();
    await this.setUserId(generated);
    return generated;
  }

  async setUserId(userId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${this.userTableName} (company_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (company_id) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = now()`,
      [this.companyId, userId],
    );
  }

  async initialize(): Promise<void> {}
}
