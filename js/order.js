// 문제 순서 고정: 같은 '문제 세트 번호'면 게임 화면과 정답지(answers.html)의 순서가 항상 같습니다.
function seededOrder(n, key, set) {
  let h = 2166136261;
  for (const ch of `${set}:${key}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  const rand = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const o = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

// 게임별 문제 목록 (정답지와 게임이 함께 사용)
const OST_FILTERS = ['전체', '드라마', '영화'];
const ostList = (f) => (f && f !== '전체' ? OST.filter((s) => s.type === f) : OST);
const CHOSUNG_CATS = ['전체', ...Object.keys(CHOSUNG)];
const chosungList = (cat) => (cat === '전체' ? Object.entries(CHOSUNG) : [[cat, CHOSUNG[cat]]]).flatMap(([c, ws]) => ws.map((w) => ({ c, w })));
