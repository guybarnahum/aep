# 🧠 LLM.md — AEP Cognitive Context & Continuity

This document is the **source of truth for LLM sessions** working on AEP.

It exists to:
- restore context quickly
- anchor decisions in system reality
- guide next implementation steps
- prevent drift or hallucinated architecture

---

# 1. What AEP Is

AEP (Agentic Engineering Platform) is:

> the **infra department kernel of a zero-employee company**

It is a system where:
- agents = employees
- workflows = operations
- control-plane = management layer
- trace = audit + memory

AEP is NOT:
- a chatbot
- a simple workflow engine
- a stateless automation system

---

# 2. Core Architecture (Ground Truth)

## Execution Boundary (CRITICAL)

AEP enforces a hard separation:

- **Worker runtime (Cloudflare)**
  - orchestration
  - workflow state
  - agent reasoning (future/partial)

- **External systems (CI / providers)**
  - actual execution (deploy, teardown)
  - real-world side effects

This must NEVER be violated.

---

## Control Plane

- Durable Object–based orchestration
- D1-backed state
- job + attempt model
- async execution lifecycle:
  - `waiting → running → completed | failed`
- pause / resume supported

---

## Observability

- `/trace/:id` is the **source of truth**
- every step emits structured events
- failures are classified (`failure_kind`)

---

## CI Role

CI is:
> the **real execution validator**

It performs:
- deploy
- health checks
- smoke tests

The control-plane:
> models and verifies — but does not execute infra mutations

---

# 3. Agent System (PR5 Shift)

We have crossed a major boundary:

> AI is now the organization, not a feature

Agents are modeled as **employees with identity**.

---

## Current Agents

### Marcus (`emp_pm_01`)
- Role: Product Manager
- Focus: roadmap → tasks
- Concern: WHY

### Sia (`emp_val_specialist_01`)
- Role: Reliability Engineer
- Focus: validation + safety
- Concern: HOW

---

## Agent Behavior Model

Agents must:

1. **Sense**
   - runs
   - jobs
   - failures
   - roadmap

2. **Think**
   - structured reasoning
   - internal monologue

3. **Act**
   - create tasks
   - validate deployments
   - advance workflows

All actions:
- go through control-plane APIs
- are recorded in trace
- are attributable

---

# 4. Task & Decision Model

AEP separates:

## Authority
- `workOrderId`
- D1-backed
- lifecycle tracked

## Provenance
- `taskId`
- cross-system identifier

## Decisions

Every action produces:

- `pass`
- `fail`
- `remediate`
- `retry`

Each decision:
- linked to trace
- attributable to agent
- replayable

This is the **forensic backbone of the system**.

---

# 5. Scheduling Model

System operates under constraints (Cloudflare limits).

Therefore:

- bounded execution cycles
- rate-limited background work
- alternating recovery / retry patterns

This prevents:
- runaway loops
- unbounded retries
- infra overload

---

# 6. Current State (IMPORTANT)

## Maturity

> **Stateful Autonomous Infra Department (Commit ~14 / PR5)**

### What is working

- control-plane orchestration (stable)
- async workflow engine
- job + attempt model
- retry + timeout handling
- pause / resume
- trace reconstruction
- CI validation pipeline
- agent identities seeded (Marcus, Sia)

### What is partially implemented

- agent reasoning loop (not fully enforced in runtime)
- decision recording (exists, not fully standardized)
- org model (exists, not fully dynamic)

### What is NOT yet implemented

- inter-agent communication
- long-term memory
- real cloud provider integrations
- scoped agent identity (JWT)
- negotiation / conflict resolution

---

# 7. Immediate Next Steps (Execution Priority)

## 1. Enforce Agent Reasoning Contract

Every agent action must require:

- `reasoning`
- `internal_monologue`

Persist in:
- decisions table OR trace events

Goal:
> eliminate black-box behavior

---

## 2. Standardize Decision Ledger

Define and enforce schema:

- decision_type (`pass | fail | remediate | retry`)
- linked `workOrderId`
- linked trace id
- `employeeId`

Goal:
> make decisions first-class and queryable

---

## 3. Inter-Agent Communication (Critical)

Introduce:

### `messages` table (D1)

Fields:
- id
- from_employee_id
- to_employee_id
- work_order_id (optional)
- message_type:
  - clarification
  - escalation
  - negotiation
- content
- status

Use case:
- Sia requests clarification from Marcus
- budget escalation
- task refinement

---

## 4. Agent Identity & Security

Replace shared secrets with:

- scoped JWT per agent run
- signed actions
- audit trail per employeeId

---

## 5. Episodic Memory

- store `internal_monologue` embeddings
- use vector search (Cloudflare Vectorize)

Goal:
> agents recall past failures and patterns

---

## 6. Real Provider Integration

Move beyond mock:

- AWS / GCP connectors
- resource sensing
- real deploy validation

---

# 8. Constraints (DO NOT VIOLATE)

- do NOT execute infra mutations inside Workers
- do NOT bypass control-plane APIs
- do NOT introduce non-auditable state changes
- do NOT allow agents to act without reasoning
- do NOT break trace consistency

---

# 9. How to Continue Work (For Next LLM Session)

When starting a new session:

1. Read this file fully
2. Assume:
   - control-plane is stable
   - agents exist but are primitive
3. Focus on:
   - decision system
   - agent loop enforcement
   - communication layer

Avoid:
- reworking control-plane fundamentals
- adding new abstractions prematurely

---

# 10. Summary

AEP is becoming:

> a **self-operating infrastructure organization**

Current phase:

> transition from **workflow engine → agentic organization**

Key gap:

> agents must become **stateful, accountable, and collaborative**

Everything else builds on that.