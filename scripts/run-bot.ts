import { execSync } from "child_process";

const botName = process.argv[2];
// Get all arguments after the bot name and join them
const additionalArgs = process.argv.slice(3).join(" ");

if (!botName) {
  console.error("Please provide a bot name");
  console.log("Usage: yarn bot <botname> [args]");
  console.log("Example: yarn bot stress 5");
  process.exit(1);
}

try {
  execSync(`tsx --watch bots/${botName}/index.ts ${additionalArgs}`, {
    stdio: "inherit",
  });
} catch (error) {
  console.error(`Error: Bot "${botName}" not found or failed to start`);
  process.exit(1);
}
