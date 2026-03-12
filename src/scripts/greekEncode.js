// src/scripts/greekEncode.js
import fs from "fs";
import sqlite3 from "sqlite3";
import * as paths from "./modules/paths.js";

const SOURCE_DB_PATH = paths.GREEK_PROCESSED_DB;
const TARGET_DB_PATH = paths.GREEK_ENCODED_DB;

// Columns whose text content will be processed by the encode step.
// Note: {+} inside CurlyBrackets is a special notation and is preserved as-is.
const COLUMNS_TO_PROCESS = ["Text", "CurlyBrackets"];

// Beta-code to Greek Unicode mapping.
// Letters map to lowercase Unicode Greek.
// Diacritics map to Unicode combining characters and follow the base letter
// they modify, which matches beta-code ordering.
// Note: {+} (diaeresis inside curly brackets) is captured into the
// CurlyBrackets column by greekProcess and never reaches this encoder.
const BETA_TO_GREEK_MAP = new Map([
  // Letters
  ["A", "α"],
  ["B", "β"],
  ["G", "γ"],
  ["D", "δ"],
  ["E", "ε"],
  ["Z", "ζ"],
  ["H", "η"],
  ["Q", "θ"],
  ["I", "ι"],
  ["K", "κ"],
  ["L", "λ"],
  ["M", "μ"],
  ["N", "ν"],
  ["C", "ξ"],
  ["O", "ο"],
  ["P", "π"],
  ["R", "ρ"],
  ["S", "σ"],
  ["J", "ς"],
  ["T", "τ"],
  ["U", "υ"],
  ["F", "φ"],
  ["X", "χ"],
  ["Y", "ψ"],
  ["W", "ω"],
  // Diacritics (Unicode combining characters)
  [")", "\u0313"], // smooth breathing
  ["(", "\u0314"], // rough breathing
  ["/", "\u0301"], // acute accent
  ["\\", "\u0300"], // grave accent
  ["=", "\u0342"], // circumflex (Greek perispomeni)
  ["|", "\u0345"], // iota subscript
  ["+", "\u0308"], // diaeresis
  [":", "\u00B7"], // midpoint punctuation (middle dot)
]);

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

function resetOutputDatabase() {
  if (fs.existsSync(TARGET_DB_PATH)) {
    fs.unlinkSync(TARGET_DB_PATH);
  }
  cleanupWalShm(TARGET_DB_PATH);
  console.log("Reset greek_encoded.db");
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

/**
 * Convert beta-code consonants to Greek Unicode.
 * @param {string} value - Beta-code text
 * @returns {string} - Greek Unicode text
 */
function convertGreekText(value) {
  if (typeof value !== "string" || value.length === 0) return value;

  // Protect {+} (special diaeresis marker) from being encoded
  const PLACEHOLDER = "\x00";
  const guarded = value.replaceAll("{+}", PLACEHOLDER);

  let out = "";
  for (const ch of guarded) {
    out += BETA_TO_GREEK_MAP.get(ch) ?? ch;
  }
  return out.replaceAll(PLACEHOLDER, "{+}");
}

async function verifySourceDatabase() {
  if (!fs.existsSync(SOURCE_DB_PATH)) {
    throw new Error(`Source DB not found: ${SOURCE_DB_PATH}`);
  }
}

async function getProcessedTables(db) {
  return allAsync(
    db,
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_processed' ORDER BY name;`,
  );
}

async function getColumns(db, tableName) {
  return allAsync(db, `PRAGMA table_info(${quoteIdentifier(tableName)})`);
}

function toEncodedTableName(tableName) {
  return tableName.replace(/_processed$/, "_encoded");
}

function createTableSql(targetTableName, columns) {
  const colDefs = columns.map((c) => {
    const parts = [quoteIdentifier(c.name)];
    if (c.type) parts.push(c.type);
    if (c.notnull) parts.push("NOT NULL");
    if (c.dflt_value !== null) parts.push(`DEFAULT ${c.dflt_value}`);
    if (c.pk) parts.push("PRIMARY KEY");
    return parts.join(" ");
  });

  return `CREATE TABLE ${quoteIdentifier(targetTableName)} (${colDefs.join(", ")})`;
}

async function processTable(sourceDb, targetDb, sourceTableName) {
  const targetTableName = toEncodedTableName(sourceTableName);
  const columns = await getColumns(sourceDb, sourceTableName);
  const columnNames = columns.map((c) => c.name);

  await runAsync(
    targetDb,
    `DROP TABLE IF EXISTS ${quoteIdentifier(targetTableName)}`,
  );
  await runAsync(targetDb, createTableSql(targetTableName, columns));

  const selectColumns = columnNames.map(quoteIdentifier).join(", ");
  const rows = await allAsync(
    sourceDb,
    `SELECT rowid AS _rowid, ${selectColumns} FROM ${quoteIdentifier(sourceTableName)} ORDER BY rowid`,
  );

  const placeholders = columnNames.map(() => "?").join(", ");
  const insertSql = `INSERT INTO ${quoteIdentifier(targetTableName)} (${selectColumns}) VALUES (${placeholders})`;

  for (const row of rows) {
    const encoded = {};

    for (const col of columnNames) {
      const original = row[col];

      if (COLUMNS_TO_PROCESS.includes(col)) {
        encoded[col] = convertGreekText(original);
      } else {
        encoded[col] = original;
      }
    }

    const values = columnNames.map((name) => encoded[name]);
    await runAsync(targetDb, insertSql, values);
  }

  console.log(`Created ${targetTableName}`);
}

async function main() {
  await verifySourceDatabase();
  resetOutputDatabase();

  const sourceDb = new sqlite3.Database(SOURCE_DB_PATH, sqlite3.OPEN_READONLY);
  const targetDb = new sqlite3.Database(TARGET_DB_PATH);

  try {
    await runAsync(targetDb, "PRAGMA journal_mode=DELETE");
    await runAsync(targetDb, "BEGIN TRANSACTION");

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
  console.error("greekEncode failed:", err);
  process.exitCode = 1;
});
