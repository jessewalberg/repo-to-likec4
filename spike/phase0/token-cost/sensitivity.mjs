// Sensitivity sweep on the two most load-bearing assumptions:
//  (a) view-refine OUTPUT tokens per node (prose volume)
//  (b) incremental churn fraction (how much a push touches)
const MTOK=1e6;
const P={'sonnet-4.6':{in:3,out:15,cw:3.75,cr:.30},'haiku-4.5':{in:1,out:5,cw:1.25,cr:.10}};
const REPO={nodes:200,views:10,edges:300,avg:25};
const SYS=2500;
const d=(t,r)=>t/MTOK*r;

function viewRefine(model, outPerNode, nViews){
  const p=P[model]; const n=REPO.avg, e=Math.round(n*1.2);
  const varIn=400+n*90+e*30;
  const out=n*outPerNode+e*25;
  // cached sys: 1 write + nViews reads; variable in uncached
  const cache=d(SYS,p.cw)+d(SYS*nViews,p.cr);
  const input=d(varIn*nViews,p.in);
  const output=d(out*nViews,p.out);
  return cache+input+output;
}
function modelBuilder(model,nodes,edges){
  const p=P[model];
  const varIn=nodes*60+edges*25, out=nodes*70+edges*35;
  return d(SYS,p.cw)+d(SYS,p.cr)+d(varIn,p.in)+d(out,p.out);
}

console.log('(a) view-refine OUTPUT tokens/node sensitivity — FULL gen (10 views) cost:');
console.log('   outPerNode:   120     220(base)   400     600');
for(const m of ['sonnet-4.6','haiku-4.5']){
  const row=[120,220,400,600].map(o=>{
    const c=modelBuilder(m,REPO.nodes,REPO.edges)+viewRefine(m,o,REPO.views);
    return ('$'+c.toFixed(3)).padStart(10);
  }).join('');
  console.log('  '+m.padEnd(12)+row);
}

console.log('\n(b) churn sensitivity — INCREMENTAL run cost & changed-view count:');
console.log('   changedNodes%:  2%      5%(base)  10%     20%     40%');
for(const m of ['sonnet-4.6','haiku-4.5']){
  const row=[.02,.05,.10,.20,.40].map(f=>{
    const cn=Math.max(1,Math.round(REPO.nodes*f));
    const cv=Math.min(REPO.views,Math.max(1,Math.round(cn*1.5/REPO.avg)));
    const ce=Math.round(REPO.edges*f);
    const c=modelBuilder(m,cn,ce)+viewRefine(m,220,cv);
    return ('$'+c.toFixed(3)+'/'+cv+'v').padStart(11);
  }).join('');
  console.log('  '+m.padEnd(12)+row);
}

console.log('\n(c) WORST-CASE incremental (40% churn -> ~6 views, 600 out/node) daily @ pushes/day:');
for(const m of ['sonnet-4.6','haiku-4.5']){
  const cn=Math.round(REPO.nodes*.40), cv=Math.min(REPO.views,Math.round(cn*1.5/REPO.avg)), ce=Math.round(REPO.edges*.40);
  const one=modelBuilder(m,cn,ce)+viewRefine(m,600,cv);
  const be=Math.ceil(5/one);
  console.log('  '+m.padEnd(12)+'1 run=$'+one.toFixed(3)+'  -> $5/day at '+be+' pushes/day');
}
