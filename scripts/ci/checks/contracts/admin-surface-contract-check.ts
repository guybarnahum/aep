/* eslint-disable no-console */

import {
  ROUTE_PROTECTION_MAP,
  ADMIN_PROTECTION_CLASSES,
  getRoutesByProtectionClass,
  getUngatedAdminRoutes,
  type RouteProtectionClass,
} from "@aep/operator-agent/routes/route-protection-map";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ── 1. Non-empty admin classes ──────────────────────────────────────────────
// Prevents accidental deletion of entire protection-class groups.
const MINIMUM_ROUTES_PER_CLASS: Record<RouteProtectionClass, number> = {
  public_read: 1,
  operator_read: 5,
  operator_action: 0, // not used yet
  admin_dev: 3,
  admin_runtime: 3,
  admin_hr: 10,
  admin_hr_staffing: 2,
  admin_governance: 4,
  admin_product: 8,
};

for (const [cls, minimum] of Object.entries(MINIMUM_ROUTES_PER_CLASS)) {
  const count = getRoutesByProtectionClass(cls as RouteProtectionClass).length;
  assert(
    count >= minimum,
    `admin-surface-contract-check: protection class "${cls}" has ${count} entries, expected at least ${minimum}. ` +
      `A route group may have been accidentally removed from ROUTE_PROTECTION_MAP.`,
  );
}

// ── 2. No admin_* route classified as public_read ──────────────────────────
for (const entry of ROUTE_PROTECTION_MAP) {
  if (entry.protectionClass !== "public_read") continue;
  assert(
    !entry.pattern.startsWith("/agent/te/"),
    `admin-surface-contract-check: test endpoint "${entry.pattern}" must not be classified as public_read`,
  );
  assert(
    !entry.pattern.startsWith("/agent/run"),
    `admin-surface-contract-check: runtime trigger "${entry.pattern}" must not be classified as public_read`,
  );
}

// ── 3. Known ungated admin routes are documented and flagged ───────────────
// If purge-employee or purge-projects get gated, remove them from this list.
// That's the correct resolution — not removing the assert.
const KNOWN_UNGATED_ROUTES = [
  "/agent/te/purge-employee",
  "/agent/te/purge-projects",
];

const ungated = getUngatedAdminRoutes();
const ungatedPatterns = ungated.map((e) => e.pattern);

for (const expected of KNOWN_UNGATED_ROUTES) {
  assert(
    ungatedPatterns.includes(expected),
    `admin-surface-contract-check: expected "${expected}" to be in ROUTE_PROTECTION_MAP with currentlyGated=false. ` +
      `If the route was gated, remove it from KNOWN_UNGATED_ROUTES in this check and update its entry in route-protection-map.ts.`,
  );
}

for (const entry of ungated) {
  const isKnown = KNOWN_UNGATED_ROUTES.includes(entry.pattern);
  assert(
    isKnown,
    `admin-surface-contract-check: "${entry.pattern}" is classified as admin_* with currentlyGated=false ` +
      `but is NOT in KNOWN_UNGATED_ROUTES. Either gate the route or add it to KNOWN_UNGATED_ROUTES with an explanation.`,
  );
}

// ── 4. No duplicate (pattern, method) pairs ───────────────────────────────
const seen = new Set<string>();
for (const entry of ROUTE_PROTECTION_MAP) {
  for (const method of entry.methods) {
    const key = `${method.toUpperCase()} ${entry.pattern}`;
    assert(
      !seen.has(key),
      `admin-surface-contract-check: duplicate route entry for "${key}". Merge or de-duplicate in route-protection-map.ts.`,
    );
    seen.add(key);
  }
}

// ── 5. All entries in the map have non-empty note fields ──────────────────
for (const entry of ROUTE_PROTECTION_MAP) {
  assert(
    entry.note && entry.note.trim().length > 0,
    `admin-surface-contract-check: route "${entry.pattern}" has no note. ` +
      `All routes must document their intent in the note field.`,
  );
}

// ── Summary ────────────────────────────────────────────────────────────────
const countsByClass: Partial<Record<RouteProtectionClass, number>> = {};
for (const entry of ROUTE_PROTECTION_MAP) {
  countsByClass[entry.protectionClass] =
    (countsByClass[entry.protectionClass] ?? 0) + entry.methods.length;
}

console.log("admin-surface-contract-check passed", {
  totalEntries: ROUTE_PROTECTION_MAP.length,
  ungatedAdminRoutes: ungatedPatterns,
  routeMethodCountByClass: countsByClass,
});
