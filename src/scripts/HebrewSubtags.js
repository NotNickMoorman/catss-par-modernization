import fs from "fs";
import sqlite3 from "sqlite3";
import * as paths from "./modules/paths.js";

const SOURCE_DB_PATH = paths.HEBREW_ENCODED_DB;
const TARGET_DB_PATH = paths.HEBREW_ALIGNED_DB;

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function closeAsync(db) {
  return new Promise((resolve) => db.close(resolve));
}

function cleanupWalShm(dbPath) {
  const wal = `${dbPath}-wal`;
  const shm = `${dbPath}-shm`;
  if (fs.existsSync(wal)) fs.unlinkSync(wal);
  if (fs.existsSync(shm)) fs.unlinkSync(shm);
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function tokenizePhrase(phrase) {
  if (typeof phrase !== "string" || phrase.length === 0) return [];

  const tokens = [];
  let current = "";

  for (const ch of phrase) {
    if (ch === "/") {
      current += "/";
      if (current.trim().length > 0) tokens.push(current.trim());
      current = "";
      continue;
    }

    if (/\s/u.test(ch)) {
      if (current.trim().length > 0) tokens.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim().length > 0) tokens.push(current.trim());
  return tokens;
}

function resetOutputDatabase() {
  if (fs.existsSync(TARGET_DB_PATH)) {
    fs.unlinkSync(TARGET_DB_PATH);
  }
  cleanupWalShm(TARGET_DB_PATH);
  console.log("Reset hebrew_subtags.db");
}

async function verifySourceDatabase() {
  if (!fs.existsSync(SOURCE_DB_PATH)) {
    throw new Error(`Source DB not found: ${SOURCE_DB_PATH}`);
  }
}

async function getProcessedTables(db) {
  return allAsync(
    db,
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_encoded' ORDER BY name;`,
  );
}

async function processTable(sourceDb, targetDb, tableName) {
  const subtagsTable = tableName.replace(/_encoded$/, "_subtags");
  const qSubtagsTable = quoteIdentifier(subtagsTable);
  const qSourceTable = quoteIdentifier(tableName);

  await runAsync(targetDb, `DROP TABLE IF EXISTS ${qSubtagsTable}`);
  await runAsync(
    targetDb,
    `CREATE TABLE ${qSubtagsTable} (
      Prime INTEGER,
      Subtag TEXT,
      Word TEXT,
      Phrase TEXT
    )`,
  );

  const rows = await allAsync(
    sourceDb,
    `SELECT Prime, Text FROM ${qSourceTable} ORDER BY Prime`,
  );

  for (const row of rows) {
    const phrase = row.Text ?? "";
    const words = tokenizePhrase(phrase);

    for (let i = 0; i < words.length; i += 1) {
      const subtag = `${row.Prime}.${i + 1}`;
      await runAsync(
        targetDb,
        `INSERT INTO ${qSubtagsTable} (Prime, Subtag, Word, Phrase) VALUES (?, ?, ?, ?)`,
        [row.Prime, subtag, words[i], phrase],
      );
    }
  }
  console.log(`Created ${subtagsTable}`);
}

async function main() {
  await verifySourceDatabase();
  resetOutputDatabase();

  const sourceDb = new sqlite3.Database(SOURCE_DB_PATH, sqlite3.OPEN_READONLY);
  const targetDb = new sqlite3.Database(TARGET_DB_PATH);

  await runAsync(targetDb, "PRAGMA journal_mode=WAL");
  await runAsync(targetDb, "BEGIN TRANSACTION");

  try {
    const tables = await getProcessedTables(sourceDb);

    for (const { name } of tables) {
      await processTable(sourceDb, targetDb, name);
    }

    await runAsync(targetDb, "COMMIT");
    console.log(`Output DB: ${TARGET_DB_PATH}`);
  } catch (err) {
    await runAsync(targetDb, "ROLLBACK");
    throw err;
  } finally {
    await closeAsync(sourceDb);
    cleanupWalShm(SOURCE_DB_PATH);
    await closeAsync(targetDb);
    cleanupWalShm(TARGET_DB_PATH);
  }
}

main().catch((err) => {
  console.error("HebrewSubtags failed:", err);
  process.exitCode = 1;
});
