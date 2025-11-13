// src/scripts/generateTagStatistics.js
import sqlite3 from "sqlite3";
import * as paths from "./modules/paths.js";

const HEB_PROC_DB = new sqlite3.Database(paths.HEBREW_PROCESSED_DB);
const STAT_DB = new sqlite3.Database(
  paths.STAT_DB || `${paths.DATA}/statistics.db`
);

// Promisified helpers
function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    })
  );
}

async function generateStatistics() {
  const tagList = [
    "<001>",
    "<002>",
    "<003>",
    "<004>",
    "<005>",
    "<006>",
    "<007>",
    "<008>",
    "<009>",
  ];
  const columns = [
    "Book",
    "TotalRows",
    "RowsWithAnyTag",
    ...tagList.map((t) => `"${t}"`),
  ];
  const placeholders = columns.map(() => "?").join(", ");

  // Drop old table
  await runAsync(STAT_DB, "DROP TABLE IF EXISTS hebrewStats");

  // Create new table
  await runAsync(
    STAT_DB,
    `CREATE TABLE hebrewStats (
      Book TEXT PRIMARY KEY,
      TotalRows INTEGER,
      RowsWithAnyTag INTEGER,
      ${tagList.map((t) => `"${t}" INTEGER`).join(", ")}
    )`
  );

  // Get list of processed tables/books in order of appearance
  const tables = await allAsync(
    HEB_PROC_DB,
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_processed' ORDER BY name;"
  );

  // First pass: compute corpus totals and store per-book totals
  const corpusTotals = {
    Book: "CORPUS_TOTAL",
    TotalRows: 0,
    RowsWithAnyTag: 0,
  };
  tagList.forEach((t) => (corpusTotals[t] = 0));

  const bookTotalsList = [];

  for (const { name: tableName } of tables) {
    const rows = await allAsync(HEB_PROC_DB, `SELECT * FROM "${tableName}"`);

    const totals = {
      Book: tableName.replace("_processed", ""),
      TotalRows: rows.length,
      RowsWithAnyTag: 0,
    };
    tagList.forEach((t) => (totals[t] = 0));

    for (const row of rows) {
      const tags = row.Tags || "";
      if (tags.length) totals.RowsWithAnyTag += 1;

      tagList.forEach((t) => {
        if (tags.includes(t)) totals[t] += 1;
      });
    }

    // Accumulate corpus totals
    corpusTotals.TotalRows += totals.TotalRows;
    corpusTotals.RowsWithAnyTag += totals.RowsWithAnyTag;
    tagList.forEach((t) => (corpusTotals[t] += totals[t]));

    bookTotalsList.push(totals);
  }

  // Insert corpus-wide total first
  const corpusValues = [
    corpusTotals.Book,
    corpusTotals.TotalRows,
    corpusTotals.RowsWithAnyTag,
    ...tagList.map((t) => corpusTotals[t]),
  ];
  await runAsync(
    STAT_DB,
    `INSERT INTO hebrewStats (${columns.join(", ")}) VALUES (${placeholders})`,
    corpusValues
  );

  // Insert per-book rows in order
  for (const totals of bookTotalsList) {
    const values = [
      totals.Book,
      totals.TotalRows,
      totals.RowsWithAnyTag,
      ...tagList.map((t) => totals[t]),
    ];
    await runAsync(
      STAT_DB,
      `INSERT INTO hebrewStats (${columns.join(
        ", "
      )}) VALUES (${placeholders})`,
      values
    );
  }

  console.log(
    "Statistics generated successfully, corpus-wide total inserted first."
  );

  HEB_PROC_DB.close();
  STAT_DB.close();
}

generateStatistics().catch(console.error);
