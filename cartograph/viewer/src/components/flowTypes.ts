import type { EdgeTypes, NodeTypes } from '@xyflow/react'
import { LaneNode } from './LaneNode'
import { NodeCard } from './NodeCard'
import { AsyncEdge } from './edges/AsyncEdge'
import { DataEdge } from './edges/DataEdge'
import { SyncEdge } from './edges/SyncEdge'

// Module-level STABLE maps — defining these inline in a component would remount
// every node/edge each render (and warn). React Flow keys on object identity.
export const nodeTypes = { card: NodeCard, lane: LaneNode } as unknown as NodeTypes
export const edgeTypes = { sync: SyncEdge, data: DataEdge, async: AsyncEdge } as unknown as EdgeTypes
