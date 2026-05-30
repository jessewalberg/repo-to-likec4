// Headless via jsdom: set up a DOM, then test BOTH the bare Model
// and a full Graph round-trip. Question 1.

import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c" style="width:800px;height:600px"></div></body></html>', {
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// navigator is a read-only global in Node 24; leave Node's own in place.
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };

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
      parentId: null, // top-level unknown field
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

function diffFields(orig, rt, path='') {
  // Walk orig; report any key missing or changed in rt
  const missing = [];
  for (const k of Object.keys(orig)) {
    const p = path ? `${path}.${k}` : k;
    if (!(k in rt)) { missing.push(`MISSING ${p}`); continue; }
    if (orig[k] && typeof orig[k] === 'object' && !Array.isArray(orig[k])) {
      missing.push(...diffFields(orig[k], rt[k] || {}, p));
    } else if (JSON.stringify(orig[k]) !== JSON.stringify(rt[k])) {
      missing.push(`CHANGED ${p}: ${JSON.stringify(orig[k])} -> ${JSON.stringify(rt[k])}`);
    }
  }
  return missing;
}

// ---- Model ----
console.log('=== bare Model round-trip ===');
try {
  const { Model } = await import('@antv/x6/es/model/model.js');
  const m = new Model();
  m.fromJSON(structuredClone(SAMPLE));
  const out = m.toJSON();
  const nodeOut = out.cells ? out.cells.find(c => c.id === 'service:apps/api') : (out.nodes||[]).find(c=>c.id==='service:apps/api');
  console.log('Model OK. output shape keys:', Object.keys(out).join(','));
  console.log('--- node service:apps/api as round-tripped ---');
  console.log(JSON.stringify(nodeOut, null, 2));
  console.log('--- field-preservation diff (orig node vs round-tripped) ---');
  const origNode = SAMPLE.nodes[0];
  console.log(diffFields(origNode, nodeOut || {}).join('\n') || '(no missing/changed fields)');
} catch (e) {
  console.log('Model FAILED:', e.message);
  console.log(e.stack.split('\n').slice(0,6).join('\n'));
}
