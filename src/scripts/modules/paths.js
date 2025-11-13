import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { existsSync } from "fs";

// Recreate __dirname / __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let currentDir = __dirname;

//trace-root
while (!existsSync(join(currentDir, ".traceroot"))) {
  const parent = resolve(currentDir, "..");
  if (parent === currentDir) break; // stop at filesystem root
  currentDir = parent;
}

// Base directories
export const ROOT = currentDir;
export const SRC = join(ROOT, "src"); // root/src/

export const SCRIPTS = join(SRC, "scripts"); // root/src/scripts
export const MODS = join(SCRIPTS, "modules"); // root/src/scripts/modules

export const DATA = join(SRC, "data"); // root/src/data
export const INPUT = join(DATA, "input"); // root/src/data/input
export const OUTPUT = join(DATA, "output"); // root/src/data/output

// Databases
export const DB = join(DATA, "init.db");
export const STAT_DB = join(DATA, "stat.db");

export const HEBREW_PROCESSED_DB = join(DATA, "hebrew_processed.db");
export const GREEK_PROCESSED_DB = join(DATA, "greek_processed.db");

export const HEBREW_ENCODED_DB = join(DATA, "hebrew_encoded.db");
export const GREEK_ENCODED_DB = join(DATA, "greek_encoded.db");

export const HEBREW_ALIGNED_DB = join(DATA, "hebrew_aligned.db");
export const GREEK_ALIGNED_DB = join(DATA, "greek_aligned.db");

// helpers
export const pathTo = (folder, filename = "") => join(ROOT, folder, filename);
export const srcTo = (folder, filename = "") => join(SRC, folder, filename);

// Output log
export const LOG_PATH = join(OUTPUT, "app.log");
