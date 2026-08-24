"use strict";
// ================= 안심24 밤 방어 v2 (v5맵 + 사장님 충돌 + 밸런스) =================
// ----- 밸런스 조절판 (숫자만 바꾸면 난이도 조절) -----
const CFG={
  NIGHT_SEC:420,           // v3: 하룻밤 420초 = 03:00~06:00 (31번 시트)
  SPAWN_BASE:2.8,          // v3 리스케일
  SPAWN_MIN:0.5,
  SPAWN_RAMP:0.005,
  SPAWN_DAY:0.15,
  Z_HP:40, Z_HP_DAY:10, Z_HP_TIME:0.05,
  Z_SPD:28, Z_SPD_DAY:1.4,
  GNAW:2.0, GNAW_DAY:0.3,                 // 바리케이드 갉는 속도
  WINDOW_CLIMB:1.8,        // 창문 넘는 시간(초)
  BARR_MAX:100,
  P_HP:100, P_DMG:30, P_CD:0.72, P_R:48, P_SPD:105, P_REPAIR:8,
  MANSU_REPAIR:14,
  HEAL_R:70,          // 서연 치료 반경
  HEAL_RATE:18,        // 주변 동료 초당 회복량
  REVIVE_BOOST:2.8,    // 서연 근처 중상(다운) 회복 가속(총 ~3.8배)
  REVIVE_HP_NEAR:0.75, // 서연 곁에서 일어나면 체력 75%(멀면 50%)
};
const SPR={}; ["front","side","back","sangcheol","jaehyuk","jina","mansu"].forEach(k=>{SPR[k]=new Image();});
SPR.front.src="data:image/png;base64,__F__"; SPR.side.src="data:image/png;base64,__S__"; SPR.back.src="data:image/png;base64,__B__";
SPR.sangcheol.src="data:image/png;base64,__SC__"; SPR.jaehyuk.src="data:image/png;base64,__JH__";
SPR.jina.src="data:image/png;base64,__JN__"; SPR.mansu.src="data:image/png;base64,__MS__";
const BG=new Image(); BG.src="data:image/jpeg;base64,__BG__";

const cv=document.getElementById('cv'), cx=cv.getContext('2d');
cx.imageSmoothingEnabled=true;
const VW=cv.width, VH=cv.height;
const S=1.0, WW=1023*S, WH=1537*S;   // v4: 실측 스케일 — 매장 폭 668px=12m → 1m≈55.7px, 사람 지름 32px≈0.57m
const ZOOM=1.0; // 화면 확대 배율 — 유저 요청으로 1.0(원본)
const OBJ=[
{t:'벽',x:196,y:286,w:500,h:22},
{t:'벽',x:196,y:286,w:22,h:150},
{t:'벽',x:674,y:286,w:22,h:50},
{t:'문',x:300,y:424,w:74,h:26},
{t:'벽',x:196,y:424,w:104,h:26},
{t:'벽',x:374,y:424,w:322,h:26},
{t:'문',x:670,y:336,w:48,h:74},
{t:'벽',x:196,y:450,w:22,h:700},
{t:'창문',x:196,y:600,w:22,h:110},
{t:'창문',x:196,y:880,w:22,h:150},
{t:'사물',x:222,y:730,w:58,h:120},
{t:'사물',x:228,y:1000,w:56,h:120},
{t:'사물',x:352,y:598,w:66,h:330},
{t:'사물',x:462,y:598,w:66,h:330},
{t:'사물',x:568,y:598,w:66,h:330},
{t:'사물',x:438,y:962,w:170,h:54},
{t:'사물',x:736,y:770,w:86,h:200},
{t:'사물',x:908,y:770,w:34,h:190},
{t:'벽',x:886,y:450,w:22,h:700},
{t:'창문',x:886,y:735,w:22,h:120},
{t:'벽',x:196,y:1150,w:300,h:26},
{t:'창문',x:218,y:1150,w:250,h:26},
{t:'문',x:496,y:1150,w:190,h:26},
{t:'창문',x:690,y:1150,w:210,h:26},
{t:'벽',x:686,y:1150,w:236,h:26},
{t:'벽',x:690,y:286,w:22,h:50},
{t:'벽',x:690,y:286,w:322,h:22},
{t:'문',x:712,y:286,w:190,h:22},
{t:'벽',x:990,y:286,w:22,h:436},
{t:'벽',x:696,y:700,w:310,h:22},
{t:'사물',x:722,y:430,w:110,h:250},
{t:'벙커입구',x:850,y:560,w:120,h:100},
{t:'사다리',x:946,y:320,w:36,h:70},
{t:'벽',x:674,y:410,w:22,h:26},
{t:'벽',x:690,y:410,w:22,h:312}
];
for(const o of OBJ){o.x*=S;o.y*=S;o.w*=S;o.h*=S;}
const BLOCK=OBJ.filter(o=>o.t==='벽'||o.t==='사물'||o.t==='창문');   // 벽/사물/창문 = 못 지나감
const OPEN=OBJ.filter(o=>o.t==='문'||o.t==='창문'); // 출입구(바리케이드 대상)
const WALLS=OBJ.filter(o=>o.t==='벽'); // 시야 차단(벽만) — 창문=쏘는구멍, 사물=낮아서 통과
// 공격/사격 시야: 두 점 사이에 벽이 있으면 막힘(벽 관통 공격 방지)
function losClear(x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,dist=Math.hypot(dx,dy),steps=Math.ceil(dist/8);
  for(let i=1;i<steps;i++){ const t=i/steps,x=x1+dx*t,y=y1+dy*t;
    for(const w of WALLS){ if(x>=w.x&&x<=w.x+w.w&&y>=w.y&&y<=w.y+w.h) return false; } }
  return true;
}

// 건물 내부 중심(좀비 진입방향 계산용) — 매장 바닥 대략 중심
const IN_CENTER={x:530*S/1.0? 0:0}; // placeholder replaced below
const CENTER={x:550*S, y:820*S};

// 출입구 객체화: 정문/문/창문 + 바리케이드
let ENTRIES=OPEN.map((o,i)=>{
  const cxm=o.x+o.w/2, cym=o.y+o.h/2;
  const isWin=(o.t==='창문');
  // 넓은 문(w or h 큰 것) = 정문
  const wide=Math.max(o.w,o.h)>90 && o.t==='문';
  // 내부 방향 = 중심점 향함
  let ang=Math.atan2(CENTER.y-cym, CENTER.x-cxm);
  const inP={x:cxm+Math.cos(ang)*46, y:cym+Math.sin(ang)*46};
  const outP={x:cxm-Math.cos(ang)*40, y:cym-Math.sin(ang)*40};
  return {rect:o, cx:cxm, cy:cym, isWin, wide, inP, outP,
          barr:{hp:CFG.BARR_MAX,max:CFG.BARR_MAX},
          name:isWin?'창문':'문'};
});
// 방어 거점 판별: 맵 가장자리(외부)와 연결된 출입구만 남김(내부 문=이동경로로 제외)
const INNER_DOORS=[];
{
  const C=24, COLS=Math.ceil(WW/C), ROWS=Math.ceil(WH/C), rects=ENTRIES.map(e=>e.rect);
  const blk=(x,y)=>{ if(x<6||x>WW-6||y<6||y>WH-6)return true;
    for(const o of BLOCK){if(x>o.x-2&&x<o.x+o.w+2&&y>o.y-2&&y<o.y+o.h+2)return true;}
    for(const r of rects){if(x>r.x-2&&x<r.x+r.w+2&&y>r.y-2&&y<r.y+r.h+2)return true;} return false; };
  const out=new Uint8Array(COLS*ROWS), q=[];
  for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++) if(c===0||r===0||c===COLS-1||r===ROWS-1){ if(!blk(c*C+C/2,r*C+C/2)){out[r*COLS+c]=1;q.push([c,r]);} }
  const nb=[[1,0],[-1,0],[0,1],[0,-1]]; let h=0;
  while(h<q.length){const cur=q[h++],c=cur[0],r=cur[1]; for(const d of nb){const nc=c+d[0],nr=r+d[1]; if(nc<0||nr<0||nc>=COLS||nr>=ROWS||out[nr*COLS+nc])continue; if(blk(nc*C+C/2,nr*C+C/2))continue; out[nr*COLS+nc]=1;q.push([nc,nr]);}}
  const nearOut=(px,py)=>{ for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const c=Math.round((px-C/2)/C)+dc,r=Math.round((py-C/2)/C)+dr; if(c>=0&&r>=0&&c<COLS&&r<ROWS&&out[r*COLS+c])return true;} return false; };
  for(const e of ENTRIES){ e.perimeter = nearOut(e.outP.x,e.outP.y) || nearOut(e.cx,e.cy); if(!e.perimeter)INNER_DOORS.push(e); }
}
ENTRIES = ENTRIES.filter(e=>e.perimeter);   // 방어 거점 = 외부 연결 출입구만
// 정문(가장 아래) 표시
let GATE=null; for(const e of ENTRIES) if(!e.isWin && (!GATE||e.cy>GATE.cy)) GATE=e; if(GATE) GATE.name='정문';
// 출입구 고유 라벨(문1/문2/창문1 …)
{ const grp={}; for(const e of ENTRIES){ e.label=e.name; (grp[e.name]=grp[e.name]||[]).push(e); }
  for(const k in grp){ if(grp[k].length>1) grp[k].forEach((e,idx)=>e.label=e.name+(idx+1)); } }
const LAD=OBJ.find(o=>o.t==='사다리'); const BUNK=OBJ.find(o=>o.t==='벙커입구');

// ===== 길찾기 flow-field (고정 맵 → 로드 시 1회 계산) =====
const NAV_C=24, NAV_COLS=Math.ceil(WW/NAV_C), NAV_ROWS=Math.ceil(WH/NAV_C);
const NAV_NB=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const BLOCKW=OBJ.filter(o=>o.t==='벽'||o.t==='창문'); // 벽/창문만(가구 제외) — 동료용
function makeNav(list,INF){ const g=[]; for(let r=0;r<NAV_ROWS;r++){g[r]=[];for(let c=0;c<NAV_COLS;c++){
  const x=c*NAV_C+NAV_C/2, y=r*NAV_C+NAV_C/2; let ok=(x>=12&&x<=WW-12&&y>=12&&y<=WH-12);
  if(ok)for(const o of list){ if(x>o.x-INF&&x<o.x+o.w+INF&&y>o.y-INF&&y<o.y+o.h+INF){ok=false;break;} } g[r][c]=ok; } } return g; }
const NAV=makeNav(BLOCK,8);    // 좀비: 벽+사물+창문(주차장 차 등 우회)
const NAVW=makeNav(BLOCKW,6);  // 동료: 벽/창문만(가구는 collide로 국소 회피)
function buildField(px,py,nav){ // 목표점 BFS 거리장
  const dist=new Float32Array(NAV_COLS*NAV_ROWS).fill(1e9), I=(c,r)=>r*NAV_COLS+c;
  let sc=Math.max(0,Math.min(NAV_COLS-1,Math.round((px-NAV_C/2)/NAV_C)));
  let sr=Math.max(0,Math.min(NAV_ROWS-1,Math.round((py-NAV_C/2)/NAV_C)));
  if(!nav[sr][sc]){ let bd=1e9; for(let r=0;r<NAV_ROWS;r++)for(let c=0;c<NAV_COLS;c++)if(nav[r][c]){const d=(c-sc)*(c-sc)+(r-sr)*(r-sr);if(d<bd){bd=d;sc=c;sr=r;}} }
  const q=[[sc,sr]]; dist[I(sc,sr)]=0; let h=0;
  while(h<q.length){ const cur=q[h++], c=cur[0], r=cur[1], d0=dist[I(c,r)];
    for(const nb of NAV_NB){ const nc=c+nb[0], nr=r+nb[1];
      if(nc<0||nr<0||nc>=NAV_COLS||nr>=NAV_ROWS||!nav[nr][nc])continue;
      if(nb[0]&&nb[1]&&(!nav[r][nc]||!nav[nr][c]))continue;
      if(d0+1<dist[I(nc,nr)]){dist[I(nc,nr)]=d0+1;q.push([nc,nr]);} } }
  return dist; }
for(const en of ENTRIES){ en.field=buildField(en.cx,en.cy,NAV); en.fieldA=buildField(en.inP.x,en.inP.y,NAVW); } // 동료 필드는 내부 홀드지점(inP) 기준
// 거리장(field)을 따라 목표(gx,gy)로 벽 우회 이동. 가까우면 직행, 막히면 직행 fallback.
function flowNav(e, field, gx, gy, dt, avoid){
  const dist=field, I=(c,r)=>r*NAV_COLS+c;
  const dGoal=Math.hypot(gx-e.x,gy-e.y);
  let c=Math.max(0,Math.min(NAV_COLS-1,Math.round((e.x-NAV_C/2)/NAV_C)));
  let r=Math.max(0,Math.min(NAV_ROWS-1,Math.round((e.y-NAV_C/2)/NAV_C)));
  const here=dist[I(c,r)];
  if(dGoal<NAV_C*2.0 || here>=1e9){ stepToward(e, gx, gy, dt, avoid); return; }
  let bx=null,by=null,bd=here;
  for(const nb of NAV_NB){ const nc=c+nb[0], nr=r+nb[1];
    if(nc<0||nr<0||nc>=NAV_COLS||nr>=NAV_ROWS)continue;
    const d=dist[I(nc,nr)]; if(d<bd){bd=d;bx=nc*NAV_C+NAV_C/2;by=nr*NAV_C+NAV_C/2;} }
  if(bx!==null) stepToward(e, bx, by, dt, avoid);
  else stepToward(e, gx, gy, dt, avoid);
}
// 좀비: 문 중심으로 접근(양쪽 어디서든)
function stepFlow(z, en, dt, avoid){ flowNav(z, en.field, en.cx, en.cy, dt, avoid); }
// 동료: 벽-거리장(field)의 다음 셀로 직접 이동 + 벽만 충돌(가구 통과) → 거점 확실 도달
function allyGoto(a, field, gx, gy, dt){
  const I=(c,r)=>r*NAV_COLS+c; let tx=gx, ty=gy;
  if(Math.hypot(gx-a.x,gy-a.y)>=NAV_C*2.0){
    let c=Math.max(0,Math.min(NAV_COLS-1,Math.round((a.x-NAV_C/2)/NAV_C)));
    let r=Math.max(0,Math.min(NAV_ROWS-1,Math.round((a.y-NAV_C/2)/NAV_C)));
    const here=field[I(c,r)];
    if(here<1e9){ let bd=here,bx=null,by=null;
      for(const nb of NAV_NB){ const nc=c+nb[0],nr=r+nb[1]; if(nc<0||nr<0||nc>=NAV_COLS||nr>=NAV_ROWS)continue;
        const d=field[I(nc,nr)]; if(d<bd){bd=d;bx=nc*NAV_C+NAV_C/2;by=nr*NAV_C+NAV_C/2;} }
      if(bx!==null){tx=bx;ty=by;} } }
  const d=Math.hypot(tx-a.x,ty-a.y)||1; a.x+=(tx-a.x)/d*a.spd*dt; a.y+=(ty-a.y)/d*a.spd*dt; collideW(a);
}

function collide(e){
  for(let it=0;it<2;it++){
    for(const r of BLOCK){
      const nx=Math.max(r.x,Math.min(r.x+r.w,e.x)), ny=Math.max(r.y,Math.min(r.y+r.h,e.y));
      let dx=e.x-nx, dy=e.y-ny, d=Math.hypot(dx,dy);
      if(d<e.r){
        if(d<0.001){const dl=e.x-r.x,dr=r.x+r.w-e.x,dt=e.y-r.y,db=r.y+r.h-e.y,m=Math.min(dl,dr,dt,db);
          if(m===dl)e.x=r.x-e.r;else if(m===dr)e.x=r.x+r.w+e.r;else if(m===dt)e.y=r.y-e.r;else e.y=r.y+r.h+e.r;}
        else{e.x=nx+dx/d*e.r; e.y=ny+dy/d*e.r;}
      }
    }
  }
  e.x=Math.max(12,Math.min(WW-12,e.x)); e.y=Math.max(12,Math.min(WH-12,e.y));
}
// 동료 전용 충돌: 벽/창문만(가구는 통과) — 거점까지 확실히 도달
function collideW(e){
  for(let it=0;it<2;it++){
    for(const r of BLOCKW){
      const nx=Math.max(r.x,Math.min(r.x+r.w,e.x)), ny=Math.max(r.y,Math.min(r.y+r.h,e.y));
      let dx=e.x-nx, dy=e.y-ny, d=Math.hypot(dx,dy);
      if(d<e.r){ if(d<0.001){const dl=e.x-r.x,dr=r.x+r.w-e.x,dt=e.y-r.y,db=r.y+r.h-e.y,m=Math.min(dl,dr,dt,db);
          if(m===dl)e.x=r.x-e.r;else if(m===dr)e.x=r.x+r.w+e.r;else if(m===dt)e.y=r.y-e.r;else e.y=r.y+r.h+e.r;}
        else{e.x=nx+dx/d*e.r; e.y=ny+dy/d*e.r;} }
    }
  }
  e.x=Math.max(12,Math.min(WW-12,e.x)); e.y=Math.max(12,Math.min(WH-12,e.y));
}
// 좀비는 바리케이드가 살아있는 출입구도 못 지나감(막힘). 부서지면 통과.
function collideEntriesUp(e){
  for(const en of ENTRIES){ if(en.barr.hp>0){
    const r=en.rect;
    const nx=Math.max(r.x,Math.min(r.x+r.w,e.x)), ny=Math.max(r.y,Math.min(r.y+r.h,e.y));
    let dx=e.x-nx, dy=e.y-ny, d=Math.hypot(dx,dy);
    if(d<e.r){ if(d<0.001){e.y=r.y-e.r;} else {e.x=nx+dx/d*e.r; e.y=ny+dy/d*e.r;} }
  }}
}

// 목표로 이동하되, 막히면 옆으로 미끄러지거나 돌아감(길찾기)
function stepToward(e, tx, ty, dt, avoidEntries){
  const dx=tx-e.x, dy=ty-e.y, dist=Math.hypot(dx,dy)||1;
  const dirx=dx/dist, diry=dy/dist;
  const step=(e.speed||e.spd)*dt;   // 좀비=speed, 동료=spd
  const ox=e.x, oy=e.y;
  // 후보 방향: 직진, 오른쪽45, 왼쪽45, 오른쪽90, 왼쪽90
  const cand=[0, 0.6, -0.6, 1.2, -1.2, 2.0, -2.0];
  let bestx=e.x, besty=e.y, bestProg=-1e9, moved=false;
  for(const off of cand){
    const a=Math.atan2(diry,dirx)+off;
    const nx=ox+Math.cos(a)*step, ny=oy+Math.sin(a)*step;
    const probe={x:nx,y:ny,r:e.r};
    collide(probe); if(avoidEntries) collideEntriesUp(probe);
    const actMove=Math.hypot(probe.x-ox,probe.y-oy);
    if(actMove < step*0.35) continue;      // 거의 못 움직이면 이 방향 버림
    // 목표에 얼마나 가까워졌나 = 진행도
    const prog = -(Math.hypot(tx-probe.x,ty-probe.y)) + actMove*0.15;
    if(prog>bestProg){bestProg=prog;bestx=probe.x;besty=probe.y;moved=true;}
  }
  if(moved){e.x=bestx;e.y=besty;}
  else { e.x=ox; e.y=oy; }
}
function fit(){const s=Math.min(window.innerWidth/VW,window.innerHeight/VH);cv.style.width=(VW*s)+'px';cv.style.height=(VH*s)+'px';const st=document.getElementById('stage');st.style.width=(VW*s)+'px';st.style.height=(VH*s)+'px';}
window.addEventListener('resize',fit); fit();

let state='title', day, night_t, kills, totalKills, player, allies, zombies, gems, fx, spawnAcc, lastTs, food, showDbg=false, dawnT=0, shake=0, freeze=0;
let materials=8, fac={barricade:0, farm:0}, selMember=null, ownedItems=[];   // 재료·시설레벨·경영선택·여분아이템
// ===== v3 전역: 파문(소음)·시계 이벤트·최후의 저항 =====
let ripples=[], noiseScore=0, noisePrev=0, ev333=false, ev444=false, ev555=false, noiseFxT=0, laststand=false, lsT=0, lsDone=false;
// ===== 낮 원정(노드맵, 거리=시간) =====
let expBudget=100, expLoot={food:0,mat:0,rescue:0}, expPos={x:220,y:660}, expNodes=[], expMsg='', expStranded=false, totalRescued=0;
// ===== v4: 구출·상실 시스템 =====
const SURVIVOR_POOL=[
 {key:'gojuyeon',nm:'고주연',age:29,job:'양궁 국가대표',good:'무소음 원거리 최강',bad:'화살이 마르면 침묵한다',dmg:22,hp:85,spd:105,ranged:true,rng:260,cd:1.1,memo:'10점. 마지막까지 10점이었다.'},
 {key:'ganghogu',nm:'강호구',age:35,job:'소방관',good:'도끼 돌파·구출 전문',bad:'몸이 먼저 나간다',dmg:24,hp:130,spd:112,ranged:false,rng:32,cd:0.9,memo:'그는 끝까지 출동 중이었다.'},
 {key:'bangsoonim',nm:'방순임',age:49,job:'급식 조리사',good:'버프 요리 — 밤 전 식사',bad:'손이 커서 식량 1.5배',dmg:12,hp:95,spd:85,ranged:false,rng:28,cd:1.2,memo:'그 국 냄새가 아직 난다.'},
 {key:'jopilseong',nm:'조필성',age:63,job:'아파트 경비원',good:'밤 순찰 — 거점 미세 수리',bad:'낮에는 잔다',dmg:12,hp:90,spd:85,ranged:false,rng:28,cd:1.1,memo:'그의 초소 불은 꺼진 적이 없었다.'},
 {key:'mika',nm:'미카',age:24,job:'배낭여행객',good:'루트 개척 — 이동 비용↓',bad:'말이 잘 안 통한다',dmg:11,hp:90,spd:115,ranged:false,rng:28,cd:1.0,memo:'그의 지도에 우리 편의점은 ★★★★★였다.'},
 {key:'munjunggap',nm:'문정갑',age:44,job:'약사',good:'의약품 제조',bad:'결벽 — 위생 낮으면 거부',dmg:8,hp:80,spd:90,ranged:false,rng:26,cd:1.2,memo:'복약 지도: 하루 세 번, 꼭 챙겨 먹을 것.'},
 {key:'gwakbunnam',nm:'곽분남',age:76,job:'폐지 리어카',good:'호드 조기 감지',bad:'전투 불가·느리다',dmg:4,hp:60,spd:55,ranged:false,rng:20,cd:1.6,memo:'골목이 조용해졌다.'},
 {key:'imsunjung',nm:'임순정',age:68,job:'수선집 재봉사',good:'방어구 제작·수리',bad:'노안 — 밤 작업 불가',dmg:5,hp:70,spd:70,ranged:false,rng:20,cd:1.5,memo:'꿰맨 자리가 제일 튼튼했다.'},
];
let joined=[], memorial=[], rescueCard=null, pendingRescue=[], escortees=[], memorialView=null;
// ===== v4: 사기(0~100) · 소등의 밤 =====
let morale=70, blackout=false, prevBlackout=false, moraleFx=[];
// ===== v4: 성장 — SP·스킬트리·카드키 권한 =====
let sp=0, skills={}, journals=0, keyLevel=1, skillSel='seoyeon';
const TREES={
 seoyeon:{nm:'서연',A:{nm:'응급실',nodes:[
   {id:'s_a1',t:1,nm:'넓은 처치범위',d:'치료 반경 70→98'},
   {id:'s_a2',t:2,nm:'아드레날린',d:'치료 중 동료 공속 +20%'},
   {id:'s_a3',t:3,nm:'소생술',d:'다운 동료 즉시 기상(밤 2회)',need:3}]},
  B:{nm:'야간조',nodes:[
   {id:'s_b1',t:1,nm:'묵직한 손목',d:'빠루 대미지 +8'},
   {id:'s_b2',t:2,nm:'부위 파괴',d:'15% 확률 2초 기절'},
   {id:'s_b3',t:3,nm:'트리아지',d:'HP 30% 이하 좀비 즉사'}]}},
 jina:{nm:'진아',A:{nm:'저격수',nodes:[
   {id:'j_a1',t:1,nm:'조준 훈련',d:'사거리 +50'},
   {id:'j_a2',t:2,nm:'관통탄',d:'좀비 2체 관통',need:2},
   {id:'j_a3',t:3,nm:'헤드샷',d:'4발마다 대미지 3배',need:2}]},
  B:{nm:'속사포',nodes:[
   {id:'j_b1',t:1,nm:'가벼운 손놀림',d:'연사 +15%'},
   {id:'j_b2',t:2,nm:'도탄',d:'처치 시 인근 50% 튕김',need:2},
   {id:'j_b3',t:3,nm:'제압사격',d:'명중 시 이속 −30%',need:2}]}},
 jaehyuk:{nm:'재혁',A:{nm:'진압',nodes:[
   {id:'h_a1',t:1,nm:'넓은 스윙',d:'공격 범위 +30%'},
   {id:'h_a2',t:2,nm:'소화 분사',d:'8초마다 넉백+슬로우'},
   {id:'h_a3',t:3,nm:'역화',d:'넉백 충돌 추가 대미지'}]},
  B:{nm:'돌파',nodes:[
   {id:'h_b1',t:1,nm:'완력',d:'대미지 +10'},
   {id:'h_b2',t:2,nm:'파고들기',d:'첫 타격 +50%'},
   {id:'h_b3',t:3,nm:'구조 우선',d:'다운 동료 곁 대미지+40%·피해−30%'}]}},
 sangcheol:{nm:'상철',A:{nm:'철벽',nodes:[
   {id:'c_a1',t:1,nm:'맷집',d:'최대체력 +40'},
   {id:'c_a2',t:2,nm:'도발',d:'거점 내 좀비가 우선 공격'},
   {id:'c_a3',t:3,nm:'버티기',d:'치명상 시 1회 생존(밤 1회)'}]},
  B:{nm:'물류',nodes:[
   {id:'c_b1',t:1,nm:'알뜰함',d:'식량 드랍률 10→16%'},
   {id:'c_b2',t:2,nm:'핸드트럭 돌진',d:'10초마다 직선 돌진'},
   {id:'c_b3',t:3,nm:'재고 정리',d:'밤 종료 XP +30%'}]}},
 mansu:{nm:'만수',A:{nm:'요새',nodes:[
   {id:'m_a1',t:1,nm:'보강 용접',d:'수리량 +6/초'},
   {id:'m_a2',t:2,nm:'가시 철조망',d:'갉는 좀비에 반사 대미지'},
   {id:'m_a3',t:3,nm:'이중 셔터',d:'붕괴 시 1회 50% 재생성'}]},
  B:{nm:'발명',nodes:[
   {id:'m_b1',t:1,nm:'손재주',d:'밤 시작 시 재료 +1'},
   {id:'m_b2',t:2,nm:'자동 터렛',d:'배치 거점에 터렛 1기',need:3},
   {id:'m_b3',t:3,nm:'CCTV 개조',d:'원거리 첫 타 +25%',need:3}]}},
};
function has(id){ return !!skills[id]; }
function nodeCost(n){ return n.t; }
function nodeLocked(n){ return (n.need||1)>keyLevel; }
function branchNodes(who,br){ return TREES[who][br].nodes; }
function canBuy(who,br,idx){
  const ns=branchNodes(who,br), n=ns[idx];
  if(has(n.id)||nodeLocked(n))return false;
  if(sp<nodeCost(n))return false;
  for(let i=0;i<idx;i++) if(!has(ns[i].id)) return false;   // 선행 필요
  return true;
}
function buyNode(who,br,idx){
  if(!canBuy(who,br,idx))return false;
  const n=branchNodes(who,br)[idx];
  sp-=nodeCost(n); skills[n.id]=true; applySkills(); return true;
}
function skillCount(who){ let c=0; for(const br of ['A','B']) for(const n of TREES[who][br].nodes) if(has(n.id))c++; return c; }
// T1 수치 노드를 실제 스탯에 반영
function applySkills(){
  if(player){ player.healR=CFG.HEAL_R*(has('s_a1')?1.4:1);
    player.skillDmg=(has('s_b1')?8:0); }
  for(const a of allies){
    a.skillDmg=0; a.skillRng=0; a.skillCd=1; a.skillHp=0; a.skillRepair=0;
    if(a.key==='jina'){ if(has('j_a1'))a.skillRng+=50; if(has('j_b1'))a.skillCd*=0.85; }
    if(a.key==='jaehyuk'){ if(has('h_b1'))a.skillDmg+=10; }
    if(a.key==='sangcheol'){ if(has('c_a1'))a.skillHp+=40; }
    if(a.key==='mansu'){ if(has('m_a1'))a.skillRepair+=6; }
    a.baseMaxhp=(a.baseMaxhp0||a.baseMaxhp)+a.skillHp;
  }
  recomputeCombos();
}
function addMorale(v,txt){ morale=Math.max(0,Math.min(100,morale+v));
  if(txt)moraleFx.push({txt:txt+' '+(v>0?'+':'')+v,col:v>0?'#7ED8A8':'#FF7A7A',t:2.2}); }
function moraleTier(){ return morale>=80?'high':morale<20?'crit':morale<40?'low':'mid'; }
function moraleAtk(){ const s=moraleTier(); return s==='high'?1.05:1; }         // 전 능력
function moraleCd(){ const s=moraleTier(); return (s==='low'||s==='crit')?1.10:1; } // 공속·수리 저하(쿨 증가)
function moraleLabel(){ const s=moraleTier();
  return s==='high'?'사기 충만':s==='crit'?'붕괴 직전':s==='low'?'침체':'보통'; }
function poolAvailable(){ const used=new Set(joined.map(j=>j.key).concat(memorial.map(m=>m.key)));
  return SURVIVOR_POOL.filter(s=>!used.has(s.key)); }
const EXP_BASE={x:220,y:688};
function genExpedition(){
  expBudget=100; expLoot={food:0,mat:0,rescue:0}; expPos={x:EXP_BASE.x,y:EXP_BASE.y}; expMsg='노드를 탭해 이동·수색 · 안심24(집)로 귀환'; expStranded=false;
  expNodes=[
    {x:112,y:582,ring:'near',nm:'버스정류장',ic:'🚏'},{x:222,y:596,ring:'near',nm:'옆집',ic:'🏠'},{x:326,y:582,ring:'near',nm:'주차장',ic:'🅿️'},
    {x:128,y:398,ring:'mid',nm:'편의점',ic:'🏪'},{x:312,y:396,ring:'mid',nm:'약국',ic:'💊'},
    {x:150,y:186,ring:'far',nm:'대형마트',ic:'🛒'},{x:300,y:186,ring:'far',nm:'병원',ic:'🏥'},
  ].map(n=>({...n,searched:false}));
}
function partyPower(){ let p=(player.eDmg||player.dmg||20); for(const a of allies)if((a.work||'combat')==='combat'&&a.down<=0)p+=(a.eDmg||a.dmg); return p; }
const EXP_DANGER={near:25,mid:60,far:100}, EXP_MUL={near:1,mid:2.2,far:3.6};
function expResolve(n){
  const power=partyPower(), danger=EXP_DANGER[n.ring], mul=EXP_MUL[n.ring], success=power>=danger;
  const f=Math.round(3*mul*(success?1:0.5)), m=Math.round(2.5*mul*(success?1:0.5));
  expLoot.food+=f; expLoot.mat+=m;
  let rescued=false;
  // v4: 생존자 발견 → 정보 카드 (遠 50% / 中 25%)
  const pool=poolAvailable();
  const chance=(n.ring==='far'?0.5:n.ring==='mid'?0.25:0);
  if(pool.length&&Math.random()<chance&&!rescueCard&&pendingRescue.length===0){
    rescueCard=pool[Math.floor(Math.random()*pool.length)]; rescueCard.node=n.nm;
  }
  if(!success){ const dmg=Math.round((danger-power)*0.25)+6; expApplyDmg(dmg);
    expMsg=n.nm+': 교전! 🍖+'+f+' 🔩+'+m+(rescued?' 🆘구출!':'')+' (부상 -'+dmg+')'; }
  else expMsg=n.nm+': 확보 🍖+'+f+' 🔩+'+m+(rescued?' 🆘구출!':'');
}
function expApplyDmg(d){ const t=[player].concat(allies.filter(a=>(a.work||'combat')==='combat'&&a.down<=0)); for(const e of t){ e.hp=Math.max(1,(e.hp||e.maxhp)-d); } }
// ===== 시그니처 아이템 (아무나 장착, 주인이면 시너지) =====
const ITEMS=[
  {id:'crowbar', nm:'빠루',       own:'seoyeon',   base:{dmg:6},                      syn:{dmg:10,heal:20},         desc:'근접 공격력 · 서연: +치료량'},
  {id:'exting',  nm:'소화기',      own:'jaehyuk',   base:{dmg:8},                      syn:{dmg:16},                 desc:'근접 공격력 · 재혁: 대폭↑'},
  {id:'airsoft', nm:'에어소프트건', own:'jina',     base:{makeRanged:true,rng:180,dmg:6}, syn:{makeRanged:true,rng:240,dmg:10,cdMul:0.8}, desc:'원거리화 · 진아: 연사·사거리↑'},
  {id:'wrench',  nm:'파이프렌치',   own:'mansu',     base:{dmg:6,repair:4},             syn:{dmg:10,repair:12},       desc:'근접+수리 · 만수: 수리 대폭↑'},
  {id:'cart',    nm:'핸드트럭',     own:'sangcheol', base:{hp:30},                      syn:{hp:60},                  desc:'최대체력↑ · 상철: 대폭↑'},
];
function itemById(id){ return ITEMS.find(i=>i.id===id)||null; }
let scene='1F';   // '1F' | 'roof' | 'bunker'
// 옥상 씬(간단): ㄱ자 대신 직사각 걷기 공간 + 내려가는 지점
// 옥상 — 1층 편의점 건물 발자국(ㄱ자)에 정확히 맞춤. 위블록(차고·창고) + 아래 매장 본체
const ROOF={
  w:WW, h:WH,
  UP:{x:645,y:72,w:353,h:446},      // 위쪽 블록 (x645~998, y72~518)
  LO:{x:345,y:518,w:570,h:748},     // 아래 매장 본체 (x345~915, y518~1266)
  CONN:{x:660,y:470,w:250,h:100},   // UP↔LO 연결 통로(경계 겹침) — 이게 없으면 층 사이 못 넘어감

  down:{x:940,y:150,r:36},          // ↓ 1층 해치 — 1층 사다리(우측 맨 위 x936,y154)와 같은 위치
  fan:{x:760,y:330,r:52},           // 대형 환기팬(둥근 유닛) — 위블록 중앙
  antenna:{x:690,y:150},            // 안테나 — 위블록 좌측
  tank:{x:380,y:560,w:130,h:110},   // 물탱크 — 본체 좌상
  crate:{x:630,y:1000},             // 보급상자 — 본체 중앙
  hatches:[{x:430,y:560,w:70,h:70},{x:520,y:556,w:86,h:56},{x:430,y:650,w:70,h:70},{x:526,y:640,w:86,h:66},{x:452,y:748,w:70,h:70}], // 환기구/채광 5
  vents:[{x:820,y:640,w:44,h:72},{x:820,y:730,w:44,h:72}], // 우측 세로 환기구 2
  sand:[{x:800,y:82,w:100,h:78},{x:370,y:1120,w:140,h:108}], // 모래주머니(위블록 상단/본체 좌하 코너)
};
// ===== 지하 벙커 씬 (벽/문 + 가구) =====
const BUNKW={w:1120,h:1280, up:{x:885,y:150}, spawn:{x:885,y:255}};
// 방 라벨 — 각 방의 뚫린 공간에 배치
const BROOMS=[
 {n:'저장고',en:'STORAGE',x:300,y:150},
 {n:'입구·계단',en:'STAIRS',x:830,y:80},
 {n:'무기고',en:'ARMORY',x:200,y:670},
 {n:'공용거실',en:'COMMON',x:740,y:650},
 {n:'침실 · 12명',en:'BUNK',x:460,y:1060},
 {n:'기계실',en:'GENERATOR',x:900,y:1160},
];
// 벽(막힘) — 외벽 + 2×3 방 칸막이. 문틈 100px, 가구는 문틈서 40px+ 이격
const BWALL=[
 // 외벽
 [40,40,1080,58],[40,40,58,1240],[1062,40,1080,1240],[40,1222,1080,1240],
 // 상단 세로벽 x700 (저장고|입구, 문 y150~250)
 [692,58,708,150],[692,250,708,352],
 // 가로벽 y360 (상↕중) — 문틈 저장고→무기고 x200~320, 입구→공용 x820~940
 [58,352,200,368],[320,352,820,368],[940,352,1062,368],
 // 중단 세로벽 x400 (무기고|공용, 문 y470~570)
 [392,368,408,470],[392,570,408,712],
 // 가로벽 y720 (중↕하) — 문틈 무기고→침실 x180~300, 공용→기계실 x820~940
 [58,712,180,728],[300,712,820,728],[940,712,1062,728],
 // 하단 세로벽 x640 (침실|기계실, 문 y900~1000)
 [632,728,648,900],[632,1000,648,1222],
];
// 가구(막힘) — {x,y,w,h,c,label}. 전부 문틈에서 떨어뜨림
const BFURN=[
 // 저장고 선반 (좌·상 벽 따라)
 {x:70,y:80,w:400,h:40,c:'#7a5a34'},{x:70,y:180,w:110,h:130,c:'#7a5a34'},{x:520,y:150,w:120,h:150,c:'#6a4a2a'},
 // 입구 crate (우상 코너)
 {x:940,y:90,w:100,h:80,c:'#8a6a3a'},
 // 무기고 케이지
 {x:90,y:400,w:230,h:200,c:'#8a8f86',cage:1},
 // 공용거실 테이블 + 게시판 + 추모벽
 {x:640,y:470,w:200,h:110,c:'#9a6a3a'},
 {x:470,y:400,w:130,h:80,c:'#b89a5a',board:1},{x:960,y:400,w:90,h:130,c:'#8a8070',memorial:1},
 // 침실 3층침대 4개 (좌측, x640 문틈서 이격)
 {x:80,y:770,w:110,h:150,c:'#6a6a80',bed:1},{x:230,y:770,w:110,h:150,c:'#6a6a80',bed:1},
 {x:80,y:1010,w:110,h:150,c:'#6a6a80',bed:1},{x:230,y:1010,w:110,h:150,c:'#6a6a80',bed:1},
 // 기계실 발전기
 {x:720,y:820,w:200,h:170,c:'#7a828c',gen:1},
];
// 상호작용 지점
const BVAULT={x:1010,y:1130,r:34};        // 금고문(빨간불) — 기계실 우하단 코너

function reset(){ day=1; totalKills=0; food=20; materials=8; fac={barricade:0,farm:0}; ownedItems=[]; selMember=null; totalRescued=0; joined=[]; memorial=[]; rescueCard=null; pendingRescue=[]; escortees=[]; memorialView=null; morale=70; blackout=false; prevBlackout=false; moraleFx=[]; sp=0; skills={}; journals=0; keyLevel=1; skillSel='seoyeon'; scene='1F'; startNight(true); }
function startNight(fresh){
  night_t=0; kills=0; zombies=[]; gems=[]; fx=[]; spawnAcc=0;
  ripples=[]; ev333=ev444=ev555=false; noiseFxT=0; laststand=false; lsT=0; lsDone=false;
  noisePrev=fresh?0:noiseScore; noiseScore=0; if(player)player.downT=0;
  for(const e of ENTRIES){ e.barr.max=CFG.BARR_MAX+fac.barricade*20; e.barr.hp = fresh?e.barr.max:Math.min(e.barr.max, e.barr.hp+50); }
  if(fresh){
    player={x:CENTER.x,y:CENTER.y+120,r:16,hp:CFG.P_HP,maxhp:CFG.P_HP,speed:CFG.P_SPD,
      face:'front',flip:false,moving:false,phase:0,dmg:CFG.P_DMG,atkCd:CFG.P_CD,atkR:CFG.P_R,cdLeft:0,
      swingT:0,swingDir:0,lungeT:0,painT:0,hurtCd:0,xp:0,lvl:1,need:6,repairing:null,pickR:60,downT:0,away:false,rx:0,ry:0,ladCd:0};
    allies=[
      {key:'jina',nm:'진아',ranged:true,rng:230,dmg:14,cd:0.5,hp:80,spd:70},
      {key:'jaehyuk',nm:'재혁',ranged:false,rng:30,dmg:26,cd:0.85,hp:150,spd:82},
      {key:'sangcheol',nm:'상철',ranged:false,rng:28,dmg:20,cd:0.8,hp:115,spd:76},
      {key:'mansu',nm:'만수',ranged:false,rng:30,dmg:22,cd:1.0,hp:100,spd:62},
    ].map(a=>({...a,r:15,x:CENTER.x+(Math.random()*80-40),y:CENTER.y+(Math.random()*60),maxhp:a.hp,baseMaxhp:a.hp,baseMaxhp0:a.hp,
      cdLeft:0,hitCd:0,down:0,swingT:0,swingDir:0,phase:Math.random()*6,moving:false,post:null,work:'combat',item:null}));
    for(const a of allies){ const it=ITEMS.find(i=>i.own===a.key); if(it)a.item=it.id; } // 시그니처 기본 장착
    ownedItems=[]; // 인벤(장착 안 된 여분)
    player.item='crowbar';
    autoAssignPosts();
  } else {
    player.hp=Math.min(player.maxhp,player.hp+Math.round(player.maxhp*0.5));
    player.x=CENTER.x; player.y=CENTER.y+120;
    for(const a of allies){a.hp=a.maxhp; a.down=0; a.x=CENTER.x; a.y=CENTER.y;}
  }
  applySkills();
  if(has('m_b1'))materials+=1;   // 손재주
  // 요새 콤보: 만수 배치 거점 바리케이드 강화(+40)
  const m=allies.find(a=>a.key==='mansu');
  if(m&&m.work==='combat'&&typeof m.post==='number'&&ENTRIES[m.post]){ const e=ENTRIES[m.post]; e.barr.max+=40; e.barr.hp=e.barr.max; }
}

const keys={};
window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true; const k=e.key.toLowerCase(); if(k==='p')togglePause(); if(k==='v')showDbg=!showDbg;});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
let joy=null;
cv.addEventListener('touchstart',e=>{const t=e.changedTouches[0];
  if(state==='assign'||state==='morning'||state==='expedition'){const rc=cv.getBoundingClientRect();const mx=(t.clientX-rc.left)*(VW/rc.width),my=(t.clientY-rc.top)*(VH/rc.height);if(state==='assign')assignTap(mx,my);else if(state==='morning')morningTap(mx,my);else if(state==='memorial')memorialTap(mx,my);else if(state==='skill')skillTap(mx,my);else expeditionTap(mx,my);e.preventDefault();return;}
  joy={id:t.identifier,sx:t.clientX,sy:t.clientY,dx:0,dy:0};e.preventDefault();},{passive:false});
cv.addEventListener('click',e=>{ if(state!=='assign'&&state!=='morning'&&state!=='expedition'&&state!=='memorial'&&state!=='skill')return; const rc=cv.getBoundingClientRect();const mx=(e.clientX-rc.left)*(VW/rc.width),my=(e.clientY-rc.top)*(VH/rc.height);if(state==='assign')assignTap(mx,my);else if(state==='morning')morningTap(mx,my);else if(state==='memorial')memorialTap(mx,my);else if(state==='skill')skillTap(mx,my);else expeditionTap(mx,my); });
cv.addEventListener('touchmove',e=>{if(!joy)return;for(const t of e.changedTouches)if(t.identifier===joy.id){joy.dx=t.clientX-joy.sx;joy.dy=t.clientY-joy.sy;}e.preventDefault();},{passive:false});
const endT=e=>{if(joy)for(const t of e.changedTouches)if(t.identifier===joy.id)joy=null;};
cv.addEventListener('touchend',endT);cv.addEventListener('touchcancel',endT);
function inp(){let dx=0,dy=0;if(keys['w']||keys['arrowup'])dy-=1;if(keys['s']||keys['arrowdown'])dy+=1;if(keys['a']||keys['arrowleft'])dx-=1;if(keys['d']||keys['arrowright'])dx+=1;if(joy){const m=Math.hypot(joy.dx,joy.dy);if(m>10){dx=joy.dx/m;dy=joy.dy/m;}}const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m;}return[dx,dy];}
function togglePause(){ if(state==='play'){state='pause';document.getElementById('pause').classList.remove('hidden');} else if(state==='pause'){state='play';document.getElementById('pause').classList.add('hidden');} }

// ===== 거점 방어 배치 (타워디펜스식) =====
let selectedAlly=null;
function openAssign(){ if(state==='play'||state==='pause'){document.getElementById('pause').classList.add('hidden'); state='assign'; selectedAlly=null;} }
function closeAssign(){ if(state==='assign'){ recomputeCombos(); state='play'; } }
const POST_CAP=3; // 거점당 최대 인원
function postCount(pid){ let n=0; for(const a of allies)if(a.post===pid)n++; return n; }
function assignPost(a,pid){ // 배치/해제 (정원·원거리 제약 반영)
  if(a.post===pid){ a.post=null; return; }         // 같은 곳 재탭 = 해제
  if(pid==='roof' && !(a.eRanged||a.ranged)) return;            // 옥상=원거리 전용
  if(postCount(pid)>=POST_CAP) return;             // 정원 초과
  a.post=pid;
}
function postLabelOf(a){ return a.post==='roof'?'옥상':(typeof a.post==='number'&&a.post<ENTRIES.length?ENTRIES[a.post].label:'대기'); }
function assignLayout(){
  const pad=10, topUI=108, x=pad, w=VW-2*pad, n=allies.length;
  const chipsY=VH-116, cw=(w-(n-1)*8)/n;
  const chips=allies.map((a,j)=>({j,x:x+j*(cw+8),y:chipsY,w:cw,h:44}));
  const done={x,y:VH-62,w,h:50};
  const roof={x:VW/2-98,y:78,w:196,h:26};
  const availW=w, availH=(chipsY-10)-topUI, sc=Math.min(availW/WW, availH/WH);
  const mw=WW*sc, mh=WH*sc, ox=(VW-mw)/2, oy=topUI+(availH-mh)/2;
  const posts=ENTRIES.map((e,i)=>({i,x:ox+e.cx*sc,y:oy+e.cy*sc,r:16}));
  return {chips,done,roof,map:{ox,oy,mw,mh,sc},posts};
}
function drawAssign(){
  recomputeCombos(); // 배치 중 콤보 실시간 표시
  cx.fillStyle='rgba(5,8,14,0.97)';cx.fillRect(0,0,VW,VH);
  cx.textAlign='center';cx.fillStyle='#7FE3F0';cx.font='900 20px "Apple SD Gothic Neo",sans-serif';cx.fillText('거점 방어 배치',VW/2,36);
  cx.fillStyle='#8CA0B3';cx.font='12px "Apple SD Gothic Neo",sans-serif';cx.fillText('동료 탭 → 거점 탭 · 거점당 최대 '+POST_CAP+'명 · 다시 탭=해제',VW/2,56);
  const L=assignLayout(), M=L.map;
  // 옥상 거점 (원거리 전용)
  { const rf=L.roof, mine=allies.filter(a=>a.post==='roof'), here=selectedAlly&&selectedAlly.post==='roof';
    const canRoof=selectedAlly&&selectedAlly.ranged;
    cx.fillStyle=mine.length?'rgba(192,139,255,0.28)':'rgba(192,139,255,0.10)';
    cx.strokeStyle=here?'#fff':(canRoof?'#C08BFF':'#6a5a86');cx.lineWidth=here?2.5:1.5;
    cx.fillRect(rf.x,rf.y,rf.w,rf.h);cx.strokeRect(rf.x,rf.y,rf.w,rf.h);
    cx.fillStyle='#C08BFF';cx.font='800 12px "Apple SD Gothic Neo",sans-serif';cx.textAlign='center';
    cx.fillText('🔫 옥상 저격'+(mine.length?' ['+mine.map(a=>a.nm[0]).join('')+']':' (원거리 전용)'),VW/2,rf.y+17);
  }
  // 맵
  if(BG.complete&&BG.naturalWidth) cx.drawImage(BG,M.ox,M.oy,M.mw,M.mh);
  else { cx.fillStyle='#1a2130'; cx.fillRect(M.ox,M.oy,M.mw,M.mh); }
  cx.strokeStyle='rgba(127,227,240,0.35)';cx.lineWidth=1;cx.strokeRect(M.ox,M.oy,M.mw,M.mh);
  // 거점 마커
  for(const p of L.posts){ const en=ENTRIES[p.i], mine=allies.filter(a=>a.post===p.i&&a.down<=0);
    const here=selectedAlly&&selectedAlly.post===p.i, broken=en.barr.hp<=0, full=mine.length>=POST_CAP;
    if(here){cx.strokeStyle='#fff';cx.lineWidth=3;cx.beginPath();cx.arc(p.x,p.y,p.r+5,0,6.29);cx.stroke();}
    cx.beginPath();cx.arc(p.x,p.y,p.r,0,6.29);
    cx.fillStyle=mine.length?'rgba(126,216,168,0.92)':(broken?'rgba(255,90,90,0.85)':'rgba(255,170,80,0.25)');
    cx.fill();
    cx.strokeStyle=en.isWin?'#7FB4FF':(broken?'#FF5A5A':'#FFC24B');cx.lineWidth=2.5;cx.stroke();
    cx.fillStyle=mine.length?'#08131a':'#FFD9A0';cx.textAlign='center';cx.font='800 11px "Apple SD Gothic Neo",sans-serif';
    cx.fillText(mine.length?mine.map(a=>a.nm[0]).join(''):(en.isWin?'창':'문'),p.x,p.y+4);
    cx.fillStyle='#cdd8e4';cx.font='700 10px "Apple SD Gothic Neo",sans-serif';cx.fillText(en.label+(full?'(만원)':''),p.x,p.y-p.r-4);
  }
  // 동료 칩
  for(const c of L.chips){ const a=allies[c.j], sel=selectedAlly===a;
    cx.fillStyle=sel?'#7FE3F0':'rgba(18,26,43,0.95)';cx.strokeStyle=sel?'#fff':'#3E6E7A';cx.lineWidth=sel?2:1;
    cx.fillRect(c.x,c.y,c.w,c.h);cx.strokeRect(c.x,c.y,c.w,c.h);
    cx.textAlign='center';cx.fillStyle=sel?'#08131a':'#D7E3EC';cx.font='800 13px "Apple SD Gothic Neo",sans-serif';cx.fillText(a.nm,c.x+c.w/2,c.y+18);
    cx.fillStyle=sel?'#08131a':'#8CA0B3';cx.font='9px "Apple SD Gothic Neo",sans-serif';
    cx.fillText((a.ranged?'원거리':(a.key==='mansu'?'수리':'근접'))+'·'+postLabelOf(a),c.x+c.w/2,c.y+34);
  }
  // 활성 콤보 표시
  cx.textAlign='center';cx.font='700 10px "Apple SD Gothic Neo",sans-serif';
  if(activeCombos.length){ cx.fillStyle='#FFC24B'; cx.fillText('★콤보: '+activeCombos.map(c=>c.name+'('+c.where+')').join('  '),VW/2,L.chips[0].y-6); }
  else { cx.fillStyle='#5a6b80'; cx.fillText('같은 거점에 근접 2명=협공 · 근접+원거리=엄호 · 옥상 원거리 2명=십자포화',VW/2,L.chips[0].y-6); }
  cx.fillStyle='#7FE3F0';cx.fillRect(L.done.x,L.done.y,L.done.w,L.done.h);
  cx.fillStyle='#08131a';cx.font='900 17px "Apple SD Gothic Neo",sans-serif';cx.textAlign='center';cx.fillText('완료 · 방어 시작',VW/2,L.done.y+L.done.h/2+6);
}
function assignTap(lx,ly){
  const L=assignLayout();
  if(lx>L.done.x&&lx<L.done.x+L.done.w&&ly>L.done.y&&ly<L.done.y+L.done.h){ closeAssign(); return; }
  for(const c of L.chips){ if(lx>c.x&&lx<c.x+c.w&&ly>c.y&&ly<c.y+c.h){ selectedAlly=(selectedAlly===allies[c.j])?null:allies[c.j]; return; } }
  const rf=L.roof; if(lx>rf.x&&lx<rf.x+rf.w&&ly>rf.y&&ly<rf.y+rf.h){ if(selectedAlly)assignPost(selectedAlly,'roof'); return; }
  for(const p of L.posts){ if(Math.hypot(lx-p.x,ly-p.y)<p.r+8){ if(selectedAlly)assignPost(selectedAlly,p.i); return; } }
}

// ===== 아침 경영 화면 =====
function morningMembers(){ return [{who:player,key:'seoyeon',nm:'서연',isP:true}].concat(allies.map(a=>({who:a,key:a.key,nm:a.nm,isP:false}))); }
function equipItem(mem,id){ // 장착/해제(다른 이가 들고 있으면 뺏어옴)
  const who=mem.who;
  if(who.item===id){ who.item=null; recomputeCombos(); return; }
  const holder=morningMembers().find(m=>m.who.item===id); if(holder)holder.who.item=null;
  who.item=id; recomputeCombos();
}
function morningLayout(){
  const x=12,w=VW-24, rowH=54, top=104;
  const mem=morningMembers();
  const rows=mem.map((m,i)=>{ const ry=top+i*(rowH+4);
    return {m,y:ry,h:rowH,x,w, work:(!m.isP)?[0,1,2].map(k=>({k,x:x+150+k*58,y:ry+24,w:54,h:24})):[], sel:{x,y:ry,w:140,h:rowH}}; });
  const facY=top+mem.length*(rowH+4)+8;
  const fac2=[{k:'barricade',x,y:facY,w:w/2-4,h:44},{k:'farm',x:x+w/2+4,y:facY,w:w/2-4,h:44}];
  const itemY=facY+54, cw=(w-4*6)/5;
  const chips=ITEMS.map((it,i)=>({it,x:x+i*(cw+6),y:itemY,w:cw,h:46}));
  const lightY=itemY+56;
  return {rows,fac2,chips,next:{x,y:VH-56,w,h:46},itemY,skillBtn:{x:VW-104,y:74,w:92,h:26},
    light:{on:{x,y:lightY,w:w/2-4,h:44}, off:{x:x+w/2+4,y:lightY,w:w/2-4,h:44}}};
}
function drawMorning(){
  cx.fillStyle='rgba(6,10,18,0.98)';cx.fillRect(0,0,VW,VH);
  cx.textAlign='left';cx.fillStyle='#FFC24B';cx.font='900 20px "Apple SD Gothic Neo",sans-serif';cx.fillText('D+'+day+' 아침 · 정비',12,30);
  const mi=morningInfo||{};
  cx.font='700 13px "Apple SD Gothic Neo",sans-serif';cx.textAlign='right';
  cx.fillStyle='#7ED8A8';cx.fillText('🍖 식량 '+food+'  (밤새 +'+(mi.foodProd||0)+' / -'+(mi.foodCons||0)+')',VW-12,24);
  cx.fillStyle='#C9B27A';cx.fillText('🔩 재료 '+materials,VW-12,44);
  if(mi.starve){cx.fillStyle='#FF5A5A';cx.fillText('⚠ 식량 바닥! 사기·체력↓',VW-12,62);}
  // v4: 스킬 버튼 + SP·일지
  { const L2=morningLayout(), b=L2.skillBtn;
    cx.fillStyle=sp>0?'rgba(192,139,255,0.25)':'rgba(30,41,61,0.9)';
    cx.strokeStyle=sp>0?'#C08BFF':'#3a4658'; cx.lineWidth=sp>0?2:1;
    cx.fillRect(b.x,b.y,b.w,b.h); cx.strokeRect(b.x,b.y,b.w,b.h);
    cx.textAlign='center'; cx.fillStyle=sp>0?'#C08BFF':'#8CA0B3';
    cx.font='800 12px "Apple SD Gothic Neo",sans-serif';
    cx.fillText('✨ 스킬'+(sp>0?' ('+sp+')':''),b.x+b.w/2,b.y+18);
    cx.textAlign='right'; cx.fillStyle='#8CA0B3'; cx.font='700 10px "Apple SD Gothic Neo",sans-serif';
    cx.fillText('📓 일지 '+journals+'/12 · 🔑 권한 '+keyLevel,VW-12,VH-66);
  }
  // v4: 사기 게이지
  { const gx=12, gy=54, gw=150, gh=9, tier=moraleTier();
    const col=tier==='high'?'#7ED8A8':tier==='crit'?'#FF5A5A':tier==='low'?'#FFC24B':'#7FB4FF';
    cx.textAlign='left';cx.fillStyle='#8CA0B3';cx.font='700 10px "Apple SD Gothic Neo",sans-serif';
    cx.fillText('사기 '+Math.round(morale)+' · '+moraleLabel(),gx,gy-3);
    cx.fillStyle='#20293D';cx.fillRect(gx,gy,gw,gh);
    cx.fillStyle=col;cx.fillRect(gx,gy,gw*morale/100,gh);
    cx.strokeStyle='rgba(255,255,255,0.15)';cx.lineWidth=1;cx.strokeRect(gx,gy,gw,gh);
    cx.fillStyle='#5a6b80';cx.font='9px "Apple SD Gothic Neo",sans-serif';
    cx.fillText(tier==='high'?'전 능력 +5%':tier==='low'?'공속·수리 −10%':tier==='crit'?'붕괴 — 이탈 위험':'',gx+gw+8,gy+8);
  }
  cx.textAlign='left';cx.fillStyle='#8CA0B3';cx.font='11px "Apple SD Gothic Neo",sans-serif';
  cx.fillText('생존자 탭=아이템 선택 · 근무(전투/시설/휴식) · 시설/아이템 강화 후 다음 밤',12,82);
  const L=morningLayout();
  const WKN=['전투','시설','휴식'];
  for(const r of L.rows){ const m=r.m, isSel=selMember===m.who;
    cx.fillStyle=isSel?'rgba(127,227,240,0.14)':'rgba(18,26,43,0.85)';cx.strokeStyle=isSel?'#7FE3F0':'#243247';cx.lineWidth=isSel?2:1;
    cx.fillRect(r.x,r.y,r.w,r.h);cx.strokeRect(r.x,r.y,r.w,r.h);
    cx.textAlign='left';cx.fillStyle='#E8EFF7';cx.font='800 14px "Apple SD Gothic Neo",sans-serif';cx.fillText(m.nm+(m.isP?' (주인공)':''),r.x+10,r.y+20);
    // hp바
    const who=m.who,hpr=Math.max(0,(who.hp||0)/(who.maxhp||1));
    cx.fillStyle='#20293D';cx.fillRect(r.x+10,r.y+30,120,5);cx.fillStyle='#7ED8A8';cx.fillRect(r.x+10,r.y+30,120*hpr,5);
    // 아이템
    const it=itemById(who.item);
    cx.fillStyle=it?'#FFD9A0':'#5a6b80';cx.font='700 11px "Apple SD Gothic Neo",sans-serif';cx.fillText('🎒'+(it?it.nm+(it.own===m.key?' ★':''):'없음'),r.x+10,r.y+48);
    // 근무 토글(동료만)
    for(const b of r.work){ const on=(who.work||'combat')===['combat','facility','rest'][b.k];
      cx.fillStyle=on?'#7FE3F0':'rgba(30,41,61,0.9)';cx.strokeStyle=on?'#fff':'#3E6E7A';cx.lineWidth=1;
      cx.fillRect(b.x,b.y,b.w,b.h);cx.strokeRect(b.x,b.y,b.w,b.h);
      cx.textAlign='center';cx.fillStyle=on?'#08131a':'#9fb0c4';cx.font='700 11px "Apple SD Gothic Neo",sans-serif';cx.fillText(WKN[b.k],b.x+b.w/2,b.y+16);}
    if(m.isP){cx.textAlign='right';cx.fillStyle='#8CA0B3';cx.font='11px "Apple SD Gothic Neo",sans-serif';cx.fillText('항상 전투(직접 조종)',r.x+r.w-10,r.y+30);}
  }
  // 시설
  for(const f of L.fac2){ const lv=fac[f.k], cost=(lv+1)*(f.k==='barricade'?4:3), can=materials>=cost;
    cx.fillStyle=can?'rgba(126,216,168,0.16)':'rgba(30,41,61,0.7)';cx.strokeStyle=can?'#7ED8A8':'#3a4658';cx.lineWidth=1.5;
    cx.fillRect(f.x,f.y,f.w,f.h);cx.strokeRect(f.x,f.y,f.w,f.h);
    cx.textAlign='center';cx.fillStyle='#E8EFF7';cx.font='800 13px "Apple SD Gothic Neo",sans-serif';
    cx.fillText((f.k==='barricade'?'🧱 바리케이드 Lv.':'🌱 밭 Lv.')+lv,f.x+f.w/2,f.y+19);
    cx.fillStyle=can?'#C9B27A':'#6a5a3a';cx.font='700 11px "Apple SD Gothic Neo",sans-serif';cx.fillText('강화 🔩'+cost,f.x+f.w/2,f.y+36);}
  // 아이템 바
  cx.textAlign='left';cx.fillStyle='#8CA0B3';cx.font='11px "Apple SD Gothic Neo",sans-serif';cx.fillText(selMember?('▶ '+(morningMembers().find(m=>m.who===selMember)||{}).nm+' 에게 장착할 아이템 탭'):'생존자를 먼저 탭하세요',12,L.itemY-6);
  for(const c of L.chips){ const it=c.it, holder=morningMembers().find(m=>m.who.item===it.id), eqSel=selMember&&selMember.item===it.id;
    cx.fillStyle=eqSel?'#7FE3F0':'rgba(18,26,43,0.95)';cx.strokeStyle=eqSel?'#fff':'#3E6E7A';cx.lineWidth=1;
    cx.fillRect(c.x,c.y,c.w,c.h);cx.strokeRect(c.x,c.y,c.w,c.h);
    cx.textAlign='center';cx.fillStyle=eqSel?'#08131a':'#D7E3EC';cx.font='700 10px "Apple SD Gothic Neo",sans-serif';cx.fillText(it.nm,c.x+c.w/2,c.y+16);
    cx.fillStyle=eqSel?'#08131a':'#8CA0B3';cx.font='8px "Apple SD Gothic Neo",sans-serif';
    cx.fillText(holder?holder.nm+' 착용':'여분',c.x+c.w/2,c.y+30);
    cx.fillStyle='#C08BFF';cx.fillText('주인:'+({seoyeon:'서연',jaehyuk:'재혁',jina:'진아',mansu:'만수',sangcheol:'상철'}[it.own]),c.x+c.w/2,c.y+42);}
  // v4: 오늘 밤 선택 — 점등/소등
  { const LB=L.light;
    const onSel=!blackout, offSel=blackout;
    cx.fillStyle=onSel?'rgba(255,194,75,0.2)':'rgba(30,41,61,0.8)';
    cx.strokeStyle=onSel?'#FFC24B':'#3a4658';cx.lineWidth=onSel?2:1;
    cx.fillRect(LB.on.x,LB.on.y,LB.on.w,LB.on.h);cx.strokeRect(LB.on.x,LB.on.y,LB.on.w,LB.on.h);
    cx.textAlign='center';cx.fillStyle=onSel?'#FFC24B':'#8CA0B3';cx.font='800 13px "Apple SD Gothic Neo",sans-serif';
    cx.fillText('💡 점등 — 등대가 된다',LB.on.x+LB.on.w/2,LB.on.y+19);
    cx.fillStyle=onSel?'#C9B27A':'#5a6b80';cx.font='9px "Apple SD Gothic Neo",sans-serif';
    cx.fillText('웨이브 100% · 생존자 유입 · 연료 3L',LB.on.x+LB.on.w/2,LB.on.y+34);
    cx.fillStyle=offSel?'rgba(127,227,240,0.18)':'rgba(30,41,61,0.8)';
    cx.strokeStyle=offSel?'#7FE3F0':'#3a4658';cx.lineWidth=offSel?2:1;
    cx.fillRect(LB.off.x,LB.off.y,LB.off.w,LB.off.h);cx.strokeRect(LB.off.x,LB.off.y,LB.off.w,LB.off.h);
    cx.fillStyle=offSel?'#7FE3F0':'#8CA0B3';cx.font='800 13px "Apple SD Gothic Neo",sans-serif';
    cx.fillText('🌑 소등의 밤 — 숨는다',LB.off.x+LB.off.w/2,LB.off.y+19);
    cx.fillStyle=offSel?'#7FB4FF':'#5a6b80';cx.font='9px "Apple SD Gothic Neo",sans-serif';
    cx.fillText('웨이브 −70% · 사기'+(prevBlackout?'−20':'−10')+' · 식량 −15%',LB.off.x+LB.off.w/2,LB.off.y+34);
  }
  // 다음 밤
  cx.fillStyle='#FFC24B';cx.fillRect(L.next.x,L.next.y,L.next.w,L.next.h);
  cx.fillStyle='#1a1206';cx.font='900 16px "Apple SD Gothic Neo",sans-serif';cx.textAlign='center';cx.fillText('☀️ 낮 원정 출발',VW/2,L.next.y+L.next.h/2+6);
}
// ===== v4: 스킬 트리 화면 =====
function skillLayout(){
  const keys=Object.keys(TREES), n=keys.length, pad=10, w=VW-2*pad;
  const cw=(w-(n-1)*6)/n;
  const tabs=keys.map((k,i)=>({k,x:pad+i*(cw+6),y:78,w:cw,h:36}));
  const colW=(w-14)/2, top=134;
  const cells=[];
  ['A','B'].forEach((br,bi)=>{
    TREES[skillSel][br].nodes.forEach((nd,ni)=>{
      cells.push({br,ni,nd,x:pad+bi*(colW+14),y:top+34+ni*84,w:colW,h:74});
    });
  });
  return {tabs,cells,colW,top,pad,back:{x:pad,y:VH-58,w:w,h:46}};
}
function drawSkill(){
  cx.fillStyle='rgba(6,10,18,0.98)'; cx.fillRect(0,0,VW,VH);
  cx.textAlign='left'; cx.fillStyle='#C08BFF'; cx.font='900 20px "Apple SD Gothic Neo",sans-serif';
  cx.fillText('스킬 트리',12,32);
  cx.textAlign='right'; cx.fillStyle='#C08BFF'; cx.font='900 16px "Apple SD Gothic Neo",sans-serif';
  cx.fillText('SP '+sp,VW-12,30);
  cx.fillStyle='#8CA0B3'; cx.font='11px "Apple SD Gothic Neo",sans-serif';
  cx.fillText('🔑 권한 '+keyLevel+' · 📓 일지 '+journals+'/12',VW-12,50);
  cx.textAlign='left'; cx.fillStyle='#5a6b80'; cx.font='10px "Apple SD Gothic Neo",sans-serif';
  cx.fillText('위 칸부터 순서대로 · T1=1SP T2=2SP T3=3SP · 잠금은 카드키 권한 필요',12,52);
  const L=skillLayout();
  for(const tb of L.tabs){ const sel=tb.k===skillSel, cnt=skillCount(tb.k);
    cx.fillStyle=sel?'#C08BFF':'rgba(18,26,43,0.95)'; cx.strokeStyle=sel?'#fff':'#3E6E7A'; cx.lineWidth=sel?2:1;
    cx.fillRect(tb.x,tb.y,tb.w,tb.h); cx.strokeRect(tb.x,tb.y,tb.w,tb.h);
    cx.textAlign='center'; cx.fillStyle=sel?'#1a0d26':'#D7E3EC'; cx.font='800 13px "Apple SD Gothic Neo",sans-serif';
    cx.fillText(TREES[tb.k].nm,tb.x+tb.w/2,tb.y+17);
    cx.fillStyle=sel?'#3a1d4a':'#8CA0B3'; cx.font='9px "Apple SD Gothic Neo",sans-serif';
    cx.fillText(cnt+'/6 습득',tb.x+tb.w/2,tb.y+30); }
  ['A','B'].forEach((br,bi)=>{
    const bx=L.pad+bi*(L.colW+14);
    cx.textAlign='center'; cx.fillStyle=bi?'#FFC24B':'#7ED8A8'; cx.font='800 13px "Apple SD Gothic Neo",sans-serif';
    cx.fillText(TREES[skillSel][br].nm,bx+L.colW/2,L.top+18); });
  for(const c of L.cells){
    const owned=has(c.nd.id), lock=nodeLocked(c.nd), buy=canBuy(skillSel,c.br,c.ni);
    cx.fillStyle=owned?'rgba(126,216,168,0.18)':lock?'rgba(30,30,40,0.9)':buy?'rgba(192,139,255,0.14)':'rgba(20,26,40,0.9)';
    cx.strokeStyle=owned?'#7ED8A8':lock?'#3a3a48':buy?'#C08BFF':'#2b3550'; cx.lineWidth=owned||buy?2:1;
    cx.fillRect(c.x,c.y,c.w,c.h); cx.strokeRect(c.x,c.y,c.w,c.h);
    cx.textAlign='left';
    cx.fillStyle=owned?'#7ED8A8':lock?'#6a6a78':'#E8EFF7'; cx.font='800 12px "Apple SD Gothic Neo",sans-serif';
    cx.fillText((owned?'✓ ':'')+c.nd.nm,c.x+9,c.y+19);
    cx.fillStyle=lock?'#55555f':'#8CA0B3'; cx.font='10px "Apple SD Gothic Neo",sans-serif';
    const words=c.nd.d, max=Math.floor((c.w-18)/5.6);
    cx.fillText(words.length>max?words.slice(0,max)+'…':words,c.x+9,c.y+37);
    cx.fillStyle=lock?'#7a5a3a':owned?'#5a7a68':'#C9B27A'; cx.font='700 10px "Apple SD Gothic Neo",sans-serif';
    cx.fillText(lock?('🔒 권한 '+(c.nd.need)+' 필요'):owned?'습득 완료':('T'+c.nd.t+' · '+nodeCost(c.nd)+' SP'),c.x+9,c.y+58);
  }
  cx.fillStyle='#7FE3F0'; cx.fillRect(L.back.x,L.back.y,L.back.w,L.back.h);
  cx.fillStyle='#08131a'; cx.font='900 16px "Apple SD Gothic Neo",sans-serif'; cx.textAlign='center';
  cx.fillText('아침으로 돌아가기',VW/2,L.back.y+29);
}
function skillTap(lx,ly){
  const L=skillLayout();
  if(lx>L.back.x&&lx<L.back.x+L.back.w&&ly>L.back.y&&ly<L.back.y+L.back.h){ state='morning'; return; }
  for(const tb of L.tabs) if(lx>tb.x&&lx<tb.x+tb.w&&ly>tb.y&&ly<tb.y+tb.h){ skillSel=tb.k; return; }
  for(const c of L.cells) if(lx>c.x&&lx<c.x+c.w&&ly>c.y&&ly<c.y+c.h){ buyNode(skillSel,c.br,c.ni); return; }
}
// ===== 낮 원정 화면 =====
const RINGCOL={near:'#7ED8A8',mid:'#FFC24B',far:'#FF6E6E'};
function roundRect(x,y,w,h,r){ cx.beginPath(); if(cx.roundRect){cx.roundRect(x,y,w,h,r);} else { cx.moveTo(x+r,y);cx.arcTo(x+w,y,x+w,y+h,r);cx.arcTo(x+w,y+h,x,y+h,r);cx.arcTo(x,y+h,x,y,r);cx.arcTo(x,y,x+w,y,r);cx.closePath(); } }
function expRoad(x1,y1,x2,y2){ // 도로: 회색 폭 + 노란 점선 중앙선
  cx.lineCap='round';
  cx.strokeStyle='#39424f';cx.lineWidth=22;cx.beginPath();cx.moveTo(x1,y1);cx.lineTo(x2,y2);cx.stroke();
  cx.strokeStyle='#586472';cx.lineWidth=18;cx.beginPath();cx.moveTo(x1,y1);cx.lineTo(x2,y2);cx.stroke();
  cx.setLineDash([7,9]);cx.strokeStyle='#c8b45a';cx.lineWidth=2;cx.beginPath();cx.moveTo(x1,y1);cx.lineTo(x2,y2);cx.stroke();cx.setLineDash([]);
}
function drawExpedition(){
  // 밤/새벽 하늘색으로 배경(도시)
  cx.fillStyle='#141b26';cx.fillRect(0,0,VW,VH);
  // 도시 블록(건물 배경) — 지도 느낌
  cx.fillStyle='#1c2536';
  const blocks=[[16,150,120,150],[300,150,120,150],[16,430,110,120],[314,430,110,120],[150,90,140,70],[150,630,140,60]];
  for(const b of blocks){cx.fillRect(b[0],b[1],b[2],b[3]); cx.strokeStyle='#252f42';cx.lineWidth=1;cx.strokeRect(b[0],b[1],b[2],b[3]);}
  // 원거리 위험 지대 붉은 틴트(위쪽)
  cx.fillStyle='rgba(255,90,90,0.06)';cx.fillRect(0,90,VW,180);
  // 도로망: 중앙 세로 도로 + 3개 가로 도로
  expRoad(220,150,220,690);
  expRoad(112,582,326,582); expRoad(128,398,312,398); expRoad(150,186,300,186);
  // 방문 경로(집→현재) 점선
  if(expPos.x!==EXP_BASE.x||expPos.y!==EXP_BASE.y){ cx.setLineDash([4,5]);cx.strokeStyle='rgba(255,226,75,0.6)';cx.lineWidth=2;cx.beginPath();cx.moveTo(EXP_BASE.x,EXP_BASE.y);cx.lineTo(expPos.x,expPos.y);cx.stroke();cx.setLineDash([]); }
  // 노드(건물 아이콘 타일)
  for(const n of expNodes){ const c=RINGCOL[n.ring], cost=Math.round(Math.hypot(n.x-expPos.x,n.y-expPos.y)*0.09);
    cx.fillStyle=n.searched?'rgba(40,48,60,0.85)':'rgba(24,32,48,0.96)';
    cx.strokeStyle=n.searched?'#4a5568':c;cx.lineWidth=2.5;
    roundRect(n.x-19,n.y-19,38,38,8); cx.fill(); cx.stroke();
    cx.textAlign='center';cx.font='19px sans-serif'; cx.globalAlpha=n.searched?0.4:1; cx.fillText(n.ic,n.x,n.y+7); cx.globalAlpha=1;
    cx.fillStyle='#e6eef7';cx.font='700 10px "Apple SD Gothic Neo",sans-serif';cx.fillText(n.nm,n.x,n.y-24);
    if(n.searched){cx.fillStyle='#7ED8A8';cx.font='800 10px sans-serif';cx.fillText('✓수색',n.x,n.y+32);}
    else {cx.fillStyle=c;cx.font='700 9px sans-serif';cx.fillText({near:'近',mid:'中',far:'遠'}[n.ring]+' · 🕐'+cost,n.x,n.y+32);}
  }
  // 본거지(집/편의점 아이콘)
  cx.fillStyle='#25506a';cx.strokeStyle='#7FE3F0';cx.lineWidth=3;roundRect(EXP_BASE.x-24,EXP_BASE.y-22,48,44,8);cx.fill();cx.stroke();
  cx.font='20px sans-serif';cx.textAlign='center';cx.fillText('🏪',EXP_BASE.x,EXP_BASE.y+3);
  cx.fillStyle='#7FE3F0';cx.font='800 10px "Apple SD Gothic Neo",sans-serif';cx.fillText('안심24 ↩귀환',EXP_BASE.x,EXP_BASE.y-28);
  // 파티(캐릭터 그림) — 현재 위치에 서연+전투동료 머리
  const party=[SPR.front].concat(allies.filter(a=>(a.work||'combat')==='combat'&&a.down<=0).slice(0,2).map(a=>SPR[a.key]));
  let off=-(party.length-1)*10;
  for(const img of party){ if(img&&img.complete&&img.naturalWidth){ drawChar(img, expPos.x+off, expPos.y-4, 34, {}); } off+=20; }
  // ===== 상단 HUD =====
  cx.fillStyle='rgba(8,12,20,0.82)';cx.fillRect(0,0,VW,74);
  cx.textAlign='left';cx.fillStyle='#FFC24B';cx.font='900 18px "Apple SD Gothic Neo",sans-serif';cx.fillText('☀️ 낮 원정',12,26);
  const bw=VW-150, br=Math.max(0,expBudget/100);
  cx.fillStyle='#20293D';cx.fillRect(130,14,bw,12);cx.fillStyle=br>0.35?'#FFD24B':'#FF6E6E';cx.fillRect(130,14,bw*br,12);
  cx.fillStyle='#cdd8e4';cx.font='700 9px sans-serif';cx.textAlign='center';cx.fillText((br>0.35?'☀️':'🌆')+' 햇빛 '+Math.max(0,Math.round(expBudget)),130+bw/2,24);
  cx.textAlign='left';cx.fillStyle='#7ED8A8';cx.font='700 12px "Apple SD Gothic Neo",sans-serif';cx.fillText('🎒 🍖'+expLoot.food+'  🔩'+expLoot.mat+(expLoot.rescue?'  🆘'+expLoot.rescue:''),12,46);
  cx.fillStyle='#8CA0B3';cx.font='10px "Apple SD Gothic Neo",sans-serif';cx.fillText('파티 전투력 '+partyPower()+' · 近안전소량 / 遠위험대량+구출',12,64);
  // 결과 메시지 하단
  cx.fillStyle='rgba(8,12,20,0.85)';cx.fillRect(0,VH-30,VW,30);
  cx.fillStyle=expStranded?'#FF5A5A':'#cdd8e4';cx.font='700 11px "Apple SD Gothic Neo",sans-serif';cx.textAlign='center';
  cx.fillText(expStranded?'⚠ 예산 초과! 귀환 시 전리품 절반·부상':expMsg,VW/2,VH-11);
  if(escortees.length){ cx.textAlign='left'; cx.fillStyle='#7FE3F0'; cx.font='700 11px "Apple SD Gothic Neo",sans-serif';
    cx.fillText('🤝 호위 중: '+escortees.map(e=>e.nm).join(', '),12,VH-40); }
  if(rescueCard) drawRescueCard();
}
function endExpedition(){
  // 귀환 이동비용
  expBudget-=Math.hypot(expPos.x-EXP_BASE.x,expPos.y-EXP_BASE.y)*0.09;
  if(expBudget<0||expStranded){ expLoot.food=Math.floor(expLoot.food*0.5); expLoot.mat=Math.floor(expLoot.mat*0.5); expApplyDmg(15); }
  food+=expLoot.food; materials+=expLoot.mat;
  // v4: 호위자 합류 → allies에 편입
  for(const e of escortees){
    joined.push({key:e.key,nm:e.nm,memo:e.memo});
    allies.push({key:e.key,nm:e.nm,ranged:!!e.ranged,rng:e.rng,dmg:e.dmg,cd:e.cd,hp:e.hp,spd:e.spd,
      r:15,x:CENTER.x+(Math.random()*80-40),y:CENTER.y+(Math.random()*60),maxhp:e.hp,baseMaxhp:e.hp,
      cdLeft:0,hitCd:0,down:0,swingT:0,swingDir:0,phase:Math.random()*6,moving:false,post:null,
      work:'combat',item:null,joinDay:day,mortal:true,memo:e.memo});
    totalRescued++;
  }
  if(escortees.length){ fx.push({type:'alert',txt:escortees.map(e=>e.nm).join('·')+' 합류!',t:2.6}); addMorale(5*escortees.length,'사기'); sp+=escortees.length; }
  escortees=[]; rescueCard=null;
  startNight(false); state='play';
}
// ===== v4: 구출 정보 카드 =====
function cardLayout(){ const w=Math.min(320,VW-40), x=(VW-w)/2, h=290, y=(VH-h)/2;
  return {x,y,w,h, take:{x:x+14,y:y+h-58,w:w/2-20,h:44}, pass:{x:x+w/2+6,y:y+h-58,w:w/2-20,h:44}}; }
function drawRescueCard(){
  const c=rescueCard, L=cardLayout();
  cx.fillStyle='rgba(4,7,14,0.72)'; cx.fillRect(0,0,VW,VH);
  cx.fillStyle='#141C2E'; cx.strokeStyle='#7FE3F0'; cx.lineWidth=2;
  roundRect(L.x,L.y,L.w,L.h,14); cx.fill(); cx.stroke();
  cx.textAlign='center'; cx.fillStyle='#7FE3F0'; cx.font='700 11px "Apple SD Gothic Neo",sans-serif';
  cx.fillText('생존자 발견 · '+(c.node||''),VW/2,L.y+26);
  cx.fillStyle='#E8EFF7'; cx.font='900 24px "Apple SD Gothic Neo",sans-serif';
  cx.fillText(c.nm,VW/2,L.y+58);
  cx.fillStyle='#8CA0B3'; cx.font='12px "Apple SD Gothic Neo",sans-serif';
  cx.fillText(c.age+'세 · '+c.job,VW/2,L.y+78);
  cx.textAlign='left';
  const bx=L.x+18;
  cx.fillStyle='#7ED8A8'; cx.font='700 12px "Apple SD Gothic Neo",sans-serif'; cx.fillText('장점',bx,L.y+112);
  cx.fillStyle='#D7E3EC'; cx.font='13px "Apple SD Gothic Neo",sans-serif'; cx.fillText(c.good,bx,L.y+132);
  cx.fillStyle='#FF9EB5'; cx.font='700 12px "Apple SD Gothic Neo",sans-serif'; cx.fillText('단점',bx,L.y+162);
  cx.fillStyle='#D7E3EC'; cx.font='13px "Apple SD Gothic Neo",sans-serif'; cx.fillText(c.bad,bx,L.y+182);
  cx.fillStyle='#FFC24B'; cx.font='700 12px "Apple SD Gothic Neo",sans-serif';
  cx.fillText('🍖 식량 소모 +2/일 · 데려가면 오늘 밤부터',bx,L.y+212);
  cx.fillStyle='#7ED8A8'; roundRect(L.take.x,L.take.y,L.take.w,L.take.h,9); cx.fill();
  cx.fillStyle='#08131a'; cx.font='900 15px "Apple SD Gothic Neo",sans-serif'; cx.textAlign='center';
  cx.fillText('데려간다',L.take.x+L.take.w/2,L.take.y+28);
  cx.fillStyle='rgba(30,41,61,0.95)'; cx.strokeStyle='#3E6E7A'; cx.lineWidth=1;
  roundRect(L.pass.x,L.pass.y,L.pass.w,L.pass.h,9); cx.fill(); cx.stroke();
  cx.fillStyle='#9fb0c4'; cx.fillText('지나친다',L.pass.x+L.pass.w/2,L.pass.y+28);
}
function cardTap(lx,ly){
  const L=cardLayout(), c=rescueCard;
  if(lx>L.take.x&&lx<L.take.x+L.take.w&&ly>L.take.y&&ly<L.take.y+L.take.h){
    escortees.push(c); expMsg=c.nm+' 합류 — 귀환까지 호위하라'; rescueCard=null; return;
  }
  if(lx>L.pass.x&&lx<L.pass.x+L.pass.w&&ly>L.pass.y&&ly<L.pass.y+L.pass.h){
    expMsg='누군가 있던 흔적만 남아 있다.'; rescueCard=null; return;
  }
}
function expeditionTap(lx,ly){
  if(rescueCard){ cardTap(lx,ly); return; }
  if(Math.hypot(lx-EXP_BASE.x,ly-EXP_BASE.y)<24){ endExpedition(); return; }
  for(const n of expNodes){ if(Math.hypot(lx-n.x,ly-n.y)<20){
    const cost=Math.hypot(n.x-expPos.x,n.y-expPos.y)*0.09;
    expBudget-=cost; expPos={x:n.x,y:n.y};
    if(!n.searched){ n.searched=true; expResolve(n); }
    if(expBudget<=0)expStranded=true;
    return; } }
}
function morningTap(lx,ly){
  const L=morningLayout();
  const N=L.next; if(lx>N.x&&lx<N.x+N.w&&ly>N.y&&ly<N.y+N.h){ genExpedition(); state='expedition'; return; }
  for(const r of L.rows){
    for(const b of r.work){ if(lx>b.x&&lx<b.x+b.w&&ly>b.y&&ly<b.y+b.h){ r.m.who.work=['combat','facility','rest'][b.k]; recomputeCombos(); return; } }
    if(lx>r.sel.x&&lx<r.sel.x+r.sel.w&&ly>r.sel.y&&ly<r.sel.y+r.sel.h){ selMember=(selMember===r.m.who)?null:r.m.who; return; }
  }
  { const b=L.skillBtn;
    if(lx>b.x&&lx<b.x+b.w&&ly>b.y&&ly<b.y+b.h){ state='skill'; return; } }
  { const LB=L.light;
    if(lx>LB.on.x&&lx<LB.on.x+LB.on.w&&ly>LB.on.y&&ly<LB.on.y+LB.on.h){ blackout=false; return; }
    if(lx>LB.off.x&&lx<LB.off.x+LB.off.w&&ly>LB.off.y&&ly<LB.off.y+LB.off.h){ blackout=true; return; } }
  for(const f of L.fac2){ if(lx>f.x&&lx<f.x+f.w&&ly>f.y&&ly<f.y+f.h){ const lv=fac[f.k],cost=(lv+1)*(f.k==='barricade'?4:3); if(materials>=cost){materials-=cost;fac[f.k]++;} return; } }
  for(const c of L.chips){ if(lx>c.x&&lx<c.x+c.w&&ly>c.y&&ly<c.y+c.h){ if(selMember)equipItem(morningMembers().find(m=>m.who===selMember),c.it.id); return; } }
}

function spawnZombie(){
  // 상/좌/하 가장자리에서만 스폰 (우측은 건물이 맵 끝에 붙어 통로가 없음)
  const e=Math.floor(Math.random()*3); let x,y;
  if(e===0){x=Math.random()*WW;y=8;} else if(e===1){x=8;y=Math.random()*WH;} else {x=Math.random()*WW;y=WH-8;}
  // 가장 가까운 출입구 배정
  let best=ENTRIES[0],bd=1e9;
  for(const en of ENTRIES){const d=Math.hypot(en.cx-x,en.cy-y); if(d<bd){bd=d;best=en;}}
  const hp=CFG.Z_HP+day*CFG.Z_HP_DAY+night_t*CFG.Z_HP_TIME;
  zombies.push({x,y,r:12,hp,maxhp:hp,speed:(CFG.Z_SPD+Math.random()*12+day*CFG.Z_SPD_DAY)*(ev555?1.3:1),
    entry:best,inside:false,climb:0,hitCd:0,bob:Math.random()*6});
}
// ===== v3: 변종 '러닝크루(러너)' — 창문 직행, 낮은 HP, 빠름 =====
function spawnRunner(){
  const e=Math.floor(Math.random()*3); let x,y;
  if(e===0){x=Math.random()*WW;y=8;} else if(e===1){x=8;y=Math.random()*WH;} else {x=Math.random()*WW;y=WH-8;}
  let best=null,bd=1e9;
  for(const en of ENTRIES){ if(!en.isWin)continue; const d=Math.hypot(en.cx-x,en.cy-y); if(d<bd){bd=d;best=en;} }
  if(!best){ bd=1e9; for(const en of ENTRIES){const d=Math.hypot(en.cx-x,en.cy-y); if(d<bd){bd=d;best=en;}} }
  const hp=(CFG.Z_HP+day*CFG.Z_HP_DAY+night_t*CFG.Z_HP_TIME)*0.6;
  zombies.push({x,y,r:10,hp,maxhp:hp,speed:(ev555?110*1.3:110),kind:'runner',climbNeed:0.9,
    entry:best,inside:false,climb:0,hitCd:0,bob:Math.random()*6});
}
// 파문: 소음 발생 → 링 확산(300px/s), 닿은 좀비가 발원지로 (31번 §4)
function addRipple(x,y,max,score){ ripples.push({x,y,r:0,max}); noiseScore+=score; }

const POOL=[
 {t:'묵직한 빠루',d:'서연 공격력+25%',f:()=>player.dmg*=1.25},
 {t:'풀스윙',d:'서연 공속+18%',f:()=>player.atkCd*=0.85},
 {t:'긴 리치',d:'범위+18%',f:()=>player.atkR*=1.18},
 {t:'런닝화',d:'이동+12%',f:()=>player.speed*=1.12},
 {t:'구급 파우치',d:'최대체력+25,회복',f:()=>{player.maxhp+=25;player.hp=player.maxhp;}},
 {t:'응급 보수',d:'가장 약한 바리케이드+40',f:()=>{let w=ENTRIES[0];for(const e of ENTRIES)if(e.barr.hp<w.barr.hp)w=e;w.barr.hp=Math.min(w.barr.max,w.barr.hp+40);}},
];
function showLevelUp(){state='levelup';const picks=[...POOL].sort(()=>Math.random()-0.5).slice(0,3);const box=document.getElementById('cards');box.innerHTML='';picks.forEach(u=>{const el=document.createElement('div');el.className='card';el.innerHTML='<b>'+u.t+'</b><span>'+u.d+'</span>';el.onclick=()=>{u.f();document.getElementById('levelup').style.display='none';state='play';};box.appendChild(el);});document.getElementById('levelup').style.display='flex';}
function gainXp(){player.xp++; if(player.xp>=player.need){player.xp=0;player.lvl++;player.need=5+player.lvl*3;showLevelUp();}}
function weakest(){let w=ENTRIES[0];for(const e of ENTRIES)if(e.barr.hp<w.barr.hp)w=e;return w;}
// ===== 직업 콤보 (거점 배치 시너지) =====
let activeCombos=[];
function applyItem(ent,ownerKey){ // 아이템 효과 적용(주인=syn, 아니면 base)
  const it=itemById(ent.item); if(!it)return;
  const e=(it.own===ownerKey)?it.syn:it.base;
  if(e.makeRanged){ ent.eRanged=true; if((e.rng||0)>ent.eRng)ent.eRng=e.rng; }
  if(e.dmg)ent.eDmg=(ent.eDmg||0)+e.dmg;
  if(e.rng&&!e.makeRanged)ent.eRng=(ent.eRng||0)+e.rng;
  if(e.cdMul)ent.eCd*=e.cdMul;
  if(e.repair)ent.eRepair=(ent.eRepair||0)+e.repair;
  if(e.heal)ent.healBonus=(ent.healBonus||0)+e.heal;
  if(e.hp!=null&&ent.baseMaxhp!==undefined){ ent.maxhp=ent.baseMaxhp+e.hp; }
}
function recomputeCombos(){
  activeCombos=[];
  const add=(name,where)=>{ if(!activeCombos.some(c=>c.name===name&&c.where===where))activeCombos.push({name,where}); };
  // 1) 리셋 + 아이템 적용
  for(const a of allies){ a.eDmg=a.dmg; a.eCd=a.cd; a.eRng=a.rng; a.eRanged=a.ranged; a.eRepair=0; a.maxhp=a.baseMaxhp; if(a.hp>a.maxhp)a.hp=a.maxhp; applyItem(a,a.key); }
  if(player){ player.eDmg=player.dmg; player.healBonus=0; applyItem(player,'seoyeon'); }
  // 2) 콤보 — 밤 배치(work='combat')된 동료만, eRanged 기준
  const groups={};
  for(const a of allies){ if(a.post==null||a.work!=='combat')continue; (groups[a.post]=groups[a.post]||[]).push(a); }
  for(const pid in groups){
    const mem=groups[pid], melee=mem.filter(a=>!a.eRanged), ranged=mem.filter(a=>a.eRanged);
    if(pid==='roof'){
      if(ranged.length>=2){ ranged.forEach(a=>{a.eRng+=80;a.eDmg=Math.round(a.eDmg*1.2);}); add('십자포화','옥상'); }
    } else {
      const lbl=ENTRIES[pid]?ENTRIES[pid].label:'';
      if(melee.length>=2){ melee.forEach(a=>a.eDmg=Math.round(a.eDmg*1.25)); add('협공',lbl); }
      if(melee.length>=1&&ranged.length>=1){ ranged.forEach(a=>a.eCd*=0.75); melee.forEach(a=>a.eDmg=Math.round(a.eDmg*1.15)); add('엄호사격',lbl); }
    }
  }
  const m=allies.find(a=>a.key==='mansu');
  if(m&&m.work==='combat'&&typeof m.post==='number'&&ENTRIES[m.post]){ add('요새',ENTRIES[m.post].label); }
}
// 동료 거점 기본 배치 — 원거리=옥상, 만수=정문, 나머지는 문 우선 분산
function autoAssignPosts(){
  for(const a of allies)a.post=null;
  const gi=ENTRIES.indexOf(GATE);
  for(const a of allies)if(a.ranged)a.post='roof';               // 원거리 → 옥상
  const m=allies.find(a=>a.key==='mansu'); if(m&&gi>=0)m.post=gi; // 수리 → 정문
  const order=ENTRIES.map((e,i)=>i).filter(i=>i!==gi).sort((x,y)=>(ENTRIES[x].isWin?1:0)-(ENTRIES[y].isWin?1:0));
  let oi=0; for(const a of allies){ if(a.post!=null)continue; a.post=(oi<order.length?order[oi++]:null); }
}

function update(dt){
  night_t+=dt; if(shake>0)shake=Math.max(0,shake-dt*55);
  // ===== v3: 시계 이벤트 (3:33=77s / 4:44=242s / 5:55=408s) =====
  if(!ev333&&night_t>=77){ev333=true;fx.push({type:'alert',txt:'3:33 — 러시!',t:2.2,bad:true});}
  if(!ev444&&night_t>=242){ev444=true;noiseFxT=1.5;shake=6;fx.push({type:'alert',txt:'4:44 — 무언가 온다',t:2.2,bad:true});const n=2+Math.min(3,Math.floor(day/2));for(let i=0;i<n;i++)spawnRunner();}
  if(!ev555&&night_t>=408){ev555=true;fx.push({type:'alert',txt:'5:55 — 최종 러시!',t:2.2,bad:true});for(const z of zombies)z.speed*=1.3;}
  if(noiseFxT>0)noiseFxT-=dt;
  let interval=Math.max(CFG.SPAWN_MIN, CFG.SPAWN_BASE-night_t*CFG.SPAWN_RAMP-(day-1)*CFG.SPAWN_DAY);
  const nb=Math.min(0.30,Math.floor(noisePrev/10)*0.01); interval/=(1+nb);      // 전날 소음 → 오늘 스폰 가속
  if(ev333&&night_t<107)interval*=0.5;                                          // 3:33 러시 30초
  if(ev555)interval=CFG.SPAWN_MIN;                                              // 최종 러시
  if(blackout)interval/=0.3;                                                    // v4: 소등의 밤 — 웨이브 70% 감소
  spawnAcc+=dt; while(spawnAcc>interval){spawnAcc-=interval;spawnZombie();}

  if(player.ladCd>0)player.ladCd-=dt;
  // ---- 씬별 플레이어 조작 ----
  if(scene!=='1F'){ updateSub(dt); }
  else {
  player.away=false;
  if(player.downT>0){ player.downT-=dt; player.away=true;
    if(player.downT<=0){player.hp=Math.round(player.maxhp*0.5);fx.push({type:'float',x:player.x,y:player.y-30,txt:'다시 일어난다!',col:'#7ED8A8',t:1});} }
  else {
  // ---- player (1층) ----
  const[dx,dy]=inp(); player.moving=(dx||dy)?true:false;
  if(player.moving){player.phase+=dt*11;player.x+=dx*player.speed*dt;player.y+=dy*player.speed*dt;
    if(Math.abs(dx)>Math.abs(dy)){player.face='side';player.flip=dx>0;}else if(dy<0)player.face='back';else player.face='front';}
  collide(player);
  // 사다리→옥상 / 벙커입구→지하 진입
  if(player.ladCd<=0 && LAD && player.x>LAD.x-6&&player.x<LAD.x+LAD.w+6&&player.y>LAD.y-6&&player.y<LAD.y+LAD.h+6){
    scene='roof'; player.away=true; player.ladCd=0.8; player.rx=ROOF.down.x; player.ry=ROOF.down.y+50; }
  if(player.ladCd<=0 && BUNK && player.x>BUNK.x&&player.x<BUNK.x+BUNK.w&&player.y>BUNK.y&&player.y<BUNK.y+BUNK.h){
    scene='bunker'; player.away=true; player.ladCd=0.8; player.rx=BUNKW.up.x; player.ry=BUNKW.up.y+60; }
  if(player.hurtCd>0)player.hurtCd-=dt; if(player.painT>0)player.painT-=dt; if(player.swingT>0)player.swingT-=dt; if(player.lungeT>0)player.lungeT-=dt;
  // attack
  player.cdLeft-=dt;
  if(player.cdLeft<=0){let hit=false,nd=1e9,ndir=0;
    for(const z of zombies){const d=Math.hypot(z.x-player.x,z.y-player.y);if(d<player.atkR+z.r&&losClear(player.x,player.y,z.x,z.y)){z.hp-=Math.round(((player.eDmg||player.dmg)+(player.skillDmg||0))*moraleAtk());hit=true;const a=Math.atan2(z.y-player.y,z.x-player.x);z.x+=Math.cos(a)*10;z.y+=Math.sin(a)*10;if(d<nd){nd=d;ndir=a;}}}
    if(hit){player.cdLeft=player.atkCd;player.swingT=0.22;player.swingDir=ndir;player.lungeT=0.15;freeze=0.03;}else player.cdLeft=0.08;}
  // repair
  player.repairing=null;
  for(const en of ENTRIES){ if(en.barr.hp<en.barr.max && Math.hypot(player.x-en.cx,player.y-en.cy)<48){
    let danger=false; for(const z of zombies)if(Math.hypot(z.x-en.cx,z.y-en.cy)<50){danger=true;break;}
    if(!danger){en.barr.hp=Math.min(en.barr.max,en.barr.hp+CFG.P_REPAIR*dt);player.repairing=en;} break; }}
  // 치료 (서연=간호사): 반경 내 부상 동료 체력 회복 (다운 회복 가속은 동료 루프에서)
  player.healing=false;
  for(const a of allies){ if(a.down>0)continue;
    if(a.hp<a.maxhp && Math.hypot(a.x-player.x,a.y-player.y)<(player.healR||CFG.HEAL_R)){
      a.hp=Math.min(a.maxhp,a.hp+(CFG.HEAL_RATE+(player.healBonus||0))*(blackout?0.5:1)*dt); player.healing=true;
      if(a.healFx===undefined||a.healFx<=0){a.healFx=0.6;fx.push({type:'float',x:a.x,y:a.y-26,txt:'+치료',col:'#7ED8A8',t:0.8});}
    } }
  for(const a of allies){ if(a.healFx>0)a.healFx-=dt; }

  } // else(중상 아님)
  } // end 1F player block

  // ---- allies ----
  // 능동 요격: 거점 반경 ENGAGE 안 좀비를 상대. STRAY 이상 벗어나면 복귀(거점 너무 안 떠나게)
  const moveTo=(a,tx,ty,near)=>{const d=Math.hypot(tx-a.x,ty-a.y);if(d>near){a.moving=true;a.phase+=dt*10;a.x+=(tx-a.x)/d*a.spd*dt;a.y+=(ty-a.y)/d*a.spd*dt;}return d;};
  // 거점으로 갈 땐 벽-거리장으로 벽 우회(창문 등 벽 뒤 거점도 도달)
  const goHold=(a,en,gx,gy,near)=>{const d=Math.hypot(gx-a.x,gy-a.y);if(d>near){a.moving=true;a.phase+=dt*10;allyGoto(a,en.fieldA,gx,gy,dt);}return d;};
  for(const a of allies){
    if(a.work&&a.work!=='combat')continue; // 시설근무/휴식 = 밤에 야전 미참여
    if(a.down>0){ // 중상 → 시간 지나면 다시 일어남. 서연 곁이면 훨씬 빨리 + 더 많은 체력으로
      const nearS=!player.away&&Math.hypot(a.x-player.x,a.y-player.y)<CFG.HEAL_R;
      a.down-=dt*(nearS?1+CFG.REVIVE_BOOST:1);
      if(a.down<=0){a.hp=Math.round(a.maxhp*(nearS?CFG.REVIVE_HP_NEAR:0.5));}
      continue; }
    if(a.hitCd>0)a.hitCd-=dt; if(a.swingT>0)a.swingT-=dt; a.cdLeft-=dt; a.moving=false;
    if(laststand){ const rp={x:BUNK.x+BUNK.w/2,y:BUNK.y+BUNK.h+40};   // v3: 배수진 — 벙커 계단 앞
      a.onRoof=false;
      let tg=null,td2=1e9;for(const z of zombies){const d=Math.hypot(z.x-a.x,z.y-a.y);if(d<td2){td2=d;tg=z;}}
      const RNG2=a.eRng||a.rng, far=Math.hypot(a.x-rp.x,a.y-rp.y)>140;
      if(far){moveTo(a,rp.x,rp.y,40);}
      else if(tg&&td2>RNG2+tg.r){moveTo(a,tg.x,tg.y,RNG2+tg.r);}
      else if(tg&&a.cdLeft<=0){a.cdLeft=(a.eCd||a.cd);tg.hp-=(a.eDmg||a.dmg);a.swingT=0.2;a.swingDir=Math.atan2(tg.y-a.y,tg.x-a.x);
        if(a.eRanged){fx.push({type:'shot',x1:a.x,y1:a.y-10,x2:tg.x,y2:tg.y,t:0.1});addRipple(a.x,a.y,60,1);}}
      collideW(a); continue; }
    if(a.post==='roof'){ // 옥상 저격: 광역 사격, 근접 안전, 이동 없음
      a.onRoof=true; const idx=allies.indexOf(a); a.x=720+((idx%3)-1)*46; a.y=250; a.face='front';
      // 옥상=낮은 벽이라 벽 무시하고 사격(LOS X), 대신 사거리는 본인 사거리로 제한
      const RR=a.eRng||a.rng; let tg=null,td=1e9; for(const z of zombies){ const d=Math.hypot(z.x-a.x,z.y-a.y); if(d<RR&&d<td){td=d;tg=z;} }
      if(tg&&a.cdLeft<=0){ a.cdLeft=(a.eCd||a.cd); tg.hp-=(a.eDmg||a.dmg); a.swingT=0.2; a.swingDir=Math.atan2(tg.y-a.y,tg.x-a.x);
        fx.push({type:'shot',x1:a.x,y1:a.y-10,x2:tg.x,y2:tg.y,t:0.12}); addRipple(a.x,a.y,60,1); }
      continue;
    }
    a.onRoof=false;
    const post=(typeof a.post==='number'&&a.post<ENTRIES.length)?ENTRIES[a.post]:null;
    const hold=post?post.inP:null;
    if(a.key==='mansu'){ // 설비기사: 근처 좀비는 렌치로 요격, 없으면 배치 거점 수리
      const ENGAGE=210, STRAY=175;
      let tg=null,td=1e9;
      for(const z of zombies){ const dp=post?Math.hypot(z.x-post.cx,z.y-post.cy):0; if(post&&dp>ENGAGE)continue;
        const key=post?dp:Math.hypot(z.x-a.x,z.y-a.y); if(key<td){td=key;tg=z;} }
      if(tg){ td=Math.hypot(tg.x-a.x,tg.y-a.y);
        const needMove=td>a.rng+tg.r, tooFar=post&&Math.hypot(a.x-post.cx,a.y-post.cy)>STRAY;
        if(needMove&&tooFar){ if(hold)goHold(a,post,hold.x,hold.y,20); }
        else if(needMove){ moveTo(a,tg.x,tg.y,a.rng+tg.r); }
        else if(a.cdLeft<=0&&losClear(a.x,a.y,tg.x,tg.y)){a.cdLeft=(a.eCd||a.cd);tg.hp-=(a.eDmg||a.dmg);a.swingT=0.2;a.swingDir=Math.atan2(tg.y-a.y,tg.x-a.x);}
      } else { // 좀비 없음 → 수리(배치 거점 우선, 없으면 가장 약한 곳)
        const w=(post&&post.barr.hp<post.barr.max)?post:weakest();
        if(w&&w.barr.hp<w.barr.max){ if(goHold(a,w,w.inP.x,w.inP.y,26)<=26) w.barr.hp=Math.min(w.barr.max,w.barr.hp+(CFG.MANSU_REPAIR+(a.eRepair||0)+(a.skillRepair||0))/moraleCd()*dt); }
        else if(hold){ goHold(a,post,hold.x,hold.y,20); }
      }
      collideW(a); continue;
    }
    // 전투: 거점 배치면 거점 반경 안 좀비 능동 요격. 거점에 가장 가까운(=제일 위협적인) 좀비 우선.
    const RNG=(a.eRng||a.rng)+(a.skillRng||0), DMG=Math.round(((a.eDmg||a.dmg)+(a.skillDmg||0))*moraleAtk()), CDv=(a.eCd||a.cd)*(a.skillCd||1)*moraleCd();
    const ENGAGE = a.eRanged ? Math.max(240, RNG+20) : 210;  // 요격 반경(원거리는 넓게)
    const STRAY  = a.eRanged ? 70 : 175;                      // 거점서 이만큼 넘게 벗어나면 복귀(자리 지킴)
    let tg=null,td=1e9;
    for(const z of zombies){ const dp=post?Math.hypot(z.x-post.cx,z.y-post.cy):0; if(post&&dp>ENGAGE)continue;
      if(a.eRanged&&!losClear(a.x,a.y,z.x,z.y))continue;      // 원거리는 벽 너머 못 쏨
      const key=post?dp:Math.hypot(z.x-a.x,z.y-a.y); if(key<td){td=key;tg=z;} }
    if(tg){ td=Math.hypot(tg.x-a.x,tg.y-a.y);   // 실제 사거리 판정은 나-좀비 거리로
      const needMove=td>RNG+tg.r, tooFar=post&&Math.hypot(a.x-post.cx,a.y-post.cy)>STRAY;
      if(needMove&&tooFar){ if(hold)goHold(a,post,hold.x,hold.y,20); }   // 너무 멀어졌으면 복귀 우선
      else if(needMove){ moveTo(a,tg.x,tg.y,RNG+tg.r); }              // 나가서 접근
      else if(a.cdLeft<=0&&losClear(a.x,a.y,tg.x,tg.y)){a.cdLeft=CDv;tg.hp-=DMG;a.swingT=0.2;a.swingDir=Math.atan2(tg.y-a.y,tg.x-a.x);
        if(a.eRanged){fx.push({type:'shot',x1:a.x,y1:a.y-10,x2:tg.x,y2:tg.y,t:0.1});addRipple(a.x,a.y,60,1);}}
    } else if(hold){ goHold(a,post,hold.x,hold.y,20); } // 위협 없으면 거점 복귀
    collideW(a);
  }

  // ---- zombies ----
  for(let i=zombies.length-1;i>=0;i--){
    const z=zombies[i]; z.bob+=dt*6; if(z.hitCd>0)z.hitCd-=dt;
    // 목표 = 가장 가까운 사람(서연/동료)
    let T=null, td=1e9; if(!player.away){T={x:player.x,y:player.y};td=Math.hypot(player.x-z.x,player.y-z.y);}
    for(const a of allies){if(a.down>0)continue;const d=Math.hypot(a.x-z.x,a.y-z.y);if(d<td){td=d;T={x:a.x,y:a.y};}}
    if(!T){T={x:CENTER.x,y:CENTER.y};}
    if(z.lureT>0){ z.lureT-=dt; T={x:z.lure.x,y:z.lure.y}; }   // v3: 파문에 홀린 상태
    if(z.inside){
      stepToward(z, T.x, T.y, dt, false);   // 안에 들어왔으면 사람 추격
    } else {
      // 사람에게 가는 최선의 출입구 선택 (이미 뚫린 문 강하게 선호 → 새 바리케이드 안 갉음)
      let en=null,bc=1e9;
      if(z.kind==='runner'&&z.entry&&z.entry.isWin){ en=z.entry; }
      else { for(const e of ENTRIES){const c=Math.hypot(z.x-e.cx,z.y-e.cy)+Math.hypot(e.inP.x-T.x,e.inP.y-T.y)+(e.barr.hp>0?260:0);if(c<bc){bc=c;en=e;}} }
      z.entry=en;
      // 문 사각형까지 거리 — 어느 쪽에서 와도 문에 닿으면 두드림/진입
      const rr=en.rect, cxp=Math.max(rr.x,Math.min(rr.x+rr.w,z.x)), cyp=Math.max(rr.y,Math.min(rr.y+rr.h,z.y));
      const dDoor=Math.hypot(z.x-cxp,z.y-cyp);
      if(en.barr.hp>0){
        if(dDoor>z.r+6){stepFlow(z, en, dt, true);}
        else {const was=en.barr.hp;en.barr.hp-=(CFG.GNAW+day*CFG.GNAW_DAY)*dt;   // 문 앞 도착 → 부수는 중
          if(was>0&&en.barr.hp<=0){en.barr.hp=0;shake=6;fx.push({type:'alert',txt:en.name+' 뚫림!',t:1.4,bad:true});}}
      } else {
        if(dDoor>z.r+6){stepFlow(z, en, dt, false);}
        else if(en.isWin && z.climb<(z.climbNeed||CFG.WINDOW_CLIMB)){ z.climb+=dt; }
        else { z.x=en.inP.x; z.y=en.inP.y; z.inside=true; }
      }
    }
    // 플레이어 타격
    const pd=player.away?1e9:Math.hypot(z.x-player.x,z.y-player.y);
    if(pd<z.r+player.r&&z.hitCd<=0){z.hitCd=0.8;if(player.hurtCd<=0){player.hp-=(13+day*1.5);player.hurtCd=0.35;player.painT=0.5;const ka=Math.atan2(player.y-z.y,player.x-z.x);player.x+=Math.cos(ka)*14;player.y+=Math.sin(ka)*14;collide(player);shake=5;}}
    // 동료 타격
    for(const a of allies){if(a.down>0||a.post==='roof'||(a.work&&a.work!=='combat'))continue;const ad=Math.hypot(z.x-a.x,z.y-a.y);if(ad<z.r+a.r&&z.hitCd<=0){z.hitCd=0.8;a.hp-=(11+day*1.2);
      if(a.hp<=0){a.hp=0;
        if(a.mortal){ // v4: 합류 생존자는 영구 사망 → 추모벽
          memorial.push({key:a.key,nm:a.nm,memo:a.memo,from:a.joinDay,to:day});
          allies.splice(allies.indexOf(a),1);
          fx.push({type:'alert',txt:a.nm+' 사망…',t:3,bad:true}); shake=7; addMorale(-15,'사기');
          recomputeCombos(); continue;
        } else a.down=10; }}}
    if(z.hp<=0){kills++;totalKills++;fx.push({type:'pop',x:z.x,y:z.y,t:0.3});
      const rr=Math.random();
      const foodRate = has('c_b1')?0.16:0.10;
      const kind = rr<foodRate?'food' : rr<foodRate+0.08?'medkit' : 'xp';   // 좀비 드랍
      gems.push({x:z.x,y:z.y,kind,vx:(Math.random()*40-20),vy:(Math.random()*40-20),t:0});
      zombies.splice(i,1);}
  }

  // ===== v3: 파문 링 갱신 =====
  for(let i=ripples.length-1;i>=0;i--){const rp=ripples[i];const pr=rp.r;rp.r+=300*dt;
    for(const z of zombies){const d=Math.hypot(z.x-rp.x,z.y-rp.y);if(d>pr&&d<=Math.min(rp.r,rp.max)){z.lureT=4;z.lure={x:rp.x,y:rp.y};}}
    if(rp.r>=rp.max)ripples.splice(i,1);}
  // ===== v3: 최후의 저항 — 전 거점 붕괴 + 내부 15체 =====
  if(!laststand&&!lsDone&&ENTRIES.every(e=>e.barr.hp<=0)&&zombies.filter(z=>z.inside).length>=15){
    laststand=true;lsT=30;shake=8;fx.push({type:'alert',txt:'전 거점 붕괴 — 벙커 앞으로!! 최후의 저항!',t:3,bad:true});}
  if(laststand){lsT-=dt;
    if(lsT<=0){laststand=false;lsDone=true;fx.push({type:'alert',txt:'버텼다…! 동이 튼다',t:3});night_t=CFG.NIGHT_SEC;}
    else if(player.downT>0){const alive=allies.some(a=>(!a.work||a.work==='combat')&&a.down<=0);
      if(!alive)return gameOver('안심24 함락 — 마지막까지 함께였다');}}

  // ---- 드랍 아이템 줍기 ----
  for(let i=gems.length-1;i>=0;i--){
    const g=gems[i]; g.t+=dt;
    if(g.vx){g.x+=g.vx*dt;g.y+=g.vy*dt;g.vx*=0.9;g.vy*=0.9;}
    const d=Math.hypot(g.x-player.x,g.y-player.y);
    if(d<player.pickR){ g.x+=(player.x-g.x)*8*dt; g.y+=(player.y-g.y)*8*dt; }
    if(d<16){
      if(g.kind==='xp') gainXp();
      else if(g.kind==='food'){ food++; fx.push({type:'float',x:player.x,y:player.y-24,txt:'+식량',col:'#7ED8A8',t:0.9}); }
      else { player.hp=Math.min(player.maxhp,player.hp+15); fx.push({type:'float',x:player.x,y:player.y-24,txt:'+치료',col:'#FF9EB5',t:0.9}); }
      gems.splice(i,1);
    }
  }
  for(let i=fx.length-1;i>=0;i--){fx[i].t-=dt;if(fx[i].t<=0)fx.splice(i,1);}
  for(let i=moraleFx.length-1;i>=0;i--){moraleFx[i].t-=dt;if(moraleFx[i].t<=0)moraleFx.splice(i,1);}
  if(player.hp<=0&&player.downT<=0){player.hp=0;player.downT=10;
    fx.push({type:'alert',txt:'서연 중상! 10초 후 회복',t:2.5,bad:true});}   // v3: 코어 불사 — 다운만
  if(night_t>=CFG.NIGHT_SEC)return morning();
}
function morning(){
  // v4: SP 획득 — 생존 +1, 30킬↑ +1
  let gain=1+(kills>=30?1:0); sp+=gain;
  moraleFx.push({txt:'SP +'+gain,col:'#C08BFF',t:2.4});
  // 일지 수집 — 하루 최대 1장, 40% 확률
  if(journals<12&&Math.random()<0.4){ journals++;
    const lv=journals>=12?4:journals>=7?3:journals>=3?2:1;
    if(lv>keyLevel){ keyLevel=lv; fx.push({type:'alert',txt:'카드키 권한 '+lv+' 획득 — 새 구역 해금!',t:3.2}); }
    else fx.push({type:'alert',txt:'점장의 일지 '+journals+'/12장',t:2.2});
  }
  // v4: 밤 결과 사기 정산
  if(blackout){ addMorale(prevBlackout?-20:-10,'소등'); food=Math.max(0,Math.round(food*0.85)); }
  else if(kills>=30) addMorale(10,'격퇴');
  prevBlackout=blackout;
  state='dawn';dawnT=0;}
let morningInfo={};
// ===== v4: 추모벽 화면 =====
function drawMemorial(){
  const m=memorialView;
  cx.fillStyle='#0B0F18'; cx.fillRect(0,0,VW,VH);
  // 코르크 보드
  cx.fillStyle='#3A2C1E'; cx.fillRect(24,90,VW-48,VH-230);
  cx.strokeStyle='#5A452E'; cx.lineWidth=6; cx.strokeRect(24,90,VW-48,VH-230);
  cx.textAlign='center'; cx.fillStyle='#C9B27A'; cx.font='700 12px "Apple SD Gothic Neo",sans-serif';
  cx.fillText('벙커 · 추모벽',VW/2,64);
  // 기존 폴라로이드들
  const all=memorial;
  for(let i=0;i<all.length;i++){
    const col=i%3, row=Math.floor(i/3);
    const px=60+col*((VW-120)/3), py=130+row*120, isNew=(all[i]===m);
    cx.save(); cx.translate(px+34,py+42); cx.rotate((i%2?1:-1)*0.045); cx.translate(-34,-42);
    cx.fillStyle=isNew?'#F5EFE0':'#D8D2C4'; cx.fillRect(0,0,68,84);
    cx.fillStyle='#2A3346'; cx.fillRect(6,6,56,54);
    cx.fillStyle=isNew?'#8CA0B3':'#6a7688'; cx.font='700 9px "Apple SD Gothic Neo",sans-serif';
    cx.textAlign='center'; cx.fillText(all[i].nm,34,74);
    cx.fillStyle='rgba(220,210,190,0.85)'; cx.fillRect(22,-4,24,10); // 마스킹 테이프
    cx.restore();
  }
  if(m){
    cx.textAlign='center'; cx.fillStyle='#E8EFF7'; cx.font='900 17px "Apple SD Gothic Neo",sans-serif';
    cx.fillText(m.nm+' · D+'+m.from+'~D+'+m.to,VW/2,VH-150);
    cx.fillStyle='#C9B27A'; cx.font='13px "Apple SD Gothic Neo",sans-serif';
    cx.fillText('"'+m.memo+'"',VW/2,VH-124);
    cx.fillStyle='#8CA0B3'; cx.font='12px "Apple SD Gothic Neo",sans-serif';
    cx.fillText('서연: "…잘 자요."',VW/2,VH-98);
  }
  cx.fillStyle='#7FE3F0'; roundRect(VW/2-90,VH-72,180,44,10); cx.fill();
  cx.fillStyle='#08131a'; cx.font='900 15px "Apple SD Gothic Neo",sans-serif';
  cx.fillText('아침으로',VW/2,VH-44);
}
function memorialTap(lx,ly){
  if(lx>VW/2-90&&lx<VW/2+90&&ly>VH-72&&ly<VH-28){ if(memorialView&&!memorialView.seen){memorialView.seen=true;addMorale(5,'추모');} memorialView=null; state='morning'; }
}
function realMorning(){
  day++;
  // 밤새 정산: 시설근무=생산, 휴식=회복, 인원수만큼 식량 소모
  let foodProd=fac.farm*3, matProd=0;
  for(const a of allies){ if(a.work==='facility'){foodProd+=3;matProd+=2;} else if(a.work==='rest'){a.hp=a.maxhp;a.down=0;} }
  const head=allies.length+1, foodCons=head*2;
  food=Math.max(0,food+foodProd-foodCons); materials+=matProd;
  morningInfo={foodProd,foodCons,matProd,head,starve:(foodProd-foodCons<0&&food===0)};
  if(morningInfo.starve){ for(const a of allies)a.hp=Math.max(1,Math.round(a.hp*0.7)); addMorale(-10,'사기'); } // 굶주림 패널티
  recomputeCombos();
  // v4: 전날 사망자가 있으면 추모 화면 먼저
  const fresh=memorial.filter(m=>m.to===day-1);
  if(fresh.length){ memorialView=fresh[fresh.length-1]; state='memorial'; }
  else state='morning';
}
function gameOver(t){state='over';document.getElementById('oDday').textContent='D+'+day;document.getElementById('oTitle').textContent=t;document.getElementById('oStats').textContent=day+'일 밤까지 생존 · 처치 '+totalKills+' · 구출 '+totalRescued+' · 떠나보낸 '+memorial.length+'명 · 최종 사기 '+Math.round(morale);document.getElementById('over').classList.remove('hidden');}

function clock(){const tot=3*3600*(night_t/CFG.NIGHT_SEC);const h=3+Math.floor(tot/3600);const m=Math.floor((tot%3600)/60);return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
function drawChar(img,x,y,h,o){o=o||{};const w=h*img.naturalWidth/img.naturalHeight;const hop=o.hop||0;cx.fillStyle='rgba(0,0,0,0.35)';cx.beginPath();cx.ellipse(x,y+8,h*0.20,5,0,0,6.29);cx.fill();cx.save();cx.translate(x,y+hop);if(o.flip)cx.scale(-1,1);if(o.alpha!==undefined)cx.globalAlpha=o.alpha;if(o.gray)cx.filter='grayscale(1) brightness(.7)';cx.drawImage(img,-w/2,-h+14,w,h);cx.filter='none';cx.restore();}

function updateSub(dt){
  const[dx,dy]=inp(); player.moving=(dx||dy)?true:false;
  if(player.moving){player.phase+=dt*11;player.rx+=dx*player.speed*dt;player.ry+=dy*player.speed*dt;
    if(Math.abs(dx)>Math.abs(dy)){player.face='side';player.flip=dx>0;}else if(dy<0)player.face='back';else player.face='front';}
  if(scene==='roof'){
    const R=13;
    // ㄱ자 안(UP ∪ LO ∪ 연결통로 CONN)에만 있도록 — 밖이면 가장 가까운 구역으로 밀어넣음
    const zones=[ROOF.UP,ROOF.LO,ROOF.CONN];
    const inR=(r)=>player.rx>=r.x+R&&player.rx<=r.x+r.w-R&&player.ry>=r.y+R&&player.ry<=r.y+r.h-R;
    if(!zones.some(inR)){
      const cl=(r)=>({x:Math.max(r.x+R,Math.min(r.x+r.w-R,player.rx)),y:Math.max(r.y+R,Math.min(r.y+r.h-R,player.ry))});
      let best=null,bd=1e9;
      for(const r of zones){const c=cl(r);const d=Math.hypot(c.x-player.rx,c.y-player.ry);if(d<bd){bd=d;best=c;}}
      player.rx=best.x; player.ry=best.y;
    }
    // 오브젝트 막힘: 환기팬(원) + 물탱크/상자/환기구/모래주머니(사각)
    const solids=[ROOF.tank,{x:ROOF.crate.x-55,y:ROOF.crate.y-55,w:110,h:110}].concat(ROOF.hatches,ROOF.vents,ROOF.sand);
    for(let it=0;it<2;it++){
      for(const r of solids){
        const nx=Math.max(r.x,Math.min(r.x+r.w,player.rx)), ny=Math.max(r.y,Math.min(r.y+r.h,player.ry));
        let ddx=player.rx-nx,ddy=player.ry-ny,dd=Math.hypot(ddx,ddy);
        if(dd<R){ if(dd<0.001){ const dl=player.rx-r.x,dr=r.x+r.w-player.rx,dtp=player.ry-r.y,db=r.y+r.h-player.ry,m=Math.min(dl,dr,dtp,db);
            if(m===dl)player.rx=r.x-R;else if(m===dr)player.rx=r.x+r.w+R;else if(m===dtp)player.ry=r.y-R;else player.ry=r.y+r.h+R; }
          else{player.rx=nx+ddx/dd*R;player.ry=ny+ddy/dd*R;} }
      }
      // 환기팬(원형)
      const fx2=player.rx-ROOF.fan.x,fy2=player.ry-ROOF.fan.y,fd=Math.hypot(fx2,fy2),need=ROOF.fan.r+R;
      if(fd<need&&fd>0.001){player.rx=ROOF.fan.x+fx2/fd*need;player.ry=ROOF.fan.y+fy2/fd*need;}
    }
    if(player.ladCd<=0 && Math.hypot(player.rx-ROOF.down.x,player.ry-ROOF.down.y)<ROOF.down.r){ scene='1F'; player.ladCd=0.8; player.x=LAD.x+LAD.w/2; player.y=LAD.y+LAD.h+30; }
  } else { // bunker — 벽/가구 충돌
    const pe={x:player.rx,y:player.ry,r:13};
    for(let it=0;it<2;it++){
      const boxes=BWALL.map(w=>({x:w[0],y:w[1],w:w[2]-w[0],h:w[3]-w[1]})).concat(BFURN);
      for(const r of boxes){
        const nx=Math.max(r.x,Math.min(r.x+r.w,pe.x)), ny=Math.max(r.y,Math.min(r.y+r.h,pe.y));
        let ddx=pe.x-nx, ddy=pe.y-ny, dd=Math.hypot(ddx,ddy);
        if(dd<pe.r){ if(dd<0.001){const dl=pe.x-r.x,dr=r.x+r.w-pe.x,dt=pe.y-r.y,db=r.y+r.h-pe.y,m=Math.min(dl,dr,dt,db);
            if(m===dl)pe.x=r.x-pe.r;else if(m===dr)pe.x=r.x+r.w+pe.r;else if(m===dt)pe.y=r.y-pe.r;else pe.y=r.y+r.h+pe.r;}
          else{pe.x=nx+ddx/dd*pe.r; pe.y=ny+ddy/dd*pe.r;} }
      }
    }
    player.rx=Math.max(30,Math.min(BUNKW.w-30,pe.x)); player.ry=Math.max(30,Math.min(BUNKW.h-30,pe.y));
    if(player.ladCd<=0 && Math.hypot(player.rx-BUNKW.up.x,player.ry-BUNKW.up.y)<40){ scene='1F'; player.ladCd=0.8; player.x=BUNK.x+BUNK.w/2; player.y=BUNK.y+BUNK.h+30; }
  }
}
function renderSub(){
  const SW = scene==='roof'?ROOF.w:BUNKW.w, SH = scene==='roof'?ROOF.h:BUNKW.h;
  const vw=VW/ZOOM, vh=VH/ZOOM;
  const camX=Math.max(0,Math.min(Math.max(0,SW-vw),player.rx-vw/2)), camY=Math.max(0,Math.min(Math.max(0,SH-vh),player.ry-vh/2));
  cx.save(); cx.scale(ZOOM,ZOOM); cx.translate(-camX,-camY);
  if(scene==='roof'){
    const U=ROOF.UP,L=ROOF.LO;
    // ㄱ자 바닥(콘크리트, 쿨블루)
    cx.fillStyle='#4a586c'; cx.fillRect(U.x,U.y,U.w,U.h); cx.fillRect(L.x,L.y,L.w,L.h);
    cx.fillStyle='rgba(255,255,255,0.04)'; cx.fillRect(U.x+14,U.y+14,U.w-28,U.h-28); cx.fillRect(L.x+14,L.y+14,L.w-28,L.h-28);
    // ㄱ자 외곽 = 빛나는 난간
    cx.beginPath();
    cx.moveTo(645,72);cx.lineTo(998,72);cx.lineTo(998,518);cx.lineTo(915,518);cx.lineTo(915,1266);cx.lineTo(345,1266);cx.lineTo(345,518);cx.lineTo(645,518);cx.closePath();
    cx.save();cx.shadowColor='#7FE3F0';cx.shadowBlur=22;cx.strokeStyle='#cdeef3';cx.lineWidth=12;cx.stroke();
    cx.shadowBlur=0;cx.strokeStyle='#6b7c92';cx.lineWidth=4;cx.stroke();cx.restore();
    // 모래주머니(둥근 분절)
    for(const s of ROOF.sand){cx.fillStyle='#b8ad86';cx.strokeStyle='#8f8460';cx.lineWidth=2;
      const rows=Math.round(s.h/34),cols=Math.round(s.w/40);
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const bx=s.x+c*40+(r%2?18:0),by=s.y+r*32;cx.beginPath();cx.roundRect?cx.roundRect(bx,by,40,30,9):cx.rect(bx,by,40,30);cx.fill();cx.stroke();}}
    // 물탱크(원통 + 받침)
    {const t=ROOF.tank,cxp=t.x+t.w/2;cx.fillStyle='#6b7280';cx.fillRect(t.x+8,t.y+t.h-6,t.w-16,26); // 받침 다리
     cx.fillStyle='#aeb8c2';cx.beginPath();cx.ellipse(cxp,t.y+30,t.w/2,26,0,0,6.29);cx.fill();
     cx.fillStyle='#9aa5b1';cx.fillRect(t.x,t.y+30,t.w,t.h-30);
     cx.fillStyle='#c4cdd6';cx.beginPath();cx.ellipse(cxp,t.y+30,t.w/2,22,0,0,6.29);cx.fill();
     cx.strokeStyle='#7a838e';cx.lineWidth=2;cx.beginPath();cx.arc(cxp,t.y+30,14,0,6.29);cx.stroke();}
    // 환기구/채광 5 (어두운 패널 + 나무틀)
    for(const h of ROOF.hatches){cx.fillStyle='#8a6a3a';cx.fillRect(h.x-4,h.y-4,h.w+8,h.h+8);cx.fillStyle='#3a4250';cx.fillRect(h.x,h.y,h.w,h.h);
      cx.strokeStyle='#2b323d';cx.lineWidth=1;for(let gy=h.y+8;gy<h.y+h.h;gy+=10){cx.beginPath();cx.moveTo(h.x,gy);cx.lineTo(h.x+h.w,gy);cx.stroke();}}
    // 우측 세로 환기구 2
    for(const v of ROOF.vents){cx.fillStyle='#8a6a3a';cx.fillRect(v.x-3,v.y-3,v.w+6,v.h+6);cx.fillStyle='#3a4250';cx.fillRect(v.x,v.y,v.w,v.h);}
    // 안테나(X자 다이폴)
    {const a=ROOF.antenna;cx.strokeStyle='#9fb0c0';cx.lineWidth=5;cx.beginPath();cx.moveTo(a.x,a.y+70);cx.lineTo(a.x,a.y-40);cx.stroke();
     cx.lineWidth=3;for(const off of [-14,0,14]){cx.beginPath();cx.moveTo(a.x-34,a.y-30+off);cx.lineTo(a.x+34,a.y-30-off);cx.stroke();cx.beginPath();cx.moveTo(a.x-34,a.y-30-off);cx.lineTo(a.x+34,a.y-30+off);cx.stroke();}}
    // 환기팬(둥근 대형 유닛)
    {const f=ROOF.fan;cx.fillStyle='#7f8a97';cx.fillRect(f.x-f.r-6,f.y-f.r-6,(f.r+6)*2,(f.r+6)*2);
     cx.strokeStyle='#5a6472';cx.lineWidth=3;cx.strokeRect(f.x-f.r-6,f.y-f.r-6,(f.r+6)*2,(f.r+6)*2);
     cx.fillStyle='#aeb8c2';cx.beginPath();cx.arc(f.x,f.y,f.r,0,6.29);cx.fill();
     cx.strokeStyle='#6b7480';cx.lineWidth=4;for(let k=0;k<6;k++){const ang=k*Math.PI/3;cx.beginPath();cx.moveTo(f.x,f.y);cx.lineTo(f.x+Math.cos(ang)*f.r*0.9,f.y+Math.sin(ang)*f.r*0.9);cx.stroke();}
     cx.fillStyle='#8a939e';cx.beginPath();cx.arc(f.x,f.y,10,0,6.29);cx.fill();}
    // 보급상자
    {const c=ROOF.crate;cx.fillStyle='#cfd6de';cx.strokeStyle='#8b96a2';cx.lineWidth=4;cx.fillRect(c.x-46,c.y-46,92,92);cx.strokeRect(c.x-46,c.y-46,92,92);
     cx.strokeStyle='#aab4bf';cx.lineWidth=3;for(let gx=c.x-34;gx<c.x+40;gx+=16){cx.beginPath();cx.moveTo(gx,c.y-40);cx.lineTo(gx,c.y+40);cx.stroke();}
     cx.fillStyle='#FFC24B';cx.font='700 15px "Apple SD Gothic Neo",sans-serif';cx.textAlign='center';cx.fillText('보급상자',c.x,c.y-54);}
    // ↓ 1층 해치(빛나는 사각)
    {const d=ROOF.down;cx.save();cx.shadowColor='#7FE3F0';cx.shadowBlur=16;cx.fillStyle='rgba(127,227,240,0.30)';cx.fillRect(d.x-30,d.y-30,60,60);cx.strokeStyle='#7FE3F0';cx.lineWidth=4;cx.strokeRect(d.x-30,d.y-30,60,60);cx.restore();
     cx.fillStyle='#7FE3F0';cx.font='700 15px "Apple SD Gothic Neo",sans-serif';cx.textAlign='center';cx.fillText('↓ 1층으로',d.x,d.y-40);}
  } else {
    // 바닥(콘크리트) + 웜 조명 웅덩이
    cx.fillStyle='#3a3730'; cx.fillRect(0,0,SW,SH);
    cx.fillStyle='#4a4438'; cx.fillRect(58,58,SW-116,SH-116);
    for(const [lx,ly] of [[360,200],[740,540],[340,960],[880,900],[900,180]]){
      const g=cx.createRadialGradient(lx,ly,10,lx,ly,180); g.addColorStop(0,'rgba(255,224,170,0.22)'); g.addColorStop(1,'rgba(255,224,170,0)');
      cx.fillStyle=g; cx.fillRect(lx-180,ly-180,360,360);
    }
    // 가구
    for(const f of BFURN){
      cx.fillStyle=f.c; cx.fillRect(f.x,f.y,f.w,f.h);
      cx.strokeStyle='rgba(0,0,0,0.45)';cx.lineWidth=2;cx.strokeRect(f.x,f.y,f.w,f.h);
      if(f.cage){ cx.strokeStyle='rgba(220,225,230,0.5)';cx.lineWidth=1;
        for(let gx=f.x+8;gx<f.x+f.w;gx+=14)for(let gy=f.y+8;gy<f.y+f.h;gy+=14){cx.strokeRect(gx-4,gy-4,8,8);}
        cx.fillStyle='#5a3a2a'; for(let k=0;k<4;k++)cx.fillRect(f.x+20+k*40,f.y+30,26,8); // 총 실루엣
      }
      if(f.gen){ cx.fillStyle='#FFC24B'; for(let k=0;k<3;k++){cx.beginPath();cx.arc(f.x+40+k*45,f.y+40,10,0,6.29);cx.stroke();}
        cx.fillStyle='#e0b030';cx.fillRect(f.x+10,f.y+f.h-16,f.w-20,8); } // 경고 줄
      if(f.bed){ cx.fillStyle='#8a7a5a';cx.fillRect(f.x+8,f.y+10,f.w-16,24); cx.fillStyle='#6a6a80';cx.fillRect(f.x+8,f.y+50,f.w-16,24); cx.fillRect(f.x+8,f.y+90,f.w-16,24);} // 3층
      if(f.board){ cx.strokeStyle='#c04040';cx.lineWidth=1.5;cx.beginPath();cx.moveTo(f.x+10,f.y+10);cx.lineTo(f.x+f.w-10,f.y+f.h-10);cx.moveTo(f.x+f.w-10,f.y+10);cx.lineTo(f.x+10,f.y+f.h-10);cx.stroke();}
      if(f.memorial){ cx.fillStyle='#cfc8b8'; for(let mx=0;mx<3;mx++)for(let my=0;my<4;my++)cx.fillRect(f.x+8+mx*28,f.y+8+my*30,20,22);}
    }
    // 방 벽
    for(const w of BWALL){ cx.fillStyle='#5b5648'; cx.fillRect(w[0],w[1],w[2]-w[0],w[3]-w[1]); }
    // 방 라벨
    cx.textAlign='center';
    for(const r of BROOMS){ cx.fillStyle='#f0e6d0';cx.font='700 22px "Apple SD Gothic Neo",sans-serif';cx.fillText(r.n,r.x,r.y);
      if(r.en){cx.fillStyle='#b0a888';cx.font='13px sans-serif';cx.fillText(r.en,r.x,r.y+18);} }
    // 금고문(빨간불)
    cx.fillStyle='#8a93a0';cx.beginPath();cx.arc(BVAULT.x,BVAULT.y,BVAULT.r,0,6.29);cx.fill();
    cx.strokeStyle='#5a626c';cx.lineWidth=4;cx.beginPath();cx.arc(BVAULT.x,BVAULT.y,BVAULT.r,0,6.29);cx.stroke();
    cx.fillStyle='#FF3030';cx.shadowColor='#FF3030';cx.shadowBlur=10;cx.beginPath();cx.arc(BVAULT.x,BVAULT.y-BVAULT.r-6,6,0,6.29);cx.fill();cx.shadowBlur=0;
    cx.fillStyle='#FF7A7A';cx.font='12px sans-serif';cx.fillText('금고문(???)',BVAULT.x,BVAULT.y+BVAULT.r+16);
    // 계단(복귀)
    cx.fillStyle='#b6c2cd';cx.fillRect(BUNKW.up.x-34,BUNKW.up.y-40,68,80);
    cx.strokeStyle='#7a838e';cx.lineWidth=2;for(let sy=BUNKW.up.y-36;sy<BUNKW.up.y+40;sy+=12){cx.beginPath();cx.moveTo(BUNKW.up.x-34,sy);cx.lineTo(BUNKW.up.x+34,sy);cx.stroke();}
    cx.fillStyle='#7FE3F0';cx.font='700 14px "Apple SD Gothic Neo",sans-serif';cx.fillText('↑ 1층으로',BUNKW.up.x,BUNKW.up.y-48);
  }
  // 플레이어
  const img=SPR[player.face]||SPR.front;
  if(img.complete&&img.naturalWidth){const h=62,w=h*img.naturalWidth/img.naturalHeight;const hop=player.moving?-Math.abs(Math.sin(player.phase))*5:0;
    cx.fillStyle='rgba(0,0,0,0.35)';cx.beginPath();cx.ellipse(player.rx,player.ry+8,14,5,0,0,6.29);cx.fill();
    cx.save();cx.translate(player.rx,player.ry+hop);if(player.face==='side'&&player.flip)cx.scale(-1,1);cx.drawImage(img,-w/2,-h+14,w,h);cx.restore();}
  cx.restore();
  // 하단 안내
  cx.fillStyle='rgba(10,14,23,.8)';cx.fillRect(0,VH-34,VW,34);
  cx.fillStyle='#8CA0B3';cx.font='13px "Apple SD Gothic Neo",sans-serif';cx.textAlign='center';
  cx.fillText(scene==='roof'?'옥상 — 표시 지점에서 ↓ 1층 복귀 (아래층은 동료가 방어중)':'지하 벙커 — 계단에서 ↑ 1층 복귀',VW/2,VH-12);
}
function render(){
  cx.fillStyle='#07090f';cx.fillRect(0,0,VW,VH);
  if(state==='assign'){ drawAssign(); return; }
  if(state==='morning'){ drawMorning(); return; }
  if(state==='expedition'){ drawExpedition(); return; }
  if(state==='memorial'){ drawMemorial(); return; }
  if(state==='skill'){ drawSkill(); return; }
  if(scene!=='1F'){ renderSub(); drawHUDmini(); return; }
  const vw=VW/ZOOM, vh=VH/ZOOM;
  const camX=Math.max(0,Math.min(WW-vw,player.x-vw/2)),camY=Math.max(0,Math.min(WH-vh,player.y-vh/2));
  cx.save(); if(shake>0){const s=Math.min(shake,3);cx.translate((Math.random()*2-1)*s,(Math.random()*2-1)*s);} cx.scale(ZOOM,ZOOM); cx.translate(-camX,-camY);
  if(BG.complete&&BG.naturalWidth)cx.drawImage(BG,0,0,WW,WH);
  // 밤 어둠
  const prog=night_t/CFG.NIGHT_SEC; cx.fillStyle='rgba(6,10,26,'+((blackout?0.72:0.40)*Math.sin(Math.min(1,prog)*Math.PI))+')'; cx.fillRect(camX,camY,vw,vh);
  // 바리케이드 그리기 (출입구)
  for(const en of ENTRIES){const o=en.rect;const rt=en.barr.hp/en.barr.max;
    if(rt>0){cx.fillStyle='rgba(201,169,106,'+(0.45+0.5*rt)+')';cx.fillRect(o.x,o.y,o.w,o.h);cx.strokeStyle='rgba(90,70,35,'+(0.5+0.5*rt)+')';cx.lineWidth=2;cx.strokeRect(o.x,o.y,o.w,o.h);}
    // hp bar
    cx.fillStyle='#20293D';cx.fillRect(en.cx-20,o.y-9,40,4);cx.fillStyle=rt>0.5?(en.isWin?'#7FB0FF':'#FFC24B'):'#FF5A5A';cx.fillRect(en.cx-20,o.y-9,40*Math.max(0,rt),4);
    cx.font='9px sans-serif';cx.fillStyle=en.isWin?'#9cc4ff':'#8CA0B3';cx.textAlign='center';cx.fillText(en.name,en.cx,o.y-12);
    if(showDbg){cx.strokeStyle='rgba(120,255,140,.6)';cx.beginPath();cx.arc(en.outP.x,en.outP.y,5,0,6.29);cx.stroke();}
  }
  if(BUNK){cx.strokeStyle='rgba(34,211,192,0.9)';cx.lineWidth=2;cx.strokeRect(BUNK.x,BUNK.y,BUNK.w,BUNK.h);cx.fillStyle='#22D3C0';cx.font='9px sans-serif';cx.textAlign='center';cx.fillText('벙커(회복)',BUNK.x+BUNK.w/2,BUNK.y-4);}
  if(LAD){cx.strokeStyle='rgba(192,139,255,0.9)';cx.lineWidth=2;cx.strokeRect(LAD.x,LAD.y,LAD.w,LAD.h);cx.fillStyle='#C08BFF';cx.font='9px sans-serif';cx.textAlign='center';cx.fillText('옥상 사다리',LAD.x+LAD.w/2,LAD.y-4);}
  if(showDbg){cx.lineWidth=1.5;for(const r of BLOCK){cx.strokeStyle=r.t==='창문'?'rgba(90,170,255,.8)':r.t==='사물'?'rgba(255,160,40,.8)':'rgba(255,60,60,.8)';cx.strokeRect(r.x,r.y,r.w,r.h);}}
  // 드랍 아이템
  for(const g of gems){
    if(g.kind==='xp'){cx.save();cx.translate(g.x,g.y);cx.rotate(0.785);cx.fillStyle='#7FE3F0';cx.shadowColor='#7FE3F0';cx.shadowBlur=8;cx.fillRect(-5,-5,10,10);cx.restore();cx.shadowBlur=0;}
    else if(g.kind==='food'){cx.fillStyle='#7ED8A8';cx.shadowColor='#7ED8A8';cx.shadowBlur=6;cx.beginPath();cx.arc(g.x,g.y,6,0,6.29);cx.fill();cx.shadowBlur=0;cx.fillStyle='#0A0E17';cx.font='8px sans-serif';cx.textAlign='center';cx.fillText('밥',g.x,g.y+3);}
    else {cx.fillStyle='#FF9EB5';cx.shadowColor='#FF9EB5';cx.shadowBlur=6;cx.fillRect(g.x-6,g.y-6,12,12);cx.shadowBlur=0;cx.strokeStyle='#fff';cx.lineWidth=1.5;cx.beginPath();cx.moveTo(g.x,g.y-3);cx.lineTo(g.x,g.y+3);cx.moveTo(g.x-3,g.y);cx.lineTo(g.x+3,g.y);cx.stroke();}
  }
  // 좀비
  for(const z of zombies){const bob=Math.sin(z.bob)*2;const climbing=(!z.inside&&z.entry.isWin&&z.entry.barr.hp<=0&&z.climb>0&&z.climb<(z.climbNeed||CFG.WINDOW_CLIMB));
    cx.fillStyle='rgba(0,0,0,0.4)';cx.beginPath();cx.ellipse(z.x,z.y+z.r+4,z.r,4,0,0,6.29);cx.fill();
    cx.save();if(climbing)cx.globalAlpha=0.7;
    cx.fillStyle='#161D2E';cx.strokeStyle='#2E3A57';cx.lineWidth=2;cx.beginPath();cx.arc(z.x,z.y+bob,z.r,0,6.29);cx.fill();cx.stroke();
    cx.fillStyle='#FF5A5A';cx.beginPath();cx.arc(z.x-4,z.y+bob-2,2.2,0,6.29);cx.fill();cx.beginPath();cx.arc(z.x+4,z.y+bob-2,2,0,6.29);cx.fill();
    if(z.kind==='runner'){cx.fillStyle='#cfd6de';cx.fillRect(z.x-1,z.y+bob+4,10,4);}
    cx.restore();
    if(climbing){cx.fillStyle='#7FB0FF';cx.font='9px sans-serif';cx.textAlign='center';cx.fillText('넘는중',z.x,z.y-16);}
    if(z.hp<z.maxhp){cx.fillStyle='#20293D';cx.fillRect(z.x-10,z.y-z.r-10,20,3);cx.fillStyle='#FF5A5A';cx.fillRect(z.x-10,z.y-z.r-10,20*(z.hp/z.maxhp),3);}
  }
  // fx
  const now=performance.now()/1000;
  for(const f of fx){if(f.type==='shot'){cx.strokeStyle='rgba(255,194,75,'+(f.t/0.1)+')';cx.lineWidth=2.5;cx.beginPath();cx.moveTo(f.x1,f.y1);cx.lineTo(f.x2,f.y2);cx.stroke();}
    else if(f.type==='pop'){cx.fillStyle='rgba(140,160,179,'+(f.t/0.3)+')';for(let i=0;i<5;i++){const a=i*1.26,rr=(0.3-f.t)*36;cx.fillRect(f.x+Math.cos(a)*rr-2,f.y+Math.sin(a)*rr-2,4,4);}}
    else if(f.type==='float'){cx.globalAlpha=Math.min(1,f.t/0.9);cx.fillStyle=f.col||'#7ED8A8';cx.font='700 12px sans-serif';cx.textAlign='center';cx.fillText(f.txt,f.x,f.y-(0.9-f.t)*20);cx.globalAlpha=1;}}
  // 동료
  for(const a of allies){if(a.work&&a.work!=='combat')continue;const img=SPR[a.key];if(!(img.complete&&img.naturalWidth))continue;
    if(a.down>0){drawChar(img,a.x,a.y,40,{gray:true,alpha:.55});cx.fillStyle='#FF5A5A';cx.font='900 10px sans-serif';cx.textAlign='center';cx.fillText('중상 '+Math.ceil(a.down),a.x,a.y-32);continue;}
    const hop=a.moving?-Math.abs(Math.sin(a.phase))*4:0; drawChar(img,a.x,a.y,42,{hop});
    if(a.swingT>0){cx.strokeStyle='rgba(255,194,75,.8)';cx.lineWidth=4;cx.beginPath();cx.arc(a.x,a.y,24,a.swingDir-.9,a.swingDir+.9);cx.stroke();}
    cx.font='700 10px sans-serif';cx.fillStyle=a.post==='roof'?'#C08BFF':'#8CA0B3';cx.textAlign='center';cx.fillText(a.nm+(a.post==='roof'?' 🔫옥상':''),a.x,a.y-32);
    cx.fillStyle='#20293D';cx.fillRect(a.x-13,a.y-28,26,3);cx.fillStyle='#7ED8A8';cx.fillRect(a.x-13,a.y-28,26*Math.max(0,a.hp/a.maxhp),3);}
  // 서연 치료 오라(치료 중일 때 초록 반경 링)
  if(player.healing){cx.save();cx.strokeStyle='rgba(126,216,168,'+(0.35+0.2*Math.sin(night_t*8))+')';cx.lineWidth=2;cx.beginPath();cx.arc(player.x,player.y,CFG.HEAL_R,0,6.29);cx.stroke();
    cx.fillStyle='rgba(126,216,168,0.06)';cx.fill();cx.restore();}
  for(const rp of ripples){cx.strokeStyle='rgba(255,194,75,'+(0.5*(1-rp.r/rp.max))+')';cx.lineWidth=2;cx.beginPath();cx.arc(rp.x,rp.y,rp.r,0,6.29);cx.stroke();}
  // 서연
  const img=SPR[player.face]||SPR.front;
  if(img.complete&&img.naturalWidth){let hop=player.moving?-Math.abs(Math.sin(player.phase))*5:0,ox=0,oy=0;
    if(player.lungeT>0){const k=player.lungeT/0.15;ox=Math.cos(player.swingDir)*9*k;oy=Math.sin(player.swingDir)*9*k;}
    drawChar(img,player.x+ox,player.y+oy,46,{hop,flip:player.face==='side'&&player.flip,alpha:(player.hurtCd>0&&Math.floor(player.hurtCd*20)%2===0)?.45:1});
    if(player.swingT>0){const k=1-player.swingT/0.22,ang=player.swingDir-1.5+k*2.7;cx.save();cx.translate(player.x+ox,player.y+oy+hop-6);cx.rotate(ang);cx.strokeStyle='#454F66';cx.lineWidth=5;cx.lineCap='round';cx.beginPath();cx.moveTo(10,0);cx.lineTo(40,0);cx.stroke();cx.restore();}
    if(player.repairing){cx.fillStyle='#7ED8A8';cx.font='700 10px sans-serif';cx.textAlign='center';cx.fillText('수리중',player.x,player.y-32);}
    else if(player.healing){cx.fillStyle='#7ED8A8';cx.font='700 10px sans-serif';cx.textAlign='center';cx.fillText('치료중',player.x,player.y-32);}
    if(player.painT>0){cx.fillStyle='#FF5A5A';cx.font='900 11px sans-serif';cx.textAlign='center';cx.fillText('아야!',player.x+16,player.y-36);}
    if(player.downT>0){cx.fillStyle='#FF5A5A';cx.font='900 11px sans-serif';cx.textAlign='center';cx.fillText('중상 '+Math.ceil(player.downT),player.x,player.y-44);}}
  cx.restore();
  if(laststand){cx.fillStyle='rgba(255,40,40,0.10)';cx.fillRect(0,0,VW,VH);
    cx.strokeStyle='rgba(255,60,60,0.55)';cx.lineWidth=10;cx.strokeRect(5,5,VW-10,VH-10);
    cx.fillStyle='#FF5A5A';cx.font='900 30px ui-monospace,monospace';cx.textAlign='center';cx.fillText(''+Math.ceil(Math.max(0,lsT)),VW/2,120);
    cx.font='900 13px "Apple SD Gothic Neo",sans-serif';cx.fillText('최후의 저항 — 벙커 앞을 지켜라',VW/2,140);}
  if(noiseFxT>0){for(let i=0;i<26;i++){cx.fillStyle='rgba(255,255,255,'+(Math.random()*0.12)+')';cx.fillRect(Math.random()*VW,Math.random()*VH,Math.random()*120+30,2);}
    cx.fillStyle='rgba(255,60,60,0.8)';cx.font='900 12px ui-monospace,monospace';cx.textAlign='left';cx.fillText('● CCTV 04:44',12,70);}

  // v4: 사기 변동 표시
  moraleFx.forEach((m,i)=>{ cx.globalAlpha=Math.min(1,m.t/2.2); cx.fillStyle=m.col;
    cx.font='900 15px "Apple SD Gothic Neo",sans-serif'; cx.textAlign='right';
    cx.fillText(m.txt,VW-14,96+i*22); cx.globalAlpha=1; });
  // 알림
  const al=fx.find(f=>f.type==='alert');
  if(al){cx.font='900 18px "Apple SD Gothic Neo",sans-serif';cx.textAlign='center';cx.fillStyle=al.bad?'rgba(255,90,90,'+Math.min(1,al.t)+')':'rgba(126,216,168,'+Math.min(1,al.t)+')';cx.fillText(al.txt,VW/2,90);}
  // HUD
  cx.fillStyle='rgba(10,14,23,.8)';cx.fillRect(0,0,VW,54);
  cx.font='700 19px ui-monospace,monospace';cx.fillStyle='#FF5A5A';cx.textAlign='center';cx.fillText(clock(),VW/2,26);
  cx.font='700 12px ui-monospace,monospace';cx.fillStyle='#FFC24B';cx.textAlign='left';cx.fillText('D+'+day,10,20);cx.fillStyle='#8CA0B3';cx.fillText('Lv.'+player.lvl,10,38);
  cx.textAlign='right';cx.fillText('처치 '+totalKills,VW-10,20);cx.fillStyle='#7ED8A8';cx.fillText('식량 '+food,VW-10,38);
  { const tier=moraleTier(), mc=tier==='high'?'#7ED8A8':tier==='crit'?'#FF5A5A':tier==='low'?'#FFC24B':'#7FB4FF';
    cx.fillStyle=mc;cx.font='700 10px ui-monospace,monospace';cx.textAlign='right';
    cx.fillText('사기 '+Math.round(morale)+(blackout?' · 🌑소등':''),VW-10,64); }
  cx.fillStyle='#FFC24B';cx.font='700 10px ui-monospace,monospace';cx.fillText('소음 '+noiseScore+(noisePrev>=10?' · 오늘 스폰 +'+Math.min(30,Math.floor(noisePrev/10))+'%':''),VW-10,51);
  cx.fillStyle='#20293D';cx.fillRect(10,42,140,6);cx.fillStyle='#7ED8A8';cx.fillRect(10,42,140*Math.max(0,player.hp/player.maxhp),6);
  cx.fillStyle='#20293D';cx.fillRect(0,VH-5,VW,5);cx.fillStyle='#7FE3F0';cx.fillRect(0,VH-5,VW*(player.xp/player.need),5);
  drawMinimap();
  if(state==='dawn')drawDawn();
}
// 미니맵 — 현재 씬(1층/옥상/벙커)에 맞는 지도를 그림
function drawMinimap(){
  // 씬별 월드 크기
  let WD,HT,label;
  if(scene==='roof'){WD=ROOF.w;HT=ROOF.h;label='옥상 지도';}
  else if(scene==='bunker'){WD=BUNKW.w;HT=BUNKW.h;label='벙커 지도';}
  else {WD=WW;HT=WH;label='좀비 레이더';}
  const mw=86, mh=Math.round(mw*HT/WD), mx=VW-mw-8, my=VH-mh-12, sx=mw/WD, sy=mh/HT;
  const PX=(x)=>mx+x*sx, PY=(y)=>my+y*sy;
  cx.save();
  cx.fillStyle='rgba(8,12,20,0.74)'; cx.fillRect(mx-4,my-15,mw+8,mh+19);
  cx.strokeStyle='rgba(127,227,240,0.5)'; cx.lineWidth=1; cx.strokeRect(mx-4,my-15,mw+8,mh+19);
  cx.fillStyle='#7FE3F0'; cx.font='700 9px sans-serif'; cx.textAlign='left';
  // 옥상/벙커면 1층 좀비 수도 표기(위기 인지)
  cx.fillText(scene==='1F'?label:(label+' · 1층 좀비 '+zombies.length),mx-1,my-5);
  if(scene==='1F'){
    cx.fillStyle='rgba(120,135,155,0.5)';
    for(const o of BLOCK){ if(o.t==='벽') cx.fillRect(PX(o.x),PY(o.y),Math.max(1,o.w*sx),Math.max(1,o.h*sy)); }
    for(const en of ENTRIES){ const o=en.rect; cx.fillStyle=en.barr.hp>0?'rgba(201,169,106,0.85)':'rgba(255,110,55,0.95)'; cx.fillRect(PX(o.x)-1,PY(o.y)-1,Math.max(2,o.w*sx),Math.max(2,o.h*sy)); }
    cx.fillStyle='#7ED8A8'; for(const a of allies){ if(a.hp>0&&!(a.work&&a.work!=='combat')){cx.beginPath();cx.arc(PX(a.x),PY(a.y),1.6,0,6.29);cx.fill();} }
    cx.fillStyle='#FF4040'; for(const z of zombies){ cx.beginPath();cx.arc(PX(z.x),PY(z.y),1.9,0,6.29);cx.fill(); }
    drawMe(PX(player.x),PY(player.y),false);
  } else if(scene==='roof'){
    // ㄱ자 바닥
    cx.fillStyle='rgba(120,140,160,0.32)';
    cx.fillRect(PX(ROOF.UP.x),PY(ROOF.UP.y),ROOF.UP.w*sx,ROOF.UP.h*sy);
    cx.fillRect(PX(ROOF.LO.x),PY(ROOF.LO.y),ROOF.LO.w*sx,ROOF.LO.h*sy);
    // 오브젝트
    cx.fillStyle='rgba(95,110,130,0.85)';
    const objs=[ROOF.tank,{x:ROOF.crate.x-46,y:ROOF.crate.y-46,w:92,h:92}].concat(ROOF.hatches,ROOF.vents,ROOF.sand);
    for(const o of objs) cx.fillRect(PX(o.x),PY(o.y),Math.max(1,o.w*sx),Math.max(1,o.h*sy));
    cx.beginPath();cx.arc(PX(ROOF.fan.x),PY(ROOF.fan.y),Math.max(1.5,ROOF.fan.r*sx),0,6.29);cx.fill();
    // ↓해치
    cx.fillStyle='#7FE3F0'; cx.fillRect(PX(ROOF.down.x)-2.5,PY(ROOF.down.y)-2.5,5,5);
    drawMe(PX(player.rx),PY(player.ry),false);
  } else { // bunker
    cx.fillStyle='rgba(120,140,160,0.26)'; cx.fillRect(PX(40),PY(40),1040*sx,1200*sy);
    cx.fillStyle='rgba(75,90,110,0.95)';
    for(const w of BWALL){ cx.fillRect(PX(w[0]),PY(w[1]),Math.max(1,(w[2]-w[0])*sx),Math.max(1,(w[3]-w[1])*sy)); }
    cx.fillStyle='rgba(100,115,135,0.6)';
    for(const f of BFURN){ cx.fillRect(PX(f.x),PY(f.y),Math.max(1,f.w*sx),Math.max(1,f.h*sy)); }
    // 금고문(빨강)·계단(시안)
    cx.fillStyle='#FF5A5A'; cx.beginPath();cx.arc(PX(BVAULT.x),PY(BVAULT.y),2,0,6.29);cx.fill();
    cx.fillStyle='#7FE3F0'; cx.fillRect(PX(BUNKW.up.x)-2.5,PY(BUNKW.up.y)-2.5,5,5);
    drawMe(PX(player.rx),PY(player.ry),false);
  }
  cx.restore();
}
// 미니맵 내 위치 마커(흰 링 + 노란 점)
function drawMe(px,py,dim){
  cx.globalAlpha=dim?0.55:1;
  const pulse=3+Math.sin((night_t||0)*4)*1.2;
  cx.strokeStyle='rgba(255,255,255,0.9)'; cx.lineWidth=1.4; cx.beginPath();cx.arc(px,py,pulse+3.4,0,6.29);cx.stroke();
  cx.fillStyle='#FFE24B'; cx.beginPath();cx.arc(px,py,3.4,0,6.29);cx.fill();
  cx.strokeStyle='#fff'; cx.lineWidth=1.2; cx.stroke();
  cx.globalAlpha=1;
}
function drawDawn(){const k=Math.min(1,dawnT/3.2);cx.fillStyle='rgba(255,224,170,'+(0.55*k)+')';cx.fillRect(0,0,VW,VH);cx.fillStyle='rgba(58,42,20,'+k+')';cx.font='900 24px "Apple SD Gothic Neo",sans-serif';cx.textAlign='center';cx.fillText('동이 튼다…',VW/2,VH*0.5);cx.font='700 14px "Apple SD Gothic Neo",sans-serif';cx.fillText('오늘 밤도 살아남았다',VW/2,VH*0.5+28);}

function drawHUDmini(){
  cx.fillStyle='rgba(10,14,23,.8)';cx.fillRect(0,0,VW,44);
  cx.font='700 18px ui-monospace,monospace';cx.fillStyle='#FF5A5A';cx.textAlign='center';cx.fillText(clock(),VW/2,26);
  cx.font='700 12px ui-monospace,monospace';cx.fillStyle='#FFC24B';cx.textAlign='left';cx.fillText('D+'+day,10,20);
  cx.fillStyle='#20293D';cx.fillRect(10,30,140,6);cx.fillStyle='#7ED8A8';cx.fillRect(10,30,140*Math.max(0,player.hp/player.maxhp),6);
  drawMinimap();
}
function loop(ts){if(lastTs===undefined)lastTs=ts;let dt=(ts-lastTs)/1000;lastTs=ts;if(dt>0.05)dt=0.05;
  if(freeze>0){freeze-=dt;} else if(state==='play')update(dt); else if(state==='dawn'){dawnT+=dt;if(dawnT>=3.2)realMorning();}
  if(state==='play'||state==='levelup'||state==='pause'||state==='dawn'||state==='assign'||state==='morning'||state==='expedition'||state==='memorial'||state==='skill')render();
  requestAnimationFrame(loop);}
document.getElementById('btnStart').onclick=()=>{document.getElementById('title').classList.add('hidden');reset();state='play';};
document.getElementById('btnNext').onclick=()=>{document.getElementById('morning').classList.add('hidden');startNight(false);state='play';};
document.getElementById('btnRetry').onclick=()=>{document.getElementById('over').classList.add('hidden');reset();state='play';};
document.getElementById('btnResume').onclick=togglePause;
document.getElementById('btnPause').onclick=togglePause; // 화면 ⏸ 버튼(모바일용) — 이게 빠져 있었음
document.getElementById('btnAssign').onclick=openAssign; // 거점 방어 배치
document.getElementById('btnDbg').onclick=()=>{showDbg=!showDbg;};
requestAnimationFrame(loop);
