export const PRODUCT_SIGNAL_SOURCES = [
  "validation",
  "monitoring",
  "customer_intake",
] as const;

export type ProductSignalSource = (typeof PRODUCT_SIGNAL_SOURCES)[number];

export const PRODUCT_SIGNAL_SEVERITIES = ["info", "warning", "failed", "critical"] as const;

export type ProductSignalSeverity = (typeof PRODUCT_SIGNAL_SEVERITIES)[number];

export const PRODUCT_SIGNAL_CLASSIFICATIONS = [
  "validation_failure",
  "monitoring_alert",
  "customer_feedback",
  "deployment_regression",
  "needs_triage",
] as const;

export type ProductSignalClassification =
  (typeof PRODUCT_SIGNAL_CLASSIFICATIONS)[number];

export type ProductSignalDecision =
  | {
      route: "intake";
      reason: string;
    }
  | {
      route: "thread";
      reason: string;
    };

export function classifyProductSignal(args: {
  source: ProductSignalSource;
  severity: ProductSignalSeverity;
  classification?: ProductSignalClassification;
}): ProductSignalDecision {
  if (args.source === "customer_intake") {
    return { route: "intake", reason: "customer feedback enters product intake" };
  }

  if (args.source === "validation" && ["failed", "critical"].includes(args.severity)) {
    return { route: "intake", reason: "validation failure requires product triage" };
  }

  if (args.source === "monitoring" && args.severity === "critical") {
    return { route: "intake", reason: "critical monitoring signal requires product triage" };
  }

  return { route: "thread", reason: "signal recorded for product coordination" };
}

export function isProductSignalSource(value: unknown): value is ProductSignalSource {
  return typeof value === "string" && PRODUCT_SIGNAL_SOURCES.includes(value as ProductSignalSource);
}

export function isProductSignalSeverity(value: unknown): value is ProductSignalSeverity {
  return typeof value === "string" && PRODUCT_SIGNAL_SEVERITIES.includes(value as ProductSignalSeverity);
}

export function isProductSignalClassification(
  value: unknown,
): value is ProductSignalClassification {
  return (
    typeof value === "string" &&
    PRODUCT_SIGNAL_CLASSIFICATIONS.includes(value as ProductSignalClassification)
  );
}
