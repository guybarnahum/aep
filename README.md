# AEP — Agentic Engineering Platform

👉 https://github.com/guybarnahum/aep

---

# What AEP Is

AEP is the **infra department of a zero-employee company**.

It is a system where:

- software systems act as employees
- teams exist as structured units
- decisions are governed and observable
- operations are executed through controlled interfaces

---

# The Core Idea

> AI is not a feature  
> → it is the organization

AEP models:

- employees (agents)
- teams (functions)
- governance (policy + control)
- execution (control plane)
- observation (dashboard)

---

# System Architecture

## Execution Layer
- Cloudflare Workers
- Durable Objects
- Async workflows

## AEP Layer
- employee system
- governance + policy
- operator surface
- dashboard

## Company Layer (future)
- strategy
- budgeting
- coordination

---

# Employees (Core Concept)

Each employee is a **first-class unit** with:

## Identity + Runtime
- role
- team
- authority
- budget
- operational state

## Public Profile
- name
- skills
- bio

## Private Cognitive Layer
- prompt profile
- decision style
- reasoning (future)

---

# What Exists Today

## Org Model
- company
- teams
- employees (planned + implemented)

## Control Plane
- async execution
- workflow orchestration
- retry + timeout
- state tracking

## Governance
- authority enforcement
- budget control
- escalation

## Dashboard
- org view
- employees
- escalations
- approvals
- control history
- roadmap visibility

---

# Current State

AEP is now:

> a functioning agentic infrastructure department

It has:

- structured employees
- clear boundaries
- observable behavior
- enforced contracts

---

# What’s Next (PR6C)

We are moving to:

> **company coordination**

Next capabilities:

- cross-team workflows
- roadmap-driven execution
- company scheduler
- inter-employee communication

Example:

```
Product defines → Infra deploys → Validation validates
```

---

# Vision

AEP evolves toward:

> fully autonomous organizations

Where systems can:

- operate continuously
- reason about outcomes
- coordinate across teams
- improve their own structure

---

## External execution systems
Responsible for:
- deploy
- teardown
- real-world validation side effects
- infra mutation

This separation is intentional.
Workers reason and coordinate.
External systems perform the real side effects.

This keeps the system:
- auditable
- retry-safe
- easier to reason about
- safer for automation

---

# What Exists Today

AEP already has meaningful pieces of a digital operations organization.

## Control plane
- Durable Object orchestration
- D1-backed state
- run / job / attempt lifecycle
- async pause / resume semantics
- trace-oriented observability

## Operator-agent surface
The runtime already exposes organization and governance-oriented surfaces such as:
- employees
- escalations
- approvals
- manager log
- control history
- roadmaps
- scheduler status

## Dashboard
The dashboard is the operator-facing organization and governance view.

It is intended to show:
- tenant and service state
- department and employee state
- escalations
- approvals
- manager decisions
- control history
- roadmaps
- scheduler posture

## CI / validation
GitHub Actions and CI checks validate:
- deploy health
- smoke behavior
- operator surface consistency
- multi-team and governance shape

---

# Current Transition: From Agents to Organization

PR5 established the major shift:

> AI is no longer just a feature of the system.
> It is the beginning of the organization.

The project is now moving through PR6, which is about turning that concept into a real, observable company and department model.

AEP is no longer just “a couple of named agents”.
It is moving toward:
- company
- teams / departments
- employees
- managers
- approvals
- escalations
- supervision
- eventually reasoning and inter-employee communication

---

# Current Organizational Reality

The project currently contains two kinds of employees.

## Implemented runtime employees
These are active in runtime and can have:
- effective state
- effective authority
- effective budget
- controls and overlays
- manager and approval history

## Catalog / planned employees
These are part of the organization model but are not yet fully implemented in runtime.

They may carry:
- catalog metadata
- scope
- placeholder messaging

They may not yet carry the same runtime fields as active employees.

This distinction matters.
It is a real part of the current design state.

---

# Why Observability Comes First

Before adding deeper agent cognition, the immediate priority is strong observability.

The dashboard and ops-console should mirror the levels of the system.

## The system levels we want visible

### Company
- what company and teams exist
- what is implemented vs planned
- overall scheduler / governance posture

### Teams / departments
- who belongs to each team
- what objectives and roadmaps exist
- what teams are active in runtime

### Employees
- identity
- role
- manager relationship
- runtime status
- authority and budget
- control state

### Governance
- escalations
- approvals
- manager decisions
- control history

### Execution
- runs
- jobs
- attempts
- trace
- failure and remediation context

This observability-first step is intentional.
It makes the current system understandable and debuggable before richer LLM-driven behavior is introduced.

---

# Dashboard vs Ops-Console

These are complementary surfaces.

## Dashboard
Best for:
- organization view
- team and employee view
- governance view
- manager / approval / escalation visibility
- roadmap and scheduler visibility

## Ops-console
Best for:
- run / job / attempt detail
- trace detail
- execution debugging
- remediation visibility
- deeper operational forensics

Together, they should mirror the real structure of the system from company level down to trace level.

---

# PR6 Plan

## 6A — Department Surface + Org Seeding
Introduce the org model into runtime-facing APIs and dashboard surfaces.

Includes:
- multi-team employee catalog
- department view
- governance surfaces
- roadmaps and scheduler visibility
- CI checks for operator surface shape

Immediate requirement:
- the dashboard must safely support mixed employee shapes

## 6B — Runtime Projection Contract
Define a stable backend contract for employees and teams.

Includes:
- explicit runtime status such as implemented vs planned
- canonical employee projection
- removal of UI guesswork
- CI enforcement of the contract

## 6C — Company Coordination Model
Move from “teams exist” to “teams interact”.

Includes:
- company-level identity
- cross-team work and dependency flow
- roadmap-to-execution linkage
- broader scheduler and supervision model

## 6D — Documentation and Concept Lock
Update the docs so humans and LLM sessions can continue from the real plan without reconstructing it from memory.

---

# What Comes After Observability

Once observability is strong and the org/runtime contract is explicit, the next major layer is:

## LLM-driven introspection
Employees produce:
- reasoning
- internal monologue
- traceable decisions

## Inter-employee messaging
Employees exchange explicit messages such as:
- clarification
- escalation
- instruction
- negotiation

This is how the system evolves from a structured control plane into a real digital organization.

Important distinction:
- internal monologue is private introspection
- messages are explicit communication between employees

They should not be conflated.

---

# Constraints

The following constraints remain central:

- Workers orchestrate and reason; they do not perform uncontrolled infra mutation
- Real side effects must go through explicit control-plane and external execution boundaries
- Trace and audit remain first-class
- UI is a mirror of the system, not the source of truth
- Future employee actions must become explainable and attributable

---

# Current Priority

The immediate priority is:

> make the dashboard and ops-console capture the levels of the system that already exist

That means:
- finishing the department and governance observability surfaces
- making the UI resilient to mixed employee types
- tightening the backend runtime projection contract
- then continuing into deeper cognition and communication

---

# Repository

Source of truth:
`guybarnahum/aep`

Suggested companion doc for ongoing implementation context:
- `LLM.md`