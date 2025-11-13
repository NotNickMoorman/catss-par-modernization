// src/scripts/hebrewProcess.js
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import * as paths from "./modules/paths.js";
import * as helpers from "./modules/hebrewProcessHelpers.js";

//paths
const INIT_DB = new sqlite3.Database(paths.DB, sqlite3.OPEN_READONLY, (err) => {
  if (err) console.error("Failed to open init.db:", err);
});
const HEB_PROC_DB = new sqlite3.Database(paths.HEBREW_PROCESSED_DB);

//path logging
/*
console.log("init.db", paths.DB);
console.log("init.db", paths.HEBREW_PROCESSED_DB);
console.log("init.db:", INIT_DB);
console.log("hebrew_processed.db:", HEB_PROC_DB);
*/

//config
HEB_PROC_DB.exec("PRAGMA journal_mode=WAL");

//helper functions
//See modules/hebrewProcessHelpers
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

  await closeDB(INIT_DB);
  await closeDB(HEB_PROC_DB);

  const dbFiles = [paths.DB, paths.HEBREW_PROCESSED_DB];

  for (const file of dbFiles) {
    const wal = file + "-wal";
    const shm = file + "-shm";

    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    if (fs.existsSync(shm)) fs.unlinkSync(shm);
  }

  console.log("Databases closed and WAL/SHM cleaned up.");
}

// main async function
async function processHebrew() {
  console.log("Starting Hebrew processing...");

  const tables = await allAsync(
    INIT_DB,
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_Init';`
  );
  console.log("Found tables:", tables.map((t) => t.name).join(", "));

  for (const { name: tableName } of tables) {
    const processedTable = tableName.replace("_Init", "_processed");

    const quotedTable = `"${processedTable}"`;
    const quotedSourceTable = `"${tableName}"`;
    await runAsync(HEB_PROC_DB, `DROP TABLE IF EXISTS ${quotedTable}`);

    await runAsync(
      HEB_PROC_DB,
      `CREATE TABLE IF NOT EXISTS ${quotedTable} (
        Prime INTEGER PRIMARY KEY,
        Text TEXT,
        Tags TEXT,
        Retroversions TEXT,
        QereKetiv TEXT,
        CurlyBrackets TEXT,
        AngleBrackets TEXT,
        Pluses TEXT,
        Original TEXT
      )`
    );

    const rows = await allAsync(INIT_DB, `SELECT * FROM ${quotedSourceTable}`);
    console.log(`Processing ${tableName} (${rows.length} rows)`);

    await runAsync(HEB_PROC_DB, "BEGIN TRANSACTION");

    try {
      for (const row of rows) {
        let processingText = row.Hebrew;
        let processingTags = "";
        let processingPluses = "";
        let processingRetroversion = "";
        let processingQere = "";
        let processingCurly = "";
        let processingAngle = "";

        ({ text: processingText, tags: processingTags } =
          helpers.stripAramaicTag(processingText, processingTags));

        ({
          text: processingText,
          tags: processingTags,
          angle: processingAngle,
        } = helpers.moveAngleTag(
          processingText,
          processingTags,
          processingAngle
        ));

        ({
          text: processingText,
          tags: processingTags,
          pluses: processingPluses,
        } = helpers.stripPlusesTag(
          processingText,
          processingTags,
          processingPluses
        ));

        ({ text: processingText, tags: processingTags } =
          helpers.stripQuestionTag(processingText, processingTags));

        ({ text: processingText, tags: processingTags } =
          helpers.stripCarrotsTag(processingText, processingTags));

        ({
          text: processingText,
          tags: processingTags,
          retroversion: processingRetroversion,
        } = helpers.moveRetroversionTag(
          processingText,
          processingTags,
          processingRetroversion
        ));

        ({
          text: processingText,
          tags: processingTags,
          qere: processingQere,
        } = helpers.moveQereTag(
          processingText,
          processingTags,
          processingQere
        ));

        ({
          text: processingText,
          tags: processingTags,
          curly: processingCurly,
        } = helpers.moveCurlyTag(
          processingText,
          processingTags,
          processingCurly
        ));

        ({ text: processingText } = helpers.removeWhiteSpace(processingText));

        const text = processingText || "";
        const tags = processingTags;
        const retro = processingRetroversion;
        const qere = processingQere;
        const curly = processingCurly;
        const pluses = processingPluses;
        const angle = processingAngle;
        const original = row.Hebrew || "";

        await runAsync(
          HEB_PROC_DB,
          `INSERT INTO ${quotedTable} 
           (Text, Tags, Retroversions, QereKetiv, CurlyBrackets, AngleBrackets, Pluses, Original)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [text, tags, retro, qere, curly, angle, pluses, original]
        );
      }

      await runAsync(HEB_PROC_DB, "COMMIT");
    } catch (err) {
      console.error(`Error processing ${tableName}:`, err);
      await runAsync(HEB_PROC_DB, "ROLLBACK");
    }
  }
}

//execution block:
processHebrew()
  .then(() => closeDatabases())
  .catch(async (err) => {
    console.error("Import failed:", err);
    await closeDatabases();
  });
