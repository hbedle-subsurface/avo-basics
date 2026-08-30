const R=require('../assets/rockphysics.js');
const P=23,T=64,sh=R.mudrock(2700);
const rm=c=>R.rockModel(Object.assign({vClay:0,P,T},c));
const rc=r=>R.rcNormal(sh,r);
let bad=0;
const chk=(label,claim,actual,tol)=>{
  const ok=Math.abs(claim-actual)<=tol; if(!ok)bad++;
  console.log('  '+(ok?'ok  ':'FAIL')+' '+label.padEnd(40)+'prose '+String(claim).padStart(9)+'   page '+actual.toFixed(4));
};
console.log('EXERCISE 1');
[[5,0.331],[10,0.244],[15,0.170],[20,0.105],[25,0.045],[30,-0.011],[35,-0.064]]
 .forEach(([p,q])=>chk('brine phi '+p+'%',q,rc(rm({phi:p/100,fluid:'brine',sHc:0})),0.0006));
let lo=0.25,hi=0.35;
for(let i=0;i<60;i++){const m=(lo+hi)/2; if(rc(rm({phi:m,fluid:'brine',sHc:0}))>0) lo=m; else hi=m;}
chk('zero crossing porosity',29,(lo+hi)/2*100,0.6);
console.log('EXERCISE 2');
chk('gas phi 20%',-0.004,rc(rm({phi:0.20,fluid:'gas',sHc:1})),0.0006);
chk('gas phi 30%',-0.162,rc(rm({phi:0.30,fluid:'gas',sHc:1})),0.0006);
console.log('EXERCISE 3');
[[0,-0.011],[0.02,-0.063],[0.05,-0.091],[0.10,-0.110],[0.20,-0.125],[1,-0.162]]
 .forEach(([s,q])=>chk('phi30 Sg '+(s*100)+'%',q,rc(rm({phi:0.30,fluid:'gas',sHc:s})),0.0006));
const r0=rc(rm({phi:0.30,fluid:'gas',sHc:0})),r1=rc(rm({phi:0.30,fluid:'gas',sHc:1}));
[[0.02,35],[0.10,66],[0.20,76]].forEach(([s,q])=>
 chk('percent of swing at Sg '+(s*100)+'%',q,100*(rc(rm({phi:0.30,fluid:'gas',sHc:s}))-r0)/(r1-r0),0.6));
console.log('EXERCISE 4');
[[2300,-0.0626],[2700,-0.1615],[3100,-0.2442]].forEach(([v,q])=>{
  const s2=R.mudrock(v);chk('shale '+v,q,R.rcNormal(s2,rm({phi:0.30,fluid:'gas',sHc:1})),0.0002);});
const a=R.rcNormal(R.mudrock(2300),rm({phi:0.30,fluid:'gas',sHc:1}));
const b=R.rcNormal(R.mudrock(3100),rm({phi:0.30,fluid:'gas',sHc:1}));
chk('factor across shale range',3.9,b/a,0.05);
console.log('EXERCISE 5 / KEY POINTS');
const oil=rm({phi:0.30,fluid:'oil',sHc:1,api:32,gor:0}),brn=rm({phi:0.35,fluid:'brine',sHc:0});
chk('oil 30% R',-0.0637,rc(oil),0.0002);
chk('brine 35% R',-0.0636,rc(brn),0.0002);
chk('oil Vp/Vs',1.71,oil.vpvs,0.006);
chk('brine Vp/Vs',1.92,brn.vpvs,0.006);
chk('difference in R',0.0001,Math.abs(rc(oil)-rc(brn)),0.00006);
chk('difference in Vp/Vs',0.2,Math.abs(oil.vpvs-brn.vpvs),0.015);
console.log('METHOD');
chk('critical-porosity Vp at 20%',4679,rm({phi:0.20,fluid:'brine',sHc:0,frame:'critical'}).vp,1);
chk('soft-sand Vp at 20%',3202,rm({phi:0.20,fluid:'brine',sHc:0}).vp,1);
chk('critical-porosity R at 20%',0.287,rc(rm({phi:0.20,fluid:'brine',sHc:0,frame:'critical'})),0.0006);
chk('soft-sand R at 20%',0.105,rc(rm({phi:0.20,fluid:'brine',sHc:0})),0.0006);
console.log('STEP 4 LEGEND');
const ric=(t,f)=>{const x=Math.PI*Math.PI*f*f*t*t;return (1-2*x)*Math.exp(-x);};
let worst=0;
for(const f of [20,30,40]){
  let best=0;
  for(let d=0.0005;d<0.05;d+=0.00005){
    let m=0;for(let t=-0.03;t<0.06;t+=0.0001){const v=ric(t,f)-ric(t-d,f);if(Math.abs(v)>Math.abs(m))m=v;}
    if(Math.abs(m)>Math.abs(best))best=m;
  }
  worst=Math.max(worst,Math.abs(best));
}
chk('tuning amplitude, percent above R',45,(worst-1)*100,1.5);
console.log('\n'+(bad?bad+' MISMATCHES':'every number quoted in the prose matches the page')+'\n');
process.exit(bad?1:0);
