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
};

type OperationStats = {
  durations: number[];
  success: number;
  error: number;
};

type OperationSummary = {
  env: string;
  operation: string;
  sampleCount: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  success: number;
  error: number;
  failureRatePct: number;
};

function parseArgs(args: string[]): SummaryOptions {
  let file = path.join(process.cwd(), "logs", "local-metrics.ndjson");
  let metricFamily = "group_stats_v1";
  let envFilter: Set<string> | null = null;

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
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        break;
    }
  }

  return { file, metricFamily, envFilter };
}

function printHelp(): void {
  console.log(`
Local Metrics Summary CLI

USAGE:
  yarn metrics:summary [options]

OPTIONS:
  --file <path>           Path to local metrics NDJSON file
                          [default: logs/local-metrics.ndjson]
  --metric-family <name>  Filter metrics by metric_family tag
                          [default: group_stats_v1]
  --env <list>            Comma-separated env filter (e.g., dev,testnet-staging)
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

function keyFor(env: string, operation: string): string {
  return `${env}__${operation}`;
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

function toSummaries(
  records: LocalMetricRecord[],
  options: SummaryOptions,
): OperationSummary[] {
  const statsMap = new Map<string, OperationStats>();

  for (const record of records) {
    const tags = record.tags || {};
    if (tags.metric_family !== options.metricFamily) {
      continue;
    }

    const env = tags.env || "unknown";
    if (options.envFilter && !options.envFilter.has(env)) {
      continue;
    }

    const operation = tags.operation || tags.operation_name || "unknown";
    const key = keyFor(env, operation);

    if (!statsMap.has(key)) {
      statsMap.set(key, { durations: [], success: 0, error: 0 });
    }

    const stats = statsMap.get(key);
    if (!stats) {
      continue;
    }

    if (
      record.metric === "xmtp.sdk.duration" &&
      tags.metric_type === "operation"
    ) {
      stats.durations.push(record.value);
    } else if (record.metric === "xmtp.sdk.operation_count") {
      if (tags.status === "success") {
        stats.success += record.value;
      } else if (tags.status === "error") {
        stats.error += record.value;
      }
    }
  }

  const summaries: OperationSummary[] = [];
  for (const [key, stats] of statsMap.entries()) {
    const [env, operation] = key.split("__");
    const denominator = stats.success + stats.error;
    const failureRatePct =
      denominator === 0 ? 0 : (100 * stats.error) / (denominator + 0.000001);

    summaries.push({
      env,
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

  return summaries.sort((a, b) => {
    if (a.env !== b.env) return a.env.localeCompare(b.env);
    return a.operation.localeCompare(b.operation);
  });
}

function formatNumber(value: number, precision = 1): string {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(precision);
}

function printTable(headers: string[], rows: string[][]): void {
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

function printPerEnvSection(summaries: OperationSummary[]): void {
  console.log("\nPer-env Operation Stats");
  const rows = summaries.map((s) => [
    s.env,
    s.operation,
    String(s.sampleCount),
    formatNumber(s.avgMs),
    formatNumber(s.p50Ms),
    formatNumber(s.p95Ms),
    formatNumber(s.failureRatePct, 2),
  ]);

  printTable(
    [
      "env",
      "operation",
      "samples",
      "avg_ms",
      "p50_ms",
      "p95_ms",
      "failure_pct",
    ],
    rows,
  );
}

function printComparisonSection(summaries: OperationSummary[]): void {
  const byKey = new Map<string, OperationSummary>();
  for (const summary of summaries) {
    byKey.set(keyFor(summary.env, summary.operation), summary);
  }

  const operations = Array.from(
    new Set(summaries.map((s) => s.operation)),
  ).sort();

  console.log("\nDev vs Testnet-Staging Comparison");
  const rows: string[][] = [];

  for (const operation of operations) {
    const dev = byKey.get(keyFor("dev", operation));
    const testnet = byKey.get(keyFor("testnet-staging", operation));

    const avgDev = dev?.avgMs ?? 0;
    const avgTestnet = testnet?.avgMs ?? 0;
    const p95Dev = dev?.p95Ms ?? 0;
    const p95Testnet = testnet?.p95Ms ?? 0;
    const failDev = dev?.failureRatePct ?? 0;
    const failTestnet = testnet?.failureRatePct ?? 0;

    rows.push([
      operation,
      formatNumber(avgDev),
      formatNumber(avgTestnet),
      formatNumber(avgTestnet - avgDev),
      formatNumber(p95Dev),
      formatNumber(p95Testnet),
      formatNumber(p95Testnet - p95Dev),
      formatNumber(failDev, 2),
      formatNumber(failTestnet, 2),
      formatNumber(failTestnet - failDev, 2),
      String(dev?.sampleCount ?? 0),
      String(testnet?.sampleCount ?? 0),
    ]);
  }

  printTable(
    [
      "operation",
      "avg_dev",
      "avg_tns",
      "avg_diff",
      "p95_dev",
      "p95_tns",
      "p95_diff",
      "fail_dev",
      "fail_tns",
      "fail_diff",
      "samples_dev",
      "samples_tns",
    ],
    rows,
  );
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const records = parseRecords(options.file);
  const summaries = toSummaries(records, options);

  console.log(`Source: ${options.file}`);
  console.log(`Metric family: ${options.metricFamily}`);
  console.log(`Parsed records: ${records.length}`);
  console.log(`Summary rows: ${summaries.length}`);

  if (summaries.length === 0) {
    console.log(
      "No summary rows found. Check --metric-family/--env filters and test command flags.",
    );
    return;
  }

  printPerEnvSection(summaries);
  printComparisonSection(summaries);
}

main();
