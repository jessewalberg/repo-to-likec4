import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
globalThis.window = w; globalThis.document = w.document;
for (const k of Object.getOwnPropertyNames(w)) { if (k in globalThis) continue; try { globalThis[k]=w[k]; } catch {} }
globalThis.requestAnimationFrame=(cb)=>setTimeout(()=>cb(Date.now()),0);
const code = readFileSync(new URL('./test3-bundle.cjs', import.meta.url),'utf8');
const mod={exports:{}}; new Function('require','module','exports',code)((id)=>{throw new Error(id);},mod,mod.exports);
