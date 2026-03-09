import fs from "fs";
import path from "path";

type LocalMetricRecord = {
  timestamp: string;
  metric: string;
  value: number;
  tags: Record<string, string>;
  source: string;
};

type SummaryOptions = {
  file: string;
  metricFamily: string;
  envFilter: Set<string> | null;
  compareLeftEnv: string;
  compareRightEnv: string;
};

type FunctionStats = {
  durations: number[];
  success: number;
  error: number;
};

type SetupStats = {
  success: number;
  error: number;
};

type FunctionSummary = {
  env: string;
  members: string;
  operation: string;
  sampleCount: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  success: number;
  error: number;
  failureRatePct: number;
};

type SetupSummary = {
  env: string;
  members: string;
  success: number;
  error: number;
  failureRatePct: number;
};

type BuiltSummaries = {
  functionSummaries: FunctionSummary[];
  setupSummaries: SetupSummary[];
};

const DURATION_METRIC = "xmtp.sdk.duration";
const OPERATION_COUNT_METRIC = "xmtp.sdk.operation_count";
const SETUP_OPERATION = "setupContext";
const SETUP_OPERATION_NAME = "group.setup_context";

function parseArgs(args: string[]): SummaryOptions {
  let file = path.join(process.cwd(), "logs", "local-metrics.ndjson");
  let metricFamily = "group_stats_v1";
  let envFilter: Set<string> | null = null;
  let compareLeftEnv = "testnet-staging";
  let compareRightEnv = "testnet-dev";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--file":
        if (nextArg) {
          file = path.isAbsolute(nextArg)
            ? nextArg
            : path.join(process.cwd(), nextArg);
          i++;
        }
        break;
      case "--metric-family":
        if (nextArg) {
          metricFamily = nextArg;
          i++;
        }
        break;
      case "--env":
        if (nextArg) {
          envFilter = new Set(
            nextArg
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          );
          i++;
        }
        break;
      case "--compare-left":
        if (nextArg) {
          compareLeftEnv = nextArg.trim();
          i++;
        }
        break;
      case "--compare-right":
        if (nextArg) {
          compareRightEnv = nextArg.trim();
          i++;
        }
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        break;
    }
  }

  return {
    file,
    metricFamily,
    envFilter,
    compareLeftEnv,
    compareRightEnv,
  };
}

function printHelp(): void {
  console.log(`
Local Metrics Summary CLI

USAGE:
  yarn metrics:summary [options]
  yarn metrics:status [options]

OPTIONS:
  --file <path>           Path to local metrics NDJSON file
                          [default: logs/local-metrics.ndjson]
  --metric-family <name>  Filter metrics by metric_family tag
                          [default: group_stats_v1]
  --env <list>            Comma-separated env filter (e.g., testnet-staging,testnet-dev)
  --compare-left <env>    Left side env for comparison [default: testnet-staging]
  --compare-right <env>   Right side env for comparison [default: testnet-dev]
  -h, --help              Show this help message
`);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function functionKey(env: string, members: string, operation: string): string {
  return `${env}|${members}|${operation}`;
}

function setupKey(env: string, members: string): string {
  return `${env}|${members}`;
}

function parseFunctionKey(key: string): {
  env: string;
  members: string;
  operation: string;
} {
  const [env = "unknown", members = "unknown", operation = "unknown"] =
    key.split("|");
  return { env, members, operation };
}

function parseSetupKey(key: string): { env: string; members: string } {
  const [env = "unknown", members = "unknown"] = key.split("|");
  return { env, members };
}

function compareMembers(a: string, b: string): number {
  const aNum = Number(a);
  const bNum = Number(b);
  const aIsNum = Number.isFinite(aNum);
  const bIsNum = Number.isFinite(bNum);

  if (aIsNum && bIsNum) {
    return aNum - bNum;
  }

  if (aIsNum) return -1;
  if (bIsNum) return 1;
  return a.localeCompare(b);
}

function parseRecords(file: string): LocalMetricRecord[] {
  if (!fs.existsSync(file)) {
    throw new Error(`Metrics file not found: ${file}`);
  }

  const content = fs.readFileSync(file, "utf8");
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const records: LocalMetricRecord[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as LocalMetricRecord;
      records.push(parsed);
    } catch {
      // Ignore malformed lines so partial writes do not break summaries.
    }
  }

  return records;
}

function ensureFunctionStats(
  statsMap: Map<string, FunctionStats>,
  key: string,
): FunctionStats {
  const existing = statsMap.get(key);
  if (existing) {
    return existing;
  }

  const created: FunctionStats = { durations: [], success: 0, error: 0 };
  statsMap.set(key, created);
  return created;
}

function ensureSetupStats(
  statsMap: Map<string, SetupStats>,
  key: string,
): SetupStats {
  const existing = statsMap.get(key);
  if (existing) {
    return existing;
  }

  const created: SetupStats = { success: 0, error: 0 };
  statsMap.set(key, created);
  return created;
}

function isSetupMetric(tags: Record<string, string>): boolean {
  const operation = tags.operation || "";
  const operationName = tags.operation_name || "";
  return (
    operation === SETUP_OPERATION || operationName === SETUP_OPERATION_NAME
  );
}

function buildSummaries(
  records: LocalMetricRecord[],
  options: SummaryOptions,
): BuiltSummaries {
  const functionStatsMap = new Map<string, FunctionStats>();
  const setupStatsMap = new Map<string, SetupStats>();

  for (const record of records) {
    const tags = record.tags || {};
    if (tags.metric_family !== options.metricFamily) {
      continue;
    }

    const env = tags.env || "unknown";
    if (options.envFilter && !options.envFilter.has(env)) {
      continue;
    }

    const members = tags.members || "unknown";
    const operation = tags.operation || tags.operation_name || "unknown";
    const setupMetric = isSetupMetric(tags);

    if (record.metric === OPERATION_COUNT_METRIC) {
      if (setupMetric) {
        const setup = ensureSetupStats(setupStatsMap, setupKey(env, members));
        if (tags.status === "success") {
          setup.success += record.value;
        } else if (tags.status === "error") {
          setup.error += record.value;
        }
        continue;
      }

      const stats = ensureFunctionStats(
        functionStatsMap,
        functionKey(env, members, operation),
      );
      if (tags.status === "success") {
        stats.success += record.value;
      } else if (tags.status === "error") {
        stats.error += record.value;
      }
      continue;
    }

    if (
      record.metric === DURATION_METRIC &&
      tags.metric_type === "operation" &&
      !setupMetric
    ) {
      const stats = ensureFunctionStats(
        functionStatsMap,
        functionKey(env, members, operation),
      );
      stats.durations.push(record.value);
    }
  }

  const functionSummaries: FunctionSummary[] = [];
  for (const [key, stats] of functionStatsMap.entries()) {
    const { env, members, operation } = parseFunctionKey(key);
    const denominator = stats.success + stats.error;
    const failureRatePct =
      denominator === 0 ? 0 : (100 * stats.error) / (denominator + 0.000001);

    functionSummaries.push({
      env,
      members,
      operation,
      sampleCount: stats.durations.length,
      avgMs: average(stats.durations),
      p50Ms: percentile(stats.durations, 0.5),
      p95Ms: percentile(stats.durations, 0.95),
      success: stats.success,
      error: stats.error,
      failureRatePct,
    });
  }

  const setupSummaries: SetupSummary[] = [];
  for (const [key, stats] of setupStatsMap.entries()) {
    const { env, members } = parseSetupKey(key);
    const denominator = stats.success + stats.error;
    const failureRatePct =
      denominator === 0 ? 0 : (100 * stats.error) / (denominator + 0.000001);

    setupSummaries.push({
      env,
      members,
      success: stats.success,
      error: stats.error,
      failureRatePct,
    });
  }

  functionSummaries.sort((a, b) => {
    if (a.env !== b.env) return a.env.localeCompare(b.env);
    if (a.operation !== b.operation) {
      return a.operation.localeCompare(b.operation);
    }
    return compareMembers(a.members, b.members);
  });

  setupSummaries.sort((a, b) => {
    if (a.env !== b.env) return a.env.localeCompare(b.env);
    return compareMembers(a.members, b.members);
  });

  return { functionSummaries, setupSummaries };
}

function formatNumber(value: number, precision = 1): string {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(precision);
}

function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log("(no rows)");
    return;
  }

  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => (row[i] || "").length)),
  );

  const formatRow = (row: string[]) =>
    row.map((cell, i) => cell.padEnd(widths[i], " ")).join("  ");

  console.log(formatRow(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) {
    console.log(formatRow(row));
  }
}

function printSetupSection(setupSummaries: SetupSummary[]): void {
  console.log("\nSetup Context Status (by env + size)");
  const rows = setupSummaries.map((s) => [
    s.env,
    s.members,
    formatNumber(s.success, 0),
    formatNumber(s.error, 0),
    formatNumber(s.failureRatePct, 2),
    formatNumber(s.success + s.error, 0),
  ]);

  printTable(
    [
      "env",
      "members",
      "setup_success",
      "setup_error",
      "setup_fail_pct",
      "total",
    ],
    rows,
  );
}

function printFunctionSection(functionSummaries: FunctionSummary[]): void {
  console.log("\nFunction Stats (setup-excluded)");
  const rows = functionSummaries.map((s) => [
    s.env,
    s.members,
    s.operation,
    String(s.sampleCount),
    formatNumber(s.avgMs),
    formatNumber(s.p50Ms),
    formatNumber(s.p95Ms),
    formatNumber(s.success, 0),
    formatNumber(s.error, 0),
    formatNumber(s.failureRatePct, 2),
  ]);

  printTable(
    [
      "env",
      "members",
      "operation",
      "samples",
      "avg_ms",
      "p50_ms",
      "p95_ms",
      "success",
      "error",
      "failure_pct",
    ],
    rows,
  );
}

function printComparisonSection(
  functionSummaries: FunctionSummary[],
  setupSummaries: SetupSummary[],
  options: SummaryOptions,
): void {
  const functionByKey = new Map<string, FunctionSummary>();
  for (const summary of functionSummaries) {
    functionByKey.set(
      functionKey(summary.env, summary.members, summary.operation),
      summary,
    );
  }

  const setupByKey = new Map<string, SetupSummary>();
  for (const setup of setupSummaries) {
    setupByKey.set(setupKey(setup.env, setup.members), setup);
  }

  const operationMemberPairs = Array.from(
    new Set(functionSummaries.map((s) => `${s.operation}|${s.members}`)),
  );
  operationMemberPairs.sort((a, b) => {
    const [opA = "", membersA = ""] = a.split("|");
    const [opB = "", membersB = ""] = b.split("|");
    if (opA !== opB) return opA.localeCompare(opB);
    return compareMembers(membersA, membersB);
  });

  console.log(
    `\nFunction Comparison (${options.compareLeftEnv} vs ${options.compareRightEnv})`,
  );
  const rows: string[][] = [];

  for (const pair of operationMemberPairs) {
    const [operation = "", members = ""] = pair.split("|");
    const left = functionByKey.get(
      functionKey(options.compareLeftEnv, members, operation),
    );
    const right = functionByKey.get(
      functionKey(options.compareRightEnv, members, operation),
    );
    const setupLeft = setupByKey.get(setupKey(options.compareLeftEnv, members));
    const setupRight = setupByKey.get(
      setupKey(options.compareRightEnv, members),
    );

    const avgLeft = left?.avgMs ?? 0;
    const avgRight = right?.avgMs ?? 0;
    const p95Left = left?.p95Ms ?? 0;
    const p95Right = right?.p95Ms ?? 0;
    const failLeft = left?.failureRatePct ?? 0;
    const failRight = right?.failureRatePct ?? 0;

    rows.push([
      operation,
      members,
      formatNumber(avgLeft),
      formatNumber(avgRight),
      formatNumber(avgRight - avgLeft),
      formatNumber(p95Left),
      formatNumber(p95Right),
      formatNumber(p95Right - p95Left),
      formatNumber(failLeft, 2),
      formatNumber(failRight, 2),
      formatNumber(failRight - failLeft, 2),
      String(left?.sampleCount ?? 0),
      String(right?.sampleCount ?? 0),
      formatNumber(setupLeft?.failureRatePct ?? 0, 2),
      formatNumber(setupRight?.failureRatePct ?? 0, 2),
    ]);
  }

  printTable(
    [
      "operation",
      "members",
      "avg_left",
      "avg_right",
      "avg_diff",
      "p95_left",
      "p95_right",
      "p95_diff",
      "fail_left",
      "fail_right",
      "fail_diff",
      "samples_left",
      "samples_right",
      "setup_fail_left",
      "setup_fail_right",
    ],
    rows,
  );
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const records = parseRecords(options.file);
  const { functionSummaries, setupSummaries } = buildSummaries(
    records,
    options,
  );

  console.log(`Source: ${options.file}`);
  console.log(`Metric family: ${options.metricFamily}`);
  console.log(`Parsed records: ${records.length}`);
  console.log(`Function rows: ${functionSummaries.length}`);
  console.log(`Setup rows: ${setupSummaries.length}`);
  console.log(
    `Comparison envs: ${options.compareLeftEnv} vs ${options.compareRightEnv}`,
  );

  if (functionSummaries.length === 0 && setupSummaries.length === 0) {
    console.log(
      "No summary rows found. Check --metric-family/--env filters and test command flags.",
    );
    return;
  }

  printSetupSection(setupSummaries);
  printFunctionSection(functionSummaries);
  printComparisonSection(functionSummaries, setupSummaries, options);
}

main();
