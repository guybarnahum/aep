/**
 * Documentation-only allowlist for no-hardcoded-runtime-identifiers-check.
 *
 * Keep this file intentionally small. The check itself owns path-level
 * exceptions so reviewers can see exactly which broad areas are allowed.
 *
 * Allowed categories:
 * - historical D1 migrations
 * - repository documentation
 * - examples
 * - local dev scripts
 * - this guardrail check and this explanatory allowlist
 *
 * Not allowed in active runtime/config/CI code:
 * - static employee instance IDs
 * - committed cleanup tokens
 * - placeholder live recipients such as example.com
 * - personal workers.dev URLs
 * - implicit internal-org default routing behavior
 */
export const RUNTIME_LITERAL_ALLOWLIST_NOTE =
  "Use path-level exceptions only for historical, documentation, example, or local-dev-only code.";