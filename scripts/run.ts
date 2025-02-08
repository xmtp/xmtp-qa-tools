import { spawn } from "child_process";
import path from "path";

const type = process.argv[2]; // 'example' or 'script'
const name = process.argv[3];

if (!type || !name) {
  console.error("Usage: yarn run:ts <type> <name>");
  console.error("Example: yarn run:ts example gm");
  process.exit(1);
}

if (type !== "examples" && type !== "scripts") {
  console.error('Type must be either "examples" or "scripts"');
  process.exit(1);
}

const filePath =
  type === "examples"
    ? path.join("examples", name, "index.ts")
    : path.join("scripts", `${name}.ts`);

try {
  spawn("tsx", ["--env-file=.env", filePath], { stdio: "inherit" });
} catch (error) {
  console.error(`Failed to run ${type} "${name}":`, error);
  process.exit(1);
}
