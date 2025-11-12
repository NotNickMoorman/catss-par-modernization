// src/scripts/CATSSimport.js
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import * as paths from "./modules/paths.js";

// ----- CONFIG -----
const INPUT_DIR = path.join(paths.INPUT, "catss", "par");
const db = new sqlite3.Database(paths.DB);

// Helper: run SQL as promise
function runAsync(sql) {
  return new Promise((res, rej) =>
    db.run(sql, (err) => (err ? rej(err) : res()))
  );
}

// ----- MAIN -----
async function importCATSS() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error("Input folder not found:", INPUT_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith(".par.txt"));
  const zeroRowsFiles = [];

  for (const file of files) {
    const [bookNum, bookName] = file.split(".");
    const tableName = `${bookNum}_${bookName}_Init`;
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

      // Detect verse header
      if (parts.length === 1) {
        const match = parts[0].match(/^([A-Za-z0-9\/]+)\s+(\d+)(?::(\d+))?$/);
        if (match) {
          let [, book, chapter, verse] = match;

          // Dynamic single-chapter detection: only one number → treat as verse, chapter = 1
          if (!verse) {
            verse = chapter;
            chapter = "1";
          }

          const verseNum = verse || "1";
          currentVerse = `${bookNum}:${chapter}:${verseNum}`;
          continue;
        }
      }

      // Hebrew-Greek row
      if (parts.length === 2 && currentVerse) {
        const [hebrew, greek] = parts;
        rows.push({ pk, verse: currentVerse, hebrew, greek });
        pk++;
      }
    }

    if (rows.length === 0) {
      zeroRowsFiles.push(file);
    } else {
      const insert = db.prepare(
        `INSERT INTO "${tableName}" (PrimaryKey, VerseID, Hebrew, Greek) VALUES (?, ?, ?, ?)`
      );
      for (const r of rows) insert.run(r.pk, r.verse, r.hebrew, r.greek);
      insert.finalize();
      console.log(`Inserted ${rows.length} rows into ${tableName}`);
    }
  }

  db.close();

  if (zeroRowsFiles.length > 0) {
    console.warn("\nWarning: No rows were parsed from the following files:");
    zeroRowsFiles.forEach((f) => console.warn(`- ${f}`));
  }

  console.log("Import complete.");
}

// ----- EXECUTE -----
importCATSS().catch((err) => {
  console.error("Import failed:", err);
  db.close();
});
