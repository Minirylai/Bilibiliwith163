import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import caxa from "@appthreat/caxa";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const stageDir = path.join(distDir, "caxa-input");
const output = path.join(distDir, "bilibiliwith163-caxa.exe");
const metadataFile = "bilibiliwith163-caxa-metadata.json";

const dirs = ["src", "public", "pic", "scripts"];
const files = ["package.json", "package-lock.json", ".env.example"];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === "win32" && command === "npm" ? "cmd.exe" : command;
    const finalArgs = process.platform === "win32" && command === "npm" ? ["/d", "/s", "/c", "npm", ...args] : args;
    const child = spawn(executable, finalArgs, {
      cwd: options.cwd || root,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function copyRuntimeTree() {
  await fs.rm(stageDir, { force: true, recursive: true });
  await fs.mkdir(stageDir, { recursive: true });

  for (const dir of dirs) {
    await fs.cp(path.join(root, dir), path.join(stageDir, dir), {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}.cache${path.sep}`),
    });
  }

  for (const file of files) {
    await fs.copyFile(path.join(root, file), path.join(stageDir, file));
  }
}

await fs.mkdir(distDir, { recursive: true });
await copyRuntimeTree();
await run("npm", ["ci", "--omit=dev", "--ignore-scripts"], { cwd: stageDir });

await caxa({
  command: ["{{caxa}}/node_modules/.bin/node", "{{caxa}}/scripts/caxa-entry.js"],
  exclude: ["**/.cache/**", "**/.env", "**/*.log"],
  input: stageDir,
  metadataFile,
  output,
});

console.log(`Created ${output}`);
