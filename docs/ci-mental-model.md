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