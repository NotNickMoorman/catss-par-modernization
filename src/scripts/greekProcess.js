// src/scripts/greekProcess.js
import fs from "fs";
import sqlite3 from "sqlite3";
import * as paths from "./modules/paths.js";
import * as helpers from "./modules/greekProcessHelpers.js";

let INIT_DB;
let GREEK_PROC_DB;

function cleanupWalShm(dbPath) {
  const wal = `${dbPath}-wal`;
  const shm = `${dbPath}-shm`;

  if (fs.existsSync(wal)) fs.unlinkSync(wal);
  if (fs.existsSync(shm)) fs.unlinkSync(shm);
}

function resetOutputDatabase() {
  if (fs.existsSync(paths.GREEK_PROCESSED_DB)) {
    fs.unlinkSync(paths.GREEK_PROCESSED_DB);
  }
  cleanupWalShm(paths.GREEK_PROCESSED_DB);
  console.log("Reset greek_processed.db");
}

function initDatabases() {
  INIT_DB = new sqlite3.Database(paths.DB, sqlite3.OPEN_READONLY, (err) => {
    if (err) console.error("Failed to open init.db:", err);
  });
  GREEK_PROC_DB = new sqlite3.Database(paths.GREEK_PROCESSED_DB);
  GREEK_PROC_DB.exec("PRAGMA journal_mode=WAL");
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function closeDatabases() {
  const closeDB = (db) => new Promise((resolve) => db.close(resolve));

  if (INIT_DB) await closeDB(INIT_DB);
  if (GREEK_PROC_DB) await closeDB(GREEK_PROC_DB);

  cleanupWalShm(paths.DB);
  cleanupWalShm(paths.GREEK_PROCESSED_DB);

  console.log("Databases closed and WAL/SHM cleaned up.");
}

// main async function
async function processGreek() {
  resetOutputDatabase();
  initDatabases();

  console.log("Starting Greek processing...");

  const tables = await allAsync(
    INIT_DB,
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_Init';`,
  );
  console.log("Found tables:", tables.map((t) => t.name).join(", "));

  for (const { name: tableName } of tables) {
    const processedTable = tableName.replace("_Init", "_processed");

    const quotedTable = `"${processedTable}"`;
    const quotedSourceTable = `"${tableName}"`;
    await runAsync(GREEK_PROC_DB, `DROP TABLE IF EXISTS ${quotedTable}`);

    await runAsync(
      GREEK_PROC_DB,
      `CREATE TABLE IF NOT EXISTS ${quotedTable} (
        Prime INTEGER PRIMARY KEY,
        Text TEXT,
        Tags TEXT,
        CurlyBrackets TEXT,
        AngleBrackets TEXT,
        Minuses TEXT,
        Original TEXT
      )`,
    );

    const rows = await allAsync(INIT_DB, `SELECT * FROM ${quotedSourceTable}`);
    console.log(`Processing ${tableName} (${rows.length} rows)`);

    await runAsync(GREEK_PROC_DB, "BEGIN TRANSACTION");

    try {
      for (const row of rows) {
        let processingText = row.Greek;
        let processingTags = "";
        let processingCurly = "";
        let processingAngle = "";
        let processingMinuses = "";

        ({
          text: processingText,
          tags: processingTags,
          angle: processingAngle,
        } = helpers.moveAngleTag(
          processingText,
          processingTags,
          processingAngle,
        ));

        ({
          text: processingText,
          tags: processingTags,
          minuses: processingMinuses,
        } = helpers.stripMinusesTag(
          processingText,
          processingTags,
          processingMinuses,
        ));

        ({ text: processingText, tags: processingTags } =
          helpers.stripQuestionTag(processingText, processingTags));

        ({ text: processingText, tags: processingTags } =
          helpers.stripCarrotsTag(processingText, processingTags));

        ({
          text: processingText,
          tags: processingTags,
          curly: processingCurly,
        } = helpers.moveCurlyTag(
          processingText,
          processingTags,
          processingCurly,
        ));

        ({ text: processingText } = helpers.removeWhiteSpace(processingText));

        const text = processingText || "";
        const tags = processingTags;
        const curly = processingCurly;
        const angle = processingAngle;
        const minuses = processingMinuses;
        const original = row.Greek || "";

        await runAsync(
          GREEK_PROC_DB,
          `INSERT INTO ${quotedTable}
           (Text, Tags, CurlyBrackets, AngleBrackets, Minuses, Original)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [text, tags, curly, angle, minuses, original],
        );
      }

      await runAsync(GREEK_PROC_DB, "COMMIT");
    } catch (err) {
      console.error(`Error processing ${tableName}:`, err);
      await runAsync(GREEK_PROC_DB, "ROLLBACK");
    }
  }
}

//execution block:
processGreek()
  .then(() => closeDatabases())
  .catch(async (err) => {
    console.error("Import failed:", err);
    await closeDatabases();
  });
