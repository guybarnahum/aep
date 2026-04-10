import { D1Database } from "@cloudflare/workers-types";

export async function checkCoordinationSchema(db: D1Database): Promise<void> {
  // Check for required tables and columns
  const tables = ["tasks", "task_dependencies", "employee_messages"];
  for (const table of tables) {
    const result = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).bind(table).first();
    if (!result) {
      throw new Error(`Missing required table: ${table}`);
    }
  }
  // Check for required columns in tasks
  const columns = [
    "id", "companyId", "originatingTeamId", "assignedTeamId", "ownerEmployeeId", "assignedEmployeeId", "createdByEmployeeId", "taskType", "title", "status", "payload", "blockingDependencyCount"
  ];
  const pragma = await db.prepare(`PRAGMA table_info(tasks)`).all();
  const colNames = pragma.results.map((row: any) => row.name);
  for (const col of columns) {
    if (!colNames.includes(col)) {
      throw new Error(`Missing column in tasks: ${col}`);
    }
  }
  // If all checks pass
  console.log("Coordination schema is valid.");
}

if (require.main === module) {
  // Example usage: node company-coordination-schema-check.js
  // (You would wire this up to your CI environment with the actual DB)
  console.log("Coordination schema check script loaded.");
}
