---
node: module:tools/factory/lib/dag.mjs
provenance: machine
pinned: false
---
# dag.mjs

Provides DAG (directed acyclic graph) primitives for building task workflows. Consumed by epic coordinator, issue runner, and schema modules to represent and manage dependencies between work items. Acts as a foundational library with no external dependencies, abstracting the graph structure needed for coordinating related tasks.
