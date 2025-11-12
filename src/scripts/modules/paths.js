import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

// Recreate __dirname / __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base directories
export const ROOT = resolve(__dirname, "..", ".."); // root/src
export const SRC = join(ROOT, "scripts"); // root/src/scripts
export const DATA = join(ROOT, "data"); // root/src/data
export const INPUT = join(DATA, "input"); // root/src/data/input
export const OUTPUT = join(DATA, "output"); // root/src/data/output
export const DB = join(DATA, "init.db"); // root/src/data/init.db
export const MODS = join(SRC, "modules"); // root/src/scripts/modules

// helpers
export const pathTo = (folder, filename = "") => join(ROOT, folder, filename);
export const SrcTo = (folder, filename = "") => join(SRC, folder, filename);

// Output log
export const LOG_PATH = join(OUTPUT, "app.log");
