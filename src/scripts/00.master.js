// src/scripts/master.js
import { spawn } from "child_process";

const scripts = ["import.js", "hebrewProcess.js"];

async function runScript(script) {
  return new Promise((resolve, reject) => {
    console.log(`\nRunning ${script}...`);

    const child = spawn("node", [`src/scripts/${script}`], {
      stdio: "inherit",
    });

    child.on("error", (err) => reject(err));
    child.on("exit", (code) => {
      if (code === 0) {
        console.log(`${script} completed.`);
        resolve();
      } else {
        reject(new Error(`${script} exited with code ${code}`));
      }
    });
  });
}

async function runScriptsSequentially() {
  for (const script of scripts) {
    try {
      await runScript(script);
    } catch (err) {
      console.error(`Error running ${script}:`, err);
      break; // stop if a script fails
    }
  }
  console.log("\nAll scripts completed.");
}

runScriptsSequentially();
