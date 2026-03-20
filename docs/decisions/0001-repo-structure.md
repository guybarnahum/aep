# ADR 0001: Repo structure

## Decision
Use a single monorepo rooted at `aep/` with stable top-level directories:

- `core/`
- `services/`
- `infra/`
- `apps/`
- `packages/`
- `examples/`
- `docs/`

## Rationale
The MVP should evolve into the full system without later reshuffling the repository.
