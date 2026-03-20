# ADR 0003: Observability first

## Decision
Every workflow step must emit structured events from day one.

## Rationale
The system is not trustworthy unless a human can see what happened, why, and what remains after teardown.
