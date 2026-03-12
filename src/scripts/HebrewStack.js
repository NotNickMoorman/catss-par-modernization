// src/scripts/HebrewStack.js
import { spawn } from "child_process";

const scripts = [
  "hebrewProcess.js",
  "hebrewStats.js",
  "hebrewEncode.js",
  "HebrewSubtags.js",
  "compiledStats.js",
];

async function runScript(script) {
  return new Promise((resolve, reject) => {
    console.log(`  Running ${script}...`);

    const child = spawn("node", [`src/scripts/${script}`], {
      stdio: "inherit",
    });

    child.on("error", (err) => reject(err));
    child.on("exit", (code) => {
      if (code === 0) {
        console.log(`  ${script} completed.`);
        resolve();
      } else {
        reject(new Error(`${script} exited with code ${code}`));
      }
    });
  });
}

async function runHebrewStack() {
  console.log("\n=== Hebrew Processing Stack ===");
  for (const script of scripts) {
    try {
      await runScript(script);
    } catch (err) {
      console.error(`Error in Hebrew Stack at ${script}:`, err);
      throw err;
    }
  }
  console.log("=== Hebrew Stack completed ===\n");
}

runHebrewStack().catch((err) => {
  console.error("Hebrew Stack failed:", err);
  process.exitCode = 1;
});
