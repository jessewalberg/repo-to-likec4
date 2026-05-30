import ELK from 'elkjs';

// PART 2 (corrected) — the REALISTIC freeze model for the Cartograph manifest:
// pinned positions live in the MANIFEST (the app's source of truth), not ELK.
// We run ELK ONLY to obtain a candidate position for NEW (unpinned) nodes, then
// the app KEEPS every pinned node at its manifest coord and ACCEPTS ELK's coord
// ONLY for nodes that had no pin. This is the "layout once then freeze" policy
// the ADR describes: pinned nodes are fixed input; no automatic full re-layout.

const elk = new ELK();
const NODE_W = 120, NODE_H = 60;
const BASE = {
  'elk.algorithm': 'layered',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '50',
  'elk.spacing.nodeNode': '40',
};
const leaf = (id) => ({ id, width: NODE_W, height: NODE_H });
const round = (n) => Math.round(n * 100) / 100;

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
function graph(extraChildBackend = []) {
  return {
    id: 'root', layoutOptions: { ...BASE },
    children: [
      { id: 'lane:backend', layoutOptions: { ...BASE }, children: [leaf('api'), leaf('db'), leaf('cache'), ...extraChildBackend] },
      { id: 'lane:frontend', layoutOptions: { ...BASE }, children: [leaf('web')] },
    ],
    edges: [
      { id: 'e1', sources: ['web'], targets: ['api'] },
      { id: 'e2', sources: ['api'], targets: ['db'] },
      { id: 'e3', sources: ['api'], targets: ['cache'] },
    ],
  };
}

async function main() {
  // 1. Layout-once baseline. These coords get written into the manifest as pins.
  const v1 = await elk.layout(graph());
  const MANIFEST = absCoords(v1); // app's frozen source of truth
  console.log('MANIFEST (frozen pins after layout-once):');
  for (const [id, p] of Object.entries(MANIFEST)) console.log(`  ${id.padEnd(15)} (${p.x},${p.y})`);

  // 2. A later agent run adds `worker` + edge api->worker. We re-run ELK on the
  //    WHOLE graph to get a *candidate* layout (ELK will move everything), then
  //    the APP merges: pinned ids keep MANIFEST coords; only unpinned ids (worker)
  //    take the ELK candidate.
  const g2 = graph([leaf('worker')]);
  g2.edges.push({ id: 'e4', sources: ['api'], targets: ['worker'] });
  const candidate = absCoords(await elk.layout(g2));

  const merged = {};
  const pinnedIds = new Set(Object.keys(MANIFEST));
  for (const id of Object.keys(candidate)) {
    if (pinnedIds.has(id)) merged[id] = MANIFEST[id];      // FREEZE
    else merged[id] = candidate[id];                       // place new only
  }

  console.log('\nMERGED result (app-side freeze; ELK candidate used ONLY for new node):');
  let moved = 0;
  for (const id of Object.keys(merged)) {
    const isNew = !pinnedIds.has(id);
    if (isNew) { console.log(`  ${id.padEnd(15)} NEW    (${merged[id].x},${merged[id].y})  [from ELK candidate]`); continue; }
    const b = MANIFEST[id], a = merged[id];
    const m = a.x !== b.x || a.y !== b.y;
    if (m) moved++;
    console.log(`  ${id.padEnd(15)} ${m ? 'MOVED' : 'PINNED'} (${a.x},${a.y})`);
  }
  console.log(`\n  -> ${moved}/${pinnedIds.size} pinned nodes moved (must be 0 for a correct freeze).`);

  // 3. Honesty check: where would ELK have *wanted* to put the pinned nodes?
  console.log('\nWhat ELK alone would have done to the pinned nodes (the churn we are SUPPRESSING):');
  for (const id of pinnedIds) {
    const b = MANIFEST[id], c = candidate[id];
    const delta = (c.x !== b.x || c.y !== b.y);
    console.log(`  ${id.padEnd(15)} manifest(${b.x},${b.y}) vs ELK(${c.x},${c.y}) ${delta ? '<-- would have drifted' : ''}`);
  }

  // 4. Risk note: the new node may overlap a pinned node since ELK's candidate
  //    coordinate space differs from the frozen one. Check worker vs pinned bboxes.
  const w = candidate['worker'];
  const overlaps = [];
  for (const id of pinnedIds) {
    const p = MANIFEST[id];
    const box = id.startsWith('lane:') ? null : { w: NODE_W, h: NODE_H };
    if (!box) continue;
    const ax = !(w.x + NODE_W <= p.x || p.x + box.w <= w.x);
    const ay = !(w.y + NODE_H <= p.y || p.y + box.h <= w.y);
    if (ax && ay) overlaps.push(id);
  }
  console.log(`\nOverlap check: new node 'worker'(${w.x},${w.y}) vs frozen leaves -> ${overlaps.length ? 'OVERLAPS ' + overlaps.join(',') : 'no overlap'}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
