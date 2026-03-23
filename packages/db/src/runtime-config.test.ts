import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveDatabaseTarget } from "./runtime-config.js";

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_ENV = { ...process.env };

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function writeText(filePath: string, value: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("resolveDatabaseTarget", () => {
  it("uses DATABASE_URL from process env first", () => {
    process.env.DATABASE_URL = "postgres://env-user:env-pass@db.example.com:5432/paperclip";

    const target = resolveDatabaseTarget();

    expect(target).toMatchObject({
      mode: "postgres",
      connectionString: "postgres://env-user:env-pass@db.example.com:5432/paperclip",
      source: "DATABASE_URL",
    });
  });

  it("uses DATABASE_URL from repo-local .paperclip/.env", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-db-runtime-"));
    const projectDir = path.join(tempDir, "repo");
    fs.mkdirSync(projectDir, { recursive: true });
    process.chdir(projectDir);
    delete process.env.PAPERCLIP_CONFIG;
    writeJson(path.join(projectDir, ".paperclip", "config.json"), {
      database: { mode: "embedded-postgres", embeddedPostgresPort: 54329 },
    });
    writeText(
      path.join(projectDir, ".paperclip", ".env"),
      'DATABASE_URL="postgres://file-user:file-pass@db.example.com:6543/paperclip"\n',
    );

    const target = resolveDatabaseTarget();

    expect(target).toMatchObject({
      mode: "postgres",
      connectionString: "postgres://file-user:file-pass@db.example.com:6543/paperclip",
      source: "paperclip-env",
    });
  });

  it("uses DATABASE_URL from cwd .env when paperclip env has no DATABASE_URL", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-db-runtime-"));
    const projectDir = path.join(tempDir, "repo");
    fs.mkdirSync(projectDir, { recursive: true });
    process.chdir(projectDir);
    delete process.env.PAPERCLIP_CONFIG;
    writeJson(path.join(projectDir, ".paperclip", "config.json"), {
      database: { mode: "embedded-postgres", embeddedPostgresPort: 54329 },
    });
    writeText(path.join(projectDir, ".paperclip", ".env"), "# no DATABASE_URL here\n");
    writeText(
      path.join(projectDir, ".env"),
      "DATABASE_URL=postgres://cwd-user:cwd-pass@localhost:5432/paperclip\n",
    );

    const target = resolveDatabaseTarget();

    expect(target).toMatchObject({
      mode: "postgres",
      connectionString: "postgres://cwd-user:cwd-pass@localhost:5432/paperclip",
      source: "cwd-env",
    });
  });

  it("forces embedded when PAPERCLIP_DATABASE_MODE=embedded even if DATABASE_URL is set", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-db-runtime-"));
    const projectDir = path.join(tempDir, "repo");
    fs.mkdirSync(projectDir, { recursive: true });
    process.chdir(projectDir);
    process.env.PAPERCLIP_DATABASE_MODE = "embedded";
    process.env.DATABASE_URL = "postgres://should-be-ignored@localhost:5432/paperclip";
    delete process.env.PAPERCLIP_CONFIG;
    writeJson(path.join(projectDir, ".paperclip", "config.json"), {
      database: { mode: "embedded-postgres", embeddedPostgresPort: 55331 },
    });

    const target = resolveDatabaseTarget();

    expect(target.mode).toBe("embedded-postgres");
    if (target.mode === "embedded-postgres") {
      expect(target.port).toBe(55331);
    }
  });

  it("throws when PAPERCLIP_DATABASE_MODE=postgres and no URL is configured", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-db-runtime-"));
    const projectDir = path.join(tempDir, "repo");
    fs.mkdirSync(projectDir, { recursive: true });
    process.chdir(projectDir);
    process.env.PAPERCLIP_DATABASE_MODE = "postgres";
    delete process.env.DATABASE_URL;
    delete process.env.PAPERCLIP_CONFIG;
    writeJson(path.join(projectDir, ".paperclip", "config.json"), {
      database: { mode: "embedded-postgres", embeddedPostgresPort: 54329 },
    });
    writeText(path.join(projectDir, ".paperclip", ".env"), "\n");
    writeText(path.join(projectDir, ".env"), "# no DATABASE_URL\n");

    expect(() => resolveDatabaseTarget()).toThrow(/PAPERCLIP_DATABASE_MODE=postgres requires DATABASE_URL/);
  });

  it("prefers paperclip-env DATABASE_URL over cwd .env", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-db-runtime-"));
    const projectDir = path.join(tempDir, "repo");
    fs.mkdirSync(projectDir, { recursive: true });
    process.chdir(projectDir);
    delete process.env.PAPERCLIP_CONFIG;
    writeJson(path.join(projectDir, ".paperclip", "config.json"), {
      database: { mode: "embedded-postgres", embeddedPostgresPort: 54329 },
    });
    writeText(
      path.join(projectDir, ".paperclip", ".env"),
      "DATABASE_URL=postgres://paperclip-wins@db.example.com:5432/paperclip\n",
    );
    writeText(
      path.join(projectDir, ".env"),
      "DATABASE_URL=postgres://cwd-loses@localhost:5432/paperclip\n",
    );

    const target = resolveDatabaseTarget();

    expect(target).toMatchObject({
      mode: "postgres",
      connectionString: "postgres://paperclip-wins@db.example.com:5432/paperclip",
      source: "paperclip-env",
    });
  });

  it("uses config postgres connection string when configured", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-db-runtime-"));
    const configPath = path.join(tempDir, "instance", "config.json");
    process.env.PAPERCLIP_CONFIG = configPath;
    writeJson(configPath, {
      database: {
        mode: "postgres",
        connectionString: "postgres://cfg-user:cfg-pass@db.example.com:5432/paperclip",
      },
    });

    const target = resolveDatabaseTarget();

    expect(target).toMatchObject({
      mode: "postgres",
      connectionString: "postgres://cfg-user:cfg-pass@db.example.com:5432/paperclip",
      source: "config.database.connectionString",
    });
  });

  it("falls back to embedded postgres settings from config", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-db-runtime-"));
    const configPath = path.join(tempDir, "instance", "config.json");
    process.env.PAPERCLIP_CONFIG = configPath;
    writeJson(configPath, {
      database: {
        mode: "embedded-postgres",
        embeddedPostgresDataDir: "~/paperclip-test-db",
        embeddedPostgresPort: 55444,
      },
    });

    const target = resolveDatabaseTarget();

    expect(target).toMatchObject({
      mode: "embedded-postgres",
      dataDir: path.resolve(os.homedir(), "paperclip-test-db"),
      port: 55444,
      source: "embedded-postgres@55444",
    });
  });
});
