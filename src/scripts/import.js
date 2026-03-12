// src/scripts/import.js
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import * as paths from "./modules/paths.js";

const INPUT_DIR = path.join(paths.INPUT, "catss", "par");
const db = new sqlite3.Database(paths.DB);
db.exec("PRAGMA journal_mode=WAL");

const zeroRowsFiles = [];
const ignoredFiles = [];
const CATSS_FILE_PATTERN = /^(\d+)\.([^.]+)\.par\.txt$/;

function allAsync(sql, params = []) {
  return new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => (err ? rej(err) : res(rows))),
  );
}

function runAsync(sql) {
  return new Promise((res, rej) =>
    db.run(sql, (err) => (err ? rej(err) : res())),
  );
}

function runStmtAsync(stmt, params = []) {
  return new Promise((res, rej) => {
    stmt.run(params, (err) => (err ? rej(err) : res()));
  });
}

function finalizeStmtAsync(stmt) {
  return new Promise((res, rej) => {
    stmt.finalize((err) => (err ? rej(err) : res()));
  });
}

async function cleanInitDatabase() {
  const objects = await allAsync(
    `SELECT type, name
     FROM sqlite_master
     WHERE name NOT LIKE 'sqlite_%'
       AND type IN ('table', 'view', 'index', 'trigger')
     ORDER BY
       CASE type
         WHEN 'view' THEN 1
         WHEN 'table' THEN 2
         WHEN 'index' THEN 3
         WHEN 'trigger' THEN 4
         ELSE 5
       END,
       name`,
  );

  if (objects.length === 0) {
    console.log("init.db already clean.");
    return;
  }

  await runAsync("BEGIN TRANSACTION");
  try {
    for (const obj of objects) {
      await runAsync(`DROP ${obj.type.toUpperCase()} IF EXISTS "${obj.name}"`);
    }
    await runAsync("COMMIT");
  } catch (err) {
    await runAsync("ROLLBACK");
    throw err;
  }

  console.log(`Cleaned init.db (${objects.length} objects dropped).`);
}

async function importCATSS() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error("Input folder not found:", INPUT_DIR);
    process.exit(1);
  }

  await cleanInitDatabase();

  const files = fs
    .readdirSync(INPUT_DIR)
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );

  const validFiles = [];
  for (const file of files) {
    const match = file.match(CATSS_FILE_PATTERN);
    if (!match) {
      if (file.endsWith(".par.txt")) ignoredFiles.push(file);
      continue;
    }
    validFiles.push({
      file,
      sourceBookNum: match[1],
      bookName: match[2],
    });
  }

  // Process sequentially to avoid table-name races and lock contention.
  for (let i = 0; i < validFiles.length; i += 1) {
    const { file, sourceBookNum, bookName } = validFiles[i];
    const dbBookNum = String(i + 1).padStart(2, "0");
    const tableName = `${dbBookNum}_${bookName}_Init`;
    console.log(`Processing ${file} → table ${tableName}`);

    await runAsync(`DROP TABLE IF EXISTS "${tableName}"`);
    await runAsync(`
      CREATE TABLE "${tableName}" (
        PrimaryKey INTEGER PRIMARY KEY,
        VerseID TEXT,
        Hebrew TEXT,
        Greek TEXT
      )
    `);

    const content = fs
      .readFileSync(path.join(INPUT_DIR, file), "utf8")
      .trim()
      .split(/\r?\n/);

    let currentVerse = "";
    const rows = [];
    let pk = 1;

    for (const line of content) {
      const parts = line
        .split(/\t+/)
        .map((x) => x.trim())
        .filter(Boolean);

      if (parts.length === 1) {
        const match = parts[0].match(/^([A-Za-z0-9\/]+)\s+(\d+)(?::(\d+))?$/);
        if (match) {
          let [, _book, chapter, verse] = match;
          if (!verse) {
            verse = chapter;
            chapter = "1";
          }
          const verseNum = verse || "1";
          currentVerse = `${sourceBookNum}:${chapter}:${verseNum}`;
          continue;
        }
      }

      if (parts.length === 2 && currentVerse) {
        const [hebrew, greek] = parts;
        rows.push({ pk, verse: currentVerse, hebrew, greek });
        pk++;
      }
    }

    if (rows.length === 0) {
      zeroRowsFiles.push(file);
      continue;
    }

    const insert = db.prepare(
      `INSERT INTO "${tableName}" (PrimaryKey, VerseID, Hebrew, Greek) VALUES (?, ?, ?, ?)`,
    );

    await runAsync("BEGIN TRANSACTION");
    try {
      for (const row of rows) {
        await runStmtAsync(insert, [row.pk, row.verse, row.hebrew, row.greek]);
      }
      await runAsync("COMMIT");
    } catch (err) {
      await runAsync("ROLLBACK");
      throw err;
    } finally {
      await finalizeStmtAsync(insert);
    }

    console.log(`Inserted ${rows.length} rows into ${tableName}`);
  }

  db.close();

  // Zero-row warnings
  if (zeroRowsFiles.length > 0) {
    console.warn("\nFiles with zero rows:");
    zeroRowsFiles.forEach((f) => console.warn(`- ${f}`));
  }

  if (ignoredFiles.length > 0) {
    console.warn("\nIgnored non-CATSS files:");
    ignoredFiles.forEach((f) => console.warn(`- ${f}`));
  }

  console.log("Import complete.");
}

// Execute
importCATSS().catch((err) => {
  console.error("Import failed:", err);
  db.close();
});
