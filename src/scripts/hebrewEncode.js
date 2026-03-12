import fs from "fs";
import sqlite3 from "sqlite3";
import * as paths from "./modules/paths.js";

const SOURCE_DB_PATH = paths.HEBREW_PROCESSED_DB;
const TARGET_DB_PATH = paths.HEBREW_ENCODED_DB;

const COLUMNS_TO_PROCESS = [
  "Text",
  "Retroversions",
  "QereKetiv",
  "CurlyBrackets",
];

const BETA_TO_HEBREW_MAP = new Map([
  [")", "א"],
  ["B", "ב"],
  ["G", "ג"],
  ["D", "ד"],
  ["H", "ה"],
  ["W", "ו"],
  ["Z", "ז"],
  ["X", "ח"],
  ["+", "ט"],
  ["Y", "י"],
  ["K", "כ"],
  ["L", "ל"],
  ["M", "מ"],
  ["N", "נ"],
  ["S", "ס"],
  ["(", "ע"],
  ["P", "פ"],
  ["C", "צ"],
  ["Q", "ק"],
  ["R", "ר"],
  ["#", "ש"],
  ["&", "ש\u05C2"],
  ["$", "ש\u05C1"],
  ["T", "ת"],
]);

const FINAL_FORM_BASE_MAP = new Map([
  ["כ", "ך"],
  ["מ", "ם"],
  ["נ", "ן"],
  ["פ", "ף"],
  ["צ", "ץ"],
]);

const HEBREW_CONSONANT = /[\u05D0-\u05EA]/u;
const HEBREW_COMBINING = /[\u0591-\u05C7]/u;
const BASE_REQUIRING_FINAL = /[כמנפצ]/u;

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
  console.log("Reset hebrew_encoded.db");
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function convertBetaConsonants(value) {
  if (typeof value !== "string" || value.length === 0) return value;

  let out = "";
  for (const ch of value) {
    out += BETA_TO_HEBREW_MAP.get(ch) ?? ch;
  }
  return out;
}

function nextSignificantConsonant(chars, startIndex) {
  for (let i = startIndex; i < chars.length; i += 1) {
    const ch = chars[i];
    if (HEBREW_COMBINING.test(ch)) continue;
    return HEBREW_CONSONANT.test(ch) ? ch : null;
  }
  return null;
}

function applyFinalFormFixes(value) {
  if (typeof value !== "string" || value.length === 0) {
    return { value, findings: [] };
  }

  const chars = Array.from(value);
  const findings = [];

  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    if (!BASE_REQUIRING_FINAL.test(current)) continue;

    const nextConsonant = nextSignificantConsonant(chars, i + 1);
    if (nextConsonant === null) {
      const replacement = FINAL_FORM_BASE_MAP.get(current);
      findings.push({ index: i, from: current, to: replacement });
      chars[i] = replacement;
    }
  }

  return { value: chars.join(""), findings };
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

function printReport(report) {
  if (report.length === 0) {
    console.log("No final-form boundary candidates found.");
    return;
  }

  console.log(`Final-form boundary candidates found: ${report.length}`);
  for (const entry of report) {
    const details = entry.findings
      .map((f) => `idx ${f.index}: ${f.from}->${f.to}`)
      .join(", ");
    console.log(
      `[${entry.table}] Prime=${entry.prime ?? "n/a"} column=${entry.column} ${details} | ${entry.sample}`,
    );
  }
}

async function processTable(sourceDb, targetDb, sourceTableName, report) {
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
        const replaced = convertBetaConsonants(original);
        const { value: finalValue, findings } = applyFinalFormFixes(replaced);
        encoded[col] = finalValue;

        if (findings.length > 0) {
          report.push({
            table: targetTableName,
            prime: row.Prime,
            rowid: row._rowid,
            column: col,
            findings,
            sample: String(finalValue).slice(0, 80),
          });
        }
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
  const report = [];

  try {
    // Use DELETE mode to avoid lingering -wal/-shm files for this output DB.
    await runAsync(targetDb, "PRAGMA journal_mode=DELETE");
    await runAsync(targetDb, "BEGIN TRANSACTION");

    const tables = await getProcessedTables(sourceDb);
    for (const { name } of tables) {
      await processTable(sourceDb, targetDb, name, report);
    }

    await runAsync(targetDb, "COMMIT");
    printReport(report);
    console.log(
      "Applied final-form fixes where base letters appeared at word boundaries.",
    );
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
  console.error("hebrewEncode failed:", err);
  process.exitCode = 1;
});
