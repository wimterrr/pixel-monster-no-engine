import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return (result.stdout || "").trim();
}

run("npm", ["run", "build:pages"]);

const changes = capture("git", ["status", "--porcelain", "--", "docs"]);
if (!changes) {
  console.log("No docs/ changes to deploy.");
  process.exit(0);
}

run("git", ["add", "docs"]);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
run("git", ["commit", "-m", `Deploy docs pages ${stamp}`]);
run("git", ["push"]);
