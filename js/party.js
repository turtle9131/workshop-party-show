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
  const url = `${NET.origin()}/player.html?s=${o.code}&t=${o.kind}`, qr = NET.qr(url);
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
          ${qr ? `<div class="qr" style="max-height:62%">${qr}</div>` : ''}
          <div class="pill" style="font-size:clamp(16px,3.4vmin,26px);word-break:break-all">${esc(url)}</div>
          <div class="ngrid" id="who">${who()}</div>
        </div>
        <div class="controls">
          <p class="notice" style="margin:0;text-align:center">📱 같은 Wi-Fi(또는 노트북 핫스팟)에서<br>QR을 찍고 자기 이름을 누르세요</p>
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
  st: null, h: null, subs: new Set(), opening: null,
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
      const j = await NET.post('/api/p/open', { ht: S.partyHt, teamNames: S.teams.map((t) => t.name), roster, force: !!force });
      S.partyHt = j.ht; save();
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
      }, () => NET.post('/api/p/open', { ht: S.partyHt, teamNames: S.teams.map((t) => t.name), roster: S.roster || null }).catch(() => null));
    }
    return true;
  },
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
  // 화면에 들어갈 때 Party.buzzer(onBuzz) → 누가 먼저 누르면 위쪽에 큰 배너가 뜨고 onBuzz(team)가 불림
  buzzer(onBuzz) {
    if (!Party.st) return;
    Party.act('buzz');
    let shown = null;
    const off = Party.on((v) => {
      if (v.t !== 'host' || !v.act || v.act.kind !== 'buzz') return;
      const f = v.act.first, key = f ? f.id + ':' + f.name : null;
      if (key === shown) return;
      shown = key;
      if (f) {
        sfx.go(); flash(f.team ? 'var(--B)' : 'var(--A)');
        if (onBuzz) onBuzz(f.team);
        Party.banner(f, v.act.exclude);
      } else Party.banner(null);
    });
    onCleanup(() => { off(); Party.banner(null); Party.act('idle'); });
  },
  // 다음 문제·정답 처리 때 버저를 다시 엶
  buzzReset(exclude) { if (Party.st) { Party.banner(null); Party.act('buzzReset', { exclude: exclude || [] }); } },
  banner(f, exclude = []) {
    let el = document.getElementById('buzzbar');
    if (!f) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'buzzbar'; document.body.appendChild(el); }
    const other = 1 - f.team, canOther = !exclude.includes(other);
    el.className = 'buzzbar ' + (f.team ? 'B' : 'A');
    el.innerHTML = `<div class="who">🔔 ${esc(S.teams[f.team].name)} · ${esc(f.name)}</div>
      <div class="row">
        ${canOther ? `<button class="btn" data-b="other">❌ 오답 → ${esc(S.teams[other].name)} 기회</button>` : ''}
        <button class="btn" data-b="all">🔁 다시 열기</button>
      </div>`;
    el.querySelector('[data-b="all"]').onclick = () => Party.buzzReset([]);
    const o = el.querySelector('[data-b="other"]');
    if (o) o.onclick = () => Party.buzzReset([...new Set([...exclude, f.team])]);
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
    const url = `${NET.origin()}/play.html`, qr = NET.qr(url);
    const list = () => [0, 1].map((t) => `
      <div class="tcol ${t ? 'B' : 'A'}" style="min-height:0">
        <div class="tname">${esc(S.teams[t].name)} <small>${Party.members(t).length}명</small></div>
        ${Party.members(t).map((m) => `<button class="tmember" data-a="kick" data-v="${m.id}" style="width:100%;border:0;cursor:pointer">${m.online ? '✅' : '🟡'} ${esc(m.name)}</button>`).join('')}
      </div>`).join('');
    main.innerHTML = `
      <div class="screen">
        <div class="head"><h2>📱 폰 연결</h2><span class="sub">버저·폭탄·캐치마인드·올인을 폰으로</span></div>
        <div class="stage-wrap">
          <div class="stage" style="gap:8px">
            ${qr ? `<div class="qr" style="max-height:70%">${qr}</div>` : ''}
            <div class="pill" style="font-size:clamp(16px,3.4vmin,26px);word-break:break-all">${esc(url)}</div>
          </div>
          <div class="controls">
            <p class="notice" style="margin:0;text-align:center">📱 QR을 찍고 이름과 팀을 고르세요<br>한 번만 하면 행사 내내 쓸 수 있어요</p>
            <p class="sub" style="margin:0;text-align:center;color:var(--muted)">${S.roster ? '팀 나누기 결과대로 이름만 고르면 됩니다.' : '팀 나누기를 먼저 하면 이름만 고르면 돼요.'} 이름을 누르면 접속을 끊을 수 있어요.</p>
            <div class="tboard" id="plist" style="flex:1;min-height:0;overflow:auto">${list()}</div>
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
      home: () => go('home'),
    };
  });
}
