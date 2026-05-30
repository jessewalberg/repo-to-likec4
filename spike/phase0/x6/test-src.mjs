// Bundled by esbuild, then run under jsdom. Imports from package root '@antv/x6'.
// Q1: unknown-field preservation through toJSON/fromJSON
// Q2: history plugin undo-state storage shape
// Q3: applying an RFC-6902 patch then re-loading via fromJSON

import { Graph, Model } from '@antv/x6';
import { History } from '@antv/x6/es/plugin/history';

const SAMPLE = {
  nodes: [
    {
      id: 'service:apps/api',
      shape: 'rect',
      x: 120, y: 40, width: 200, height: 88,
      data: {
        label: 'API',
        summary: 'REST API for the web client',
        technology: 'Node/Express',
        links: [{ label: 'Source', url: 'https://github.com/org/name/blob/abc/apps/api/src/index.ts#L1-L40' }],
        provenance: { label: 'machine', summary: 'human', position: 'human' },
        pinned: true,
        confidence: 'static',
        metadata: { path: 'apps/api/src/index.ts', language: 'ts', loc: 420, owner: '@team' },
      },
      parentId: null, // top-level unknown (non-standard) field
    },
    { id: 'datastore:db', shape: 'rect', x: 120, y: 300, width: 160, height: 64, data: { label: 'DB' } },
  ],
  edges: [
    {
      id: 'e:service:apps/api->datastore:db',
      shape: 'edge',
      source: 'service:apps/api',
      target: 'datastore:db',
      data: { confidence: 'static', provenance: { label: 'machine' }, kind: 'writes' },
    },
  ],
};

function findNode(out, id) {
  if (Array.isArray(out.cells)) return out.cells.find((c) => c.id === id);
  if (Array.isArray(out.nodes)) return out.nodes.find((c) => c.id === id);
  return undefined;
}
function findEdge(out, id) {
  if (Array.isArray(out.cells)) return out.cells.find((c) => c.id === id);
  if (Array.isArray(out.edges)) return out.edges.find((c) => c.id === id);
  return undefined;
}
function diffFields(orig, rt, path = '') {
  const issues = [];
  const r = rt || {};
  for (const k of Object.keys(orig)) {
    const p = path ? `${path}.${k}` : k;
    if (!(k in r)) { issues.push(`MISSING ${p}`); continue; }
    if (orig[k] && typeof orig[k] === 'object' && !Array.isArray(orig[k])) {
      issues.push(...diffFields(orig[k], r[k], p));
    } else if (JSON.stringify(orig[k]) !== JSON.stringify(r[k])) {
      issues.push(`CHANGED ${p}: ${JSON.stringify(orig[k])} -> ${JSON.stringify(r[k])}`);
    }
  }
  return issues;
}

const results = {};

// ===== Q1a: bare Model round-trip =====
try {
  const m = new Model();
  m.fromJSON(structuredClone(SAMPLE));
  const out = m.toJSON();
  const n = findNode(out, 'service:apps/api');
  const e = findEdge(out, 'e:service:apps/api->datastore:db');
  results.modelRoundtrip = {
    ok: true,
    outputShapeKeys: Object.keys(out),
    nodeKeys: n ? Object.keys(n) : null,
    dataKeys: n && n.data ? Object.keys(n.data) : null,
    topLevelParentIdPreserved: n ? ('parentId' in n) : false,
    dataProvenance: n && n.data ? n.data.provenance : undefined,
    dataPinned: n && n.data ? n.data.pinned : undefined,
    dataLinks: n && n.data ? n.data.links : undefined,
    dataConfidence: n && n.data ? n.data.confidence : undefined,
    edgeDataKind: e && e.data ? e.data.kind : undefined,
    edgeDataProvenance: e && e.data ? e.data.provenance : undefined,
    dataFieldDiff: diffFields(SAMPLE.nodes[0].data, n ? n.data : {}, 'data'),
    fullNode: n,
  };
} catch (err) {
  results.modelRoundtrip = { ok: false, error: err.message, stack: err.stack.split('\n').slice(0, 5) };
}

// ===== Q1b: full Graph round-trip (needs DOM container) =====
try {
  const container = document.getElementById('c');
  const graph = new Graph({ container, width: 800, height: 600 });
  graph.fromJSON(structuredClone(SAMPLE));
  const out = graph.toJSON();
  const n = findNode(out, 'service:apps/api');
  // also pull live data via the cell API
  const cell = graph.getCellById('service:apps/api');
  const liveData = cell ? cell.getData() : null;
  results.graphRoundtrip = {
    ok: true,
    outputShapeKeys: Object.keys(out),
    nodeDataKeys: n && n.data ? Object.keys(n.data) : null,
    topLevelParentIdPreserved: n ? ('parentId' in n) : false,
    dataFieldDiff: diffFields(SAMPLE.nodes[0].data, n ? n.data : {}, 'data'),
    liveDataProvenance: liveData ? liveData.provenance : undefined,
    fullNodeData: n ? n.data : null,
  };
  // keep graph for Q2
  globalThis.__graph = graph;
} catch (err) {
  results.graphRoundtrip = { ok: false, error: err.message, stack: err.stack.split('\n').slice(0, 6) };
}

// ===== Q2: History plugin undo-state shape =====
try {
  const container = document.getElementById('c');
  const graph = new Graph({ container, width: 800, height: 600 });
  graph.use(new History({ enabled: true }));
  graph.fromJSON(structuredClone(SAMPLE));
  // history is reset after fromJSON typically; do an edit
  const cell = graph.getCellById('service:apps/api');
  cell.prop('position', { x: 500, y: 500 }); // a human "drag"
  cell.setData({ pinned: false }); // a data edit

  const hist = graph.getPlugin ? graph.getPlugin('history') : null;
  // inspect internal undo stack structure
  const undoStack = hist ? (hist.undoStack || hist.options && hist.undoStack) : null;
  // The History plugin keeps redoStack/undoStack arrays of "commands"
  let sampleCommand = null;
  let stackLen = null;
  if (hist) {
    stackLen = Array.isArray(hist.undoStack) ? hist.undoStack.length : 'n/a';
    if (Array.isArray(hist.undoStack) && hist.undoStack.length) {
      const top = hist.undoStack[hist.undoStack.length - 1];
      // top is usually an array of command objects
      sampleCommand = top;
    }
  }
  results.history = {
    ok: true,
    canUndo: hist ? hist.canUndo() : null,
    canRedo: hist ? hist.canRedo() : null,
    undoStackLen: stackLen,
    // serialize the command to see if it's a JSON-Patch-like log or imperative refs
    sampleCommandJSON: (() => { try { return JSON.parse(JSON.stringify(sampleCommand)); } catch { return '<<non-serializable>>'; } })(),
    histProtoKeys: hist ? Object.getOwnPropertyNames(Object.getPrototypeOf(hist)).filter(k => typeof hist[k] === 'function').slice(0, 40) : null,
    histOwnKeys: hist ? Object.keys(hist) : null,
  };
} catch (err) {
  results.history = { ok: false, error: err.message, stack: err.stack.split('\n').slice(0, 8) };
}

// ===== Q3: apply an RFC-6902 patch to the manifest, then fromJSON =====
// Simulate: agent emits a JSON Patch to the array-form manifest, we apply it,
// then push the whole new doc through fromJSON. Observe what X6 does with the rest.
try {
  const container = document.getElementById('c');
  const graph = new Graph({ container, width: 800, height: 600 });
  graph.fromJSON(structuredClone(SAMPLE));
  // human drags the API node and pins it (live, in X6)
  graph.getCellById('service:apps/api').prop('position', { x: 999, y: 111 });
  graph.getCellById('service:apps/api').setData({ pinned: true, _humanMoved: true });

  // Now the agent re-runs recon and produces a NEW manifest doc that ADDS a node
  // and changes the API summary (machine-owned). It expresses this as a patch
  // against the LAST COMMITTED doc (SAMPLE), NOT against X6's live state.
  const reconDoc = structuredClone(SAMPLE);
  reconDoc.nodes[0].data.summary = 'REST API (refreshed by recon)';
  reconDoc.nodes.push({ id: 'queue:events', shape: 'rect', x: 400, y: 300, width: 160, height: 64, data: { label: 'Events' } });

  // What happens if we naively fromJSON the recon doc? -> the live human drag is LOST,
  // because fromJSON replaces the whole graph.
  graph.fromJSON(structuredClone(reconDoc));
  const afterNaive = graph.getCellById('service:apps/api');
  results.patchInteraction = {
    naiveFromJSON_humanDragLost: afterNaive ? JSON.stringify(afterNaive.getProp('position')) : 'node-missing',
    naiveFromJSON_humanDataLost: afterNaive ? !('_humanMoved' in (afterNaive.getData() || {})) : 'node-missing',
    note: 'fromJSON is a whole-graph replace; X6 does not merge.',
  };
} catch (err) {
  results.patchInteraction = { ok: false, error: err.message, stack: err.stack.split('\n').slice(0, 6) };
}

console.log('@@RESULTS_START@@');
console.log(JSON.stringify(results, null, 2));
console.log('@@RESULTS_END@@');
