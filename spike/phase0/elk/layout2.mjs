import ELK from 'elkjs';

const elk = new ELK();
const NODE_W = 120;
const NODE_H = 60;

const BASE = {
  'elk.algorithm': 'layered',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '50',
  'elk.spacing.nodeNode': '40',
};

const leaf = (id, extra = {}) => ({ id, width: NODE_W, height: NODE_H, ...extra });
const fmt = (n) => (n === undefined ? '—' : Number(n.toFixed(2)).toString());
const round = (n) => Math.round(n * 100) / 100;

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

function freshGraph() {
  return {
    id: 'root',
    layoutOptions: { ...BASE },
    children: [
      { id: 'lane:backend', layoutOptions: { ...BASE }, children: [leaf('api'), leaf('db'), leaf('cache')] },
      { id: 'lane:frontend', layoutOptions: { ...BASE }, children: [leaf('web')] },
    ],
    edges: [
      { id: 'e1', sources: ['web'], targets: ['api'] },
      { id: 'e2', sources: ['api'], targets: ['db'] },
      { id: 'e3', sources: ['api'], targets: ['cache'] },
    ],
  };
}

// Build a frozen graph. `optsAll` is applied to root AND every compound node so
// the hierarchy-aware processors agree (fixes the LAYER_SWEEP exception).
// `usePositionHint` adds 'elk.position' to each pinned leaf (interactive ref pt).
function frozenGraph(laidOut, optsAll, { usePositionHint, keepXY }) {
  const pinLeaf = (node) => {
    const out = { id: node.id, width: node.width, height: node.height };
    if (keepXY) { out.x = node.x; out.y = node.y; }
    if (usePositionHint) {
      out.layoutOptions = { 'elk.position': `(${round(node.x ?? 0)},${round(node.y ?? 0)})` };
    }
    return out;
  };
  const pinCompound = (node) => {
    const out = { id: node.id, layoutOptions: { ...BASE, ...optsAll } };
    if (keepXY) { out.x = node.x; out.y = node.y; out.width = node.width; out.height = node.height; }
    out.children = node.children.map(pinLeaf);
    return out;
  };

  const backend = pinCompound(laidOut.children.find((c) => c.id === 'lane:backend'));
  const frontend = pinCompound(laidOut.children.find((c) => c.id === 'lane:frontend'));
  backend.children.push(leaf('worker')); // NEW node, no position

  return {
    id: 'root',
    layoutOptions: { ...BASE, ...optsAll },
    children: [backend, frontend],
    edges: [
      { id: 'e1', sources: ['web'], targets: ['api'] },
      { id: 'e2', sources: ['api'], targets: ['db'] },
      { id: 'e3', sources: ['api'], targets: ['cache'] },
      { id: 'e4', sources: ['api'], targets: ['worker'] },
    ],
  };
}

async function run(label, laidOut, baseline, optsAll, flags) {
  const g = frozenGraph(laidOut, optsAll, flags);
  let res, err;
  try { res = await elk.layout(g); } catch (e) { err = e; }
  console.log(`\n===== ${label} =====`);
  console.log('  opts:', JSON.stringify(optsAll), 'flags:', JSON.stringify(flags));
  if (err) { console.log('  ERROR:', err.message.split('\n')[0]); return; }
  const after = absCoords(res);
  const ids = ['api', 'db', 'cache', 'web', 'worker'];
  let moved = 0;
  for (const id of ids) {
    const b = baseline[id], a = after[id];
    if (id === 'worker') { console.log(`  worker          NEW placed at (${a.x},${a.y})`); continue; }
    const m = !b || a.x !== b.x || a.y !== b.y;
    if (m) moved++;
    console.log(`  ${id.padEnd(15)} ${m ? 'MOVED ' : 'PINNED'} now(${a.x},${a.y}) ${m ? `was(${b.x},${b.y})` : ''}`);
  }
  console.log(`  -> ${moved}/4 existing leaves moved`);
}

async function main() {
  const laidOut = await elk.layout(freshGraph());
  const baseline = absCoords(laidOut);
  console.log('baseline leaves:', JSON.stringify(baseline, null, 0));

  // D: full INTERACTIVE chain applied to root + all compounds, keep x/y on everything.
  await run('D: INTERACTIVE chain (all levels) + keepXY', laidOut, baseline, {
    'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
    'elk.layered.layering.strategy': 'INTERACTIVE',
    'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
    'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
  }, { keepXY: true, usePositionHint: false });

  // E: same INTERACTIVE chain but feed positions via elk.position hint (no raw x/y on leaves).
  await run('E: INTERACTIVE chain + elk.position hints (no raw xy on leaves)', laidOut, baseline, {
    'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
    'elk.layered.layering.strategy': 'INTERACTIVE',
    'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
    'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
    'elk.layered.interactiveReferencePoint': 'TOP_LEFT',
  }, { keepXY: false, usePositionHint: true });

  // F: org.eclipse.elk.fixed at all levels, keep x/y (pure pin).
  await run('F: fixed algorithm (all levels) + keepXY', laidOut, baseline, {
    'elk.algorithm': 'org.eclipse.elk.fixed',
  }, { keepXY: true, usePositionHint: false });

  // G: PER-LANE fixed for untouched lane (frontend), layered only for the changed lane (backend).
  //    This is the REALISTIC freeze model: only re-layout the subtree that changed.
  await runPerLane(laidOut, baseline);
}

// G: mixed strategy — frontend lane FIXED (pinned), backend lane re-layouts to place worker.
async function runPerLane(laidOut, baseline) {
  const backendSrc = laidOut.children.find((c) => c.id === 'lane:backend');
  const frontendSrc = laidOut.children.find((c) => c.id === 'lane:frontend');

  const frontend = {
    id: 'lane:frontend',
    x: frontendSrc.x, y: frontendSrc.y, width: frontendSrc.width, height: frontendSrc.height,
    layoutOptions: { 'elk.algorithm': 'org.eclipse.elk.fixed' },
    children: frontendSrc.children.map((c) => ({ id: c.id, width: c.width, height: c.height, x: c.x, y: c.y })),
  };
  // Backend: keep existing leaves pinned via elk.position + INTERACTIVE, add worker.
  const backend = {
    id: 'lane:backend',
    x: backendSrc.x, y: backendSrc.y,
    layoutOptions: {
      ...BASE,
      'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
      'elk.layered.layering.strategy': 'INTERACTIVE',
      'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
      'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
    },
    children: [
      ...backendSrc.children.map((c) => ({
        id: c.id, width: c.width, height: c.height,
        layoutOptions: { 'elk.position': `(${round(c.x)},${round(c.y)})` },
      })),
      leaf('worker'),
    ],
  };
  // Root pinned: lanes don't move (frontend fixed, backend position-hinted).
  const root = {
    id: 'root',
    layoutOptions: {
      ...BASE,
      'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
      'elk.layered.layering.strategy': 'INTERACTIVE',
      'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
      'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
    },
    children: [
      { ...backend, layoutOptions: { ...backend.layoutOptions }, x: backendSrc.x, y: backendSrc.y,
        // give root a position hint for the backend lane too
      },
      { ...frontend, layoutOptions: { 'elk.position': `(${round(frontendSrc.x)},${round(frontendSrc.y)})`, 'elk.algorithm': 'org.eclipse.elk.fixed' } },
    ],
    edges: [
      { id: 'e1', sources: ['web'], targets: ['api'] },
      { id: 'e2', sources: ['api'], targets: ['db'] },
      { id: 'e3', sources: ['api'], targets: ['cache'] },
      { id: 'e4', sources: ['api'], targets: ['worker'] },
    ],
  };
  let res, err;
  try { res = await elk.layout(root); } catch (e) { err = e; }
  console.log('\n===== G: per-lane mixed (frontend fixed, backend interactive+position) =====');
  if (err) { console.log('  ERROR:', err.message.split('\n')[0]); return; }
  const after = absCoords(res);
  const ids = ['api', 'db', 'cache', 'web', 'worker'];
  let moved = 0;
  for (const id of ids) {
    const b = baseline[id], a = after[id];
    if (id === 'worker') { console.log(`  worker          NEW placed at (${a.x},${a.y})`); continue; }
    const m = !b || a.x !== b.x || a.y !== b.y;
    if (m) moved++;
    console.log(`  ${id.padEnd(15)} ${m ? 'MOVED ' : 'PINNED'} now(${a.x},${a.y}) ${m ? `was(${b.x},${b.y})` : ''}`);
  }
  console.log(`  -> ${moved}/4 existing leaves moved`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
