const base = "http://127.0.0.1:8810";
const employeeA = "emp_timeout_recovery_01";
const employeeB = "emp_retry_supervisor_01";

async function parseJson(res) {
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

async function get(path) {
  const res = await fetch(base + path);
  return { status: res.status, body: await parseJson(res) };
}

async function post(path, body) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: await parseJson(res) };
}

async function managerCron() {
  const res = await fetch(
    base + "/__scheduled?cron=" + encodeURIComponent("*/5 * * * *")
  );
  return { status: res.status, body: await res.text() };
}

function byTsDesc(a, b) {
  return String(b.timestamp || "").localeCompare(String(a.timestamp || ""));
}

function latestDecision(logEntries, employeeId, recommendation) {
  return (logEntries || []).find(
    (d) =>
      d.observedEmployeeId === employeeId &&
      d.recommendation === recommendation
  );
}

const out = { steps: [] };

out.steps.push({ step: "healthz", ...(await get("/healthz")) });

out.steps.push({
  step: "seed-A-worklog",
  ...(await post("/agent/te/seed-work-log", {
    employeeId: employeeA,
    result: "operator_action_failed",
    count: 1,
  })),
});

out.steps.push({ step: "cron-A-1", ...(await managerCron()) });

const approvalsA1 = await get("/agent/approvals?employeeId=" + employeeA + "&limit=100");
const disableA1 = (approvalsA1.body.entries || [])
  .filter((e) => e.actionType === "disable_employee")
  .sort(byTsDesc);
const firstA = disableA1[0];
out.steps.push({
  step: "A-first-approval",
  status: approvalsA1.status,
  body: {
    approvalId: firstA?.approvalId,
    status: firstA?.status,
    expiresAt: firstA?.expiresAt,
    disableApprovalCount: disableA1.length,
  },
});

if (firstA?.approvalId) {
  out.steps.push({
    step: "A-approve-first",
    ...(await post("/agent/approvals/approve", {
      approvalId: firstA.approvalId,
      decidedBy: "runtime-matrix",
    })),
  });
}

out.steps.push({ step: "cron-A-2", ...(await managerCron()) });
const logA2 = await get("/agent/manager-log?managerEmployeeId=emp_infra_ops_manager_01&limit=40");
const decA2 = latestDecision(logA2.body.entries, employeeA, "disable_employee");
out.steps.push({
  step: "A-after-apply-decision",
  status: logA2.status,
  body: {
    approvalGateStatus: decA2?.approvalGateStatus,
    approvalId: decA2?.approvalId,
    approvalExecutionId: decA2?.approvalExecutionId,
  },
});

out.steps.push({ step: "cron-A-3", ...(await managerCron()) });
const approvalsA3 = await get("/agent/approvals?employeeId=" + employeeA + "&limit=100");
const disableA3 = (approvalsA3.body.entries || [])
  .filter((e) => e.actionType === "disable_employee")
  .sort(byTsDesc);
const newestA = disableA3[0];
out.steps.push({
  step: "A-post-single-use-refresh",
  status: approvalsA3.status,
  body: {
    newestApprovalId: newestA?.approvalId,
    newestStatus: newestA?.status,
    totalDisableApprovals: disableA3.length,
    differsFromFirst: Boolean(
      firstA?.approvalId &&
        newestA?.approvalId &&
        firstA.approvalId !== newestA.approvalId
    ),
  },
});

out.steps.push({
  step: "seed-B-worklog",
  ...(await post("/agent/te/seed-work-log", {
    employeeId: employeeB,
    result: "operator_action_failed",
    count: 1,
  })),
});

out.steps.push({ step: "cron-B-1", ...(await managerCron()) });
const approvalsB1 = await get("/agent/approvals?employeeId=" + employeeB + "&limit=100");
const disableB1 = (approvalsB1.body.entries || [])
  .filter((e) => e.actionType === "disable_employee")
  .sort(byTsDesc);
const firstB = disableB1[0];
out.steps.push({
  step: "B-first-approval",
  status: approvalsB1.status,
  body: {
    approvalId: firstB?.approvalId,
    status: firstB?.status,
    disableApprovalCount: disableB1.length,
  },
});

if (firstB?.approvalId) {
  out.steps.push({
    step: "B-reject-first",
    ...(await post("/agent/approvals/reject", {
      approvalId: firstB.approvalId,
      decidedBy: "runtime-matrix",
      decisionNote: "reject for test",
    })),
  });
}

out.steps.push({ step: "cron-B-2", ...(await managerCron()) });
const approvalsB2 = await get("/agent/approvals?employeeId=" + employeeB + "&limit=100");
const disableB2 = (approvalsB2.body.entries || [])
  .filter((e) => e.actionType === "disable_employee")
  .sort(byTsDesc);
const logB2 = await get("/agent/manager-log?managerEmployeeId=emp_infra_ops_manager_01&limit=80");
const decB2 = latestDecision(logB2.body.entries, employeeB, "disable_employee");
out.steps.push({
  step: "B-no-auto-rerequest-check",
  status: approvalsB2.status,
  body: {
    disableApprovalCountAfterReject: disableB2.length,
    latestApprovalStatus: disableB2[0]?.status,
    approvalGateStatus: decB2?.approvalGateStatus,
  },
});

console.log(JSON.stringify(out, null, 2));
