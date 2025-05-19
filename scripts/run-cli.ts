import { execSync } from "child_process";
import path from "path";

function showUsageAndExit() {
  console.error("Usage: yarn cli <command_type> <name_or_path> [args...]");
  console.error(
    "   or (if alias 'cli' is set up): cli <command_type> <name_or_path> [args...]",
  );
  console.error("");
  console.error("Command Types:");
  console.error(
    "  bot <bot_name> [bot_args...]        - Runs a bot (e.g., gm-bot)",
  );
  console.error(
    "  script <script_name> [script_args...] - Runs a script (e.g., generate-keys)",
  );
  console.error(
    "  test [suite_name_or_path] [options...] - Runs tests (e.g., functional)",
  );
  console.error("    Test options:");
  console.error(
    "      --max-attempts <N>  Max number of attempts for tests (default: 3)",
  );
  console.error(
    "      --retry-delay <S>   Delay in seconds between retries (default: 10)",
  );
  console.error(
    "      [vitest_options...] Other options passed directly to vitest",
  );
  console.error("");
  console.error("Examples:");
  console.error("  yarn cli bot gm-bot");
  console.error("  yarn cli bot stress 5");
  console.error("  yarn cli script generate-keys");
  console.error("  yarn cli test functional --max-attempts 2");
  console.error("  yarn cli test ./suites/automated/Gm/gm.test.ts --watch");
  process.exit(1);
}

const commandType = process.argv[2];
const nameOrPath = process.argv[3];
const additionalArgsRaw = process.argv.slice(4);

if (!commandType) {
  showUsageAndExit();
}

try {
  switch (commandType) {
    case "bot": {
      if (!nameOrPath) {
        console.error("Error: Bot name is required for 'bot' command type.");
        showUsageAndExit();
      }
      const botFilePath = path.join("bots", nameOrPath, "index.ts");
      const botArgs = additionalArgsRaw.join(" ");
      console.log(
        `Starting bot: ${nameOrPath}${botArgs ? ` with args: ${botArgs}` : ""}`,
      );
      execSync(`tsx --watch ${botFilePath} ${botArgs}`, {
        stdio: "inherit",
      });
      break;
    }

    case "script": {
      if (!nameOrPath) {
        console.error(
          "Error: Script name is required for 'script' command type.",
        );
        showUsageAndExit();
      }
      const scriptFilePath = path.join("scripts", `${nameOrPath}.ts`);
      const scriptArgs = additionalArgsRaw.join(" ");
      console.log(
        `Running script: ${nameOrPath}${scriptArgs ? ` with args: ${scriptArgs}` : ""}`,
      );
      execSync(`tsx ${scriptFilePath} ${scriptArgs}`, {
        stdio: "inherit",
      });
      break;
    }

    case "test": {
      let testName = "functional"; // Default test name
      let maxAttempts = 3;
      let retryDelay = 10; // seconds
      const vitestPassthroughArgs = [];

      let currentArgs = nameOrPath
        ? [nameOrPath, ...additionalArgsRaw]
        : [...additionalArgsRaw];

      if (currentArgs.length > 0 && !currentArgs[0].startsWith("--")) {
        const shiftedArg = currentArgs.shift();
        if (shiftedArg !== undefined) {
          testName = shiftedArg;
        }
      }

      for (let i = 0; i < currentArgs.length; i++) {
        const arg = currentArgs[i];
        const nextArg = currentArgs[i + 1];

        if (arg === "--max-attempts" && nextArg) {
          const val = parseInt(nextArg, 10);
          if (!isNaN(val) && val > 0) {
            maxAttempts = val;
          } else {
            console.warn(`Invalid value for --max-attempts: ${nextArg}`);
          }
          i++; // consume value
        } else if (arg === "--retry-delay" && nextArg) {
          const val = parseInt(nextArg, 10);
          if (!isNaN(val) && val >= 0) {
            retryDelay = val;
          } else {
            console.warn(`Invalid value for --retry-delay: ${nextArg}`);
          }
          i++; // consume value
        } else {
          vitestPassthroughArgs.push(arg);
        }
      }

      console.log(
        `Starting test suite: "${testName}" with up to ${maxAttempts} attempts, delay ${retryDelay}s.`,
      );
      const env = { ...process.env, RUST_BACKTRACE: "1" };

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`Attempt ${attempt} of ${maxAttempts}...`);
        let command;
        const vitestArgsString = vitestPassthroughArgs.join(" ");

        if (testName === "functional") {
          command = `npx vitest run ./functional/*.test.ts --pool=threads --poolOptions.singleThread=true --fileParallelism=false ${vitestArgsString}`;
        } else {
          command = `npx vitest run "${testName}" --pool=forks --fileParallelism=false ${vitestArgsString}`;
        }
        command = command.trim().replace(/\s{2,}/g, " "); // Clean up command string

        try {
          console.log(`Executing: ${command}`);
          execSync(command, { stdio: "inherit", env });
          console.log("Tests passed successfully!");
          process.exit(0); // Success
        } catch (error) {
          console.error(`Attempt ${attempt} failed.`);
          if (attempt === maxAttempts) {
            console.error(`Test failed after ${maxAttempts} attempts.`);
            process.exit(1); // Final failure
          }
          if (retryDelay > 0) {
            console.log(`Retrying in ${retryDelay} seconds...`);
            Atomics.wait(
              new Int32Array(new SharedArrayBuffer(4)),
              0,
              0,
              retryDelay * 1000,
            );
          } else {
            console.log("No retry delay, retrying immediately.");
          }
        }
      }
      break;
    }

    default: {
      console.error(`Error: Unknown command type "${commandType}"`);
      showUsageAndExit();
    }
  }
} catch (error) {
  if (error instanceof Error) {
    console.error(`Failed to run command: ${error.message}`);
  } else {
    console.error("An unexpected error occurred:", error);
  }
  process.exit(1);
}
