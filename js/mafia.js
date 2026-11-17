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

function encodeGame(g) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(g)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeGame(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}
