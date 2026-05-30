---
node: module:tools/factory/lib/policy.mjs
provenance: machine
pinned: false
---
# policy.mjs

Provides policy definitions and enforcement logic used across factory operations. Imports glob patterns and schema validation from sibling modules, and is consumed by the CLI entry point, cursor-scope runner, and policy-gate runner to validate and filter operations against configured policies.
