/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { getApprovalEntries } from "../../contracts/approvals";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import { resolveServiceBaseUrl } from "../../../lib/service-map";

export {};

async function expectRequestFailure(
  label: string,
  request: () => Promise<unknown>,
  expectedMessagePart: string,
): Promise<void> {
  try {
    await request();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedMessagePart)) {
      throw new Error(`${label} failed with unexpected message: ${message}`);
    }
    return;
  }

  throw new Error(`${label} unexpectedly succeeded`);
}

const SYNTHETIC_EMPLOYEE_NAME_PREFIXES = ["Lifecycle Test ", "Persona Test "];

function enableSyntheticMutationChecks(): boolean {
  return process.env.OPERATOR_AGENT_ENABLE_SYNTHETIC_MUTATION_CHECKS === "true";
}

function isSyntheticContractTestEmployee(employee: {
  identity: { employeeId: string };
  employment: { employmentStatus: string };
  publicProfile?: { displayName?: string };
}): boolean {
  const displayName = employee.publicProfile?.displayName ?? "";
  return SYNTHETIC_EMPLOYEE_NAME_PREFIXES.some((prefix) =>
    displayName.startsWith(prefix),
  );
}

async function cleanupSyntheticContractTestEmployees(args: {
  client: ReturnType<typeof createOperatorAgentClient>;
  agentBaseUrl: string;
  phase: "before" | "after";
}): Promise<void> {
  if (!enableSyntheticMutationChecks()) {
    return;
  }

  const employeesResponse = await args.client.listEmployees();
  if (!employeesResponse.ok) {
    throw new Error("Failed to list employees during synthetic employee cleanup");
  }

  const syntheticEmployees = employeesResponse.employees.filter(
    isSyntheticContractTestEmployee,
  );

  const actionableSyntheticEmployees = syntheticEmployees.filter(
    (employee) => employee.employment.employmentStatus !== "archived",
  );

  if (actionableSyntheticEmployees.length === 0) {
    return;
  }

  console.warn(
    `[operator-agent-contract-check] synthetic test employees detected ${args.phase} run: ${actionableSyntheticEmployees
      .map(
        (employee) =>
          `${employee.publicProfile?.displayName ?? employee.identity.employeeId} (${employee.identity.employeeId})`,
      )
      .join(", ")}`,
  );

  for (const employee of actionableSyntheticEmployees) {
    const employeeId = employee.identity.employeeId;
    const employmentStatus = employee.employment.employmentStatus;

    if (employmentStatus !== "terminated" && employmentStatus !== "retired") {
      const terminateResult = await args.client.runEmployeeLifecycleAction(
        employeeId,
        "terminate",
        {
          reason: `CI synthetic employee cleanup (${args.phase})`,
          approvedBy: "ci-operator-agent-client",
        },
      );

      if (!terminateResult.ok) {
        throw new Error(
          `Failed to terminate synthetic employee ${employeeId} during ${args.phase} cleanup`,
        );
      }
    }

    const archiveResult = await args.client.runEmployeeLifecycleAction(
      employeeId,
      "archive",
      {
        reason: `CI synthetic employee cleanup (${args.phase})`,
        approvedBy: "ci-operator-agent-client",
      },
    );

    if (!archiveResult.ok) {
      throw new Error(
        `Failed to archive synthetic employee ${employeeId} during ${args.phase} cleanup`,
      );
    }

    const purgeResponse = await fetch(`${args.agentBaseUrl}/agent/te/purge-employee`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ employeeId }),
    });

    const purgePayload = (await purgeResponse.json()) as {
      ok?: boolean;
      error?: string;
    };

    if (!purgeResponse.ok || purgePayload.ok !== true) {
      throw new Error(
        `Failed to purge synthetic employee ${employeeId} during ${args.phase} cleanup: ${JSON.stringify(purgePayload)}`,
      );
    }
  }
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });

  await cleanupSyntheticContractTestEmployees({
    client,
    agentBaseUrl,
    phase: "before",
  });

  try {
    let employeesResponse;
    try {
      employeesResponse = await client.listEmployees();
    } catch (err) {
      if (handleOperatorAgentSoftSkip("operator-agent-contract-check", err)) {
        process.exit(0);
      }
      throw err;
    }

    if (!employeesResponse.ok) {
      throw new Error("/agent/employees did not return ok=true");
    }

    const employees = employeesResponse.employees;
    const liveEmployeeIds = await resolveEmployeeIdsByKey({
      agentBaseUrl,
      employees: [
        {
          key: "timeoutRecovery",
          roleId: "timeout-recovery-operator",
          teamId: "team_infra",
          runtimeStatus: "implemented",
        },
        {
          key: "retrySupervisor",
          roleId: "retry-supervisor",
          teamId: "team_infra",
          runtimeStatus: "implemented",
        },
        {
          key: "infraOpsManager",
          roleId: "infra-ops-manager",
          teamId: "team_infra",
          runtimeStatus: "implemented",
        },
        {
          key: "productManagerWeb",
          roleId: "product-manager-web",
          teamId: "team_web_product",
          runtimeStatus: "planned",
          required: {
            scope: {
              allowedServices: ["service_dashboard"],
              allowedEnvironmentNames: ["preview"],
            },
          },
        },
        {
          key: "frontendEngineer",
          roleId: "frontend-engineer",
          teamId: "team_web_product",
          runtimeStatus: "planned",
          required: {
            scope: {
              allowedServices: ["service_dashboard"],
              allowedEnvironmentNames: ["preview"],
            },
          },
        },
        {
          key: "validationPm",
          roleId: "validation-pm",
          teamId: "team_validation",
          runtimeStatus: "planned",
          required: {
            scope: {
              allowedTenants: ["tenant_async_validation"],
              allowedEnvironmentNames: ["async_validation"],
            },
          },
        },
        {
          key: "validationEngineer",
          roleId: "validation-engineer",
          teamId: "team_validation",
          runtimeStatus: "planned",
          required: {
            scope: {
              allowedTenants: ["tenant_async_validation"],
              allowedEnvironmentNames: ["async_validation"],
            },
          },
        },
      ],
    });
    const timeoutRecoveryEmployeeId = liveEmployeeIds.timeoutRecovery;
    const retrySupervisorEmployeeId = liveEmployeeIds.retrySupervisor;
    const infraOpsManagerEmployeeId = liveEmployeeIds.infraOpsManager;
    const productManagerWebEmployeeId = liveEmployeeIds.productManagerWeb;
    const frontendEngineerEmployeeId = liveEmployeeIds.frontendEngineer;
    const validationPmEmployeeId = liveEmployeeIds.validationPm;
    const validationEngineerEmployeeId = liveEmployeeIds.validationEngineer;

    const rolesResponse = await client.listRoles();
    if (!rolesResponse.ok) {
      throw new Error("/agent/roles did not return ok=true");
    }

    const reviewCycleResult = await client.createReviewCycle({
      name: `Cycle ${Date.now()}`,
      periodStart: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-03-31T23:59:59.000Z",
      status: "active",
      createdBy: "ci-operator-agent-client",
    });
    if (!reviewCycleResult.ok || !reviewCycleResult.reviewCycle.reviewCycleId) {
      throw new Error("Expected review cycle creation to succeed");
    }

  const plannedEmployees = await client.listEmployees({ status: "planned" });
  if (!plannedEmployees.ok) {
    throw new Error("/agent/employees?status=planned did not return ok=true");
  }

  const plannedEmployeeIds = new Set(
    plannedEmployees.employees.map((employee) => employee.identity.employeeId),
  );

  for (const employeeId of [
    productManagerWebEmployeeId,
    frontendEngineerEmployeeId,
    validationPmEmployeeId,
    validationEngineerEmployeeId,
  ]) {
    if (!plannedEmployeeIds.has(employeeId)) {
      throw new Error(
        `Expected planned employee filter to include ${employeeId}`,
      );
    }
  }

  for (const employeeId of [
    timeoutRecoveryEmployeeId,
    retrySupervisorEmployeeId,
    infraOpsManagerEmployeeId,
  ]) {
    if (plannedEmployeeIds.has(employeeId)) {
      throw new Error(
        `Expected planned employee filter to exclude ${employeeId}`,
      );
    }
  }

  const webTeamEmployees = await client.listEmployees({
    teamId: "team_web_product",
  });

  if (!webTeamEmployees.ok) {
    throw new Error("/agent/employees?teamId=team_web_product did not return ok=true");
  }

  const webTeamEmployeeIds = new Set(
    webTeamEmployees.employees.map((employee) => employee.identity.employeeId),
  );

  for (const employeeId of [
    productManagerWebEmployeeId,
    frontendEngineerEmployeeId,
  ]) {
    if (!webTeamEmployeeIds.has(employeeId)) {
      throw new Error(`Expected web team filter to include ${employeeId}`);
    }
  }

  for (const employeeId of [
    validationPmEmployeeId,
    validationEngineerEmployeeId,
    timeoutRecoveryEmployeeId,
    retrySupervisorEmployeeId,
    infraOpsManagerEmployeeId,
  ]) {
    if (webTeamEmployeeIds.has(employeeId)) {
      throw new Error(`Expected web team filter to exclude ${employeeId}`);
    }
  }

  for (const employee of webTeamEmployees.employees) {
    if (employee.identity.teamId !== "team_web_product") {
      throw new Error(
        `Expected web team filter to return only team_web_product employees, got ${employee.identity.employeeId} on ${employee.identity.teamId}`,
      );
    }
  }

  const catalogEmployeeIds = new Set(employees.map((e) => e.identity.employeeId));

  for (const employeeId of [
    timeoutRecoveryEmployeeId,
    retrySupervisorEmployeeId,
    infraOpsManagerEmployeeId,
    productManagerWebEmployeeId,
    frontendEngineerEmployeeId,
    validationPmEmployeeId,
    validationEngineerEmployeeId,
  ]) {
    if (!catalogEmployeeIds.has(employeeId)) {
      throw new Error(`Expected /agent/employees to include ${employeeId}`);
    }
  }

  if (employeesResponse.count < 7) {
    throw new Error(`Expected at least 7 employees, got ${employeesResponse.count}`);
  }

  const timeoutRecoveryEmployee = employees.find(
    (employee) => employee.identity.employeeId === timeoutRecoveryEmployeeId,
  );

  if (!timeoutRecoveryEmployee) {
    throw new Error("Expected timeout recovery employee details in /agent/employees");
  }

  if (timeoutRecoveryEmployee.identity.companyId !== "company_internal_aep") {
    throw new Error("Expected timeout recovery employee companyId=company_internal_aep");
  }

  if (timeoutRecoveryEmployee.identity.teamId !== "team_infra") {
    throw new Error("Expected timeout recovery employee teamId=team_infra");
  }

  if (timeoutRecoveryEmployee.runtime.runtimeStatus !== "implemented") {
    throw new Error("Expected timeout recovery employee runtimeStatus=implemented");
  }

  if (timeoutRecoveryEmployee.employment.employmentStatus !== "active") {
    throw new Error("Expected timeout recovery employee employmentStatus=active");
  }

  if (!Array.isArray(timeoutRecoveryEmployee.publicLinks)) {
    throw new Error("Expected timeout recovery employee publicLinks array");
  }

  const productManagerWeb = employees.find(
    (employee) => employee.identity.employeeId === productManagerWebEmployeeId,
  );

  if (!productManagerWeb) {
    throw new Error("Expected product manager web employee details in /agent/employees");
  }

  if (productManagerWeb.runtime.runtimeStatus !== "planned") {
    throw new Error("Expected product manager web employee to be planned");
  }

  if (productManagerWeb.identity.teamId !== "team_web_product") {
    throw new Error("Expected product manager web teamId=team_web_product");
  }

  if (productManagerWeb.employment.employmentStatus !== "active") {
    throw new Error("Expected product manager web employmentStatus=active");
  }

  let lifecycleEventsCount = 0;
  let personaEmployeeId: string | null = null;

  if (enableSyntheticMutationChecks()) {
    const lifecycleTestEmployee = await client.createEmployee({
      teamId: "team_web_product",
      roleId: "product-manager-web",
      employeeName: `Lifecycle Test ${Date.now()}`,
      employmentStatus: "draft",
      runtimeStatus: "planned",
      schedulerMode: "manual_only",
      isSynthetic: true,
      bio: "Lifecycle test employee",
      tone: "Professional",
      skills: ["Planning"],
      appearanceSummary: "Test employee for lifecycle contract checks.",
      birthYear: 1993,
      reason: "CI lifecycle contract check",
      approvedBy: "ci-operator-agent-client",
    });

    if (!lifecycleTestEmployee.ok || !lifecycleTestEmployee.employeeId) {
      throw new Error("Expected employee creation to succeed for lifecycle test");
    }

    const lifecycleEmployeeId = String(lifecycleTestEmployee.employeeId);

    const draftEmployees = await client.listEmployees({ employmentStatus: "draft" });
    if (!draftEmployees.ok) {
      throw new Error("/agent/employees?employmentStatus=draft did not return ok=true");
    }

    if (
      !draftEmployees.employees.some(
        (employee) => employee.identity.employeeId === lifecycleEmployeeId,
      )
    ) {
      throw new Error("Expected lifecycle test employee in draft employment filter");
    }

    const activateResult = await client.runEmployeeLifecycleAction(
      lifecycleEmployeeId,
      "activate",
      {
        reason: "CI activate check",
      },
    );
    if (!activateResult.ok || activateResult.employmentStatus !== "active") {
      throw new Error("Expected activate lifecycle action to succeed");
    }

    await expectRequestFailure(
      "archive-active-employee",
      () =>
        client.runEmployeeLifecycleAction(lifecycleEmployeeId, "archive", {
          reason: "CI invalid archive-from-active check",
          approvedBy: "ci-operator-agent-client",
        }),
      "archive is only allowed for retired or terminated employees",
    );

    const changeRoleResult = await client.runEmployeeLifecycleAction(
      lifecycleEmployeeId,
      "change-role",
      {
        toRoleId: "frontend-engineer",
        reason: "CI change-role check",
      },
    );
    if (!changeRoleResult.ok || changeRoleResult.roleId !== "frontend-engineer") {
      throw new Error("Expected change-role lifecycle action to succeed");
    }

    const leaveResult = await client.runEmployeeLifecycleAction(
      lifecycleEmployeeId,
      "start-leave",
      {
        reason: "CI leave check",
      },
    );
    if (!leaveResult.ok || leaveResult.employmentStatus !== "on_leave") {
      throw new Error("Expected start-leave lifecycle action to succeed");
    }

    const returnResult = await client.runEmployeeLifecycleAction(
      lifecycleEmployeeId,
      "end-leave",
      {
        reason: "CI return check",
      },
    );
    if (!returnResult.ok || returnResult.employmentStatus !== "active") {
      throw new Error("Expected end-leave lifecycle action to succeed");
    }

    const retireResult = await client.runEmployeeLifecycleAction(
      lifecycleEmployeeId,
      "retire",
      {
        reason: "CI retire check",
        approvedBy: "ci-operator-agent-client",
      },
    );
    if (!retireResult.ok || retireResult.employmentStatus !== "retired") {
      throw new Error("Expected retire lifecycle action to succeed");
    }

    const rehireResult = await client.runEmployeeLifecycleAction(
      lifecycleEmployeeId,
      "rehire",
      {
        reason: "CI rehire check",
      },
    );
    if (!rehireResult.ok || rehireResult.employmentStatus !== "active") {
      throw new Error("Expected rehire lifecycle action to succeed");
    }

    const terminateResult = await client.runEmployeeLifecycleAction(
      lifecycleEmployeeId,
      "terminate",
      {
        reason: "CI terminate check",
        approvedBy: "ci-operator-agent-client",
      },
    );
    if (!terminateResult.ok || terminateResult.employmentStatus !== "terminated") {
      throw new Error("Expected terminate lifecycle action to succeed");
    }

    const archiveResult = await client.runEmployeeLifecycleAction(
      lifecycleEmployeeId,
      "archive",
      {
        reason: "CI archive check",
        approvedBy: "ci-operator-agent-client",
      },
    );
    if (!archiveResult.ok || archiveResult.employmentStatus !== "archived") {
      throw new Error("Expected archive lifecycle action to succeed");
    }

    const lifecycleEvents = await client.getEmployeeEmploymentEvents(
      lifecycleEmployeeId,
    );
    if (!lifecycleEvents.ok || lifecycleEvents.count < 7) {
      throw new Error("Expected lifecycle test employee employment events to exist");
    }
    lifecycleEventsCount = lifecycleEvents.count;

    const lifecycleEventTypes = new Set(
      lifecycleEvents.events.map((event) => event.eventType),
    );

    for (const eventType of [
      "hired",
      "activated",
      "role_changed",
      "went_on_leave",
      "returned_from_leave",
      "retired",
      "rehired",
      "terminated",
      "archived",
    ]) {
      if (!lifecycleEventTypes.has(eventType as any)) {
        throw new Error(`Expected lifecycle event ${eventType} to be recorded`);
      }
    }

    const personaTestEmployee = await client.createEmployee({
      teamId: "team_validation",
      roleId: "validation-engineer",
      employeeName: `Persona Test ${Date.now()}`,
      employmentStatus: "draft",
      runtimeStatus: "planned",
      schedulerMode: "manual_only",
      isSynthetic: true,
      reason: "CI persona contract check",
      approvedBy: "ci-operator-agent-client",
    });

    if (!personaTestEmployee.ok || !personaTestEmployee.employeeId) {
      throw new Error("Expected employee creation to succeed for persona test");
    }

    personaEmployeeId = String(personaTestEmployee.employeeId);

    const generatedPersona = await client.generateEmployeePersona(
      personaEmployeeId,
      {
        description:
          "Analytical validation engineer who is methodical, evidence-driven, and calm under pressure.",
        strengths: ["Validation planning", "Evidence quality", "Structured debugging"],
        workingStyle: "Structured, calm, and highly explicit in handoffs.",
        appearancePrompt:
          "Mid-30s validation engineer with a precise, calm, technical presence.",
        birthYear: 1992,
      },
    );

    if (!generatedPersona.ok) {
      throw new Error("Expected persona generation to succeed");
    }

    if (generatedPersona.generated.promptProfileStatus !== "draft") {
      throw new Error("Expected generated persona prompt profile status=draft");
    }

    if (!generatedPersona.generated.publicProfile.bio) {
      throw new Error("Expected generated persona to include public bio");
    }

    if (
      generatedPersona.generated.synthesisMode !== "ai" &&
      generatedPersona.generated.synthesisMode !== "fallback"
    ) {
      throw new Error("Expected generated persona synthesisMode to be ai or fallback");
    }

    if (
      generatedPersona.generated.synthesisMode === "ai" &&
      typeof generatedPersona.generated.model !== "string"
    ) {
      throw new Error("Expected AI persona generation to report model");
    }

    const approvedPersona = await client.approveEmployeePersona(personaEmployeeId);
    if (!approvedPersona.ok || approvedPersona.promptProfileStatus !== "approved") {
      throw new Error("Expected persona approval to succeed");
    }
  }

  const productManagerWebRole = rolesResponse.roles.find(
    (role) => role.roleId === "product-manager-web",
  );

  if (!productManagerWebRole) {
    throw new Error("Expected /agent/roles to include product-manager-web");
  }

  if (productManagerWebRole.teamId !== "team_web_product") {
    throw new Error("Expected product-manager-web role teamId=team_web_product");
  }

  if (
    !Array.isArray(productManagerWebRole.responsibilities) ||
    productManagerWebRole.responsibilities.length === 0
  ) {
    throw new Error("Expected product-manager-web role to expose responsibilities");
  }

  if (
    !Array.isArray(productManagerWebRole.reviewDimensions) ||
    productManagerWebRole.reviewDimensions.length === 0
  ) {
    throw new Error("Expected product-manager-web role to expose reviewDimensions");
  }

  const reviewTask = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_web_product",
    assignedTeamId: "team_web_product",
    assignedEmployeeId: productManagerWebEmployeeId,
    createdByEmployeeId: infraOpsManagerEmployeeId,
    taskType: "plan-feature",
    title: `Review evidence task ${Date.now()}`,
    payload: { source: "ci-review-check" },
  });
  if (!reviewTask?.ok || typeof reviewTask.taskId !== "string") {
    throw new Error("Expected review evidence task creation to succeed");
  }

  const reviewArtifact = await client.createTaskArtifact(reviewTask.taskId, {
    companyId: "company_internal_aep",
    createdByEmployeeId: productManagerWebEmployeeId,
    artifactType: "plan",
    summary: "Review evidence artifact",
    content: {
      kind: "execution_plan",
      source: "ci-review-check",
    },
  });
  if (!reviewArtifact?.ok || typeof reviewArtifact.artifactId !== "string") {
    throw new Error("Expected review evidence artifact creation to succeed");
  }

  const reviewCreateResult = await client.createEmployeeReview(
    productManagerWebEmployeeId,
    {
      reviewCycleId: reviewCycleResult.reviewCycle.reviewCycleId,
      summary: "Strong planning quality with room to improve coordination clarity.",
      strengths: ["Planning quality", "Structured sequencing"],
      gaps: ["Cross-team coordination clarity"],
      dimensionScores: [
        {
          key: "planning_quality",
          score: 5,
          note: "Consistently produces clear planning structure.",
        },
        {
          key: "coordination",
          score: 3,
          note: "Coordination is improving but still uneven.",
        },
      ],
      recommendations: [
        {
          recommendationType: "coach",
          summary: "Coach on clearer cross-team delegation framing.",
        },
      ],
      evidence: [
        { evidenceType: "task", evidenceId: reviewTask.taskId },
        { evidenceType: "artifact", evidenceId: reviewArtifact.artifactId },
      ],
      createdBy: "ci-operator-agent-client",
      approvedBy: "ci-operator-agent-client",
    },
  );
  if (!reviewCreateResult.ok || !reviewCreateResult.review.reviewId) {
    throw new Error("Expected employee review creation to succeed");
  }

  const employeeReviews = await client.listEmployeeReviews(
    productManagerWebEmployeeId,
  );
  if (!employeeReviews.ok || employeeReviews.count < 1) {
    throw new Error("Expected employee reviews list to include created review");
  }

  const createdReview = employeeReviews.reviews.find(
    (review) => review.reviewId === reviewCreateResult.review.reviewId,
  );
  if (!createdReview) {
    throw new Error("Expected created review to be returned from employee reviews list");
  }

  if (
    !createdReview.recommendations.some(
      (recommendation) => recommendation.recommendationType === "coach",
    )
  ) {
    throw new Error("Expected created review to include coach recommendation");
  }

  if (createdReview.evidence.length < 2) {
    throw new Error("Expected created review to include evidence links");
  }

  const draftReviewCycleResult = await client.createReviewCycle({
    name: `Draft Cycle ${Date.now()}`,
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-06-30T23:59:59.000Z",
    status: "draft",
    createdBy: "ci-operator-agent-client",
  });
  if (
    !draftReviewCycleResult.ok ||
    !draftReviewCycleResult.reviewCycle.reviewCycleId
  ) {
    throw new Error("Expected draft review cycle creation to succeed");
  }

  await expectRequestFailure(
    "draft-review-cycle-review-create",
    () =>
      client.createEmployeeReview(productManagerWebEmployeeId, {
        reviewCycleId: draftReviewCycleResult.reviewCycle.reviewCycleId,
        summary: "Should fail on inactive review cycle.",
        strengths: ["Planning quality"],
        gaps: ["None"],
        dimensionScores: [
          {
            key: "planning_quality",
            score: 4,
          },
        ],
        recommendations: [
          {
            recommendationType: "no_change",
            summary: "No change recommendation for invariant test.",
          },
        ],
        evidence: [{ evidenceType: "task", evidenceId: reviewTask.taskId }],
        createdBy: "ci-operator-agent-client",
      }),
    "Reviews may only be created in active review cycles",
  );

  await expectRequestFailure(
    "missing-review-evidence",
    () =>
      client.createEmployeeReview(productManagerWebEmployeeId, {
        reviewCycleId: reviewCycleResult.reviewCycle.reviewCycleId,
        summary: "Should fail on missing evidence.",
        strengths: ["Planning quality"],
        gaps: ["None"],
        dimensionScores: [
          {
            key: "planning_quality",
            score: 4,
          },
        ],
        recommendations: [
          {
            recommendationType: "no_change",
            summary: "No change recommendation for invariant test.",
          },
        ],
        evidence: [
          {
            evidenceType: "task",
            evidenceId: "task_missing_review_evidence",
          },
        ],
        createdBy: "ci-operator-agent-client",
      }),
    "Evidence not found for task:task_missing_review_evidence",
  );

  await expectRequestFailure(
    "high-impact-review-without-approval",
    () =>
      client.createEmployeeReview(productManagerWebEmployeeId, {
        reviewCycleId: reviewCycleResult.reviewCycle.reviewCycleId,
        summary: "Should fail without approvedBy for promote recommendation.",
        strengths: ["Planning quality"],
        gaps: ["None"],
        dimensionScores: [
          {
            key: "planning_quality",
            score: 5,
          },
        ],
        recommendations: [
          {
            recommendationType: "promote",
            summary: "Recommend promotion.",
          },
        ],
        evidence: [{ evidenceType: "task", evidenceId: reviewTask.taskId }],
        createdBy: "ci-operator-agent-client",
      }),
    "approvedBy is required for promote, reassign, or restrict recommendations",
  );

  const timeoutScope = await client.getEmployeeScope(timeoutRecoveryEmployeeId);
  if (!timeoutScope.ok) {
    throw new Error("/agent/employees/:id/scope did not return ok=true");
  }

  if (timeoutScope.companyId !== "company_internal_aep") {
    throw new Error("Expected timeout scope companyId=company_internal_aep");
  }

  if (timeoutScope.teamId !== "team_infra") {
    throw new Error("Expected timeout scope teamId=team_infra");
  }

  const timeoutEffectivePolicy = await client.getEmployeeEffectivePolicy(
    timeoutRecoveryEmployeeId,
  );

  if (!timeoutEffectivePolicy.ok || timeoutEffectivePolicy.implemented !== true) {
    throw new Error("Expected timeout recovery effective policy to be implemented");
  }

  const productManagerPolicy = await client.getEmployeeEffectivePolicy(
    productManagerWebEmployeeId,
  );

  if (!productManagerPolicy.ok || productManagerPolicy.implemented !== false) {
    throw new Error("Expected product manager web effective policy to report implemented=false");
  }

  const managerLog = await client.getManagerLog({
    managerEmployeeId: infraOpsManagerEmployeeId,
    limit: 10,
  });

  if (!managerLog.ok) {
    throw new Error("/agent/manager-log did not return ok=true");
  }

  const employeeControls = await client.listEmployeeControls();
  if (!employeeControls.ok) {
    throw new Error("/agent/employee-controls did not return ok=true");
  }

  const workLog = await client.getWorkLog({
    employeeId: timeoutRecoveryEmployeeId,
    limit: 10,
  });

  if (!workLog.ok) {
    throw new Error("/agent/work-log did not return ok=true");
  }

  const escalations = await client.listEscalations({ limit: 10 });
  if (!escalations.ok) {
    throw new Error("/agent/escalations did not return ok=true");
  }

  const controlHistory = await client.listControlHistory({ limit: 10 });
  if (!controlHistory.ok) {
    throw new Error("/agent/control-history did not return ok=true");
  }

  const schedulerStatus = await client.getSchedulerStatus();
  if (schedulerStatus.primaryScheduler !== "paperclip") {
    throw new Error(
      `Expected primaryScheduler=paperclip, got ${schedulerStatus.primaryScheduler}`,
    );
  }

  const approvals = await client.listApprovals({ limit: 10 });
  if (!approvals.ok) {
    throw new Error("/agent/approvals did not return ok=true");
  }

  const approvalEntries = getApprovalEntries(approvals);

  if (approvalEntries.length > 0) {
    const testApprovalId =
      approvalEntries[0].id ?? approvalEntries[0].approvalId;

    if (!testApprovalId) {
      throw new Error("First approval entry is missing id/approvalId");
    }

    const approvalDetail = await client.getApproval(testApprovalId);

    if (!approvalDetail.ok) {
      throw new Error(
        `/agent/approvals/{id} did not return ok=true for ${testApprovalId}`,
      );
    }

    const returnedId =
      approvalDetail.id ??
      approvalDetail.approval?.id ??
      approvalDetail.approval?.approvalId;

    if (returnedId !== testApprovalId) {
      throw new Error(
        `Approval detail ID mismatch: expected ${testApprovalId}, got ${String(returnedId)}`,
      );
    }
  }

    console.log("operator-agent-contract-check passed", {
      employeeCount: employeesResponse.count,
      roleCount: rolesResponse.count,
      syntheticMutationChecksEnabled: enableSyntheticMutationChecks(),
      reviewCycleId: reviewCycleResult.reviewCycle.reviewCycleId,
      draftReviewCycleId: draftReviewCycleResult.reviewCycle.reviewCycleId,
      reviewId: reviewCreateResult.review.reviewId,
      lifecycleEventCount: lifecycleEventsCount,
      personaEmployeeId,
      managerLogCount: managerLog.count,
      controlsListed: employeeControls.count,
      workLogCount: workLog.count,
      escalationsCount: escalations.count,
      controlHistoryCount: controlHistory.count,
      approvalsCount: approvals.count,
      primaryScheduler: schedulerStatus.primaryScheduler,
      cronFallbackEnabled: schedulerStatus.cronFallbackEnabled,
    });
  } finally {
    await cleanupSyntheticContractTestEmployees({
      client,
      agentBaseUrl,
      phase: "after",
    });
  }
}

main().catch((error) => {
  console.error("operator-agent-contract-check failed");
  console.error(error);
  process.exit(1);
});