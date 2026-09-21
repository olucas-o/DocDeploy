import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const action = process.argv[2];
const commands = {
  compile: ["-m", "compileall", "-q", "."],
  test: ["-m", "pytest", "tests"],
  contract: ["-m", "pytest", "tests", "-m", "contract"],
};

if (!(action in commands)) {
  console.error("Usage: node tools/run-worker-check.mjs <compile|test|contract>");
  process.exit(2);
}

const virtual_environment_pythons = process.platform === "win32"
  ? [
      join(".venv", "Scripts", "python.exe"),
      join("worker", ".venv", "Scripts", "python.exe"),
    ]
  : [join(".venv", "bin", "python"), join("worker", ".venv", "bin", "python")];
const virtual_environment_python = virtual_environment_pythons.find(existsSync);
const python = virtual_environment_python
  ? resolve(virtual_environment_python)
  : process.platform === "win32" ? "python.exe" : "python3";
const result = spawnSync(python, commands[action], {
  cwd: "worker",
  stdio: "inherit",
});

if (result.error) {
  console.error(`Unable to run ${python}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
