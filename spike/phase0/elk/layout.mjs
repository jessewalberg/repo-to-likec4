import ELK from 'elkjs';

const elk = new ELK();

const NODE_W = 120;
const NODE_H = 60;

// Shared layout options for the COMPOUND/hierarchical layered run.
const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '50',
  'elk.spacing.nodeNode': '40',
};

const leaf = (id) => ({ id, width: NODE_W, height: NODE_H });

// ---------------------------------------------------------------------------
// PART 1 — compound graph, fresh layout
// ---------------------------------------------------------------------------
function buildFreshGraph() {
  return {
    id: 'root',
    layoutOptions: LAYOUT_OPTIONS,
    children: [
      {
        id: 'lane:backend',
        layoutOptions: LAYOUT_OPTIONS,
        children: [leaf('api'), leaf('db'), leaf('cache')],
      },
      {
        id: 'lane:frontend',
        layoutOptions: LAYOUT_OPTIONS,
        children: [leaf('web')],
      },
    ],
    edges: [
      { id: 'e1', sources: ['web'], targets: ['api'] },
      { id: 'e2', sources: ['api'], targets: ['db'] },
      { id: 'e3', sources: ['api'], targets: ['cache'] },
    ],
  };
}

function dump(label, graph) {
  console.log(`\n===== ${label} =====`);
  const walk = (node, depth = 0, parentX = 0, parentY = 0) => {
    const pad = '  '.repeat(depth);
    const absX = parentX + (node.x ?? 0);
    const absY = parentY + (node.y ?? 0);
    if (node.id !== 'root') {
      console.log(
        `${pad}${node.id.padEnd(16)} x=${fmt(node.x)} y=${fmt(node.y)} ` +
          `w=${fmt(node.width)} h=${fmt(node.height)}   (abs x=${fmt(absX)} y=${fmt(absY)})`
      );
    }
    for (const c of node.children ?? []) walk(c, depth + 1, absX, absY);
  };
  walk(graph);
}
const fmt = (n) => (n === undefined ? '—' : Number(n.toFixed(2)).toString().padStart(7));

// ---------------------------------------------------------------------------
// PART 2 — FREEZE model. Take the laid-out graph, pin every existing node to
// its computed coords, add ONE new node, and re-run. We test the documented
// interactive / fixed-position knobs.
// ---------------------------------------------------------------------------
function buildFrozenGraph(laidOut, pinStrategy) {
  // pinStrategy = how we tell ELK "this node already has a position, keep it"
  const clonePinned = (node) => {
    const out = {
      id: node.id,
      width: node.width,
      height: node.height,
      x: node.x,
      y: node.y,
    };
    if (node.children) {
      out.children = node.children.map(clonePinned);
      out.layoutOptions = { ...LAYOUT_OPTIONS };
    }
    return out;
  };

  const backend = laidOut.children.find((c) => c.id === 'lane:backend');
  const frontend = laidOut.children.find((c) => c.id === 'lane:frontend');

  const pinnedBackend = clonePinned(backend);
  const pinnedFrontend = clonePinned(frontend);

  // The NEW node — no x/y, ELK must place it. Added to backend lane.
  const newNode = leaf('worker');
  pinnedBackend.children.push(newNode);

  // Per-strategy root options
  const rootOptions = { ...LAYOUT_OPTIONS, ...pinStrategy.rootOptions };

  return {
    id: 'root',
    layoutOptions: rootOptions,
    children: [pinnedBackend, pinnedFrontend],
    edges: [
      { id: 'e1', sources: ['web'], targets: ['api'] },
      { id: 'e2', sources: ['api'], targets: ['db'] },
      { id: 'e3', sources: ['api'], targets: ['cache'] },
      { id: 'e4', sources: ['api'], targets: ['worker'] }, // new edge to new node
    ],
  };
}

// Flatten id -> abs coords for comparison
function absCoords(graph) {
  const map = {};
  const walk = (node, px = 0, py = 0) => {
    const ax = px + (node.x ?? 0);
    const ay = py + (node.y ?? 0);
    if (node.id !== 'root') map[node.id] = { x: round(ax), y: round(ay) };
    for (const c of node.children ?? []) walk(c, ax, ay);
  };
  walk(graph);
  return map;
}
const round = (n) => Math.round(n * 100) / 100;

async function main() {
  // ---- PART 1 ----
  const fresh = buildFreshGraph();
  const laidOut = await elk.layout(structuredClone(fresh));
  dump('PART 1: fresh compound layout (algorithm=layered, edgeRouting=ORTHOGONAL, hierarchyHandling=INCLUDE_CHILDREN)', laidOut);

  const baseline = absCoords(laidOut);

  // ---- PART 2 ----
  // Candidate freeze strategies, applied at the ROOT (and inherited by lanes
  // via layoutOptions). 'org.eclipse.elk.fixed' is the FixedLayouterOptions
  // algorithm (keeps given coords, no routing). The layered algorithm honors
  // pre-set positions only in INTERACTIVE mode + considerModelOrder, so we test
  // several documented knobs and observe which actually pin.
  const strategies = [
    {
      name: "A: layered + interactive (cycleBreaking/layering/crossingMin/nodePlacement = INTERACTIVE)",
      rootOptions: {
        'elk.algorithm': 'layered',
        'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
        'elk.layered.layering.strategy': 'INTERACTIVE',
        'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
        'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
        'elk.separateConnectedComponents': 'false',
      },
    },
    {
      name: "B: fixed algorithm (org.eclipse.elk.fixed) — pure pin, only places nodes without coords?",
      rootOptions: {
        'elk.algorithm': 'org.eclipse.elk.fixed',
      },
    },
    {
      name: "C: layered + interactiveLayout=true",
      rootOptions: {
        'elk.algorithm': 'layered',
        'elk.interactiveLayout': 'true',
        'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
        'elk.layered.layering.strategy': 'INTERACTIVE',
        'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
        'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
      },
    },
  ];

  for (const strat of strategies) {
    const frozen = buildFrozenGraph(laidOut, strat);
    let result, err;
    try {
      result = await elk.layout(frozen);
    } catch (e) {
      err = e;
    }
    console.log(`\n===== PART 2 — ${strat.name} =====`);
    if (err) {
      console.log('  ERROR:', err.message);
      continue;
    }
    const after = absCoords(result);
    const ids = ['api', 'db', 'cache', 'web', 'worker', 'lane:backend', 'lane:frontend'];
    let movedCount = 0;
    for (const id of ids) {
      const b = baseline[id];
      const a = after[id];
      if (!a) {
        console.log(`  ${id.padEnd(16)} MISSING in result`);
        continue;
      }
      if (id === 'worker') {
        console.log(`  ${id.padEnd(16)} NEW   placed at x=${a.x} y=${a.y}`);
        continue;
      }
      const moved = !b || a.x !== b.x || a.y !== b.y;
      if (moved) movedCount++;
      const tag = moved ? 'MOVED ' : 'PINNED';
      const was = b ? `was(${b.x},${b.y})` : 'was(—)';
      console.log(`  ${id.padEnd(16)} ${tag} now(${a.x},${a.y}) ${moved ? was : ''}`);
    }
    console.log(`  -> ${movedCount} of the existing nodes moved.`);
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
