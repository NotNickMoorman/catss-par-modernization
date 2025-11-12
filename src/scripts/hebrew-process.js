// src/scripts/hebrew-process.js
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import * as paths from "./modules/paths.js";

//paths
const INIT_DB = paths.DB;
const HEB_PROC_DB = new sqlite3.Database(paths.HEBREW_PROCESSED_DB);

//path logging
console.log("init.db:", INIT_DB);
console.log("hebrew_processed.db:", HEB_PROC_DB);

//config
//HEB_PROC_DB.exec("PRAGMA journal_mode=WAL");

//helper functions
function writeTags() {}
function deDuplicateTags() {}

function stripAramaicTag() {}
function stripDashTag() {}
function stripQuestionTag() {}
function stripCarrots() {}

function stripRetroversion() {}

function stripQere() {}
function stripCurly() {}

function removeWhitespace() {}
function writeHebrew() {}

//main function
async function processHebrew() {
  console.log("function");
}

//execution
processHebrew().catch((err) => {
  console.error("Import failed:", err);
  db.close();
});
