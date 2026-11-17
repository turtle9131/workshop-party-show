// 마피아 공용 로직: 진행 폰(index.html)과 참가자 폰(player.html)이 같은 코드로 같은 역할 배정을 계산합니다.
const ROLES = {
  mafia: { n: '마피아', ic: '🔪', d: '밤마다 동료 마피아와 함께 제거할 한 명을 지목합니다. 낮에는 시민인 척 들키지 마세요!' },
  police: { n: '경찰', ic: '🚓', d: '밤마다 한 명을 조사할 수 있어요. 조사 결과는 그때 TV 화면에 나옵니다.' },
  doctor: { n: '의사', ic: '💉', d: '밤마다 한 명을 지목해 마피아의 공격에서 지켜 줍니다. 자기 자신도 지목할 수 있어요.' },
  citizen: { n: '시민', ic: '🙂', d: '특별한 능력은 없지만, 토론과 투표로 마피아를 찾아내세요!' },
};

// g = { c: 게임 코드, n: [이름...], m: 마피아 수, p: 경찰 수, d: 의사 수 }
function mafiaRoles(g) {
  const order = seededOrder(g.n.length, 'mafia', g.c), r = [];
  order.forEach((idx, k) => {
    r[idx] = k < g.m ? 'mafia' : k < g.m + g.p ? 'police' : k < g.m + g.p + g.d ? 'doctor' : 'citizen';
  });
  return r;
}

// 라이어 게임: g = { t: 'liar', c, n, k: 라이어 수, mode: 'normal' | 'fool', cat: 카테고리 또는 '' (라운드마다 랜덤) }
// 라운드 번호만 같으면 진행 폰과 참가자 폰이 같은 제시어·라이어를 계산합니다.
function liarRound(g, r) {
  const cats = Object.keys(LIAR_WORDS);
  // 랜덤 카테고리는 섞인 순서대로 돌아가며 나와서 연속으로 겹치지 않음
  const cat = g.cat && LIAR_WORDS[g.cat] ? g.cat : cats[seededOrder(cats.length, 'liar-cat', g.c)[(r - 1) % cats.length]];
  // 같은 카테고리 안에서도 제시어가 반복되지 않도록 카테고리별 섞인 순서에서 차례로 꺼냄
  const words = LIAR_WORDS[cat], uses = g.cat ? r - 1 : Math.floor((r - 1) / cats.length);
  const wo = seededOrder(words.length, 'liar-word:' + cat, g.c), base = (uses * 2) % words.length;
  const pickW = (i) => words[wo[(base + i) % words.length]];
  const liars = seededOrder(g.n.length, 'liar:' + r, g.c).slice(0, g.k);
  const first = seededOrder(g.n.length, 'liar-first:' + r, g.c)[0];
  return { cat, word: pickW(0), fake: pickW(1), liars, first };
}

function encodeGame(g) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(g)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeGame(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}

// 개인 링크: 전체 명단 없이 그 사람의 역할(마피아면 동료 이름)만 담습니다.
// → 링크를 해석해도 다른 사람의 역할은 알 수 없습니다.
// 반환값 = { c: 게임 코드, n: 이름, r: 역할 키, t: [동료 마피아 이름...] }
function personalGame(g, k) {
  const roles = mafiaRoles(g), r = roles[k];
  const t = r === 'mafia' ? g.n.filter((_, j) => j !== k && roles[j] === 'mafia') : [];
  return { c: g.c, n: g.n[k], r, t };
}
