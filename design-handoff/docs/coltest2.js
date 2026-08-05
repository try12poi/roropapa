"use strict";
// ===== 충돌 테스트 v2: 사장님이 도구로 그린 42개 객체 =====
const SPR={front:new Image(),side:new Image(),back:new Image()};
SPR.front.src="data:image/png;base64,__F__";
SPR.side.src ="data:image/png;base64,__S__";
SPR.back.src ="data:image/png;base64,__B__";
const BG=new Image(); BG.src="data:image/jpeg;base64,__BG__";
const cv=document.getElementById('cv'), cx=cv.getContext('2d');
cx.imageSmoothingEnabled=true;
const VW=cv.width, VH=cv.height;
const S=1.5, WW=687*S, WH=1024*S;
// 사장님이 그린 객체들 (world 좌표)
const OBJ=[
{t:'벽',x:358,y:510,w:370,h:62},
{t:'벽',x:358,y:573,w:15,h:206},
{t:'벽',x:375,y:642,w:276,h:75},
{t:'벽',x:720,y:646,w:165,h:114},
{t:'벽',x:904,y:644,w:99,h:80},
{t:'벽',x:987,y:78,w:21,h:562},
{t:'벽',x:650,y:76,w:336,h:75},
{t:'벽',x:646,y:75,w:14,h:189},
{t:'벽',x:648,y:378,w:12,h:129},
{t:'벽',x:357,y:870,w:20,h:106},
{t:'벽',x:357,y:1078,w:16,h:82},
{t:'벽',x:357,y:1154,w:156,h:112},
{t:'벽',x:636,y:1158,w:264,h:102},
{t:'문',x:645,y:264,w:16,h:116},
{t:'문',x:718,y:574,w:14,h:70},
{t:'문',x:654,y:646,w:58,h:106},
{t:'문',x:357,y:776,w:20,h:98},
{t:'문',x:516,y:1215,w:117,h:56},
{t:'창문',x:358,y:976,w:14,h:105},
{t:'창문',x:888,y:843,w:14,h:142},
{t:'벽',x:885,y:642,w:20,h:198},
{t:'벽',x:886,y:986,w:16,h:174},
{t:'사물',x:472,y:796,w:152,h:58},
{t:'사물',x:436,y:574,w:100,h:34},
{t:'사물',x:546,y:576,w:99,h:34},
{t:'사물',x:378,y:574,w:28,h:66},
{t:'사물',x:474,y:900,w:147,h:57},
{t:'사물',x:472,y:993,w:38,h:106},
{t:'사물',x:381,y:876,w:39,h:99},
{t:'사물',x:376,y:1078,w:39,h:74},
{t:'사물',x:842,y:994,w:40,h:159},
{t:'사물',x:645,y:1130,w:177,h:24},
{t:'사물',x:729,y:711,w:99,h:90},
{t:'사물',x:846,y:760,w:38,h:84},
{t:'사물',x:676,y:834,w:39,h:110},
{t:'사물',x:718,y:880,w:90,h:66},
{t:'사물',x:796,y:237,w:106,h:279},
{t:'사물',x:957,y:244,w:27,h:122},
{t:'사물',x:951,y:549,w:33,h:92},
{t:'사물',x:51,y:534,w:204,h:100},
{t:'사물',x:33,y:772,w:222,h:99},
{t:'사물',x:39,y:957,w:210,h:108}
];
// 막힘 = 벽/사물/창문 (문은 통과)
const BLOCK=OBJ.filter(o=>o.t!=='문');
const DOORS=OBJ.filter(o=>o.t==='문');
// 정문 = 가장 아래쪽 문
let GATE=DOORS[0]; for(const d of DOORS) if(d.y>GATE.y) GATE=d;
const GC={x:GATE.x+GATE.w/2, y:GATE.y+GATE.h/2};

function collideRects(e){
  for(let it=0;it<2;it++){
    for(const r of BLOCK){
      const nx=Math.max(r.x,Math.min(r.x+r.w,e.x));
      const ny=Math.max(r.y,Math.min(r.y+r.h,e.y));
      let dx=e.x-nx, dy=e.y-ny, d=Math.hypot(dx,dy);
      if(d<e.r){
        if(d<0.001){ // center inside rect: push out shortest axis
          const dl=e.x-r.x, dr=r.x+r.w-e.x, dt=e.y-r.y, db=r.y+r.h-e.y;
          const m=Math.min(dl,dr,dt,db);
          if(m===dl)e.x=r.x-e.r; else if(m===dr)e.x=r.x+r.w+e.r;
          else if(m===dt)e.y=r.y-e.r; else e.y=r.y+r.h+e.r;
        } else { e.x=nx+dx/d*e.r; e.y=ny+dy/d*e.r; }
      }
    }
  }
  e.x=Math.max(12,Math.min(WW-12,e.x)); e.y=Math.max(12,Math.min(WH-12,e.y));
}
function fit(){const s=Math.min(window.innerWidth/VW,window.innerHeight/VH);cv.style.width=(VW*s)+'px';cv.style.height=(VH*s)+'px';const st=document.getElementById('stage');st.style.width=(VW*s)+'px';st.style.height=(VH*s)+'px';}
window.addEventListener('resize',fit); fit();
let player,zombies,spawnAcc,lastTs,showDbg=true,state='play';
function reset(){player={x:GC.x,y:GC.y-120,r:13,speed:150,face:'front',flip:false,moving:false,phase:0};zombies=[];spawnAcc=0;}
reset();
const keys={};
window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true; if(e.key.toLowerCase()==='v')showDbg=!showDbg;});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
let joy=null;
cv.addEventListener('touchstart',e=>{const t=e.changedTouches[0];joy={id:t.identifier,sx:t.clientX,sy:t.clientY,dx:0,dy:0};e.preventDefault();},{passive:false});
cv.addEventListener('touchmove',e=>{if(!joy)return;for(const t of e.changedTouches)if(t.identifier===joy.id){joy.dx=t.clientX-joy.sx;joy.dy=t.clientY-joy.sy;}e.preventDefault();},{passive:false});
const endT=e=>{if(joy)for(const t of e.changedTouches)if(t.identifier===joy.id)joy=null;};
cv.addEventListener('touchend',endT);cv.addEventListener('touchcancel',endT);
function inp(){let dx=0,dy=0;if(keys['w']||keys['arrowup'])dy-=1;if(keys['s']||keys['arrowdown'])dy+=1;if(keys['a']||keys['arrowleft'])dx-=1;if(keys['d']||keys['arrowright'])dx+=1;if(joy){const m=Math.hypot(joy.dx,joy.dy);if(m>10){dx=joy.dx/m;dy=joy.dy/m;}}const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m;}return[dx,dy];}
function update(dt){
  const[dx,dy]=inp(); player.moving=(dx||dy)?true:false;
  if(player.moving){player.phase+=dt*11;player.x+=dx*player.speed*dt;player.y+=dy*player.speed*dt;
    if(Math.abs(dx)>Math.abs(dy)){player.face='side';player.flip=dx>0;}else if(dy<0)player.face='back';else player.face='front';}
  collideRects(player);
  spawnAcc+=dt;
  if(spawnAcc>1.0){spawnAcc=0;const e=Math.floor(Math.random()*3);let x,y;
    if(e===0){x=Math.random()*WW;y=8;}else if(e===1){x=8;y=Math.random()*WH;}else{x=WW-8;y=Math.random()*WH;}
    zombies.push({x,y,r:12,speed:36,bob:Math.random()*6});}
  for(const z of zombies){z.bob+=dt*6;const d=Math.hypot(GC.x-z.x,GC.y-z.y)||1;z.x+=(GC.x-z.x)/d*z.speed*dt;z.y+=(GC.y-z.y)/d*z.speed*dt;collideRects(z);}
  if(zombies.length>50)zombies.splice(0,zombies.length-50);
}
function render(){
  cx.fillStyle='#07090f';cx.fillRect(0,0,VW,VH);
  let camX=Math.max(0,Math.min(WW-VW,player.x-VW/2)),camY=Math.max(0,Math.min(WH-VH,player.y-VH/2));
  cx.save();cx.translate(-camX,-camY);
  if(BG.complete&&BG.naturalWidth)cx.drawImage(BG,0,0,WW,WH);
  if(showDbg){
    for(const o of OBJ){
      const c=o.t==='벽'?'rgba(255,60,60,':o.t==='사물'?'rgba(255,160,40,':o.t==='창문'?'rgba(90,170,255,':'rgba(90,230,120,';
      cx.fillStyle=c+'0.28)';cx.fillRect(o.x,o.y,o.w,o.h);
      cx.strokeStyle=c+'0.95)';cx.lineWidth=2;cx.strokeRect(o.x,o.y,o.w,o.h);
    }
    cx.fillStyle='rgba(120,255,140,0.6)';cx.beginPath();cx.arc(GC.x,GC.y,14,0,6.29);cx.fill();
  }
  for(const z of zombies){const bob=Math.sin(z.bob)*2;
    cx.fillStyle='rgba(0,0,0,0.4)';cx.beginPath();cx.ellipse(z.x,z.y+z.r+4,z.r,4,0,0,6.29);cx.fill();
    cx.fillStyle='#161D2E';cx.strokeStyle='#2E3A57';cx.lineWidth=2;cx.beginPath();cx.arc(z.x,z.y+bob,z.r,0,6.29);cx.fill();cx.stroke();
    cx.fillStyle='#FF5A5A';cx.beginPath();cx.arc(z.x-4,z.y+bob-2,2.2,0,6.29);cx.fill();cx.beginPath();cx.arc(z.x+4,z.y+bob-2,2.2,0,6.29);cx.fill();}
  const img=SPR[player.face]||SPR.front;
  if(img.complete&&img.naturalWidth){const h=64,w=h*img.naturalWidth/img.naturalHeight;const hop=player.moving?-Math.abs(Math.sin(player.phase))*5:0;
    cx.fillStyle='rgba(0,0,0,0.35)';cx.beginPath();cx.ellipse(player.x,player.y+26,15,5,0,0,6.29);cx.fill();
    cx.save();cx.translate(player.x,player.y+hop);if(player.face==='side'&&player.flip)cx.scale(-1,1);cx.drawImage(img,-w/2,-h/2-6,w,h);cx.restore();
    if(showDbg){cx.strokeStyle='rgba(127,227,240,0.8)';cx.lineWidth=2;cx.beginPath();cx.arc(player.x,player.y,player.r,0,6.29);cx.stroke();}}
  cx.restore();
  cx.fillStyle='rgba(10,14,23,0.8)';cx.fillRect(0,0,VW,40);
  cx.font='700 12px ui-monospace,monospace';cx.fillStyle='#7FE3F0';cx.textAlign='left';
  cx.fillText('충돌테스트 — 빨강벽/주황사물/파랑창=막힘, 초록문=통과', 8, 24);
  cx.textAlign='right';cx.fillStyle='#8CA0B3';cx.fillText('좀비 '+zombies.length,VW-8,24);
}
function loop(ts){if(lastTs===undefined)lastTs=ts;let dt=(ts-lastTs)/1000;lastTs=ts;if(dt>0.05)dt=0.05;if(state==='play')update(dt);render();requestAnimationFrame(loop);}
document.getElementById('btnStart').onclick=()=>{document.getElementById('title').classList.add('hidden');reset();state='play';};
document.getElementById('btnDbg').onclick=()=>{showDbg=!showDbg;};
requestAnimationFrame(loop);
