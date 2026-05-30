// Q2 deep-dive: history command granularity (delta vs full snapshot) for a
// POSITION change, plus confirm each editing-chrome plugin instantiates.
import { Graph } from '@antv/x6';
import { History } from '@antv/x6/es/plugin/history';
import { Clipboard } from '@antv/x6/es/plugin/clipboard';
import { Selection } from '@antv/x6/es/plugin/selection';
import { Snapline } from '@antv/x6/es/plugin/snapline';
import { Keyboard } from '@antv/x6/es/plugin/keyboard';
import { Transform } from '@antv/x6/es/plugin/transform';
import { Export } from '@antv/x6/es/plugin/export';

const out = {};

// plugin presence
out.pluginsInstantiate = {};
for (const [name, P, opts] of [
  ['history', History, { enabled: true }],
  ['clipboard', Clipboard, {}],
  ['selection', Selection, { enabled: true }],
  ['snapline', Snapline, { enabled: true }],
  ['keyboard', Keyboard, { enabled: true }],
  ['transform', Transform, { resizing: true, rotating: true }],
  ['export', Export, {}],
]) {
  try { const inst = new P(opts); out.pluginsInstantiate[name] = inst.name || true; }
  catch (e) { out.pluginsInstantiate[name] = 'ERR: ' + e.message; }
}

// position-change command granularity
const container = document.getElementById('c');
const graph = new Graph({ container, width: 800, height: 600 });
graph.use(new History({ enabled: true }));
graph.addNode({ id: 'n1', shape: 'rect', x: 10, y: 10, width: 100, height: 40, data: { label: 'A', big: { nested: 'value', arr: [1, 2, 3] } } });
const hist = graph.getPlugin('history');
hist.clean();
// a pure drag
graph.getCellById('n1').prop('position', { x: 200, y: 300 });
const cmd = hist.undoStack[hist.undoStack.length - 1];
out.positionCommand = JSON.parse(JSON.stringify(cmd));
// does undo restore?
hist.undo();
out.afterUndoPos = graph.getCellById('n1').getProp('position');
hist.redo();
out.afterRedoPos = graph.getCellById('n1').getProp('position');

// clipboard copy/paste serializable?
const cb = new Clipboard();
graph.use(cb);
cb.copy([graph.getCellById('n1')], graph);
out.clipboardSerializable = (() => { try { JSON.stringify(cb.cells || cb.getCellsInClipboard?.() || null); return true; } catch { return false; } })();

console.log('@@R2@@');
console.log(JSON.stringify(out, null, 2));
console.log('@@E2@@');
