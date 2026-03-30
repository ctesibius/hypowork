import type { Pool } from "pg";
import { HistoryManager } from "./base.js";

type PostgresHistoryManagerConfig = {
  pool: Pool;
  companyId: string;
  table?: string;
  tableName?: string;
};

export class PostgresHistoryManager implements HistoryManager {
  private readonly pool: Pool;
  private readonly companyId: string;
  private readonly tableName: string;

  constructor(config: PostgresHistoryManagerConfig) {
    if (!config.pool) {
      throw new Error("PostgresHistoryManager requires config.pool");
    }
    if (!config.companyId) {
      throw new Error("PostgresHistoryManager requires config.companyId");
    }
    this.pool = config.pool;
    this.companyId = config.companyId;
    this.tableName = config.tableName || config.table || "mem0_memory_history";
  }

  async addHistory(
    memoryId: string,
    previousValue: string | null,
    newValue: string | null,
    action: string,
    createdAt?: string,
    updatedAt?: string,
    isDeleted: number = 0,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${this.tableName}
      (company_id, memory_id, previous_value, new_value, action, created_at, updated_at, is_deleted)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        this.companyId,
        memoryId,
        previousValue,
        newValue,
        action,
        createdAt ?? null,
        updatedAt ?? null,
        isDeleted,
      ],
    );
  }

  async getHistory(memoryId: string): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT id, memory_id, previous_value, new_value, action, created_at, updated_at, is_deleted
       FROM ${this.tableName}
       WHERE company_id = $1 AND memory_id = $2
       ORDER BY id DESC`,
      [this.companyId, memoryId],
    );
    return result.rows;
  }

  async reset(): Promise<void> {
    await this.pool.query(
      `DELETE FROM ${this.tableName}
       WHERE company_id = $1`,
      [this.companyId],
    );
  }

  close(): void {}
}
