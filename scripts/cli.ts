import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getTime } from "@helpers/logger";

function expandGlobPattern(pattern: string): string[] {
  // Simple glob expansion for *.test.ts patterns
  if (pattern.includes("*")) {
    const dir = path.dirname(pattern);
    const baseName = path.basename(pattern);

    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir);
    const regex = new RegExp(baseName.replace(/\*/g, ".*"));

    return files
      .filter((file) => regex.test(file))
      .map((file) => path.join(dir, file));
  }

  return [pattern];
}

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
    "  script <script_name> [script_args...] - Runs a script (e.g., gen)",
  );
  console.error(
    "  retry [suite_name_or_path] [options...] - Runs tests (e.g., functional)",
  );
  console.error("    Test options:");
  console.error(
    "      --max-attempts <N>  Max number of attempts for tests (default: 3)",
  );
  console.error(
    "      --retry-delay <S>   Delay in seconds between retries (default: 10)",
  );
  console.error(
    "      --log / --no-log    Enable/disable logging to file (default: enabled)",
  );
  console.error(
    "      --log-file <name>   Custom log file name (default: auto-generated)",
  );
  console.error(
    "      [vitest_options...] Other options passed directly to vitest",
  );
  console.error("");
  console.error("Examples:");
  console.error("  yarn cli bot gm-bot");
  console.error("  yarn cli bot stress 5");
  console.error("  yarn cli script gen");
  console.error("  yarn retry functional --max-attempts 2");
  console.error("  yarn retry ./suites/automated/Gm/gm.test.ts --watch");
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

    case "retry": {
      let testName = "functional"; // Default test name
      let maxAttempts = 1;
      let loggingLevel = "debug";
      let retryDelay = 10; // seconds
      let enableLogging = true;
      let customLogFile: string | undefined;
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
        } else if (arg === "--log") {
          enableLogging = true;
        } else if (arg === "--no-log") {
          enableLogging = false;
        } else if (arg === "--log-file" && nextArg) {
          customLogFile = nextArg;
          i++; // consume value
        } else {
          vitestPassthroughArgs.push(arg);
        }
      }

      // Setup logging
      let logStream: fs.WriteStream | undefined;
      if (enableLogging) {
        // Ensure logs directory exists
        const logsDir = "logs";
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }

        // Extract clean test name for log file (remove path and extension)
        let logFileName: string;
        if (customLogFile) {
          logFileName = customLogFile;
        } else {
          const cleanTestName = path
            .basename(testName)
            .replace(/\.test\.ts$/, "");
          logFileName = `raw-${cleanTestName}-${getTime()}.log`;
        }
        const logPath = path.join(logsDir, logFileName);

        logStream = fs.createWriteStream(logPath, { flags: "w" });
        console.log(`Logging to: ${logPath}`);
      }

      // Filter patterns to exclude from output
      const FILTER_PATTERNS = [
        /ERROR MEMORY sqlcipher_mlock: mlock\(\) returned -1 errno=12/,
      ];

      function filterOutput(data: string): string {
        let filtered = data;
        for (const pattern of FILTER_PATTERNS) {
          filtered = filtered.replace(new RegExp(pattern.source, "g"), "");
        }
        return filtered;
      }

      function runCommand(
        command: string,
        env: Record<string, string>,
      ): Promise<number> {
        return new Promise((resolve) => {
          // Use shell to handle glob patterns properly
          const child = spawn(command, {
            env,
            stdio: ["pipe", "pipe", "pipe"],
            shell: true,
          });

          const processOutput = (data: Buffer, isError = false) => {
            const text = data.toString();
            const filtered = filterOutput(text);

            if (filtered.trim()) {
              // Write to console
              if (isError) {
                process.stderr.write(filtered);
              } else {
                process.stdout.write(filtered);
              }

              // Write to log file if enabled
              if (logStream) {
                logStream.write(filtered);
              }
            }
          };

          child.stdout?.on("data", (data: Buffer) => {
            processOutput(data, false);
          });
          child.stderr?.on("data", (data: Buffer) => {
            processOutput(data, true);
          });

          child.on("close", (code) => {
            resolve(code || 0);
          });

          child.on("error", (error) => {
            console.error(`Failed to start command: ${error.message}`);
            resolve(1);
          });
        });
      }

      console.log(
        `Starting test suite: "${testName}" with up to ${maxAttempts} attempts, delay ${retryDelay}s.`,
      );
      const env = {
        ...process.env,
        RUST_BACKTRACE: "1",
        LOGGING_LEVEL: loggingLevel,
      };

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`Attempt ${attempt} of ${maxAttempts}...`);
        let command;
        const vitestArgsString = vitestPassthroughArgs.join(" ");

        if (testName === "functional") {
          // Expand glob pattern for functional tests
          const expandedFiles = expandGlobPattern("./functional/*.test.ts");
          if (expandedFiles.length === 0) {
            console.error("No functional test files found");
            throw new Error("No test files found");
          }
          command = `npx vitest run ${expandedFiles.join(" ")} --pool=threads --poolOptions.singleThread=true --fileParallelism=false ${vitestArgsString}`;
        } else {
          // Check if there's a corresponding npm script
          const packageJsonPath = path.join(process.cwd(), "package.json");
          let useNpmScript = false;
          let packageJsonScript = "";
          try {
            const packageJson = JSON.parse(
              fs.readFileSync(packageJsonPath, "utf8"),
            );
            if (packageJson.scripts && packageJson.scripts[testName]) {
              useNpmScript = true;
              packageJsonScript = packageJson.scripts[testName];
            }
          } catch (error) {
            console.error(`Error reading package.json`, error);
          }

          if (useNpmScript) {
            // Parse the script to expand any glob patterns
            if (packageJsonScript.includes("*.test.ts")) {
              // Extract the glob pattern from the script
              const globMatch = packageJsonScript.match(/([^\s]+\*\.test\.ts)/);
              if (globMatch) {
                const globPattern = globMatch[1];
                const expandedFiles = expandGlobPattern(globPattern);
                if (expandedFiles.length === 0) {
                  console.error(
                    `No test files found for pattern: ${globPattern}`,
                  );
                  throw new Error("No test files found");
                }
                // Replace the glob pattern with expanded files
                command =
                  packageJsonScript.replace(
                    globPattern,
                    expandedFiles.join(" "),
                  ) + ` ${vitestArgsString}`;
              } else {
                command = `yarn ${testName} ${vitestArgsString}`;
              }
            } else {
              command = `yarn ${testName} ${vitestArgsString}`;
            }
          } else {
            command = `npx vitest run ${testName} --pool=forks --fileParallelism=false ${vitestArgsString}`;
          }
        }
        command = command.trim().replace(/\s{2,}/g, " "); // Clean up command string

        try {
          console.log(`Executing: ${command}`);
          const exitCode = await runCommand(command, env);

          if (exitCode === 0) {
            console.log("Tests passed successfully!");
            if (logStream) {
              logStream.end();
            }
            process.exit(0); // Success
          } else {
            throw new Error(`Command exited with code ${exitCode}`);
          }
        } catch (error) {
          console.error(`Attempt ${attempt} failed.`, error);
          if (attempt === maxAttempts) {
            console.error(`Test failed after ${maxAttempts} attempts.`);
            if (logStream) {
              logStream.end();
            }
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
