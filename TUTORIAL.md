# 🚀 AEP Product Initiative Tutorial

## Purpose

This tutorial explains how a human project initiator uses AEP to define, build,
deploy, observe, and continuously steer a product through an organization
runtime, not by implementing it directly.

The goal of PR19 is to make this user experience real.

The post-PR25 system implements the underlying organization runtime for this
flow. PR26 makes the flow manually operable from the dashboard for QA. PR27
makes the flow fully closable by adding the deployment-record creation step.

## Core idea

AEP product construction is not a pipeline.

It is a continuous organizational loop:

```text
intake
→ product initiative
→ task graph
→ staffed execution
→ artifacts
→ approvals
→ deployment
→ validation
→ feedback
→ redesign / new tasks
→ redeploy
→ monitoring
→ repeat
```

The product can eventually produce a separate GitHub repository and a live
customer-facing surface, but AEP remains the source of truth for work,
decisions, staffing, approvals, validation, deployment, and observability.

## Human visibility and intervention

AEP must be autonomous by default and interruptible by design.

Humans must be able to see:

- active initiatives
- task graph state
- owners and staffing gaps
- blockers and dependencies
- public decision rationale
- validation results
- deployment state
- Jira / external mirrored status

Humans must be able to intervene through canonical AEP surfaces:

- modify requirements
- request redesign
- add constraints
- approve or block deployment
- approve or reject staffing expansion
- escalate issues
- pause, resume, retire, or transition an initiative

Human intervention must happen through tasks, approvals, and threads/messages.
It must not bypass AEP by directly mutating code, deployment state, Jira state,
or product state.

## Product initiator flow

Manual dashboard QA path through normal product UI:

```text
Product initiatives
→ Product intake flow
→ Intake & Projects conversion
→ Product initiative detail
→ Product operator controls
→ deployment approval / execution
→ lifecycle request / execution
→ signal simulation
```

Manual steering safety:

- approve or reject deployment approvals from deployment-linked approval controls
- approve or reject lifecycle approvals from lifecycle controls
- preserve target-state intent when requesting a lifecycle transition
- execute deployments only after checking internal-only vs external-safe approval policy

### 1. Define intent

```text
Create a product initiative.

Title:
AEP Marketing Website

Initiative kind:
marketing_site

Product surface:
website_bundle

External visibility:
external_safe

Goal:
Explain AEP and let users submit prospective projects.

Audience:
CTOs, founders, technical operators.

Expected deliverable:
- GitHub repo
- deployed site
- intake integration
- monitoring and visible progress

Constraints:
- no state outside AEP
- no private cognition exposed
- all work through tasks, artifacts, approvals, staffing, and deployment records
```

### 2. Submit intake

The user or UI submits demand into canonical intake:

```http
POST /agent/intake
```

Intake is a demand signal only. It does not execute work.

### 3. Convert intake to product initiative

A PM converts intake into a canonical project:

```http
POST /agent/intake/:id/convert-to-project
```

For PR19, the project carries product initiative metadata:

```json
{
  "initiativeKind": "marketing_site",
  "productSurface": "website_bundle",
  "externalVisibility": "external_safe"
}
```

### 4. Create the task graph

AEP creates canonical tasks such as:

```text
project_planning
→ requirements_definition
→ task_graph_planning
→ web_design
→ web_implementation
→ deployment
→ test_execution
→ verification
→ monitoring_setup
```

This graph is not fixed. Validation, QA, human feedback, and production
monitoring may create new tasks and change direction for the life of the
product.

### 5. Staff the work

If capability is missing:

```text
role_gap
→ staffing_request
→ approval
→ employee creation
→ assigned work
```

### 6. Produce artifacts

Expected artifacts include:

- requirements artifacts
- design artifacts
- implementation/repo artifacts
- deployment bundles
- validation results
- public rationale artifacts
- deployment records

### 7. Deploy and observe

AEP deploys through canonical deployment work:

```text
deployable artifact
→ deployment task
→ approval if required
→ live URL
→ monitoring
→ validation feedback
```

## UI requirements

To make the tutorial real, AEP needs user-facing surfaces for:

- initiative creation and update
- initiative dashboard
- task graph visibility
- decision timeline
- validation panel
- deployment panel
- intervention controls
- Jira / external mirror status

Important controls:

- modify requirements
- request redesign
- approve deployment
- reject deployment
- escalate issue
- pause initiative
- resume initiative
- retire / transition initiative

Every control must map to canonical tasks, approvals, or threads/messages.

The dashboard must not contain dedicated tutorial-only surfaces. The tutorial is
validated through normal product operator UI.

## Jira / external mirroring

Jira-like tools are visibility and collaboration surfaces only.

Suggested mapping:

| Jira | AEP |
| --- | --- |
| Epic | Product initiative project |
| Story | Task |
| Ticket | Intake |
| Comment | Thread message |
| Status update | Mirrored projection / signal |

Jira may mirror:

- initiative status
- task graph state
- validation results
- deployment status
- public rationale
- blockers and approvals

Jira may send:

- new tickets into intake
- comments into canonical threads
- allowed actions into canonical AEP routes

Jira must not:

- own task state
- own project state
- directly mutate deployment state
- bypass approvals
- expose private cognition

## PR19 implementation target

PR19 should make this tutorial real in stages:

- PR19A — product initiative model
- PR19B — deployable artifact contract
- PR19C — deployment system
- PR19D — external surface contract
- PR19E — customer intake flow
- PR19F — agentic execution through tasks and staffing
- PR19G — observability and human intervention surfaces
- PR19H — CI guards
- PR19I — documentation closeout

The goal is not merely to document this workflow.

The goal is to make this the actual user experience of AEP.
