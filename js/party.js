'use strict';
// ═══════════════════════ 노트북 서버 연결 (진행 화면용) ═══════════════════════
// node server.js 로 열었을 때만 동작합니다. 정적 호스팅(GitHub Pages 등)이나 file:// 에서는 NET.info 가 null 이고
// 모든 게임이 예전 방식 그대로 동작합니다.
// 이 파일은 app.js 보다 먼저 불러오고, app.js 의 전역(main, $, esc, sfx, toast, flash, S, save)은 호출 시점에만 씁니다.

const NET = {
  info: null,
  ready: location.protocol.startsWith('http')
    ? fetch('/api/ping', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => (NET.info = j && j.ok ? j : null)).catch(() => null)
    : Promise.resolve(null),
  post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.json().catch(() => ({})).then((j) => (r.ok ? j : Promise.reject(j))));
  },
  // 폰이 들어올 주소: 노트북에서 localhost로 열었어도 QR에는 LAN IP를 넣음 (S.ipi로 다른 주소 선택)
  origin() {
    const ips = (NET.info && NET.info.ips) || [], local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
    if (!local || !ips.length) return location.origin;
    return `http://${ips[Math.min(S.ipi || 0, ips.length - 1)]}:${location.port || 80}`;
  },
  canSwitchIp() { return /^(localhost|127\.|\[::1\])/.test(location.hostname) && ((NET.info && NET.info.ips) || []).length > 1; },
  nextIp() { S.ipi = ((S.ipi || 0) + 1) % NET.info.ips.length; save(); },
  qr(url) {
    try { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) { return ''; }
  },
  // SSE 연결. 서버가 다시 켜져 연결이 완전히 끊기면 onDead 를 부름 (재등록 후 다시 연결하는 용도)
  stream(url, onMsg, onDead) {
    const h = { es: null, closed: false, close() { h.closed = true; if (h.es) h.es.close(); } };
    const open = () => {
      if (h.closed) return;
      const es = h.es = new EventSource(url);
      es.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch (err) { /* 무시 */ } };
      es.onerror = () => {
        if (es.readyState !== 2 || h.closed) return;
        setTimeout(() => { if (h.closed) return; Promise.resolve(onDead && onDead()).catch(() => null).then(open); }, 2000);
      };
    };
    open();
    return h;
  },
};

// ── 접속 QR 블록: ⚙️ 설정에 핫스팟 Wi-Fi를 넣어 두면 "① Wi-Fi QR → ② 게임 QR"을 나란히 보여 줌 ──
// Wi-Fi QR은 폰 기본 카메라로 찍으면 비밀번호 입력 없이 바로 그 Wi-Fi에 연결됩니다 (아이폰 iOS 11+, 안드로이드 10+).
const wifiEsc = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');
function wifiQrText(w) {
  return `WIFI:T:${w.pass ? 'WPA' : 'nopass'};S:${wifiEsc(w.ssid)};${w.pass ? `P:${wifiEsc(w.pass)};` : ''};`;
}
// 접속 안내 문구: Wi-Fi QR이 있으면 순서를 알려 줌
function joinHint(what) {
  return S.wifi && S.wifi.ssid ? `📱 ① Wi-Fi QR로 연결한 뒤<br>② 게임 QR을 찍고 ${what}` : `📱 같은 Wi-Fi(또는 핫스팟)에서<br>QR을 찍고 ${what}`;
}
function qrBlock(url, maxH = '70%') {
  const qr = NET.qr(url), w = S.wifi && S.wifi.ssid ? S.wifi : null;
  if (!w) {
    return `${qr ? `<div class="qr" style="max-height:${maxH}">${qr}</div>` : ''}
      <div class="pill" style="font-size:clamp(16px,3.4vmin,26px);word-break:break-all">${esc(url)}</div>`;
  }
  return `<div class="qrpair">
      <div class="qritem"><div class="qstep">① Wi-Fi 연결</div><div class="qbox"><div class="qr">${NET.qr(wifiQrText(w))}</div></div>
        <div class="qcap">📶 ${esc(w.ssid)}${w.pass ? `<br>🔑 ${esc(w.pass)}` : ''}</div></div>
      <div class="qritem"><div class="qstep">② 게임 접속</div><div class="qbox"><div class="qr">${qr}</div></div>
        <div class="qcap">${esc(url)}</div></div>
    </div>`;
}

// ── 명단형 게임(라이어)의 접속 화면: QR + 이름별 접속 상태 + 잠금 풀기 ──
// o = { kind: 'l', code, names, ht, title, mid, register(), onStart(), onBack(), onSetup() }
async function rosterJoinScreen(o) {
  main.innerHTML = '<div class="screen"><div class="stage"><div class="sub">📡 서버에 연결하는 중…</div></div></div>';
  await NET.ready;
  try { await o.register(); } catch (e) {
    main.innerHTML = `
      <div class="screen"><div class="stage">
        <div class="result-big">😵 서버에 연결할 수 없어요</div>
        <p class="sub" style="text-align:center;color:var(--muted)">노트북에서 <b>node server.js</b> 가 켜져 있는지 확인해 주세요.</p>
        <div class="row"><button class="btn primary" data-a="retry">🔁 다시 연결</button><button class="btn" data-a="setup">✏️ 준비 화면으로</button></div>
      </div></div>`;
    actions = { retry: () => rosterJoinScreen(o), setup: () => o.onSetup() };
    return;
  }
  const url = `${NET.origin()}/player.html?s=${o.code}&t=${o.kind}`;
  let st = { claimed: o.names.map(() => false), online: o.names.map(() => false) };
  const who = () => o.names.map((nm, k) => {
    const tag = st.online[k] ? '✅' : st.claimed[k] ? '🟡' : '⬜';
    return `<button class="nbtn ${st.claimed[k] ? '' : 'dead'}" ${st.claimed[k] ? `data-a="release" data-v="${k}"` : ''} style="text-decoration:none">${tag} ${esc(nm)}</button>`;
  }).join('');
  const count = () => `${st.claimed.filter(Boolean).length} / ${o.names.length}명 접속`;
  main.innerHTML = `
    <div class="screen">
      <div class="head"><h2>📡 ${esc(o.title)}</h2><span class="pill" id="cnt">${count()}</span></div>
      <div class="stage-wrap">
        <div class="stage" style="gap:8px">
          ${qrBlock(url, '62%')}
          <div class="ngrid" id="who">${who()}</div>
        </div>
        <div class="controls">
          <p class="notice" style="margin:0;text-align:center">${joinHint('자기 이름을 누르세요')}</p>
          <p class="sub" style="margin:0;text-align:center;color:var(--muted)">✅ 접속 중 · 🟡 화면 꺼짐 · ⬜ 아직<br>이름을 잘못 골랐으면 그 이름을 눌러 풀어 주세요.</p>
          ${NET.canSwitchIp() ? '<button class="btn" data-a="ip">🌐 다른 주소로 바꾸기 (폰이 안 들어올 때)</button>' : ''}
          ${o.mid ? '<button class="btn big primary" data-a="back">↩ 게임으로 돌아가기</button>'
                  : `<button class="btn big primary" data-a="start">▶ 모두 접속했어요 → 시작</button>
                     <button class="btn" data-a="setup">✏️ 준비 화면으로</button>`}
        </div>
      </div>
    </div>`;
  const h = NET.stream(`/api/${o.kind}/events?c=${o.code}&ht=${o.ht()}`, (v) => {
    if (v.t !== 'host') return;
    st = v; const w = $('#who'), c = $('#cnt');
    if (w) w.innerHTML = who();
    if (c) c.textContent = count();
  }, () => o.register());
  onCleanup(() => h.close());
  actions = {
    release: (v) => {
      const k = Number(v);
      if (confirm(`${o.names[k]} 님의 이름 잠금을 풀까요?\n(그 폰은 접속이 끊기고, 이름을 다시 고를 수 있게 됩니다)`)) {
        NET.post(`/api/${o.kind}/release`, { c: o.code, ht: o.ht(), k }).catch(() => toast('서버에 연결할 수 없어요'));
      }
    },
    ip: () => { NET.nextIp(); h.close(); rosterJoinScreen(o); },
    start: () => {
      const left = st.claimed.filter((x) => !x).length;
      if (left && !confirm(`아직 ${left}명이 접속하지 않았어요. 그래도 시작할까요?`)) return;
      h.close(); o.onStart();
    },
    back: () => { h.close(); o.onBack(); },
    setup: () => { h.close(); o.onSetup(); },
  };
}

// ═══════════════════════ 📱 폰 연결 (파티 게임) ═══════════════════════
// 행사 내내 하나의 방을 씁니다. 참가자는 play.html 로 한 번 접속(이름·팀)해 두면,
// 진행 화면이 여는 게임(버저·폭탄·캐치마인드·올인)에 맞춰 폰 화면이 바뀝니다.
const Party = {
  st: null, h: null, subs: new Set(), opening: null, lastBuzz: null,
  // 연결된 폰이 한 명이라도 있으면 폰 방식으로 진행
  get active() { return !!(Party.st && Party.st.members.length); },
  members(team) { return Party.st ? Party.st.members.filter((m) => team === undefined || m.team === team) : []; },
  on(fn) { Party.subs.add(fn); return () => Party.subs.delete(fn); },
  emit(v) { Party.subs.forEach((fn) => { try { fn(v); } catch (e) { console.error(e); } }); },

  // 방 열기 + 진행 화면 실시간 연결 (서버가 있을 때만)
  async open(force) {
    await NET.ready;
    if (!NET.info) return false;
    try {
      const roster = S.roster && S.roster.length === 2 ? S.roster : null;
      const j = await NET.post('/api/p/open', { ht: S.partyHt, teamNames: S.teams.map((t) => t.name), roster, players: Party.soloList(), rk: S.rk, force: !!force });
      S.partyHt = j.ht; save();
      if (typeof pushScores === 'function') pushScores(); // 폰에 현재 점수 보내기
    } catch (e) {
      if (e && e.error === 'exists') {
        if (!force && confirm('다른 진행 화면이 이미 폰 연결 방을 열어 두었어요.\n이 화면에서 새로 열까요? (지금 접속한 폰은 다시 접속해야 합니다)')) return Party.open(true);
      }
      return false;
    }
    if (!Party.h) {
      Party.h = NET.stream(`/api/p/events?ht=${S.partyHt}`, (v) => {
        if (v.t === 'host') { Party.st = v; Party.badge(); }
        Party.emit(v);
      }, () => NET.post('/api/p/open', { ht: S.partyHt, teamNames: S.teams.map((t) => t.name), roster: S.roster || null, players: Party.soloList(), rk: S.rk })
        .then(() => { if (typeof pushScores === 'function') pushScores(); }).catch(() => null));
    }
    return true;
  },
  // 팀이 정해지기 전(🎵 사전 게임 · 🎬 OST 드래프트)에는 이름만 골라 개인으로 접속
  soloList() { return !S.roster && S.pre && Array.isArray(S.players) ? S.players : null; },
  act(op, extra = {}) {
    if (!S.partyHt || !NET.info) return Promise.resolve(null);
    return NET.post('/api/p/act', { ht: S.partyHt, op, ...extra }).catch(() => null);
  },
  kick(id) { return NET.post('/api/p/kick', { ht: S.partyHt, id }).catch(() => null); },

  // 화면 오른쪽 아래 "📱 n명" 배지 (누르면 폰 연결 화면)
  badge() {
    let b = document.getElementById('pbadge');
    if (!b) {
      b = document.createElement('button'); b.id = 'pbadge'; b.className = 'pbadge';
      b.addEventListener('click', () => go('phones'));
      document.body.appendChild(b);
    }
    const on = Party.st ? Party.st.members.filter((m) => m.online).length : 0, all = Party.st ? Party.st.members.length : 0;
    b.textContent = `📱 ${on}${all !== on ? '/' + all : ''}명`;
    b.style.display = Party.st ? '' : 'none';
  },

  // ── 🔔 버저 (노래·OST·초성·사진 퀴즈) ──
  // 화면에 들어갈 때 Party.buzzer(onBuzz). 누가 누르면 퀴즈 화면을 덮는 큰 창에 이름이 뜨고 onBuzz(team)가 불림
  // 창의 버튼: ⭕ 정답(buzzCorrect: 그 게임의 정답 처리 + 개인 포인트) · ❌ 다음 사람 · ❌ 상대 팀 · 🔁 모두 다시
  buzzer(onBuzz) {
    if (!Party.st) return;
    Party.act('buzz');
    let shown = '';
    const off = Party.on((v) => {
      if (v.t !== 'host' || !v.act || v.act.kind !== 'buzz') return;
      const a = v.act, f = a.first;
      const key = JSON.stringify([f && f.id, a.queue.map((x) => x.id), a.exclude, !!a.done]);
      if (key === shown) return;
      const prevFirst = shown ? JSON.parse(shown)[0] : null;
      shown = key;
      if (a.done) Party.cover(null);
      else if (f) {
        if (f.id !== prevFirst) { // 새로 답할 사람
          Party.lastBuzz = { name: f.name, team: f.team, at: Date.now() }; // "누가 맞혔나요?"에서 맨 앞에 표시
          sfx.go(); flash(f.team === 1 ? 'var(--B)' : f.team === 0 ? 'var(--A)' : 'var(--gold)');
          if (onBuzz) onBuzz(f.team);
        }
        Party.cover(a);
      } else Party.cover(null, a);
    });
    onCleanup(() => { off(); Party.cover(null); Party.act('idle'); });
  },
  // 다음 문제로 넘어갈 때 버저를 새로 엶 (누른 순서·오답 기록 모두 지움)
  buzzReset(exclude) { if (Party.st) { Party.cover(null); Party.act('buzzReset', { exclude: exclude || [] }); } },
  // 정답 처리 후: 창을 닫고 이 문제의 버저를 잠금 (다음 문제에서 buzzReset으로 다시 열림)
  banner(f) { if (!f && Party.st) { Party.cover(null); Party.act('buzzDone'); } },
  ctlSaved: null,
  cover(a, openAct) {
    let el = document.getElementById('buzzcover');
    if (!a) {
      if (el) el.remove();
      if (Party.ctlSaved) { CTL = Party.ctlSaved; Party.ctlSaved = null; pushCtl(); }
      // 오답 뒤 버저가 다시 열린 상태면 위쪽에 작게 알림
      const out = openAct && (openAct.out.length || openAct.exclude.length);
      let pill = document.getElementById('buzzopen');
      if (out) {
        if (!pill) { pill = document.createElement('div'); pill.id = 'buzzopen'; pill.className = 'buzzopen'; document.body.appendChild(pill); }
        pill.textContent = openAct.exclude.length && S.roster ? `🔔 ${S.teams[1 - openAct.exclude[0]].name} 기회! 버저를 누르세요` : '🔔 다른 사람 기회! 버저를 누르세요';
      } else if (pill) pill.remove();
      return;
    }
    const pill = document.getElementById('buzzopen'); if (pill) pill.remove();
    const f = a.first, team = f.team >= 0 && S.roster, rest = a.queue.slice(1);
    const other = team ? 1 - f.team : -1, canTeam = team && !a.exclude.includes(other);
    const tn = (x) => (x.team >= 0 && S.roster ? S.teams[x.team].name : '');
    if (!el) { el = document.createElement('div'); el.id = 'buzzcover'; document.body.appendChild(el); }
    el.className = 'buzzcover ' + (f.team === 1 ? 'B' : f.team === 0 ? 'A' : 'S');
    const nextL = rest.length ? `❌ 오답 → 다음: ${rest[0].name}` : '❌ 오답 → 다른 사람';
    el.innerHTML = `<div class="bc-in">
        <div class="bc-bell">🔔</div>
        ${tn(f) ? `<div class="bc-team">${esc(tn(f))}</div>` : ''}
        <div class="bc-name">${esc(f.name)}</div>
        <div class="bc-say">정답을 말해 주세요!</div>
        ${rest.length ? `<div class="bc-queue">대기 ${rest.map((x, k) => `<span>${k + 2}. ${esc(x.name)}</span>`).join('')}</div>` : ''}
        <div class="row bc-btns">
          <button class="btn big good" data-a="bzOk">⭕ 정답</button>
          <button class="btn big bad" data-a="bzNext">${esc(nextL)}</button>
          ${canTeam ? `<button class="btn big ${other ? 'B' : 'A'}" data-a="bzTeam">❌ 오답 → ${esc(S.teams[other].name)} 기회</button>` : ''}
        </div>
        <button class="btn bc-reset" data-a="bzAll">🔁 모두 다시 누르기</button>
      </div>`;
    const acts = {
      bzOk: () => { const g = { ...f }; Party.banner(null); if (typeof buzzCorrect === 'function') buzzCorrect(g); },
      bzNext: () => { sfx.bad(); flash('var(--bad)'); Party.act('buzzWrong', { mode: 'next' }); },
      bzTeam: () => { sfx.bad(); flash('var(--bad)'); Party.act('buzzWrong', { mode: 'team' }); },
      bzAll: () => Party.buzzReset([]),
    };
    el.onclick = (e) => { const b = e.target.closest('[data-a]'); if (b && acts[b.dataset.a]) acts[b.dataset.a](); };
    // 🎤 사회자 폰에도 같은 버튼
    if (!Party.ctlSaved) Party.ctlSaved = CTL;
    CTL = { ...Party.ctlSaved, q: `🔔 ${tn(f) ? tn(f) + ' · ' : ''}${f.name}`, revealed: false, win: null,
      can: [{ a: 'bzOk', l: '⭕ 정답', k: 'big' }, { a: 'bzNext', l: nextL }, ...(canTeam ? [{ a: 'bzTeam', l: `❌ → ${S.teams[other].name} 기회` }] : []), { a: 'bzAll', l: '🔁 모두 다시' }] };
    pushCtl();
  },
};

// ── 📱 폰 연결 화면 (홈 → 📱 폰 연결) ──
function phonesScreen() {
  main.innerHTML = '<div class="screen"><div class="stage"><div class="sub">📡 서버에 연결하는 중…</div></div></div>';
  Party.open().then((ok) => {
    if (!ok) {
      main.innerHTML = `
        <div class="screen"><div class="stage">
          <div class="result-big">😵 노트북 서버가 필요해요</div>
          <p class="sub" style="text-align:center;color:var(--muted)">노트북에서 <b>node server.js</b> 를 실행하고<br><b>http://localhost:8000</b> 으로 열어 주세요.</p>
          <div class="row"><button class="btn primary" data-a="retry">🔁 다시 시도</button><button class="btn" data-a="home">🏠 홈</button></div>
        </div></div>`;
      actions = { retry: () => phonesScreen(), home: () => go('home') };
      return;
    }
    const url = `${NET.origin()}/play.html`;
    const list = () => (Party.members(-1).length ? [0, 1, -1] : [0, 1]).map((t) => `
      <div class="tcol ${t < 0 ? '' : t ? 'B' : 'A'}" style="min-height:0">
        <div class="tname">${t < 0 ? '👤 개인전' : esc(S.teams[t].name)} <small>${Party.members(t).length}명</small></div>
        ${Party.members(t).map((m) => `<button class="tmember" data-a="kick" data-v="${m.id}" style="width:100%;border:0;cursor:pointer">${m.online ? '✅' : '🟡'} ${esc(m.name)}</button>`).join('')}
      </div>`).join('');
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>📱 폰 연결</h2><span class="sub">버저 퀴즈 · 점수 확인을 폰으로</span></div>
        <div class="stage-wrap">
          <div class="stage" style="gap:8px">
            ${qrBlock(url, '70%')}
          </div>
          <div class="controls">
            <p class="notice" style="margin:0;text-align:center">${joinHint('자기 이름을 입력하세요')}</p>
            <p class="sub" style="margin:0;text-align:center;color:var(--muted)">한 번만 하면 행사 내내 써요. 버저를 누르면 TV에 이 이름이 떠요. ${Party.soloList() ? '지금은 👤 개인전이라 이름만 입력합니다.' : S.roster ? '팀 나누기 명단에 있는 이름이면 팀이 자동으로 정해져요.' : '이름을 입력하고 팀을 고릅니다.'} 이름을 누르면 접속을 끊을 수 있어요.</p>
            <div class="tboard" id="plist" style="flex:1;min-height:0;overflow:auto">${list()}</div>
            <button class="btn" data-a="remote">🎤 사회자 폰 연결 (정답지 + 점수 주기)</button>
            ${NET.canSwitchIp() ? '<button class="btn" data-a="ip">🌐 다른 주소로 바꾸기</button>' : ''}
            <button class="btn big primary" data-a="home">🏠 홈으로</button>
          </div>
        </div>
      </div>`;
    const off = Party.on((v) => { if (v.t === 'host') { const el = $('#plist'); if (el) el.innerHTML = list(); } });
    onCleanup(off);
    actions = {
      kick: (v) => { const m = Party.st.members.find((x) => x.id === Number(v)); if (m && confirm(`${m.name} 님의 접속을 끊을까요?`)) Party.kick(m.id); },
      ip: () => { NET.nextIp(); phonesScreen(); },
      remote: () => go('remote'),
      home: () => go('home'),
    };
  });
}
