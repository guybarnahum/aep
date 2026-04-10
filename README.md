# AEP — Agentic Engineering Platform

AEP is the **infra department of a zero-employee company**.

It is a system for modeling and operating digital employees: teams, managers, tasks, governance, and eventually cognition. Today, AEP is evolving from an execution-oriented control plane into the kernel of a real agentic organization.

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

## What AEP is becoming

AEP is not just a workflow runner or a bot framework.

It is becoming an **operating system for digital employees**, with core primitives such as:

- identity
- authority
- task
- plan
- result
- approval
- escalation
- observability

The long-term goal is a company where software systems can:
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

---

## How the system works

AEP is moving toward a simple organizational model:

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

## What exists today

AEP already has meaningful parts of a digital operations organization.

### Organization model
- company
- teams
- employees
- managers
- planned and implemented employee types

### Control plane
- async execution
- run / job / attempt lifecycle
- retries and timeouts
- trace-oriented observability

### Governance
- approvals
- escalations
- manager logs
- control history
- budget and authority enforcement

### Dashboard
- organization and department view
- employee visibility
- approvals and escalations
- roadmap and scheduler visibility

### CI / validation
- health checks
- deploy validation
- operator surface checks
- org shape checks

---

## Current state

AEP is now a **structured, observable agentic infra department**.

It already models:
- teams
- employees
- supervision
- governance
- task-based work coordination

The next major step is to make those employees truly **cognitive and collaborative**.

---

## Roadmap

### PR6 — Organization kernel
PR6 is about making the organization real and operational.

It includes:
- org surface and seeding
- employee runtime boundary
- task coordination
- task dependencies and orchestration
- durable task artifacts such as plans and results
- documentation lock

The goal of PR6 is:

> a clean structural kernel for an operating digital organization

### PR7 — Cognitive organization
PR7 is the next major phase.

It will introduce:
- employee reasoning loops
- internal communication and message threads
- planning and delegation
- result publishing
- natural human collaboration
- Slack and email adapters

The goal of PR7 is:

> employees that can think, communicate, assign, and collaborate

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