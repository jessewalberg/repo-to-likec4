import ELK from 'elkjs';

// PART 2 (final) — overlap-safe freeze. Feed the frozen coords to ELK as
// position hints under the INTERACTIVE layered strategies so ELK places the
// NEW node in the SAME coordinate space as the pins (avoiding the overlap that
// the naive candidate-merge produced). Then app-freeze pinned ids regardless.

const elk = new ELK();
const NODE_W = 120, NODE_H = 60;
const BASE = {
  'elk.algorithm': 'layered',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
};
const INTERACTIVE = {
  'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
  'elk.layered.layering.strategy': 'INTERACTIVE',
  'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
  'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
  'elk.layered.interactiveReferencePoint': 'TOP_LEFT',
};
const round = (n) => Math.round(n * 100) / 100;
const leaf = (id) => ({ id, width: NODE_W, height: NODE_H });

function absCoords(graph) {
  const map = {};
  const walk = (node, px = 0, py = 0) => {
    const ax = px + (node.x ?? 0), ay = py + (node.y ?? 0);
    if (node.id !== 'root') map[node.id] = { x: round(ax), y: round(ay) };
    for (const c of node.children ?? []) walk(c, ax, ay);
  };
  walk(graph);
  return map;
}
function localFromAbs(absMap) {
  // We stored ABS coords in the manifest; convert lane children back to LOCAL
  // (relative to lane) for ELK input.
  return absMap;
}

async function main() {
  // baseline (layout-once) — capture LOCAL coords per node as ELK emitted them.
  const v1 = await elk.layout({
    id: 'root', layoutOptions: { ...BASE },
    children: [
      { id: 'lane:backend', layoutOptions: { ...BASE }, children: [leaf('api'), leaf('db'), leaf('cache')] },
      { id: 'lane:frontend', layoutOptions: { ...BASE }, children: [leaf('web')] },
    ],
    edges: [
      { id: 'e1', sources: ['web'], targets: ['api'] },
      { id: 'e2', sources: ['api'], targets: ['db'] },
      { id: 'e3', sources: ['api'], targets: ['cache'] },
    ],
  });
  // Pull LOCAL coords directly off the laid-out tree.
  const local = {};
  for (const lane of v1.children) {
    local[lane.id] = { x: lane.x, y: lane.y, w: lane.width, h: lane.height };
    for (const c of lane.children) local[c.id] = { x: c.x, y: c.y };
  }
  const MANIFEST_ABS = absCoords(v1);

  // Build incremental graph: existing leaves carry elk.position = their LOCAL coord,
  // new 'worker' has none. INTERACTIVE strategies + hints keep ordering stable.
  const pinnedLeaf = (id) => ({
    id, width: NODE_W, height: NODE_H,
    layoutOptions: { 'elk.position': `(${round(local[id].x)},${round(local[id].y)})` },
  });
  const g2 = {
    id: 'root', layoutOptions: { ...BASE, ...INTERACTIVE },
    children: [
      { id: 'lane:backend', layoutOptions: { ...BASE, ...INTERACTIVE },
        children: [pinnedLeaf('api'), pinnedLeaf('db'), pinnedLeaf('cache'), leaf('worker')] },
      { id: 'lane:frontend', layoutOptions: { ...BASE, ...INTERACTIVE },
        children: [pinnedLeaf('web')] },
    ],
    edges: [
      { id: 'e1', sources: ['web'], targets: ['api'] },
      { id: 'e2', sources: ['api'], targets: ['db'] },
      { id: 'e3', sources: ['api'], targets: ['cache'] },
      { id: 'e4', sources: ['api'], targets: ['worker'] },
    ],
  };
  const cand = absCoords(await elk.layout(g2));

  // App-side freeze: pinned keep MANIFEST_ABS; worker takes candidate.
  console.log('Position-hint + INTERACTIVE candidate, then app-freeze:');
  const pinnedIds = new Set(Object.keys(MANIFEST_ABS));
  const merged = {};
  for (const id of Object.keys(cand)) merged[id] = pinnedIds.has(id) ? MANIFEST_ABS[id] : cand[id];

  for (const id of Object.keys(merged)) {
    const isNew = !pinnedIds.has(id);
    if (isNew) { console.log(`  ${id.padEnd(15)} NEW    (${merged[id].x},${merged[id].y})`); continue; }
    console.log(`  ${id.padEnd(15)} PINNED (${merged[id].x},${merged[id].y})`);
  }

  // Did the INTERACTIVE candidate keep pinned nodes near their manifest coords
  // (so worker is placed in the right space)? Report drift of the candidate.
  console.log('\nINTERACTIVE candidate drift vs manifest (smaller = ELK respected hints):');
  for (const id of pinnedIds) {
    if (id.startsWith('lane:')) continue;
    const b = MANIFEST_ABS[id], c = cand[id];
    const d = Math.round(Math.hypot(c.x - b.x, c.y - b.y));
    console.log(`  ${id.padEnd(15)} manifest(${b.x},${b.y}) candidate(${c.x},${c.y}) drift=${d}px`);
  }

  // Overlap check of the NEW node against frozen leaves (using candidate coord).
  const w = cand['worker'];
  const overlaps = [];
  for (const id of pinnedIds) {
    if (id.startsWith('lane:')) continue;
    const p = MANIFEST_ABS[id];
    const ax = !(w.x + NODE_W <= p.x || p.x + NODE_W <= w.x);
    const ay = !(w.y + NODE_H <= p.y || p.y + NODE_H <= w.y);
    if (ax && ay) overlaps.push(id);
  }
  console.log(`\nOverlap of new node worker(${w.x},${w.y}) vs frozen leaves -> ${overlaps.length ? 'OVERLAPS ' + overlaps.join(',') : 'NO OVERLAP'}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
