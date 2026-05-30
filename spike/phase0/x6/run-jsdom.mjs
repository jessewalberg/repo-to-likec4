// Set up jsdom globals, then load the esbuild-bundled X6 test.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM(
  '<!DOCTYPE html><html><body><div id="c" style="width:800px;height:600px"></div></body></html>',
  { pretendToBeVisual: true, url: 'http://localhost/' }
);
const w = dom.window;
globalThis.window = w;
globalThis.document = w.document;
// Mirror every DOM constructor/global from the jsdom window onto globalThis,
// skipping read-only Node globals (navigator, etc.).
for (const key of Object.getOwnPropertyNames(w)) {
  if (key in globalThis) continue;
  try { globalThis[key] = w[key]; } catch { /* read-only, skip */ }
}
globalThis.getComputedStyle = w.getComputedStyle.bind(w);
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
// X6 measures SVG text; jsdom returns 0. Provide a stub bbox.
if (w.SVGElement && !w.SVGElement.prototype.getBBox) {
  w.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 100, height: 20 });
}
w.SVGElement.prototype.getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse() { return this; } });
w.SVGElement.prototype.createSVGMatrix = () => ({
  a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
  translate() { return this; }, scale() { return this; }, multiply() { return this; }, inverse() { return this; },
});

const code = readFileSync(new URL('./test-bundle.cjs', import.meta.url), 'utf8');
// run the bundle in this realm
const fn = new Function('require', 'module', 'exports', code);
const mod = { exports: {} };
fn((id) => { throw new Error('no require: ' + id); }, mod, mod.exports);
