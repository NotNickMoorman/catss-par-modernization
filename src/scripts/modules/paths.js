// src/paths.js
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

// Recreate __dirname / __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base directories
export const ROOT = resolve(__dirname, "..");
export const SRC = join(ROOT, "src");
export const DATA = join(ROOT, "data");
export const INPUT = join(DATA, "input");
export const OUTPUT = join(DATA, "output");
export const SCRIPTS = join(SRC, "scripts");
export const MODS = join(SCRIPTS, "modules");

// helpers
export const pathTo = (folder, filename = "") => join(ROOT, folder, filename);
export const SrcTo = (folder, filename = "") => join(SRC, folder, filename);

// Output directories
export const LOG_PATH = join(OUTPUT, "app.log");
