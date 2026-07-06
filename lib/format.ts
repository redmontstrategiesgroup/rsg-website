import type { PortalMetric } from "./types";

/** Format a metric value for display given its format hint. */
export function formatMetricValue(
  value: number,
  format: PortalMetric["format"]
): string {
  switch (format) {
    case "currency":
      return value >= 1000
        ? `$${(value / 1000).toLocaleString("en-US", {
            maximumFractionDigits: value >= 100000 ? 0 : 1,
          })}k`
        : `$${value.toLocaleString("en-US")}`;
    case "percent":
      return `${value}%`;
    case "duration":
      return value >= 60 ? `${Math.round(value / 60)}m` : `${value}s`;
    case "number":
    default:
      return value.toLocaleString("en-US");
  }
}
