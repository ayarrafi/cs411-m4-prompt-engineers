
(function(){
"use strict";

/* ================= maths ================= */
const {BOWL,SHIFT,NARROW,VALLEYS,FLAT,NEWFN,trajectory,outcome}=LabMath;
const OUT={global:"Reaches the global minimum in time", local:"Gets stuck in the other valley (a local minimum)", slow:"Heads the right way but doesn't arrive in time", oscillate:"Zig-zags and doesn't settle in time", diverge:"Overshoots more and more (diverges)"};
const SHORT={global:"global min", local:"local min", slow:"too slow", oscillate:"oscillates", diverge:"diverges"};
function outLabel(id,fn){ if(id==="global" && fn.mins.length===1) return "Reaches the minimum in time"; return OUT[id]; }
function outOptions(fn){ return ["global","local","slow","oscillate","diverge"].filter(k=>k!=="local"||fn.mins.length>1).map(id=>({id,label:outLabel(id,fn)})); }
const fmt=(v,n=3)=>{ if(!Number.isFinite(v)) return "∞"; if(Math.abs(v)>=1e4) return v.toExponential(1); const s=v.toFixed(n); return /^-0\.0+$/.test(s)?s.slice(1):s; };
function sub(k){return String(k).split("").map(d=>"₀₁₂₃₄₅₆₇₈₉"[+d]).join("");}

/* ================= lesson content ================= */
const STAGES=[
  {id:"explore", name:"Explore", min:7},
  {id:"theory",  name:"Theory", min:7},
  {id:"missions",name:"Missions", min:12},
  {id:"assess",  name:"Transfer check", min:4}
];
const EXPLORE_HINTS=[
  "Run the ball with η = 0.1, then with η = 0.5. What changes about the steps?",
  "Now try η = 0.95 and then η = 1.05. Is a bigger learning rate always better?",
  "Start once on the left (x₀ < 0) and once on the right (x₀ > 0). Which way does the first step go each time, and why?",
  "Look at the orange slope line before each step. How does its steepness relate to how far the next step goes?"
];
const SCAFFOLD={
  diverge:["Look at the first step in the table. Is x₁ closer to the minimum than x₀, or farther away?",
           "Each step has size η·|f′(x)|. If it overshoots the minimum by more than the distance you started from, the error grows every step. What could you change to make the steps shorter?",
           "The steps overshoot more and more, so the run diverges. Reduce η (for example, halve it) and run again."],
  oscillate:["Look at the direction of the steps in the table. What pattern do you see?",
             "The ball keeps jumping across the minimum. A smaller η makes each jump shorter, so the zig-zag dies out sooner.",
             "η is a bit too large, so every step overshoots. Reduce η a little so the zig-zag settles within the available steps."],
  slow:["Compare one step η·f′(x) with the distance still left to the minimum. How many steps like that would you need?",
        "The steps go the right way but are too short. A larger η, or a start where the slope is steeper, covers the distance faster.",
        "With these settings the run needs more steps than you have. Increase η moderately, and check that the first step does not overshoot."],
  local:["Which valley did the ball end up in? From your start, which way does the slope point?",
         "Small enough gradient descent steps move downhill from where they start. On which side of the hump would you have to start to roll into the deeper valley?",
         "The start is on the slope of the shallow valley, so small downhill steps can never leave it. Move x₀ to the left of the hump (around x = 0.3) and run again."]
};
/* Theory checks: after a wrong answer, "Try again" serves a fresh variant with new numbers,
   so a student cannot simply copy the revealed answer. Variant 0 is the original step. */
const num=v=>String(+v.toFixed(3)).replace("-","−");
const T1_SETS=[[5,0.1],[-1,0.3],[3,0.3],[-2,0.4]];
function t1Variant(k){
  const [x0,lr]=T1_SETS[k%T1_SETS.length]; const g=2*(x0-1), step=lr*g, x1=x0-step; const left=g>0;
  return {
    cfg:{x0,lr,steps:1},
    brief:`New numbers this time, same rule. Start at x₀ = ${num(x0)} with learning rate η = ${num(lr)}. The minimum of this curve is at x = 1 — this is the target. Calculate one update, then run it to check.`,
    q:{type:"number", prompt:`Starting from x₀ = ${num(x0)} with η = ${num(lr)}, what is x₁? (two decimals)`},
    explainPrompt:`Why did x move to the ${left?"left":"right"}, toward 1?`,
    key:`f′(${num(x0)}) = 2·(${num(x0)} − 1) = ${num(g)} is ${left?"positive":"negative"}, so −η·f′ is ${left?"negative":"positive"} and x ${left?"decreases":"increases"}: x₁ = ${num(x0)} − ${num(lr)}·(${num(g)}) = ${num(x1)}. The minus sign makes the step go against the slope, which is downhill.`,
    hints:[`Start with the slope at x₀ = ${num(x0)}. What is f′(${num(x0)}) for this curve?`,`f′(${num(x0)}) = 2·(${num(x0)} − 1). Multiply it by η = ${num(lr)}, then subtract the result from x₀.`,`f′(${num(x0)}) = ${num(g)}, so η·f′ = ${num(step)} and x₁ = ${num(x0)} − (${num(step)}) = ${num(x1)}.`]
  };
}
const T2_SETS=[[-2,0.9,10],[3,1.1,8],[2.5,0.05,8],[-3,0.4,10]];
function t2Variant(k){
  const [x0,lr,steps]=T2_SETS[k%T2_SETS.length]; const xs=trajectory(BOWL,x0,lr,steps), out=outcome(BOWL,xs,0.05);
  const f=1-2*lr, x1=xs[1], xN=xs[steps];
  const tail={
    oscillate:`|factor| is below 1 but the factor is negative, so x flips side every step and shrinks only slowly; after ${steps} steps it is still about ${num(Math.abs(xN))} away.`,
    diverge:`|factor| is above 1, so each step lands farther from the minimum than the last; x keeps flipping side and grows (about ${num(Math.abs(xN))} after ${steps} steps).`,
    slow:`the factor is positive and close to 1, so x creeps toward 0 without flipping; after ${steps} steps it is still about ${num(Math.abs(xN))} away.`,
    global:`the factor is small and positive, so x shrinks fast and is within 0.05 of the minimum well before step ${steps}.`
  }[out];
  return {
    cfg:{x0,lr,steps},
    brief:`New numbers this time. Back to f(x) = x², now starting at x₀ = ${num(x0)} with η = ${num(lr)} and ${steps} steps. Predict first, then run.`,
    key:`f′(${num(x0)}) = ${num(2*x0)}, so the first step is −${num(lr)}·(${num(2*x0)}) = ${num(-lr*2*x0)}: x₁ = ${num(x1)}. Each step multiplies x by 1 − 2η = ${num(f)}, so ${tail}`,
    hints:[`Compute the first step: f′(${num(x0)}) = ${num(2*x0)}. How far does η·f′ move x, and where does it land?`,`x₁ = ${num(x0)} − ${num(lr)}·(${num(2*x0)}) = ${num(x1)}. Is that closer to 0 than x₀ was? What will the next step do?`,`Each step multiplies x by (1 − 2·${num(lr)}) = ${num(f)}. Is that factor negative (side flips)? Is its size below or above 1? Here ${tail}`]
  };
}
const STEPS=[
 {id:"explore", stage:"explore", type:"explore", title:"Play with the ball", fn:BOWL, cfg:{x0:3,lr:0.1,steps:10}, free:["x0","lr","steps"], x0Range:[-4.5,4.5],
  brief:"A ball sits on a loss curve. Each run, an algorithm moves it step by step. Change the start, the learning rate η and the number of steps, run it, and compare what happens. No formulas yet."},
 {id:"rule", stage:"theory", type:"rule", title:"The update rule", fn:BOWL, cfg:{x0:3,lr:0.2,steps:6}, free:[],
  brief:"Everything you just tried is one line of maths. Step through a run and watch each part of the rule fill in."},
 {id:"t1", variant:t1Variant, stage:"theory", type:"check", title:"Compute one update", fn:SHIFT, cfg:{x0:5,lr:0.1,steps:1}, free:[], x0Range:[-3.5,5.5],
  brief:"Start at x₀ = 5 with learning rate η = 0.1. The minimum of this curve is at x = 1 — this is the target. Calculate one update, then run it to check.",
  q:{type:"number", prompt:"Starting from x₀ = 5 with η = 0.1, what is x₁? (two decimals)"},
  answer:(fn,xs)=>xs[1], check:(p,a)=>Math.abs(p-a)<0.011,
  explainPrompt:"Why did x move to the left, toward 1?",
  key:"f′(5) = 2·(5 − 1) = 8 is positive, so −η·f′ is negative and x decreases: x₁ = 5 − 0.1·8 = 4.2. The minus sign makes the step go against the slope, which is downhill.",
  hints:["Start with the slope at x₀ = 5. What is f′(5) for this curve?","f′(5) = 2·(5 − 1). Multiply it by η = 0.1, then subtract the result from x₀.","f′(5) = 8, so η·f′ = 0.8 and x₁ = 5 − 0.8 = 4.2."]},
 {id:"t2", variant:t2Variant, stage:"theory", type:"check", title:"Predict a large step", fn:BOWL, cfg:{x0:-2,lr:0.9,steps:10}, free:[],
  brief:"Back to f(x) = x², now starting at x₀ = −2 with a large learning rate η = 0.9 and 10 steps. Predict first, then run.",
  q:{type:"choice", prompt:"What will the path do?"}, tol:0.05,
  answer:(fn,xs,st)=>outcome(fn,xs,st.tol), check:(p,a)=>p===a,
  explainPrompt:"Why does the path look like this?",
  key:"f′(−2) = −4, so the first step is −0.9·(−4) = +3.6: it jumps to x₁ = 1.6, past the minimum. Each step multiplies x by 1 − 2η = −0.8, so x flips side every step and shrinks only slowly; after 10 steps it is still about 0.2 away.",
  hints:["Compute the first step: f′(−2) = −4. How far does η·f′ move x, and where does it land?","x₁ = −2 − 0.9·(−4) = 1.6, on the other side of the minimum. Is it closer than −2 was? What will the next step do?","Each step multiplies x by (1 − 2·0.9) = −0.8: the sign flips every step and the size shrinks only by 20%. It zig-zags and does not settle in 10 steps."]},
 {id:"m1", stage:"missions", type:"mission", title:"Into the bowl", fn:BOWL, cfg:{x0:3,lr:0.05,steps:8}, free:["lr"], tol:0.05,
  brief:"Reach the global minimum (within 0.05) in 8 steps. The start is fixed at x₀ = 3; you choose η.",
  key:"Each step removes a fraction 2η of the distance. Too small and it runs out of steps; a moderate η (about 0.21 to 0.79) gets there in time."},
 {id:"m2", stage:"missions", type:"mission", title:"A narrow bowl", fn:NARROW, cfg:{x0:2,lr:0.3,steps:8}, free:["lr"], tol:0.05,
  brief:"This bowl is four times steeper. Reach the minimum within 0.05 in 8 steps from x₀ = 2. You choose η.",
  key:"The slope is four times larger, so the same η makes four times bigger steps. η must be much smaller here (about 0.05 to 0.2) to avoid overshooting."},
 {id:"m3", stage:"missions", type:"mission", title:"Two valleys", fn:VALLEYS, cfg:{x0:2.5,lr:0.1,steps:25}, free:["x0","lr"], x0Range:[-1,4.5], tol:0.05,
  brief:"This curve has two valleys. Reach the deeper one (the global minimum) within 0.05 in 25 steps. You choose x₀ (from −1 to 4.5) and η.",
  key:"With sufficiently small steps, the starting valley matters: right of the hump near x = 0.34 leads to the shallow valley, while left leads to the deeper one. Large steps can cross valleys or diverge."},
 {id:"m4", stage:"missions", type:"mission", title:"Steep walls, flat floor", fn:FLAT, cfg:{x0:3,lr:0.3,steps:12}, free:["x0","lr"], x0Range:[1,4.5], tol:0.25,
  brief:"Steep walls but a very flat bottom. Get within 0.25 of the minimum in 12 steps. You choose x₀ (from 1 to 4.5) and η.",
  key:"The slope x³ is huge on the walls and tiny near the bottom, so one η can overshoot high up and still crawl at the bottom. Starting lower down allows a larger η without overshooting."},
 {id:"assess", stage:"assess", type:"assess", title:"Learning activity: transfer check", fn:NEWFN, cfg:{x0:6,lr:1.8,steps:10}, free:[], x0Range:[-3,7], tol:0.05,
  brief:"A curve you have not seen before. Answer on your own; the tutor is switched off for this part."}
];
const ASSESS_Q=[
 {id:"a1", type:"number", prompt:"Start at x₀ = 6 with η = 0.5. What is x₁?", answer:4, check:(p)=>Math.abs(p-4)<0.011, why:"f′(6) = 6 − 2 = 4, so x₁ = 6 − 0.5·4 = 4."},
 {id:"a2", type:"choice", prompt:"Now use η = 2.5, starting at x₀ = 6. The first positions are 6 → −4 → 11; the minimum is at x = 2. What behavior do you expect if this pattern continues over 10 steps?",
  guidance:"Compare how far each position is from x = 2. You do not need to calculate all 10 updates. The main plot shows Q3, not this run.",
  options:[{id:"global",label:"It still reaches the minimum, just faster"},{id:"oscillate",label:"It zig-zags and doesn't settle in time"},{id:"slow",label:"It heads the right way but doesn't arrive in time"},{id:"diverge",label:"It overshoots more and more (diverges)"}],
  answer:"diverge", why:"Each step multiplies the distance to x = 2 by (1 − η) = −1.5: the sign flips and the error grows by 50% every step."},
 {id:"a3", type:"choice", prompt:"For η = 1.8, use the plot and the selected rows below. Does this run reach within 0.05 of the minimum at x = 2 after 10 steps, or show another behavior?",
  guidance:"Look at which side of x = 2 each point lies on and how its distance changes. Read the last row to check the target; no mental simulation is needed.",
  options:outOptions(NEWFN), answer:"oscillate", why:"Each step multiplies the distance by (1 − 1.8) = −0.8: it overshoots every time and shrinks only 20% per step, so after 10 steps it is still about 0.4 away."}
];

/* ================= state ================= */
const S={i:0, phase:"setup", cond:"ai", pred:null, reason:"", xs:null, shown:1, anim:null, last:null,
  results:{}, variant:{}, threads:{}, hintLevel:{}, fails:{}, signals:{}, runs:{}, log:[], draft:"", ruleSeen:1,
  exploreHint:0, assessAns:{}, assessDone:false, stageStart:Date.now(), aiOK:null, lastRunCfg:null, completeLogged:false};
const $=id=>document.getElementById(id);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const variantCache={};
function stepAt(i){ const b=STEPS[i]; const k=b&&b.variant?(S.variant[b.id]||0):0; if(!k) return b; const key=b.id+":"+k; return variantCache[key]||(variantCache[key]={...b,...b.variant(k)}); }
const cur=()=>stepAt(S.i);
function logEv(ev,data){ S.log.push({t:new Date().toISOString(),cond:S.cond,step:cur()?cur().id:"end",ev,...data}); $("foot").textContent=`Event log: ${S.log.length} entries.`; window.Study?.lessonEvent(S.log[S.log.length-1]); }
function el(tag,attrs={},html){ const e=document.createElement(tag); for(const k in attrs){ if(k==="class") e.className=attrs[k]; else if(k.startsWith("on")) e.addEventListener(k.slice(2),attrs[k]); else e.setAttribute(k,attrs[k]); } if(html!=null) e.innerHTML=html; return e; }
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

/* ================= controls ================= */
const ctl={x0:$("x0"),lr:$("lr"),steps:$("steps")};
function cfg(){ return {x0:+ctl.x0.value, lr:+ctl.lr.value, steps:+ctl.steps.value}; }
function syncOutputs(){ $("x0o").textContent=fmt(+ctl.x0.value,1); $("lro").textContent=fmt(+ctl.lr.value,2); $("stepso").textContent=ctl.steps.value; }
function editable(){ if(!window.Study?.isLearning()) return false; const st=cur(); if(!st) return false; if(st.type==="explore") return S.phase!=="running"; if(st.type==="mission") return S.phase==="setup"; return false; }
function applyLocks(){
  const st=cur(); const free=st?st.free:[]; const ed=editable();
  for(const k of ["x0","lr","steps"]){
    const box=$("c-"+k); const locked=!st||!free.includes(k)||!ed;
    ctl[k].disabled=locked; box.classList.toggle("locked",locked);
    box.querySelector(".lock").textContent = !st ? "" : free.includes(k) ? (ed?"You choose this":"Locked during the run") : "Set by this step";
  }
}
for(const k in ctl){ ctl[k].addEventListener("input",()=>{ syncOutputs(); logEv("setting_change",{control:k,value:+ctl[k].value}); if(editable()){ S.xs=null; S.shown=1; draw(); renderTable(); } }); }

/* ================= plot ================= */
const cv=$("plot"); const ctx=cv.getContext("2d");
function tok(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function plotXs(){ const c=cfg(); return S.xs||[c.x0]; }
function view(fn){
  const xmin=fn.xmin, xmax=fn.xmax; let lo=Infinity, hiR=-Infinity;
  for(let i=0;i<=200;i++){ const v=fn.f(xmin+(xmax-xmin)*i/200); lo=Math.min(lo,v); hiR=Math.max(hiR,v); }
  const xs=plotXs(); let top=-Infinity;
  for(const x of xs){ if(x>=xmin&&x<=xmax) top=Math.max(top,fn.f(x)); }
  for(const m of fn.mins) top=Math.max(top,fn.f(m.x));
  // show the interesting band: at least the valleys, at least the start point
  const minBand=(hiR-lo)*0.35; top=Math.max(top, lo+minBand);
  top=Math.min(hiR, lo+(top-lo)*1.15);
  return {xmin,xmax,ymin:lo-(top-lo)*0.06,ymax:top};
}
function draw(){
  const st=cur(); if(!st) return;
  const fn=st.fn; const r=cv.getBoundingClientRect(); const dpr=window.devicePixelRatio||1; if(r.width<10) return;
  cv.width=Math.round(r.width*dpr); cv.height=Math.round(r.height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  const W=r.width,H=r.height,pad={l:46,r:14,t:16,b:30};
  const v=view(fn);
  const X=x=>pad.l+(x-v.xmin)/(v.xmax-v.xmin)*(W-pad.l-pad.r);
  const Y=y=>pad.t+(1-(y-v.ymin)/(v.ymax-v.ymin))*(H-pad.t-pad.b);
  const ink=tok("--ink"),muted=tok("--muted"),grid=tok("--grid"),acc=tok("--accent"),gr=tok("--grad"),surf=tok("--surface"),line=tok("--line"),good=tok("--good");
  ctx.fillStyle=surf; ctx.fillRect(0,0,W,H);
  ctx.font=`12px ${tok("--font-mono")}`; ctx.textBaseline="middle";
  const stepX=(v.xmax-v.xmin)>8?2:1;
  for(let gx=Math.ceil(v.xmin/stepX)*stepX; gx<=v.xmax+1e-9; gx+=stepX){ ctx.strokeStyle=grid; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(X(gx),pad.t); ctx.lineTo(X(gx),H-pad.b); ctx.stroke(); ctx.fillStyle=muted; ctx.textAlign="center"; ctx.fillText(String(gx),X(gx),H-pad.b+14); }
  const raw=(v.ymax-v.ymin)/5; const p=Math.pow(10,Math.floor(Math.log10(raw))); const ys=[1,2,5,10].map(k=>k*p).find(k=>k>=raw)||raw;
  for(let gy=Math.ceil(v.ymin/ys)*ys; gy<=v.ymax; gy+=ys){ ctx.strokeStyle=grid; ctx.beginPath(); ctx.moveTo(pad.l,Y(gy)); ctx.lineTo(W-pad.r,Y(gy)); ctx.stroke(); ctx.fillStyle=muted; ctx.textAlign="right"; ctx.fillText(String(+gy.toFixed(3)),pad.l-6,Y(gy)); }
  ctx.fillStyle=muted; ctx.textAlign="right"; ctx.fillText("x",W-pad.r,H-pad.b+14);
  ctx.save(); ctx.beginPath(); ctx.rect(pad.l,pad.t,W-pad.l-pad.r,H-pad.t-pad.b); ctx.clip();
  ctx.strokeStyle=ink; ctx.lineWidth=2; ctx.beginPath();
  for(let i=0;i<=300;i++){ const x=v.xmin+(v.xmax-v.xmin)*i/300; const y=Y(fn.f(x)); i?ctx.lineTo(X(x),y):ctx.moveTo(X(x),y); } ctx.stroke();
  for(const m of fn.mins){ ctx.strokeStyle=m.global?good:line; ctx.setLineDash([3,4]); ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(X(m.x),Y(m.f)); ctx.lineTo(X(m.x),H-pad.b); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=m.global?good:muted; ctx.textAlign="left"; ctx.fillText(fn.mins.length>1?(m.global?"global min":"local min"):"min",X(m.x)+5,Y(m.f)+14); }
  const xs=plotXs(); const n=Math.min(S.shown,xs.length);
  const inView=x=>x>=v.xmin&&x<=v.xmax&&fn.f(x)<=v.ymax;
  const cx=x=>Math.max(v.xmin,Math.min(v.xmax,x)); const cy=x=>Math.min(fn.f(x),v.ymax);
  for(let k=0;k<n-1;k++){ ctx.globalAlpha=.35+.65*(k+1)/n; arrow(X(cx(xs[k])),Y(cy(xs[k])),X(cx(xs[k+1])),Y(cy(xs[k+1])),acc); }
  ctx.globalAlpha=1;
  for(let k=0;k<n;k++){ const x=xs[k]; if(!inView(x)) continue; ctx.beginPath(); ctx.arc(X(x),Y(fn.f(x)),k===n-1?6:4,0,Math.PI*2); ctx.fillStyle=k===n-1?acc:surf; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle=acc; ctx.stroke();
    if(n<=7||k===0||k===n-1){ ctx.fillStyle=muted; ctx.textAlign="center"; ctx.fillText("x"+sub(k),X(x),Y(fn.f(x))-14); } }
  const xc=xs[n-1];
  if(inView(xc)){ const s=fn.d(xc); const dx=(v.xmax-v.xmin)*0.08; const sy=(v.ymax-v.ymin)/(H-pad.t-pad.b), sx=(v.xmax-v.xmin)/(W-pad.l-pad.r);
    // keep the tangent short on screen even when it is steep
    const pxLen=60, ang=Math.atan2(s*dx/sy, dx/sx); const ddx=Math.cos(ang)*pxLen, ddy=Math.sin(ang)*pxLen;
    ctx.strokeStyle=gr; ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(X(xc)-ddx,Y(fn.f(xc))+ddy); ctx.lineTo(X(xc)+ddx,Y(fn.f(xc))-ddy); ctx.stroke(); }
  ctx.restore();
  if(!inView(xc)){ ctx.fillStyle=tok("--bad"); ctx.font=`600 13px ${tok("--font-body")}`; ctx.textAlign=xc>fn.gmin.x?"right":"left"; ctx.fillText(`x${sub(n-1)} = ${fmt(xc,1)} is off the chart`, xc>fn.gmin.x?W-pad.r-6:pad.l+6, pad.t+12); }
  ctx.strokeStyle=line; ctx.lineWidth=1; ctx.strokeRect(pad.l+.5,pad.t+.5,W-pad.l-pad.r-1,H-pad.t-pad.b-1);
}
function arrow(x1,y1,x2,y2,col){ ctx.strokeStyle=col; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); if(Math.hypot(x2-x1,y2-y1)<14) return; const a=Math.atan2(y2-y1,x2-x1), h=8, ex=x2-Math.cos(a)*7, ey=y2-Math.sin(a)*7; ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(ex-h*Math.cos(a-0.45),ey-h*Math.sin(a-0.45)); ctx.lineTo(ex-h*Math.cos(a+0.45),ey-h*Math.sin(a+0.45)); ctx.closePath(); ctx.fill(); }
new ResizeObserver(()=>draw()).observe(cv);
try{ matchMedia("(prefers-color-scheme: dark)").addEventListener("change",draw); new MutationObserver(draw).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]}); }catch(e){}

function renderTable(){
  const st=cur(), th=$("thead"), tb=$("tbody"); tb.innerHTML=""; if(!st){ th.innerHTML=""; return; }
  const explore=st.type==="explore";
  th.innerHTML = explore ? "<tr><th>step t</th><th>xₜ</th><th>f(xₜ)</th></tr>" : "<tr><th>t</th><th>xₜ</th><th>f′(xₜ)</th><th>η·f′(xₜ)</th><th>f(xₜ)</th></tr>";
  const c=cfg(); const xs=plotXs(); const n=Math.min(S.shown,xs.length);
  const hide = st.q && st.q.type==="number" && S.phase==="setup";
  for(let k=0;k<n;k++){ const x=xs[k], g=st.fn.d(x); const tr=document.createElement("tr"); if(k===n-1) tr.className="curr";
    tr.innerHTML = explore ? `<td>${k}</td><td>${fmt(x)}</td><td>${fmt(st.fn.f(x))}</td>` : hide ? `<td>${k}</td><td>${fmt(x)}</td><td>?</td><td>?</td><td>${fmt(st.fn.f(x))}</td>` : `<td>${k}</td><td>${fmt(x)}</td><td>${fmt(g)}</td><td>${fmt(c.lr*g)}</td><td>${fmt(st.fn.f(x))}</td>`;
    tb.appendChild(tr); }
  const box=tb.closest(".tablebox"); if(box) box.scrollTop=box.scrollHeight;
}
function animate(done){
  clearInterval(S.anim);
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){ S.shown=S.xs.length; draw(); renderTable(); done(); return; }
  S.shown=1; draw(); renderTable();
  S.anim=setInterval(()=>{ S.shown++; draw(); renderTable(); if(S.shown>=S.xs.length){ clearInterval(S.anim); S.anim=null; done(); } }, S.xs.length>14?170:S.xs.length>8?250:340);
}

/* ================= track & clock ================= */
function renderTrack(){
  const t=$("track"); t.innerHTML="";
  STAGES.forEach(sg=>{ const steps=STEPS.map((s,i)=>({s,i})).filter(o=>o.s.stage===sg.id); const isCur=cur()&&cur().stage===sg.id;
    const box=el("div",{class:"stage"+(isCur?" cur":"")}); box.appendChild(el("span",{class:"sname"},`${esc(sg.name)} · ${sg.min} min`));
    const pips=el("div",{class:"pips"}); let n=0;
    steps.forEach(({s,i})=>{ const lab=s.type==="rule"?"rule":s.type==="explore"?"go":s.type==="assess"?"✓":String(++n); pips.appendChild(el("span",{class:"pip"+(i===S.i?" cur":"")+(S.results[s.id]?.done?" done":""),title:s.title},lab)); });
    box.appendChild(pips); t.appendChild(box); });
}
setInterval(()=>{ const c=document.querySelector(".clock"); if(!c||!cur()) return; const sg=STAGES.find(s=>s.id===cur().stage); const sec=Math.floor((Date.now()-S.stageStart)/1000); c.textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")} / ~${sg.min}:00`; },1000);

/* ================= panel ================= */
function head(box,st){
  const sg=STAGES.find(s=>s.id===st.stage);
  const row=el("div",{class:"eyerow"});
  let label=sg.name;
  if(st.type==="mission"){ label+=` · Mission ${STEPS.filter(s=>s.type==="mission").indexOf(st)+1} of 4`; }
  if(st.type==="check"){ label+=" · Check"; }
  row.appendChild(el("span",{class:"eyebrow"},esc(label))); row.appendChild(el("span",{class:"clock"},""));
  box.appendChild(row);
  box.appendChild(el("h2",{class:"mtitle"},esc(st.title)));
  box.appendChild(el("p",{class:"brief"},esc(st.brief)));
  box.appendChild(el("div",{class:"fnline"},esc(st.type==="explore"?"f(x) = x²":st.fn.label)));
}
function renderPanel(){
  if(!window.Study?.isLearning()) return;
  const focusedId=document.activeElement?.id;
  renderTrack(); applyLocks();
  const box=$("panel"); box.innerHTML="";
  const st=cur(); $("plotcap").hidden=true;
  if(!st){ renderSummary(box); return; }
  head(box,st);
  ({explore:renderExplore, rule:renderRule, check:renderCheck, mission:renderMission, assess:renderAssess})[st.type](box,st);
  if(focusedId) document.getElementById(focusedId)?.focus({preventScroll:true});
  const clock=document.querySelector(".clock"); if(clock){ const sg=STAGES.find(s=>s.id===st.stage); const sec=Math.floor((Date.now()-S.stageStart)/1000); clock.textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")} / ~${sg.min}:00`; }
}

/* ---- explore ---- */
function renderExplore(box,st){
  const runs=S.runs.explore||[];
  const b=el("div",{class:"btns"});
  const rb=el("button",{class:"btn",id:"runBtn"},"Run"); rb.disabled=S.phase==="running"; rb.addEventListener("click",exploreRun);
  b.appendChild(rb); box.appendChild(b);
  if(runs.length){
    const list=el("div",{class:"runs"}); list.appendChild(el("span",{class:"label"},"Your runs"));
    runs.slice(-6).forEach((r,i)=>{ const row=el("div",{class:"r"}); row.innerHTML=`<span class="mono">x₀ ${fmt(r.x0,1)} · η ${fmt(r.lr,2)} · ${r.steps} steps</span><span class="chip ${r.out}">${SHORT[r.out]}</span>`; list.appendChild(row); });
    box.appendChild(list);
  }
  const distinctLr=new Set(runs.map(r=>r.lr)).size;
  const ready=runs.length>=3 && distinctLr>=2;
  const nb=el("div",{class:"btns"}); const go=el("button",{class:"btn ghost",onclick:()=>{ S.results.explore={done:true,runs:runs.length}; logEv("explore_done",{runs:runs.length,distinctLr}); next(); }},"Continue to the theory"); go.disabled=!ready; nb.appendChild(go); box.appendChild(nb);
  box.appendChild(el("p",{class:"hintline"}, ready?"Explore as long as you like, then continue.":"Do at least three runs with at least two different learning rates to continue."));
  box.appendChild(tutorBox(st));
}
function exploreRun(){
  const st=cur(), c=cfg();
  S.xs=trajectory(st.fn,c.x0,c.lr,c.steps); S.phase="running"; renderPanel();
  animate(()=>{ const out=outcome(st.fn,S.xs,0.05); (S.runs.explore=S.runs.explore||[]).push({...c,out}); logEv("explore_run",{cfg:c,observed:out}); S.phase="setup"; renderPanel(); });
}

/* ---- rule ---- */
function renderRule(box,st){
  if(!S.xs) S.xs=trajectory(st.fn,st.cfg.x0,st.cfg.lr,st.cfg.steps);
  const xs=S.xs, t=Math.max(0,Math.min(S.shown-1,xs.length-2)); const x=xs[t], g=st.fn.d(x), nx=xs[t+1];
  const eq=el("div",{class:"eq"});
  eq.appendChild(el("div",{class:"row"},`x<sub>t+1</sub> = <span class="c-x">x<sub>t</sub></span> − <span class="c-n">η</span> · <span class="c-g">f′(x<sub>t</sub>)</span>`));
  eq.appendChild(el("div",{class:"row"},`x${sub(t+1)} = <span class="c-x">${fmt(x)}</span> − <span class="c-n">${fmt(st.cfg.lr,2)}</span> · <span class="c-g">${fmt(g)}</span> = ${fmt(nx)}`));
  box.appendChild(eq);
  const dl=el("dl",{class:"map"});
  dl.innerHTML=`<dt class="c-x">xₜ</dt><dd>The current position: the blue dot you moved with the start slider.</dd>
  <dt class="c-g">f′(xₜ)</dt><dd>The derivative, drawn as the orange slope line. Its sign sets the direction; its size scales the step.</dd>
  <dt class="c-n">η</dt><dd>The learning rate you changed while exploring. It scales every step.</dd>
  <dt>−</dt><dd>Step against the local slope. A sufficiently small step decreases the function; large steps can increase it.</dd>
  <dt>x<sub>t+1</sub></dt><dd>The next position: the next dot on the path.</dd>`;
  box.appendChild(dl);
  const b=el("div",{class:"btns"});
  const prev=el("button",{class:"btn ghost",onclick:()=>{ S.shown=Math.max(1,S.shown-1); draw(); renderTable(); renderPanel(); }},"Previous step"); prev.disabled=S.shown<=1;
  const nx2=el("button",{class:"btn ghost",onclick:()=>{ S.shown=Math.min(xs.length,S.shown+1); S.ruleSeen=Math.max(S.ruleSeen,S.shown); draw(); renderTable(); renderPanel(); }},"Next step"); nx2.disabled=S.shown>=xs.length;
  const go=el("button",{class:"btn",onclick:()=>{ S.results.rule={done:true}; logEv("rule_done",{stepsViewed:S.ruleSeen}); next(); }},"Check my understanding"); go.disabled=S.ruleSeen<3;
  b.append(prev,nx2,go); box.appendChild(b);
  box.appendChild(el("p",{class:"hintline"}, S.ruleSeen<3?"Step through at least two updates to continue.":"Compare the numbers with the table under the plot."));
}

/* ---- check (theory) ---- */
const CYC=[["setup","Predict"],["running","Run"],["observed","Compare"],["explain","Explain"]];
function cycle(box){ const idx={setup:0,running:1,wrong:2,explain:3,done:4}[S.phase]??0; const c=el("div",{class:"cycle"}); CYC.forEach(([k,l],i)=>c.appendChild(el("span",{class:i===idx?"on":i<idx?"past":""},l))); box.appendChild(c); }
function predictionUI(box,st,opts,required){
  const q=el("div",{class:"q"}); const ed=S.phase==="setup";
  q.appendChild(el("div",{class:"prompt"},esc(st.q?st.q.prompt:"Before you run: what will the path do?")+(required?"":" <span class=\"hintline\">(optional)</span>")));
  if(!st.q||st.q.type==="choice"){
    opts.forEach(o=>{ const id=`opt-${st.id}-${o.id}`; const lab=el("label",{class:"opt"+(S.pred===o.id?" sel":"")+(ed?"":" dis"),for:id});
      const inp=el("input",{type:"radio",name:"pred-"+st.id,id,value:o.id}); inp.checked=S.pred===o.id; inp.disabled=!ed;
      inp.addEventListener("change",()=>{ S.pred=o.id; markPred(st); renderPanel(); });
      lab.appendChild(inp); lab.appendChild(el("span",{},esc(o.label))); q.appendChild(lab); });
  } else {
    const row=el("div",{class:"numrow"}); const inp=el("input",{type:"number",step:"0.01",id:"num-"+st.id,"aria-label":"Your answer"}); if(S.pred!=null) inp.value=S.pred; inp.disabled=!ed;
    inp.addEventListener("input",()=>{ S.pred=inp.value===""?null:+inp.value; markPred(st); const rb=$("runBtn"); if(rb) rb.disabled=S.pred==null; });
    row.appendChild(el("span",{class:"mono"},"x₁ =")); row.appendChild(inp); q.appendChild(row);
  }
  if(ed){ const why=el("input",{type:"text",class:"why",id:"why-"+st.id,placeholder:"Why do you think so? (optional)","aria-label":"Reason for your prediction"}); why.value=S.reason; why.addEventListener("input",()=>S.reason=why.value); q.appendChild(why); }
  box.appendChild(q);
}
function markPred(st){ const sg=S.signals[st.id]; if(sg && !sg.firstPredAt) sg.firstPredAt=Date.now(); }
function renderCheck(box,st){
  cycle(box);
  const opts=st.q.type==="choice"?outOptions(st.fn):null;
  predictionUI(box,st,opts,true);
  if(S.phase==="setup"){ const b=el("div",{class:"btns"}); const rb=el("button",{class:"btn",id:"runBtn"},"Lock in & run"); rb.disabled=S.pred==null; rb.addEventListener("click",checkRun); b.appendChild(rb); box.appendChild(b); }
  if(S.last && ["wrong","explain","done"].includes(S.phase)) box.appendChild(outcomeCard(st,S.last));
  if(S.phase==="wrong"){ const b=el("div",{class:"btns"}); b.appendChild(el("button",{class:"btn",onclick:resetAttempt},"Try again")); box.appendChild(b); }
  
  box.appendChild(tutorBox(st));
  if(S.phase==="done"){ const b=el("div",{class:"btns"}); b.appendChild(el("button",{class:"btn",onclick:next},"Continue")); box.appendChild(b); }
}
function resetAttempt(){
  const base=STEPS[S.i];
  if(base.variant){ S.variant[base.id]=(S.variant[base.id]||0)+1; const ns=cur(); applyCfg(ns); logEv("variant_change",{variant:S.variant[base.id],cfg:ns.cfg}); }
  const st=cur(); S.phase="setup"; S.pred=null; S.reason=""; S.xs=null; S.shown=1; if(S.signals[st.id]){ S.signals[st.id].firstPredAt=null; S.signals[st.id].shownAt=Date.now(); } renderPanel(); draw(); renderTable(); }
function signalsFor(st,c){
  const sg=S.signals[st.id];
  sg.runs=(sg.runs||0)+1;
  sg.sameSettingsRerun=!!(S.lastRunCfg&&S.lastRunCfg.step===st.id&&S.lastRunCfg.lr===c.lr&&S.lastRunCfg.x0===c.x0);
  sg.etaChange=S.lastRunCfg&&S.lastRunCfg.step===st.id?+(c.lr-S.lastRunCfg.lr).toFixed(2):null;
  sg.secondsBeforePredicting=sg.firstPredAt?Math.round((sg.firstPredAt-(sg.shownAt||Date.now()))/1000):null;
  S.lastRunCfg={step:st.id,...c};
  return {...sg};
}
function checkRun(){
  const st=cur(), c=cfg(); const sig=signalsFor(st,c);
  S.xs=trajectory(st.fn,c.x0,c.lr,c.steps); S.phase="running"; renderPanel();
  animate(()=>{
    const actual=st.answer(st.fn,S.xs,st); const ok=st.check(S.pred,actual);
    S.last={pred:S.pred,actual,predOK:ok,success:ok,cfg:c,xs:S.xs.slice(),reason:S.reason,out:st.q.type==="choice"?actual:null};
    const R=S.results[st.id]||(S.results[st.id]={attempts:[],firstTry:null}); R.attempts.push({pred:S.pred,actual,ok}); if(R.firstTry==null) R.firstTry=ok;
    logEv("check_answer",{prediction:S.pred,reason:S.reason,correct:actual,ok,signals:sig});
    if(ok){ S.phase="explain"; tutorSay(st,"correct"); }
    else { S.hintLevel[st.id]=(S.hintLevel[st.id]||0)+1; S.phase="wrong"; tutorSay(st,"wrong"); }
    renderPanel();
  });
}
function explainUI(box,st){
  const ex=el("div",{class:"q explain"}); ex.appendChild(el("label",{class:"msg t",for:"exp-"+st.id},'<span class="who">Tutor</span>'+esc(st.explainPrompt||"Explain in your own words why this happened.")));
  const ta=el("textarea",{id:"exp-"+st.id,placeholder:"One or two sentences. Use the plot and the table."}); ta.value=S.draft; ex.appendChild(ta);
  const b=el("div",{class:"btns"}); const sb=el("button",{class:"btn"},"Submit explanation"); sb.disabled=ta.value.trim().length<12;
  ta.addEventListener("input",()=>{ S.draft=ta.value; sb.disabled=ta.value.trim().length<12; });
  sb.addEventListener("click",()=>{ const text=ta.value; S.results[st.id].explanation=text; S.results[st.id].done=true; logEv("explanation",{text}); pushMsg(st,"s",text); S.phase="done"; S.draft=""; tutorSay(st,"explain",text); renderPanel(); });
  b.appendChild(sb); ex.appendChild(b); box.appendChild(ex);
  // Bring the box into view (and focus it) once when the explanation begins, so it never sits below the fold.
  const key=st.id+":"+(S.variant[st.id]||0)+":"+(S.results[st.id]?.attempts||[]).length;
  if(lastExplainKey!==key){ lastExplainKey=key; requestAnimationFrame(()=>{ ex.scrollIntoView({block:"center",behavior:"smooth"}); ta.focus({preventScroll:true}); }); }
}
let lastExplainKey=null;
function outcomeCard(st,last){
  const fn=st.fn; const lab=v=> typeof v==="number"?fmt(v,2):outLabel(v,fn);
  const d=el("div",{class:"outcome "+(last.success?"ok":"no")});
  let verdict;
  if(st.type==="mission"){ verdict = last.success ? "Goal reached" : "Goal not reached yet"; }
  else verdict = last.success ? "Correct" : "Not quite";
  d.appendChild(el("div",{class:"verdict"},verdict));
  if(last.pred!=null){ d.appendChild(el("span",{class:"k"},"You predicted")); d.appendChild(el("span",{},esc(lab(last.pred))+(st.type==="mission"?(last.predOK?" ✓":" ✗"):""))); }
  d.appendChild(el("span",{class:"k"},"Observed")); d.appendChild(el("span",{},esc(lab(last.actual))));
  if(st.type==="mission"){ const end=last.xs[last.xs.length-1]; d.appendChild(el("span",{class:"k"},"Final x")); d.appendChild(el("span",{class:"mono"},`x${sub(last.cfg.steps)} = ${fmt(end)} (global min at ${fmt(fn.gmin.x,2)}, target within ${st.tol})`)); }
  return d;
}

/* ---- missions ---- */
function renderMission(box,st){
  const tries=(S.results[st.id]?.attempts||[]);
  cycle(box);
  const required=tries.length===0;
  if(S.phase==="setup" || S.phase==="running") predictionUI(box,st,outOptions(st.fn),required);
  if(S.phase==="setup"){ const b=el("div",{class:"btns"}); const rb=el("button",{class:"btn",id:"runBtn"},required?"Lock in prediction & run":"Run"); rb.disabled=required&&S.pred==null; rb.addEventListener("click",missionRun); b.appendChild(rb); box.appendChild(b);
    box.appendChild(el("p",{class:"hintline"},required?"Predict before your first attempt. Later attempts: predicting is optional but encouraged.":"Change the settings on the right, then run again.")); }
  if(S.last && S.phase!=="running") box.appendChild(outcomeCard(st,S.last));
  if(tries.length>1){ const list=el("div",{class:"runs"}); list.appendChild(el("span",{class:"label"},"Attempts"));
    tries.slice(-5).forEach(r=>{ const row=el("div",{class:"r"}); row.innerHTML=`<span class="mono">x₀ ${fmt(r.x0,1)} · η ${fmt(r.lr,2)}</span><span class="chip ${r.out}">${SHORT[r.out]}</span>`; list.appendChild(row); }); box.appendChild(list); }
  
  box.appendChild(tutorBox(st));
  if(S.phase==="done"){ const b=el("div",{class:"btns"}); b.appendChild(el("button",{class:"btn",onclick:next},st.id==="m4"?"Go to the transfer check":"Next mission")); box.appendChild(b); }
}
function missionRun(){
  const st=cur(), c=cfg(); const sig=signalsFor(st,c);
  S.xs=trajectory(st.fn,c.x0,c.lr,c.steps); S.phase="running"; renderPanel();
  animate(()=>{
    const out=outcome(st.fn,S.xs,st.tol); const success=out==="global"; const predOK=S.pred==null?null:S.pred===out;
    S.last={pred:S.pred,actual:out,predOK,success,cfg:c,xs:S.xs.slice(),reason:S.reason,out};
    const R=S.results[st.id]||(S.results[st.id]={attempts:[],firstTry:null}); R.attempts.push({x0:c.x0,lr:c.lr,pred:S.pred,out,predOK}); if(R.firstTry==null) R.firstTry=success;
    const F=S.fails[st.id]||(S.fails[st.id]={}); if(!success) F[out]=(F[out]||0)+1;
    logEv("mission_run",{cfg:c,prediction:S.pred,reason:S.reason,observed:out,success,predOK,signals:sig});
    S.pred=null; S.reason="";
    if(success){ S.phase="explain"; tutorSay(st,"mission_success"); }
    else { S.phase="setup"; tutorSay(st,"mission_fail"); }
    renderPanel();
  });
}

/* ---- assessment ---- */
function renderAssess(box,st){
  if(!S.xs){ S.xs=trajectory(st.fn,6,1.8,10); S.shown=S.xs.length; draw(); renderTable(); }
  $("plotcap").hidden=false; $("plotcap").textContent="Plot and table: the run for question 3 (x₀ = 6, η = 1.8, 10 steps).";
  ASSESS_Q.forEach((q,qi)=>{
    const w=el("div",{class:"q"}); w.appendChild(el("div",{class:"prompt"},`<span class="qnum">Q${qi+1}</span>${esc(q.prompt)}`));
    if(q.guidance) w.appendChild(el("p",{class:"hintline"},esc(q.guidance)));
    if(q.id==="a3"){
      const rows=[0,1,2,9,10].map(t=>`<tr><td>${t}</td><td>${fmt(S.xs[t])}</td><td>${fmt(Math.abs(S.xs[t]-2))}</td></tr>`).join("");
      const table=el("div",{class:"tablebox"});
      table.innerHTML=`<table><caption>Q3 evidence · x₀ = 6, η = 1.8</caption><thead><tr><th scope="col">Step</th><th scope="col">Position x</th><th scope="col">Distance from 2</th></tr></thead><tbody>${rows}</tbody></table>`;
      w.appendChild(table);
    }
    const ans=S.assessAns[q.id];
    if(q.type==="number"){ const row=el("div",{class:"numrow"}); const inp=el("input",{type:"number",step:"0.01",id:"as-"+q.id,"aria-label":"Answer to question "+(qi+1)}); if(ans?.v!=null) inp.value=ans.v; inp.disabled=S.assessDone;
      inp.addEventListener("input",()=>{ S.assessAns[q.id]={v:inp.value===""?null:+inp.value}; updateSubmit(); }); row.appendChild(el("span",{class:"mono"},"x₁ =")); row.appendChild(inp);
      if(S.assessDone) row.appendChild(el("span",{class:"pill "+(q.check(ans?.v)?"ok":"no")},q.check(ans?.v)?"Correct":`Answer: ${q.answer}`)); w.appendChild(row); }
    else q.options.forEach(o=>{ const id=`as-${q.id}-${o.id}`; let cls="opt"; if(ans?.v===o.id) cls+=" sel"; if(S.assessDone){ cls+=" dis"; if(o.id===q.answer) cls+=" right"; else if(ans?.v===o.id) cls+=" wrongsel"; }
      const lab=el("label",{class:cls,for:id}); const inp=el("input",{type:"radio",name:"as-"+q.id,id,value:o.id}); inp.checked=ans?.v===o.id; inp.disabled=S.assessDone;
      inp.addEventListener("change",()=>{ S.assessAns[q.id]={v:o.id}; renderPanel(); }); lab.appendChild(inp); lab.appendChild(el("span",{},esc(o.label))); w.appendChild(lab); });
    if(S.assessDone) w.appendChild(el("p",{class:"hintline"},esc(q.why)));
    box.appendChild(w);
  });
  if(!S.assessDone){
    const why=el("textarea",{id:"as-why",placeholder:"Q3: in one sentence, why does the run look like this?"}); why.value=S.assessAns.a3why||""; why.addEventListener("input",()=>S.assessAns.a3why=why.value); box.appendChild(why);
    const b=el("div",{class:"btns"}); const sb=el("button",{class:"btn",id:"assessSubmit"},"Submit answers"); sb.addEventListener("click",submitAssess); b.appendChild(sb); box.appendChild(b); updateSubmit();
  } else {
    const sc=ASSESS_Q.filter(q=>q.type==="number"?q.check(S.assessAns[q.id]?.v):S.assessAns[q.id]?.v===q.answer).length;
    const o=el("div",{class:"outcome neutral"}); o.appendChild(el("div",{class:"verdict"},`<span class="score">${sc} / 3</span>`)); box.appendChild(o);
    const b=el("div",{class:"btns"}); b.appendChild(el("button",{class:"btn",onclick:next},"See lesson summary")); box.appendChild(b);
  }
  const t=el("div",{class:"tutor"}); t.appendChild(el("span",{class:"label"},"Tutor")); t.appendChild(el("p",{class:"hintline"},"The tutor is switched off during the transfer check.")); box.appendChild(t);
}
function updateSubmit(){ const sb=$("assessSubmit"); if(!sb) return; sb.disabled=!ASSESS_Q.every(q=>S.assessAns[q.id]?.v!=null); }
function submitAssess(){
  if(S.assessDone) return;
  S.assessDone=true; const res={};
  ASSESS_Q.forEach(q=>{ const v=S.assessAns[q.id]?.v; res[q.id]={answer:v,correct:q.type==="number"?q.check(v):v===q.answer}; });
  const score=Object.values(res).filter(r=>r.correct).length;
  S.results.assess={done:true,score,res,why:S.assessAns.a3why||""};
  logEv("assessment",{score,answers:res,q3Explanation:S.assessAns.a3why||""});
  renderPanel();
}

/* ---- summary ---- */
function renderSummary(box){
  box.appendChild(el("div",{class:"eyebrow"},"Lesson complete"));
  box.appendChild(el("h2",{class:"mtitle"},"Your lesson summary"));
  const rows=STEPS.filter(s=>s.type==="check"||s.type==="mission").map(s=>{ const r=S.results[s.id]||{}; const a=(r.attempts||[]).length;
    return `<tr><td>${esc(s.title)}</td><td>${s.type==="check"?"Theory":"Mission"}</td><td><span class="pill ${r.firstTry?"ok":"no"}">${r.firstTry?"First try":"Needed more tries"}</span></td><td class="mono">${a}</td></tr>`; }).join("");
  const tb=el("div",{class:"tablebox"}); tb.style.maxHeight="none";
  tb.innerHTML=`<table class="sumtable"><thead><tr><th>Step</th><th>Stage</th><th>Result</th><th>Attempts</th></tr></thead><tbody>${rows}</tbody></table>`;
  box.appendChild(tb);
  const a=S.results.assess; box.appendChild(el("p",{class:"brief"},`Transfer check on a new curve: <strong>${a?a.score:0} / 3</strong>.`));
  box.appendChild(el("p",{class:"hintline"},"Use “Copy log as JSON” below to save your predictions, explanations and tutor messages."));
  if(!S.completeLogged){ S.completeLogged=true; logEv("lesson_complete",{assessment:a?a.score:null}); queueMicrotask(()=>window.Study.finishLearning("completed")); }
}

/* ================= tutor ================= */

function ctxFor(st,kind,extra){
  const L=S.last; const c=cfg();
  const lab=v=>v==null?null:(typeof v==="number"?v:outLabel(v,st.fn));
  const base={stage:st.stage, situation:kind, step:st.title, brief:st.brief, function:st.fn.label,
    minima:st.fn.mins.map(m=>({x:+m.x.toFixed(3),global:m.global})), currentSettings:{x0:c.x0,eta:c.lr,steps:c.steps}, behaviourSignals:S.signals[st.id]||{}, studentText:extra||null};
  if(st.type==="explore"){ base.explorationRuns=(S.runs.explore||[]).slice(-8).map(r=>({x0:r.x0,eta:r.lr,steps:r.steps,outcome:SHORT[r.out]})); return base; }
  base.keyIdea=st.key; base.question=st.q?st.q.prompt:"Reach the global minimum"; if(st.tol) base.targetTolerance=st.tol;
  if(L){ base.lastSettings={x0:L.cfg.x0,eta:L.cfg.lr,steps:L.cfg.steps}; base.studentPrediction=lab(L.pred); base.studentReason=L.reason||null; base.lastOutcome=lab(L.actual); base.predictionCorrect=L.predOK; base.trajectory=L.xs.slice(0,10).map(x=>+fmt(x)); }
  base.hintLevel = st.type==="mission" ? (L&&!L.success?(S.fails[st.id]||{})[L.out]||0:0) : (S.hintLevel[st.id]||0);
  base.failureCounts=S.fails[st.id]||{}; base.attempts=(S.results[st.id]?.attempts||[]).slice(-5);
  return base;
}
function pushMsg(st,who,text,cls){ const th=S.threads[st.id]||(S.threads[st.id]=[]); const o={who,text,cls}; th.push(o); return o; }
function fixedFeedback(st,kind){
  if(kind==="correct") return "Your answer is correct. Now explain why it happened.";
  if(kind==="wrong") return "Compare your prediction with the observed result. You can reveal the predefined hints below.";
  if(kind==="mission_fail") return "The target was not reached. Compare the plot and numerical table, then try another setting.";
  if(kind==="mission_success") return "You reached the target. Explain why these settings work and compare your prediction with the result.";
  if(kind==="explain") return "Compare your explanation with this one: "+st.key;
  return "Use the predefined hints below to choose a comparison.";
}
let requestController=null;
const tutorQueue=[];
async function tutorSay(st,kind,extra){
  if(!window.Study?.isLearning() || st.stage==="assess") return;
  if(S.cond==="fixed"){
    const text=fixedFeedback(st,kind); pushMsg(st,"t",text); logEv("tutor",{mode:"predefined",kind,text});
    if(cur()===st) refreshThread(st); return;
  }
  if(requestController){tutorQueue.push({st,kind,extra});logEv("tutor_request_queued",{kind});return;}
  const msg=pushMsg(st,"t","Thinking…","thinking"); refreshThread(st);
  const context=ctxFor(st,kind,extra);
  const conversation=(S.threads[st.id]||[]).slice(0,-1).filter(x=>x.cls!=="thinking"&&!x.unavailable).slice(-4).map(x=>({role:x.who==="t"?"assistant":"user",content:x.text.slice(0,400)}));
  const controller=new AbortController(); requestController=controller;
  const timeout=setTimeout(()=>controller.abort(),25000);
  logEv("tutor_request",{kind,context});
  try{
    const response=await fetch("/api/tutor",{method:"POST",headers:{"Content-Type":"application/json"},signal:controller.signal,
      body:JSON.stringify({context,conversation,token:window.Study.tutorToken()})});
    const data=await response.json();
    if(!response.ok || typeof data.text!=="string" || !data.text.trim()){const error=new Error("service_unavailable");error.code=data.error;error.provider=data.provider;error.model=data.model;throw error;}
    if(!window.Study.isLearning()) { logEv("tutor_response_discarded",{kind}); return; }
    msg.text=data.text; msg.cls=""; S.aiOK=true;
    logEv("tutor",{mode:"ai",kind,text:data.text,provider:data.provider||null,model:data.model||null,available:true,usage:data.usage||null,reasoningEffort:data.reasoningEffort||null});
  }catch(error){
    msg.text=error.code==="provider_rate_limited"?"The AI provider’s request limit was reached. Wait a minute, then retry; a daily limit may require waiting longer. No predefined hint has been substituted.":"AI assistance is unavailable. No predefined hint has been substituted. Use Retry AI assistance below."; msg.cls=""; msg.unavailable=true; S.aiOK=false;
    logEv("tutor",{mode:"unavailable",kind,error:error.name==="AbortError"?"timeout_or_phase_end":error.code||"service_unavailable",provider:error.provider||null,model:error.model||null,available:false,fallback:false});
  }finally{
    clearTimeout(timeout); requestController=null;
    if(window.Study.isLearning() && cur()===st) renderPanel();
    while(tutorQueue.length){const queued=tutorQueue.shift();
      if(window.Study.isLearning() && cur()===queued.st){queueMicrotask(()=>tutorSay(queued.st,queued.kind,queued.extra));break;}
      logEv("tutor_request_cancelled",{kind:queued.kind,reason:"step_or_phase_ended"});
    }
  }
}
function aiLive(){ return S.cond==="ai"; }
function fillThread(t,st){
  t.innerHTML="";
  const th=S.threads[st.id]||[];
  if(!th.length){ t.appendChild(el("p",{class:"hintline"}, st.type==="explore" ? (aiLive()?"Stuck or curious? Ask the tutor, or press “I'm stuck”.":"Press “Get a hint” if you want a suggestion.") : "Feedback appears here after each attempt.")); return; }
  for(const x of th){ const d=el("div",{class:"msg "+x.who+(x.cls?" "+x.cls:"")}); d.appendChild(el("span",{class:"who"},x.who==="t"?"Tutor":"You")); d.appendChild(document.createTextNode(x.text)); t.appendChild(d); if(x.note) t.appendChild(el("p",{class:"note"},esc(x.note))); }
  t.scrollTop=t.scrollHeight;
}
function refreshThread(st){ const t=document.querySelector(".thread"); if(t) fillThread(t,st); else renderPanel(); }
function tutorBox(st){
  const w=el("div",{class:"tutor"});
  const h=el("div",{class:"tutor-head"}); h.appendChild(el("span",{class:"label"},"Tutor"));
  h.appendChild(el("span",{class:"badge"}, S.cond==="ai"?(S.aiOK===false?"AI unavailable · review flagged":"Adaptive AI"):"Predefined support"));
  w.appendChild(h);
  if(S.cond==="ai" && S.aiOK===false) w.appendChild(el("button",{class:"btn ghost",onclick:()=>tutorSay(st,"help","Please help with this step.")},"Retry AI assistance"));
  const t=el("div",{class:"thread"}); w.appendChild(t); fillThread(t,st);
  // The explanation prompt and answer box are part of the chat, right below the tutor message.
  if(S.phase==="explain" && (st.type==="check"||st.type==="mission")) explainUI(w,st);
  if(st.type==="explore"){
    if(aiLive()){
      const f=el("form",{class:"reply"}); const inp=el("input",{type:"text",id:"ask-"+st.id,placeholder:"Ask about what you see","aria-label":"Question for the tutor"});
      const send=el("button",{class:"btn ghost",type:"submit"},"Ask"); const stuck=el("button",{class:"btn ghost",type:"button"},"I'm stuck");
      f.addEventListener("submit",ev=>{ ev.preventDefault(); const v=inp.value; if(!v.trim()) return; inp.value=""; pushMsg(st,"s",v); logEv("help_request",{text:v}); tutorSay(st,"help",v); });
      stuck.addEventListener("click",()=>{ pushMsg(st,"s","I'm stuck."); logEv("help_request",{text:"stuck"}); tutorSay(st,"help","I'm stuck, what should I try?"); });
      f.append(inp,send,stuck); w.appendChild(f);
    } else {
      const b=el("div",{class:"btns"}); b.appendChild(el("button",{class:"btn ghost",onclick:()=>{ logEv("help_request",{text:"hint"}); tutorSay(st,"help"); }},"Get a hint")); w.appendChild(b);
    }
  } else if(aiLive() && (S.threads[st.id]||[]).length && S.phase!=="running"){
    const f=el("form",{class:"reply"}); const inp=el("input",{type:"text",id:"reply-"+st.id,placeholder:"Answer the tutor or ask a question","aria-label":"Message to the tutor"}); const b=el("button",{class:"btn ghost",type:"submit"},"Send");
    f.addEventListener("submit",ev=>{ ev.preventDefault(); const v=inp.value; if(!v.trim()) return; inp.value=""; pushMsg(st,"s",v); logEv("student_msg",{text:v}); tutorSay(st,"followup",v); });
    f.append(inp,b); w.appendChild(f);
  }
  // Predefined hints come after the chat area.
  const hintsBox=document.createDocumentFragment();
  if(S.cond==="fixed" && st.type!=="explore" && !(S.results[st.id]?.attempts||[]).length) hintsBox.appendChild(el("p",{class:"hintline"},"Make your first prediction and observe the run to unlock the predefined hints."));
  if(S.cond==="fixed" && (st.type==="explore" || (S.results[st.id]?.attempts||[]).length)){
    const hints=st.type==="explore"?EXPLORE_HINTS:st.hints||Object.entries(SCAFFOLD).flatMap(([name,items])=>items.map(text=>name+": "+text));
    hints.forEach((text,index)=>{ const details=el("details"); details.appendChild(el("summary",{},"Predefined hint "+(index+1))); details.appendChild(el("p",{},esc(text)));
      details.addEventListener("toggle",()=>{if(details.open) logEv("hint_reveal",{index,text});}); hintsBox.appendChild(details); });
  }
  w.appendChild(hintsBox);
  return w;
}

/* ================= flow ================= */
function applyCfg(st){
  ctl.x0.min=(st.x0Range||[-4.5,4.5])[0]; ctl.x0.max=(st.x0Range||[-4.5,4.5])[1];
  ctl.lr.max=Math.max(1.2,st.cfg.lr); ctl.x0.value=st.cfg.x0; ctl.lr.value=st.cfg.lr; ctl.steps.value=st.cfg.steps; syncOutputs();
}
function loadStep(){
  clearInterval(S.anim);
  const st=cur();
  if(st){
    const prevStage=S.log.length?S.log[S.log.length-1].stage:null;
    applyCfg(st);
    S.signals[st.id]=S.signals[st.id]||{}; S.signals[st.id].shownAt=Date.now(); S.signals[st.id].firstPredAt=null;
    S.threads[st.id]=S.threads[st.id]||[];
    S.phase="setup"; S.pred=null; S.reason=""; S.last=null; S.draft=""; S.xs=null; S.shown=1; S.ruleSeen=1;
    logEv("step_start",{stage:st.stage});
  }
  renderPanel(); draw(); renderTable();
}
function next(){
  const prev=cur(); S.i++; const nx=cur();
  if(!nx || nx.stage!==prev.stage) S.stageStart=Date.now();
  loadStep();
}
window.Lesson={
  start(condition,snapshot){
    S.cond=condition==="control"?"fixed":"ai";
    if(snapshot){
      Object.assign(S,snapshot.state,{cond:S.cond,anim:null});
      if(S.phase==="running") { S.phase="setup"; S.xs=null; logEv("interrupted_run",{}); }
      for(const thread of Object.values(S.threads)) for(const msg of thread) if(msg.cls==="thinking") { msg.cls=""; msg.text="AI request interrupted by refresh. Retry assistance."; S.aiOK=false; logEv("tutor",{mode:"unavailable",error:"refresh",fallback:false}); }
      const st=cur(); if(st){ctl.x0.min=(st.x0Range||[-4.5,4.5])[0];ctl.x0.max=(st.x0Range||[-4.5,4.5])[1];}
      ctl.lr.max=Math.max(1.2,st?.cfg.lr||0);
      for(const k in ctl) ctl[k].value=snapshot.settings[k];
      syncOutputs(); renderPanel(); draw(); renderTable();
    }else loadStep();
  },
  snapshot(){ const {anim,...state}=S; return JSON.parse(JSON.stringify({state,settings:cfg()})); },
  stop(){clearInterval(S.anim); requestController?.abort();},
};
window.Study.boot();
})();
