# AEP — Product Construction Whitepaper

## Abstract

AEP is not a workflow tool and not a code generator.

It is an **organization runtime**.

This document explains how AEP turns a human-defined initiative into a real, evolving product that:

- is built through teams and tasks  
- is visible to humans  
- can be steered at any point  
- can receive real customer input  
- can evolve continuously over time  

This whitepaper connects the system design (PR19 and earlier) to the actual user experience described in `TUTORIAL.md`.

---

# 1. The Core Idea

Traditional systems do this:

```text
user → pipeline → output
```

AEP does this:

```text
initiative → organization → tasks → artifacts → deployment → users
                                     ↑                         ↓
                                     └────────── feedback ─────┘
```

The key difference:

> **There is no pipeline. There is a loop.**

And that loop is driven by an **organization**, not a script.

---

# 2. What AEP Actually Is

AEP models:

- companies  
- teams  
- employees  
- tasks  
- approvals  
- artifacts  
- coordination  

Everything happens through those primitives.

Nothing bypasses them.

---

# 3. The Product Lifecycle in AEP

## Step 1 — Initiative (PR19A)

A product starts as a **project initiative**:

```text
human → POST /agent/projects
```

This defines:

- what we are building  
- what surface (website, API, etc.)  
- visibility (internal vs external)  

The system immediately creates:

- planning tasks  
- coordination threads  

No product is built yet.

---

## Step 2 — Work is Performed (existing system + PR19F)

Work happens through:

```text
tasks → employees → execution
```

Outputs are stored as:

```text
task artifacts
```

Examples:

- plan  
- design  
- code  
- repository  
- bundle  

Important:

> Artifacts are the only outputs that matter.

---

## Step 3 — Artifacts Become Deployable (PR19B)

Some artifacts are marked as:

```text
deployableArtifactKind
```

Examples:

- github_repository  
- website_bundle  
- deployment_candidate  

This does NOT deploy anything.

It only declares:

> “This can be deployed later.”

---

## Step 4 — Deployment Records (PR19C)

Deployment is modeled as:

```text
deployment record
```

Created via:

```text
POST /agent/product-deployments
```

A deployment record:

- links to the artifact  
- links to the project  
- has a lifecycle (requested → deployed)  
- may require approval  

Important:

> AEP owns the deployment state.  
> External systems do not.

---

## Step 5 — External Surface (PR19D)

A product may expose a **customer-facing surface**.

Examples:

- marketing site  
- intake form  
- public progress  

These surfaces:

- DO NOT own state  
- DO NOT mutate tasks  
- DO NOT mutate deployments  

They are strictly limited to:

```text
safe actions
```

Such as:

- submit intake  
- view public data  

---

## Step 6 — Customer Input (PR19E)

External users interact through:

```text
POST /agent/customer-intake
```

This creates:

- canonical intake request  
- coordination thread  

It does NOT:

- create projects  
- create tasks  
- deploy anything  

Important rule:

> **Customers create demand.  
> The organization decides what to do with it.**

---

## Step 7 — The Loop Closes

Now the system becomes:

```text
initiative
  → tasks
  → artifacts
  → deployment
  → external usage
  → intake
  → new tasks
  → evolution
```

This is the critical transition:

> From one-time build → continuous system

---

# 4. Human Visibility and Intervention

AEP is not autonomous in the sense of being opaque.

It is **visible and steerable**.

Humans can:

- view projects  
- view tasks  
- view artifacts  
- view deployments  
- view intake  

And intervene by:

- approving  
- commenting  
- redirecting work  
- changing priorities  

This happens through:

```text
threads + approvals + tasks
```

Not through hidden prompts.

---

# 5. Why This Is Not a Pipeline

A pipeline assumes:

```text
input → fixed steps → output
```

AEP assumes:

```text
state evolves continuously
```

Because:

- QA can change design  
- design can create new tasks  
- customer input can redirect work  
- deployment can fail and restart  

There is no fixed order.

---

# 6. External Systems (GitHub, Cloudflare, Jira)

External systems are:

```text
adapters
```

They may:

- store code (GitHub)  
- host sites (Cloudflare)  
- mirror work (Jira)  

But they never:

- own product state  
- own deployment state  
- define truth  

Truth always lives in AEP.

---

# 7. Why This Matters

This system enables:

## Continuous products

Not:

```text
build → ship → done
```

But:

```text
build → ship → learn → adapt → repeat
```

---

## Human control

Not:

```text
AI runs everything
```

But:

```text
AI executes within visible boundaries
```

---

## Real feedback

Not:

```text
simulated validation
```

But:

```text
real users → real input → real changes
```

---

# 8. Mapping to TUTORIAL.md

The tutorial experience becomes real because:

## “Define a project”

→ PR19A

## “System builds it”

→ tasks + artifacts

## “See progress”

→ threads + artifacts + deployments

## “Intervene”

→ approvals + threads

## “Product exists”

→ PR19B + PR19C

## “Users interact”

→ PR19D + PR19E

## “Product evolves”

→ loop (PR19F + PR19G)

---

# 9. Final Mental Model

Think of AEP as:

> A company that happens to be implemented in code.

Not:

- a CI system  
- a workflow engine  
- a chatbot  

---

# 10. One-Line Summary

> AEP turns product development into a **continuous, visible, and steerable organizational loop**, where code, decisions, deployments, and customer input all live in the same system.