# AEP — Agentic Engineering Platform

AEP is the **infra department of a zero-employee company**.

It is a system for modeling and operating digital employees: teams, managers, tasks, governance, and bounded cognition. AEP is intended to serve as the kernel of a real agentic organization.

---

## Core idea

> AI is not a feature of the system.  
> It is becoming the organization.

AEP models:

- employees as first-class units
- teams as structured operating groups
- managers, approvals, and escalations
- task-based coordination across teams
- human-visible governance and observability

The concrete end-state is not a generic multi-agent demo.

It is an operating company made of durable digital employees and teams with distinct responsibilities:

- a **Web team** to design and build websites and webapps
- an **Infra team** to deploy and monitor websites and webapps across Cloudflare and AWS
- a **Validation team** to test development and deployed systems and report issues
- **PM roles** to turn research, customer needs, and requests into scoped work
- **HR / staffing roles** to define job descriptions and ask humans to create or approve employees

The company must also support:

- external collaboration through Slack, email, and later Jira-like systems
- autonomous team heartbeat loops across communicate -> design -> delegate -> execute -> deliver
- a tightly controlled super-admin debug surface for internal cognition inspection

---


## Current Milestone Status

| Milestone | Goal | Current Status |
|----------|------|---------------|
| PR14 | Team operating loops / heartbeat | ✅ Complete. Team loop routes, persisted cadence, dashboard visibility, canonical heartbeat publication, and CI coverage exist. |
| PR15 | Project + intake model | ✅ PR15A-F complete. Intake, projects, intake conversion, project task graphs, dashboard UI, and CI scenario coverage exist. |
| PR16 | Real Web / Infra / Validation specialization | ✅ Complete through PR16G. Native task contracts, payload contracts, team-loop specialization, cognitive scheduling, manager-mediated parking, artifact expectations, delegation patterns, and CI/docs closeout exist. |
| PR17 | External collaboration adapters | 🟡 PR17B contract foundation. Slack/email mirroring, routing, projections, inbound replies, external actions, and policy checks exist. Jira-like systems are design-only projection adapters. |
| PR18 | HR / staffing system | 🟡 Partially implemented. Employee lifecycle, persona, and reviews exist; HR workflows (JD, hiring, staffing) not implemented. |
| PR19 | Productization / marketing website | ❌ Not implemented. Internal dashboard exists, but no AEP-produced customer-facing product. |
| PR20 | Super-admin cognition debug layer | ❌ Not implemented. Cognition boundary is strict; no debug surface exists. |


---

## What AEP is

AEP is not just a workflow runner or a bot framework.

It is an **operating system for digital employees**, with core primitives such as:

- identity
- authority
- task
- plan
- result
- approval
- escalation
- observability

The goal is a company where software systems can:
- deploy, validate, and operate software
- coordinate work across teams
- reason about tasks and outcomes
- collaborate with humans naturally
- improve their own structure over time

---

## Architecture at a glance

### Execution layer
The execution substrate handles runtime and orchestration:

- Cloudflare Workers
- Durable Objects
- async workflows
- D1-backed state

### AEP layer
This repo is the **infra department**:

- employees and managers
- policy and governance
- task coordination
- operator surfaces
- dashboard and observability

### Company layer
The future company layer will add:

- broader coordination
- budgeting
- strategy
- higher-level organizational behavior

In practical terms, that future company layer is expected to evolve toward:

- project intake and client-facing work definition
- persistent team operating loops
- staffing and HR workflows
- external system adapters that remain non-canonical
- product delivery loops for real websites and webapps

---

## Forcing-function products

The immediate projects that should shape AEP's roadmap are concrete and operational:

- a customer-facing marketing website that presents company identity, celebrates the digital employees, and channels new project intake
- websites and webapps designed and delivered by the Web team
- deployment and monitoring of those systems by the Infra team
- validation of development and deployed systems by the Validation team
- human-readable and human-writeable external collaboration surfaces through email, Slack, and later Jira-like ticket systems

These are not side demos. They are the forcing function that turns AEP from an internal runtime into an operational digital company.

### CI / validation architecture

The CI system is now structured as a layered validation model rather than a flat collection of one-off scripts.

The main reusable workflows are organized by validation layer:

- environment
- schema
- contracts
- policy
- scenarios

Top-level workflows such as staging, production, preview, and async-validation compose those reusable layers into full deploy-and-validate lanes.

The `scripts/ci` directory has also been refactored to match this structure. Validation scripts now live primarily under:

- `scripts/ci/checks/environment`
- `scripts/ci/checks/schema`
- `scripts/ci/checks/contracts`
- `scripts/ci/checks/policy`
- `scripts/ci/checks/scenarios`

Shared orchestration helpers live under `scripts/ci/tasks` and common utilities under `scripts/ci/shared`.

## External collaboration adapters

AEP mirrors selected canonical activity into Slack and email. Slack and email are implemented collaboration adapters; Jira-like systems are planned as projection adapters. AEP remains the source of truth.

AEP remains canonical for:
- tasks
- projects
- threads/messages
- approvals
- escalations
- artifacts
- audit records

External systems are allowed to:
- mirror canonical visibility
- collect replies/comments
- trigger allowed actions through canonical routes
- store external ID mappings

They are not allowed to own work state or expose private cognition.

PR17B adds a code-owned external adapter contract. The contract makes the
adapter boundary explicit:

- external adapters can project threads/messages and collect replies/actions
- external adapters require canonical mapping and audit records
- external adapters must not own task, project, approval, or escalation state
- external adapters must not expose private cognition
- all external writes reconcile through canonical AEP routes

This keeps Slack, email, and future Jira-like systems as collaboration surfaces,
not work stores.

### Slack adapter hardening

Slack is now treated as a production-shaped collaboration adapter, not a bot
state store.

Slack mirrors canonical AEP messages and actions while AEP retains ownership of
threads, tasks, projects, approvals, escalations, artifacts, and audit records.

PR17C hardens Slack behavior around:

- explicit Slack payload construction
- thread continuity through projection maps
- skipped delivery when Slack config is missing
- inbound reply correlation
- external action reconciliation through canonical routes

Run the Slack adapter contract check:

```bash
npm run ci:slack-adapter-contract-check
```

### Email adapter hardening

Email is treated as a production-shaped collaboration adapter even while real
provider transport remains disabled.

Email mirrors canonical AEP messages and actions while AEP retains ownership of
threads, tasks, projects, approvals, escalations, artifacts, and audit records.

PR17D hardens email behavior around:

- explicit email payload construction
- placeholder recipient denial
- skipped delivery when provider transport is missing
- inbound reply correlation
- external action reconciliation through canonical routes

Run the email adapter contract check:

```bash
npm run ci:email-adapter-contract-check
```

### Jira-like ticket adapter design

PR17E defines Jira-like systems as projection and collaboration adapters only.

AEP remains the source of truth for tasks, projects, threads, approvals,
escalations, artifacts, and audit records.

Jira-like systems may later project canonical work as external tickets and send
comments/actions back into AEP, but they must not own work state or directly set
canonical status.

Run the Jira-like adapter design contract check:

```bash
npm run ci:jira-like-adapter-design-contract-check
```

### Runtime literal guardrail

The repo includes a CI guardrail that prevents active runtime/config/CI code from
reintroducing hardcoded dynamic values such as static employee IDs, placeholder
live recipients, personal Workers URLs, committed cleanup tokens, or implicit
internal-org defaults.

Run locally:

```bash
npm run ci:no-hardcoded-runtime-identifiers
```

PR16 role-realism integration check:

```bash
npm run ci:pr16-role-realism-contract-check
```

Historical migrations, docs, examples, and local-dev-only scripts are treated as
allowed exception categories.

---

## How the system works

AEP uses a simple organizational model:

```text
intake → project → task graph → assigned employee → execution → decision → result
```

---

## Cognitive Work Distribution (PR16 Evolution)

AEP is evolving from rule-based execution to cognitively steered work distribution.

### Cognitive Prioritization

AEP does not treat scheduling as a rigid queue. Teams gather candidate work, then use bounded cognition to recommend what should happen next. Managers make preemption decisions. Parking a task is explicit, auditable, and reversible.

### Before

- Teams selected tasks using simple rules (for example first ready task)
- Scheduling was implicit and deterministic

### After (PR16)

- Teams evaluate multiple ready tasks
- A bounded LLM context is used to:
  - prioritize work
  - recommend next actions
  - identify conflicts

Key principle:

> AEP uses cognition for judgment, not for state.

All decisions are:

- constrained by canonical task state
- recorded through threads and artifacts
- visible and auditable

### PR16 Role Realism Contract

PR16 makes role behavior part of the AEP substrate rather than a bolt-on rule
layer.

Each canonical task type now carries:

- responsible discipline
- expected team ownership
- required payload shape
- expected artifact output
- allowed delegation patterns

This lets AEP behave more like a company:

```text
PM plans
Web designs/builds
Infra deploys/monitors
Validation verifies/reports
Managers prioritize and park work
```

Code owns the boundaries. Cognition owns the judgment.

---

## Manager Role In Prioritization

AEP models real organizational behavior:

- Workers execute tasks
- Managers decide priorities

When conflicts arise:

team loop detects competing work
-> publishes context
-> manager decides
-> system applies decision

---

## Task Parking And Preemption

AEP supports controlled preemption through a canonical state:

status: parked

This allows:

- pausing lower-priority work
- switching to higher-priority tasks
- resuming work later

Important:

- Tasks are not interrupted arbitrarily
- Preemption is a manager decision
- All changes are visible and auditable

---

## Design Philosophy

AEP is not:

- a workflow engine
- a rule-based scheduler

AEP is:

> an organization runtime

Where:

- tasks are work
- teams are execution units
- managers enforce priorities
- cognition provides judgment

This is important because work is no longer modeled as direct system calls.  
It enters through a company front door, becomes a project, and then becomes canonical task responsibility.

That means:

- tasks have ownership and assignment
- employees act within authority and budget
- managers supervise and intervene
- outputs become visible and reviewable

The longer-term operating loop is richer than a single execution hop. AEP is moving toward a company heartbeat:

```text
research / request -> PM framing -> design -> delegation -> execution -> validation -> deployment / delivery -> follow-up communication
```

The current repository now has canonical primitives for this flow:

- intake requests capture demand
- projects structure execution
- project task graphs create canonical tasks and dependencies
- team loops select and execute ready work
- threads and messages publish public coordination rationale
- artifacts, decisions, approvals, and escalations preserve traceability

---

## Employees

Each employee is a durable digital person with a bounded execution model.

### 1. Identity, role, and employment
The employee's public organizational identity:

- company
- team
- role
- name / age
- employment state
- job description
- authority
- budget

The job description is public, stable, and company-owned. It defines responsibilities, success metrics, and constraints. It is not a prompt.

### 2. Runtime control
The employee's execution posture:

- runtime status
- runtime control state
- policy overlays
- operational constraints

Runtime control is separate from employment state.

Examples:

- `disabled` and `restricted` are runtime control outcomes
- `on_leave` and `terminated` are employment lifecycle states

### 3. Public profile
The human-facing projection:

- display name
- skills
- bio
- avatar / representation
- appearance summary
- public links / digital footprint

### 4. Private cognition
The internal employee boundary:

- base prompt / prompt profile
- decision style
- identity seed
- collaboration style
- portrait prompt
- internal reasoning

A core rule of AEP is:

> public profile is visible, private cognition is hidden

Only bounded public rationale may be published. There is no global shared agent mind.

---

<!-- BEGIN: docs/ci-mental-model.md -->
# CI / Validation Mental Model (Canonical)

## Purpose

CI in AEP is not just automation.

It is the **validation system of the organization**.

It exists to enforce:
- structure
- contracts
- policy
- execution correctness

---

## System model

CI is organized as a **layered validation system**.

### Validation layers

- **environment**
  - readiness
  - health checks
  - smoke validation

- **schema**
  - org schema
  - operator-agent org schema
  - coordination schema
  - inventory routes

- **contracts**
  - operator-agent contract
  - runtime projection
  - runtime provenance
  - tenant catalog
  - employee scope
  - provider checks
  - operator surface
  - thread task delegation

- **policy**
  - operator-agent behavior
  - manager policy overlay
  - approvals
  - escalations
  - routing
  - validation policy

- **scenarios**
  - post-deploy validation
  - dispatch / execution / verdict flows
  - approval / escalation thread delegation
  - paperclip execution
  - multi-worker coordination
  - synthetic failure testing

---

## Workflow model

Reusable workflows are structured by layer:

- `_validate_environment_layer.yml`
- `_validate_schema_layer.yml`
- `_validate_contracts_layer.yml`
- `_validate_policy_layer.yml`
- `_validate_scenarios_layer.yml`

Top-level workflows compose these layers into full validation lanes:

- preview
- staging
- production
- async-validation

---

## Script model

Validation scripts must follow a **layered directory structure**:

```
scripts/ci/checks/
  environment/
  schema/
  contracts/
  policy/
  scenarios/
```

Shared logic:

```
scripts/ci/tasks/
scripts/ci/shared/
```

Shell utilities:

```
scripts/ci/*.sh
```

---

## ❗ Forbidden pattern

Flat validation entrypoints are **deprecated and forbidden**.

Do NOT use:

```
scripts/ci/<file>.ts
```

All validation must reference:

```
scripts/ci/checks/<layer>/<script>.ts
```

---

## URL contract (CI.9)

All deploy and validation workflows operate on:

- `CONTROL_PLANE_BASE_URL`
- `OPERATOR_AGENT_BASE_URL`

### Resolution order

1. explicit workflow input
2. environment variable

### Important

- deploy outputs are **diagnostic only**
- validation must not depend on implicit URL resolution
- no legacy secret-based URL fallback is allowed

---

## Design principles

CI must be:

- **layered**
- **explicit**
- **composable**
- **contract-driven**

CI must NOT be:

- ad-hoc
- script-coupled
- environment-implicit
- dependent on hidden behavior

Reusable validation lanes must NOT:

- assume test-only `/agent/te/...` endpoints are enabled
- depend on seeded setup that exists only in test-mode environments

Reusable validation lanes should:

- prefer existing live approvals / escalations / threads where possible
- soft-skip cleanly when suitable live data is absent

---

## Mental model

CI is:

> the validation system of the organization

It is equivalent to:

- QA
- compliance
- operational verification

in a traditional company

---

## Invariants (must never change)

- validation is layered
- scripts are not flat
- workflows compose layers
- URL contract is explicit
- deploy and validation are separable but composable
- reusable workflows must avoid test-only endpoint assumptions

---

## Regression guard (for humans and LLMs)

If you see:

```
scripts/ci/<file>.ts
```

It is outdated and must be replaced with:

```
scripts/ci/checks/<layer>/<file>.ts
```

---

## Relationship to AEP architecture

CI is a **system layer**, alongside:

- execution (Workers / DO)
- AEP infra department
- future company layer

It enforces correctness across all of them.

---

## Final principle

> Build CI as part of the system, not around the system.
<!-- END: docs/ci-mental-model.md -->

---

## Human observability

AEP is designed so humans can work with the system naturally.

Humans should be able to see:
- what teams exist
- who the employees are
- what tasks are assigned
- what is blocked
- what decisions were made
- what results were produced
- what approvals or escalations are pending

Over time, humans should also be able to:
- review plans
- comment on work
- participate in message threads
- approve or redirect actions
- receive summaries in familiar channels

The intention is not to expose raw private cognition by default.  
Instead, AEP should expose **legible work artifacts**: plans, results, bounded public rationale, and communication threads.

That excludes:

- prompts
- personality configuration
- portrait prompts
- internal reasoning

---

## Slack and email

Slack and email may become important collaboration surfaces, but they are **not** the source of truth.

AEP remains canonical for:
- tasks
- messages
- plans
- results
- approvals
- organizational state

Slack and email are adapters for:
- collaboration
- notifications
- approvals
- stakeholder visibility

The same rule should apply to Jira or similar ticketing systems as they are introduced:

- AEP remains canonical for work state, provenance, and governance
- Jira-like systems are projection and collaboration adapters
- human edits in external systems must reconcile back through canonical AEP routes and mappings

---

## Current gap to the goal

The main gap is no longer foundational primitives. The repo already has durable employees, lifecycle, task coordination, canonical threads, mirrors, governance, and people-management surfaces.

The larger gap is organizational behavior:

- teams now have autonomous loop routes, persisted cadence, dashboard visibility, and canonical heartbeat publication
- PM, dev, infra, validation, and HR roles still need richer behavior specialization
- project / client / intake flows now exist canonically, but still need richer PM planning intelligence and external adapters
- Slack and email mirroring exist, but account provisioning and operational team usage are not yet first-class product features
- Jira-like ticket integration is not yet present
- the debug-only "god view" into inner cognition is intentionally absent today and would require a narrow, explicit super-admin boundary

So the next phase is not "add more agent primitives." It is:

> turn the current runtime into an operating digital company with real team loops and real product output

---

## Near-term evolution plan

The most important next steps are:

1. **PR15G — Documentation closeout**
  - mark PR15A-F complete
  - document the intake -> project -> task graph operating model
  - align README, LLM.md, and API.md around current code reality

2. **PR16 — Role-realism and team specialization**
  - make PM, Web, Infra, and Validation roles produce distinct kinds of work
  - strengthen team-specific task types, planning templates, and execution expectations
  - keep all work in canonical tasks, artifacts, threads, approvals, escalations, and project/task graph links

3. **PR17 — External collaboration adapters**
  - expand Slack, email, and later Jira while preserving AEP as the source of truth

4. **PR18 — HR / staffing workflow**
  - formalize job-description drafting, hiring requests, employee creation, and staffing gaps

5. **PR20 — Super-admin debug policy**
  - add a tightly scoped introspection path for cognition debugging without breaking default privacy boundaries

---

## Intake and project flow

AEP now has a canonical business-facing work entry path:

```text
request / research / client need
        ↓
intake request
        ↓
PM triage or conversion
        ↓
project
        ↓
canonical task graph
        ↓
team loops
        ↓
execution, validation, delivery, and follow-up
```

Important boundaries:

- intake is only a demand signal
- projects are containers, not execution engines
- executable work remains canonical tasks
- dependencies remain canonical task dependencies
- dashboard forms call backend routes and do not own state
- public rationale may be published to threads
- private cognition remains private

---

## Key design constraints

A few principles remain central:

- AEP coordinates and reasons; real side effects must stay controlled
- trace and audit are first-class
- the UI is a mirror of the system, not the source of truth
- cognition stays inside the employee boundary
- runtime control and employment lifecycle must remain distinct
- human collaboration should feel natural without requiring raw hidden reasoning
- external tools like Slack or email must not replace the internal system model

---

## Why this repo matters

AEP is the foundation for something larger:

> **zero-employee companies with real operational structure**

Not just bots.  
Not just workflows.  
A real digital organization with teams, responsibilities, supervision, and eventually cognition.

---

## Repository

Source of truth:

`guybarnahum/aep`

For deeper architecture and implementation context, see:

- `LLM.md`
