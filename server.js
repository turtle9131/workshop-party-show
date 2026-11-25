// 워크샵 파티 쇼 · 노트북 서버
// 실행: node server.js   (포트를 바꾸려면 PORT=8080 node server.js)
// - 프로젝트 폴더의 정적 파일을 그대로 제공합니다 (index.html, player.html, play.html ...).
// - 🕵️ 마피아 / 🤥 라이어: 역할·제시어를 서버가 들고, 각 폰에는 자기 몫만 실시간(SSE)으로 보냅니다.
// - 📱 폰 연결(파티): 버저 퀴즈, 폭탄 돌리기, 캐치마인드, 올인 답 제출을 폰으로 합니다.
// 외부 패키지 없이 Node 기본 모듈만 사용합니다.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8000;

// 브라우저와 같은 역할·제시어 계산 코드를 그대로 불러와 씁니다 (진행 화면과 결과가 항상 같음).
const lib = vm.createContext({});
for (const f of ['js/data.js', 'js/order.js', 'js/mafia.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), lib, { filename: f });
}
const mafiaRoles = (g) => vm.runInContext('mafiaRoles', lib)(g);
const liarRound = (g, r) => vm.runInContext('liarRound', lib)(g, r);

// ── 접속 주소 (같은 Wi-Fi·핫스팟에서 폰이 들어올 주소) ──
function lanIps() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal || a.address.startsWith('169.254.')) continue;
      out.push({ name, ip: a.address });
    }
  }
  // Windows 모바일 핫스팟(192.168.137.x) → Wi-Fi·이더넷 → 기타 → 가상 어댑터(WSL·VMware 등, 폰이 못 들어옴) 순
  const virt = /vEthernet|WSL|Hyper-V|VMware|VirtualBox|vboxnet|Docker|vmnet|Loopback|Bluetooth|Tailscale|ZeroTier|utun|bridge/i;
  const rank = (a) => (a.ip.startsWith('192.168.137.') ? 0 : virt.test(a.name) ? 3 : /wi-?fi|wlan|wireless|무선|ethernet|이더넷|^en|^eth/i.test(a.name) ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b));
}

const tok = () => crypto.randomBytes(12).toString('hex');
// 이미 닫힌 연결에 쓰면 서버 전체가 죽으므로 확인 후 씀
const send = (s, obj) => {
  if (s.res.writableEnded || s.res.destroyed) return;
  try { s.res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch (e) { /* 끊긴 연결 무시 */ }
};

// ═══════════════════ 🕵️ 마피아 · 🤥 라이어 공통 (명단 + 이름 잠금) ═══════════════════
// room = { kind: 'm'|'l', g, ht(진행 토큰), claims: [플레이어 토큰|null], phase, subs: Set, ...게임별 상태 }
const rooms = { m: new Map(), l: new Map() };

// ── 마피아 ──
function mafiaIdx(G) { return G.roles.map((r, k) => (r === 'mafia' ? k : -1)).filter((k) => k >= 0); }
function aliveMafia(G) { return mafiaIdx(G).filter((k) => G.alive[k]); }
function targetsFor(G, k) {
  const r = G.roles[k];
  return G.g.n.map((_, j) => j).filter((j) => G.alive[j] && (r === 'doctor' ? true : r === 'mafia' ? G.roles[j] !== 'mafia' : j !== k));
}
// 마피아 합의 대상 (살아 있는 마피아가 모두 같은 사람을 골랐을 때)
function mafiaAgreed(G) {
  const ms = aliveMafia(G), picks = ms.map((k) => G.night.picks[k]);
  if (!ms.length || picks.some((p) => p === undefined)) return null;
  return picks.every((p) => p === picks[0]) ? picks[0] : null;
}
function nightProgress(G) {
  const alive = G.g.n.map((_, k) => k).filter((k) => G.alive[k]);
  const agreed = mafiaAgreed(G);
  const done = alive.filter((k) => (G.roles[k] === 'mafia' ? agreed !== null : !!G.night.locked[k])).length;
  return { done, total: alive.length };
}
// 강제 진행 때 쓸 마피아 대상: 합의가 없으면, 고른 사람이 모두 같은 대상일 때만 인정
function mafiaKill(G) {
  const agreed = mafiaAgreed(G);
  if (agreed !== null) return agreed;
  const picks = [...new Set(aliveMafia(G).map((k) => G.night.picks[k]).filter((p) => p !== undefined))];
  return picks.length === 1 ? picks[0] : null;
}
function doctorSave(G) {
  const d = G.roles.findIndex((r, k) => r === 'doctor' && G.alive[k]);
  return d >= 0 && G.night.locked[d] ? G.night.picks[d] : null;
}

function mafiaPlayerView(G, k) {
  const r = G.roles[k], v = {
    t: 'player', kind: 'mafia', c: G.g.c, phase: G.phase, day: G.day, me: k, names: G.g.n, alive: G.alive,
    role: r, mates: r === 'mafia' ? mafiaIdx(G).filter((j) => j !== k).map((j) => G.g.n[j]) : [],
    police: r === 'police' ? G.police : [], over: G.over || null,
  };
  if (G.phase === 'night' && G.alive[k]) {
    const n = { targets: targetsFor(G, k), pick: G.night.picks[k] ?? null, locked: !!G.night.locked[k] };
    if (r === 'mafia') {
      n.mates = aliveMafia(G).filter((j) => j !== k).map((j) => ({ name: G.g.n[j], pick: G.night.picks[j] ?? null }));
      n.agreed = mafiaAgreed(G);
    }
    if (r === 'police' && n.locked) n.result = G.roles[n.pick] === 'mafia';
    v.night = n;
  }
  if (G.over) v.roles = G.roles;
  return v;
}

// ── 라이어 ── (라운드 번호만 맞추면 서버가 각자 제시어를 계산해서 보냄)
function liarPlayerView(G, k) {
  const v = { t: 'player', kind: 'liar', c: G.g.c, phase: G.phase, r: G.r, me: k, names: G.g.n, mode: G.g.mode };
  if (G.phase === 'round' || G.phase === 'result') {
    const R = liarRound(G.g, G.r), liar = R.liars.includes(k);
    v.cat = R.cat; v.first = G.g.n[R.first];
    // 일반 모드: 라이어는 제시어 없음 / 바보 모드: 라이어는 다른 제시어 (자기가 라이어인 줄 모름)
    if (liar && G.g.mode !== 'fool') v.liar = true; else v.word = liar ? R.fake : R.word;
    if (G.phase === 'result') v.result = { word: R.word, fake: R.fake, liars: R.liars.map((j) => G.g.n[j]) };
  }
  return v;
}

function hostView(G) {
  const v = { t: 'host', phase: G.phase, claimed: G.claims.map((c) => !!c), online: G.claims.map((_, k) => [...G.subs].some((s) => s.k === k)) };
  if (G.kind === 'm') { v.day = G.day; v.night = G.phase === 'night' ? nightProgress(G) : null; }
  if (G.kind === 'l') v.r = G.r;
  return v;
}
const playerView = (G, k) => (G.kind === 'm' ? mafiaPlayerView(G, k) : liarPlayerView(G, k));

function broadcast(G) {
  for (const s of G.subs) {
    if (s.host) send(s, hostView(G));
    else if (G.claims[s.k] === s.pt) send(s, playerView(G, s.k));
    else send(s, { t: 'kicked' }); // 진행자가 이름 잠금을 풀었음
  }
}

function newRoom(kind, g, ht) {
  const G = { kind, g, ht, claims: g.n.map(() => null), phase: 'join', subs: new Set() };
  if (kind === 'm') Object.assign(G, { roles: mafiaRoles(g), alive: g.n.map(() => true), day: 1, over: null, night: { day: 0, picks: {}, locked: {} }, police: [] });
  if (kind === 'l') G.r = 1;
  return G;
}

// ═══════════════════ 📱 폰 연결 (파티 게임) ═══════════════════
// 행사 내내 하나만 씁니다. 참가자는 이름·팀으로 한 번 접속하면, 진행 화면이 여는 게임에 맞춰 폰 화면이 바뀝니다.
// act(지금 진행 중인 것):
//   idle  · buzz { first, exclude[] }  · bomb { cat, holder, live, boom }
//   draw  { team, word, turn, drawer, strokes[] }  · allin { open, answers{0,1} }
let P = null; // { ht, teamNames, roster, members: Map(id → {id, name, team, pt}), nextId, act, subs: Set }

const pMembers = () => [...P.members.values()];
const pOnline = (id) => [...P.subs].some((s) => s.id === id);
function drawOrder() { // 그리는 팀원 순서 (접속한 순)
  return pMembers().filter((m) => m.team === P.act.team).map((m) => m.id);
}
function setDrawer() {
  const ord = drawOrder();
  P.act.drawer = ord.length ? ord[P.act.turn % ord.length] : null;
}

function partyHostView() {
  const a = { ...P.act };
  if (a.kind === 'draw') delete a.strokes; // 그림 선은 따로 보냄 ('strokes' 이벤트)
  const nm = (id) => (P.members.get(id) || {}).name || null;
  if (a.kind === 'bomb') { a.holderName = nm(a.holder); a.boomName = nm(a.boom); a.boomTeam = a.boom != null && P.members.get(a.boom) ? P.members.get(a.boom).team : null; }
  if (a.kind === 'draw') a.drawerName = nm(a.drawer);
  if (a.kind === 'buzz' && a.first) a.first = { ...a.first };
  return { t: 'host', teamNames: P.teamNames, members: pMembers().map((m) => ({ id: m.id, name: m.name, team: m.team, online: pOnline(m.id) })), act: a };
}
function partyPlayerView(m) {
  const a = P.act, v = { t: 'party', me: { id: m.id, name: m.name, team: m.team }, teamNames: P.teamNames, kind: a.kind };
  const nm = (id) => (P.members.get(id) || {}).name || '';
  if (a.kind === 'buzz') { v.first = a.first; v.excluded = a.exclude.includes(m.team); }
  if (a.kind === 'bomb') {
    v.cat = a.cat; v.live = a.live; v.holding = a.live && a.holder === m.id; v.holderName = nm(a.holder);
    v.boom = a.boom != null ? { name: nm(a.boom), me: a.boom === m.id } : null;
    if (v.holding) v.others = pMembers().filter((x) => x.id !== m.id).map((x) => ({ id: x.id, name: x.name, team: x.team, online: pOnline(x.id) }));
  }
  if (a.kind === 'draw') {
    v.team = a.team; v.drawing = a.team === m.team; v.isDrawer = a.drawer === m.id; v.drawerName = nm(a.drawer); v.turn = a.turn;
    if (v.drawing || a.done) v.word = a.word; // 제시어는 그리는 팀 폰에만
    v.done = !!a.done;
  }
  if (a.kind === 'allin') { v.open = a.open; v.mine = a.answers[m.team]; }
  // 🏅 점수 현황: 진행 화면이 정한 공개 범위대로 (all: 팀+개인 순위, team: 팀 점수 + 내 포인트만, off: 안 보냄)
  const s = P.scores;
  if (s && s.mode !== 'off') {
    const mine = s.indiv.find((x) => x.name === m.name);
    v.scores = { mode: s.mode, teams: s.teams, leaders: s.leaders, mine: mine ? mine.pts : 0, indiv: s.mode === 'all' ? s.indiv : null };
  }
  return v;
}
function cleanScores(s) {
  if (!s || typeof s !== 'object') return null;
  const num = (x) => (Number.isFinite(+x) ? Math.round(+x) : 0), str = (x, n) => String(x == null ? '' : x).slice(0, n);
  return {
    mode: ['all', 'team', 'off'].includes(s.mode) ? s.mode : 'all',
    teams: (Array.isArray(s.teams) ? s.teams : []).slice(0, 2).map((t) => ({ name: str(t && t.name, 12), score: num(t && t.score) })),
    leaders: Array.isArray(s.leaders) ? s.leaders.slice(0, 2).map((x) => str(x, 20)) : null,
    set: Math.max(1, num(s.set) || 1), // 문제 세트 번호 (사회자 폰 정답지용)
    indiv: (Array.isArray(s.indiv) ? s.indiv : []).slice(0, 80).map((x) => ({ name: str(x && x.name, 20), team: x && x.team === 1 ? 1 : 0, pts: num(x && x.pts) })),
  };
}
// 🎤 사회자 리모컨(host.html): 전체 점수(공개 범위와 무관) + 진행 화면 연결 여부
const hostOnline = () => [...P.subs].some((s) => s.host);
function remoteView() { return { t: 'rstate', scores: P.scores || null, ctl: P.ctl || null, host: hostOnline(), teamNames: P.teamNames }; }
// 진행 화면이 알려 주는 "지금 화면에서 누를 수 있는 버튼 + 정답" (사회자 폰 전용)
function cleanCtl(c) {
  if (!c || typeof c !== 'object') return null;
  const str = (x, n) => String(x == null ? '' : x).slice(0, n);
  return {
    title: str(c.title, 40), q: str(c.q, 40), answer: str(c.answer, 80), detail: str(c.detail, 80), revealed: !!c.revealed,
    win: c.win && Number.isFinite(+c.win.pts) ? { pts: Math.round(+c.win.pts) } : null,
    can: (Array.isArray(c.can) ? c.can : []).slice(0, 24).map((b) => ({ a: str(b && b.a, 20), v: str(b && b.v, 20), l: str(b && b.l, 30), k: str(b && b.k, 10) })),
  };
}
function pBroadcast() {
  if (!P) return;
  for (const s of P.subs) {
    if (s.remote) send(s, remoteView());
    else if (s.host) send(s, partyHostView());
    else { const m = P.members.get(s.id); send(s, m && m.pt === s.pt ? partyPlayerView(m) : { t: 'kicked' }); }
  }
}
function pHosts(obj) { for (const s of P.subs) if (s.host) send(s, obj); }

// ═══════════════════ HTTP ═══════════════════
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((ok, bad) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 2e5) { bad(new Error('too big')); req.destroy(); } });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { bad(e); } });
  });
}
function openStream(req, res, subs, s, onClose) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 2000\n\n');
  s.res = res; subs.add(s);
  const ping = setInterval(() => { if (!res.writableEnded && !res.destroyed) try { res.write(': ping\n\n'); } catch (e) { /* 끊김 */ } }, 20000);
  req.on('close', () => { clearInterval(ping); subs.delete(s); onClose(); });
}

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  const base = path.basename(file);
  // 프로젝트 폴더 밖, 숨김 파일(.git, .claude), 서버 코드는 내보내지 않음
  if (!file.startsWith(ROOT + path.sep) || rel.split(/[\\/]/).some((p) => p.startsWith('.')) || base === 'server.js') {
    res.writeHead(404); return res.end('Not found');
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

// ── 마피아(/api/m/…) · 라이어(/api/l/…) ──
async function roomApi(kind, route, req, res, q) {
  const map = rooms[kind];
  if (route === 'events') {
    const G = map.get(q.get('c'));
    if (!G) return json(res, 404, { error: 'nogame' });
    const s = {};
    if (q.get('ht')) { if (q.get('ht') !== G.ht) return json(res, 403, { error: 'auth' }); s.host = true; }
    else {
      const k = G.claims.indexOf(q.get('pt'));
      if (!q.get('pt') || k < 0) return json(res, 403, { error: 'auth' });
      s.k = k; s.pt = q.get('pt');
    }
    openStream(req, res, G.subs, s, () => broadcast(G));
    broadcast(G); // 접속 표시 갱신 + 첫 화면
    return;
  }
  if (route === 'lobby') {
    const G = map.get(q.get('c'));
    if (!G) return json(res, 404, { error: 'nogame' });
    return json(res, 200, { kind: G.kind === 'm' ? 'mafia' : 'liar', names: G.g.n, claimed: G.claims.map((c) => !!c), phase: G.phase });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { error: 'body' }); }

  // 진행: 게임 등록 (같은 코드·토큰으로 다시 보내면 기존 상태 유지 → 서버를 다시 켜도 이어서 가능)
  if (route === 'new') {
    const g = b.g;
    if (!g || !Array.isArray(g.n) || !g.n.length || g.n.length > 30 || !/^\d{4}$/.test(String(g.c))) return json(res, 400, { error: 'game' });
    if (kind === 'l' && g.t !== 'liar') return json(res, 400, { error: 'game' });
    let G = map.get(g.c);
    if (G && G.ht !== b.ht) return json(res, 409, { error: 'code' });
    if (!G) {
      G = newRoom(kind, g, typeof b.ht === 'string' && b.ht.length >= 16 ? b.ht : tok());
      map.set(g.c, G);
      console.log(`[${kind === 'm' ? '마피아' : '라이어'}] 게임 ${g.c} 등록 · ${g.n.length}명`);
    }
    return json(res, 200, { ht: G.ht });
  }

  const G = map.get(String(b.c));
  if (!G) return json(res, 404, { error: 'nogame' });

  // 참가자: 이름 선택 (먼저 고른 사람이 잠금)
  if (route === 'claim') {
    const k = Number(b.k);
    if (!(k >= 0 && k < G.g.n.length)) return json(res, 400, { error: 'k' });
    if (G.claims[k]) return json(res, 409, { error: 'taken' });
    G.claims[k] = tok(); broadcast(G);
    return json(res, 200, { pt: G.claims[k], k });
  }

  // 마피아 참가자: 밤 선택
  if (route === 'pick' && kind === 'm') {
    const k = G.claims.indexOf(b.pt);
    if (!b.pt || k < 0) return json(res, 403, { error: 'auth' });
    if (G.phase !== 'night' || !G.alive[k]) return json(res, 409, { error: 'phase' });
    const t = Number(b.t);
    if (!targetsFor(G, k).includes(t)) return json(res, 400, { error: 'target' });
    const isMafia = G.roles[k] === 'mafia';
    if (G.night.locked[k] || (isMafia && mafiaAgreed(G) !== null)) return json(res, 409, { error: 'locked' });
    G.night.picks[k] = t;
    if (!isMafia) {
      G.night.locked[k] = true;
      if (G.roles[k] === 'police') G.police.push({ day: G.day, t: G.g.n[t], mafia: G.roles[t] === 'mafia' });
    }
    broadcast(G);
    return json(res, 200, { ok: true });
  }

  // 이하 진행 전용
  if (b.ht !== G.ht) return json(res, 403, { error: 'auth' });
  if (route === 'release') {
    const k = Number(b.k);
    if (k >= 0 && k < G.claims.length) { G.claims[k] = null; broadcast(G); }
    return json(res, 200, { ok: true });
  }
  if (route === 'sync' && kind === 'm') {
    if (Array.isArray(b.alive) && b.alive.length === G.g.n.length) G.alive = b.alive.map(Boolean);
    if (['join', 'night', 'day', 'over'].includes(b.phase)) G.phase = b.phase;
    if (Number(b.day) > 0) G.day = Number(b.day);
    G.over = b.over || null;
    if (G.phase === 'night' && G.night.day !== G.day) G.night = { day: G.day, picks: {}, locked: {} };
    broadcast(G);
    return json(res, 200, { ok: true });
  }
  if (route === 'resolve' && kind === 'm') return json(res, 200, { kill: mafiaKill(G), saved: doctorSave(G) });
  if (route === 'sync' && kind === 'l') {
    if (['join', 'round', 'result', 'over'].includes(b.phase)) G.phase = b.phase;
    if (Number(b.r) > 0) G.r = Number(b.r);
    broadcast(G);
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'route' });
}

// ── 폰 연결 (/api/p/…) ──
async function partyApi(route, req, res, q) {
  if (route === 'events') {
    if (!P) return json(res, 404, { error: 'noparty' });
    const s = {};
    if (q.get('ht')) { if (q.get('ht') !== P.ht) return json(res, 403, { error: 'auth' }); s.host = true; }
    else if (q.get('rk')) { if (!P.rk || q.get('rk') !== P.rk) return json(res, 403, { error: 'auth' }); s.remote = true; }
    else {
      const m = pMembers().find((x) => x.pt === q.get('pt'));
      if (!q.get('pt') || !m) return json(res, 403, { error: 'auth' });
      s.id = m.id; s.pt = m.pt;
    }
    openStream(req, res, P.subs, s, () => pBroadcast());
    pBroadcast();
    if (s.host && P.act.kind === 'draw') send(s, { t: 'strokes', all: P.act.strokes });
    return;
  }
  if (route === 'lobby') {
    if (!P) return json(res, 404, { error: 'noparty' });
    return json(res, 200, { teamNames: P.teamNames, roster: P.roster, taken: pMembers().map((m) => m.name) });
  }
  // 그리는 팀 폰: 지금까지 그린 그림 (릴레이로 차례가 왔을 때 이어 그리기용)
  if (route === 'strokes') {
    const m = P && pMembers().find((x) => x.pt === q.get('pt'));
    if (!m) return json(res, 403, { error: 'auth' });
    if (P.act.kind !== 'draw' || P.act.team !== m.team) return json(res, 409, { error: 'kind' });
    return json(res, 200, { strokes: P.act.strokes });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { error: 'body' }); }

  // 진행: 폰 연결 방 열기 (팀 이름·팀 명단 갱신). 다른 노트북 탭이 이미 열었으면 force 로만 새로 만듦
  if (route === 'open') {
    const teamNames = Array.isArray(b.teamNames) ? b.teamNames.slice(0, 2).map((x) => String(x).slice(0, 12)) : ['A팀', 'B팀'];
    const roster = Array.isArray(b.roster) && b.roster.length === 2 ? b.roster.map((t) => (Array.isArray(t) ? t.map((x) => String(x).slice(0, 20)).slice(0, 40) : [])) : null;
    const rk = typeof b.rk === 'string' && b.rk.length >= 12 ? b.rk.slice(0, 64) : null; // 사회자 리모컨 키
    if (P && P.ht === b.ht) {
      if (rk && rk !== P.rk) { // 키를 바꾸면 기존 리모컨은 끊김
        for (const s of [...P.subs]) if (s.remote) { P.subs.delete(s); s.res.end(); }
        P.rk = rk;
      }
      P.teamNames = teamNames; P.roster = roster; pBroadcast(); return json(res, 200, { ht: P.ht });
    }
    if (P && !b.force) return json(res, 409, { error: 'exists' });
    if (P) for (const s of P.subs) s.res.end();
    P = { ht: typeof b.ht === 'string' && b.ht.length >= 16 ? b.ht : tok(), rk, teamNames, roster, members: new Map(), nextId: 1, act: { kind: 'idle' }, subs: new Set() };
    console.log('[폰 연결] 방을 열었습니다');
    return json(res, 200, { ht: P.ht });
  }
  if (!P) return json(res, 404, { error: 'noparty' });

  // 🎤 사회자 리모컨: 점수 명령을 진행 화면(노트북)으로 전달. 실제 점수 계산·저장은 진행 화면이 함
  if (route === 'remote') {
    if (!P.rk || b.rk !== P.rk) return json(res, 403, { error: 'auth' });
    if (!hostOnline()) return json(res, 409, { error: 'nohost' });
    const op = ['team', 'indiv', 'undo', 'act'].includes(b.op) ? b.op : null;
    if (!op) return json(res, 400, { error: 'op' });
    const n = Math.max(-20, Math.min(20, Math.round(+b.n) || 0));
    pHosts({
      t: 'remote', op, team: b.team === 1 ? 1 : 0, n,
      who: Array.isArray(b.who) ? b.who.slice(0, 40).map((x) => String(x).slice(0, 20)) : [],
      ip: Math.max(0, Math.min(10, Math.round(+b.ip) || 0)),
      a: String(b.a || '').slice(0, 20), v: String(b.v == null ? '' : b.v).slice(0, 20),
    });
    return json(res, 200, { ok: true });
  }

  // 참가자: 이름·팀으로 접속 (같은 이름은 한 명만)
  if (route === 'join') {
    const name = String(b.name || '').trim().slice(0, 20), team = Number(b.team);
    if (!name || !(team === 0 || team === 1)) return json(res, 400, { error: 'input' });
    if (pMembers().some((m) => m.name === name)) return json(res, 409, { error: 'taken' });
    const m = { id: P.nextId++, name, team, pt: tok() };
    P.members.set(m.id, m);
    if (P.act.kind === 'draw' && P.act.drawer == null) setDrawer();
    pBroadcast();
    return json(res, 200, { pt: m.pt });
  }

  // 참가자 동작
  const me = b.pt ? pMembers().find((m) => m.pt === b.pt) : null;
  const a = P.act;
  if (['buzz', 'pass', 'stroke', 'clear', 'answer'].includes(route)) {
    if (!me) return json(res, 403, { error: 'auth' });
    if (route === 'buzz') {
      if (a.kind !== 'buzz' || a.first || a.exclude.includes(me.team)) return json(res, 409, { error: 'late' });
      a.first = { id: me.id, name: me.name, team: me.team };
      pBroadcast();
      return json(res, 200, { ok: true, first: true });
    }
    if (route === 'pass') {
      const to = P.members.get(Number(b.to));
      if (a.kind !== 'bomb' || !a.live || a.holder !== me.id || !to || to.id === me.id) return json(res, 409, { error: 'late' });
      a.holder = to.id; a.passes = (a.passes || 0) + 1;
      pBroadcast();
      return json(res, 200, { ok: true });
    }
    if (route === 'stroke' || route === 'clear') {
      if (a.kind !== 'draw' || a.done || a.drawer !== me.id) return json(res, 409, { error: 'turn' });
      if (route === 'clear') { a.strokes = []; pHosts({ t: 'strokes', all: [] }); return json(res, 200, { ok: true }); }
      const s = b.s || {};
      const pts = Array.isArray(s.p) ? s.p.slice(0, 400).map((p) => [Math.min(1, Math.max(0, +p[0] || 0)), Math.min(1, Math.max(0, +p[1] || 0))]) : [];
      const c = /^#[0-9a-f]{3,6}$/i.test(s.c) ? s.c : '#111';
      if (!pts.length) return json(res, 400, { error: 'pts' });
      const chunk = { id: String(s.id).slice(0, 24), c, w: Math.min(30, Math.max(1, +s.w || 5)), first: !!s.first, p: pts };
      if (a.strokes.length < 20000) a.strokes.push(chunk);
      pHosts({ t: 'stroke', s: chunk });
      return json(res, 200, { ok: true });
    }
    if (route === 'answer') {
      if (a.kind !== 'allin' || !a.open) return json(res, 409, { error: 'closed' });
      const text = String(b.text || '').trim().slice(0, 60);
      a.answers[me.team] = text ? { text, by: me.name } : null;
      pBroadcast();
      return json(res, 200, { ok: true });
    }
  }

  // 이하 진행 전용
  if (b.ht !== P.ht) return json(res, 403, { error: 'auth' });
  if (route === 'kick') {
    const m = P.members.get(Number(b.id));
    if (m) { P.members.delete(m.id); if (a.kind === 'draw' && a.drawer === m.id) setDrawer(); pBroadcast(); }
    return json(res, 200, { ok: true });
  }
  if (route === 'act') {
    const op = b.op;
    if (op === 'idle') P.act = { kind: 'idle' };
    else if (op === 'buzz') P.act = { kind: 'buzz', first: null, exclude: [] };
    else if (op === 'buzzReset') { if (a.kind !== 'buzz') P.act = { kind: 'buzz', first: null, exclude: [] }; else { a.first = null; a.exclude = Array.isArray(b.exclude) ? b.exclude.filter((t) => t === 0 || t === 1) : []; } }
    else if (op === 'bomb') P.act = { kind: 'bomb', cat: String(b.cat || '').slice(0, 40), holder: null, live: false, boom: null, passes: 0 };
    else if (op === 'bombCat') { if (a.kind === 'bomb') a.cat = String(b.cat || '').slice(0, 40); }
    else if (op === 'bombStart') {
      if (a.kind !== 'bomb') return json(res, 409, { error: 'kind' });
      const on = pMembers().filter((m) => pOnline(m.id)), pool = on.length ? on : pMembers();
      if (!pool.length) return json(res, 409, { error: 'nobody' });
      Object.assign(a, { holder: pool[Math.random() * pool.length | 0].id, live: true, boom: null, passes: 0 });
    } else if (op === 'bombBoom') {
      if (a.kind !== 'bomb' || !a.live) return json(res, 409, { error: 'kind' });
      a.live = false; a.boom = a.holder;
    } else if (op === 'draw') {
      P.act = { kind: 'draw', team: b.team === 1 ? 1 : 0, word: String(b.word || '').slice(0, 40), turn: 0, drawer: null, strokes: [], done: false };
      setDrawer(); pHosts({ t: 'strokes', all: [] });
    } else if (op === 'drawTurn') { if (a.kind === 'draw') { a.turn++; setDrawer(); } }
    else if (op === 'drawClear') { if (a.kind === 'draw') { a.strokes = []; pHosts({ t: 'strokes', all: [] }); } }
    else if (op === 'drawEnd') { if (a.kind === 'draw') a.done = true; }
    else if (op === 'allin') P.act = { kind: 'allin', open: true, answers: { 0: null, 1: null } };
    else if (op === 'allinClose') { if (a.kind === 'allin') a.open = false; }
    else if (op === 'score') P.scores = cleanScores(b.scores);
    else if (op === 'ctl') { P.ctl = cleanCtl(b.ctl); for (const s of P.subs) if (s.remote) send(s, remoteView()); return json(res, 200, { ok: true }); }
    else return json(res, 400, { error: 'op' });
    pBroadcast();
    return json(res, 200, { ok: true, act: partyHostView().act });
  }
  return json(res, 404, { error: 'route' });
}

async function api(req, res, url) {
  const parts = url.pathname.slice('/api/'.length).split('/'), q = url.searchParams;
  if (parts[0] === 'ping') return json(res, 200, { ok: true, port: PORT, ips: lanIps().map((a) => a.ip), party: !!P });
  if ((parts[0] === 'm' || parts[0] === 'l') && parts.length === 2) return roomApi(parts[0], parts[1], req, res, q);
  if (parts[0] === 'p' && parts.length === 2) return partyApi(parts[1], req, res, q);
  return json(res, 404, { error: 'route' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch((e) => { console.error(e); if (!res.headersSent) json(res, 500, { error: 'server' }); });
  } else if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res, url.pathname);
  } else { res.writeHead(405); res.end(); }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n🎉 워크샵 파티 쇼 서버가 켜졌습니다.\n');
  console.log(`  노트북(진행 화면):  http://localhost:${PORT}`);
  const ips = lanIps();
  if (ips.length) ips.forEach((a) => console.log(`  폰 접속 주소:       http://${a.ip}:${PORT}   (${a.name})`));
  else console.log('  ⚠ 네트워크 주소를 찾지 못했어요. Wi-Fi나 모바일 핫스팟을 켜 주세요.');
  console.log('\n  끄려면 Ctrl + C\n');
});
