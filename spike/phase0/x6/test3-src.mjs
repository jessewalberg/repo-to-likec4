// Q1 edge cases: where do UNKNOWN fields survive?
//  (a) unknown top-level field that is NOT a reserved X6 prop (e.g. "myCustom")
//  (b) unknown top-level field colliding with reserved name not given (e.g. "type")
//  (c) deeply nested unknown inside data
import { Model } from '@antv/x6';

const sample = {
  nodes: [{
    id: 'x',
    shape: 'rect',
    x: 0, y: 0, width: 10, height: 10,
    myCustomTop: { hello: 'world' },        // unknown TOP-LEVEL (not under data)
    type: 'service',                         // 'type' is OUR manifest field; X6 uses 'shape'
    confidence: 'static',                    // unknown top-level scalar
    data: { keepMe: { deep: { x: [1, { y: 2 }] } }, pinned: true },
  }],
  edges: [],
};
const m = new Model();
m.fromJSON(structuredClone(sample));
const out = m.toJSON().cells.find(c => c.id === 'x');
console.log('@@R3@@');
console.log(JSON.stringify({
  topLevelKeysRoundTripped: Object.keys(out),
  myCustomTop_survived: out.myCustomTop,
  type_survived: out.type,
  confidence_top_survived: out.confidence,
  data_survived: out.data,
}, null, 2));
console.log('@@E3@@');
