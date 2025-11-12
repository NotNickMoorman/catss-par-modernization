// src/scripts/CATSSimport.js
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import * as paths from "./modules/paths.js";

const INPUT_DIR = path.join(paths.INPUT, "catss", "par");
const db = new sqlite3.Database(paths.DB);
db.exec("PRAGMA journal_mode=WAL");

const zeroRowsFiles = [];

function runAsync(sql) {
  return new Promise((res, rej) =>
    db.run(sql, (err) => (err ? rej(err) : res()))
  );
}

async function importCATSS() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error("Input folder not found:", INPUT_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith(".par.txt"));
  const tablePromises = [];

  for (const file of files) {
    const promise = (async () => {
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

        if (parts.length === 1) {
          const match = parts[0].match(/^([A-Za-z0-9\/]+)\s+(\d+)(?::(\d+))?$/);
          if (match) {
            let [, book, chapter, verse] = match;
            if (!verse) {
              verse = chapter;
              chapter = "1";
            }
            const verseNum = verse || "1";
            currentVerse = `${bookNum}:${chapter}:${verseNum}`;
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
      } else {
        // Wrap inserts in Promises and await all to ensure completion
        const insert = db.prepare(
          `INSERT INTO "${tableName}" (PrimaryKey, VerseID, Hebrew, Greek) VALUES (?, ?, ?, ?)`
        );
        const insertPromises = rows.map(
          (r) =>
            new Promise((res, rej) => {
              insert.run(r.pk, r.verse, r.hebrew, r.greek, (err) =>
                err ? rej(err) : res()
              );
            })
        );
        await Promise.all(insertPromises);
        insert.finalize();

        console.log(`Inserted ${rows.length} rows into ${tableName}`);
      }
    })();

    tablePromises.push(promise);
  }

  // Wait until all table processing Promises are resolved
  await Promise.all(tablePromises);

  db.close();

  // Zero-row warnings
  if (zeroRowsFiles.length > 0) {
    console.warn("\nFiles with zero rows:");
    zeroRowsFiles.forEach((f) => console.warn(`- ${f}`));
  }

  console.log("Import complete.");
}

// Execute
importCATSS().catch((err) => {
  console.error("Import failed:", err);
  db.close();
});
