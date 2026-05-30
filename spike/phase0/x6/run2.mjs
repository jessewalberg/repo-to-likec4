import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
const dom = new JSDOM('<!DOCTYPE html><body><div id="c" style="width:800px;height:600px"></div></body>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
globalThis.window = w; globalThis.document = w.document;
for (const k of Object.getOwnPropertyNames(w)) { if (k in globalThis) continue; try { globalThis[k] = w[k]; } catch {} }
globalThis.getComputedStyle = w.getComputedStyle.bind(w);
globalThis.requestAnimationFrame = (cb)=>setTimeout(()=>cb(Date.now()),0);
globalThis.cancelAnimationFrame = (id)=>clearTimeout(id);
globalThis.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
if (!w.SVGElement.prototype.getBBox) w.SVGElement.prototype.getBBox = () => ({x:0,y:0,width:100,height:20});
w.SVGElement.prototype.getScreenCTM = () => ({a:1,b:0,c:0,d:1,e:0,f:0,inverse(){return this;}});
w.SVGElement.prototype.createSVGMatrix = () => ({a:1,b:0,c:0,d:1,e:0,f:0,translate(){return this;},scale(){return this;},multiply(){return this;},inverse(){return this;}});
const code = readFileSync(new URL('./test2-bundle.cjs', import.meta.url), 'utf8');
const mod = { exports: {} };
new Function('require','module','exports', code)((id)=>{throw new Error('no require '+id);}, mod, mod.exports);
