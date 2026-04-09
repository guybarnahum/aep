# LLM.md — AEP Project State, Mental Model, and Execution Plan

This document is the working continuity file for LLM sessions on AEP.

Its job is to:
- restore accurate project context quickly
- prevent architectural drift
- capture the current staged plan
- make the next implementation steps explicit

---

# 1. What AEP Is

AEP (Agentic Engineering Platform) is:

> the infra and operations kernel of an agentic, zero-employee company

AEP is not just:
- a workflow engine
- a deployment orchestrator
- a chatbot with tools

AEP is becoming:
- a company model
- an operating department model
- an employee model
- an auditable runtime for digital employees

The system is evolving from:

> “AI as a feature”

to

> “AI as the organization”

---

# 2. Ground Truth Architecture

## Execution boundary (critical)

AEP enforces a hard separation between:

### Worker runtime
Responsible for:
- orchestration
- workflow state
- policy checks
- agent runtime coordination
- trace and audit production

### External execution systems
Responsible for:
- deploy
- teardown
- validation side effects
- real-world infra mutation

This boundary must not be violated.

Workers coordinate and reason.
They do not directly perform uncontrolled infra mutations.

---

## Current runtime layers

### 1. Control plane
- Durable Object–based orchestration
- D1-backed state
- run / job / attempt model
- async pause / resume lifecycle
- trace-oriented observability

### 2. Operator-agent plane
- employee-facing and manager-facing operational APIs
- employee controls
- escalations
- approvals
- control history
- manager decision log
- scheduler status

### 3. Dashboard / ops-console plane
This is the operator observability surface.

Its purpose is not just UI polish.
It is the visible mirror of the system model.

### 4. CI / external execution plane
- deployment workflows
- health checks
- smoke checks
- surface checks
- structural validation

---

# 3. Current Conceptual Shift (Post-PR5)

PR5 established the critical shift:

> AEP is no longer “automation with AI”
> it is “organization modeled as employees”

Post-PR5, the next major step is:

> move from “a few named agents exist”
> to “a structured company and department model exists”

That is PR6.

---

# 4. Current Organizational Model

AEP is moving toward a model with explicit:

- company
- departments / teams
- employees
- managers
- task / decision / approval flows
- cross-team coordination
- scheduler / supervision
- observability surfaces that reflect these levels

The repo is already partially in this transition.

Important current reality:

## Two employee classes now exist

### A. Runtime employees
These are real implemented employees in runtime.
They can have:
- effectiveState
- effectiveBudget
- effectiveAuthority
- manager policy overlays
- control history

### B. Catalog / planned employees
These are defined as part of the org model but are not yet fully implemented in runtime.
They may have:
- catalog metadata
- scope
- message / placeholder explanation

They may not yet have:
- effectiveState
- effectiveBudget
- effectiveAuthority

This distinction is important and must be explicit.
The UI must not guess by missing fields forever; the runtime contract must eventually declare the distinction directly.

---

# 5. The Immediate Product Priority: Observability First

Before deeper agent cognition work, we want strong observability over what already exists.

This means:

> the dashboard and ops-console must mirror the levels of the system

Not just runs and jobs.

They should reflect:

- company
- departments / teams
- employees
- managers
- roadmaps
- work / decisions / approvals
- controls and escalations
- trace and execution

This observability-first step is intentional.

Reason:
- we already have meaningful runtime state and governance state
- we need visibility before adding more cognition
- without strong visibility, future LLM-driven behavior becomes hard to debug and trust

---

# 6. System Levels the UI Must Mirror

The dashboard and ops-console should converge toward reflecting the following levels.

## Level 1: Company
Questions the UI should answer:
- what company is this runtime representing?
- what teams exist?
- what is implemented vs planned?
- what is the active scheduler / governance posture?

## Level 2: Teams / departments
Questions:
- what teams exist?
- what roadmaps and objectives exist per team?
- what employees belong to each team?
- which teams are runtime-active vs catalog-only?

## Level 3: Employees
Questions:
- who are the employees?
- what role do they serve?
- what authority and budget do they have?
- what is their effective state?
- are they blocked, restricted, or planned?
- who manages them?

## Level 4: Governance and supervision
Questions:
- what escalations exist?
- what manager decisions were made?
- what approvals are pending or resolved?
- what control history exists for employees?

## Level 5: Work and execution
Questions:
- what runs, jobs, and attempts exist?
- how do they map to employees and departments?
- what traces and failure kinds are attached?

## Level 6: Cognition and communication (future-facing but planned)
Questions:
- what reasoning led to actions?
- what internal monologue was produced?
- what messages were exchanged between employees?
- what evidence and context drove decisions?

This level is not fully implemented yet, but it is part of the plan and should be represented in the architecture and docs now.

---

# 7. PR6 Staged Plan

This staged plan is the current working roadmap.

## 6A — Department Surface + Org Seeding
Goal:
Introduce the org model into runtime-facing APIs and dashboard surfaces.

Scope:
- employee catalog expansion
- multi-team model
- department dashboard view
- manager / approval / escalation / control-history surfaces
- roadmaps and scheduler status exposure
- CI checks for operator surface and multi-team shape

Reality:
This stage introduced mixed employee types:
- implemented runtime employees
- planned / catalog employees

This created UI shape bugs where the dashboard assumed all employees had full runtime fields.

### 6A done means
- org is visible
- teams are visible
- dashboard handles mixed employee shapes safely
- CI validates the surface

---

## 6B — Runtime Projection Contract
Goal:
Make the org/runtime contract explicit and stable.

This stage should introduce a canonical employee runtime projection, for example:

- identity
- companyId
- teamId
- runtimeStatus: implemented | planned | disabled
- effectiveState?
- effectiveBudget?
- effectiveAuthority?
- catalog metadata

Key requirement:
The backend must explicitly declare employee runtime status.
The UI should not infer meaning from missing fields.

### 6B done means
- stable employee API contract
- explicit distinction between planned and implemented employees
- no UI guesswork
- CI enforces shape consistency

---

## 6C — Company Coordination Model
Goal:
Move from “teams exist” to “teams interact”.

This stage includes:
- company-level identity as first-class
- cross-team work flow
- team-to-team dependency surfaces
- roadmap-to-execution relationship
- broader scheduler and coordination semantics

Example future flow:
- web team defines work
- infra team deploys
- validation team validates
- manager / approval / escalation chain governs execution

### 6C done means
- the UI and runtime model represent a company, not just a department
- cross-team coordination is explicit
- roadmaps connect to execution and governance

---

## 6D — Documentation and Concept Lock
Goal:
Make the project understandable to new humans and new LLM sessions without relying on memory.

This stage updates:
- README.md
- LLM.md
- dashboard / ops-console framing
- the observability-first roadmap
- the next cognitive layers

### 6D done means
- the current plan is written down
- the repo tells the truth about current state and next steps
- future sessions can continue without reconstructing intent from scratch

---

# 8. Observability-First Work Before Deeper Cognition

Before building richer LLM-driven introspection, the immediate product work should be:

## A. Make dashboard resilient
- support implemented and catalog employees safely
- remove assumptions that all employees have runtime-only fields
- expose planned vs implemented state clearly

## B. Expand dashboard to mirror system levels
- company / team / employee views
- manager decisions
- approvals
- escalations
- control history
- roadmaps
- scheduler status
- links to underlying runs / traces where applicable

## C. Expand ops-console to mirror execution levels
- run / job / attempt / trace
- tie execution back to employees / teams when available
- make it possible to move from org view to execution view

## D. Keep the two surfaces conceptually distinct
### Dashboard
Best for:
- org
- governance
- employee and team visibility
- approvals and escalations
- policy posture

### Ops-console
Best for:
- run / job / attempt detail
- trace detail
- execution debugging
- failure and remediation visibility

They should complement each other, not duplicate blindly.

---

# 9. Planned Next Cognitive Layer (After Observability)

Once observability is strong, the next major layer is:

> explicit agent cognition and communication

This includes two distinct concepts.

## A. Internal monologue
Private introspective thought produced by an employee / agent.

It is for:
- explainability
- debugging
- memory and reflection
- post-hoc reasoning audit

It is not the same as communication to other employees.

## B. Inter-employee messaging
Explicit messages exchanged between employees.

Examples:
- clarification
- escalation
- instruction
- negotiation

This is how the company becomes interactive rather than just independently acting employees.

---

# 10. Intended Design for LLM-Driven Introspection and Communication

This is not fully implemented yet, but it is the intended direction.

## Agent cycle shape
Each employee cycle should conceptually operate as:

1. read observations
2. read relevant work state
3. read messages addressed to the employee
4. invoke LLM with role / authority / context
5. receive structured output containing:
   - reasoning
   - internal monologue
   - proposed decisions
   - outgoing messages
6. persist those artifacts
7. execute allowed actions only through control-plane APIs

## Separation rule
Internal monologue and messages must remain distinct.

### Internal monologue
- private
- introspective
- traceable
- useful for memory and debugging

### Messages
- explicit communication
- persisted as inter-employee records
- visible in org / communication surfaces
- actionable by other employees

## Enforcement rule
No meaningful employee action should become a black box.
Over time, employee actions should be associated with:
- reasoning
- evidence
- trace linkage
- actor identity

---

# 11. Non-Negotiable Constraints

Do not violate these:

- do not execute uncontrolled infra mutation inside Workers
- do not bypass control-plane APIs
- do not let UI become the source of truth
- do not let the UI permanently infer semantics from missing fields
- do not introduce untraceable agent actions
- do not conflate private monologue with public inter-agent messaging

---

# 12. Current Recommended Sequence

The execution order from here should be:

## Step 1
Finish 6A safely:
- harden dashboard against mixed employee shapes
- make observability surfaces trustworthy

## Step 2
Proceed to 6B:
- define canonical employee runtime projection
- make operator-agent APIs explicit
- enforce with CI

## Step 3
Deepen observability:
- dashboard mirrors org and governance levels
- ops-console mirrors execution and trace levels
- bridge the two

## Step 4
Begin cognition layer:
- reasoning capture
- internal monologue persistence
- inter-employee messaging model
- bounded LLM invocation contract

---

# 13. Short Summary

AEP is currently in the transition from:

> agent-themed infra system

to

> observable, governable, multi-team agentic company runtime

The immediate priority is not “more AI”.
It is:

> observability that mirrors the real structure already present

After that, the next major milestone is:

> explicit reasoning, introspection, and communication between digital employees