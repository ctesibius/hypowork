import { describe, expect, it, vi } from "vitest";
import { PgVectorStore, PostgresHistoryManager } from "@hypowork/mem0";

function createPoolMock() {
  return {
    query: vi.fn(async () => ({ rows: [] })),
  };
}

describe("mem0 postgres stores", () => {
  it("scopes pgvector writes and reads by company_id", async () => {
    const pool = createPoolMock();
    const store = new PgVectorStore({
      pool: pool as any,
      companyId: "11111111-1111-1111-1111-111111111111",
      dimension: 3,
      table: "mem0_vectors",
    });

    await store.insert([[0.1, 0.2, 0.3]], ["m1"], [{ data: "hello", userId: "u1" }]);
    await store.search([0.1, 0.2, 0.3], 5, { userId: "u1" });

    expect(pool.query).toHaveBeenCalled();
    const insertCall = pool.query.mock.calls[0];
    expect(insertCall[0]).toContain("company_id");
    expect(insertCall[1][1]).toBe("11111111-1111-1111-1111-111111111111");

    const searchCall = pool.query.mock.calls[1];
    expect(searchCall[0]).toContain("WHERE company_id = $1");
    expect(searchCall[0]).toContain("payload @>");
  });

  it("writes history rows scoped by company_id", async () => {
    const pool = createPoolMock();
    const history = new PostgresHistoryManager({
      pool: pool as any,
      companyId: "22222222-2222-2222-2222-222222222222",
      table: "mem0_memory_history",
    });

    await history.addHistory("m2", "before", "after", "UPDATE");
    expect(pool.query).toHaveBeenCalledTimes(1);
    const call = pool.query.mock.calls[0];
    expect(call[0]).toContain("company_id");
    expect(call[1][0]).toBe("22222222-2222-2222-2222-222222222222");
  });
});
