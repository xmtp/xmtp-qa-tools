import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface SimpleTestOptions {
  testName: string;
  vitestArgs: string[];
  versions?: string;
}

function showUsageAndExit(): never {
  console.error("Usage: yarn cli <command_type> <name_or_path> [args...]");
  console.error("");
  console.error("Command Types:");
  console.error("  bot <bot_name> [bot_args...]        - Runs a bot");
  console.error("  script <script_name> [script_args...] - Runs a script");
  console.error("  test <test_name> [options...]      - Runs tests");
  console.error("");
  console.error("Test Options:");
  console.error("  --versions <N>   Use N random SDK versions");
  console.error("");
  console.error("Examples:");
  console.error("  yarn cli test functional");
  console.error("  yarn cli test dms --versions 3");
  console.error("  yarn cli bot gm-bot");
  console.error("  yarn cli script gen");
  process.exit(1);
}

function runBot(botName: string, args: string[]): void {
  const botFilePath = path.join("bots", botName, "index.ts");
  const botArgs = args.join(" ");
  console.log(
    `Starting bot: ${botName}${botArgs ? ` with args: ${botArgs}` : ""}`,
  );
  execSync(`tsx --watch ${botFilePath} ${botArgs}`, {
    stdio: "inherit",
  });
}

function runScript(scriptName: string, args: string[]): void {
  const scriptFilePath = path.join("scripts", `${scriptName}.ts`);
  const scriptArgs = args.join(" ");
  console.log(
    `Running script: ${scriptName}${scriptArgs ? ` with args: ${scriptArgs}` : ""}`,
  );
  execSync(`tsx ${scriptFilePath} ${scriptArgs}`, {
    stdio: "inherit",
  });
}

function parseTestArgs(args: string[]): SimpleTestOptions {
  let testName = "functional";
  const options: SimpleTestOptions = {
    testName,
    vitestArgs: [],
  };

  let currentArgs = [...args];
  if (currentArgs.length > 0 && !currentArgs[0].startsWith("--")) {
    const shiftedArg = currentArgs.shift();
    testName = shiftedArg || "functional";
    options.testName = testName;
  }

  for (let i = 0; i < currentArgs.length; i++) {
    const arg = currentArgs[i];
    const nextArg = currentArgs[i + 1];

    switch (arg) {
      case "--versions":
        if (nextArg && !isNaN(parseInt(nextArg))) {
          options.versions = nextArg;
          i++;
        } else {
          console.warn("--versions flag requires a number");
        }
        break;
      default:
        options.vitestArgs.push(arg);
    }
  }

  return options;
}

function buildTestCommand(testName: string, vitestArgs: string[]): string {
  const vitestArgsString = vitestArgs.join(" ");

  // Check for npm script first
  const packageJsonPath = path.join(process.cwd(), "package.json");
  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent) as {
      scripts?: Record<string, string>;
    };

    if (packageJson.scripts?.[testName]) {
      return `yarn ${testName} ${vitestArgsString}`.trim();
    }
  } catch {
    console.warn("Could not read package.json");
  }

  // Default to direct vitest execution
  if (testName === "functional") {
    return `npx vitest run ./suites/functional/*.test.ts ${vitestArgsString}`.trim();
  }

  return `npx vitest run ${testName} ${vitestArgsString}`.trim();
}

function runTest(options: SimpleTestOptions): void {
  console.log(`Running test suite: ${options.testName}`);

  const env: Record<string, string> = {
    ...process.env,
    RUST_BACKTRACE: "1",
  };

  // Set versions environment variable if specified
  if (options.versions) {
    env.TEST_VERSIONS = options.versions;
    console.log(`Using ${options.versions} random SDK versions`);
  }

  const command = buildTestCommand(options.testName, options.vitestArgs);
  console.log(`Executing: ${command}`);

  try {
    execSync(command, {
      env,
      stdio: "inherit",
    });
    console.log("✅ Tests completed successfully!");
  } catch {
    console.error("❌ Tests failed!");
    process.exit(1);
  }
}

function main(): void {
  const [commandType, nameOrPath, ...additionalArgs] = process.argv.slice(2);

  if (!commandType) {
    showUsageAndExit();
  }

  switch (commandType) {
    case "bot": {
      if (!nameOrPath) {
        console.error("Bot name is required for 'bot' command type.");
        showUsageAndExit();
      }
      runBot(nameOrPath, additionalArgs);
      break;
    }

    case "script": {
      if (!nameOrPath) {
        console.error("Script name is required for 'script' command type.");
        showUsageAndExit();
      }
      runScript(nameOrPath, additionalArgs);
      break;
    }

    case "test": {
      const allArgs = nameOrPath
        ? [nameOrPath, ...additionalArgs]
        : additionalArgs;

      const options = parseTestArgs(allArgs);
      runTest(options);
      break;
    }

    default: {
      console.error(`Unknown command type: ${commandType}`);
      showUsageAndExit();
    }
  }
}

main();
