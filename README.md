
# AEP — Agentic Engineering Platform

## What this is

AEP is the **infra department kernel** of a future:

> **Agentic, zero-employee companies**

It is not just infrastructure orchestration.

# AEP — Agentic Engineering Platform
- executes **workflows as operations**
AEP is the **infra department kernel** of a zero-employee, agentic company.

It models infrastructure operations not as scripts, but as a **stateful operating organization** with:
- agents (employees)
- workflows (operations)
- policies (governance)
- trace (audit)
- maintains **auditability and trace**

---

AEP is designed as the **self-operating infrastructure department** inside a larger agentic organization.

The goal is a system that can:
- plan
- deploy
- validate
- remediate

with minimal human intervention — while remaining **observable and controllable**.

- Cloudflare Workers / Durable Objects (today)
## Architecture

### Execution Boundary (Critical)

AEP enforces a strict separation:

- **Worker runtime** → orchestration + decision-making  
- **CI / external systems** → real execution (deploy, teardown)

This ensures:
- deterministic control-plane behavior
- safe retries and idempotency
- clear audit boundaries

---

### Operational Planes

AEP operates across five logical planes:

1. **Control Plane**
   - Durable Object orchestration
   - jobs, attempts, workflow state

2. **Execution Plane**
   - CI and provider integrations
   - deploy / teardown actions

3. **Observability Plane**
   - trace-first system (`/trace/:id`)
   - structured failure + audit data

4. **Governance Plane**
   - budgets, cooldowns, authority scopes
   - safe mutation enforcement

5. **Delivery Plane**
   - GitHub Actions integration
   - proving-ground environments

These are logical separations, not separate services.


## Agent Model

AEP models agents as **employees with identity and role**.

Current system:

- **Marcus (`emp_pm_01`)**
  - Product Manager
  - translates strategy → tasks

- **Sia (`emp_val_specialist_01`)**
  - Reliability Engineer
  - validates deployments and system safety

Agents:
- observe system state
- produce reasoning
- act through the control plane

All actions are:
- attributed
- recorded
- auditable
This is where:
- work is executed
## Scheduling Model (Bounded Autonomy)

AEP operates under infrastructure constraints (e.g., Cloudflare limits).

To remain safe and predictable:

- agents run in bounded cycles
- background scanners are rate-limited
- work is distributed across ticks

Example:
- validation runs continuously
- recovery tasks are alternated per cycle

This prevents:
- runaway execution
- unbounded retries
- system overload
### 3. Company Layer (future — “Paperclip”)
- org structure
- budgets
- strategy
AEP separates **authority, provenance, and decisions**.

### Work Orders (Authority)

- `workOrderId`
- authoritative D1 record
- lifecycle:
  - `pending → in-progress → completed`

### Tasks (Provenance)

- `taskId`
- cross-system identifier
- not authoritative on its own

### Decision Ledger

Every action produces a decision:

- `pass`
- `fail`
- `remediate`
- `retry`

Each decision is:
- linked to trace
- attributable to an agent
- replayable

This enables full reconstruction of system behavior.


- Durable Object–based orchestration
- async workflow execution (deploy / teardown)
AEP is now a **stateful autonomous infrastructure department**.

- control-plane: stable and orchestrating real workflows
- workflow engine: async, retry-safe, observable
- CI: real deployment validation
- trace: complete audit surface
- agents: active (Marcus, Sia)
- org model: D1-backed identities and roles

The system is:
- self-operating (bounded)
- observable
- safe to extend


- lifecycle: `waiting → running → completed | failed`
- async external execution model
1. Inter-agent negotiation (task clarification, budget escalation)
2. Scoped agent identity (JWT + attribution)
3. Episodic memory (vector retrieval of past failures)
4. Real provider integrations (AWS, GCP, etc.)
---
### Operator Surface

APIs:
- `/runs`
- `/runs/:id`
- `/runs/:id/jobs`
- `/tenants`
- `/services`

Capabilities:
- full run visibility
- job + attempt inspection
- derived status + failure classification

---

### Observability (Critical)

- normalized `/trace/:id`
- structured failure payloads:
  - `failure_kind`
  - attempt context
- CI-integrated summaries

Trace is the **source of truth**.

---

### CI / Validation System

- deploy via GitHub Actions
- D1 migrations
- health checks (`/healthz`)
- smoke tests (`/workflow/start`)
- SHA verification

CI is:
> the **real execution validator**

Worker runtime remains:
> orchestration + control-plane only

---

## PR5 Shift: From Automation → Digital Employees

AEP has crossed a major boundary:

> AI is no longer a feature — it is the organization.

We now model **agents as employees**.

---

## Current Agent System

### Strategic Loop (v1)

Two agents drive the system:

#### Marcus (`emp_pm_01`)
- Role: Product Manager
- Focus: strategy → tasks
- Concern: *why*

#### Sia (`emp_val_specialist_01`)
- Role: Reliability Engineer
- Focus: validation + safety
- Concern: *how*

They operate through:
- the control plane
- the tactical ledger (runs/jobs)
- structured reasoning + decisions

---

## Runtime Model

### How agents run

1. Agent **senses** system state (runs, jobs, roadmap)
2. Agent produces:
   - reasoning
   - internal monologue
3. Agent **acts**:
   - creates tasks
   - advances workflows
   - validates execution

All actions:
- go through control-plane APIs
- are recorded in trace + decisions

---

### Human Interaction Model

Humans interact via:

#### 1. APIs
- full operator control
- can inspect and intervene

#### 2. Dashboard (apps/dashboard)
- visualize runs, jobs, traces
- audit agent decisions
- trigger workflows

#### 3. CI System
- acts as execution validator
- ensures real-world correctness

---

## Design Principles

### 1. Separation of Concerns

- Worker runtime: orchestration only
- CI / external systems: execution
- agents: decision-making

---

### 2. Auditability First

Every decision:
- is recorded
- is attributable
- is replayable

---

### 3. Safe Mutation Surface

- no arbitrary state mutation
- all actions go through defined APIs
- idempotent + retry-safe

---

### 4. Agent-Compatible by Design

System is built so that:
- agents can operate it safely
- humans and agents use the same surface

---

## Current State

> **Strategic Ready**

- Control plane: stable
- Workflow engine: production-grade semantics
- CI validation: operational
- Operator surface: usable
- Agents: initialized (Marcus, Sia)
- Dashboard: placeholder but structured

---

## Near-Term Roadmap

### 1. Inter-Agent Collaboration
- negotiation between agents
- shared message channel (D1)

---

### 2. Identity & Security
- scoped agent tokens (JWT)
- per-action attribution

---

### 3. Memory System
- vectorized episodic memory
- retrieval of past runs / failures

---

### 4. Real Provider Integration
- AWS / GCP connectors
- real resource sensing

---

## What This Becomes

AEP evolves into:

> a **self-operating infrastructure organization**

Where:
- agents plan
- agents validate
- agents operate
- humans supervise

---

## Repository

https://github.com/guybarnahum/aep