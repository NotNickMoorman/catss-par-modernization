// src/scripts/compiledStats.js
import fs from "fs";
import sqlite3 from "sqlite3";
import * as paths from "./modules/paths.js";

const HEBREW_STAT_PATH = paths.HEBREW_STAT_DB;
const GREEK_STAT_PATH = paths.GREEK_STAT_DB;
const COMPILED_STAT_PATH = paths.COMPILED_STAT_DB;

const TAG_LIST = [
  "<001>",
  "<002>",
  "<003>",
  "<004>",
  "<005>",
  "<006>",
  "<007>",
  "<008>",
  "<009>",
  "<010>",
  "<011>",
  "<012>",
];

function closeAsync(db) {
  return new Promise((resolve) => db.close(resolve));
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))),
  );
}

async function compileStatistics() {
  const hasHebrew = fs.existsSync(HEBREW_STAT_PATH);
  const hasGreek = fs.existsSync(GREEK_STAT_PATH);

  if (!hasHebrew && !hasGreek) {
    console.log(
      "compiledStats: No Hebrew or Greek stats DB found. Skipping compile.",
    );
    return;
  }

  if (!hasHebrew) {
    console.log(
      "compiledStats: Hebrew stats DB missing. Compiling Greek-only stats.",
    );
  }

  if (!hasGreek) {
    console.log(
      "compiledStats: Greek stats DB missing. Compiling Hebrew-only stats.",
    );
  }

  // Clean target
  if (fs.existsSync(COMPILED_STAT_PATH)) {
    fs.unlinkSync(COMPILED_STAT_PATH);
  }

  const hebrewDb = hasHebrew
    ? new sqlite3.Database(HEBREW_STAT_PATH, sqlite3.OPEN_READONLY)
    : null;
  const greekDb = hasGreek
    ? new sqlite3.Database(GREEK_STAT_PATH, sqlite3.OPEN_READONLY)
    : null;
  const compiledDb = new sqlite3.Database(COMPILED_STAT_PATH);

  try {
    const columns = [
      "Book",
      "TotalRows",
      "RowsWithAnyTag",
      ...TAG_LIST.map((t) => `"${t}"`),
    ];

    await runAsync(
      compiledDb,
      `CREATE TABLE combinedStats (
        Book TEXT PRIMARY KEY,
        TotalRows INTEGER,
        RowsWithAnyTag INTEGER,
        ${TAG_LIST.map((t) => `"${t}" INTEGER`).join(", ")}
      )`,
    );

    const aggregate = new Map();

    const addRowsToAggregate = (rows) => {
      for (const row of rows) {
        if (!aggregate.has(row.Book)) {
          const seed = {
            Book: row.Book,
            TotalRows: 0,
            RowsWithAnyTag: 0,
          };
          TAG_LIST.forEach((t) => {
            seed[t] = 0;
          });
          aggregate.set(row.Book, seed);
        }

        const target = aggregate.get(row.Book);
        target.TotalRows = Math.max(target.TotalRows, row.TotalRows || 0);
        target.RowsWithAnyTag += row.RowsWithAnyTag || 0;
        TAG_LIST.forEach((t) => {
          target[t] += row[t] || 0;
        });
      }
    };

    if (hebrewDb) {
      const hebrewRows = await allAsync(hebrewDb, "SELECT * FROM hebrewStats");
      addRowsToAggregate(hebrewRows);
    }

    if (greekDb) {
      const greekRows = await allAsync(greekDb, "SELECT * FROM greekStats");
      addRowsToAggregate(greekRows);
    }

    const sortedRows = Array.from(aggregate.values()).sort((a, b) => {
      if (a.Book === "CORPUS_TOTAL" && b.Book !== "CORPUS_TOTAL") return -1;
      if (b.Book === "CORPUS_TOTAL" && a.Book !== "CORPUS_TOTAL") return 1;
      return a.Book.localeCompare(b.Book, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    for (const row of sortedRows) {
      const values = [
        row.Book,
        row.TotalRows,
        row.RowsWithAnyTag,
        ...TAG_LIST.map((t) => row[t]),
      ];
      const placeholders = values.map(() => "?").join(", ");
      await runAsync(
        compiledDb,
        `INSERT INTO combinedStats (${columns.join(", ")}) VALUES (${placeholders})`,
        values,
      );
    }

    console.log(`Compiled statistics written to ${COMPILED_STAT_PATH}`);
  } finally {
    if (hebrewDb) await closeAsync(hebrewDb);
    if (greekDb) await closeAsync(greekDb);
    await closeAsync(compiledDb);
  }
}

compileStatistics().catch((err) => {
  console.error("compiledStats failed:", err);
  process.exitCode = 1;
});
