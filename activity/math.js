(function(root){
"use strict";
function mkFn(o){
  // o: {f, d, label, xmin, xmax}
  const mins=[]; const N=4000; const lo=o.xmin-3, hi=o.xmax+3;
  let px=lo, pd=o.d(lo);
  for(let i=1;i<=N;i++){ const x=lo+(hi-lo)*i/N, dv=o.d(x);
    if(pd<0 && dv>=0){ let a=px,b=x; for(let k=0;k<60;k++){ const m=(a+b)/2; if(o.d(m)<0) a=m; else b=m; } mins.push({x:(a+b)/2}); }
    px=x; pd=dv; }
  let gi=0; mins.forEach((m,i)=>{ m.f=o.f(m.x); if(m.f<mins[gi].f) gi=i; }); mins.forEach((m,i)=>m.global=i===gi);
  return {...o, mins, gmin:mins[gi]};
}
const BOWL  = mkFn({f:x=>x*x, d:x=>2*x, label:"f(x) = x²   ·   f′(x) = 2x", xmin:-4.5, xmax:4.5});
const SHIFT = mkFn({f:x=>(x-1)*(x-1), d:x=>2*(x-1), label:"f(x) = (x − 1)²   ·   f′(x) = 2(x − 1)", xmin:-3.5, xmax:5.5});
const NARROW= mkFn({f:x=>4*x*x, d:x=>8*x, label:"f(x) = 4x²   ·   f′(x) = 8x", xmin:-3, xmax:3});
const VALLEYS=mkFn({f:x=>0.05*x**4-0.6*x*x+0.4*x, d:x=>0.2*x**3-1.2*x+0.4, label:"f(x) = 0.05x⁴ − 0.6x² + 0.4x   ·   f′(x) = 0.2x³ − 1.2x + 0.4", xmin:-4.5, xmax:4.5});
const FLAT  = mkFn({f:x=>0.25*x**4, d:x=>x**3, label:"f(x) = x⁴ / 4   ·   f′(x) = x³", xmin:-4.5, xmax:4.5});
const NEWFN = mkFn({f:x=>0.5*(x-2)*(x-2)+1, d:x=>x-2, label:"f(x) = 0.5(x − 2)² + 1   ·   f′(x) = x − 2", xmin:-3, xmax:7});

function trajectory(fn,x0,lr,steps){ if(!Number.isFinite(x0)||!Number.isFinite(lr)||lr<0||!Number.isInteger(steps)||steps<0||steps>1000) throw new RangeError("Invalid trajectory settings"); const xs=[x0]; for(let i=0;i<steps;i++){ const x=xs[xs.length-1]; let nx=x-lr*fn.d(x); if(!Number.isFinite(nx)||Math.abs(nx)>1e8) nx=Math.sign(nx||1)*1e8; xs.push(nx); } return xs; }
function outcome(fn,xs,tol){
  const N=xs.length-1, last=xs[N];
  if(Math.abs(last)>=1e7) return "diverge";
  const near=fn.mins.find(m=>Math.abs(last-m.x)<tol);
  if(near) return near.global?"global":"local";
  const dist=x=>Math.min(...fn.mins.map(m=>Math.abs(x-m.x)));
  if(N>=1 && dist(last)>dist(xs[0])*1.001 && Math.abs(xs[N]-xs[N-1])>=Math.abs(xs[1]-xs[0])*0.999) return "diverge";
  let alt=0,cnt=0; for(let i=Math.max(1,N-5);i<N;i++){ const a=xs[i]-xs[i-1], b=xs[i+1]-xs[i]; if(a&&b){ cnt++; if(Math.sign(a)!==Math.sign(b)) alt++; } }
  if(cnt && alt>=cnt*0.6) return "oscillate";
  return "slow";
}

const api={mkFn,BOWL,SHIFT,NARROW,VALLEYS,FLAT,NEWFN,trajectory,outcome};
if(typeof module!=="undefined") module.exports=api; else root.LabMath=api;
})(globalThis);
