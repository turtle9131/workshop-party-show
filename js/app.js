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
  $('#scorebar').innerHTML = t(0, 'A') + '<button class="home-btn" data-home title="홈">🏠</button>' + t(1, 'B');
}
function addScore(i, n) {
  S.teams[i].score += n; save(); renderScore();
  const el = $('#pts' + i); el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 250);
}
$('#scorebar').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-home')) return go('home');
  const [i, n] = b.dataset.s.split(':').map(Number); addScore(i, n); n > 0 ? sfx.ok() : sfx.bad();
});

// ═══════════════════════ 화면 전환 ═══════════════════════
let actions = {};
let cleanups = [];
function onCleanup(fn) { cleanups.push(fn); }
function go(name, ...args) {
  cleanups.forEach((fn) => fn()); cleanups = [];
  actions = {};
  stopClip();
  main.scrollTop = 0;
  screens[name](...args);
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
  { key: 'charades', ic: '🎭', t: '몸으로 말해요', d: '고요 속의 외침' },
  { key: 'draw', ic: '🎨', t: '캐치마인드', d: '릴레이 그림 퀴즈' },
  { key: 'bomb', ic: '💣', t: '폭탄 돌리기', d: '터지면 벌칙!' },
  { key: 'allin', ic: '🔥', t: '올인 역전', d: '마지막 대역전' },
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
        <button class="btn" data-a="fs">⛶ 전체화면</button>
        <button class="btn" data-a="settings">⚙️ 설정</button>
      </div>
    </div>`;
  actions = {
    open: (k) => go(k),
    sound: () => go('sound'),
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
screens.music = (kind = 'music') => {
  const Q = AUDIO_QUIZ[kind];
  let filter = Q.filters ? Q.filters[0] : null, list = Q.list(filter);
  const orderFor = (f) => seededOrder(list.length, kind + (f ? ':' + f : ''), S.set);
  let order = orderFor(filter);
  let i = 0, hint = 0, revealed = false, playing = false;
  const song = () => list[order[i]];

  function render() {
    const s = song();
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>${Q.title}</h2>${Q.filters
          ? `<div class="chips">${Q.filters.map((f) => `<button class="chip ${f === filter ? 'on' : ''}" data-a="filter" data-v="${f}">${f}</button>`).join('')}</div>`
          : `<span class="sub">${Q.sub}</span>`}</div>
        <div class="stage-wrap">
          <div class="stage">
            <div class="qno">Q ${i + 1} / ${list.length}</div>
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
            <div class="row">
              <button class="btn A" data-a="win" data-v="0">${esc(S.teams[0].name)} 정답</button>
              <button class="btn B" data-a="win" data-v="1">${esc(S.teams[1].name)} 정답</button>
            </div>
            <div class="row">
              <button class="btn" data-a="prev" ${i === 0 ? 'disabled' : ''}>◀ 이전</button>
              <button class="btn" data-a="next">다음 ▶</button>
            </div>
          </div>
        </div>
      </div>`;
  }
  const setProg = (p) => { const el = $('#prog'); if (el) el.style.width = (p * 100) + '%'; };
  onYtPlaying = (on) => { playing = on; const d = $('#disc'); if (d) d.classList.toggle('spin', on); };
  onCleanup(() => { onYtPlaying = null; });
  const move = (d) => { stopClip(); i = (i + d + list.length) % list.length; hint = 0; revealed = false; render(); cueSong(song()); };

  actions = {
    filter: (f) => { stopClip(); filter = f; list = Q.list(f); order = orderFor(f); i = 0; hint = 0; revealed = false; render(); cueSong(song()); },
    clip: (v) => { setProg(0); playClip(song(), Number(v), setProg); },
    full: () => { setProg(1); playClip(song(), 0); },
    stop: () => stopClip(),
    hint: () => { if (hint < Q.hints.length) { hint++; sfx.beep(); render(); } },
    reveal: () => { revealed = true; sfx.fanfare(); render(); },
    win: (t) => { addScore(Number(t), 1); sfx.ok(); flash(t === '0' ? 'var(--A)' : 'var(--B)'); revealed = true; render(); playClip(song(), 0); },
    prev: () => move(-1),
    next: () => move(1),
  };
  render(); cueSong(song());
};

screens.ost = () => screens.music('ost');

// ── 🎲 팀 나누기 ──
screens.teams = () => {
  const parse = (txt) => [...new Set(txt.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];

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
            <button class="btn big primary" data-a="draw">🎲 팀 뽑기 시작!</button>
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
        S.players = names; save(); draw(names);
      },
      last: () => result(S.roster, true),
    };
  }

  function board(teams, current, curTeam) {
    const col = (t) => `
      <div class="tcol ${t ? 'B' : 'A'}">
        <div class="tname">${esc(S.teams[t].name)} <small>${teams[t].length}명</small></div>
        ${teams[t].map((n, k) => `<div class="tmember ${k === teams[t].length - 1 && curTeam === t ? 'pop' : ''}">${esc(n)}</div>`).join('')}
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
    if (!fromSaved) { S.roster = teams; save(); sfx.fanfare(); }
    main.innerHTML = `<div class="screen">${board(teams, '⚔️ VS ⚔️')}</div>`;
    $('#tact').innerHTML = `
      <button class="btn big primary" data-a="home">✅ 이대로 시작!</button>
      <button class="btn" data-a="again">🔁 다시 뽑기</button>
      <button class="btn" data-a="edit">✏️ 명단 수정</button>`;
    actions = {
      home: () => go('home'),
      again: () => draw(S.players || [...teams[0], ...teams[1]]),
      edit: () => setup(),
    };
  }

  setup();
};

// ── 🔤 초성 퀴즈 ──
screens.chosung = () => {
  const cats = ['전체', ...Object.keys(CHOSUNG)];
  const hangulLen = (w) => [...w].filter((ch) => ch >= '가' && ch <= '힣').length;
  let cat = '전체', pool = [], i = 0, keep = 0, revealed = false, stopTimer = null;

  function build() {
    const src = chosungList(cat);
    pool = seededOrder(src.length, 'chosung:' + cat, S.set).map((k) => src[k]);
    i = 0; keep = 0; revealed = false;
  }
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
            <div class="row"><span class="pill">${esc(q.c)}</span><span class="pill">${i + 1} / ${pool.length}</span><span class="pill">${revealed ? '정답!' : pts() + '점'}</span></div>
            <div class="word pop" style="color:var(--gold);letter-spacing:.08em">${esc(revealed ? q.w : chosung(q.w, keep))}</div>
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
          </div>
        </div>
      </div>`;
  }
  const stopT = () => { if (stopTimer) { stopTimer(); stopTimer = null; } };
  const show = () => { stopT(); revealed = true; render(); };

  actions = {
    cat: (c) => { stopT(); cat = c; build(); render(); },
    timer: () => {
      stopT();
      stopTimer = countdown(10, (s) => { const t = $('#tm'); if (t) { t.textContent = s; t.classList.toggle('warn', s <= 3); } if (s <= 3 && s > 0) sfx.tick(); }, () => { stopTimer = null; sfx.boom(); const t = $('#tm'); if (t) t.textContent = '⏰'; });
    },
    more: () => { keep++; sfx.beep(); render(); },
    reveal: () => { sfx.fanfare(); show(); },
    win: (t) => { addScore(Number(t), pts()); sfx.ok(); flash(t === '0' ? 'var(--A)' : 'var(--B)'); show(); },
    next: () => { stopT(); i = (i + 1) % pool.length; keep = 0; revealed = false; render(); },
  };
  build(); render();
};

// ── 📸 확대 사진 퀴즈 ──
screens.photo = () => {
  const SCALES = [7, 4, 2.2, 1], POINTS = [4, 3, 2, 1];
  const order = seededOrder(CELEBS.length, 'photo', S.set);
  let i = 0, stage = 0, revealed = false;
  const cur = () => CELEBS[order[i]];
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
              <span class="lvl">${i + 1}/${CELEBS.length} · ${revealed ? '정답!' : `${stage + 1}단계 · ${POINTS[stage]}점`}</span>
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
            <div class="row"><button class="btn big" data-a="next">다음 ▶</button></div>
          </div>
        </div>
      </div>`;
  }
  actions = {
    zoom: () => { if (stage < 3) { stage++; sfx.beep(); render(); } },
    reveal: () => { revealed = true; sfx.fanfare(); render(); },
    win: (t) => { addScore(Number(t), POINTS[stage]); sfx.ok(); flash(t === '0' ? 'var(--A)' : 'var(--B)'); revealed = true; render(); },
    next: () => { i = (i + 1) % order.length; stage = 0; revealed = false; render(); preload(i + 1); },
  };
  render(); preload(1);
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
      actions = {
        apply: (v, el) => { addScore(team, ok); sfx.fanfare(); el.disabled = true; el.textContent = '✅ 반영 완료'; },
        again: () => { team = 1 - team; setup(); },
      };
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
  let team = 0, secs = 90, relay = true, word = null;
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
          <p class="sub" style="margin:0;color:var(--muted)">그리는 팀 전원이 폰을 돌려가며 이어 그리고, 상대 팀이 맞힙니다.<br>상대 팀이 맞히면 상대 팀 +2점, 그리는 팀 +1점</p>
          <button class="btn big primary" data-a="word">제시어 보기</button>
        </div>
      </div>`;
    actions = {
      team: (v) => { team = Number(v); setup(); }, secs: (v) => { secs = Number(v); setup(); },
      relay: () => { relay = !relay; setup(); }, word: () => showWord(),
    };
  }
  function showWord() {
    let pool = DRAW_WORDS.filter((w) => !usedDraw.has(w)); if (!pool.length) { usedDraw.clear(); pool = DRAW_WORDS; }
    word = pick(pool); usedDraw.add(word);
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
screens.bomb = () => {
  let cat = pick(BOMB_CATEGORIES);
  function idle() {
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>💣 폭탄 돌리기</h2><span class="sub">한 명씩 답하고 폰을 옆으로!</span></div>
        <div class="stage">
          <div class="bomb">💣</div>
          <div class="category pop">${esc(cat)}</div>
          <p class="sub" style="margin:0;color:var(--muted)">주제에 맞는 단어를 말하고 옆 사람에게 폰을 넘기세요. 언제 터질지는 아무도 몰라요!</p>
          <div class="row"><button class="btn" data-a="shuffle">🔀 주제 바꾸기</button><button class="btn big bad" data-a="start">💣 점화!</button></div>
        </div>
      </div>`;
    actions = { shuffle: () => { cat = pick(BOMB_CATEGORIES.filter((c) => c !== cat)); idle(); }, start: () => run() };
  }
  function run() {
    const fuse = 20 + Math.random() * 30, t0 = Date.now();
    main.innerHTML = `
      <div class="screen">
        <div class="stage">
          <div class="bomb shake">💣</div>
          <div class="category" id="cat">${esc(cat)}</div>
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
    actions = { shuffle: () => { cat = pick(BOMB_CATEGORIES.filter((c) => c !== cat)); $('#cat').textContent = cat; sfx.beep(); } };
  }
  function explode() {
    sfx.boom(); flash('#ff6b00'); if (navigator.vibrate) navigator.vibrate([400, 100, 400]);
    main.innerHTML = `
      <div class="screen">
        <div class="stage">
          <div class="boom pop">💥 펑!</div>
          <p class="notice" style="margin:0">지금 폰을 들고 있는 사람 당첨!</p>
          <div class="row">
            <button class="btn A" data-a="minus" data-v="0">${esc(S.teams[0].name)} −1</button>
            <button class="btn B" data-a="minus" data-v="1">${esc(S.teams[1].name)} −1</button>
          </div>
          <div class="row"><button class="btn gold big" data-a="roulette">🎰 벌칙 룰렛</button><button class="btn big" data-a="again">🔁 한 판 더</button></div>
        </div>
      </div>`;
    actions = {
      minus: (v, el) => { addScore(Number(v), -1); sfx.bad(); el.disabled = true; },
      roulette: () => go('roulette'),
      again: () => { cat = pick(BOMB_CATEGORIES.filter((c) => c !== cat)); idle(); },
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
    const q = ALLIN[order[qi % order.length]];
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>🔥 문제</h2><span class="pill">${esc(S.teams[0].name)} ${bets[0]} vs ${bets[1]} ${esc(S.teams[1].name)}</span></div>
        <div class="stage">
          <div class="question pop">${esc(q.q)}</div>
          <p class="notice" style="margin:0">각 팀은 답을 종이에 적으세요! ✍️</p>
          <div class="timer" id="tm"></div>
          <div class="row"><button class="btn" data-a="timer">⏱ 30초</button><button class="btn big gold" data-a="answer">정답 공개</button></div>
        </div>
      </div>`;
    actions = {
      timer: () => countdown(30, (s) => { const t = $('#tm'); if (t) { t.textContent = s; t.classList.toggle('warn', s <= 5); } if (s <= 5 && s > 0) sfx.tick(); }, () => { sfx.boom(); }),
      answer: () => judge(q),
    };
  }
  function judge(q) {
    result = [null, null];
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
      document.querySelector('a[href^="answers.html"]').href = 'answers.html?set=' + S.set;
      save(); renderScore(); sfx.ok(); toast('저장했어요');
    },
    resetPen: () => { $('#pen').value = DEFAULT_PENALTIES.join('\n'); },
    resetScore: () => { if (confirm('점수를 0:0으로 초기화할까요?')) { S.teams.forEach((t) => { t.score = 0; }); save(); renderScore(); toast('점수 초기화'); } },
  };
};

// ═══════════════════════ 시작 ═══════════════════════
renderScore();
go('home');
