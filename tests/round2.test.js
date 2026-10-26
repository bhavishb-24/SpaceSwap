import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProject,demoProject} from '../src/data.js';
import {formatInputNumber,formatLength} from '../src/geometry.js';
import {briefSnapshot,encodeBrief,decodeBrief,routeFor} from '../src/decision.js';
import {calculateCosts} from '../src/costs.js';

test('fresh project has no apartment, inventory, or invented planning figures',()=>{
 const p=blankProject();
 assert.equal(p.apartments.length,0);
 assert.equal(p.inventory.length,0);
 assert.equal(p.preferences.months,null);
 assert.equal(p.preferences.budget,null);
});
test('dimension display removes float noise without rounding calculation inputs',()=>{
 const entered=Math.fround(.9);
 assert.equal(formatInputNumber(entered),'0.9');
 assert.equal(formatLength(entered),'0.9 m');
 assert.equal(entered,Math.fround(.9));
});
test('sample route measurements exist only on the demo project',()=>{
 const demo=demoProject();
 assert.equal(routeFor(demo.apartments[0]).entry.width,.94);
 assert.deepEqual(routeFor({...demo.apartments[0],moveRoute:undefined}),{});
});
test('shared snapshot survives a UTF-8 round trip and rejects malformed data',()=>{
 const p=demoProject();p.name='Rêve apartment';p.demoData=true;
 const token=encodeBrief(briefSnapshot(p)),decoded=decodeBrief(token);
 assert.equal(decoded.n,p.name);
 assert.equal(decoded.d,true);
 assert.equal(decoded.a.length,2);
 assert.equal(decoded.a[0].k.rent,2450);
 assert.equal(decodeBrief(token+'!'),null);
 assert.equal(decodeBrief('x'.repeat(12001)),null);
});
test('missing inputs cannot produce a complete cost result',()=>{
 const p=demoProject();
 p.preferences.months=null;p.preferences.budget=null;
 const c=calculateCosts(p.apartments[0],p);
 assert.equal(c.complete,false);
 assert.equal(c.remaining,null);
 assert.ok(c.missing.includes('stay length'));
});
test('judge and real projects use separate browser storage',async()=>{
 const data=new Map();
 globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 globalThis.sessionStorage={getItem:()=>null,setItem:()=>{}};
 const {store}=await import('../src/store.js?round2');
 assert.equal(store.get().apartments.length,0);
 store.enterDemo();
 assert.equal(store.get().apartments.length,2);
 store.exitDemo();
 assert.equal(store.get().apartments.length,0);
 assert.equal(data.has('spaceswap.project.v1'),false);
 assert.equal(data.has('spaceswap.judge-demo.v1'),false);
 store.update(p=>p.name='My room');
 store.enterDemo();store.update(p=>p.name='Demo edit');
 store.exitDemo();
 assert.equal(store.get().name,'My room');
 assert.equal(JSON.parse(data.get('spaceswap.judge-demo.v1')).name,'Demo edit');
});
