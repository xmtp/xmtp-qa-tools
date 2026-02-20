import { sendHistogramMetric, sendMetric } from "@helpers/datadog";

type MetricTagsParam = Parameters<typeof sendMetric>[2];

const METRIC_FAMILY = "group_stats_v1";
const METRIC_TOOL = "qa-tools";
const METRICS_TIER = "enhanced";
const EPSILON = 0.0001;

type RunMode = "cold" | "warm" | "stream";
type Status = "success" | "error";

type StatsBaseContext = {
  test: string;
  sdk: string;
  members: number;
  operationName: string;
  legacyOperation?: string;
  runMode?: RunMode;
  status?: Status;
};

function membersBucket(members: number): string {
  if (members <= 25) return "small";
  if (members <= 100) return "medium";
  return "large";
}

function nonZero(value: number): number {
  if (!Number.isFinite(value)) return EPSILON;
  if (value <= 0) return EPSILON;
  return value;
}

function commonTags(ctx: StatsBaseContext): Record<string, string> {
  return {
    test: ctx.test,
    sdk: ctx.sdk,
    members: String(ctx.members),
    members_bucket: membersBucket(ctx.members),
    metric_family: METRIC_FAMILY,
    metrics_tier: METRICS_TIER,
    tool: METRIC_TOOL,
    run_mode: ctx.runMode ?? "warm",
    status: ctx.status ?? "success",
  };
}

export function sendStatsOperationCount(ctx: StatsBaseContext): void {
  const countTags = {
    ...commonTags(ctx),
    metric_type: "throughput",
    metric_subtype: "group",
    operation: ctx.legacyOperation ?? ctx.operationName,
    metric_name: "group.ops_throughput.ops_per_s",
    operation_name: ctx.operationName,
  };

  sendMetric("operation_count", 1, countTags as unknown as MetricTagsParam);
}

export function sendStatsDurationMetric(
  ctx: StatsBaseContext & {
    valueMs: number;
    metricName?: string;
  },
): void {
  const durationTags = {
    ...commonTags(ctx),
    metric_type: "operation",
    metric_subtype: "group",
    operation: ctx.legacyOperation ?? ctx.operationName,
    metric_name: ctx.metricName ?? `${ctx.operationName}.ms`,
    operation_name: ctx.operationName,
  };

  sendMetric(
    "duration",
    nonZero(ctx.valueMs),
    durationTags as unknown as MetricTagsParam,
  );
  sendStatsOperationCount(ctx);
}

export function sendStatsResponseMetric(
  ctx: StatsBaseContext & {
    valueMs: number;
    metricName?: string;
  },
): void {
  const responseTags = {
    ...commonTags(ctx),
    metric_type: "stream",
    metric_subtype: "message",
    operation: ctx.legacyOperation ?? ctx.operationName,
    metric_name: ctx.metricName ?? `${ctx.operationName}.ms`,
    operation_name: ctx.operationName,
  };

  sendMetric(
    "response",
    nonZero(ctx.valueMs),
    responseTags as unknown as MetricTagsParam,
  );

  // Ensure percentiles are emitted for stream response latency.
  sendHistogramMetric(
    "response",
    nonZero(ctx.valueMs),
    responseTags as unknown as MetricTagsParam,
  );
}

export function sendStatsRateMetric(
  ctx: StatsBaseContext & {
    series: "delivery" | "order";
    valuePct: number;
    metricName: "group.delivery_rate.pct" | "group.order_rate.pct";
    subtype?: "stream" | "poll" | "recovery";
  },
): void {
  const rateTags = {
    ...commonTags(ctx),
    metric_type: ctx.series,
    metric_subtype: ctx.subtype ?? "stream",
    conversation_type: "group",
    operation: ctx.legacyOperation ?? ctx.operationName,
    metric_name: ctx.metricName,
    operation_name: ctx.operationName,
  };

  sendMetric(
    ctx.series,
    nonZero(ctx.valuePct),
    rateTags as unknown as MetricTagsParam,
  );
}
