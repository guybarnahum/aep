# AEP — Agentic Engineering Platform

AEP is the **infra department of a zero-employee company**.

It is a system for modeling and operating digital employees: teams, managers, tasks, governance, and cognition. AEP is intended to serve as the kernel of a real agentic organization.

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

---

## How the system works

AEP uses a simple organizational model:

```text
task → assigned employee → execution → decision → result
```

This is important because work is no longer modeled as direct system calls.  
It is modeled as **organizational responsibility**.

That means:

- tasks have ownership and assignment
- employees act within authority and budget
- managers supervise and intervene
- outputs become visible and reviewable

---

## Employees

Each employee is a bounded unit with three layers:

### 1. Identity and runtime
The employee’s role in the org:

- company
- team
- role
- runtime status
- authority
- budget
- operational state

### 2. Public profile
The human-facing projection:

- display name
- skills
- bio
- avatar / representation

### 3. Private cognitive layer
The internal employee mind:

- prompt profile
- decision style
- identity seed
- memory and reasoning over time

A core rule of AEP is:

> cognition belongs inside the employee

There is no global shared agent mind.

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
- `_validate_post_deploy.yml`

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
Instead, AEP should expose **legible work artifacts**: plans, results, rationale summaries, and communication threads.

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

---

## Key design constraints

A few principles remain central:

- AEP coordinates and reasons; real side effects must stay controlled
- trace and audit are first-class
- the UI is a mirror of the system, not the source of truth
- cognition stays inside the employee boundary
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
