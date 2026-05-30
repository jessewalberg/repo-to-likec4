---
node: module:tools/factory/lib/schema.mjs
provenance: machine
pinned: false
---
# schema.mjs

Schema definition module that imports DAG utilities to establish structured data contracts. Consumed by both the CLI command interface (`cli.mjs`) and policy validation (`policy.mjs`), serving as a shared schema layer between command-line interaction and policy-driven configuration. Acts as the contract bridge for how data flows between user input, graph operations, and policy enforcement.
