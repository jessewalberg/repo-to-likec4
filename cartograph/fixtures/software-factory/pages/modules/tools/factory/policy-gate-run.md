---
node: module:tools/factory/policy-gate-run.mjs
provenance: machine
pinned: false
---
# policy-gate-run.mjs

Entry-point runner for policy gate enforcement. Imports `policy.mjs` to access policy definitions and validation logic, then executes them against factory operations. As a top-level component with no incoming dependencies, it serves as a standalone execution tool or CLI entry point for the policy validation workflow.
