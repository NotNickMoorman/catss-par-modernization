// src/scripts/GreekStack.js
import { spawn } from "child_process";

const scripts = [
  "greekProcess.js",
  "greekStats.js",
  "greekEncode.js",
  "GreekSubtags.js",
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

async function runGreekStack() {
  console.log("\n=== Greek Processing Stack ===");
  for (const script of scripts) {
    try {
      await runScript(script);
    } catch (err) {
      console.error(`Error in Greek Stack at ${script}:`, err);
      throw err;
    }
  }
  console.log("=== Greek Stack completed ===\n");
}

runGreekStack().catch((err) => {
  console.error("Greek Stack failed:", err);
  process.exitCode = 1;
});
