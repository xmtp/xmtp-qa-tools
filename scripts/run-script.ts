import { execSync } from "child_process";

const scriptName = process.argv[2];

if (!scriptName) {
  console.error("Please provide a script name");
  console.log("Usage: yarn script <scriptname>");
  process.exit(1);
}

try {
  execSync(`tsx scripts/${scriptName}.ts`, { stdio: "inherit" });
} catch (error) {
  console.error(error);
  console.error(`Error: Script "${scriptName}" not found or failed to start`);
  process.exit(1);
}
