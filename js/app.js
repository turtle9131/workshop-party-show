'use strict';

// ═══════════════════════ 공통 ═══════════════════════
const $ = (s) => document.querySelector(s);
const main = $('#main');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const range = (n) => Array.from({ length: n }, (_, i) => i);
const pick = (arr) => arr[Math.random() * arr.length | 0];

const STORE_KEY = 'workshop-party-show';
const S = (() => {
  const def = { teams: [{ name: 'A팀', score: 0 }, { name: 'B팀', score: 0 }], penalties: DEFAULT_PENALTIES.slice(), set: 1 };
  try { return Object.assign(def, JSON.parse(localStorage.getItem(STORE_KEY)) || {}); } catch (e) { return def; }
})();
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가 환경 */ } }

let toastTimer;
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function flash(color) {
  const f = $('#flash'); f.style.background = color; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}

// ═══════════════════════ 효과음 (WebAudio) ═══════════════════════
let ac;
function audio() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
  const a = audio(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + when;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  ok() { tone(880, 0.15, 'triangle', 0.3); tone(1320, 0.3, 'triangle', 0.3, 0.12); },
  bad() { tone(160, 0.35, 'sawtooth', 0.18); },
  tick() { tone(1400, 0.04, 'square', 0.08); },
  beep() { tone(660, 0.12, 'square', 0.15); },
  go() { tone(990, 0.4, 'square', 0.18); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.16, 'triangle', 0.28, i * 0.13)); },
  boom() {
    const a = audio(), len = a.sampleRate * 1.2, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    const src = a.createBufferSource(), g = a.createGain(); src.buffer = buf; g.gain.value = 0.9;
    src.connect(g).connect(a.destination); src.start();
    tone(70, 0.9, 'sine', 0.6);
  },
};

// ═══════════════════════ 점수판 ═══════════════════════
function renderScore() {
  const t = (i, cls) => `
    <div class="team ${cls}">
      <span class="name">${esc(S.teams[i].name)}</span>
      <span class="pts" id="pts${i}">${S.teams[i].score}</span>
      <span class="pm"><button data-s="${i}:-1">−</button><button data-s="${i}:1">＋</button></span>
    </div>`;
  $('#scorebar').innerHTML = t(0, 'A') + '<span class="mid"><button class="home-btn" data-home title="홈">🏠</button><button class="home-btn" data-scores title="점수판 · 개인 점수">🏅</button></span>' + t(1, 'B');
}
// ask = false 면 "누가 맞혔나요?"를 묻지 않음 (점수판 화면의 팀 점수 수정 등)
let remoteClick = false; // 사회자 폰이 버튼을 대신 누르는 중 (누가 맞혔는지는 폰에서 이미 고름)
function addScore(i, n, ask = true) {
  S.teams[i].score += n; save(); renderScore();
  const el = $('#pts' + i); el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 250);
  if (n > 0 && ask && !remoteClick) askWho(i, n);
  pushScores();
}
$('#scorebar').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-home')) return go('home');
  if (b.hasAttribute('data-scores')) return go('scores');
  const [i, n] = b.dataset.s.split(':').map(Number); addScore(i, n); n > 0 ? sfx.ok() : sfx.bad();
});

// ═══════════════════════ 개인 점수 ═══════════════════════
// S.indiv = { 이름: { t: 팀, p: 포인트 } }. 팀 점수를 줄 때 "누가 맞혔나요?"로 개인 포인트도 줍니다.
if (!S.indiv || typeof S.indiv !== 'object') S.indiv = {};
if (S.askWho === undefined) S.askWho = true;
if (!S.scoreShow) S.scoreShow = 'all'; // 참가자 폰 공개 범위: all(팀+개인) | team(팀만) | off(숨김)
// 🎤 사회자 리모컨 키 (host.html?k=…). 이 키를 아는 폰만 점수를 줄 수 있음
const newKey = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, '0')).join('');
if (!S.rk) { S.rk = newKey(); save(); }

// 팀원 = 팀 나누기 명단 + 폰으로 접속한 사람 + 이미 포인트를 받은 사람
function teamMembers(t) {
  const R = Array.isArray(S.roster) && S.roster.length === 2 ? S.roster : [[], []];
  const inR = (n) => R[0].includes(n) || R[1].includes(n); // 명단에 있으면 명단의 팀이 우선
  const set = new Set(R[t]);
  if (typeof Party !== 'undefined') Party.members(t).forEach((m) => { if (!inR(m.name)) set.add(m.name); });
  Object.entries(S.indiv).forEach(([n, x]) => { if (x.t === t && !inR(n)) set.add(n); });
  return [...set];
}
function allPlayers() { return [0, 1].flatMap((t) => teamMembers(t).map((n) => ({ n, t, p: (S.indiv[n] && S.indiv[n].p) || 0 }))); }
function addIndiv(name, t, n) {
  const x = S.indiv[name] || (S.indiv[name] = { t, p: 0 });
  x.t = t; x.p = Math.max(0, x.p + n);
  save(); pushScores();
}
// 동점은 같은 등수 (1, 1, 3 …)
function ranked() {
  const list = allPlayers().sort((a, b) => b.p - a.p || a.n.localeCompare(b.n, 'ko'));
  let r = 0, prev = null;
  return list.map((x, i) => { if (x.p !== prev) { r = i + 1; prev = x.p; } return { ...x, r }; });
}

// "누가 맞혔나요?" 창: 팀 점수가 오를 때 아래에 뜸. 여러 번 오르면 차례로 물음
const whoQ = [];
function askWho(t, n) {
  if (!S.askWho || !teamMembers(t).length) return;
  whoQ.push({ t, n });
  if (whoQ.length === 1) showWho();
  else showWho(true);
}
function showWho(onlyCount) {
  let el = $('#whosheet');
  const q = whoQ[0];
  if (!q) { if (el) el.remove(); return; }
  if (onlyCount && el) { const c = el.querySelector('.wq'); if (c) { c.textContent = `다음 ${whoQ.length - 1}건`; c.style.display = ''; } return; }
  if (!el) { el = document.createElement('div'); el.id = 'whosheet'; document.body.appendChild(el); }
  const step = S.indivStep || 1;
  // 폰 버저를 누른 사람이 있으면 맨 앞에 🔔로 표시
  const lb = typeof Party !== 'undefined' && Party.lastBuzz && Party.lastBuzz.team === q.t && Date.now() - Party.lastBuzz.at < 180000 ? Party.lastBuzz.name : null;
  const mem = teamMembers(q.t);
  if (lb && mem.includes(lb)) { mem.splice(mem.indexOf(lb), 1); mem.unshift(lb); }
  el.className = 'whosheet ' + (q.t ? 'B' : 'A');
  el.innerHTML = `
    <div class="wtitle">🏅 ${esc(S.teams[q.t].name)} +${q.n} · <b>누가 맞혔나요?</b> <small>개인 포인트</small> <span class="pill wq" ${whoQ.length > 1 ? '' : 'style="display:none"'}>다음 ${whoQ.length - 1}건</span></div>
    <div class="ngrid">${mem.map((nm) => `<button class="nbtn${nm === lb ? ' cur' : ''}" data-w="${esc(nm)}">${nm === lb ? '🔔 ' : ''}${S.leaders && S.leaders.includes(nm) ? '👑' : ''}${esc(nm)}<small>${(S.indiv[nm] && S.indiv[nm].p) || 0}점</small></button>`).join('')}</div>
    <div class="row">${[1, 2, 3].map((k) => `<button class="chip ${step === k ? 'on' : ''}" data-step="${k}">+${k}점</button>`).join('')}
      <button class="btn" data-all>👥 팀 전원 +${step}</button><button class="btn" data-skip>건너뛰기</button></div>`;
  el.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.step) { S.indivStep = Number(b.dataset.step); save(); return showWho(); }
    if (b.dataset.w !== undefined) { addIndiv(b.dataset.w, q.t, step); sfx.ok(); toast(`🏅 ${b.dataset.w} +${step}점`); }
    else if (b.hasAttribute('data-all')) { teamMembers(q.t).forEach((nm) => addIndiv(nm, q.t, step)); sfx.ok(); toast(`🏅 ${S.teams[q.t].name} 전원 +${step}점`); }
    whoQ.shift(); showWho();
  };
}

// 🔔 폰 버저 [⭕ 정답]: 지금 화면의 정답 버튼을 대신 누르고, 누른 사람에게 개인 포인트
//   사전 게임(개인전)·OST 드래프트는 이름 버튼, 팀전은 그 팀 [정답] 버튼 + 개인 +n점
let bzGave = null; // 🎤 사회자 폰 [↩️ 취소]용: 방금 버저 정답으로 준 개인 포인트
function buzzCorrect(f) {
  bzGave = null;
  if (S.pre && (current === 'music' || current === 'ost')) {
    // 폰에서 직접 입력한 이름 → 명단과 띄어쓰기만 다르면 명단 이름으로, 명단에 없으면 추가
    const nz = (x) => String(x).replace(/\s+/g, '');
    let nm = (S.players || []).find((x) => nz(x) === nz(f.name));
    if (!nm) {
      nm = f.name; S.players = [...(S.players || []), nm];
      if (S.dft) { const n = S.players.length; S.dft.cap = [Math.ceil(n / 2), Math.floor(n / 2)]; } // 드래프트 정원 다시 계산
      save(); toast(`👤 ${nm} 님을 참가자 명단에 추가했어요`, 2500);
    }
    const fn = actions[S.dft ? 'dwho' : 'solo'];
    if (fn) fn(nm);
    return;
  }
  if (!(f.team >= 0)) { toast('팀이 없는 참가자예요. 팀 [정답] 버튼을 직접 눌러 주세요', 3500); return; }
  const b = main.querySelector(`[data-a="win"][data-v="${f.team}"]`);
  if (!b || b.disabled) { toast('이 화면에서는 정답 버튼을 직접 눌러 주세요', 3000); return; }
  remoteClick = true; // "누가 맞혔나요?" 대신 버저 누른 사람에게 바로 개인 포인트
  try { b.click(); } finally { remoteClick = false; }
  const ip = S.indivStep || 1;
  const nm = teamMembers(f.team).find((x) => x.replace(/\s+/g, '') === f.name.replace(/\s+/g, '')) || f.name;
  addIndiv(nm, f.team, ip); bzGave = { name: nm, team: f.team, ip };
  toast(`🔔 ${f.name} 정답! 🏅 +${ip}점`, 2500);
}

// 참가자 폰으로 점수 보내기 (노트북 서버 + 📱 폰 연결이 열려 있을 때만)
let pushT = null;
function scorePayload() {
  return {
    mode: S.scoreShow, leaders: S.leaders || null, set: S.set,
    teams: S.teams.map((t) => ({ name: t.name, score: t.score })),
    indiv: allPlayers().map((x) => ({ name: x.n, team: x.t, pts: x.p })),
  };
}
function pushScores() {
  clearTimeout(pushT);
  pushT = setTimeout(() => {
    if (typeof Party === 'undefined' || !S.partyHt || !NET.info) return;
    Party.act('score', { scores: scorePayload() });
  }, 250);
}

// ═══════════════════════ 화면 전환 ═══════════════════════
let actions = {};
let cleanups = [];
function onCleanup(fn) { cleanups.push(fn); }
let current = null;
function go(name, ...args) {
  cleanups.forEach((fn) => fn()); cleanups = [];
  current = name;
  actions = {};
  stopClip();
  main.scrollTop = 0;
  const g = GAMES.find((x) => x.key === name);
  CTL = { title: g ? `${g.ic} ${g.t}` : (SCREEN_NAMES[name] || name), can: [] }; // 화면이 render 때 setCtl로 채움
  screens[name](...args);
  pushCtl();
}

// ── 🎤 사회자 폰 진행 버튼 ──
// 각 화면이 "지금 누를 수 있는 버튼 + 현재 정답"을 setCtl로 알려 주면 사회자 폰에만 보냄 (참가자 폰에는 안 감)
// can: [{ a: data-a, v: data-v, l: 버튼 글자, k: 'big' 등 }], win: { pts } 이면 팀 정답 버튼, answer/detail: 정답
const SCREEN_NAMES = { home: '🏠 홈', sound: '🔊 사운드 준비', settings: '⚙️ 설정', scores: '🏅 점수판', awards: '🏆 시상식', preResult: '👑 리더 발표', phones: '📱 폰 연결', remote: '🎤 사회자 폰 연결' };
let CTL = null, ctlT = null;
function setCtl(c) { CTL = { title: CTL ? CTL.title : '', can: [], ...c }; pushCtl(); }
function pushCtl() {
  clearTimeout(ctlT);
  ctlT = setTimeout(() => { if (typeof Party !== 'undefined' && S.partyHt && NET.info) Party.act('ctl', { ctl: CTL }); }, 150);
}
main.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = actions[el.dataset.a]; if (fn) fn(el.dataset.v, el);
});

// 화면 꺼짐 방지
let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* 미지원 */ }
}
document.addEventListener('click', () => { keepAwake(); audio(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

// 카운트다운 타이머 (초 단위, 0.1초 간격 갱신)
function countdown(sec, onTick, onEnd) {
  const end = Date.now() + sec * 1000; let last = -1;
  const id = setInterval(() => {
    const left = Math.max(0, (end - Date.now()) / 1000), whole = Math.ceil(left);
    if (whole !== last) { last = whole; onTick(whole); }
    if (left <= 0) { clearInterval(id); onEnd(); }
  }, 100);
  onCleanup(() => clearInterval(id));
  return () => clearInterval(id);
}

// ═══════════════════════ YouTube 플레이어 ═══════════════════════
const SETUP_VIDEO = 'gdZLi9oWNZg'; // 사운드 확인용 (퀴즈에 없는 곡: BTS Dynamite)
let yt = null, ytReady = false, ytUnlocked = false, ytCurrent = null, clipPoll = null, onYtPlaying = null;

window.onYouTubeIframeAPIReady = function () {
  yt = new YT.Player('yt', {
    width: '100%', height: '100%', videoId: SETUP_VIDEO,
    playerVars: { playsinline: 1, rel: 0, controls: 1, modestbranding: 1, fs: 0 },
    events: {
      onReady: () => { ytReady = true; },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING) {
          // YouTube 자동 자막이 대사(정답)를 미리 보여 주지 않도록 자막을 끔
          try { yt.unloadModule('captions'); yt.unloadModule('cc'); } catch (err) { /* 자막 없음 */ }
          if (!ytUnlocked) { ytUnlocked = true; if ($('#yt-wrap').classList.contains('yt-setup')) { sfx.ok(); toast('🔊 소리 준비 완료! 아래 [완료]를 눌러주세요'); } }
          if (onYtPlaying) onYtPlaying(true);
        } else if (onYtPlaying) onYtPlaying(false);
      },
      onError: (e) => {
        stopClip();
        toast(`이 곡은 재생할 수 없어요 (오류 ${e.data}). [다음]으로 넘어가 주세요`, 4000);
      },
    },
  });
};

function cueSong(song) {
  if (!ytReady) return;
  yt.cueVideoById({ videoId: song.id, startSeconds: song.start || 0 });
  ytCurrent = song.id;
}
function playClip(song, sec, onProgress) {
  if (!ytReady) { toast('YouTube 로딩 중이에요. 인터넷 연결을 확인해 주세요'); return; }
  stopClip();
  const start = song.start || 0;
  if (ytCurrent !== song.id) { yt.loadVideoById({ videoId: song.id, startSeconds: start }); ytCurrent = song.id; }
  else { yt.seekTo(start, true); yt.playVideo(); }
  const began = Date.now();
  clipPoll = setInterval(() => {
    const st = yt.getPlayerState(), t = yt.getCurrentTime() - start;
    if (st === YT.PlayerState.PLAYING) {
      if (onProgress && sec) onProgress(Math.min(1, t / sec));
      if (sec && t >= sec) { yt.pauseVideo(); clearInterval(clipPoll); clipPoll = null; }
    } else if (!ytUnlocked && Date.now() - began > 3500) {
      clearInterval(clipPoll); clipPoll = null;
      toast('소리가 안 나오나요? 🏠 홈 → 🔊 사운드 준비를 먼저 해주세요', 4000);
    }
  }, 30);
}
function stopClip() {
  if (clipPoll) { clearInterval(clipPoll); clipPoll = null; }
  if (ytReady && yt.getPlayerState && yt.getPlayerState() === YT.PlayerState.PLAYING) yt.pauseVideo();
}

// 초성 힌트: 한글은 초성, 영문은 첫 글자만 남기고 밑줄. keep: 앞에서부터 그대로 보여줄 한글 글자 수
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function chosung(str, keep = 0) {
  let shown = 0;
  return str.split(' ').map((w) => {
    let firstLatin = true;
    return [...w].map((ch) => {
      const c = ch.charCodeAt(0);
      if (c >= 0xac00 && c <= 0xd7a3) return shown++ < keep ? ch : CHO[(c - 0xac00) / 588 | 0];
      if (/[a-z]/i.test(ch)) { const r = firstLatin ? ch.toUpperCase() : '_'; firstLatin = false; return r; }
      return ch;
    }).join('');
  }).join(' ');
}

// ═══════════════════════ 화면들 ═══════════════════════
const GAMES = [
  { key: 'teams', ic: '🎲', t: '팀 나누기', d: '운명의 A팀 vs B팀' },
  { key: 'music', ic: '🎵', t: '1초 노래 퀴즈', d: '전주 듣고 맞히기' },
  { key: 'ost', ic: '🎬', t: 'OST 퀴즈', d: '드라마·영화 맞히기' },
  { key: 'chosung', ic: '🔤', t: '초성 퀴즈', d: 'ㅇㅈㅇ ㄱㅇ?' },
  { key: 'photo', ic: '📸', t: '확대 사진 퀴즈', d: '이 얼굴 누구게?' },
  { key: 'scene', ic: '📺', t: '다음 장면 맞히기', d: '영상 보고 예측' },
  { key: 'charades', ic: '🎭', t: '몸으로 말해요', d: '고요 속의 외침' },
  // 이번 워크샵에서는 빼기로 함 (코드는 남아 있어서 아래 줄 주석만 풀면 다시 나옴)
  // { key: 'draw', ic: '🎨', t: '캐치마인드', d: '릴레이 그림 퀴즈' },
  // { key: 'bomb', ic: '💣', t: '폭탄 돌리기', d: '터지면 벌칙!' },
  // { key: 'allin', ic: '🔥', t: '올인 역전', d: '마지막 대역전' },
  { key: 'mafia', ic: '🕵️', t: '마피아', d: '사회자 진행' },
  { key: 'liar', ic: '🤥', t: '라이어 게임', d: '거짓말쟁이를 찾아라' },
  // { key: 'tables', ic: '🏓', t: '탁구·당구', d: '2부 대항전' },
  { key: 'gift', ic: '🎁', t: '상품 뽑기', d: '패배팀 랜덤 선물' },
  { key: 'roulette', ic: '🎰', t: '벌칙 룰렛', d: '운명의 룰렛' },
];

const screens = {};

// ── 홈 ──
screens.home = () => {
  main.innerHTML = `
    <div class="screen">
      <div class="hero"><h1>🎉 워크샵 파티 쇼</h1></div>
      <div class="grid">
        ${GAMES.map((g) => `<button class="card" data-a="open" data-v="${g.key}"><span class="ic">${g.ic}</span><span class="t">${g.t}</span><span class="d">${g.d}</span></button>`).join('')}
      </div>
      <div class="tools">
        <button class="btn ${ytUnlocked ? 'ok' : 'gold'}" data-a="sound">${ytUnlocked ? '✅ 사운드 준비됨' : '🔊 사운드 준비 (먼저!)'}</button>
        ${NET.info ? '<button class="btn primary" data-a="phones">📱 폰 연결</button><button class="btn" data-a="remote">🎤 사회자 폰</button>' : ''}
        <button class="btn" data-a="scores">🏅 점수판</button>
        <button class="btn" data-a="fs">⛶ 전체화면</button>
        <button class="btn" data-a="settings">⚙️ 설정</button>
      </div>
    </div>`;
  actions = {
    open: (k) => go(k),
    sound: () => go('sound'),
    phones: () => go('phones'),
    remote: () => go('remote'),
    scores: () => go('scores'),
    settings: () => go('settings'),
    fs: () => {
      const d = document.documentElement;
      if (document.fullscreenElement) document.exitFullscreen();
      else if (d.requestFullscreen) d.requestFullscreen().catch(() => toast('이 브라우저는 전체화면을 지원하지 않아요'));
      else toast('iPhone은 공유 → "홈 화면에 추가"로 열면 전체화면이 돼요', 4000);
    },
  };
};

// ── 사운드 준비 ──
screens.sound = () => {
  const wrap = $('#yt-wrap');
  wrap.className = 'yt-setup';
  if (ytReady && ytCurrent !== SETUP_VIDEO) { yt.cueVideoById(SETUP_VIDEO); ytCurrent = SETUP_VIDEO; }
  main.innerHTML = `
    <div class="screen sound-screen" style="align-items:center;text-align:center">
      <div class="head" style="justify-content:center"><h2>🔊 사운드 준비</h2></div>
      <p class="notice" style="margin:0">영상의 ▶ 재생 버튼을 <u>손가락으로 직접</u> 한 번 눌러 주세요</p>
      <p class="sub" style="color:var(--muted);margin:0">처음 한 번은 직접 눌러야 이후 퀴즈 음악이 자동 재생돼요.<br>무음 모드를 끄고 볼륨을 올려 주세요.</p>
      <div class="spacer"></div>
      <button class="btn big primary" data-a="done">완료</button>
    </div>`;
  actions = { done: () => go('home') };
  onCleanup(() => { wrap.className = 'yt-hidden'; if (ytReady) yt.pauseVideo(); });
};

// ── 🎵 1초 노래 퀴즈 / 🎬 OST 퀴즈 (같은 엔진) ──
const AUDIO_QUIZ = {
  music: {
    title: '🎵 1초 노래 퀴즈', sub: '먼저 "정답!" 외친 팀이 도전',
    list: () => SONGS,
    answer: (s) => s.title, detail: (s) => `${s.artist} · ${s.year}`,
    hints: [{ label: '초성 힌트', big: true, text: (s) => chosung(s.title) }, { label: '가수 힌트', text: (s) => '가수: ' + s.artist }],
  },
  ost: {
    title: '🎬 OST 퀴즈', sub: '어떤 드라마·영화일까?',
    filters: ['전체', '드라마', '영화'],
    list: ostList,
    answer: (s) => s.work, detail: (s) => `${s.song} - ${s.artist}`,
    hints: [{ label: '장르·연도 힌트', text: (s) => `${s.type} · ${s.year}` }, { label: '초성 힌트', big: true, text: (s) => chosung(s.work) }],
  },
};

// ═══════════ 🎵 사전 게임(노래 퀴즈 개인전) → 👑 리더 발표 → 🎬 OST 드래프트 ═══════════
// S.pre = { pts: {이름: 점수}, log: [이름…] }   팀이 정해지기 전의 개인 점수 (드래프트가 끝나면 개인 포인트로 옮김)
// S.dft = { L: [A리더, B리더], teams: [[…], […]], cap: [A정원, B정원], log: [{ n, t, who }] }
//   OST 문제를 리더·팀원이 맞히면 그 팀 리더가 1명 지목, 아직 안 뽑힌 사람이 맞히면 본인이 팀을 고름
const prePts = (n) => (S.pre && S.pre.pts[n]) || 0;
const preOn = () => !!(S.pre && !S.dft);
function dftTeamOf(n) { const D = S.dft; return !D ? -1 : D.teams[0].includes(n) ? 0 : D.teams[1].includes(n) ? 1 : -1; }
function dftPool() { return (S.players || []).filter((n) => dftTeamOf(n) < 0); }
function preRank() {
  return (S.players || []).map((n) => ({ n, p: prePts(n) })).sort((a, b) => b.p - a.p || (S.players.indexOf(a.n) - S.players.indexOf(b.n)));
}
function dftStart(L) {
  const n = (S.players || []).length;
  S.dft = { L: L.slice(), teams: [[L[0]], [L[1]]], cap: [Math.ceil(n / 2), Math.floor(n / 2)], log: [] };
  S.leaders = L.slice();
  if (S.leaderTeamName !== false) { S.teams[0].name = `${L[0]}팀`.slice(0, 12); S.teams[1].name = `${L[1]}팀`.slice(0, 12); renderScore(); }
  save();
}
// 1명 배정. 한 팀 정원이 차면 남은 사람은 모두 상대 팀으로 → 드래프트 끝. 끝나면 { teams, L, auto } 반환
function dftAssign(n, t, who) {
  const D = S.dft;
  D.teams[t].push(n); D.log.push({ n, t, who });
  if (S.pre) S.pre.pts[who] = prePts(who) + 1;
  let pool = dftPool(), auto = [];
  for (const k of [0, 1]) if (pool.length && D.teams[k].length >= D.cap[k]) { D.teams[1 - k].push(...pool); auto = pool.map((x) => ({ n: x, t: 1 - k })); pool = []; }
  save();
  if (pool.length) return null;
  // ── 팀 완성: 명단·리더·개인 포인트 확정 → 이제부터 팀전 ──
  const res = { teams: D.teams.map((a) => a.slice()), L: D.L.slice(), auto };
  S.roster = res.teams; S.leaders = res.L;
  Object.entries((S.pre && S.pre.pts) || {}).forEach(([nm, p]) => {
    const k = res.teams[0].includes(nm) ? 0 : res.teams[1].includes(nm) ? 1 : -1;
    if (k < 0 || !p) return;
    const x = S.indiv[nm] || (S.indiv[nm] = { t: k, p: 0 }); x.t = k; x.p += p;
  });
  S.pre = null; S.dft = null; save(); pushScores();
  if (typeof Party !== 'undefined' && Party.h) Party.open(); // 폰 연결 명단·팀 이름 갱신
  return res;
}
const nameBtns = (a, cls) => `<div class="ngrid sm">${(S.players || []).map((n) => `<button class="nbtn${cls ? cls(n) : ''}" data-a="${a}" data-v="${esc(n)}">${S.leaders && S.dft && S.leaders.includes(n) ? '👑' : ''}${esc(n)}<small>${prePts(n)}점</small></button>`).join('')}</div>`;
screens.music = (kind = 'music') => {
  const Q = AUDIO_QUIZ[kind];
  // 필터(전체/드라마/영화)별 진행 위치 + 이미 푼 곡을 기억 → 필터를 오가거나 화면을 나갔다 와도 이어서, 푼 곡은 건너뜀
  // 순서는 그대로 두고 건너뛰기만 하므로 정답지 Q 번호와 계속 일치
  if (!S.quizPos) S.quizPos = {};
  if (!S.quizDone) S.quizDone = {};
  if (!S.quizFilter) S.quizFilter = {};
  let filter = Q.filters ? (Q.filters.includes(S.quizFilter[kind]) ? S.quizFilter[kind] : Q.filters[0]) : null, list = Q.list(filter);
  const orderFor = (f) => seededOrder(list.length, kind + (f ? ':' + f : ''), S.set);
  let order = orderFor(filter);
  let i = 0, hint = 0, revealed = false, playing = false;
  let pend = null, fin = null; // OST 드래프트: 방금 맞힌 사람 / 팀 완성 결과
  const isSolo = () => kind === 'music' && preOn();
  const isDft = () => kind === 'ost' && !!S.dft;
  const song = () => list[order[i]];
  const sid = (s) => s.id + '|' + Q.answer(s);
  const dk = () => kind + ':' + S.set, pk = () => dk() + ':' + (filter || '');
  const done = () => new Set(S.quizDone[dk()] || []);
  const markDone = () => { const a = S.quizDone[dk()] || (S.quizDone[dk()] = []), k = sid(song()); if (!a.includes(k)) a.push(k); save(); };
  const savePos = () => { S.quizPos[pk()] = i; if (filter) S.quizFilter[kind] = filter; save(); };
  const leftCount = () => { const d = done(); return order.filter((k) => !d.has(sid(list[k]))).length; };
  function nextOpen(from) {
    const d = done();
    for (let k = 0; k < order.length; k++) { const j = (from + k) % order.length; if (!d.has(sid(list[order[j]]))) return j; }
    toast('이 목록의 곡을 모두 풀었어요. [↺ 처음부터]로 다시 할 수 있어요', 3500);
    return from % order.length;
  }
  i = nextOpen(S.quizPos[pk()] || 0); savePos();

  function render() {
    const s = song();
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>${Q.title}</h2>${Q.filters
          ? `<div class="chips">${Q.filters.map((f) => `<button class="chip ${f === filter ? 'on' : ''}" data-a="filter" data-v="${f}">${f}</button>`).join('')}</div>`
          : `<span class="sub">${isSolo() ? '👤 사전 게임 · 개인전 — 1·2등이 리더!' : Q.sub}</span>`}</div>
        <div class="stage-wrap">
          <div class="stage">
            <div class="qno">Q ${i + 1} <small style="font-size:.6em">· 남은 ${leftCount()} / ${list.length}</small></div>
            ${isSolo() ? `<div class="pill dstat">${preRank().slice(0, 3).filter((x) => x.p).map((x, k) => `${'🥇🥈🥉'.slice(k * 2, k * 2 + 2)} ${esc(x.n)} ${x.p}`).join(' · ') || '🎤 먼저 맞히는 사람이 점수!'}</div>` : ''}
            ${isDft() ? `<div class="pill dstat"><span style="color:var(--A)">👑 ${esc(S.dft.L[0])} ${S.dft.teams[0].length}/${S.dft.cap[0]}</span> · <span style="color:var(--B)">👑 ${esc(S.dft.L[1])} ${S.dft.teams[1].length}/${S.dft.cap[1]}</span> · 남은 ${dftPool().length}명</div>` : ''}
            <div class="disc ${playing ? 'spin' : ''}" id="disc"></div>
            <div class="bar"><i id="prog"></i></div>
            ${revealed ? '' : Q.hints.slice(0, hint).map((h) => `<div class="${h.big ? 'hint' : 'pill'} pop">${esc(h.text(s))}</div>`).join('')}
            ${revealed ? `<div class="answer pop">${esc(Q.answer(s))}<small>${esc(Q.detail(s))}</small></div>` : ''}
          </div>
          <div class="controls">
            <div class="row">
              <button class="btn primary" data-a="clip" data-v="1">1초</button>
              <button class="btn primary" data-a="clip" data-v="3">3초</button>
              <button class="btn primary" data-a="clip" data-v="5">5초</button>
              <button class="btn primary" data-a="clip" data-v="10">10초</button>
            </div>
            <div class="row">
              <button class="btn" data-a="full">▶ 계속 듣기</button>
              <button class="btn" data-a="stop">■ 정지</button>
            </div>
            <div class="row">
              <button class="btn gold" data-a="hint" ${hint >= Q.hints.length ? 'disabled' : ''}>💡 ${hint < Q.hints.length ? Q.hints[hint].label : '힌트 끝'}</button>
              <button class="btn" data-a="reveal">👀 정답</button>
            </div>
            ${isSolo() ? `
            <p class="mini">🙋 맞힌 사람을 누르세요 (+1점)</p>${nameBtns('solo')}
            <div class="row"><button class="btn" data-a="soloUndo" ${S.pre.log.length ? '' : 'disabled'}>↩️ 점수 취소</button><button class="btn gold" data-a="preEnd">🏁 사전 게임 끝</button></div>`
            : isDft() ? `
            <p class="mini">🙋 맞힌 사람 → 한 명 데려오기 (+1점)</p>${nameBtns('dwho', (n) => { const t = dftTeamOf(n); return t === 0 ? ' tA' : t === 1 ? ' tB' : ''; })}
            <div class="row"><button class="btn" data-a="dundo" ${S.dft.log.length ? '' : 'disabled'}>↩️ 드래프트 취소</button></div>`
            : `<div class="row">
              <button class="btn A" data-a="win" data-v="0">${esc(S.teams[0].name)} 정답</button>
              <button class="btn B" data-a="win" data-v="1">${esc(S.teams[1].name)} 정답</button>
            </div>`}
            <div class="row">
              <button class="btn" data-a="prev" ${i === 0 ? 'disabled' : ''}>◀ 이전</button>
              <button class="btn" data-a="next">다음 ▶</button>
              <button class="btn" data-a="restart" title="이 목록 처음부터" style="flex:0 0 auto;padding:6px 10px">↺</button>
            </div>
          </div>
        </div>
        ${pend && isDft() ? dftSheet() : fin ? finSheet() : ''}
      </div>`;
    if (pend && isDft()) {
      const t = dftTeamOf(pend), D = S.dft;
      return setCtl({ q: `🎉 ${pend} 정답!`, answer: t >= 0 ? `👑 ${D.L[t]} 리더가 고를 차례` : `${pend} 님이 팀을 고를 차례`, detail: Q.answer(s), revealed: true,
        can: [...(t >= 0 ? dftPool().map((n) => ({ a: 'dtake', v: n, l: n })) : [0, 1].filter((k) => D.teams[k].length < D.cap[k]).map((k) => ({ a: 'djoin', v: String(k), l: `→ 👑${D.L[k]}팀`, k: 'big' }))), { a: 'dcancel', l: '✖ 잘못 눌렀어요' }] });
    }
    if (fin) return setCtl({ q: '⚔️ 팀 완성!', answer: `${fin.L[0]}팀 vs ${fin.L[1]}팀`, revealed: true, can: [{ a: 'ddone', l: '✅ 이대로 시작', k: 'big' }] });
    const who = isSolo() ? (S.players || []).map((n) => ({ a: 'solo', v: n, l: `🙋 ${n} +1` }))
      : isDft() ? (S.players || []).map((n) => ({ a: 'dwho', v: n, l: `🙋 ${n}` })) : null;
    if (who) return setCtl({
      q: `Q ${i + 1}${filter ? ` · ${filter}` : ''}${isSolo() ? ' · 개인전' : ' · 드래프트'}`, answer: Q.answer(s), detail: Q.detail(s), revealed,
      can: [{ a: 'clip', v: '1', l: '1초' }, { a: 'clip', v: '3', l: '3초' }, { a: 'clip', v: '5', l: '5초' }, { a: 'stop', l: '■ 정지' },
        ...(hint < Q.hints.length ? [{ a: 'hint', l: '💡 ' + Q.hints[hint].label }] : []), { a: 'reveal', l: '👀 정답 공개' },
        { a: 'next', l: '다음 ▶', k: 'big' }, ...who],
    });
    setCtl({
      q: `Q ${i + 1}${filter ? ` · ${filter}` : ''}`, answer: Q.answer(s), detail: Q.detail(s), revealed,
      win: revealed ? null : { pts: 1 },
      can: [
        { a: 'clip', v: '1', l: '1초' }, { a: 'clip', v: '3', l: '3초' }, { a: 'clip', v: '5', l: '5초' }, { a: 'clip', v: '10', l: '10초' },
        { a: 'full', l: '▶ 계속 듣기' }, { a: 'stop', l: '■ 정지' },
        ...(hint < Q.hints.length ? [{ a: 'hint', l: '💡 ' + Q.hints[hint].label }] : []),
        { a: 'reveal', l: '👀 정답 공개' },
        ...(i > 0 ? [{ a: 'prev', l: '◀ 이전' }] : []), { a: 'next', l: '다음 ▶', k: 'big' },
      ],
    });
  }
  function dftSheet() {
    const D = S.dft, t = dftTeamOf(pend);
    if (t >= 0) return `<div class="dsheet"><div class="dcard ${t ? 'B' : 'A'}">
        <div class="dtitle">🎉 <b>${esc(pend)}</b> 정답! <span>👑 ${esc(D.L[t])} 리더가 데려갈 사람을 고르세요</span></div>
        <div class="ngrid">${dftPool().map((n) => `<button class="nbtn" data-a="dtake" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>
        <div class="row"><button class="btn" data-a="dcancel">✖ 잘못 눌렀어요</button></div></div></div>`;
    return `<div class="dsheet"><div class="dcard">
        <div class="dtitle">🎉 <b>${esc(pend)}</b> 님 정답! <span>어느 팀으로 가시겠어요?</span></div>
        <div class="row">${[0, 1].map((k) => `<button class="btn big ${k ? 'B' : 'A'}" data-a="djoin" data-v="${k}" ${D.teams[k].length >= D.cap[k] ? 'disabled' : ''}>👑 ${esc(D.L[k])}팀 <small>${D.teams[k].length}/${D.cap[k]}</small></button>`).join('')}</div>
        <div class="row"><button class="btn" data-a="dcancel">✖ 잘못 눌렀어요</button></div></div></div>`;
  }
  function finSheet() {
    const col = (k) => `<div class="tcol ${k ? 'B' : 'A'}"><div class="tname">👑 ${esc(fin.L[k])}팀 <small>${fin.teams[k].length}명</small></div>${fin.teams[k].map((n) => `<div class="tmember">${fin.L.includes(n) ? '👑 ' : ''}${esc(n)}</div>`).join('')}</div>`;
    return `<div class="dsheet"><div class="dcard wide">
        <div class="dtitle">⚔️ <b>팀 완성!</b> <span>${fin.auto.length ? `남은 ${fin.auto.map((x) => esc(x.n)).join(', ')} 님은 자동 배정 · ` : ''}이제부터 팀전입니다</span></div>
        <div class="dteams">${col(0)}${col(1)}</div>
        <button class="btn big primary" data-a="ddone">✅ 이대로 시작</button></div></div>`;
  }
  function pickDone(n, t, who) {
    pend = null; sfx.fanfare(); flash(t ? 'var(--B)' : 'var(--A)');
    const L = S.dft.L[t];
    toast(n === who ? `🙋 ${n} 님 → 👑 ${L}팀!` : `👑 ${L} 리더 → ${n} 님 영입!`, 2500);
    const r = dftAssign(n, t, who);
    if (r) fin = r;
    render();
  }
  const setProg = (p) => { const el = $('#prog'); if (el) el.style.width = (p * 100) + '%'; };
  onYtPlaying = (on) => { playing = on; const d = $('#disc'); if (d) d.classList.toggle('spin', on); };
  onCleanup(() => { onYtPlaying = null; });
  // 다음은 안 푼 곡으로 건너뛰고, 이전은 바로 앞 곡(다시 듣기용)
  const move = (d) => { stopClip(); i = d > 0 ? nextOpen(i + 1) : (i - 1 + list.length) % list.length; hint = 0; revealed = false; savePos(); render(); cueSong(song()); Party.buzzReset(); };
  Party.buzzer(() => stopClip()); // 폰 버저: 누가 누르면 노래를 멈춤

  actions = {
    filter: (f) => { stopClip(); filter = f; list = Q.list(f); order = orderFor(f); i = nextOpen(S.quizPos[pk()] || 0); hint = 0; revealed = false; savePos(); render(); cueSong(song()); Party.buzzReset(); },
    restart: () => {
      if (!confirm(`${filter ? `'${filter}' 목록을` : '처음부터'} 다시 할까요?\n(이 목록에서 푼 곡이 다시 나옵니다)`)) return;
      const mine = new Set(order.map((k) => sid(list[k])));
      S.quizDone[dk()] = (S.quizDone[dk()] || []).filter((x) => !mine.has(x));
      stopClip(); i = 0; hint = 0; revealed = false; savePos(); render(); cueSong(song()); Party.buzzReset(); toast('↺ 처음부터');
    },
    clip: (v) => { setProg(0); playClip(song(), Number(v), setProg); },
    full: () => { setProg(1); playClip(song(), 0); },
    stop: () => stopClip(),
    hint: () => { if (hint < Q.hints.length) { hint++; sfx.beep(); render(); } },
    reveal: () => { revealed = true; markDone(); sfx.fanfare(); render(); },
    win: (t) => { addScore(Number(t), 1); sfx.ok(); flash(t === '0' ? 'var(--A)' : 'var(--B)'); revealed = true; markDone(); render(); playClip(song(), 0); Party.banner(null); },
    prev: () => move(-1),
    next: () => move(1),
    // 🎵 사전 게임(개인전)
    solo: (n) => {
      if (!isSolo()) return;
      S.pre.pts[n] = prePts(n) + 1; S.pre.log.push(n); save();
      sfx.ok(); flash('var(--gold)'); toast(`🏅 ${n} +1점`);
      if (!revealed) { revealed = true; markDone(); playClip(song(), 0); }
      render(); Party.banner(null);
    },
    soloUndo: () => { const n = S.pre && S.pre.log.pop(); if (!n) return; S.pre.pts[n] = Math.max(0, prePts(n) - 1); save(); sfx.tick(); toast(`↩️ ${n} −1점`); render(); },
    preEnd: () => go('preResult'),
    // 🎬 OST 드래프트
    dwho: (n) => {
      if (!isDft() || pend) return;
      pend = n; sfx.ok();
      if (!revealed) { revealed = true; markDone(); playClip(song(), 0); }
      render(); Party.banner(null);
    },
    dcancel: () => { pend = null; render(); },
    dtake: (n) => { const t = dftTeamOf(pend); if (!pend || t < 0 || dftTeamOf(n) >= 0) return; pickDone(n, t, pend); },
    djoin: (v) => { const t = Number(v), D = S.dft; if (!pend || dftTeamOf(pend) >= 0 || D.teams[t].length >= D.cap[t]) return; pickDone(pend, t, pend); },
    dundo: () => {
      const D = S.dft, x = D && D.log.pop(); if (!x) return;
      D.teams[x.t].splice(D.teams[x.t].indexOf(x.n), 1);
      if (S.pre) S.pre.pts[x.who] = Math.max(0, prePts(x.who) - 1);
      save(); sfx.tick(); toast(`↩️ ${x.n} 님 선택 취소`); render();
    },
    ddone: () => { fin = null; sfx.fanfare(); render(); },
  };
  render(); cueSong(song());
};

screens.ost = () => screens.music('ost');

// ── 🎲 팀 나누기 ──
screens.teams = () => {
  const parse = (txt) => [...new Set(txt.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
  const tms = [];
  const later = (fn, ms) => { tms.push(setTimeout(fn, ms)); };
  onCleanup(() => tms.forEach(clearTimeout));

  function setup() {
    const players = S.players || [];
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🎲 팀 나누기</h2><span class="sub">참가자 이름을 한 줄에 한 명씩</span></div>
        <div class="stage-wrap">
          <div class="stage" style="align-items:stretch">
            <textarea id="names" class="names" placeholder="예)&#10;김철수&#10;이영희&#10;박민수">${esc(players.join('\n'))}</textarea>
          </div>
          <div class="controls">
            <div class="pill" id="cnt" style="text-align:center">${players.length}명</div>
            ${S.pre ? `<button class="btn big primary" data-a="resume">▶ ${S.dft ? '🎬 OST 드래프트' : '🎵 사전 게임'} 이어서</button>` : ''}
            <button class="btn big gold" data-a="pre">🎵 사전 게임 → OST 드래프트</button>
            <p class="sub" style="margin:0;text-align:center;color:var(--muted)">노래 퀴즈 개인전 1·2등이 리더,<br>OST 퀴즈를 맞힐 때마다 한 명씩 데려가요</p>
            <button class="btn" data-a="leaders">👑 리더 직접 정하고 번갈아 뽑기</button>
            <button class="btn primary" data-a="draw">🎲 무작위로 나누기</button>
            ${S.roster ? '<button class="btn" data-a="last">📋 지난 결과 보기</button>' : ''}
          </div>
        </div>
      </div>`;
    const ta = $('#names');
    ta.addEventListener('input', () => { $('#cnt').textContent = parse(ta.value).length + '명'; });
    actions = {
      draw: () => {
        const names = parse(ta.value);
        if (names.length < 2) { toast('2명 이상 입력해 주세요'); return; }
        S.players = names; S.leaders = null; save(); draw(names);
      },
      leaders: () => {
        const names = parse(ta.value);
        if (names.length < 4) { toast('리더 드래프트는 4명 이상일 때 할 수 있어요'); return; }
        S.players = names; save(); pickLeaders(names);
      },
      last: () => result(S.roster, true),
      resume: () => go(S.dft ? 'ost' : 'music'),
      pre: () => {
        const names = parse(ta.value);
        if (names.length < 4) { toast('4명 이상 입력해 주세요'); return; }
        if (S.pre && !confirm('진행 중인 사전 게임을 지우고 새로 시작할까요?')) return;
        const had = S.teams.some((t) => t.score) || Object.values(S.indiv).some((x) => x.p);
        if (had && confirm('지난 팀 점수와 개인 포인트가 남아 있어요. 모두 0점으로 지우고 시작할까요?')) { S.teams.forEach((t) => { t.score = 0; }); S.indiv = {}; renderScore(); }
        S.players = names; S.pre = { pts: {}, log: [] }; S.dft = null; S.roster = null; S.leaders = null; save(); pushScores();
        if (typeof Party !== 'undefined' && Party.h) Party.open(); // 폰은 팀 없이 이름만 골라 접속
        go('music'); toast('🎵 사전 게임 시작! 맞힌 사람 이름을 누르면 +1점', 3000);
      },
    };
  }

  // ── 👑 리더 정하기: 사전 게임에서 이긴 2명을 누름 ──
  function pickLeaders(names) {
    let L = (S.leaders || []).filter((n) => names.includes(n)).slice(0, 2), first = 'coin';
    if (S.leaderTeamName === undefined) S.leaderTeamName = true;
    function draw() {
      main.innerHTML = `
        <div class="screen">
          <div class="head"><h2>👑 리더 정하기</h2><span class="sub">사전 게임에서 이긴 2명을 차례로 누르세요 (먼저 누른 사람 = A팀 리더)</span></div>
          <div class="stage-wrap">
            <div class="stage"><div class="ngrid">${names.map((n) => {
              const k = L.indexOf(n);
              return `<button class="nbtn${k === 0 ? ' tA cur' : k === 1 ? ' tB cur' : ''}" data-a="pick" data-v="${esc(n)}">${k >= 0 ? '👑 ' : ''}${esc(n)}${k >= 0 ? `<small>${k ? 'B' : 'A'}팀 리더</small>` : ''}</button>`;
            }).join('')}</div></div>
            <div class="controls">
              <div class="pill" style="text-align:center"><span style="color:var(--A)">A 👑 ${L[0] ? esc(L[0]) : '?'}</span> · <span style="color:var(--B)">B 👑 ${L[1] ? esc(L[1]) : '?'}</span></div>
              <p class="sub" style="margin:0;text-align:center;color:var(--muted)">누가 먼저 뽑을까요?</p>
              <div class="chips">${[['a', 'A 리더 먼저'], ['b', 'B 리더 먼저'], ['coin', '🪙 동전 던지기']].map(([k, l]) => `<button class="chip ${first === k ? 'on' : ''}" data-a="first" data-v="${k}">${l}</button>`).join('')}</div>
              <button class="btn ${S.leaderTeamName ? 'on' : ''}" data-a="rename">🏷 팀 이름을 "리더 이름 + 팀"으로 ${S.leaderTeamName ? 'ON' : 'OFF'}</button>
              <button class="btn big primary" data-a="go" ${L.length < 2 ? 'disabled' : ''}>▶ 드래프트 시작</button>
              <button class="btn" data-a="back">✏️ 명단 수정</button>
            </div>
          </div>
        </div>`;
    }
    actions = {
      pick: (v) => {
        const i = L.indexOf(v);
        if (i >= 0) L.splice(i, 1);
        else if (L.length < 2) { L.push(v); sfx.ok(); flash(L.length === 1 ? 'var(--A)' : 'var(--B)'); }
        else { toast('리더는 2명이에요. 바꾸려면 리더를 한 번 더 눌러 빼 주세요'); return; }
        draw();
      },
      first: (v) => { first = v; draw(); },
      rename: () => { S.leaderTeamName = !S.leaderTeamName; save(); draw(); },
      back: () => setup(),
      go: () => {
        if (L.length < 2) return;
        S.leaders = L.slice(); save();
        if (first !== 'coin') return draft(names, L, first === 'b' ? 1 : 0);
        // 🪙 동전 던지기 연출
        const t = Math.random() < 0.5 ? 0 : 1;
        main.innerHTML = '<div class="screen"><div class="stage"><div class="medal drumroll" style="font-size:clamp(80px,24vmin,180px)">🪙</div><div class="result-big">동전 던지는 중…</div></div></div>';
        actions = {};
        for (let i = 0; i < 12; i++) later(() => sfx.tick(), i * 110);
        later(() => {
          sfx.fanfare(); flash(t ? 'var(--B)' : 'var(--A)');
          main.innerHTML = `<div class="screen"><div class="stage"><div class="result-big pop" style="color:var(--${t ? 'B' : 'A'})">👑 ${esc(L[t])} 리더 먼저!</div></div></div>`;
          later(() => draft(names, L, t), 1500);
        }, 1400);
      },
    };
    draw();
  }

  // ── 드래프트: 리더가 번갈아 1명씩. 마지막 1명은 자동 배정 ──
  function draft(names, L, firstT) {
    const teams = [[L[0]], [L[1]]], picks = [];
    let turn = firstT;
    const pool = () => names.filter((n) => !teams[0].includes(n) && !teams[1].includes(n));
    function draw(last) {
      let rest = pool();
      if (rest.length === 1) { // 마지막 남은 사람은 차례인 팀으로
        teams[turn].push(rest[0]); picks.push({ n: rest[0], t: turn, auto: true });
        toast(`마지막 남은 ${rest[0]} 님은 ${L[turn]} 리더 팀으로!`); last = { n: rest[0], t: turn }; turn = 1 - turn; rest = [];
      }
      if (!rest.length) {
        if (S.leaderTeamName) { S.teams[0].name = `${L[0]}팀`.slice(0, 12); S.teams[1].name = `${L[1]}팀`.slice(0, 12); renderScore(); }
        return later(() => result(teams, false), last ? 900 : 0);
      }
      main.innerHTML = `<div class="screen">${board(teams, `👑 ${L[turn]}`, last ? last.t : null)}</div>`;
      const slot = $('#slot'); slot.className = 'slot ' + (turn ? 'B' : 'A');
      $('#tact').innerHTML = `
        <p class="notice" style="margin:0;text-align:center">${esc(L[turn])} 리더 차례! 뽑을 사람을 누르세요 <small style="color:var(--muted)">(남은 ${rest.length}명)</small></p>
        <div class="ngrid">${rest.map((n) => `<button class="nbtn" data-a="take" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>
        <div class="row"><button class="btn" data-a="undo" ${picks.length ? '' : 'disabled'}>↩️ 취소</button><button class="btn" data-a="restart">✏️ 리더 다시 정하기</button></div>`;
      actions = {
        take: (v) => { teams[turn].push(v); picks.push({ n: v, t: turn }); sfx.ok(); flash(turn ? 'var(--B)' : 'var(--A)'); const t = turn; turn = 1 - turn; draw({ n: v, t }); },
        undo: () => {
          let p = picks.pop(); if (p && p.auto) { teams[p.t].pop(); p = picks.pop(); }
          if (!p) return draw();
          teams[p.t].pop(); turn = p.t; sfx.tick(); draw();
        },
        restart: () => pickLeaders(names),
      };
    }
    draw();
  }

  function board(teams, current, curTeam) {
    const col = (t) => `
      <div class="tcol ${t ? 'B' : 'A'}">
        <div class="tname">${esc(S.teams[t].name)} <small>${teams[t].length}명</small></div>
        ${teams[t].map((n, k) => `<div class="tmember ${k === teams[t].length - 1 && curTeam === t ? 'pop' : ''}">${S.leaders && S.leaders.includes(n) ? '👑 ' : ''}${esc(n)}</div>`).join('')}
      </div>`;
    return `
      <div class="tboard">
        ${col(0)}
        <div class="tcenter">
          <div class="slot ${curTeam === 0 ? 'A' : curTeam === 1 ? 'B' : ''}" id="slot">${esc(current || '')}</div>
          <div class="tactions" id="tact"></div>
        </div>
        ${col(1)}
      </div>`;
  }

  function draw(names) {
    // 공정하게 반반: 섞은 뒤 번갈아 배정, 어느 팀이 한 명 더 받을지도 무작위
    const order = shuffle(names), first = Math.random() < 0.5 ? 0 : 1;
    const assign = order.map((n, k) => ({ n, t: (k + first) % 2 }));
    const teams = [[], []];
    let k = 0, skip = false, timers = [];
    const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); };
    onCleanup(() => timers.forEach(clearTimeout));

    main.innerHTML = `<div class="screen">${board(teams)}</div>`;
    $('#tact').innerHTML = '<button class="btn" data-a="skip">⏩ 한 번에 공개</button>';
    actions = { skip: () => { skip = true; } };

    function next() {
      if (k >= assign.length) return result(teams, false);
      if (skip) { assign.slice(k).forEach((a) => teams[a.t].push(a.n)); k = assign.length; return next(); }
      const { n, t } = assign[k];
      const remain = assign.slice(k).map((a) => a.n);
      // 슬롯머신처럼 이름이 돌다가 멈춤
      let spins = 0; const total = 10;
      const spin = () => {
        if (skip) return next();
        const slot = $('#slot'); if (!slot) return;
        if (spins < total) { slot.textContent = pick(remain); slot.className = 'slot'; sfx.tick(); spins++; later(spin, 30 + spins * 10); return; }
        slot.textContent = n; slot.className = 'slot pop ' + (t ? 'B' : 'A');
        sfx.ok(); flash(t ? 'var(--B)' : 'var(--A)');
        later(() => {
          teams[t].push(n); k++;
          const tact = $('#tact').innerHTML;
          main.innerHTML = `<div class="screen">${board(teams, n, t)}</div>`;
          $('#tact').innerHTML = tact;
          later(next, 350);
        }, 600);
      };
      spin();
    }
    later(next, 300);
  }

  function result(teams, fromSaved) {
    if (!fromSaved) {
      S.roster = teams; save(); sfx.fanfare(); pushScores();
      if (typeof Party !== 'undefined' && Party.h) Party.open(); // 폰 연결 명단·팀 이름 갱신
    }
    main.innerHTML = `<div class="screen">${board(teams, '⚔️ VS ⚔️')}</div>`;
    $('#tact').innerHTML = `
      <button class="btn big primary" data-a="home">✅ 이대로 시작!</button>
      <button class="btn" data-a="again">🔁 다시 뽑기</button>
      <button class="btn" data-a="edit">✏️ 명단 수정</button>`;
    actions = {
      home: () => go('home'),
      again: () => { const names = S.players || [...teams[0], ...teams[1]]; if (S.leaders) pickLeaders(names); else draw(names); },
      edit: () => setup(),
    };
  }

  setup();
};


// ── 👑 사전 게임 결과 → 리더 발표 ──
screens.preResult = () => {
  if (!S.pre) return go('teams');
  const list = preRank();
  let L = list.slice(0, 2).map((x) => x.n), shown = false;
  const tms = []; onCleanup(() => tms.forEach(clearTimeout));
  const later = (fn, ms) => tms.push(setTimeout(fn, ms));
  function draw() {
    const tie2 = list[2] && list[1].p === list[2].p;
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>👑 리더 발표</h2><span class="sub">사전 게임(노래 퀴즈 개인전) 1·2등이 리더</span></div>
        <div class="stage-wrap">
          <div class="stage" style="gap:12px">
            ${shown ? `<div class="result-big pop"><span style="color:var(--A)">👑 ${esc(L[0] || '?')}</span> <small style="font-size:.5em;color:var(--muted)">vs</small> <span style="color:var(--B)">👑 ${esc(L[1] || '?')}</span></div>
              <div class="ngrid">${list.map((x, k) => { const j = L.indexOf(x.n); return `<button class="nbtn${j === 0 ? ' tA cur' : j === 1 ? ' tB cur' : ''}" data-a="pick" data-v="${esc(x.n)}">${j >= 0 ? '👑 ' : ''}${esc(x.n)}<small>${x.p}점</small></button>`; }).join('')}</div>
              ${tie2 ? `<p class="notice" style="margin:0">⚖️ 2등 동점(${list.filter((x) => x.p === list[1].p).map((x) => esc(x.n)).join(', ')})! 가위바위보로 정하고, 이름을 눌러 리더를 바꾸세요</p>` : ''}`
            : `<div class="medal" style="font-size:clamp(80px,24vmin,180px)">🥁</div><div class="sub">두구두구… 오늘의 리더는?</div>`}
          </div>
          <div class="controls">
            ${shown ? `
              <div class="pill" style="text-align:center"><span style="color:var(--A)">A 👑 ${esc(L[0] || '?')}</span> · <span style="color:var(--B)">B 👑 ${esc(L[1] || '?')}</span></div>
              <p class="sub" style="margin:0;text-align:center;color:var(--muted)">이제 🎬 OST 퀴즈를 하면서<br>맞힌 쪽이 한 명씩 데려갑니다</p>
              <button class="btn big primary" data-a="go" ${L.length < 2 ? 'disabled' : ''}>▶ OST 드래프트 시작</button>`
            : '<button class="btn big gold" data-a="drum">🥁 리더 발표</button>'}
            <button class="btn" data-a="back">↩️ 노래 퀴즈로 돌아가기</button>
          </div>
        </div>
      </div>`;
    setCtl({ q: '👑 리더 발표', answer: shown ? `${L[0] || '?'} · ${L[1] || '?'}` : '', can: shown ? (L.length === 2 ? [{ a: 'go', l: '▶ OST 드래프트 시작', k: 'big' }] : []) : [{ a: 'drum', l: '🥁 리더 발표', k: 'big' }] });
  }
  actions = {
    drum: () => {
      main.querySelector('.medal').classList.add('drumroll'); actions = {};
      for (let k = 0; k < 14; k++) later(() => sfx.tick(), k * 110);
      later(() => { shown = true; sfx.fanfare(); flash('var(--gold)'); draw(); setActs(); }, 1600);
    },
  };
  function setActs() {
    actions = {
      pick: (v) => {
        const j = L.indexOf(v);
        if (j >= 0) L.splice(j, 1);
        else if (L.length < 2) L.push(v);
        else { toast('리더는 2명이에요. 바꾸려면 리더를 한 번 더 눌러 빼 주세요'); return; }
        sfx.tick(); draw();
      },
      go: () => { if (L.length < 2) return; dftStart(L); sfx.fanfare(); go('ost'); toast(`🎬 OST 드래프트 시작! 맞히면 한 명씩 데려갑니다`, 3000); },
      back: () => go('music'),
    };
  }
  actions.back = () => go('music');
  draw();
};

// ── 🔤 초성 퀴즈 ──
screens.chosung = () => {
  const cats = ['전체', ...Object.keys(CHOSUNG)];
  const hangulLen = (w) => [...w].filter((ch) => ch >= '가' && ch <= '힣').length;
  let cat = S.chosungCat && cats.includes(S.chosungCat) ? S.chosungCat : '전체', pool = [], i = 0, keep = 0, revealed = false, stopTimer = null;
  // 카테고리별 진행 위치 + 이미 푼(정답 공개된) 단어를 기억 → 카테고리를 오가도 푼 문제는 다시 안 나옴
  // 문제 순서는 그대로 두고 건너뛰기만 하므로 정답지 번호와 계속 일치
  if (!S.chosungPos) S.chosungPos = {};
  if (!S.chosungDone) S.chosungDone = {};
  const pk = () => S.set + ':' + cat;
  const done = () => new Set(S.chosungDone[S.set] || []);
  const markDone = (w) => { const a = S.chosungDone[S.set] || (S.chosungDone[S.set] = []); if (!a.includes(w)) a.push(w); };
  const savePos = () => { S.chosungPos[pk()] = i; S.chosungCat = cat; save(); };
  // from 부터 아직 안 푼 문제를 찾음. 다 풀었으면 알려 주고 그 자리 그대로
  function nextOpen(from) {
    const d = done();
    for (let k = 0; k < pool.length; k++) { const j = (from + k) % pool.length; if (!d.has(pool[j].w)) return j; }
    toast('이 카테고리 문제를 모두 풀었어요. [↺ 처음부터]로 다시 할 수 있어요', 3500);
    return from % pool.length;
  }

  function build() {
    const src = chosungList(cat);
    pool = seededOrder(src.length, 'chosung:' + cat, S.set).map((k) => src[k]);
    keep = 0; revealed = false;
    i = nextOpen(S.chosungPos[pk()] || 0); savePos();
  }
  const leftCount = () => { const d = done(); return pool.filter((q) => !d.has(q.w)).length; };
  const pts = () => Math.max(1, 3 - keep);

  function render() {
    const q = pool[i], maxKeep = hangulLen(q.w) - 1;
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🔤 초성 퀴즈</h2>
          <div class="chips">${cats.map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-a="cat" data-v="${c}">${c}</button>`).join('')}</div>
        </div>
        <div class="stage-wrap">
          <div class="stage">
            <div class="row"><span class="pill">${esc(q.c)}</span><span class="pill">Q${i + 1} · 남은 ${leftCount()} / ${pool.length}</span><span class="pill">${revealed ? '정답!' : pts() + '점'}</span></div>
            <div class="word pop" style="color:var(--gold);letter-spacing:.08em">${esc(revealed ? q.w : chosung(q.w, keep))}</div>
            ${revealed && CHOSUNG_MEANING[q.w] ? `<div class="notice pop" style="margin:0">💬 ${esc(CHOSUNG_MEANING[q.w])}</div>` : ''}
            <div class="timer" id="tm"></div>
          </div>
          <div class="controls">
            <div class="row"><button class="btn primary" data-a="timer">⏱ 10초</button><button class="btn gold" data-a="more" ${revealed || keep >= maxKeep ? 'disabled' : ''}>💡 한 글자 공개</button></div>
            <div class="row"><button class="btn" data-a="reveal">👀 정답</button></div>
            <div class="row">
              <button class="btn A" data-a="win" data-v="0" ${revealed ? 'disabled' : ''}>${esc(S.teams[0].name)} +${pts()}</button>
              <button class="btn B" data-a="win" data-v="1" ${revealed ? 'disabled' : ''}>${esc(S.teams[1].name)} +${pts()}</button>
            </div>
            <div class="row"><button class="btn big" data-a="next">다음 ▶</button></div>
            <button class="btn" data-a="restart" style="font-size:13px;padding:6px">↺ 이 카테고리 처음부터</button>
          </div>
        </div>
      </div>`;
    setCtl({
      q: `${cat} · Q${i + 1}`, answer: q.w, detail: CHOSUNG_MEANING[q.w] ? `${q.c} · ${CHOSUNG_MEANING[q.w]}` : q.c, revealed,
      win: revealed ? null : { pts: pts() },
      can: [
        { a: 'timer', l: '⏱ 10초' },
        ...(!revealed && keep < maxKeep ? [{ a: 'more', l: '💡 한 글자 공개' }] : []),
        { a: 'reveal', l: '👀 정답 공개' }, { a: 'next', l: '다음 ▶', k: 'big' },
      ],
    });
  }
  const stopT = () => { if (stopTimer) { stopTimer(); stopTimer = null; } };
  const show = () => { stopT(); revealed = true; markDone(pool[i].w); save(); render(); };

  actions = {
    cat: (c) => { stopT(); cat = c; build(); render(); Party.buzzReset(); },
    timer: () => {
      stopT();
      stopTimer = countdown(10, (s) => { const t = $('#tm'); if (t) { t.textContent = s; t.classList.toggle('warn', s <= 3); } if (s <= 3 && s > 0) sfx.tick(); }, () => { stopTimer = null; sfx.boom(); const t = $('#tm'); if (t) t.textContent = '⏰'; });
    },
    more: () => { keep++; sfx.beep(); render(); },
    reveal: () => { sfx.fanfare(); show(); },
    win: (t) => { addScore(Number(t), pts()); sfx.ok(); flash(t === '0' ? 'var(--A)' : 'var(--B)'); show(); Party.banner(null); },
    next: () => { stopT(); i = nextOpen(i + 1); keep = 0; revealed = false; savePos(); render(); Party.buzzReset(); },
    restart: () => {
      if (!confirm(`'${cat}' 카테고리를 처음부터 다시 할까요?\n(이 카테고리에서 푼 문제가 다시 나옵니다)`)) return;
      const words = new Set(pool.map((q) => q.w));
      S.chosungDone[S.set] = (S.chosungDone[S.set] || []).filter((w) => !words.has(w));
      S.chosungPos[pk()] = 0; stopT(); build(); render(); Party.buzzReset(); toast(`↺ ${cat} 처음부터`);
    },
  };
  Party.buzzer(() => stopT()); // 폰 버저: 누가 누르면 10초 타이머를 멈춤
  build(); render();
};

// ── 📸 확대 사진 퀴즈 ──
screens.photo = () => {
  const SCALES = [7, 4, 2.2, 1], POINTS = [4, 3, 2, 1];
  const order = seededOrder(CELEBS.length, 'photo', S.set);
  let i = 0, stage = 0, revealed = false;
  const cur = () => CELEBS[order[i]];
  // 진행 위치 + 이미 맞힌(공개한) 사진 기억 → 다른 게임에 갔다 와도 이어서, 푼 사진은 건너뜀 (정답지 번호와 계속 일치)
  if (!S.quizPos) S.quizPos = {};
  if (!S.quizDone) S.quizDone = {};
  const key = () => 'photo:' + S.set;
  const done = () => new Set(S.quizDone[key()] || []);
  const markDone = () => { const a = S.quizDone[key()] || (S.quizDone[key()] = []); if (!a.includes(cur().file)) a.push(cur().file); save(); };
  const savePos = () => { S.quizPos[key()] = i; save(); };
  const leftCount = () => { const d = done(); return order.filter((k) => !d.has(CELEBS[k].file)).length; };
  function nextOpen(from, quiet) {
    const d = done();
    for (let k = 0; k < order.length; k++) { const j = (from + k) % order.length; if (!d.has(CELEBS[order[j]].file)) return j; }
    if (!quiet) toast('사진을 모두 풀었어요. [↺ 처음부터]로 다시 할 수 있어요', 3500);
    return from % order.length;
  }
  i = nextOpen(S.quizPos[key()] || 0); savePos();
  const preload = (k) => { const c = CELEBS[order[k % order.length]]; if (c) new Image().src = 'img/' + c.file; };

  function render() {
    const c = cur(), sc = revealed ? 1 : SCALES[stage];
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>📸 이 얼굴 누구게?</h2><span class="sub">빨리 맞힐수록 점수 UP</span></div>
        <div class="stage-wrap">
          <div class="stage photo-stage">
            <div class="photo">
              <img id="ph" src="img/${c.file}" alt="" style="object-position:${c.fx}% ${c.fy}%;transform-origin:${c.fx}% ${c.fy}%;transform:scale(${sc})">
              <span class="lvl">Q${i + 1} · 남은 ${leftCount()} · ${revealed ? '정답!' : `${stage + 1}단계 · ${POINTS[stage]}점`}</span>
              ${revealed ? `<div class="reveal"><div class="answer pop">${esc(c.name)}</div></div><span class="credit">사진: Wikimedia Commons</span>` : ''}
            </div>
          </div>
          <div class="controls">
            <div class="row"><button class="btn primary big" data-a="zoom" ${stage >= 3 || revealed ? 'disabled' : ''}>🔍 줌 아웃 (${stage < 3 ? POINTS[stage + 1] + '점으로' : '끝'})</button></div>
            <div class="row"><button class="btn" data-a="reveal">👀 정답 공개</button></div>
            <div class="row">
              <button class="btn A" data-a="win" data-v="0" ${revealed ? 'disabled' : ''}>${esc(S.teams[0].name)} +${POINTS[stage]}</button>
              <button class="btn B" data-a="win" data-v="1" ${revealed ? 'disabled' : ''}>${esc(S.teams[1].name)} +${POINTS[stage]}</button>
            </div>
            <div class="row">
              <button class="btn" data-a="prev" ${i === 0 ? 'disabled' : ''}>◀ 이전</button>
              <button class="btn big" data-a="next">다음 ▶</button>
              <button class="btn" data-a="restart" title="처음부터" style="flex:0 0 auto;padding:6px 10px">↺</button>
            </div>
          </div>
        </div>
      </div>`;
    setCtl({
      q: `Q${i + 1} · ${revealed ? '정답!' : `${stage + 1}단계`}`, answer: c.name, revealed,
      win: revealed ? null : { pts: POINTS[stage] },
      can: [
        ...(stage < 3 && !revealed ? [{ a: 'zoom', l: `🔍 줌 아웃 (${POINTS[stage + 1]}점으로)` }] : []),
        { a: 'reveal', l: '👀 정답 공개' },
        ...(i > 0 ? [{ a: 'prev', l: '◀ 이전' }] : []), { a: 'next', l: '다음 ▶', k: 'big' },
      ],
    });
  }
  // 다음은 안 푼 사진으로 건너뛰고, 이전은 바로 앞 사진
  const move = (to) => { i = to; stage = 0; revealed = false; savePos(); render(); preload(nextOpen(i + 1, true)); Party.buzzReset(); };
  actions = {
    zoom: () => { if (stage < 3) { stage++; sfx.beep(); render(); } },
    reveal: () => { revealed = true; markDone(); sfx.fanfare(); render(); },
    win: (t) => { addScore(Number(t), POINTS[stage]); sfx.ok(); flash(t === '0' ? 'var(--A)' : 'var(--B)'); revealed = true; markDone(); render(); Party.banner(null); },
    next: () => move(nextOpen(i + 1)),
    prev: () => move((i - 1 + order.length) % order.length),
    restart: () => {
      if (!confirm('확대 사진 퀴즈를 처음부터 다시 할까요?\n(맞힌 사진이 다시 나옵니다)')) return;
      S.quizDone[key()] = []; move(0); toast('↺ 처음부터');
    },
  };
  Party.buzzer();
  render(); preload(nextOpen(i + 1, true));
};

// ── 📺 다음 장면 맞히기 ──
// 기본 영상(SCENES, 국내 먼저) + 진행 화면에서 직접 추가한 영상(S.myScenes)
const allScenes = () => [...SCENES, ...(Array.isArray(S.myScenes) ? S.myScenes : [])];
const sceneKey = (s) => s.id + ':' + s.stop;
// YouTube 주소에서 영상 ID 뽑기 (watch?v= · youtu.be/ · shorts/ · ID 그대로)
function ytId(txt) {
  const t = String(txt || '').trim();
  const m = t.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/) || t.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}
// 숨겨 둔 YouTube 플레이어를 무대(#sbox) 위에 보이게 띄움. 위쪽(영상 제목이 뜨는 곳)은 가리개로 덮음
function stagePlayer() {
  const wrap = $('#yt-wrap');
  if (!wrap.querySelector('.yt-cover')) wrap.insertAdjacentHTML('beforeend', '<div class="yt-cover top"></div><div class="yt-cover bot"></div>');
  const place = () => {
    const box = $('#sbox'); if (!box) return;
    const r = box.getBoundingClientRect();
    Object.assign(wrap.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  };
  wrap.classList.remove('yt-hidden'); wrap.classList.add('yt-scene');
  window.addEventListener('resize', place);
  onCleanup(() => {
    window.removeEventListener('resize', place);
    wrap.classList.remove('yt-scene', 'paused'); wrap.classList.add('yt-hidden');
    ['left', 'top', 'width', 'height', 'visibility'].forEach((k) => { wrap.style[k] = ''; });
  });
  return { wrap, place: () => { requestAnimationFrame(place); place(); } };
}

screens.scene = () => {
  const POINTS = 2, L = ['①', '②', '③'];
  const list = allScenes();
  if (!S.quizPos) S.quizPos = {};
  if (!S.quizDone) S.quizDone = {};
  const key = () => 'scene:' + S.set;
  const done = () => new Set(S.quizDone[key()] || []);
  let i = 0, phase = 'ready', won = [false, false], stopT = null;
  const cur = () => list[i];
  const markDone = () => { const a = S.quizDone[key()] || (S.quizDone[key()] = []); if (!a.includes(sceneKey(cur()))) a.push(sceneKey(cur())); save(); };
  const savePos = () => { S.quizPos[key()] = i; save(); };
  const leftCount = () => { const d = done(); return list.filter((x) => !d.has(sceneKey(x))).length; };
  function nextOpen(from) {
    const d = done();
    for (let k = 0; k < list.length; k++) { const j = (from + k) % list.length; if (!d.has(sceneKey(list[j]))) return j; }
    toast('영상을 모두 풀었어요. [↺]로 처음부터 다시 할 수 있어요', 3500);
    return from % list.length;
  }
  i = nextOpen(Math.min(S.quizPos[key()] || 0, list.length - 1)); savePos();

  const { wrap, place } = stagePlayer();
  onCleanup(() => { if (stopT) stopT(); });
  const clip = (from, to, onEnd) => {
    let ended = false;
    wrap.classList.remove('paused');
    playClip({ id: cur().id, start: from }, to - from, (p) => { if (p >= 1 && !ended) { ended = true; wrap.classList.add('paused'); if (onEnd) onEnd(); } });
  };

  function render() {
    const s = cur(), showQ = phase !== 'ready' && phase !== 'playing';
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>📺 다음 장면 맞히기</h2><span class="pill">Q${i + 1} / ${list.length} · 남은 ${leftCount()} · 맞히면 +${POINTS}</span></div>
        <div class="stage-wrap">
          <div class="stage" style="gap:8px">
            <div class="scene-box" id="sbox">${phase === 'ready' ? '<div class="scene-wait">▶ 재생을 누르면 영상이 나와요</div>' : ''}</div>
            <div class="scene-q">${showQ ? `⏸ ${esc(s.q)}` : phase === 'playing' ? '👀 잘 보세요! 결정적 순간에 멈춥니다' : esc(s.q)}</div>
          </div>
          <div class="controls">
            ${showQ ? `<div class="scene-opts">${s.opts.map((o, k) => `<div class="sopt ${phase === 'revealed' ? (k === s.a ? 'ok' : 'no') : ''}"><b>${L[k]}</b> ${esc(o)}</div>`).join('')}</div>` : ''}
            <div class="timer" id="tm" style="text-align:center;font-size:clamp(22px,6vmin,44px)"></div>
            <div class="row">
              ${phase === 'ready' ? '<button class="btn big primary" data-a="play">▶ 재생</button>' : ''}
              ${phase === 'question' ? '<button class="btn" data-a="replay">🔁 다시 보기</button><button class="btn primary" data-a="timer">⏱ 10초</button>' : ''}
              ${phase === 'question' ? '<button class="btn gold" data-a="reveal">👀 정답 공개</button>' : ''}
              ${phase === 'revealed' ? '<button class="btn" data-a="again">🔁 정답 장면 다시</button>' : ''}
            </div>
            ${showQ ? `<div class="row">${[0, 1].map((t) => `<button class="btn ${t ? 'B' : 'A'}" data-a="win" data-v="${t}" ${won[t] ? 'disabled' : ''}>${won[t] ? '✅ ' : ''}${esc(S.teams[t].name)} 정답 +${POINTS}</button>`).join('')}</div>` : ''}
            <div class="row">
              <button class="btn" data-a="prev" ${i === 0 ? 'disabled' : ''}>◀ 이전</button>
              <button class="btn big" data-a="next">다음 ▶</button>
              <button class="btn" data-a="restart" title="처음부터" style="flex:0 0 auto;padding:6px 10px">↺</button>
            </div>
            ${phase === 'ready' ? '<button class="btn" data-a="edit" style="font-size:13px;padding:6px">✏️ 영상 추가·관리</button>' : ''}
          </div>
        </div>
      </div>`;
    wrap.style.visibility = phase === 'ready' ? 'hidden' : '';
    place();
    setCtl({
      q: `Q${i + 1} · ${s.name}`, answer: `${L[s.a]} ${s.opts[s.a]}`, detail: phase === 'revealed' ? '' : '보기: ' + s.opts.map((o, k) => `${L[k]} ${o}`).join(' / '),
      revealed: phase === 'revealed',
      win: showQ && !(won[0] && won[1]) ? { pts: POINTS } : null,
      can: [
        ...(phase === 'ready' ? [{ a: 'play', l: '▶ 재생', k: 'big' }] : []),
        ...(phase === 'question' ? [{ a: 'replay', l: '🔁 다시 보기' }, { a: 'timer', l: '⏱ 10초' }, { a: 'reveal', l: '👀 정답 공개', k: 'big' }] : []),
        ...(phase === 'revealed' ? [{ a: 'again', l: '🔁 정답 장면 다시' }] : []),
        ...(i > 0 ? [{ a: 'prev', l: '◀ 이전' }] : []), { a: 'next', l: '다음 ▶' },
      ],
    });
  }
  const toQuestion = () => { if (phase === 'playing') { phase = 'question'; sfx.beep(); render(); } };
  const move = (to) => { stopClip(); if (stopT) stopT(); i = to; phase = 'ready'; won = [false, false]; wrap.classList.remove('paused'); savePos(); render(); };
  const revealFrom = () => (Number.isFinite(cur().rs) ? cur().rs : cur().stop); // 서서히 변하는 영상은 결과 장면으로 건너뜀

  actions = {
    play: () => { phase = 'playing'; render(); clip(cur().start, cur().stop, toQuestion); },
    replay: () => { phase = 'playing'; render(); clip(cur().start, cur().stop, toQuestion); },
    timer: () => {
      if (stopT) stopT();
      stopT = countdown(10, (x) => { const t = $('#tm'); if (t) { t.textContent = x; t.classList.toggle('warn', x <= 3); } if (x <= 3 && x > 0) sfx.tick(); },
        () => { stopT = null; sfx.boom(); const t = $('#tm'); if (t) t.textContent = '셋, 둘, 하나! 🖐'; });
    },
    reveal: () => { if (stopT) stopT(); phase = 'revealed'; markDone(); sfx.fanfare(); render(); clip(revealFrom(), cur().end); },
    again: () => clip(revealFrom(), cur().end),
    // 두 팀이 동시에 답하므로 두 팀 모두 맞힐 수 있음
    win: (t) => { const k = Number(t); if (won[k]) return; won[k] = true; addScore(k, POINTS); sfx.ok(); flash(k ? 'var(--B)' : 'var(--A)'); render(); },
    next: () => move(nextOpen(i + 1)),
    prev: () => move((i - 1 + list.length) % list.length),
    restart: () => {
      if (!confirm('다음 장면 맞히기를 처음부터 다시 할까요?\n(푼 영상이 다시 나옵니다)')) return;
      S.quizDone[key()] = []; move(0); toast('↺ 처음부터');
    },
    edit: () => go('sceneEdit'),
  };
  render();
  if (!ytUnlocked) toast('소리가 안 나오면 🏠 홈 → 🔊 사운드 준비를 먼저 해 주세요', 3500);
};

// ── ✏️ 다음 장면 영상 추가: 영상을 보면서 [📍 멈춤] 같은 버튼으로 시간을 정함 ──
// 직접 만든 문제는 이 노트북(브라우저)에만 저장됩니다. 사회자 폰에는 정답이 보이고, 종이 정답지에는 안 나옵니다.
screens.sceneEdit = () => {
  if (!Array.isArray(S.myScenes)) S.myScenes = [];
  const blank = () => ({ url: '', id: null, q: '', o0: '', o1: '', o2: '', a: 0, start: 0, stop: null, rs: null, end: null });
  const f = blank();
  const { wrap, place } = stagePlayer();
  const now = () => (ytReady && yt.getCurrentTime ? Math.round(yt.getCurrentTime() * 10) / 10 : 0);
  const tick = setInterval(() => { const el = $('#curT'); if (el) el.textContent = now().toFixed(1) + '초'; }, 200);
  onCleanup(() => clearInterval(tick));
  const fmt = (v) => (v == null ? '—' : v.toFixed(1) + '초');
  const keep = () => ['url', 'q', 'o0', 'o1', 'o2'].forEach((k) => { const el = $('#f_' + k); if (el) f[k] = el.value; });

  function render() {
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>✏️ 다음 장면 · 영상 추가</h2><span class="pill">직접 만든 문제 ${S.myScenes.length}개</span></div>
        <div class="stage-wrap">
          <div class="stage" style="gap:6px">
            <div class="row" style="width:100%;flex-wrap:nowrap"><input id="f_url" class="names" style="min-height:0;flex:1" placeholder="YouTube 주소 붙여넣기" value="${esc(f.url)}"><button class="btn primary" data-a="load">불러오기</button></div>
            <div class="scene-box" id="sbox">${f.id ? '' : '<div class="scene-wait">주소를 넣고 [불러오기]</div>'}</div>
            <div class="row">
              <button class="btn" data-a="seek" data-v="-5">−5초</button><button class="btn" data-a="seek" data-v="-1">−1초</button>
              <button class="btn primary" data-a="toggle">▶ / ⏸</button>
              <button class="btn" data-a="seek" data-v="1">+1초</button><button class="btn" data-a="seek" data-v="5">+5초</button>
              <span class="pill" id="curT">0.0초</span>
            </div>
          </div>
          <div class="controls" style="overflow-y:auto">
            <div class="row">
              <button class="btn" data-a="mark" data-v="start">📍 시작 ${fmt(f.start)}</button>
              <button class="btn gold" data-a="mark" data-v="stop">📍 멈춤 ${fmt(f.stop)}</button>
            </div>
            <div class="row">
              <button class="btn" data-a="mark" data-v="rs">📍 정답 장면 ${f.rs == null ? '(멈춤부터)' : fmt(f.rs)}</button>
              <button class="btn" data-a="mark" data-v="end">📍 끝 ${fmt(f.end)}</button>
            </div>
            <p class="sub" style="margin:0;color:var(--muted);font-size:12px">영상을 보다가 원하는 순간에 📍 버튼을 누르세요. 멈춤은 <b>자막이 정답을 말하기 전</b>으로!</p>
            <input id="f_q" class="names" style="min-height:0" placeholder="문제 (예: 화가 난 엄마가 김치를 집어 들었다!)" value="${esc(f.q)}">
            ${[0, 1, 2].map((k) => `<div class="row" style="flex-wrap:nowrap"><button class="btn ${f.a === k ? 'ok' : ''}" data-a="ans" data-v="${k}" title="정답으로 지정" style="flex:0 0 auto">${f.a === k ? '✅' : '◻️'} ${['①', '②', '③'][k]}</button><input id="f_o${k}" class="names" style="min-height:0;flex:1" placeholder="보기 ${k + 1}${k === 0 ? ' (✅ 누른 보기가 정답)' : ''}" value="${esc(f['o' + k])}"></div>`).join('')}
            <div class="row"><button class="btn" data-a="test">▶ 멈춤까지 미리보기</button><button class="btn big primary" data-a="save">💾 저장</button></div>
            ${S.myScenes.length ? `<div class="results" style="max-height:none">${S.myScenes.map((x, k) => `<span class="o" style="cursor:pointer" data-a="del" data-v="${k}">🗑 ${esc(x.name)}</span>`).join('')}</div>` : ''}
            <button class="btn" data-a="back">↩ 다음 장면 맞히기로</button>
          </div>
        </div>
      </div>`;
    wrap.style.visibility = f.id ? '' : 'hidden';
    wrap.classList.remove('paused');
    place();
  }
  actions = {
    load: () => {
      keep();
      const id = ytId(f.url);
      if (!id) { toast('YouTube 주소를 확인해 주세요'); return; }
      Object.assign(f, { id, start: 0, stop: null, rs: null, end: null }); render();
      playClip({ id, start: 0 }, 0); toast('영상을 불러왔어요. 보면서 📍 버튼으로 시간을 정하세요');
    },
    toggle: () => { if (!f.id) return; if (yt.getPlayerState() === YT.PlayerState.PLAYING) yt.pauseVideo(); else yt.playVideo(); },
    seek: (v) => { if (f.id) yt.seekTo(Math.max(0, now() + Number(v)), true); },
    mark: (v) => { keep(); if (!f.id) { toast('먼저 영상을 불러오세요'); return; } f[v] = now(); sfx.tick(); render(); },
    ans: (v) => { keep(); f.a = Number(v); render(); },
    test: () => { keep(); if (!f.id || f.stop == null) { toast('📍 멈춤 시간을 먼저 정해 주세요'); return; } playClip({ id: f.id, start: f.start || 0 }, f.stop - (f.start || 0)); },
    save: () => {
      keep();
      const opts = [f.o0, f.o1, f.o2].map((x) => x.trim());
      if (!f.id) { toast('영상을 불러오세요'); return; }
      if (f.stop == null || f.stop <= (f.start || 0)) { toast('📍 멈춤 시간은 시작보다 뒤여야 해요'); return; }
      if (!f.q.trim() || opts.some((x) => !x)) { toast('문제와 보기 3개를 모두 써 주세요'); return; }
      const from = f.rs == null ? f.stop : f.rs, end = f.end == null || f.end <= from ? from + 12 : f.end;
      S.myScenes.push({ id: f.id, name: f.q.trim().slice(0, 18), start: f.start || 0, stop: f.stop, ...(f.rs == null ? {} : { rs: f.rs }), end, q: f.q.trim(), opts, a: f.a, mine: true });
      save(); stopClip(); sfx.fanfare(); toast('💾 저장했어요! 다음 장면 맞히기 마지막에 나옵니다');
      Object.assign(f, blank()); render();
    },
    del: (v) => { const x = S.myScenes[Number(v)]; if (x && confirm(`'${x.name}' 문제를 지울까요?`)) { S.myScenes.splice(Number(v), 1); save(); render(); } },
    back: () => go('scene'),
  };
  render();
};

// ── 🎭 몸으로 말해요 ──
const usedWords = new Set();
screens.charades = () => {
  const cats = Object.keys(CHARADES);
  const MODES = ['몸으로 말해요', '고요 속의 외침', '말로 설명 (스피드 퀴즈)'];
  let cat = cats[0], mode = MODES[0], team = 0, secs = 90;

  function setup() {
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🎭 몸으로 말해요</h2><span class="sub">라운드 준비</span></div>
        <div class="stage-wrap">
          <div class="stage" style="gap:12px;overflow:auto">
            <div class="chips">${cats.map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-a="cat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
            <div class="chips">${MODES.map((m) => `<button class="chip ${m === mode ? 'on' : ''}" data-a="mode" data-v="${esc(m)}">${esc(m)}</button>`).join('')}</div>
            <div class="chips">
              ${[60, 90, 120].map((s) => `<button class="chip ${s === secs ? 'on' : ''}" data-a="secs" data-v="${s}">${s}초</button>`).join('')}
            </div>
          </div>
          <div class="controls">
            <div class="row">
              <button class="btn A ${team === 0 ? 'on' : ''}" data-a="team" data-v="0">${esc(S.teams[0].name)} 차례</button>
              <button class="btn B ${team === 1 ? 'on' : ''}" data-a="team" data-v="1">${esc(S.teams[1].name)} 차례</button>
            </div>
            <p class="notice" style="margin:0;text-align:center">📺 맞히는 팀원은 TV를 등지고, 설명하는 사람만 TV를 보세요!</p>
            <button class="btn big primary" data-a="start">▶ 시작!</button>
          </div>
        </div>
      </div>`;
    actions = {
      cat: (v) => { cat = v; setup(); }, mode: (v) => { mode = v; setup(); },
      secs: (v) => { secs = Number(v); setup(); }, team: (v) => { team = Number(v); setup(); },
      start: () => play(),
    };
    setCtl({ q: `${S.teams[team].name} 차례 · ${cat}`, can: [
      { a: 'team', v: '0', l: `${S.teams[0].name} 차례` }, { a: 'team', v: '1', l: `${S.teams[1].name} 차례` }, { a: 'start', l: '▶ 시작!', k: 'big' }] });
  }

  function play() {
    let pool = shuffle(CHARADES[cat].filter((w) => !usedWords.has(w)));
    if (pool.length < 5) { CHARADES[cat].forEach((w) => usedWords.delete(w)); pool = shuffle(CHARADES[cat]); }
    const log = []; let word = null, left = secs, running = false;
    const nextWord = () => { word = pool.shift() || null; if (word) usedWords.add(word); };

    function render() {
      const ok = log.filter((l) => l.ok).length;
      main.innerHTML = `
        <div class="screen">
          <div class="head"><h2>${esc(mode)}</h2><span class="pill">${esc(S.teams[team].name)} · ${esc(cat)}</span></div>
          <div class="stage-wrap">
            <div class="stage">
              <div class="timer ${left <= 10 ? 'warn' : ''}" id="tm">${running ? left : ''}</div>
              <div class="word pop" id="wd">${running ? esc(word || '제시어 소진!') : ''}</div>
              <div class="pill">⭕ ${ok}개</div>
            </div>
            <div class="controls">
              <button class="btn ok big" data-a="ok" style="min-height:30%">⭕ 정답</button>
              <button class="btn bad big" data-a="pass">⏭ 패스</button>
              <button class="btn" data-a="quit">그만하기</button>
            </div>
          </div>
        </div>`;
      setCtl({ q: `${S.teams[team].name} · ⭕ ${ok}개`, answer: running ? (word || '제시어 소진') : '', can: [
        { a: 'ok', l: '⭕ 정답', k: 'big' }, { a: 'pass', l: '⏭ 패스' }, { a: 'quit', l: '그만하기' }] });
    }
    function finish() {
      running = false; sfx.boom(); flash('var(--bad)');
      const ok = log.filter((l) => l.ok).length;
      main.innerHTML = `
        <div class="screen">
          <div class="head"><h2>⏰ 시간 종료!</h2><span class="pill">${esc(S.teams[team].name)}</span></div>
          <div class="stage">
            <div class="answer pop">${ok}개 정답!</div>
            <div class="results">${log.map((l) => `<span class="${l.ok ? 'o' : 'x'}">${esc(l.w)}</span>`).join('')}</div>
            <div class="row">
              <button class="btn big ${team === 0 ? 'A' : 'B'}" data-a="apply">${esc(S.teams[team].name)}에 +${ok}점 반영</button>
              <button class="btn" data-a="again">다음 라운드</button>
            </div>
          </div>
        </div>`;
      const ctlEnd = (applied) => setCtl({ q: `${S.teams[team].name} · ${ok}개 정답`, can: [
        ...(applied ? [] : [{ a: 'apply', l: `${S.teams[team].name}에 +${ok}점 반영`, k: 'big' }]), { a: 'again', l: '다음 라운드' }] });
      actions = {
        apply: (v, el) => { addScore(team, ok); sfx.fanfare(); el.disabled = true; el.textContent = '✅ 반영 완료'; ctlEnd(true); },
        again: () => { team = 1 - team; setup(); },
      };
      ctlEnd(false);
    }
    // 3-2-1 카운트다운 후 시작
    render();
    let c = 3; $('#wd').textContent = c; sfx.beep();
    const pre = setInterval(() => {
      c--;
      if (c > 0) { $('#wd').textContent = c; sfx.beep(); return; }
      clearInterval(pre); sfx.go(); running = true; nextWord(); render();
      countdown(secs, (s) => { left = s; const t = $('#tm'); if (t) { t.textContent = s; t.classList.toggle('warn', s <= 10); } if (s <= 5 && s > 0) sfx.tick(); }, finish);
    }, 800);
    onCleanup(() => clearInterval(pre));
    actions = {
      ok: () => { if (!running || !word) return; log.push({ w: word, ok: true }); sfx.ok(); nextWord(); render(); },
      pass: () => { if (!running || !word) return; log.push({ w: word, ok: false }); sfx.bad(); nextWord(); render(); },
      quit: () => go('charades'),
    };
  }
  setup();
};

// ── 🎨 캐치마인드 ──
screens.draw = () => {
  let team = 0, secs = 90, relay = true, word = null, phone = Party.active;
  const usedDraw = screens.draw.used || (screens.draw.used = new Set());

  function setup() {
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🎨 캐치마인드</h2><span class="sub">그림만 보고 맞혀라!</span></div>
        <div class="stage" style="gap:12px">
          <div class="row">
            <button class="btn A ${team === 0 ? 'on' : ''}" data-a="team" data-v="0">${esc(S.teams[0].name)}가 그림</button>
            <button class="btn B ${team === 1 ? 'on' : ''}" data-a="team" data-v="1">${esc(S.teams[1].name)}가 그림</button>
          </div>
          <div class="chips">
            ${[60, 90, 120].map((s) => `<button class="chip ${s === secs ? 'on' : ''}" data-a="secs" data-v="${s}">${s}초</button>`).join('')}
            <button class="chip ${relay ? 'on' : ''}" data-a="relay">🔁 릴레이 (10초마다 다음 사람)</button>
          </div>
          ${Party.active ? `<div class="chips"><button class="chip ${phone ? 'on' : ''}" data-a="phone">📱 각자 폰으로 그리기</button><button class="chip ${phone ? '' : 'on'}" data-a="hand">✋ 진행 화면에 그리기</button></div>` : ''}
          <p class="sub" style="margin:0;color:var(--muted)">${phone
            ? '제시어는 그리는 팀 폰에만 나옵니다. 차례인 사람이 자기 폰에 그리면 TV에 실시간으로 보여요.'
            : '그리는 팀 전원이 폰을 돌려가며 이어 그리고, 상대 팀이 맞힙니다.'}<br>상대 팀이 맞히면 상대 팀 +2점, 그리는 팀 +1점</p>
          ${phone && !Party.members(team).length ? `<p class="notice" style="margin:0">⚠ ${esc(S.teams[team].name)}에 연결된 폰이 없어요</p>` : ''}
          <button class="btn big primary" data-a="word">${phone ? '🎨 시작 (제시어는 폰으로)' : '제시어 보기'}</button>
        </div>
      </div>`;
    actions = {
      team: (v) => { team = Number(v); setup(); }, secs: (v) => { secs = Number(v); setup(); },
      relay: () => { relay = !relay; setup(); }, word: () => (phone ? phoneDraw() : showWord()),
      phone: () => { phone = true; setup(); }, hand: () => { phone = false; setup(); },
    };
  }
  const newWord = () => {
    let pool = DRAW_WORDS.filter((w) => !usedDraw.has(w)); if (!pool.length) { usedDraw.clear(); pool = DRAW_WORDS; }
    word = pick(pool); usedDraw.add(word);
  };

  // 📱 폰으로 그리기: 차례인 사람 폰의 선이 서버를 거쳐 이 캔버스에 그려짐
  function phoneDraw() {
    newWord();
    Party.act('draw', { team, word });
    onCleanup(() => Party.act('idle'));
    main.innerHTML = `
      <div class="screen">
        <div class="stage-wrap">
          <div class="stage" style="padding:6px">
            <div class="canvas-box" id="cbox" style="background:#222"><canvas id="cv"></canvas><div class="ov" style="color:#fff"><span id="who"></span><span class="timer" id="tm" style="font-size:28px">${secs}</span></div></div>
          </div>
          <div class="controls">
            <p class="notice" style="margin:0;text-align:center">✏️ ${esc(S.teams[team].name)}가 폰으로 그리는 중<br>${esc(S.teams[1 - team].name)}는 TV를 보고 맞혀 보세요!</p>
            <div class="row"><button class="btn" data-a="next">✏️ 다음 사람</button><button class="btn" data-a="clear">🧽 지우기</button></div>
            <div class="row"><button class="btn" data-a="another">🔀 다른 단어</button></div>
            <div class="row"><button class="btn ok big" data-a="got">⭕ 맞혔다!</button></div>
            <div class="row"><button class="btn" data-a="giveup">🏳 포기 · 정답 공개</button></div>
          </div>
        </div>
      </div>`;
    const cv = $('#cv'), box = $('#cbox'), ctx = cv.getContext('2d');
    let strokes = [], last = {}, R = null;
    // 폰과 같은 4:3 영역에 맞춰 그림 (가운데 정렬)
    function area() {
      const r = box.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = Math.min(r.width, r.height * 4 / 3), h = w * 3 / 4;
      R = { x: (r.width - w) / 2, y: (r.height - h) / 2, w, h };
      ctx.fillStyle = '#222'; ctx.fillRect(0, 0, r.width, r.height);
      ctx.fillStyle = '#fff'; ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      last = {}; strokes.forEach(paint);
    }
    function paint(ch) {
      const P = (p) => [R.x + p[0] * R.w, R.y + p[1] * R.h];
      ctx.strokeStyle = ch.c; ctx.lineWidth = ch.w * R.w / 400;
      ctx.beginPath();
      let [x, y] = ch.first || !last[ch.id] ? P(ch.p[0]) : last[ch.id];
      ctx.moveTo(x, y); if (ch.first) ctx.lineTo(x + 0.1, y + 0.1);
      ch.p.forEach((p) => { [x, y] = P(p); ctx.lineTo(x, y); });
      ctx.stroke(); last[ch.id] = [x, y];
    }
    area(); window.addEventListener('resize', area); onCleanup(() => window.removeEventListener('resize', area));
    let turn = 0, running = true;
    const who = (a) => { const w = $('#who'); if (w && a && a.kind === 'draw') w.textContent = a.drawerName ? `✏️ ${a.drawerName}${relay ? ` (${a.turn + 1}번 주자)` : ''}` : '⚠ 그릴 사람의 폰이 없어요'; };
    who(Party.st && Party.st.act);
    onCleanup(Party.on((v) => {
      if (v.t === 'stroke') { strokes.push(v.s); paint(v.s); }
      else if (v.t === 'strokes') { strokes = v.all.slice(); area(); }
      else if (v.t === 'host') who(v.act);
    }));
    const stop = countdown(secs, (s) => {
      const t = $('#tm'); if (t) { t.textContent = s; t.classList.toggle('warn', s <= 10); }
      const elapsed = secs - s;
      if (relay && elapsed > 0 && elapsed % 10 === 0 && s > 0) { turn++; sfx.go(); flash('var(--gold)'); Party.act('drawTurn'); toast('🔁 다음 사람 차례!', 1500); }
      else if (s <= 5 && s > 0) sfx.tick();
    }, () => end(false));
    function end(got) {
      if (!running) return; running = false; stop(); Party.act('drawEnd');
      got ? sfx.fanfare() : sfx.boom();
      const other = 1 - team;
      main.querySelector('.controls').innerHTML = `
        <div class="answer pop" style="text-align:center">${esc(word)}</div>
        ${got ? `<div class="row"><button class="btn ${other === 0 ? 'A' : 'B'}" data-a="pts">${esc(S.teams[other].name)} +2 · ${esc(S.teams[team].name)} +1 반영</button></div>` : '<p class="notice" style="text-align:center;margin:0">아무도 못 맞혔어요!</p>'}
        <div class="row"><button class="btn big primary" data-a="again">다음 라운드</button></div>`;
      actions = {
        pts: (v, el) => { addScore(other, 2); addScore(team, 1); el.disabled = true; el.textContent = '✅ 반영 완료'; },
        again: () => { team = 1 - team; Party.act('idle'); setup(); },
      };
    }
    actions = {
      next: () => { turn++; sfx.go(); Party.act('drawTurn'); },
      clear: () => Party.act('drawClear'),
      another: () => { newWord(); Party.act('draw', { team, word }); toast('🔀 폰에 새 제시어를 보냈어요'); },
      got: () => end(true),
      giveup: () => end(false),
    };
  }
  function showWord() {
    newWord();
    main.innerHTML = `
      <div class="screen">
        <div class="stage">
          <p class="notice" style="margin:0">🙈 맞히는 팀은 TV에서 눈을 돌려 주세요!</p>
          <div class="word pop">${esc(word)}</div>
          <div class="row"><button class="btn" data-a="another">🔀 다른 단어</button><button class="btn big primary" data-a="go">외웠어요 → 그리기 시작</button></div>
        </div>
      </div>`;
    actions = { another: () => showWord(), go: () => drawNow() };
  }
  function drawNow() {
    let color = '#111', running = true;
    main.innerHTML = `
      <div class="screen">
        <div class="stage-wrap">
          <div class="stage" style="padding:6px">
            <div class="canvas-box" id="cbox"><canvas id="cv"></canvas><div class="ov"><span id="who"></span><span class="timer" id="tm" style="font-size:28px">${secs}</span></div></div>
          </div>
          <div class="controls">
            <div class="row" id="sw">
              ${['#111', '#e53935', '#1e88e5', '#43a047', '#fdd835'].map((c) => `<button class="swatch ${c === color ? 'on' : ''}" style="background:${c}" data-a="color" data-v="${c}"></button>`).join('')}
            </div>
            <div class="row"><button class="btn" data-a="clear">🧽 전체 지우기</button></div>
            <div class="row"><button class="btn ok big" data-a="got">⭕ 맞혔다!</button></div>
            <div class="row"><button class="btn" data-a="giveup">🏳 포기 · 정답 공개</button></div>
          </div>
        </div>
      </div>`;
    const cv = $('#cv'), box = $('#cbox'), ctx = cv.getContext('2d');
    function fit() {
      const r = box.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const img = cv.width ? ctx.getImageData(0, 0, cv.width, cv.height) : null;
      cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.scale(dpr, dpr);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.width, r.height);
      if (img) ctx.putImageData(img, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 5;
    }
    fit(); window.addEventListener('resize', fit); onCleanup(() => window.removeEventListener('resize', fit));
    let drawing = false;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => { if (!running) return; drawing = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke(); });
    cv.addEventListener('pointermove', (e) => { if (!drawing) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); });
    const up = () => { drawing = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

    let turn = 1; $('#who').textContent = relay ? '✏️ 1번 주자' : '';
    const stop = countdown(secs, (s) => {
      const t = $('#tm'); if (t) { t.textContent = s; t.classList.toggle('warn', s <= 10); }
      const elapsed = secs - s;
      if (relay && elapsed > 0 && elapsed % 10 === 0 && s > 0) { turn++; sfx.go(); flash('var(--gold)'); $('#who').textContent = `✏️ ${turn}번 주자`; toast('🔁 다음 사람에게 폰을 넘기세요!', 1500); }
      else if (s <= 5 && s > 0) sfx.tick();
    }, () => end(false));
    function end(got) {
      running = false; stop();
      got ? sfx.fanfare() : sfx.boom();
      const other = 1 - team;
      main.querySelector('.controls').innerHTML = `
        <div class="answer pop" style="text-align:center">${esc(word)}</div>
        ${got ? `<div class="row"><button class="btn ${other === 0 ? 'A' : 'B'}" data-a="pts">${esc(S.teams[other].name)} +2 · ${esc(S.teams[team].name)} +1 반영</button></div>` : '<p class="notice" style="text-align:center;margin:0">아무도 못 맞혔어요!</p>'}
        <div class="row"><button class="btn big primary" data-a="again">다음 라운드</button></div>`;
      actions = {
        pts: (v, el) => { addScore(other, 2); addScore(team, 1); el.disabled = true; el.textContent = '✅ 반영 완료'; },
        again: () => { team = 1 - team; setup(); },
      };
    }
    actions = {
      color: (v) => { color = v; document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s.dataset.v === v)); },
      clear: () => { const r = box.getBoundingClientRect(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.width, r.height); },
      got: () => end(true),
      giveup: () => end(false),
    };
  }
  setup();
};

// ── 💣 폭탄 돌리기 ──
// 폰 연결(📱)이 있으면 폭탄이 폰에서 폰으로 넘어갑니다 (노트북을 TV에 연결해서 진행 기기를 돌릴 수 없을 때).
screens.bomb = () => {
  let cat = pick(BOMB_CATEGORIES), phone = Party.active;
  const newCat = () => { cat = pick(BOMB_CATEGORIES.filter((c) => c !== cat)); if (phone) Party.act('bombCat', { cat }); };
  if (phone) Party.act('bomb', { cat });
  onCleanup(() => { if (Party.st) Party.act('idle'); });
  function idle() {
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>💣 폭탄 돌리기</h2><span class="sub">${phone ? '폰으로 답하고 넘기기!' : '한 명씩 답하고 폰을 옆으로!'}</span></div>
        <div class="stage">
          <div class="bomb">💣</div>
          <div class="category pop">${esc(cat)}</div>
          <p class="sub" style="margin:0;color:var(--muted)">${phone
            ? '폭탄이 온 사람은 주제에 맞는 단어를 외치고, 자기 폰에서 넘길 사람을 누르세요. 언제 터질지는 아무도 몰라요!'
            : '주제에 맞는 단어를 말하고 옆 사람에게 폰을 넘기세요. 언제 터질지는 아무도 몰라요!'}</p>
          ${Party.active ? `<div class="chips"><button class="chip ${phone ? 'on' : ''}" data-a="phone">📱 폰으로 돌리기 (${Party.members().length}명)</button><button class="chip ${phone ? '' : 'on'}" data-a="hand">✋ 진행 폰을 직접 돌리기</button></div>` : ''}
          <div class="row"><button class="btn" data-a="shuffle">🔀 주제 바꾸기</button><button class="btn big bad" data-a="start">💣 점화!</button></div>
        </div>
      </div>`;
    actions = {
      shuffle: () => { newCat(); idle(); },
      start: () => run(),
      phone: () => { phone = true; Party.act('bomb', { cat }); idle(); },
      hand: () => { phone = false; Party.act('idle'); idle(); },
    };
  }
  async function run() {
    if (phone) {
      const r = await Party.act('bombStart');
      if (!r) { toast('폰 연결이 끊겼어요. 진행 폰을 직접 돌려 주세요'); phone = false; }
    }
    const fuse = 20 + Math.random() * 30, t0 = Date.now();
    main.innerHTML = `
      <div class="screen">
        <div class="stage">
          <div class="bomb shake">💣</div>
          <div class="category" id="cat">${esc(cat)}</div>
          ${phone ? '<div class="result-big" id="holder" style="text-align:center"></div>' : ''}
          <button class="btn" data-a="shuffle">🔀 주제 바꾸기</button>
        </div>
      </div>`;
    let timer;
    const loop = () => {
      const el = (Date.now() - t0) / 1000;
      if (el >= fuse) return explode();
      sfx.tick();
      const gap = Math.max(90, 650 * (1 - el / fuse) + 60); // 터질수록 빨라짐
      timer = setTimeout(loop, gap);
    };
    loop();
    onCleanup(() => clearTimeout(timer));
    // 지금 폭탄을 든 사람을 TV에 표시
    const show = (a) => { const h = $('#holder'); if (h && a && a.kind === 'bomb' && a.holderName) h.innerHTML = `👉 ${esc(a.holderName)} <small style="color:var(--muted)">(${a.passes || 0}번째)</small>`; };
    if (phone) { show(Party.st && Party.st.act); onCleanup(Party.on((v) => { if (v.t === 'host') show(v.act); })); }
    actions = { shuffle: () => { newCat(); $('#cat').textContent = cat; sfx.beep(); } };
  }
  async function explode() {
    let who = null;
    if (phone) {
      const r = await Party.act('bombBoom');
      if (r && r.act && r.act.boomName) who = { name: r.act.boomName, team: r.act.boomTeam };
    }
    sfx.boom(); flash('#ff6b00'); if (navigator.vibrate) navigator.vibrate([400, 100, 400]);
    main.innerHTML = `
      <div class="screen">
        <div class="stage">
          <div class="boom pop">💥 펑!</div>
          <p class="notice" style="margin:0">${who ? `<b style="font-size:1.4em">${esc(who.name)}</b> 님 당첨! (${esc(S.teams[who.team].name)})` : '지금 폰을 들고 있는 사람 당첨!'}</p>
          <div class="row">
            <button class="btn A ${who && who.team === 0 ? 'on' : ''}" data-a="minus" data-v="0">${esc(S.teams[0].name)} −1</button>
            <button class="btn B ${who && who.team === 1 ? 'on' : ''}" data-a="minus" data-v="1">${esc(S.teams[1].name)} −1</button>
          </div>
          <div class="row"><button class="btn gold big" data-a="roulette">🎰 벌칙 룰렛</button><button class="btn big" data-a="again">🔁 한 판 더</button></div>
        </div>
      </div>`;
    actions = {
      minus: (v, el) => { addScore(Number(v), -1); sfx.bad(); el.disabled = true; },
      roulette: () => go('roulette'),
      again: () => { newCat(); if (phone) Party.act('bomb', { cat }); idle(); },
    };
  }
  idle();
};

// ── 🔥 올인 역전 ──
screens.allin = () => {
  const order = seededOrder(ALLIN.length, 'allin', S.set);
  let qi = 0, bets = [0, 0], result = [null, null];
  const max = (t) => Math.max(0, S.teams[t].score);

  function betting() {
    bets = bets.map((b, t) => Math.min(b, max(t)));
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🔥 올인 역전 퀴즈</h2><span class="sub">맞히면 베팅 ×2 획득, 틀리면 베팅만큼 잃음</span></div>
        <div class="stage">
          <div class="bets">
            ${[0, 1].map((t) => `
              <div class="bet ${t ? 'B' : 'A'}">
                <b>${esc(S.teams[t].name)} (보유 ${S.teams[t].score})</b>
                <div class="amt">${bets[t]}</div>
                <div class="row">
                  <button class="btn" data-a="bet" data-v="${t}:-5">−5</button><button class="btn" data-a="bet" data-v="${t}:-1">−1</button>
                  <button class="btn" data-a="bet" data-v="${t}:1">+1</button><button class="btn" data-a="bet" data-v="${t}:5">+5</button>
                  <button class="btn gold" data-a="bet" data-v="${t}:all">올인!</button>
                </div>
              </div>`).join('')}
          </div>
          <button class="btn big primary" data-a="show">문제 공개 (${qi + 1}번)</button>
        </div>
      </div>`;
    actions = {
      bet: (v) => {
        const [t, d] = v.split(':'); const ti = Number(t);
        bets[ti] = d === 'all' ? max(ti) : Math.min(max(ti), Math.max(0, bets[ti] + Number(d)));
        if (d === 'all') { sfx.fanfare(); flash(ti ? 'var(--B)' : 'var(--A)'); } else sfx.tick();
        betting();
      },
      show: () => question(),
    };
  }
  function question() {
    const q = ALLIN[order[qi % order.length]], phone = Party.active;
    if (phone) { Party.act('allin'); onCleanup(() => Party.act('idle')); }
    // 팀 폰 답 제출 현황 (답 내용은 정답 공개 때까지 TV에 안 나옴)
    const status = (a) => [0, 1].map((t) => `<span class="pill" style="border-color:var(--${t ? 'B' : 'A'})">${esc(S.teams[t].name)} ${a && a.kind === 'allin' && a.answers[t] ? '✅ 제출' : '⏳ 작성 중'}</span>`).join('');
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🔥 문제</h2><span class="pill">${esc(S.teams[0].name)} ${bets[0]} vs ${bets[1]} ${esc(S.teams[1].name)}</span></div>
        <div class="stage">
          <div class="question pop">${esc(q.q)}</div>
          <p class="notice" style="margin:0">${phone ? '각 팀은 폰으로 답을 제출하세요! 📱 (팀원 누구나, 마지막 제출이 팀 답)' : '각 팀은 답을 종이에 적으세요! ✍️'}</p>
          ${phone ? `<div class="row" id="sub">${status(Party.st && Party.st.act)}</div>` : ''}
          <div class="timer" id="tm"></div>
          <div class="row"><button class="btn" data-a="timer">⏱ 30초</button><button class="btn big gold" data-a="answer">정답 공개</button></div>
        </div>
      </div>`;
    actions = {
      timer: () => countdown(30, (s) => { const t = $('#tm'); if (t) { t.textContent = s; t.classList.toggle('warn', s <= 5); } if (s <= 5 && s > 0) sfx.tick(); }, () => { sfx.boom(); }),
      answer: () => judge(q, phone),
    };
    if (phone) onCleanup(Party.on((v) => { const el = $('#sub'); if (v.t === 'host' && el) el.innerHTML = status(v.act); }));
  }
  async function judge(q, phone) {
    result = [null, null];
    let ans = null;
    if (phone) { const r = await Party.act('allinClose'); ans = r && r.act && r.act.answers; }
    const draw = () => {
      main.innerHTML = `
        <div class="screen">
          <div class="stage">
            <div class="question" style="font-size:clamp(16px,3.6vmin,26px);color:var(--muted)">${esc(q.q)}</div>
            <div class="answer pop" style="color:var(--gold)">${esc(q.a)}</div>
            <div class="bets">
              ${[0, 1].map((t) => `
                <div class="bet ${t ? 'B' : 'A'}">
                  <b>${esc(S.teams[t].name)} · 베팅 ${bets[t]}</b>
                  ${ans ? `<div class="answer" style="font-size:clamp(18px,4vmin,34px)">${ans[t] ? `“${esc(ans[t].text)}”<small>${esc(ans[t].by)}</small>` : '<small>답 없음</small>'}</div>` : ''}
                  <div class="row">
                    <button class="btn ${result[t] === true ? 'ok' : ''}" data-a="mark" data-v="${t}:1">⭕</button>
                    <button class="btn ${result[t] === false ? 'bad' : ''}" data-a="mark" data-v="${t}:0">❌</button>
                  </div>
                </div>`).join('')}
            </div>
            <button class="btn big primary" data-a="apply" ${result.includes(null) ? 'disabled' : ''}>결과 반영</button>
          </div>
        </div>`;
    };
    draw();
    actions = {
      mark: (v) => { const [t, r] = v.split(':'); result[Number(t)] = r === '1'; draw(); },
      apply: () => {
        [0, 1].forEach((t) => { if (bets[t]) addScore(t, result[t] ? bets[t] * 2 : -bets[t]); });
        sfx.fanfare(); flash('var(--gold)');
        const [a, b] = S.teams.map((t) => t.score);
        const lead = a === b ? '동점! 🤝' : `${esc(S.teams[a > b ? 0 : 1].name)} 리드! 👑`;
        main.innerHTML = `
          <div class="screen"><div class="stage">
            <div class="result-big pop">${lead}</div>
            <div class="answer">${a} : ${b}</div>
            <div class="row"><button class="btn big primary" data-a="next">다음 문제</button><button class="btn big gold" data-a="roulette">🎰 벌칙 룰렛</button></div>
          </div></div>`;
        actions = { next: () => { qi++; bets = [0, 0]; betting(); }, roulette: () => go('roulette') };
      },
    };
  }
  betting();
};

// ── 🎁 패배팀 상품 뽑기 ──
// 상자(보조배터리·와인)를 섞어 놓고, 패배팀이 한 명씩 상자 번호를 골라 엽니다.
// 🔄 선물 교환권: 이미 선물을 받은 사람 한 명을 골라 그 선물을 뺏어 오고, 뺏긴 사람은 남은 상자에서 다시 뽑습니다.
screens.gift = () => {
  let G = S.gift && S.gift.boxes ? S.gift : null, busy = false, playActs = null;
  const persist = () => { S.gift = G; save(); };
  const tms = []; const later = (fn, ms) => { tms.push(setTimeout(fn, ms)); };
  onCleanup(() => tms.forEach(clearTimeout));
  const closedReal = () => G.boxes.filter((b) => !b.open && !b.swap).length;
  const holders = () => Object.keys(G.got).filter((n) => G.got[n] && !G.got[n].startsWith('😢'));

  // ── 준비: 패배팀(점수 낮은 팀) 자동 선택 + 상자 개수 조정 ──
  function setup() {
    const [a, b] = S.teams.map((t) => t.score);
    let team = G ? G.team : a === b ? 1 : a < b ? 0 : 1;
    const hasSwap = LOSER_GIFTS.some((x) => x.swap);
    const pool = (Array.isArray(S.giftPool) ? S.giftPool : LOSER_GIFTS).filter((x) => hasSwap || !x.swap).map((x) => ({ ...x }));
    function draw() {
      const mem = teamMembers(team), boxes = pool.reduce((s, x) => s + x.c, 0), real = pool.filter((x) => !x.swap).reduce((s, x) => s + x.c, 0);
      main.innerHTML = `
        <div class="screen">
          <div class="head"><h2>🎁 패배팀 상품 뽑기</h2><span class="sub">상자 ${boxes}개 · 선물 ${real}개 · ${esc(S.teams[team].name)} ${mem.length}명</span></div>
          <div class="stage-wrap">
            <div class="stage" style="gap:10px;align-items:stretch">
              <div class="row">${[0, 1].map((t) => `<button class="btn ${t ? 'B' : 'A'} ${team === t ? 'on' : ''}" data-a="team" data-v="${t}">${esc(S.teams[t].name)} (${S.teams[t].score}점)${team === t ? ' ← 패배팀' : ''}</button>`).join('')}</div>
              <div class="ngrid">${mem.map((n) => `<span class="nbtn ${team ? 'tB' : 'tA'}">${esc(n)}</span>`).join('') || '<p class="sub" style="color:var(--muted)">🎲 팀 나누기를 먼저 해 주세요</p>'}</div>
              <div class="gpool">${pool.map((x, k) => `<div class="prow"><span>${esc(x.n)}</span><button data-a="cnt" data-v="${k}:-1">−</button><span class="pp">${x.c}</span><button data-a="cnt" data-v="${k}:1">＋</button></div>`).join('')}</div>
              ${real < mem.length ? `<p class="notice" style="margin:0">⚠️ 선물(${real}개)이 인원(${mem.length}명)보다 적어요. 못 받는 사람이 생깁니다.</p>` : ''}
              ${pool.some((x) => x.swap) ? `<p class="sub" style="margin:0;color:var(--muted)">🔄 선물 교환권: 이미 선물을 받은 사람의 선물을 뺏어 옵니다. 뺏긴 사람은 남은 상자에서 다시 뽑아요.</p>` : ''}
            </div>
            <div class="controls">
              <p class="notice" style="margin:0;text-align:center">🏆 우승팀: ${esc(PRIZE_INFO.win)}<br>👑 개인 우수상: ${esc(PRIZE_INFO.mvp)}</p>
              <button class="btn big gold" data-a="start" ${mem.length ? '' : 'disabled'}>🎁 상자 섞고 시작!</button>
              ${G && G.phase !== 'done' ? '<button class="btn" data-a="resume">▶ 진행 중이던 뽑기 이어서</button>' : ''}
              <button class="btn" data-a="roulette">🎰 벌칙 룰렛</button>
            </div>
          </div>
        </div>`;
      setCtl({ q: `${S.teams[team].name} · 상자 ${boxes}개`, can: [{ a: 'start', l: '🎁 상자 섞고 시작!', k: 'big' }] });
    }
    actions = {
      ...playActs,
      team: (v) => { team = Number(v); draw(); },
      cnt: (v) => { const [k, d] = v.split(':').map(Number); pool[k].c = Math.max(0, Math.min(10, pool[k].c + d)); S.giftPool = pool; save(); draw(); },
      start: () => {
        const mem = teamMembers(team);
        if (!mem.length) return;
        const boxes = shuffle(pool.flatMap((x) => Array.from({ length: x.c }, () => ({ p: x.n, swap: !!x.swap, open: false, by: null }))));
        G = { team, boxes, queue: shuffle(mem), got: {}, log: [], phase: 'pick', swapper: null };
        persist(); sfx.fanfare(); play();
      },
      resume: () => { if (G) play(); },
      roulette: () => go('roulette'),
    };
    draw();
  }

  // ── 뽑기 ──
  function play() {
    actions = playActs;
    if (G.phase !== 'done' && (!G.queue.length || (!closedReal() && G.phase === 'pick' && !G.boxes.some((b) => !b.open)))) G.phase = 'done';
    const cur = G.queue[0], tc = G.team ? 'B' : 'A';
    const done = G.phase === 'done', swap = G.phase === 'swap';
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🎁 ${esc(S.teams[G.team].name)} 상품 뽑기</h2><span class="pill">남은 상자 ${G.boxes.filter((b) => !b.open).length}개</span></div>
        <div class="stage-wrap">
          <div class="stage" style="gap:10px">
            <div class="result-big" id="gmsg" style="text-align:center;font-size:clamp(22px,6vmin,44px)">${done ? '🎉 모두 뽑았어요!'
              : swap ? `🔄 ${esc(G.swapper)} 님, 누구 선물을 뺏을까요?` : `👉 <span style="color:var(--${tc})">${esc(cur)}</span> 님, 상자를 고르세요!`}</div>
            <div class="gboxes">${G.boxes.map((b, k) => `<button class="gbox ${b.open ? 'open' + (b.swap ? ' swap' : '') : ''}" data-a="open" data-v="${k}" ${b.open || swap || done || busy ? 'disabled' : ''}>
              ${b.open ? `<b>${esc(b.p)}</b><small>${esc(b.by || '')}</small>` : `<span class="gnum">${k + 1}</span>🎁`}</button>`).join('')}</div>
            ${swap ? `<div class="ngrid">${holders().map((n) => `<button class="nbtn t${tc}" data-a="victim" data-v="${esc(n)}">${esc(n)}<small>${esc(G.got[n])}</small></button>`).join('')}</div>` : ''}
          </div>
          <div class="controls">
            <div class="glist">${Object.keys(G.got).map((n) => `<div class="prow"><span>${esc(n)}</span><b>${esc(G.got[n])}</b></div>`).join('') || '<p class="sub" style="color:var(--muted);text-align:center">아직 아무도 안 뽑았어요</p>'}</div>
            ${!done && G.queue.length > 1 ? `<p class="sub" style="margin:0;text-align:center;color:var(--muted)">다음 차례: ${G.queue.slice(1).map(esc).join(' → ')}</p>` : ''}
            ${done ? `${G.boxes.some((b) => !b.open) ? `<p class="sub" style="margin:0;text-align:center;color:var(--muted)">남은 상자: ${G.boxes.filter((b) => !b.open).map((b) => esc(b.p)).join(', ')}</p>` : ''}
              <button class="btn big gold" data-a="awards">🏆 시상식으로</button>` : ''}
            <div class="row"><button class="btn" data-a="undo" ${G.log.length && !busy ? '' : 'disabled'}>↩️ 취소</button><button class="btn" data-a="setup">✏️ 처음부터</button></div>
          </div>
        </div>
      </div>`;
    setCtl({
      q: done ? '뽑기 끝' : swap ? `🔄 ${G.swapper} 교환권` : `${cur} 차례`,
      answer: done ? '' : swap ? '뺏을 사람을 고르세요' : `${cur} 님 차례`,
      can: done ? [{ a: 'awards', l: '🏆 시상식으로', k: 'big' }]
        : swap ? holders().map((n) => ({ a: 'victim', v: n, l: `🔄 ${n} (${G.got[n]})` }))
          : G.boxes.map((b, k) => (b.open ? null : { a: 'open', v: String(k), l: `🎁 ${k + 1}번 상자` })).filter(Boolean),
    });
  }
  const snap = () => { G.log.push(JSON.stringify({ boxes: G.boxes, queue: G.queue, got: G.got, phase: G.phase, swapper: G.swapper })); };

  playActs = {
    open: (v) => {
      if (busy || G.phase !== 'pick') return;
      const k = Number(v), box = G.boxes[k], who = G.queue[0];
      if (!box || box.open || !who) return;
      snap(); busy = true;
      // 두구두구 1.2초 → 공개
      const el = main.querySelector(`.gbox[data-v="${k}"]`); if (el) el.classList.add('shaking');
      for (let i = 0; i < 10; i++) later(() => tone(200 + (i % 2) * 40, 0.06, 'triangle', 0.25), i * 110);
      later(() => {
        busy = false; box.open = true; box.by = who;
        if (box.swap) {
          if (holders().length) { G.phase = 'swap'; G.swapper = who; sfx.go(); flash('var(--gold)'); toast(`🔄 선물 교환권! ${who} 님이 다른 사람의 선물을 뺏어 올 수 있어요`, 3500); }
          else { sfx.beep(); toast(`🔄 교환권이지만 아직 선물 받은 사람이 없어요! ${who} 님은 한 번 더 뽑으세요`, 3500); }
        } else {
          G.got[who] = box.p; G.queue.shift(); sfx.fanfare(); flash(`var(--${G.team ? 'B' : 'A'})`);
          if (G.queue.length && !closedReal()) G.queue.forEach((n) => { G.got[n] = '😢 꽝 (상품 소진)'; }), (G.queue = []);
        }
        persist(); play();
      }, 1300);
      persist();
    },
    victim: (v) => {
      if (G.phase !== 'swap' || !G.got[v]) return;
      snap();
      const sw = G.swapper;
      const stolen = G.boxes.find((b) => b.open && !b.swap && b.by === v && b.p === G.got[v]);
      if (stolen) stolen.by = `${v} → ${sw}`; // 상자에 "뺏김" 표시
      G.got[sw] = G.got[v]; delete G.got[v];
      G.queue.shift();                 // 교환권 쓴 사람은 끝
      G.queue.unshift(v);              // 뺏긴 사람이 바로 다시 뽑음
      if (!closedReal()) { G.got[v] = '😢 꽝 (상품 소진)'; G.queue.shift(); }
      G.phase = 'pick'; G.swapper = null; sfx.boom(); flash('var(--bad)');
      toast(`🔄 ${sw} 님이 ${v} 님의 ${G.got[sw]}을(를) 가져갔어요! ${v} 님 다시 뽑기`, 3500);
      persist(); play();
    },
    undo: () => {
      if (busy || !G.log.length) return;
      Object.assign(G, JSON.parse(G.log.pop())); sfx.tick(); persist(); play();
    },
    setup: () => { if (G && G.phase !== 'done' && !confirm('뽑기를 처음부터 다시 할까요?')) return; G = null; S.gift = null; save(); setup(); },
    awards: () => go('awards'),
  };
  setup();
};

// ── 🎰 벌칙 룰렛 ──
screens.roulette = () => {
  const items = S.penalties.length ? S.penalties : DEFAULT_PENALTIES;
  const n = items.length, seg = (Math.PI * 2) / n;
  const COLORS = ['#ff4d7e', '#7b5cff', '#37b6ff', '#3ddc97', '#ffd23f', '#ff8a3d'];
  let rot = 0, spinning = false;

  main.innerHTML = `
    <div class="screen">
      <div class="head"><h2>🎰 벌칙 룰렛</h2><span class="sub">설정에서 벌칙 수정 가능</span></div>
      <div class="stage-wrap">
        <div class="stage"><div class="wheel-box"><canvas id="wh"></canvas><div class="pin"></div></div></div>
        <div class="controls">
          <div class="result-big" id="res" style="text-align:center;min-height:1.2em"></div>
          <button class="btn big gold" data-a="spin">🎰 돌려!</button>
        </div>
      </div>
    </div>`;
  setCtl({ can: [{ a: 'spin', l: '🎰 돌려!', k: 'big' }] });
  const cv = $('#wh'), ctx = cv.getContext('2d');
  function draw() {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, size = Math.min(r.width, r.height);
    if (cv.width !== Math.round(size * dpr)) { cv.width = cv.height = Math.round(size * dpr); }
    const R = cv.width / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.translate(R, R); ctx.rotate(rot);
    for (let k = 0; k < n; k++) {
      const a0 = -Math.PI / 2 + k * seg;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * 0.96, a0, a0 + seg); ctx.closePath();
      ctx.fillStyle = COLORS[k % COLORS.length]; if (n % COLORS.length === 1 && k === n - 1) ctx.fillStyle = COLORS[2];
      ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2 * dpr; ctx.stroke();
      ctx.save(); ctx.rotate(a0 + seg / 2); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#111';
      // 칸 안(중심 원 바깥)에 들어가도록 글자 크기를 줄임
      let fs = R * 0.1;
      do { ctx.font = `800 ${fs}px Pretendard, sans-serif`; fs *= 0.92; } while (ctx.measureText(items[k]).width > R * 0.7 && fs > R * 0.045);
      ctx.fillText(items[k], R * 0.9, 0); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.12, 0, Math.PI * 2); ctx.fillStyle = '#0d0b1e'; ctx.fill();
  }
  draw(); window.addEventListener('resize', draw); onCleanup(() => window.removeEventListener('resize', draw));
  let raf; onCleanup(() => cancelAnimationFrame(raf));
  const idxAt = (r) => { const a = ((-r % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return Math.floor(a / seg) % n; };

  actions = {
    spin: () => {
      if (spinning) return; spinning = true; $('#res').textContent = '';
      const target = Math.random() * n | 0;
      // 목표 칸 중앙이 핀(위쪽)에 오도록 + 여러 바퀴
      const want = -(target * seg + seg / 2) + (Math.random() - 0.5) * seg * 0.6;
      const base = rot - (rot % (Math.PI * 2));
      const end = base + Math.PI * 2 * (6 + (Math.random() * 3 | 0)) + ((want % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const start = rot, dur = 5200, t0 = performance.now(); let lastIdx = idxAt(rot);
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        rot = start + (end - start) * e; draw();
        const ix = idxAt(rot); if (ix !== lastIdx) { lastIdx = ix; sfx.tick(); }
        if (p < 1) raf = requestAnimationFrame(step);
        else { spinning = false; sfx.fanfare(); flash('var(--gold)'); const el = $('#res'); el.textContent = '👉 ' + items[idxAt(rot)]; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
      };
      raf = requestAnimationFrame(step);
    },
  };
};

// ── 🏓 탁구·당구 대항전 ──
// 규칙 카드 + 게임별 진행 도구. 이긴 팀 보너스는 위 점수판에 그대로 더해집니다.
const TABLE_GAMES = [
  { key: 'rotate', tb: 'ping', ic: '🔄', t: '돌림 탁구', d: '전원 생존전', tool: 'survive', prize: 3, rules: [
    '전원이 탁구대 양쪽에 반씩 줄을 섭니다.',
    '한 번 치면 탁구대를 돌아 <b>반대편 줄 끝</b>으로 뛰어갑니다.',
    '공을 놓치거나 아웃되면 <b>탈락</b>! 화면에서 이름을 누르세요.',
    '2명이 남으면 결승: <b>3점</b> 먼저 내는 사람이 우승!',
    '우승자의 팀이 보너스 점수를 받습니다.'] },
  { key: 'cups', tb: 'ping', ic: '🥤', t: '컵 넣기', d: 'A팀 vs B팀', tool: 'cups', prize: 3, rules: [
    '탁구대 양 끝에 물 담은 종이컵을 삼각형으로 놓습니다.',
    '팀원이 돌아가며 공을 던져 <b>상대 팀 컵</b>에 넣습니다.',
    '들어간 컵은 빼고, 바닥에 한 번 튕겨 넣으면 <b>2개</b>를 뺍니다.',
    '상대 컵을 먼저 다 없앤 팀이 승리!'] },
  { key: 'blow', tb: 'ping', ic: '💨', t: '바람 탁구', d: '입으로만 후~', tool: 'match', target: 5, prize: 2, rules: [
    '양 팀이 탁구대 양쪽에 무릎을 꿇고 앉습니다. (2~3명씩, 1점마다 교대)',
    '가운데 놓은 공을 <b>입으로만</b> 불어서 상대 쪽 바닥으로 떨어뜨립니다.',
    '손이나 얼굴이 공에 닿으면 상대 점수!',
    '먼저 목표 점수를 낸 팀이 승리'] },
  { key: 'handi', tb: 'ping', ic: '🍳', t: '핸디캡 탁구', d: '핸디캡 뽑기', tool: 'match', target: 7, handicap: true, prize: 2, rules: [
    'A팀 1명 vs B팀 1명이 칩니다. 1점마다 다음 사람으로 교대!',
    '잘 치는 사람은 <b>🎲 핸디캡 뽑기</b>로 핸디캡을 걸고 칩니다.',
    '서브는 2점마다 넘깁니다.',
    '먼저 목표 점수를 낸 팀이 승리'] },
  { key: 'serve', tb: 'ping', ic: '🎯', t: '과녁 서브', d: '한 명씩 서브', tool: 'serve', prize: 2, rules: [
    '상대 코트에 종이컵이나 A4 용지로 과녁을 놓습니다. (작을수록 높은 점수: 1·3·5점)',
    '팀이 번갈아 <b>한 명씩</b> 서브합니다. 화면에 차례가 나옵니다.',
    '맞힌 과녁 점수를 누르세요. 빗나가면 [빗나감]',
    '모두 서브하면 합계가 높은 팀이 승리'] },
  { key: 'killer', tb: 'pool', ic: '💀', t: '킬러', d: '목숨 3개 생존전', tool: 'lives', prize: 3, rules: [
    '각자 목숨이 3개. 화면의 순서대로 <b>한 번씩만</b> 칩니다.',
    '아무 공이나 넣으면 통과, 못 넣으면 <b>목숨 −1</b>',
    '흰 공이 들어가도(스크래치) 목숨 −1',
    '목숨이 0이 되면 탈락, 마지막 생존자가 우승!',
    '공이 다 들어가면 다시 세팅하고 이어서 합니다.'] },
  { key: 'curling', tb: 'pool', ic: '🥌', t: '당구 컬링', d: '힘 조절 대결', tool: 'curling', target: 3, prize: 2, rules: [
    '한 명씩 흰 공을 쳐서 <b>반대편 쿠션을 맞고</b> 돌아오게 합니다.',
    '출발 쪽 쿠션에 <b>가장 가깝게</b> 멈춘 사람이 그 라운드 승리',
    '라운드마다 양 팀에서 한 명씩 나와 칩니다. 이긴 사람 이름을 누르세요.',
    '먼저 목표 라운드 수를 이긴 팀이 승리'] },
  { key: 'hand', tb: 'pool', ic: '✋', t: '손 당구', d: '30초 타임어택', tool: 'timed', sec: 30, prize: 2, rules: [
    '큐 없이 <b>손으로</b> 흰 공을 굴려 다른 공을 맞혀 넣습니다.',
    '다른 공을 손으로 직접 굴리면 무효!',
    '팀별로 30초 동안 팀원이 돌아가며 굴립니다. 넣을 때마다 [+1]',
    '더 많이 넣은 팀이 승리'] },
  { key: 'relay', tb: 'pool', ic: '🎱', t: '릴레이 포켓볼', d: '한 큐씩 교대', tool: 'relay', prize: 3, rules: [
    '팀별로 칠 공(줄무늬 / 단색)을 정합니다.',
    '팀원이 <b>한 큐씩</b> 순서대로 칩니다. 잘 치는 사람이 혼자 끝낼 수 없어요!',
    '넣으면 우리 팀 다음 사람이 이어서, 못 넣으면 상대 팀 차례',
    '자기 공을 다 넣고 8번 공까지 넣으면 승리 (8번을 먼저 넣으면 패배)'] },
];
const HANDICAPS = ['반대손으로 치기', '폰을 라켓으로', '슬리퍼를 라켓으로', '한 발로 서서', '한쪽 눈 감고', '라켓 손잡이 끝만 잡기',
  '칠 때마다 "나이스!" 외치기', '책을 라켓으로', '쪼그려 앉아서', '상대 팀이 고른 물건으로', '라켓 대신 손바닥으로', '핸디캡 없음 (행운!)'];

screens.tables = () => {
  if (!S.tbl) S.tbl = {};
  const roster = Array.isArray(S.roster) && S.roster.length === 2 ? S.roster : null;
  const names = roster ? [...roster[0], ...roster[1]] : (S.players || []).slice();
  const teamOf = (n) => (!roster ? null : roster[0].includes(n) ? 0 : roster[1].includes(n) ? 1 : null);
  const tc = (n) => ({ 0: ' tA', 1: ' tB' }[teamOf(n)] || '');
  const TN = (t) => esc(S.teams[t].name);
  const who = (t, i) => (roster && roster[t].length ? roster[t][i % roster[t].length] : `${i % 5 + 1}번 선수`);
  const hearts = (l, max) => '❤️'.repeat(Math.max(0, l)) + '🖤'.repeat(Math.max(0, max - l));
  const muted = (s) => `<small style="color:var(--muted)">${s}</small>`;
  const col = (t, inner) => `<div class="bet ${t ? 'B' : 'A'}"><b>${TN(t)}</b>${inner}</div>`;
  const banner = (t) => `<div class="result-big pop">🏆 ${t == null ? '동점!' : TN(t) + ' 승리!'}</div>`;
  const firstTo = (sc, n) => { const t = [0, 1].find((k) => sc[k] >= n); return t == null ? null : { t }; };
  const higher = (sc) => ({ t: sc[0] === sc[1] ? null : sc[0] > sc[1] ? 0 : 1 });
  const needNames = `<p class="notice" style="margin:0">참가자 명단이 없어요</p>
    <p class="sub" style="margin:0;color:var(--muted)">🎲 팀 나누기에서 이름을 넣고 팀을 뽑으면 이름과 팀이 자동으로 들어옵니다.</p>
    <button class="btn primary" data-a="toTeams">🎲 팀 나누기로</button>`;

  let G = null, tool = null, st = null, hist = [], rulesOn = false, running = false, left = 0, stopT = null, spinT = null;
  const stopTimer = () => { if (stopT) { stopT(); stopT = null; } running = false; };
  onCleanup(stopTimer); onCleanup(() => clearTimeout(spinT));
  const persist = () => { S.tbl[G.key] = st; save(); };
  // 상태를 바꾸는 동작은 모두 여기를 거쳐서 [↩️ 되돌리기]가 가능
  const mut = (fn) => { hist.push(JSON.stringify(st)); if (hist.length > 60) hist.shift(); fn(st); persist(); draw(); };

  const TOOLS = {
    // 돌림 탁구: 탈락자 표시 → 마지막 1명 우승
    survive: {
      init: () => ({ order: shuffle(names), out: [] }),
      alive: (s) => s.order.filter((n) => !s.out.includes(n)),
      winner: (s) => { const a = TOOLS.survive.alive(s); return s.order.length > 1 && a.length === 1 ? { t: teamOf(a[0]) } : null; },
      board: (s) => {
        if (s.order.length < 2) return needNames;
        const a = TOOLS.survive.alive(s), done = a.length === 1;
        return `${done ? `<div class="result-big pop">🏆 ${esc(a[0])} 우승!</div>`
          : `<div class="row"><span class="pill">남은 사람 ${a.length} / ${s.order.length}명</span>${a.length === 2 ? '<span class="notice">🔥 결승! 3점 먼저 내면 우승</span>' : ''}</div>`}
          <div class="ngrid">${s.order.map((n) => `<button class="nbtn${tc(n)}${s.out.includes(n) ? ' dead' : ''}" data-a="tap" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>
          ${done ? '' : muted('탈락한 사람 이름을 누르세요 (다시 누르면 복귀) · 줄 서는 순서대로 표시')}`;
      },
      ctrls: () => '<button class="btn" data-a="mix">🔀 줄 순서 섞기</button>',
      acts: () => ({
        tap: (v) => mut((s) => { const i = s.out.indexOf(v); if (i >= 0) s.out.splice(i, 1); else { s.out.push(v); TOOLS.survive.winner(s) ? sfx.fanfare() : sfx.bad(); } }),
        mix: () => mut((s) => { s.order = shuffle(s.order); }),
      }),
    },
    // 킬러: 순서대로 한 번씩, 못 넣으면 목숨 −1
    lives: {
      init: () => { const order = shuffle(names); return { order, life: order.map(() => 3), max: 3, cur: 0 }; },
      alive: (s) => s.order.filter((_, i) => s.life[i] > 0),
      winner: (s) => { const a = TOOLS.lives.alive(s); return s.order.length > 1 && a.length === 1 ? { t: teamOf(a[0]) } : null; },
      board: (s) => {
        if (s.order.length < 2) return needNames;
        const a = TOOLS.lives.alive(s), done = a.length === 1;
        return `${done ? `<div class="result-big pop">🏆 ${esc(a[0])} 생존!</div>`
          : `<div class="notice" style="margin:0">🎱 지금 차례: <b style="font-size:1.4em;color:var(--text)">${esc(s.order[s.cur])}</b> ${muted(`· 생존 ${a.length}명`)}</div>`}
          <div class="ngrid">${s.order.map((n, i) => `<button class="nbtn${tc(n)}${s.life[i] <= 0 ? ' dead' : ''}${i === s.cur && !done ? ' cur' : ''}" data-a="pick" data-v="${i}">${esc(n)}<small>${s.life[i] > 0 ? hearts(s.life[i], s.max) : '💀 탈락'}</small></button>`).join('')}</div>
          ${done ? '' : muted('이름을 누르면 그 사람 차례로 바뀝니다')}`;
      },
      ctrls: (s) => `${TOOLS.lives.winner(s) ? '' : '<div class="row"><button class="btn big ok" data-a="hit">⭕ 넣음</button><button class="btn big bad" data-a="miss">❌ 못 넣음</button></div>'}
        <div class="chips">${[2, 3, 4].map((m) => `<button class="chip ${s.max === m ? 'on' : ''}" data-a="max" data-v="${m}">목숨 ${m}개</button>`).join('')}</div>`,
      acts: () => {
        const next = (s) => { for (let k = 1; k <= s.order.length; k++) { const j = (s.cur + k) % s.order.length; if (s.life[j] > 0) { s.cur = j; return; } } };
        return {
          hit: () => { if (!TOOLS.lives.winner(st)) mut((s) => { sfx.ok(); next(s); }); },
          miss: () => {
            if (TOOLS.lives.winner(st)) return;
            mut((s) => {
              s.life[s.cur]--;
              if (s.life[s.cur] <= 0) { toast(`💀 ${s.order[s.cur]} 님 탈락!`); TOOLS.lives.winner(s) ? sfx.fanfare() : sfx.boom(); } else sfx.bad();
              next(s);
            });
          },
          pick: (v) => { const i = Number(v); if (st.life[i] > 0 && !TOOLS.lives.winner(st)) mut((s) => { s.cur = i; }); },
          max: (v) => mut((s) => { s.max = Number(v); s.life = s.life.map(() => s.max); s.cur = 0; toast(`목숨을 ${s.max}개로 다시 채웠어요`); }),
        };
      },
    },
    // 컵 넣기: 팀별로 상대 컵을 몇 개 없앴는지
    cups: {
      init: () => ({ n: 6, hit: [0, 0] }),
      winner: (s) => firstTo(s.hit, s.n),
      board: (s) => {
        const w = TOOLS.cups.winner(s);
        const cups = (t) => `<div class="cups">${range(s.n).map((i) => `<span class="${i < s.hit[t] ? 'gone' : ''}">🥤</span>`).join('')}</div>`;
        return `${w ? banner(w.t) : muted('넣은 팀 쪽 버튼을 누르세요. 상대 컵이 하나씩 빠집니다.')}
          <div class="bets">${[0, 1].map((t) => col(t, `${muted('상대 컵 남은 개수')}<div class="amt">${Math.max(0, s.n - s.hit[t])}</div>${cups(t)}
            <div class="row"><button class="btn ok" data-a="hit" data-v="${t}:1">🎯 +1</button><button class="btn gold" data-a="hit" data-v="${t}:2">💥 바운드 +2</button><button class="btn" data-a="hit" data-v="${t}:-1">−1</button></div>`)).join('')}</div>`;
      },
      ctrls: (s) => `<div class="chips">${[6, 10].map((m) => `<button class="chip ${s.n === m ? 'on' : ''}" data-a="n" data-v="${m}">컵 ${m}개</button>`).join('')}</div>`,
      acts: () => ({
        hit: (v) => {
          const [t, d] = v.split(':').map(Number);
          if (d > 0 && TOOLS.cups.winner(st)) return;
          mut((s) => { s.hit[t] = Math.max(0, Math.min(s.n, s.hit[t] + d)); if (d > 0) { flash(t ? 'var(--B)' : 'var(--A)'); s.hit[t] >= s.n ? sfx.fanfare() : sfx.ok(); } else sfx.tick(); });
        },
        n: (v) => mut((s) => { s.n = Number(v); s.hit = [0, 0]; }),
      }),
    },
    // 바람 탁구 · 핸디캡 탁구: 목표 점수 먼저
    match: {
      init: (g) => ({ sc: [0, 0], target: g.target, hc: '' }),
      winner: (s) => firstTo(s.sc, s.target),
      board: (s, g) => {
        const w = TOOLS.match.winner(s);
        return `${w ? banner(w.t) : `<span class="pill">${s.target}점 먼저 내면 승리</span>`}
          <div class="bets">${[0, 1].map((t) => col(t, `<div class="amt">${s.sc[t]}</div><div class="row"><button class="btn ok" data-a="sc" data-v="${t}:1">＋1</button><button class="btn" data-a="sc" data-v="${t}:-1">−1</button></div>`)).join('')}</div>
          ${g.handicap ? `<div class="hcap" id="hc">${s.hc ? '🍳 ' + esc(s.hc) : '<small>잘 치는 사람 차례에 🎲 핸디캡 뽑기!</small>'}</div>` : ''}`;
      },
      ctrls: (s, g) => `${g.handicap ? '<button class="btn big gold" data-a="hcap">🎲 핸디캡 뽑기</button>' : ''}
        <div class="chips">${[3, 5, 7, 11].map((m) => `<button class="chip ${s.target === m ? 'on' : ''}" data-a="target" data-v="${m}">${m}점</button>`).join('')}</div>`,
      acts: () => ({
        sc: (v) => {
          const [t, d] = v.split(':').map(Number);
          if (d > 0 && TOOLS.match.winner(st)) return;
          mut((s) => { s.sc[t] = Math.max(0, s.sc[t] + d); if (d > 0) { flash(t ? 'var(--B)' : 'var(--A)'); s.sc[t] >= s.target ? sfx.fanfare() : sfx.ok(); } else sfx.tick(); });
        },
        target: (v) => mut((s) => { s.target = Number(v); }),
        hcap: () => {
          clearTimeout(spinT); let k = 0;
          const spin = () => {
            const el = $('#hc'); if (!el) return;
            if (k++ < 14) { el.textContent = '🎲 ' + pick(HANDICAPS); sfx.tick(); spinT = setTimeout(spin, 50 + k * 14); }
            else mut((s) => { s.hc = pick(HANDICAPS.filter((h) => h !== s.hc)); sfx.fanfare(); });
          };
          spin();
        },
      }),
    },
    // 과녁 서브: 팀이 번갈아 한 명씩
    serve: {
      init: () => ({ sc: [0, 0], k: [0, 0], turn: 0, per: 1 }),
      total: (s) => s.per * (roster ? Math.max(roster[0].length, roster[1].length, 1) : 5),
      winner: (s) => { const T = TOOLS.serve.total(s); return s.k[0] >= T && s.k[1] >= T ? higher(s.sc) : null; },
      board: (s) => {
        const T = TOOLS.serve.total(s), w = TOOLS.serve.winner(s);
        return `${w ? banner(w.t) : `<div class="notice" style="margin:0">🎯 서브: ${TN(s.turn)} · <b style="font-size:1.4em;color:var(--text)">${esc(who(s.turn, s.k[s.turn]))}</b></div>`}
          <div class="bets">${[0, 1].map((t) => col(t, `<div class="amt">${s.sc[t]}</div>${muted(`서브 ${Math.min(s.k[t], T)} / ${T}`)}`)).join('')}</div>`;
      },
      ctrls: (s) => `${TOOLS.serve.winner(s) ? '' : `<div class="row">${[1, 3, 5].map((p) => `<button class="btn big ok" data-a="pt" data-v="${p}">+${p}</button>`).join('')}</div>
        <button class="btn bad" data-a="pt" data-v="0">빗나감 (0점)</button>`}
        <div class="chips">${[1, 2, 3].map((m) => `<button class="chip ${s.per === m ? 'on' : ''}" data-a="per" data-v="${m}">한 사람 ${m}번</button>`).join('')}</div>`,
      acts: () => ({
        pt: (v) => {
          if (TOOLS.serve.winner(st)) return;
          mut((s) => {
            const p = Number(v), T = TOOLS.serve.total(s);
            s.sc[s.turn] += p; s.k[s.turn]++; p ? sfx.ok() : sfx.bad();
            if (s.k[1 - s.turn] < T) s.turn = 1 - s.turn;
            if (TOOLS.serve.winner(s)) sfx.fanfare();
          });
        },
        per: (v) => mut((s) => { s.per = Number(v); }),
      }),
    },
    // 손 당구: 팀별 30초 동안 넣은 개수
    timed: {
      init: () => ({ sc: [0, 0], turn: 0, done: [false, false] }),
      winner: (s) => (s.done[0] && s.done[1] ? higher(s.sc) : null),
      board: (s, g) => {
        const w = TOOLS.timed.winner(s);
        const state = (t) => (s.done[t] ? '✅ 완료' : t === s.turn ? (running ? '🔥 진행 중' : '⏳ 다음 차례') : '대기');
        return `${w ? banner(w.t) : `<div class="notice" style="margin:0">✋ ${TN(s.turn)} 차례 · 팀원이 돌아가며 굴리세요</div><div class="timer" id="tm">${running ? left : g.sec}</div>`}
          <div class="bets">${[0, 1].map((t) => col(t, `<div class="amt">${s.sc[t]}</div>${muted(state(t))}`)).join('')}</div>`;
      },
      ctrls: (s, g) => (TOOLS.timed.winner(s) ? ''
        : running ? '<button class="btn big ok" data-a="pot">🎱 넣었다 +1</button><button class="btn" data-a="unpot">−1 (잘못 누름)</button>'
          : `<button class="btn big primary" data-a="start">▶ ${TN(s.turn)} ${g.sec}초 시작</button>`),
      acts: (g) => ({
        start: () => {
          if (running || TOOLS.timed.winner(st)) return;
          running = true; left = g.sec; sfx.go(); draw();
          stopT = countdown(g.sec, (x) => {
            left = x; const el = $('#tm');
            if (el) { el.textContent = x; el.classList.toggle('warn', x <= 5); }
            if (x <= 5 && x > 0) sfx.tick();
          }, () => {
            stopT = null; running = false; sfx.boom(); flash('#ff6b00');
            mut((s) => { s.done[s.turn] = true; if (!s.done[1 - s.turn]) s.turn = 1 - s.turn; if (TOOLS.timed.winner(s)) sfx.fanfare(); });
          });
        },
        pot: () => { if (running) mut((s) => { s.sc[s.turn]++; sfx.ok(); }); },
        unpot: () => { if (running) mut((s) => { s.sc[s.turn] = Math.max(0, s.sc[s.turn] - 1); sfx.tick(); }); },
      }),
    },
    // 당구 컬링: 라운드마다 가장 가깝게 멈춘 사람의 팀이 1승
    curling: {
      init: (g) => ({ wins: [0, 0], target: g.target, log: [] }),
      winner: (s) => firstTo(s.wins, s.target),
      board: (s) => {
        const w = TOOLS.curling.winner(s);
        const picker = roster
          ? `<div class="ngrid">${names.map((n) => `<button class="nbtn${tc(n)}" data-a="win" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>`
          : `<div class="row">${[0, 1].map((t) => `<button class="btn big ${t ? 'B' : 'A'}" data-a="win" data-v="#${t}">${TN(t)} 승</button>`).join('')}</div>`;
        return `${w ? banner(w.t) : `<div class="notice" style="margin:0">🥌 ${s.log.length + 1}라운드: 가장 가깝게 멈춘 사람은?</div>${picker}`}
          <div class="bets">${[0, 1].map((t) => col(t, `<div class="amt">${s.wins[t]}</div>${muted(`${s.target}승 먼저`)}`)).join('')}</div>
          ${s.log.length ? `<div class="results">${s.log.map((x, i) => `<span class="o">${i + 1}R ${esc(x)}</span>`).join('')}</div>` : ''}`;
      },
      ctrls: (s) => `<div class="chips">${[2, 3, 5].map((m) => `<button class="chip ${s.target === m ? 'on' : ''}" data-a="target" data-v="${m}">${m}승 먼저</button>`).join('')}</div>`,
      acts: () => ({
        win: (v) => {
          if (TOOLS.curling.winner(st)) return;
          const t = v[0] === '#' ? Number(v.slice(1)) : teamOf(v);
          if (t == null) return;
          mut((s) => { s.wins[t]++; s.log.push(v[0] === '#' ? S.teams[t].name : v); flash(t ? 'var(--B)' : 'var(--A)'); TOOLS.curling.winner(s) ? sfx.fanfare() : sfx.ok(); });
        },
        target: (v) => mut((s) => { s.target = Number(v); }),
      }),
    },
    // 릴레이 포켓볼: 팀원이 한 큐씩 순서대로
    relay: {
      init: () => ({ turn: 0, idx: [0, 0], win: null }),
      winner: (s) => (s.win == null ? null : { t: s.win }),
      board: (s) => {
        const w = TOOLS.relay.winner(s);
        const list = (t) => (roster && roster[t].length
          ? `<div class="rlist">${roster[t].map((n, i) => `<span class="${i === s.idx[t] % roster[t].length ? 'now' : ''}">${esc(n)}</span>`).join('')}</div>`
          : muted(`다음: ${who(t, s.idx[t])}`));
        return `${w ? banner(w.t) : `${muted('🎱 지금 칠 사람')}<div class="slot ${s.turn ? 'B' : 'A'}">${esc(who(s.turn, s.idx[s.turn]))}</div>`}
          <div class="bets">${[0, 1].map((t) => col(t, list(t))).join('')}</div>`;
      },
      ctrls: (s) => (s.win != null ? '' : `<div class="row"><button class="btn big ok" data-a="pot">⭕ 넣음</button><button class="btn big bad" data-a="miss">❌ 못 넣음</button></div>
        ${muted('넣으면 같은 팀 다음 사람, 못 넣으면 상대 팀 차례')}
        <div class="row">${[0, 1].map((t) => `<button class="btn ${t ? 'B' : 'A'}" data-a="win" data-v="${t}">🏆 ${TN(t)} 승리</button>`).join('')}</div>`),
      acts: () => ({
        pot: () => { if (st.win == null) mut((s) => { s.idx[s.turn]++; sfx.ok(); }); },
        miss: () => { if (st.win == null) mut((s) => { s.idx[s.turn]++; s.turn = 1 - s.turn; sfx.bad(); }); },
        win: (v) => mut((s) => { s.win = Number(v); sfx.fanfare(); flash('var(--gold)'); }),
      }),
    },
  };

  // ── 목록 ──
  function menu() {
    stopTimer();
    const grp = (tb, title) => `<div class="tgrp">${title}</div>
      <div class="grid">${TABLE_GAMES.filter((g) => g.tb === tb).map((g) => `<button class="card" data-a="open" data-v="${g.key}"><span class="ic">${g.ic}</span><span class="t">${g.t}</span><span class="d">${S.tbl[g.key] ? '▶ 이어서' : g.d}</span></button>`).join('')}</div>`;
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🏓 탁구·당구 대항전</h2><span class="sub">${roster ? '팀 명단 연결됨 · 이긴 팀 보너스는 위 점수판에 합산' : '🎲 팀 나누기를 먼저 하면 이름과 팀이 자동으로 들어가요'}</span></div>
        ${grp('ping', '🏓 탁구대')}
        ${grp('pool', '🎱 당구대')}
      </div>`;
    actions = { open: (k) => open(k) };
  }

  function open(k) {
    stopTimer();
    G = TABLE_GAMES.find((g) => g.key === k); tool = TOOLS[G.tool];
    rulesOn = !S.tbl[k]; st = S.tbl[k] || tool.init(G); hist = [];
    draw();
  }

  function awardRow(w) {
    const pts = st.pts || G.prize, done = st.awarded != null;
    return `<div class="row"><span class="sub" style="color:var(--muted)">🏆 이긴 팀 보너스</span><button class="chip" data-a="pts" ${done ? 'disabled' : ''}>+${pts}점 🔄</button></div>
      <div class="row">${[0, 1].map((t) => `<button class="btn ${t ? 'B' : 'A'}${w.t === t ? ' on' : ''}" data-a="award" data-v="${t}" ${done ? 'disabled' : ''}>${done && st.awarded === t ? '✅ ' : ''}${TN(t)} +${pts}</button>`).join('')}</div>
      ${done ? '<button class="btn gold" data-a="roulette">🎰 진 팀 벌칙 룰렛</button>' : ''}`;
  }

  function draw() {
    const w = rulesOn ? null : tool.winner(st);
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>${G.ic} ${G.t}</h2><span class="pill">${G.tb === 'ping' ? '🏓 탁구대' : '🎱 당구대'}</span></div>
        <div class="stage-wrap">
          <div class="stage${rulesOn ? ' scroll' : ''}">${rulesOn
            ? `<div class="rulecard"><div class="rt">${G.ic} ${G.t}</div><ol>${G.rules.map((r) => `<li>${r}</li>`).join('')}</ol></div>`
            : tool.board(st, G)}</div>
          <div class="controls">
            ${rulesOn ? '<button class="btn big primary" data-a="play">▶ 시작</button>' : tool.ctrls(st, G)}
            ${w ? awardRow(w) : ''}
            <div class="row tbar">
              ${rulesOn ? '' : '<button class="btn" data-a="rules">📖 규칙</button>'}
              ${!rulesOn && hist.length ? '<button class="btn" data-a="undo">↩️ 취소</button>' : ''}
              ${rulesOn ? '' : '<button class="btn" data-a="reset">🔁 새 판</button>'}
              <button class="btn" data-a="menu">☰ 목록</button>
            </div>
          </div>
        </div>
      </div>`;
    actions = Object.assign({
      play: () => { rulesOn = false; persist(); sfx.go(); draw(); },
      rules: () => { if (running) { toast('타이머가 끝난 뒤에 볼 수 있어요'); return; } rulesOn = true; draw(); },
      undo: () => {
        if (running || !hist.length) return;
        const had = st.awarded != null;
        st = JSON.parse(hist.pop()); persist(); sfx.tick(); draw();
        if (had && st.awarded == null) toast('이미 준 보너스 점수는 위 점수판 −/＋로 고쳐 주세요', 3500);
      },
      // 새 판도 되돌리기 기록에 남겨서 실수로 눌러도 복구 가능
      reset: () => { stopTimer(); mut((s) => { const keep = s.pts; st = tool.init(G); if (keep) st.pts = keep; sfx.beep(); toast('새 판! 잘못 눌렀으면 ↩️ 취소'); }); },
      menu: () => menu(),
      toTeams: () => go('teams'),
      pts: () => { const P = [1, 2, 3, 5], cur = st.pts || G.prize; st.pts = P[(P.indexOf(cur) + 1) % P.length]; persist(); sfx.tick(); draw(); },
      award: (v) => {
        if (st.awarded != null) return;
        const t = Number(v), pts = st.pts || G.prize;
        addScore(t, pts); st.awarded = t; persist(); sfx.fanfare(); flash('var(--gold)');
        toast(`${S.teams[t].name} +${pts}점! 점수판에 반영했어요`); draw();
      },
      roulette: () => go('roulette'),
    }, tool.acts(G));
  }

  menu();
};

// ── 🕵️ 마피아 (사회자 진행) ──
// 진행 폰은 TV에 미러링되므로 역할을 화면에 띄우지 않습니다. 역할은 각자 폰(player.html)에서 확인합니다.
screens.mafia = () => {
  if (S.tts === undefined) S.tts = true;
  const parseNames = (txt) => [...new Set(txt.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
  const newCode = () => String(1000 + Math.random() * 9000 | 0);
  const fmt = (s) => `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`;
  // 음성 안내는 순서대로 이어서 읽도록 큐에 쌓음
  const say = (t) => {
    if (!S.tts || !window.speechSynthesis) return;
    try { const u = new SpeechSynthesisUtterance(t); u.lang = 'ko-KR'; u.rate = 0.95; speechSynthesis.speak(u); } catch (e) { /* 미지원 */ }
  };
  const hush = () => { try { speechSynthesis.cancel(); } catch (e) { /* 미지원 */ } };
  onCleanup(hush);

  let M = S.mafia || null, stopTimer = null;
  const persist = () => { S.mafia = M; save(); if (M && M.mode === 'server' && M.ht) sync(); };
  const stopT = () => { if (stopTimer) { stopTimer(); stopTimer = null; } };
  onCleanup(stopT);

  // ── 노트북 서버 모드 (node server.js 로 열었을 때만 사용 가능) ──
  // 서버가 역할·밤 선택을 들고, 각 폰에는 자기 몫만 실시간으로 보냅니다.
  let SRV = null, es = null;
  const srvReady = location.protocol.startsWith('http')
    ? fetch('/api/ping', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => (SRV = j && j.ok ? j : null)).catch(() => null)
    : Promise.resolve(null);
  const post = (route, body) => fetch('/api/m/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json().then((j) => (r.ok ? j : Promise.reject(j))));
  const hostPost = (route, body = {}) => post(route, { c: M.g.c, ht: M.ht, ...body });
  function sync() {
    return hostPost('sync', { phase: M.phase, alive: M.alive, day: M.day, over: M.over, reveal: M.reveal })
      .catch((e) => (e && e.error === 'nogame' ? register().catch(() => null) : null)); // 서버를 다시 켰으면 재등록
  }
  // 서버에 게임 등록 (이미 있으면 그대로) + 현재 상태 맞추기. 서버를 껐다 켜도 이어서 할 수 있음
  async function register() {
    const j = await post('new', { g: M.g, ht: M.ht });
    M.ht = j.ht; S.mafia = M; save();
    await sync();
  }
  const closeES = () => { if (es) { es.close(); es = null; } };
  onCleanup(closeES);
  function listen(fn) {
    closeES();
    const me = es = new EventSource(`/api/m/events?c=${M.g.c}&ht=${M.ht}`);
    me.onmessage = (e) => { try { fn(JSON.parse(e.data)); } catch (err) { /* 무시 */ } };
    // 서버를 다시 켰으면 게임을 다시 등록하고 연결
    me.onerror = () => { if (me.readyState === 2 && es === me) setTimeout(() => { if (es === me) register().then(() => listen(fn)).catch(() => listen(fn)); }, 2000); };
  }

  const roles = () => mafiaRoles(M.g);
  const aliveIdx = () => M.g.n.map((_, k) => k).filter((k) => M.alive[k]);
  const pickGrid = (sel) => `<div class="ngrid">${aliveIdx().map((k) => `<button class="nbtn ${sel === k ? 'on' : ''}" data-a="sel" data-v="${k}">${esc(M.g.n[k])}</button>`).join('')}</div>`;
  const roleTag = (k) => { const r = ROLES[roles()[k]]; return `${r.ic} ${r.n}`; };
  function checkWin() {
    const r = roles(); let ma = 0, ot = 0;
    M.alive.forEach((a, k) => { if (a) r[k] === 'mafia' ? ma++ : ot++; });
    return ma === 0 ? 'citizen' : ma >= ot ? 'mafia' : null;
  }

  // ── 준비 ──
  function setup() {
    stopT();
    let txt = ((M && M.g.n) || S.players || []).join('\n');
    let m = M ? M.g.m : 0, p = M ? M.g.p : 1, d = M ? M.g.d : 1, reveal = M ? !!M.reveal : false;
    // 역할 확인 방식: 'each' = 한 명씩 개인 QR(다른 사람 역할을 볼 수 없음), 'all' = 전체 QR + 이름 고르기(빠름)
    let mode = (M && M.mode) || S.mafiaMode || (SRV ? 'server' : 'each');
    const autoM = (n) => (n <= 6 ? 1 : n <= 11 ? 2 : 3);
    const summary = () => {
      const n = parseNames(txt).length, mm = m || autoM(n);
      return { n, mm, text: `${n}명 · 🔪마피아 ${mm} · 🚓경찰 ${p} · 💉의사 ${d} · 🙂시민 ${n - mm - p - d}` };
    };
    function draw() {
      main.innerHTML = `
        <div class="screen">
          <div class="head"><h2>🕵️ 마피아 · 준비</h2><span class="sub">사회자는 명단에서 빼 주세요</span></div>
          <div class="stage-wrap">
            <div class="stage" style="align-items:stretch">
              <textarea id="names" class="names" placeholder="참가자 이름 (한 줄에 한 명)">${esc(txt)}</textarea>
            </div>
            <div class="controls">
              <div class="pill" id="sum" style="text-align:center">${summary().text}</div>
              <div class="row"><button class="btn" data-a="m" data-v="-1">마피아 −</button><button class="btn" data-a="m" data-v="1">마피아 ＋</button></div>
              <div class="row"><button class="btn ${p ? 'on' : ''}" data-a="p">🚓 경찰 ${p ? 'ON' : 'OFF'}</button><button class="btn ${d ? 'on' : ''}" data-a="d">💉 의사 ${d ? 'ON' : 'OFF'}</button></div>
              <div class="row"><button class="btn ${reveal ? 'on' : ''}" data-a="reveal">탈락 시 직업 공개 ${reveal ? 'ON' : 'OFF'}</button><button class="btn ${S.tts ? 'on' : ''}" data-a="tts">🔊 음성 ${S.tts ? 'ON' : 'OFF'}</button></div>
              ${SRV ? `<button class="btn ${mode === 'server' ? 'on' : ''}" data-a="mode" data-v="server">📡 노트북 서버 (밤에도 폰으로 선택)</button>` : ''}
              <div class="row"><button class="btn ${mode === 'each' ? 'on' : ''}" data-a="mode" data-v="each">🔒 한 명씩 개인 QR</button><button class="btn ${mode === 'all' ? 'on' : ''}" data-a="mode" data-v="all">⚡ 전체 QR (빠름)</button></div>
              <p class="sub" style="margin:0;text-align:center;color:var(--muted)">${mode === 'server' ? 'QR 하나로 접속, 이름은 먼저 고른 사람만. 밤에는 각자 폰으로 대상을 고릅니다.' : mode === 'each' ? '다른 사람 역할은 볼 수 없어요. 한 명씩 눈을 뜨고 찍습니다.' : '한 번에 찍고 이름을 고릅니다. 다른 사람 이름을 누르면 역할이 보여요.'}</p>
              ${M && !M.over ? '<button class="btn gold" data-a="resume">▶ 진행 중이던 게임 이어서</button>' : ''}
              <button class="btn big primary" data-a="create">🎲 역할 배정하기</button>
            </div>
          </div>
        </div>`;
      $('#names').addEventListener('input', (e) => { txt = e.target.value; $('#sum').textContent = summary().text; });
    }
    actions = {
      m: (v) => { const { n, mm } = summary(); m = Math.max(1, Math.min(Math.max(1, Math.ceil(n / 2) - 1), mm + Number(v))); draw(); },
      p: () => { p = p ? 0 : 1; draw(); },
      d: () => { d = d ? 0 : 1; draw(); },
      reveal: () => { reveal = !reveal; draw(); },
      mode: (v) => { mode = v; S.mafiaMode = v; save(); draw(); },
      tts: () => { S.tts = !S.tts; save(); draw(); if (S.tts) say('음성 안내를 켰습니다.'); },
      resume: () => (M.phase === 'night' ? night() : M.phase === 'day' ? day() : join()),
      create: () => {
        const names = parseNames(txt), { n, mm } = summary();
        if (n < 4) { toast('4명 이상 입력해 주세요'); return; }
        if (mm >= n - mm) { toast('마피아가 너무 많아요'); return; }
        if (n - mm - p - d < 0) { toast('인원보다 역할이 많아요'); return; }
        if (mode === 'server' && !SRV) { toast('서버에 연결되지 않았어요. node server.js 로 열어 주세요'); return; }
        M = { g: { c: newCode(), n: names, m: mm, p, d }, alive: names.map(() => true), day: 1, reveal, mode, ji: 0, over: null, phase: 'join', ht: M && M.ht };
        S.players = names; persist(); sfx.ok(); join();
      },
    };
    const mine = actions;
    draw();
    // 서버 확인이 늦게 끝나면 [📡 노트북 서버] 버튼을 붙여 다시 그림
    if (!SRV) srvReady.then(() => {
      if (!SRV || actions !== mine) return;
      if (!(M && M.mode) && !S.mafiaMode) mode = 'server';
      draw();
    });
  }

  // ── 역할 확인 (QR) ──
  const qrSvg = (url) => {
    try { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) { return ''; }
  };
  const copyText = async (url, msg) => {
    try { await navigator.clipboard.writeText(url); toast(msg); }
    catch (e) { prompt('아래 링크를 복사하세요', url); }
  };
  const personalUrl = (k) => new URL('player.html?p=' + encodeGame(personalGame(M.g, k)), location.href).href;

  function join() {
    if (M.mode === 'server') { joinServer(false); return; }
    if (M.mode !== 'all') { joinEach(); return; }
    stopT(); M.phase = 'join'; persist();
    const url = new URL('player.html?g=' + encodeGame(M.g), location.href).href;
    const qr = qrSvg(url);
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🕵️ 역할 확인</h2><span class="pill">게임 코드 ${M.g.c}</span></div>
        <div class="stage-wrap">
          <div class="stage">${qr ? `<div class="qr">${qr}</div>` : `<div class="sub" style="word-break:break-all">${esc(url)}</div>`}</div>
          <div class="controls">
            <p class="notice" style="margin:0;text-align:center">📱 각자 폰으로 QR을 찍고<br>자기 이름을 누르세요</p>
            <p class="sub" style="margin:0;text-align:center;color:var(--muted)">역할은 화면을 꾹 누르는 동안만 보여요.<br>마피아는 동료 마피아도 함께 보입니다.</p>
            <button class="btn" data-a="copy">🔗 링크 복사 (단톡방 공유)</button>
            <button class="btn big primary" data-a="start">🌙 모두 확인했어요 → 밤 시작</button>
            <button class="btn" data-a="back">✏️ 준비 화면으로</button>
          </div>
        </div>
      </div>`;
    actions = {
      copy: () => copyText(url, '링크를 복사했어요. 단톡방에 붙여 넣으세요'),
      start: () => night(),
      back: () => setup(),
    };
  }

  // 한 명씩 개인 QR: 나머지는 눈을 감고, 차례인 사람만 자기 QR을 찍습니다.
  // 개인 링크에는 그 사람의 역할만 들어 있어 다른 사람 역할은 알 수 없습니다.
  function joinEach() {
    // 음성은 끊지 않음: 앞사람 "눈을 감으세요" 뒤에 다음 사람 안내가 이어서 나오도록
    stopT(); M.phase = 'join'; persist();
    const n = M.g.n.length, i = Math.max(0, Math.min(n, M.ji || 0));
    const go = (v) => { hush(); M.ji = v; persist(); joinEach(); };
    const chips = M.g.n.map((nm, k) => `<button class="nbtn" data-a="copyk" data-v="${k}">🔗 ${esc(nm)}</button>`).join('');

    if (i >= n) {
      say('모두 눈을 뜨세요.');
      main.innerHTML = `
        <div class="screen">
          <div class="head"><h2>🔒 역할 확인 완료</h2><span class="pill">게임 코드 ${M.g.c}</span></div>
          <p class="notice" style="margin:0;text-align:center">👀 모두 눈을 뜨세요<br>${n}명 모두 QR을 찍었나요?</p>
          <p class="sub" style="margin:0;text-align:center;color:var(--muted)">QR을 못 찍은 사람은 이름을 눌러 개인 링크를 복사한 뒤<br><b>그 사람에게만 1:1 톡</b>으로 보내 주세요. (단톡방 ❌)</p>
          <div class="ngrid">${chips}</div>
          <button class="btn big primary" data-a="start">🌙 밤 시작</button>
          <div class="row"><button class="btn" data-a="redo">🔁 처음 사람부터 다시</button><button class="btn" data-a="back">✏️ 준비 화면으로</button></div>
        </div>`;
    } else {
      const nm = M.g.n[i], qr = qrSvg(personalUrl(i));
      say((i === 0 ? '모두 눈을 감으세요. ' : '') + `${nm} 님만 눈을 뜨고, QR을 찍으세요.`);
      main.innerHTML = `
        <div class="screen">
          <div class="head"><h2>🔒 역할 확인 ${i + 1} / ${n}</h2><span class="pill">게임 코드 ${M.g.c}</span></div>
          <div class="stage-wrap">
            <div class="stage">${qr ? `<div class="qr">${qr}</div>` : '<div class="sub">QR을 만들 수 없어요. 아래 [개인 링크 복사]를 써 주세요.</div>'}</div>
            <div class="controls">
              <div class="result-big" style="text-align:center">📱 ${esc(nm)} 님 차례</div>
              <p class="notice" style="margin:0;text-align:center">😌 다른 사람은 눈을 감아 주세요</p>
              <p class="sub" style="margin:0;text-align:center;color:var(--muted)">QR을 찍으면 바로 내 역할이 나와요.<br>꾹 누르는 동안만 보입니다.</p>
              <button class="btn big primary" data-a="next">${i + 1 < n ? '✅ 찍었어요 → 다음 사람' : '✅ 찍었어요 → 확인 끝'}</button>
              <div class="row"><button class="btn" data-a="prev" ${i === 0 ? 'disabled' : ''}>◀ 이전 사람</button><button class="btn" data-a="again">🔊 다시 안내</button></div>
              <button class="btn" data-a="copyk" data-v="${i}">🔗 ${esc(nm)} 님 개인 링크 복사 (1:1 톡)</button>
              <button class="btn" data-a="back">✏️ 준비 화면으로</button>
            </div>
          </div>
        </div>`;
    }
    actions = {
      next: () => { sfx.ok(); hush(); say(`${M.g.n[i]} 님, 눈을 감으세요.`); M.ji = i + 1; persist(); joinEach(); },
      prev: () => go(i - 1),
      again: () => { hush(); say(`${M.g.n[i]} 님만 눈을 뜨고, QR을 찍으세요.`); },
      copyk: (v) => copyText(personalUrl(Number(v)), `${M.g.n[Number(v)]} 님 개인 링크를 복사했어요. 그 사람에게만 1:1로 보내 주세요`),
      redo: () => go(0),
      start: () => night(),
      back: () => setup(),
    };
  }

  // 노트북 서버 모드: QR 하나로 접속, 이름은 먼저 고른 사람이 잠급니다.
  // mid = true 면 게임 도중 [📱 접속 관리]로 들어온 것 (끝나면 낮으로 돌아감)
  async function joinServer(mid) {
    stopT(); closeES();
    if (!mid) { M.phase = 'join'; S.mafia = M; save(); }
    main.innerHTML = '<div class="screen"><div class="stage"><div class="sub">📡 서버에 연결하는 중…</div></div></div>';
    await srvReady;
    try { await register(); } catch (e) {
      main.innerHTML = `
        <div class="screen"><div class="stage">
          <div class="result-big">😵 서버에 연결할 수 없어요</div>
          <p class="sub" style="text-align:center;color:var(--muted)">노트북에서 <b>node server.js</b> 가 켜져 있는지 확인해 주세요.</p>
          <div class="row"><button class="btn primary" data-a="retry">🔁 다시 연결</button><button class="btn" data-a="back">✏️ 준비 화면으로</button></div>
        </div></div>`;
      actions = { retry: () => joinServer(mid), back: () => setup() };
      return;
    }
    // 노트북에서 localhost로 열었어도 QR에는 폰이 들어올 수 있는 주소(LAN IP)를 넣음
    const ips = (SRV && SRV.ips) || [], local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
    const ipi = Math.min(M.ipi || 0, Math.max(0, ips.length - 1));
    const origin = local && ips.length ? `http://${ips[ipi]}:${location.port || 80}` : location.origin;
    const url = `${origin}/player.html?s=${M.g.c}`;
    let st = { claimed: M.g.n.map(() => false), online: M.g.n.map(() => false) };
    const who = () => M.g.n.map((nm, k) => {
      const tag = st.online[k] ? '✅' : st.claimed[k] ? '🟡' : '⬜';
      return `<button class="nbtn ${st.claimed[k] ? '' : 'dead'}" ${st.claimed[k] ? `data-a="release" data-v="${k}"` : ''} style="${st.claimed[k] ? '' : 'text-decoration:none'}">${tag} ${esc(nm)}</button>`;
    }).join('');
    const count = () => `${st.claimed.filter(Boolean).length} / ${M.g.n.length}명 접속`;
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>📡 ${mid ? '접속 관리' : '역할 확인'}</h2><span class="pill" id="cnt">${count()}</span></div>
        <div class="stage-wrap">
          <div class="stage" style="gap:8px">
            ${qrBlock(url, '62%')}
            <div class="ngrid" id="who">${who()}</div>
          </div>
          <div class="controls">
            <p class="notice" style="margin:0;text-align:center">${joinHint('자기 이름을 누르세요')}</p>
            <p class="sub" style="margin:0;text-align:center;color:var(--muted)">✅ 접속 중 · 🟡 화면 꺼짐 · ⬜ 아직<br>이름을 잘못 골랐으면 그 이름을 눌러 풀어 주세요.</p>
            ${ips.length > 1 && local ? '<button class="btn" data-a="ip">🌐 다른 주소로 바꾸기 (폰이 안 들어올 때)</button>' : ''}
            ${mid ? '<button class="btn big primary" data-a="back">↩ 낮으로 돌아가기</button>'
                  : `<button class="btn big primary" data-a="start">🌙 모두 확인했어요 → 밤 시작</button>
                     <button class="btn" data-a="setup">✏️ 준비 화면으로</button>`}
          </div>
        </div>
      </div>`;
    listen((v) => {
      if (v.t !== 'host') return;
      st = v; const w = $('#who'), c = $('#cnt');
      if (w) w.innerHTML = who();
      if (c) c.textContent = count();
    });
    actions = {
      release: (v) => {
        const k = Number(v);
        if (confirm(`${M.g.n[k]} 님의 이름 잠금을 풀까요?\n(그 폰은 접속이 끊기고, 이름을 다시 고를 수 있게 됩니다)`)) hostPost('release', { k }).catch(() => toast('서버에 연결할 수 없어요'));
      },
      ip: () => { M.ipi = (ipi + 1) % ips.length; S.mafia = M; save(); joinServer(mid); },
      start: () => {
        const left = st.claimed.filter((x) => !x).length;
        if (left && !confirm(`아직 ${left}명이 접속하지 않았어요. 그래도 밤을 시작할까요?`)) return;
        closeES(); night();
      },
      back: () => { closeES(); day(); },
      setup: () => { closeES(); setup(); },
    };
  }

  // ── 밤 ──
  function night() {
    if (M.mode === 'server') nightServer(); else nightManual();
  }

  // 서버 모드의 밤: 생존자 전원이 동시에 폰으로 고릅니다 (시민도 '의심 가는 사람'을 골라서
  // 누가 폰을 두드리는지로 역할이 드러나지 않음). 진행 화면에는 '몇 명 끝났는지'만 나옵니다.
  async function nightServer() {
    stopT(); hush(); closeES();
    M.phase = 'night'; S.mafia = M; save();
    let prog = { done: 0, total: aliveIdx().length }, told = false, busy = false;
    const LINE = '밤이 되었습니다. 모두 고개를 숙이고, 다른 사람에게 보이지 않게 폰을 확인해 주세요. 마피아, 의사, 경찰은 대상을 고르고, 시민은 마피아로 의심되는 사람을 한 명 골라 주세요.';
    function draw() {
      const all = prog.total > 0 && prog.done >= prog.total;
      main.innerHTML = `
        <div class="screen night">
          <div class="head"><h2>🌙 밤 ${M.day}</h2><span class="sub">각자 폰에서 고르는 중</span></div>
          <div class="stage">
            <p class="notice" style="margin:0;text-align:center">🤫 고개를 숙이고 폰 화면을 가려 주세요</p>
            <div class="bomb">🌙</div>
            <div class="result-big">${prog.done} / ${prog.total}명 선택 완료</div>
            <p class="sub" style="margin:0;text-align:center;color:var(--muted)">${all ? '모두 골랐어요!' : '마피아는 동료와 같은 사람을 골라야 완료됩니다.'}</p>
            <button class="btn big ${all ? 'gold' : 'primary'}" data-a="morning" ${all ? '' : 'disabled'}>☀️ 아침으로</button>
            <div class="row">
              <button class="btn" data-a="force">⏩ 기다리지 않고 진행</button>
              <button class="btn" data-a="again">🔊 다시 안내</button>
              <button class="btn" data-a="manual">✋ 손짓 방식으로</button>
            </div>
          </div>
        </div>`;
    }
    async function toMorning() {
      if (busy) return; busy = true;
      try {
        const r = await hostPost('resolve');
        closeES(); morning(r.kill, r.saved);
      } catch (e) { busy = false; toast('서버에 연결할 수 없어요. 다시 눌러 주세요'); }
    }
    actions = {
      morning: () => toMorning(),
      force: () => { if (confirm('아직 고르지 않은 사람이 있어요. 그대로 아침으로 넘어갈까요?\n(마피아끼리 고른 사람이 다르면 아무도 당하지 않습니다)')) toMorning(); },
      again: () => { hush(); say(LINE); },
      manual: () => { if (confirm('폰 선택을 그만두고, 손짓 + 사회자 입력 방식으로 이번 밤을 진행할까요?')) { closeES(); nightManual(); } },
    };
    draw();
    say(LINE);
    try { await register(); } catch (e) { toast('서버에 연결할 수 없어요. [✋ 손짓 방식으로]를 눌러 진행할 수 있어요', 4000); }
    listen((v) => {
      if (v.t !== 'host' || v.phase !== 'night' || !v.night) return;
      prog = v.night; draw();
      if (prog.total > 0 && prog.done >= prog.total && !told) { told = true; sfx.ok(); say('모두 선택을 마쳤습니다. 아침으로 넘어가 주세요.'); }
    });
  }

  // 손짓 + 사회자 입력 방식의 밤 (서버 없이)
  function nightManual() {
    stopT(); hush(); M.phase = 'night'; persist();
    const steps = ['intro', 'mafia']; if (M.g.d) steps.push('doctor'); if (M.g.p) steps.push('police');
    const LINES = {
      intro: ['🌙 밤 ' + M.day, '밤이 되었습니다. 모두 고개를 숙이고 눈을 감아 주세요.'],
      mafia: ['🔪 마피아 차례', '마피아는 눈을 뜨고, 제거할 사람을 함께 지목해 주세요.'],
      doctor: ['💉 의사 차례', '의사는 눈을 뜨고, 살리고 싶은 사람을 지목해 주세요.'],
      police: ['🚓 경찰 차례', '경찰은 눈을 뜨고, 조사할 사람을 지목해 주세요.'],
    };
    const CLOSE = { mafia: '마피아는 눈을 감아 주세요.', doctor: '의사는 눈을 감아 주세요.', police: '경찰은 눈을 감아 주세요.' };
    let si = 0, sel = null, kill = null, saved = null, result = null;

    function draw() {
      const st = steps[si], [title, line] = LINES[st];
      const label = st === 'intro' ? '다음 ▶' : st === 'police' && result === null ? '🔍 조사하기' : '확정 ▶';
      const body = st === 'intro' ? '<div class="bomb">🌙</div>'
        : result !== null ? `<div class="answer pop">${result ? '👍 마피아입니다' : '👎 마피아가 아닙니다'}</div>`
          : pickGrid(sel);
      main.innerHTML = `
        <div class="screen night">
          <div class="head"><h2>${title}</h2><span class="sub">사회자만 화면을 보세요</span></div>
          <div class="stage">
            <p class="notice" style="margin:0">${esc(line)}</p>
            ${body}
            <div class="row">
              ${st !== 'intro' && st !== 'mafia' && result === null ? '<button class="btn" data-a="skip">아무도 안 뜸 · 넘어가기</button>' : ''}
              <button class="btn big primary" data-a="ok" ${st !== 'intro' && result === null && sel === null ? 'disabled' : ''}>${label}</button>
            </div>
          </div>
        </div>`;
    }
    const next = () => {
      si++; sel = null; result = null;
      if (si >= steps.length) return morning(kill, saved);
      say(LINES[steps[si]][1]); draw();
    };
    actions = {
      sel: (v) => { sel = Number(v); sfx.tick(); draw(); },
      ok: () => {
        const st = steps[si];
        if (st === 'intro') return next();
        if (st === 'police' && result === null) { result = roles()[sel] === 'mafia'; sfx.beep(); return draw(); }
        if (st === 'mafia') kill = sel;
        if (st === 'doctor') saved = sel;
        say(CLOSE[st]); next();
      },
      skip: () => { say(CLOSE[steps[si]]); next(); },
    };
    say(LINES.intro[1]); draw();
  }

  // ── 아침 ──
  function morning(kill, saved) {
    const died = kill !== null && kill !== saved ? kill : null;
    if (died !== null) M.alive[died] = false;
    const msg = kill === null ? '조용한 밤이었습니다. 아무 일도 일어나지 않았습니다.'
      : died === null ? `마피아가 ${M.g.n[kill]} 님을 노렸지만, 의사가 살려 냈습니다!`
        : `어젯밤 ${M.g.n[died]} 님이 마피아에게 당했습니다.`;
    M.phase = 'day'; persist();
    say('아침이 되었습니다. 모두 눈을 떠 주세요. ' + msg);
    died !== null ? sfx.boom() : sfx.fanfare();
    const win = checkWin();
    main.innerHTML = `
      <div class="screen">
        <div class="stage">
          <div class="qno">☀️ 아침 ${M.day}</div>
          <div class="answer pop">${esc(msg)}</div>
          ${died !== null && M.reveal ? `<div class="pill">${roleTag(died)}</div>` : ''}
          <button class="btn big ${win ? 'gold' : 'primary'}" data-a="go">${win ? '🏁 결과 보기' : '☀️ 낮 토론 시작'}</button>
        </div>
      </div>`;
    actions = { go: () => (win ? end(win) : day()) };
  }

  // ── 낮 토론 ──
  function day() {
    stopT(); M.phase = 'day'; persist();
    let left = M.talk || 180, edit = false;
    const tick = (s) => { left = s; const t = $('#tm'); if (t) { t.textContent = fmt(s); t.classList.toggle('warn', s <= 10); } if (s <= 5 && s > 0) sfx.tick(); };
    const run = () => { stopT(); stopTimer = countdown(left, tick, () => { stopTimer = null; sfx.boom(); say('토론 시간이 끝났습니다. 투표를 준비해 주세요.'); }); };
    function draw() {
      main.innerHTML = `
        <div class="screen">
          <div class="head"><h2>☀️ 낮 ${M.day} · 토론</h2><span class="pill">생존 ${aliveIdx().length}명</span></div>
          <div class="stage-wrap">
            <div class="stage">
              <div class="timer" id="tm">${fmt(left)}</div>
              <div class="ngrid">${M.g.n.map((nm, k) => `<button class="nbtn ${M.alive[k] ? '' : 'dead'}" ${edit ? `data-a="flip" data-v="${k}"` : ''}>${esc(nm)}</button>`).join('')}</div>
              ${edit ? '<p class="notice" style="margin:0">이름을 누르면 생존/탈락이 바뀝니다</p>' : ''}
            </div>
            <div class="controls">
              <div class="row"><button class="btn primary" data-a="talk">▶ 토론 시작</button><button class="btn" data-a="plus">+30초</button></div>
              <button class="btn big gold" data-a="vote">🗳 투표하기</button>
              <button class="btn" data-a="edit">${edit ? '✅ 수정 완료' : '✏️ 생존자 수정'}</button>
              ${M.mode === 'server' ? '<button class="btn" data-a="conn">📱 접속 관리</button>' : ''}
              <button class="btn" data-a="quit">🏁 게임 끝내기</button>
            </div>
          </div>
        </div>`;
    }
    actions = {
      talk: () => { say('토론을 시작합니다.'); run(); },
      plus: () => { left += 30; tick(left); if (stopTimer) run(); },
      vote: () => vote(),
      edit: () => {
        edit = !edit; persist();
        if (!edit) { const w = checkWin(); if (w) return end(w); }
        draw();
      },
      flip: (v) => { M.alive[Number(v)] = !M.alive[Number(v)]; persist(); draw(); },
      conn: () => joinServer(true),
      quit: () => { if (confirm('게임을 끝내고 정체를 공개할까요?')) end(checkWin()); },
    };
    draw();
  }

  // ── 투표 ──
  function vote() {
    stopT(); hush();
    let sel = null;
    say('투표를 시작합니다. 셋, 둘, 하나에 맞춰 마피아라고 생각하는 사람을 동시에 가리켜 주세요. 셋. 둘. 하나. 지목!');
    function draw() {
      main.innerHTML = `
        <div class="screen">
          <div class="head"><h2>🗳 투표</h2><span class="sub">가장 많이 지목된 사람을 누르세요</span></div>
          <div class="stage-wrap">
            <div class="stage">
              <div class="timer" id="tm"></div>
              ${pickGrid(sel)}
            </div>
            <div class="controls">
              <button class="btn" data-a="defense" ${sel === null ? 'disabled' : ''}>⚖️ 최후의 변론 30초</button>
              <button class="btn big bad" data-a="exec" ${sel === null ? 'disabled' : ''}>☠️ 처형</button>
              <button class="btn" data-a="none">🤝 동점·부결 (처형 없음)</button>
              <button class="btn" data-a="back">↩ 토론으로</button>
            </div>
          </div>
        </div>`;
    }
    actions = {
      sel: (v) => { sel = Number(v); sfx.tick(); draw(); },
      defense: () => {
        say(`${M.g.n[sel]} 님, 최후의 변론을 해 주세요.`);
        stopT(); stopTimer = countdown(30, (s) => { const t = $('#tm'); if (t) { t.textContent = fmt(s); t.classList.toggle('warn', s <= 5); } }, () => { stopTimer = null; sfx.boom(); });
      },
      exec: () => execute(sel),
      none: () => { say('이번 투표에서는 아무도 처형되지 않았습니다.'); M.day++; persist(); night(); },
      back: () => day(),
    };
    draw();
  }

  function execute(k) {
    stopT(); hush();
    M.alive[k] = false; persist();
    const msg = `${M.g.n[k]} 님이 처형되었습니다.`;
    say(msg + (M.reveal ? ` ${M.g.n[k]} 님은 ${ROLES[roles()[k]].n}였습니다.` : ''));
    sfx.boom(); flash('var(--bad)');
    const win = checkWin();
    main.innerHTML = `
      <div class="screen">
        <div class="stage">
          <div class="answer pop">☠️ ${esc(msg)}</div>
          ${M.reveal ? `<div class="pill">${roleTag(k)}</div>` : ''}
          <button class="btn big ${win ? 'gold' : 'primary'}" data-a="go">${win ? '🏁 결과 보기' : '🌙 밤으로'}</button>
        </div>
      </div>`;
    actions = { go: () => { if (win) return end(win); M.day++; persist(); night(); } };
  }

  // ── 결과 ──
  function end(win) {
    stopT(); hush();
    M.over = win || 'none'; M.phase = 'over'; persist();
    const r = roles();
    const title = win === 'mafia' ? '🔪 마피아 승리!' : win === 'citizen' ? '🎉 시민 승리!' : '🏁 게임 종료';
    say(win === 'mafia' ? '마피아가 승리했습니다!' : win === 'citizen' ? '마피아를 모두 찾아냈습니다. 시민 팀의 승리입니다!' : '게임을 종료합니다.');
    sfx.fanfare(); flash(win === 'mafia' ? 'var(--bad)' : 'var(--gold)');
    main.innerHTML = `
      <div class="screen">
        <div class="stage" style="overflow:auto">
          <div class="result-big pop">${title}</div>
          <div class="ngrid">${M.g.n.map((nm, k) => `<div class="nbtn ${M.alive[k] ? '' : 'dead'} ${r[k] === 'mafia' ? 'mafia' : ''}">${esc(nm)}<small>${ROLES[r[k]].ic} ${ROLES[r[k]].n}</small></div>`).join('')}</div>
          <div class="row">
            <button class="btn big primary" data-a="again">🔁 같은 명단으로 새 게임</button>
            <button class="btn" data-a="setup">✏️ 명단·설정 바꾸기</button>
          </div>
        </div>
      </div>`;
    actions = {
      again: () => { M = { ...M, g: { ...M.g, c: newCode() }, alive: M.g.n.map(() => true), day: 1, over: null }; persist(); join(); },
      setup: () => setup(),
    };
  }

  setup();
};

// ── 🤥 라이어 게임 ──
// 제시어·라이어는 TV에 띄우지 않고 각자 폰(player.html)에서 확인합니다. 라운드 번호로 진행 폰과 맞춥니다.
screens.liar = () => {
  if (S.tts === undefined) S.tts = true;
  const parseNames = (txt) => [...new Set(txt.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
  const newCode = () => String(1000 + Math.random() * 9000 | 0);
  const fmt = (s) => `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`;
  const say = (t) => {
    if (!S.tts || !window.speechSynthesis) return;
    try { const u = new SpeechSynthesisUtterance(t); u.lang = 'ko-KR'; u.rate = 0.95; speechSynthesis.speak(u); } catch (e) { /* 미지원 */ }
  };
  const hush = () => { try { speechSynthesis.cancel(); } catch (e) { /* 미지원 */ } };
  onCleanup(hush);

  let L = S.liar || null, stopTimer = null;
  const srv = () => L && L.mode === 'server';
  const persist = () => { S.liar = L; save(); if (srv() && L.ht) sync(); };
  // ── 노트북 서버 모드: 이름 잠금 + 라운드가 바뀌면 폰의 제시어가 자동으로 바뀜 ──
  async function register() {
    const j = await NET.post('/api/l/new', { g: L.g, ht: L.ht });
    L.ht = j.ht; S.liar = L; save();
    await sync();
  }
  function sync() {
    return NET.post('/api/l/sync', { c: L.g.c, ht: L.ht, r: L.r, phase: L.phase })
      .catch((e) => (e && e.error === 'nogame' ? register().catch(() => null) : null)); // 서버를 다시 켰으면 재등록
  }
  const stopT = () => { if (stopTimer) { stopTimer(); stopTimer = null; } };
  onCleanup(stopT);
  const score = () => { const w = (L.log || []).filter((x) => x === 'liar').length; return `시민 ${(L.log || []).length - w}승 · 라이어 ${w}승`; };

  // ── 준비 ──
  function setup() {
    stopT();
    let txt = ((L && L.g.n) || S.players || []).join('\n');
    let k = L ? L.g.k : 1, mode = L ? L.g.mode : 'normal', cat = L ? L.g.cat : '';
    let how = (L && L.mode) || (NET.info ? 'server' : 'qr');
    function draw() {
      const n = parseNames(txt).length;
      main.innerHTML = `
        <div class="screen">
          <div class="head"><h2>🤥 라이어 게임 · 준비</h2><span class="sub">사회자는 명단에서 빼 주세요</span></div>
          <div class="stage-wrap">
            <div class="stage" style="align-items:stretch;gap:8px">
              <textarea id="names" class="names" placeholder="참가자 이름 (한 줄에 한 명)">${esc(txt)}</textarea>
              <div class="chips">${['', ...Object.keys(LIAR_WORDS)].map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-a="cat" data-v="${esc(c)}">${c || '🎲 라운드마다 랜덤'}</button>`).join('')}</div>
            </div>
            <div class="controls">
              <div class="pill" id="sum" style="text-align:center">${n}명 · 라이어 ${k}명</div>
              <div class="row"><button class="btn ${k === 1 ? 'on' : ''}" data-a="k" data-v="1">라이어 1명</button><button class="btn ${k === 2 ? 'on' : ''}" data-a="k" data-v="2">라이어 2명</button></div>
              <div class="row"><button class="btn ${mode === 'normal' ? 'on' : ''}" data-a="mode" data-v="normal">일반 모드</button><button class="btn ${mode === 'fool' ? 'on' : ''}" data-a="mode" data-v="fool">바보 모드</button></div>
              <p class="sub" style="margin:0;text-align:center;color:var(--muted)">${mode === 'fool' ? '바보 모드: 라이어는 다른 제시어를 받고, 자기가 라이어인 줄 모릅니다' : '일반 모드: 라이어는 카테고리만 알고 제시어를 모릅니다'}</p>
              ${NET.info ? `<div class="row"><button class="btn ${how === 'server' ? 'on' : ''}" data-a="how" data-v="server">📡 노트북 서버</button><button class="btn ${how === 'qr' ? 'on' : ''}" data-a="how" data-v="qr">📱 QR만 (서버 없이)</button></div>
              <p class="sub" style="margin:0;text-align:center;color:var(--muted)">${how === 'server' ? '이름은 먼저 고른 사람만. 라운드가 바뀌면 폰의 제시어가 자동으로 바뀝니다.' : '폰에서 직접 [다음 ▶]으로 라운드를 맞춥니다.'}</p>` : ''}
              <button class="btn ${S.tts ? 'on' : ''}" data-a="tts">🔊 음성 ${S.tts ? 'ON' : 'OFF'}</button>
              ${L && L.phase !== 'over' ? `<button class="btn gold" data-a="resume">▶ 이어서 하기 (라운드 ${L.r})</button>` : ''}
              <button class="btn big primary" data-a="create">🎲 게임 만들기</button>
            </div>
          </div>
        </div>`;
      $('#names').addEventListener('input', (e) => { txt = e.target.value; $('#sum').textContent = `${parseNames(txt).length}명 · 라이어 ${k}명`; });
    }
    actions = {
      k: (v) => { k = Number(v); draw(); },
      mode: (v) => { mode = v; draw(); },
      cat: (v) => { cat = v; draw(); },
      how: (v) => { how = v; draw(); },
      tts: () => { S.tts = !S.tts; save(); draw(); if (S.tts) say('음성 안내를 켰습니다.'); },
      resume: () => (L.phase === 'join' ? join() : round()),
      create: () => {
        const names = parseNames(txt);
        if (names.length < 3) { toast('3명 이상 입력해 주세요'); return; }
        if (k === 2 && names.length < 6) { toast('라이어 2명은 6명 이상일 때 가능해요'); return; }
        if (how === 'server' && !NET.info) { toast('서버에 연결되지 않았어요. node server.js 로 열어 주세요'); return; }
        L = { g: { t: 'liar', c: newCode(), n: names, k, mode, cat }, r: 1, log: [], phase: 'join', mode: NET.info ? how : 'qr', ht: L && L.ht };
        S.players = names; persist(); sfx.ok(); join();
      },
    };
    const mine = actions;
    draw();
    // 서버 확인이 늦게 끝나면 [📡 노트북 서버] 버튼을 붙여 다시 그림
    if (!NET.info) NET.ready.then(() => { if (NET.info && actions === mine) { if (!(L && L.mode)) how = 'server'; draw(); } });
  }

  // 서버 모드 접속 화면 (mid = 게임 도중 [📱 접속 관리]로 들어옴)
  function joinServer(mid) {
    stopT();
    if (!mid) { L.phase = 'join'; S.liar = L; save(); }
    rosterJoinScreen({
      kind: 'l', code: L.g.c, names: L.g.n, ht: () => L.ht, title: mid ? '접속 관리' : '접속하기', mid,
      register, onStart: () => round(), onBack: () => round(), onSetup: () => setup(),
    });
  }

  // ── 접속 (QR) ──
  function join() {
    if (srv()) return joinServer(false);
    stopT(); L.phase = 'join'; persist();
    const url = new URL('player.html?g=' + encodeGame(L.g), location.href).href;
    let qr = '';
    try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) { qr = ''; }
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🤥 접속하기</h2><span class="pill">게임 코드 ${L.g.c}</span></div>
        <div class="stage-wrap">
          <div class="stage">${qr ? `<div class="qr">${qr}</div>` : `<div class="sub" style="word-break:break-all">${esc(url)}</div>`}</div>
          <div class="controls">
            <p class="notice" style="margin:0;text-align:center">📱 각자 폰으로 QR을 찍고<br>자기 이름을 누르세요</p>
            <p class="sub" style="margin:0;text-align:center;color:var(--muted)">한 번만 접속하면 돼요. 라운드가 바뀌면<br>폰에서 [다음 ▶]만 누르면 됩니다.</p>
            <button class="btn" data-a="copy">🔗 링크 복사 (단톡방 공유)</button>
            <button class="btn big primary" data-a="start">▶ 라운드 ${L.r} 시작</button>
            <button class="btn" data-a="back">✏️ 준비 화면으로</button>
          </div>
        </div>
      </div>`;
    actions = {
      copy: async () => {
        try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요. 단톡방에 붙여 넣으세요'); }
        catch (e) { prompt('아래 링크를 복사하세요', url); }
      },
      start: () => round(),
      back: () => setup(),
    };
  }

  // ── 라운드: 설명 → 토론 ──
  function round() {
    stopT(); hush(); L.phase = 'round'; persist();
    const R = liarRound(L.g, L.r), n = L.g.n.length;
    const order = Array.from({ length: n }, (_, i) => (R.first + i) % n);
    let left = 120;
    say(`라운드 ${L.r}. 카테고리는 ${R.cat}입니다. ${srv() ? '폰에 나온 제시어를 확인해 주세요.' : '폰에서 라운드 번호를 확인하고 제시어를 확인해 주세요.'} ${L.g.n[R.first]} 님부터 시계 방향으로 한 마디씩 설명해 주세요.`);
    const tick = (s) => { left = s; const t = $('#tm'); if (t) { t.textContent = fmt(s); t.classList.toggle('warn', s <= 10); } if (s <= 5 && s > 0) sfx.tick(); };
    const run = () => { stopT(); stopTimer = countdown(left, tick, () => { stopTimer = null; sfx.boom(); say('토론 시간이 끝났습니다. 투표를 시작합니다.'); }); };
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🤥 라운드 ${L.r}</h2><span class="pill">${score()}</span></div>
        <div class="stage-wrap">
          <div class="stage" style="gap:6px;overflow:auto;justify-content:safe center">
            <div class="row"><span class="pill">카테고리</span><span class="category pop" style="font-size:clamp(24px,6vmin,48px)">${esc(R.cat)}</span><span class="timer" id="tm" style="font-size:clamp(22px,6vmin,48px)">${fmt(left)}</span></div>
            <p class="notice" style="margin:0">${srv() ? '📱 폰의 카드를 꾹 눌러 제시어 확인' : `📱 폰에서 라운드 ${L.r} 확인 → 카드를 꾹 눌러 제시어 확인`}</p>
            <div class="ngrid">${order.map((k, i) => `<div class="nbtn">${esc(L.g.n[k])}<small>${i + 1}번째</small></div>`).join('')}</div>
          </div>
          <div class="controls">
            <div class="row"><button class="btn primary" data-a="talk">▶ 토론 2분</button><button class="btn" data-a="plus">+30초</button></div>
            <button class="btn big gold" data-a="vote">🗳 투표하기</button>
            <button class="btn" data-a="skip">⏭ 이 라운드 건너뛰기</button>
            ${srv() ? '<button class="btn" data-a="conn">📱 접속 관리</button>' : ''}
            <button class="btn" data-a="quit">🏁 게임 끝내기</button>
          </div>
        </div>
      </div>`;
    actions = {
      talk: () => { say('자유 토론을 시작합니다.'); run(); },
      plus: () => { left += 30; tick(left); if (stopTimer) run(); },
      vote: () => vote(R),
      skip: () => { if (confirm('이 라운드를 건너뛸까요? (결과 기록 없이 다음 라운드로)')) nextRound(); },
      conn: () => joinServer(true),
      quit: () => { if (confirm('라이어 게임을 끝낼까요?')) { L.phase = 'over'; persist(); go('home'); } },
    };
  }

  // ── 투표 ──
  function vote(R) {
    stopT(); hush();
    let sel = null;
    say('셋, 둘, 하나에 맞춰 라이어라고 생각하는 사람을 동시에 가리켜 주세요. 셋. 둘. 하나. 지목!');
    function draw() {
      main.innerHTML = `
        <div class="screen">
          <div class="head"><h2>🗳 라이어는 누구?</h2><span class="sub">가장 많이 지목된 사람을 누르세요</span></div>
          <div class="stage-wrap">
            <div class="stage">
              <div class="ngrid">${L.g.n.map((nm, k) => `<button class="nbtn ${sel === k ? 'on' : ''}" data-a="sel" data-v="${k}">${esc(nm)}</button>`).join('')}</div>
            </div>
            <div class="controls">
              <button class="btn big bad" data-a="ok" ${sel === null ? 'disabled' : ''}>👉 지목 확정</button>
              <button class="btn" data-a="back">↩ 토론으로</button>
            </div>
          </div>
        </div>`;
    }
    actions = {
      sel: (v) => { sel = Number(v); sfx.tick(); draw(); },
      ok: () => verdict(R, sel),
      back: () => round(),
    };
    draw();
  }

  // ── 판정 ──
  function verdict(R, sel) {
    hush();
    const caught = R.liars.includes(sel), nm = L.g.n[sel];
    if (!caught) return result(R, true, `${nm} 님은 라이어가 아니었습니다!`);
    sfx.ok(); flash('var(--gold)');
    if (L.g.mode === 'fool') return result(R, false, `${nm} 님이 라이어였습니다!`);
    say(`${nm} 님, 라이어가 맞습니다! 하지만 아직 끝나지 않았습니다. 라이어는 제시어를 맞혀 주세요. 맞히면 라이어의 승리입니다.`);
    main.innerHTML = `
      <div class="screen">
        <div class="stage">
          <div class="result-big pop">🎯 ${esc(nm)} 님이 라이어!</div>
          <p class="notice" style="margin:0">마지막 기회! 라이어가 제시어를 말해 보세요</p>
          <div class="pill">카테고리: ${esc(R.cat)}</div>
          <div class="row">
            <button class="btn big bad" data-a="hit">😱 맞혔다 (라이어 승)</button>
            <button class="btn big ok" data-a="miss">🙅 틀렸다 (시민 승)</button>
          </div>
        </div>
      </div>`;
    actions = {
      hit: () => result(R, true, `${nm} 님이 제시어를 맞혔습니다!`),
      miss: () => result(R, false, `${nm} 님이 제시어를 맞히지 못했습니다!`),
    };
  }

  function result(R, liarWin, msg) {
    L.log = [...(L.log || []), liarWin ? 'liar' : 'citizen']; L.phase = 'result'; persist(); // 서버 모드: 폰에도 정답 공개
    const liarNames = R.liars.map((k) => L.g.n[k]).join(', ');
    say(`${msg} ${liarWin ? '라이어의 승리입니다!' : '시민의 승리입니다!'} 제시어는 ${R.word}, 라이어는 ${liarNames} 님이었습니다.`);
    liarWin ? sfx.boom() : sfx.fanfare();
    flash(liarWin ? 'var(--bad)' : 'var(--ok)');
    main.innerHTML = `
      <div class="screen">
        <div class="stage">
          <div class="sub" style="color:var(--muted)">${esc(msg)}</div>
          <div class="result-big pop">${liarWin ? '🤥 라이어 승리!' : '🎉 시민 승리!'}</div>
          <div class="row">
            <div class="pill">제시어: <b>${esc(R.word)}</b></div>
            ${L.g.mode === 'fool' ? `<div class="pill">라이어의 제시어: <b>${esc(R.fake)}</b></div>` : ''}
            <div class="pill">라이어: <b>${esc(liarNames)}</b></div>
          </div>
          <div class="pill">${score()}</div>
          <div class="row">
            <button class="btn big primary" data-a="next">▶ 다음 라운드</button>
            <button class="btn gold" data-a="roulette">🎰 벌칙 룰렛</button>
          </div>
        </div>
      </div>`;
    actions = { next: () => nextRound(), roulette: () => go('roulette') };
  }

  function nextRound() {
    L.r++; L.phase = 'round'; persist();
    say(srv() ? `라운드 ${L.r}입니다. 폰에 새 제시어가 나왔습니다.` : `라운드 ${L.r}입니다. 모두 폰에서 다음 버튼을 눌러 라운드 ${L.r}로 넘어가 주세요.`);
    round();
  }

  setup();
};

// ── ⚙️ 설정 ──
screens.settings = () => {
  main.innerHTML = `
    <div class="screen">
      <div class="head"><h2>⚙️ 설정</h2></div>
      <div class="form">
        <label>팀 이름</label>
        <div class="row" style="flex-wrap:nowrap">
          <input id="n0" value="${esc(S.teams[0].name)}" maxlength="10">
          <input id="n1" value="${esc(S.teams[1].name)}" maxlength="10">
        </div>
        <label>문제 세트 번호 (정답지와 같은 번호여야 순서가 맞아요)</label>
        <div class="row" style="flex-wrap:nowrap;justify-content:flex-start">
          <input id="set" type="number" min="1" max="999" inputmode="numeric" value="${S.set}" style="max-width:120px">
          <a class="btn gold" href="answers.html?set=${S.set}" target="_blank" rel="noopener" style="text-decoration:none">📋 정답지 열기</a>
        </div>
        <label>📶 핫스팟 Wi-Fi (노트북 서버용: 접속 화면에 Wi-Fi QR이 함께 떠서 찍기만 하면 연결돼요. 비워 두면 안 나옴)</label>
        <div class="row" style="flex-wrap:nowrap">
          <input id="ssid" value="${esc((S.wifi && S.wifi.ssid) || '')}" placeholder="Wi-Fi 이름 (대소문자·띄어쓰기 그대로)" autocomplete="off" spellcheck="false">
          <input id="wpass" value="${esc((S.wifi && S.wifi.pass) || '')}" placeholder="비밀번호" autocomplete="off" spellcheck="false">
        </div>
        <label>벌칙 룰렛 항목 (한 줄에 하나)</label>
        <textarea id="pen">${esc(S.penalties.join('\n'))}</textarea>
        <div class="row">
          <button class="btn primary big" data-a="save">저장</button>
          <button class="btn" data-a="resetPen">벌칙 기본값</button>
          <button class="btn bad" data-a="resetScore">점수 초기화</button>
        </div>
      </div>
    </div>`;
  actions = {
    save: () => {
      S.teams[0].name = $('#n0').value.trim() || 'A팀';
      S.teams[1].name = $('#n1').value.trim() || 'B팀';
      S.penalties = $('#pen').value.split('\n').map((s) => s.trim()).filter(Boolean);
      S.set = Math.max(1, parseInt($('#set').value, 10) || 1);
      const ssid = $('#ssid').value.trim();
      S.wifi = ssid ? { ssid, pass: $('#wpass').value } : null;
      document.querySelector('a[href^="answers.html"]').href = 'answers.html?set=' + S.set;
      save(); renderScore(); pushScores(); sfx.ok(); toast('저장했어요');
    },
    resetPen: () => { $('#pen').value = DEFAULT_PENALTIES.join('\n'); },
    resetScore: () => {
      if (!confirm('팀 점수(0:0)와 개인 포인트를 모두 초기화할까요?\n(노래·OST·초성·사진 퀴즈에서 푼 문제 기록도 처음으로 돌아갑니다)')) return;
      S.teams.forEach((t) => { t.score = 0; }); S.indiv = {}; S.chosungDone = {}; S.chosungPos = {}; S.quizDone = {}; S.quizPos = {};
      save(); renderScore(); pushScores(); toast('점수 초기화');
    },
  };
};

// ── 🏅 점수판: 팀 점수 + 개인 포인트 수정, 폰 공개 범위 ──
screens.scores = () => {
  const SHOW = [['all', '팀 + 개인 순위'], ['team', '팀 점수만'], ['off', '숨김']];
  const medal = (x) => (x.p > 0 && x.r <= 3 ? ['🥇', '🥈', '🥉'][x.r - 1] + ' ' : '');
  function col(t, R) {
    const mem = R.filter((x) => x.t === t);
    return `
      <div class="scol ${t ? 'B' : 'A'}">
        <div class="shead"><span>${esc(S.teams[t].name)}</span>
          <span class="row" style="gap:4px;flex-wrap:nowrap"><button data-a="team" data-v="${t}:-1">−</button><b>${S.teams[t].score}</b><button data-a="team" data-v="${t}:1">＋</button></span></div>
        ${mem.map((x) => `<div class="prow"><span>${medal(x)}${S.leaders && S.leaders.includes(x.n) ? '👑 ' : ''}${esc(x.n)}</span>
          <button data-a="ind" data-v="${t}|-1|${esc(x.n)}">−</button><span class="pp">${x.p}</span><button data-a="ind" data-v="${t}|1|${esc(x.n)}">＋</button></div>`).join('')
          || '<p class="sub" style="color:var(--muted);text-align:center">🎲 팀 나누기를 하면 팀원이 여기에 나와요</p>'}
      </div>`;
  }
  function draw() {
    const R = ranked();
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🏅 점수판</h2><span class="sub">팀 점수와 개인 포인트를 −/＋로 고칠 수 있어요</span></div>
        <div class="stage-wrap">
          <div class="sboard">${col(0, R)}${col(1, R)}</div>
          <div class="controls">
            <p class="sub" style="margin:0;text-align:center;color:var(--muted)">📱 참가자 폰에 공개할 범위</p>
            <div class="chips">${SHOW.map(([k, l]) => `<button class="chip ${S.scoreShow === k ? 'on' : ''}" data-a="show" data-v="${k}">${l}</button>`).join('')}</div>
            <p class="sub" style="margin:0;text-align:center;color:var(--muted)">${NET.info ? (Party.st ? `지금 폰 ${Party.members().length}대에 실시간으로 보입니다` : '홈 → 📱 폰 연결을 열면 폰에서 볼 수 있어요') : '노트북 서버(start.bat)로 열면 폰에서 볼 수 있어요'}</p>
            <button class="btn ${S.askWho ? 'on' : ''}" data-a="ask">🙋 팀 점수 줄 때 "누가 맞혔나요?" ${S.askWho ? 'ON' : 'OFF'}</button>
            <button class="btn big gold" data-a="awards">🏆 시상식</button>
            ${NET.info ? '<button class="btn" data-a="remote">🎤 사회자 폰 연결 (정답지 + 점수 주기)</button>' : ''}
            <button class="btn bad" data-a="reset">개인 포인트 초기화</button>
          </div>
        </div>
      </div>`;
  }
  actions = {
    team: (v) => { const [t, n] = v.split(':').map(Number); addScore(t, n, false); n > 0 ? sfx.ok() : sfx.bad(); draw(); },
    ind: (v) => { const [t, n, ...rest] = v.split('|'); addIndiv(rest.join('|'), Number(t), Number(n)); Number(n) > 0 ? sfx.ok() : sfx.tick(); draw(); },
    show: (v) => { S.scoreShow = v; save(); pushScores(); sfx.tick(); toast(`📱 참가자 폰: ${SHOW.find((x) => x[0] === v)[1]}`); draw(); },
    ask: () => { S.askWho = !S.askWho; save(); draw(); },
    awards: () => go('awards'),
    remote: () => go('remote'),
    reset: () => { if (confirm('개인 포인트를 모두 0으로 만들까요? (팀 점수는 그대로)')) { S.indiv = {}; save(); pushScores(); draw(); toast('개인 포인트 초기화'); } },
  };
  draw();
};

// ── 🏆 시상식: 팀 우승 → 개인 3위 → 2위 → 1위(MVP) 순서로 두구두구 공개 ──
screens.awards = () => {
  const [a, b] = S.teams.map((t) => t.score);
  const win = a === b ? null : a > b ? 0 : 1;
  // 개인: 포인트가 같으면 공동 수상 (1위 그룹, 2위 그룹, 3위 그룹)
  const groups = [];
  ranked().filter((x) => x.p > 0).forEach((x) => { const g = groups[groups.length - 1]; if (g && g.p === x.p) g.list.push(x); else groups.push({ p: x.p, list: [x] }); });
  const top = groups.slice(0, 3);
  const steps = ['intro', 'team', ...top.map((_, i) => i).reverse(), 'end'];
  let k = 0, timers = [];
  onCleanup(() => timers.forEach(clearTimeout));
  const tag = (x) => `${S.leaders && S.leaders.includes(x.n) ? '👑 ' : ''}${esc(x.n)} <small style="color:var(--${x.t ? 'B' : 'A'})">${esc(S.teams[x.t].name)}</small>`;
  const MED = [['🥇', '1위 · MVP'], ['🥈', '2위'], ['🥉', '3위']];

  function show(drum) {
    const s = steps[k];
    let body = '';
    if (s === 'intro') body = `<div class="medal">🏆</div><div class="names-big">시상식</div><p class="notice" style="margin:0">팀 우승 → 개인 3위 → 2위 → 1위(MVP) 순서로 공개합니다</p>`;
    else if (s === 'team') body = drum ? '<div class="medal drumroll">🥁</div><div class="names-big">팀 우승은…</div>'
      : `<div class="medal pop">${win == null ? '🤝' : '🏆'}</div><div class="names-big pop">${win == null ? '공동 우승!' : esc(S.teams[win].name) + ' 우승!'}</div>
         <p class="notice pop" style="margin:0">🎁 ${esc(PRIZE_INFO.win)}</p>
         <div class="answer">${esc(S.teams[0].name)} ${a} : ${b} ${esc(S.teams[1].name)}</div>`;
    else if (s === 'end') body = `<div class="names-big">🎉 모두 수고하셨습니다!</div>
      <div class="sc-list" style="width:min(520px,100%)">${win == null ? '' : `<div class="sc-row"><span>🏆</span><span>팀 우승</span><b>${esc(S.teams[win].name)}</b></div>`}
        ${top.map((g, i) => `<div class="sc-row"><span>${MED[i][0]}</span><span>${g.list.map((x) => esc(x.n)).join(', ')}</span><b>${g.p}점</b></div>`).join('')}</div>`;
    else {
      const g = top[s];
      body = drum ? `<div class="medal drumroll">🥁</div><div class="names-big">개인 ${MED[s][1]}는…</div>`
        : `<div class="medal pop">${MED[s][0]}</div><p class="notice" style="margin:0">개인 ${MED[s][1]}${g.list.length > 1 ? ` (공동 ${g.list.length}명)` : ''}</p>
           <div class="names-big pop">${g.list.map(tag).join('<br>')}</div><div class="answer">${g.p}점</div>
           ${s === 0 ? `<p class="notice pop" style="margin:0">🎁 개인 우수상: ${esc(PRIZE_INFO.mvp)}${g.list.length > 1 ? ' (공동 수상 — 사회자가 정해 주세요)' : ''}</p>` : ''}`;
    }
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🏆 시상식</h2><span class="pill">${Math.min(k + 1, steps.length)} / ${steps.length}</span></div>
        <div class="stage award-stage">${body}</div>
        <div class="row" style="margin-top:8px">
          ${k > 0 ? '<button class="btn" data-a="prev">◀ 이전</button>' : ''}
          ${s === 'end' ? `<button class="btn gold" data-a="gift">🎁 패배팀 상품 뽑기</button><button class="btn primary" data-a="phones">📱 폰에 전체 순위 공개</button><button class="btn" data-a="board">🏅 점수판</button>`
            : `<button class="btn big gold" data-a="next" ${drum ? 'disabled' : ''}>${s === 'intro' ? '🥁 시작!' : '다음 공개 ▶'}</button>`}
        </div>
      </div>`;
  }
  // 두구두구 2.4초 → 공개
  function reveal() {
    const s = steps[k];
    if (s === 'intro' || s === 'end') { show(false); if (s === 'end') sfx.fanfare(); return; }
    show(true);
    for (let i = 0; i < 24; i++) timers.push(setTimeout(() => tone(180 + (i % 2) * 30, 0.06, 'triangle', 0.25), i * 100));
    timers.push(setTimeout(() => { show(false); sfx.fanfare(); flash('var(--gold)'); }, 2500));
  }
  actions = {
    next: () => { if (k < steps.length - 1) { k++; reveal(); } },
    prev: () => { timers.forEach(clearTimeout); timers = []; if (k > 0) { k--; show(false); } },
    phones: () => { S.scoreShow = 'all'; save(); pushScores(); toast('📱 참가자 폰에 팀 점수와 개인 순위를 공개했어요'); },
    board: () => go('scores'),
    gift: () => go('gift'),
  };
  if (!groups.length) toast('아직 개인 포인트를 받은 사람이 없어요. 팀 우승만 발표합니다', 3500);
  show(false);
};

// ── 🎤 사회자 폰(리모컨)에서 온 점수 명령 처리 ──
// 진행 화면이 점수의 주인이므로, 폰은 명령만 보내고 계산·저장·폰 공유는 여기서 함
const rlog = []; // [↩️ 방금 것 취소]용 기록
function onRemote(v) {
  const TN = S.teams[v.team].name;
  if (v.op === 'team') {
    addScore(v.team, v.n, false);
    v.who.forEach((nm) => addIndiv(nm, v.team, v.ip));
    rlog.push(v);
    if (v.n > 0) { sfx.ok(); flash(v.team ? 'var(--B)' : 'var(--A)'); } else sfx.bad();
    const who = !v.who.length ? '' : v.who.length > 3 ? ` · 팀 전원 +${v.ip}` : ` · ${v.who.join(', ')} +${v.ip}`;
    toast(`🎤 ${TN} ${v.n > 0 ? '+' : ''}${v.n}점${who}`);
  } else if (v.op === 'indiv' && v.who[0]) {
    addIndiv(v.who[0], v.team, v.n); rlog.push(v); sfx.tick();
    toast(`🎤 ${v.who[0]} ${v.n > 0 ? '+' : ''}${v.n}점`);
  } else if (v.op === 'act') {
    // 진행 화면의 실제 버튼을 대신 누름 → 점수·효과음·비활성 상태가 직접 누를 때와 똑같이 동작
    const sel = `[data-a="${CSS.escape(v.a)}"]` + (v.v ? `[data-v="${CSS.escape(v.v)}"]` : '');
    const btn = main.querySelector(sel) || document.querySelector('#buzzcover ' + sel); // 🔔 버저 창 버튼도
    if (!btn || btn.disabled) { toast('🎤 지금 화면에서는 누를 수 없는 버튼이에요'); pushCtl(); return; }
    const before = S.teams.map((t) => t.score);
    remoteClick = true;
    try { btn.click(); } finally { remoteClick = false; }
    const d = S.teams.map((t, k) => t.score - before[k]);
    let who = v.a === 'win' ? v.who : [], ip = v.ip, team = v.team;
    who.forEach((nm) => addIndiv(nm, team, ip));
    if (v.a === 'bzOk' && bzGave) { who = [bzGave.name]; ip = bzGave.ip; team = bzGave.team; bzGave = null; } // 버저 정답은 이미 줌 → 취소 기록만
    if (d.some(Boolean) || who.length) {
      rlog.push({ op: 'delta', d, who, team, ip });
      const got = d.map((x, k) => (x ? `${S.teams[k].name} ${x > 0 ? '+' : ''}${x}점` : '')).filter(Boolean).join(' · ');
      toast(`🎤 ${got}${who.length ? ` · ${who.length > 3 ? '팀 전원' : who.join(', ')} +${ip}` : ''}`);
    }
  } else if (v.op === 'undo') {
    const x = rlog.pop();
    if (!x) { toast('🎤 취소할 점수가 없어요'); return; }
    if (x.op === 'team') { addScore(x.team, -x.n, false); x.who.forEach((nm) => addIndiv(nm, x.team, -x.ip)); }
    else if (x.op === 'delta') { x.d.forEach((n, k) => { if (n) addScore(k, -n, false); }); x.who.forEach((nm) => addIndiv(nm, x.team, -x.ip)); }
    else addIndiv(x.who[0], x.team, -x.n);
    sfx.tick(); toast('🎤 방금 준 점수를 취소했어요');
  }
  if (current === 'scores') go('scores'); // 점수판 화면이면 다시 그림
}
Party.on((v) => { if (v.t === 'remote') onRemote(v); });

// ── 🎤 사회자 폰 연결 화면: QR을 사회자만 찍고 바로 닫음 ──
screens.remote = async () => {
  main.innerHTML = '<div class="screen"><div class="stage"><div class="sub">📡 서버에 연결하는 중…</div></div></div>';
  await NET.ready;
  const ok = NET.info && await Party.open();
  if (current !== 'remote') return;
  if (!ok) {
    main.innerHTML = `
      <div class="screen"><div class="stage">
        <div class="result-big">😵 노트북 서버가 필요해요</div>
        <p class="sub" style="text-align:center;color:var(--muted)">노트북에서 <b>start.bat</b>(node server.js)을 실행하고<br><b>http://localhost:8000</b> 으로 열어 주세요.</p>
        <div class="row"><button class="btn primary" data-a="retry">🔁 다시 시도</button><button class="btn" data-a="home">🏠 홈</button></div>
      </div></div>`;
    actions = { retry: () => go('remote'), home: () => go('home') };
    return;
  }
  const url = `${NET.origin()}/host.html?k=${S.rk}`;
  main.innerHTML = `
    <div class="screen">
      <div class="head"><h2>🎤 사회자 폰 연결</h2><span class="sub">사회자 폰에서 정답지 보면서 점수 주기</span></div>
      <div class="stage-wrap">
        <div class="stage" style="gap:8px">${qrBlock(url, '70%')}</div>
        <div class="controls">
          <p class="notice" style="margin:0;text-align:center">⚠️ 이 QR을 찍으면 누구나 점수를 줄 수 있어요<br>사회자만 찍고 바로 닫아 주세요</p>
          <p class="sub" style="margin:0;text-align:center;color:var(--muted)">TV에 비치므로 참가자들이 잠깐 고개를 돌리게 하거나,<br>사회자 폰을 노트북 화면 가까이 대고 빠르게 찍으세요.</p>
          <button class="btn big primary" data-a="home">✅ 찍었어요 → 닫기</button>
          <button class="btn" data-a="rotate">🔄 키 바꾸기 (다른 사람이 찍었을 때)</button>
          <button class="btn" data-a="scores">🏅 점수판</button>
        </div>
      </div>
    </div>`;
  actions = {
    home: () => go('home'),
    scores: () => go('scores'),
    rotate: async () => {
      if (!confirm('사회자 키를 바꿀까요?\n지금 연결된 사회자 폰은 끊기고, 새 QR을 다시 찍어야 합니다.')) return;
      S.rk = newKey(); save(); await Party.open(); toast('🔄 키를 바꿨어요. 새 QR을 찍어 주세요'); go('remote');
    },
  };
};

// ═══════════════════════ 시작 ═══════════════════════
screens.phones = () => phonesScreen();

renderScore();
go('home');
NET.ready.then(() => {
  if (!NET.info) return;
  if (S.partyHt) Party.open(); // 예전에 연 폰 연결 방이 있으면 다시 연결
  if (current === 'home') go('home');
});
