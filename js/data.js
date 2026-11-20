// 게임 데이터. 이 파일만 수정해서 문제를 바꿀 수 있습니다.

// ── 🎵 1초 노래 퀴즈 ──────────────────────────────────────────
// id: YouTube 영상 ID (youtube.com/watch?v=여기), start: 재생 시작 초
const SONGS = [
  { artist: '원더걸스', title: 'Tell Me', year: 2007, id: '2nxIYH11FhM', start: 0 },
  { artist: '원더걸스', title: 'Nobody', year: 2008, id: '_GhqtSit0Vk', start: 0 },
  { artist: '소녀시대', title: 'Gee', year: 2009, id: '12OHeq-qYwI', start: 0 },
  { artist: '소녀시대', title: '소원을 말해봐', year: 2009, id: '595byJz-obI', start: 0 },
  { artist: '빅뱅', title: '거짓말', year: 2007, id: 'ZwKA-9t3T8E', start: 0 },
  { artist: '빅뱅', title: '하루하루', year: 2008, id: '6I4Ygo0dwRs', start: 0 },
  { artist: '동방신기', title: '주문 (MIROTIC)', year: 2008, id: '9r1lvcI-D6k', start: 0 },
  { artist: '카라', title: '미스터', year: 2009, id: 'OJCXioChJ5w', start: 0 },
  { artist: '2NE1', title: '내가 제일 잘 나가', year: 2011, id: 'n3RH-8T430w', start: 0 },
  { artist: '슈퍼주니어', title: '쏘리 쏘리', year: 2009, id: 'z6mBeFsL1Ao', start: 0 },
  { artist: '샤이니', title: '누난 너무 예뻐', year: 2008, id: 'UyEkTQ0OVXw', start: 0 },
  { artist: '아이유', title: '좋은 날', year: 2010, id: 'V6WWJNpIJN4', start: 0 },
  { artist: '싸이', title: '강남스타일', year: 2012, id: 'y5ggaJEyhzU', start: 0 },
  { artist: '버스커 버스커', title: '벚꽃 엔딩', year: 2012, id: 'jrYIZ9VgmKo', start: 0 },
  { artist: '티아라', title: 'Roly-Poly', year: 2011, id: 'Pws7laZhyP0', start: 0 },
  { artist: '로제 & Bruno Mars', title: 'APT.', year: 2024, id: 'qzDJnlrqNyo', start: 0 },
  { artist: 'HUNTR/X (케이팝 데몬 헌터스)', title: 'Golden', year: 2025, id: 'fPLAgY5bU1Y', start: 0 },
  { artist: 'G-DRAGON', title: 'HOME SWEET HOME', year: 2024, id: 'fLi0EJfi_vg', start: 0 },
  { artist: '우즈 (WOODZ)', title: 'Drowning', year: 2023, id: 'NbKH4iZqq1Y', start: 0 },
  { artist: '에스파', title: 'Supernova', year: 2024, id: 'bkGaDgcDn5I', start: 0 },
  { artist: '브라운아이드걸스', title: 'Abracadabra', year: 2009, id: 'MQqDrgkf8-I', start: 0 },
  { artist: '비', title: '레이니즘', year: 2008, id: 'cRFhSOH2Q9U', start: 0 },
  { artist: '이효리', title: '10 Minutes', year: 2003, id: 'AUXYUFbpD_M', start: 0 },
  { artist: 'god', title: '거짓말', year: 2000, id: 'K057AvbW0PM', start: 0 },
  { artist: '쿨', title: '해변의 여인', year: 1997, id: 'x28aE-d2chY', start: 0 },
  { artist: '버즈', title: '가시', year: 2005, id: '1-Lm2LUR8Ss', start: 0 },
  { artist: '노라조', title: '슈퍼맨', year: 2008, id: 'F6nweq7GexY', start: 0 },
  { artist: '장윤정', title: '어머나', year: 2004, id: 'w5bH9buaoFY', start: 0 },
  { artist: 'EXO', title: '으르렁', year: 2013, id: 'I3dezFzsNss', start: 0 },
  { artist: '빅뱅', title: '뱅뱅뱅', year: 2015, id: 'zhHh3jtjRWI', start: 0 },
  { artist: 'TWICE', title: 'CHEER UP', year: 2016, id: '0a1zTx1R0KE', start: 0 },
  { artist: '방탄소년단', title: '불타오르네', year: 2016, id: 'ZbWo60LyvXc', start: 0 },
  { artist: 'iKON', title: '사랑을 했다', year: 2018, id: 'pd9ijpnkD-Y', start: 0 },
  { artist: '황가람', title: '나는 반딧불', year: 2024, id: 'xL_cd1DJan8', start: 0 },
  { artist: '코르티스 (CORTIS)', title: 'REDRED', year: 2026, id: 'llsR2eTdlI4', start: 0 },
];

// ── 🎬 OST 퀴즈 ──────────────────────────────────────────────
// work: 정답(작품명), type: '드라마' | '영화'
const OST = [
  { type: '드라마', work: '겨울연가', song: '처음부터 지금까지', artist: '류', year: 2002, id: 'eMEAzgdUelQ', start: 0 },
  { type: '드라마', work: '천국의 계단', song: '보고 싶다', artist: '김범수', year: 2003, id: 'hlx3DZQA5PY', start: 0 },
  { type: '드라마', work: '대장금', song: '오나라', artist: '대장금 OST', year: 2003, id: 'NhHftA5JeAc', start: 0 },
  { type: '드라마', work: '모래시계', song: '백학', artist: '이오시프 코브존', year: 1995, id: 'YdUJdvWZIb0', start: 0 },
  { type: '드라마', work: '미안하다 사랑한다', song: '눈의 꽃', artist: '박효신', year: 2004, id: 'isUdfdszLXs', start: 0 },
  { type: '드라마', work: '파리의 연인', song: '너의 곁으로', artist: '조성모', year: 2004, id: 'Bu-EaPkS6W0', start: 0 },
  { type: '드라마', work: '내 이름은 김삼순', song: 'She is', artist: '클래지콰이', year: 2005, id: 'LD4KhOVm9-8', start: 0 },
  { type: '드라마', work: '궁', song: 'Perhaps Love', artist: '하울 & J', year: 2006, id: 'v3SaQZypZ_U', start: 0 },
  { type: '드라마', work: '꽃보다 남자', song: 'Paradise', artist: 'T-Max', year: 2009, id: 'YsRKcKJXQ5A', start: 0 },
  { type: '드라마', work: '시크릿 가든', song: '그 남자', artist: '현빈', year: 2010, id: '0NoMNNVjtLE', start: 0 },
  { type: '드라마', work: '드림하이', song: 'Dream High', artist: '드림하이 출연진', year: 2011, id: 'mtucJNA53Fc', start: 0 },
  { type: '드라마', work: '해를 품은 달', song: '시간을 거슬러', artist: '린', year: 2012, id: 'E4asvdt9B5E', start: 0 },
  { type: '드라마', work: '응답하라 1997', song: 'All For You', artist: '서인국 & 정은지', year: 2012, id: '3Jb_K-8fDLA', start: 0 },
  { type: '드라마', work: '별에서 온 그대', song: 'My Destiny', artist: '린', year: 2013, id: 'pHHLcvOiy0g', start: 0 },
  { type: '드라마', work: '미생', song: '날아', artist: '이승열', year: 2014, id: 'Mvq1FW-HYUQ', start: 0 },
  { type: '드라마', work: '응답하라 1988', song: '소녀', artist: '오혁', year: 2015, id: '43Oh_-A3eI8', start: 0 },
  { type: '드라마', work: '태양의 후예', song: 'ALWAYS', artist: '윤미래', year: 2016, id: 'JdhMyRio_Es', start: 0 },
  { type: '드라마', work: '도깨비', song: 'Stay With Me', artist: '찬열 & 펀치', year: 2016, id: 'fXZwwF0REbc', start: 0 },
  { type: '드라마', work: '나의 아저씨', song: '어른', artist: '손디아', year: 2018, id: 'iqe220lkJzc', start: 0 },
  { type: '드라마', work: '호텔 델루나', song: '그대라는 시', artist: '태연', year: 2019, id: 'Y3qwuJn1Q_M', start: 0 },
  { type: '드라마', work: '사랑의 불시착', song: '마음을 드려요', artist: '아이유', year: 2020, id: 'euI-C1YONaU', start: 0 },
  { type: '드라마', work: '이태원 클라쓰', song: '시작', artist: '가호', year: 2020, id: 'O9aQXFTbCDY', start: 0 },
  { type: '드라마', work: '슬기로운 의사생활', song: '아로하', artist: '조정석', year: 2020, id: 'boPnvWOTtgo', start: 0 },
  { type: '드라마', work: '오징어 게임', song: 'Way Back Then', artist: '정재일', year: 2021, id: 'asQNnQmOVCE', start: 0 },
  { type: '드라마', work: '선재 업고 튀어', song: '소나기', artist: '이클립스', year: 2024, id: 'MQMzMgqcuKk', start: 0 },
  { type: '드라마', work: '눈물의 여왕', song: '청혼하지 않을 이유를 못 찾았어', artist: '이무진', year: 2024, id: '9EZG-k01Lfc', start: 0 },
  { type: '드라마', work: '폭싹 속았수다', song: '밤 산책', artist: '아이유', year: 2025, id: 'VO4f1GGtso0', start: 0 },
  { type: '드라마', work: '보물섬', song: '너를 기다릴게', artist: '이창섭', year: 2025, id: 'JqM9F2c2knM', start: 0 },
  { type: '드라마', work: '언젠가는 슬기로울 전공의생활', song: '영원해', artist: '도경수', year: 2025, id: 'nMKQx73h-uE', start: 0 },
  { type: '드라마', work: '미지의 서울', song: '노을', artist: '10CM', year: 2025, id: 'wiqAi3PijzU', start: 0 },
  { type: '드라마', work: '폭군의 셰프', song: '시간을 넘어 너에게로', artist: '도영', year: 2025, id: 'kzdNFL2fy3A', start: 0 },
  { type: '드라마', work: '태풍상사', song: 'Did You See The Rainbow?', artist: '이준호', year: 2025, id: 'B7VE2iXe580', start: 0 },
  { type: '영화', work: '클래식', song: '너에게 난, 나에게 넌', artist: '자전거 탄 풍경', year: 2003, id: 'bJGLDHa_L2o', start: 0 },
  { type: '영화', work: '타이타닉', song: 'My Heart Will Go On', artist: 'Celine Dion', year: 1997, id: 'p79GmLNLMrY', start: 0 },
  { type: '영화', work: '겨울왕국', song: 'Let It Go', artist: 'Idina Menzel', year: 2013, id: 'FnpJBkAMk44', start: 0 },
  { type: '영화', work: '알라딘', song: 'A Whole New World', artist: 'Brad Kane & Lea Salonga', year: 1992, id: 'xYjFxFFdyyk', start: 0 },
  { type: '영화', work: '해리 포터', song: "Hedwig's Theme", artist: 'John Williams', year: 2001, id: 'wtHra9tFISY', start: 0 },
  { type: '영화', work: '미션 임파서블', song: 'Mission: Impossible Theme', artist: 'Lalo Schifrin', year: 1996, id: 'O07WucFwdq8', start: 0 },
  { type: '영화', work: '캐리비안의 해적', song: "He's a Pirate", artist: 'Klaus Badelt', year: 2003, id: 'BuYf0taXoNw', start: 0 },
  { type: '영화', work: '쥬라기 공원', song: 'Theme From Jurassic Park', artist: 'John Williams', year: 1993, id: 'lDlU08RU7Tk', start: 0 },
  { type: '영화', work: '스타워즈', song: 'Main Title', artist: 'John Williams', year: 1977, id: 'e9lapdvLSGw', start: 0 },
  { type: '영화', work: '라라랜드', song: 'City of Stars', artist: 'Ryan Gosling', year: 2016, id: 'q9TQFZJ2biM', start: 0 },
  { type: '영화', work: '비긴 어게인', song: 'Lost Stars', artist: 'Adam Levine', year: 2014, id: '5U-JroWwFkw', start: 0 },
  { type: '영화', work: '어벤져스', song: 'The Avengers', artist: 'Alan Silvestri', year: 2012, id: 'XNCQZ0wxphY', start: 0 },
  { type: '영화', work: '007 시리즈', song: 'James Bond Theme', artist: 'Monty Norman', year: 1962, id: 'OazkZUzzpb0', start: 0 },
  { type: '영화', work: '탑건', song: 'Danger Zone', artist: 'Kenny Loggins', year: 1986, id: 'yK0P1Bk8Cx4', start: 0 },
  { type: '영화', work: '록키', song: 'Gonna Fly Now', artist: 'Bill Conti', year: 1976, id: 'AxWejrVYcCg', start: 0 },
  { type: '영화', work: '고스트버스터즈', song: 'Ghostbusters', artist: 'Ray Parker Jr.', year: 1984, id: 'TaV1r341wYk', start: 0 },
  { type: '영화', work: '토이 스토리', song: "You've Got a Friend in Me", artist: 'Randy Newman', year: 1995, id: '1MPZRcyTrcU', start: 0 },
  { type: '영화', work: '라이온 킹', song: 'Circle of Life', artist: 'Carmen Twillie, Lebo M.', year: 1994, id: 'GibiNy4d4gc', start: 0 },
  { type: '영화', work: '인터스텔라', song: 'Cornfield Chase', artist: 'Hans Zimmer', year: 2014, id: 'JuSsvM8B4Jc', start: 0 },
];

// ── 📸 확대 사진 퀴즈 ─────────────────────────────────────────
// fx, fy: 얼굴 위치(%) — 이 지점을 중심으로 확대됩니다.
// 사진 출처: Wikimedia Commons (각 파일의 CC 라이선스)
const CELEBS = [
  { name: '수지', file: 'bae-suzy.jpg', fx: 45, fy: 25 },
  { name: '변우석', file: 'byeon-woo-seok.jpg', fx: 50, fy: 18 },
  { name: '차은우', file: 'cha-eun-woo.jpg', fx: 50, fy: 22 },
  { name: '조세호', file: 'cho-sae-ho.jpg', fx: 45, fy: 32 },
  { name: 'G-DRAGON', file: 'g-dragon.jpg', fx: 45, fy: 28 },
  { name: '공유', file: 'gong-yoo.jpg', fx: 50, fy: 22 },
  { name: '하하', file: 'haha-entertainer.jpg', fx: 45, fy: 25 },
  { name: '한소희', file: 'han-so-hee.jpg', fx: 45, fy: 25 },
  { name: '황정민', file: 'hwang-jung-min.jpg', fx: 50, fy: 18 },
  { name: '현빈', file: 'hyun-bin.jpg', fx: 42, fy: 16 },
  { name: '아이유', file: 'iu-entertainer.jpg', fx: 50, fy: 20 },
  { name: '장원영', file: 'jang-won-young.jpg', fx: 45, fy: 20 },
  { name: '제니', file: 'jennie-singer.jpg', fx: 45, fy: 18 },
  { name: '전현무', file: 'jun-hyun-moo.jpg', fx: 50, fy: 35 },
  { name: '전지현', file: 'jun-ji-hyun.jpg', fx: 45, fy: 15 },
  { name: '정형돈', file: 'jung-hyung-don.jpg', fx: 42, fy: 20 },
  { name: '정우성', file: 'jung-woo-sung.jpg', fx: 45, fy: 15 },
  { name: '강호동', file: 'kang-ho-dong.jpg', fx: 50, fy: 20 },
  { name: '김고은', file: 'kim-go-eun.jpg', fx: 35, fy: 20 },
  { name: '김혜수', file: 'kim-hye-soo.jpg', fx: 45, fy: 18 },
  { name: '김종국', file: 'kim-jong-kook.jpg', fx: 45, fy: 16 },
  { name: '김수현', file: 'kim-soo-hyun.jpg', fx: 45, fy: 20 },
  { name: '김태희', file: 'kim-tae-hee.jpg', fx: 50, fy: 25 },
  { name: '이병헌', file: 'lee-byung-hun.jpg', fx: 35, fy: 20 },
  { name: '이찬원', file: 'lee-chan-won.jpg', fx: 45, fy: 12 },
  { name: '이효리', file: 'lee-hyori.jpg', fx: 50, fy: 12 },
  { name: '이정재', file: 'lee-jung-jae.jpg', fx: 50, fy: 15 },
  { name: '이광수', file: 'lee-kwang-soo.jpg', fx: 45, fy: 15 },
  { name: '이민호', file: 'lee-min-ho.jpg', fx: 55, fy: 18 },
  { name: '마동석', file: 'ma-dong-seok.jpg', fx: 50, fy: 15 },
  { name: '노홍철', file: 'noh-hong-chul.jpg', fx: 55, fy: 40 },
  { name: '박보검', file: 'park-bo-gum.jpg', fx: 50, fy: 25 },
  { name: '박지성', file: 'park-ji-sung.jpg', fx: 50, fy: 25 },
  { name: '박명수', file: 'park-myung-soo.jpg', fx: 55, fy: 25 },
  { name: '박서준', file: 'park-seo-joon.jpg', fx: 50, fy: 15 },
  { name: '비 (정지훈)', file: 'rain-entertainer.jpg', fx: 45, fy: 15 },
  { name: '소지섭', file: 'so-ji-sub.jpg', fx: 35, fy: 20 },
  { name: '손흥민', file: 'son-heung-min.jpg', fx: 50, fy: 20 },
  { name: '손예진', file: 'son-ye-jin.jpg', fx: 50, fy: 15 },
  { name: '송혜교', file: 'song-hye-kyo.jpg', fx: 45, fy: 17 },
  { name: '송강호', file: 'song-kang-ho.jpg', fx: 50, fy: 20 },
  { name: '원빈', file: 'won-bin.jpg', fx: 50, fy: 18 },
  { name: '유해진', file: 'yoo-hae-jin.jpg', fx: 45, fy: 15 },
  { name: '유재석', file: 'yoo-jae-suk.jpg', fx: 50, fy: 20 },
  { name: '김연아', file: 'yuna-kim.jpg', fx: 50, fy: 12 },
  { name: '조인성', file: 'zo-in-sung.jpg', fx: 45, fy: 18 },
];

// ── 🎭 몸으로 말해요 / 고요 속의 외침 ─────────────────────────
// 몸으로 말해요: 몸짓으로 바로 표현되는 쉬운 한 단어 (카테고리끼리 겹치지 않게)
const CHARADES = {
  '동물': [
    '펭귄', '캥거루', '고릴라', '코끼리', '토끼', '원숭이', '뱀', '닭', '오리', '개구리',
    '사자', '기린', '거북이', '문어', '게', '나비', '독수리', '강아지', '고양이', '돼지',
  ],
  '스포츠': [
    '축구', '농구', '야구', '배구', '탁구', '테니스', '골프', '볼링', '수영', '권투',
    '태권도', '양궁', '스키', '펜싱', '역도', '줄넘기', '씨름', '유도', '서핑', '마라톤',
  ],
  '직업': [
    '의사', '경찰', '소방관', '요리사', '미용사', '가수', '발레리나', '군인', '택배기사', '사진사',
    '지휘자', '마술사', '간호사', '선생님', '조종사', '농부', '어부', '승무원', '래퍼', '아나운서',
  ],
  '일상 동작': [
    '양치질', '세수', '샤워', '화장', '면도', '빨래', '청소', '설거지', '다림질', '운전',
    '낚시', '등산', '하품', '재채기', '박수', '셀카', '요가', '춤', '달리기', '잠',
  ],
  '물건·악기': [
    '우산', '가위', '망치', '전화기', '카메라', '피아노', '기타', '드럼', '자전거', '빗자루',
    '청소기', '냉장고', '안경', '거울', '시계', '풍선', '칫솔', '선풍기', '리모컨', '프라이팬',
  ],
  '음식': [
    '라면', '피자', '치킨', '김밥', '수박', '바나나', '아이스크림', '떡볶이', '햄버거', '솜사탕',
    '팝콘', '삼겹살', '짜장면', '핫도그', '옥수수', '사과', '레몬', '붕어빵', '계란', '케이크',
  ],
};

// ── 🎨 캐치마인드 ────────────────────────────────────────────
const DRAW_WORDS = [
  '탕후루', '두쫀쿠', '오징어 게임', '강남스타일', '펭귄', '에펠탑', '해리포터', '스파이더맨', '피카츄', '도라에몽',
  '짜파구리', '치맥', '소맥', '노래방', '월요병', '칼퇴', '불꽃놀이', '캠핑', '삼겹살', '눈사람',
  '로봇청소기', '에어팟', '셀카봉', '마라탕', '붕어빵', '호떡', '롤러코스터', '무지개', '선풍기', '김연아',
  '기린', '문어', '해적선', '화산', '우주비행사', '캥거루', '산타클로스', '다마고치', '폴더폰', '싸이월드 미니미',
  '자유의 여신상', '피라미드', '인어공주', '백설공주', '슈퍼마리오', '짱구', '스폰지밥', '헬로키티', '엘사', '뽀로로',
];

// ── 💣 폭탄 돌리기 카테고리 ──────────────────────────────────
const BOMB_CATEGORIES = [
  '과자 이름', '라면 이름', '치킨 브랜드', '아이돌 그룹', '서울 지하철역', '술 이름', '과일', '나라 이름',
  '수도 이름', '자동차 브랜드', '커피 프랜차이즈', '편의점 음식', '한국 드라마 제목', '천만 영화', '세 글자 동물',
  '"사"로 시작하는 단어', '"기"로 끝나는 단어', '축구 선수', '프로야구 팀', '스마트폰 앱', '예능 프로그램',
  '신발·옷 브랜드', '회사에서 자주 하는 말', '포켓몬 이름', '디즈니 캐릭터', '분식 메뉴', '찌개·탕 메뉴',
  '술게임 이름', '연예인 부부', '유재석 별명', '빅뱅·2NE1·소녀시대 멤버', '아이스크림 이름',
];

// ── 🔥 올인 역전 퀴즈 ────────────────────────────────────────
const ALLIN = [
  { q: '소녀시대의 데뷔곡 제목은?', a: '다시 만난 세계 (2007)' },
  { q: '아이유의 데뷔곡 제목은?', a: '미아 (2008)' },
  { q: '빅뱅 원년 멤버 5명의 이름을 모두 말하면?', a: 'G-DRAGON · 태양 · T.O.P · 대성 · 승리' },
  { q: '싸이월드에서 쓰던 사이버 머니의 이름은?', a: '도토리' },
  { q: '2002 한일 월드컵에서 대한민국의 최종 순위는?', a: '4위' },
  { q: '김연아가 올림픽 금메달을 딴 대회가 열린 도시는?', a: '밴쿠버 (2010)' },
  { q: '대한민국 최초의 천만 관객 영화는?', a: '실미도' },
  { q: "god '어머님께' 가사 속 어머님이 싫다고 하신 음식은?", a: '짜장면' },
  { q: '1박 2일 복불복의 대표 벌칙 음료는?', a: '까나리 액젓' },
  { q: '영화 기생충이 아카데미 작품상을 받은 연도는?', a: '2020년' },
  { q: '오징어 게임 1화의 첫 번째 게임은?', a: '무궁화 꽃이 피었습니다' },
  { q: "'응답하라 1988'에서 덕선이의 남편은 누구? (배역 이름)", a: '최택 (박보검)' },
  { q: '다음 중 무한도전 고정 멤버가 아니었던 사람은? 유재석 · 박명수 · 강호동 · 정준하', a: '강호동' },
  { q: "원더걸스 'Tell Me'가 발매된 연도는?", a: '2007년' },
  { q: '카카오톡이 처음 출시된 연도는?', a: '2010년' },
  { q: "싸이 '강남스타일' 뮤직비디오가 유튜브 최초로 돌파한 조회수는?", a: '10억 뷰' },
];

// ── 🔤 초성 퀴즈 ─────────────────────────────────────────────
const CHOSUNG = {
  '영화': [
    '기생충', '올드보이', '범죄도시', '부산행', '극한직업', '타짜', '괴물', '베테랑', '암살', '명량',
    '신세계', '친구', '왕의 남자', '해운대', '국제시장', '7번방의 선물', '과속스캔들', '광해', '서울의 봄', '파묘',
  ],
  '드라마': [
    '오징어 게임', '도깨비', '태양의 후예', '응답하라 1988', '사랑의 불시착', '더 글로리', '이태원 클라쓰', '미생', '대장금', '꽃보다 남자',
    '시크릿 가든', '별에서 온 그대', '선재 업고 튀어', '눈물의 여왕', '폭싹 속았수다', '슬기로운 의사생활', '무빙', '나의 아저씨', 'SKY 캐슬', '펜트하우스',
  ],
  '연예인': [
    '유재석', '강호동', '신동엽', '이효리', '아이유', '장원영', '손흥민', '김연아', '마동석', '송강호',
    '박명수', '노홍철', '정형돈', '전현무', '김종국', '이광수', '조세호', '하하', '박나래', '김구라',
  ],
  '음식': [
    '떡볶이', '짜장면', '짬뽕', '탕수육', '삼겹살', '김치찌개', '된장찌개', '마라탕', '탕후루', '두바이 쫀득쿠키',
    '양념치킨', '족발', '보쌈', '부대찌개', '순댓국', '물냉면', '비빔밥', '불고기', '닭갈비', '붕어빵',
  ],
  '예능 프로그램': [
    '무한도전', '런닝맨', '1박 2일', '나 혼자 산다', '라디오스타', '놀면 뭐하니', '신서유기', '강심장', '해피투게더', '개그콘서트',
    '전지적 참견 시점', '삼시세끼', '윤식당', '흑백요리사', '복면가왕', '아는 형님', '대탈출', '나는 솔로', '미운 우리 새끼', '지구오락실',
  ],
  '브랜드·앱': [
    '스타벅스', '맥도날드', '버거킹', '배달의민족', '카카오톡', '네이버', '삼성전자', '쿠팡', '당근마켓', '다이소',
    '올리브영', '이마트', '무신사', '넷플릭스', '유튜브', '인스타그램', '토스', '야놀자', '파리바게뜨', '교촌치킨',
  ],
  'MZ 용어': [
    '갓생', '존버', '킹받네', '중꺾마', '오운완', '점메추', '별다줄', '어쩔티비', '알잘딱깔센', '스불재',
    '갑분싸', '얼죽아', '꾸안꾸', '억텐', '소확행', '워라밸', '팩폭', '자만추', '사바사', '머선129',
  ],
};
// 정답 공개 때 함께 보여 줄 뜻 (초성 퀴즈 화면·사회자 폰·정답지)
const CHOSUNG_MEANING = {
  '갓생': '부지런하고 생산적으로 사는 삶', '존버': '끝까지 버티기', '킹받네': '열받네 (킹 + 열받네)',
  '중꺾마': '중요한 건 꺾이지 않는 마음', '오운완': '오늘 운동 완료', '점메추': '점심 메뉴 추천',
  '별다줄': '별걸 다 줄인다', '어쩔티비': '어쩌라고 (가서 TV나 봐)', '알잘딱깔센': '알아서 잘, 딱 깔끔하고 센스 있게',
  '스불재': '스스로 불러온 재앙', '갑분싸': '갑자기 분위기 싸해짐', '얼죽아': '얼어 죽어도 아이스 아메리카노',
  '꾸안꾸': '꾸민 듯 안 꾸민 듯', '억텐': '억지 텐션', '소확행': '작지만 확실한 행복',
  '워라밸': '워크 앤 라이프 밸런스 (일과 삶의 균형)', '팩폭': '팩트 폭력', '자만추': '자연스러운 만남 추구',
  '사바사': '사람 바이 사람 (사람마다 다름)', '머선129': '무슨 일이고 (사투리 말장난)',
};

// ── 🤥 라이어 게임 제시어 ────────────────────────────────────
const LIAR_WORDS = {
  '음식': ['떡볶이', '짜장면', '삼겹살', '치킨', '피자', '김치찌개', '라면', '초밥', '마라탕', '햄버거', '냉면', '비빔밥', '족발', '탕후루', '붕어빵', '곱창', '김밥', '돈가스', '쌀국수', '샤브샤브'],
  '동물': ['강아지', '고양이', '호랑이', '코끼리', '기린', '펭귄', '판다', '원숭이', '토끼', '거북이', '상어', '돌고래', '캥거루', '나무늘보', '햄스터', '독수리', '문어', '사자', '얼룩말', '고슴도치'],
  '장소': ['학교', '병원', '공항', '찜질방', '노래방', 'PC방', '편의점', '놀이공원', '도서관', '헬스장', '캠핑장', '영화관', '동물원', '수영장', '결혼식장', '군대', '지하철', '은행', '미용실', '스키장'],
  '직업': ['의사', '경찰', '소방관', '선생님', '요리사', '유튜버', '아이돌', '변호사', '택배기사', '간호사', '군인', '파일럿', '개발자', '미용사', '농부', '운동선수', '기자', '배우', '바리스타', '마술사'],
  '영화·드라마': ['기생충', '타이타닉', '해리 포터', '어벤져스', '겨울왕국', '오징어 게임', '부산행', '범죄도시', '도깨비', '응답하라 1988', '극한직업', '쥬라기 공원', '라이온 킹', '태양의 후예', '토이 스토리', '타짜', '인터스텔라', '더 글로리', '알라딘', '명량'],
  '스포츠': ['축구', '야구', '농구', '배구', '골프', '테니스', '수영', '마라톤', '볼링', '스키', '탁구', '양궁', '태권도', '복싱', '피겨스케이팅', '컬링', '당구', '클라이밍', '서핑', '배드민턴'],
  '물건': ['스마트폰', '냉장고', '우산', '안경', '칫솔', '노트북', '에어컨', '선풍기', '이어폰', '지갑', '시계', '거울', '베개', '전자레인지', '드라이기', '자전거', '텀블러', '리모컨', '마스크', '캐리어'],
  '연예인': ['유재석', '아이유', '손흥민', '김연아', '마동석', '이효리', '강호동', 'BTS', '장원영', '송강호', '박명수', '제니', '임영웅', '조세호', '차은우', '박보검', '전현무', '김종국', '이광수', '송혜교'],
};

// ── 🎰 벌칙 룰렛 기본값 (설정에서 수정 가능) ─────────────────
const DEFAULT_PENALTIES = [
  '설거지 당첨', '내일 아침 라면 담당', '애교 3종 세트', '옆 사람 어깨 30초 안마', '상대 팀 신청곡 1절',
  '러브샷 지목', '원샷!', '흑역사 썰 풀기', '성대모사 하나', '통과! (면제)',
];

// 📺 다음 장면 맞히기: start초부터 틀어서 stop초에 멈춤 → 보기 3개 중 다음 장면 맞히기 → 정답 공개 때 rs(없으면 stop)~end초 재생
// 멈춤 시간은 영상 화면을 직접 확인해서 "결정적 순간 직전, 자막이 정답을 말하기 전"으로 맞춤. a = 정답 보기 번호(0부터)
// 국내 영상을 먼저, 외국 영상은 뒤에. 진행 화면의 [✏️ 영상 추가]로 직접 만든 문제는 이 뒤에 붙습니다.
const SCENES = [
  { id: 'pTux20Yl3yE', name: '무야호 (무한도전 알래스카)', start: 262, stop: 269.5, end: 282,
    q: '무한도전 알래스카 편. 한인회관에서 만난 어르신이 기분 좋게 외친 한마디는?',
    opts: ['대~한민국!', '무야호~!', '만세~!'], a: 1 },
  { id: 'mAz62Uckwsc', name: '김치 싸대기 (아침드라마)', start: 12, stop: 24, end: 40,
    q: '버릇없는 남자에게 단단히 화가 난 엄마. 다음 장면은?',
    opts: ['김치를 입에 쏙 넣어 준다', '김치로 뺨을 철썩 때린다', '김치를 바닥에 내동댕이친다'], a: 1 },
  { id: 'y3HQowZ9K4U', name: '한강 얼음 위 정형돈 (무한도전)', start: 0, stop: 11.5, end: 18.5,
    q: '추운 겨울밤, 꽁꽁 언 한강 둔치로 성큼성큼 걸어가는 정형돈. 다음 장면은?',
    opts: ['얼음이 깨져 물에 빠진다', '추워서 바로 차로 돌아간다', '얼음에 미끄러져 꽈당!'], a: 2 },
  { id: 'CUSzQCYcEEI', name: '눈사람 된 박대기 기자 (KBS 뉴스)', start: 0, stop: 8, rs: 38, end: 52,
    q: '폭설 속에서 생중계 중인 기자. 시간이 지나면 기자의 모습은?',
    opts: ['온몸에 눈이 쌓여 눈사람처럼 된다', '우산을 쓰고 다시 나타난다', '스튜디오로 철수해서 중계한다'], a: 0 },
  { id: 'IWtY2wnKExM', name: '재채기하는 아기 판다', start: 2, stop: 12, end: 19,
    q: '엄마 판다 옆에서 꼬물거리는 아기 판다. 잠시 후 무슨 일이?',
    opts: ['아기가 엄마 품으로 기어 들어간다', '엄마가 아기를 번쩍 안아 올린다', '아기가 재채기를 해서 엄마가 화들짝 놀란다'], a: 2 },
  { id: 'ZIQiiG6i09A', name: '오이를 본 고양이', start: 0, stop: 8, end: 13,
    q: '밥 먹는 고양이 뒤에 몰래 오이를 놓았다. 돌아본 고양이는?',
    opts: ['깜짝 놀라 펄쩍 뛰어오른다', '오이를 냠냠 먹는다', '오이를 베고 드러눕는다'], a: 0 },
  { id: 'STbhaqsBJB0', name: '포도 밟다 넘어진 리포터', start: 8, stop: 17, end: 30,
    q: '생방송으로 포도 밟기 체험 중인 리포터. 다음 장면은?',
    opts: ['포도즙을 직접 떠서 마셔 본다', '통 밖으로 넘어져 떨어진다', '신나서 통 안에서 춤을 춘다'], a: 1 },
  { id: 'K0DmtmmFEVo', name: '수영장 옆 결혼식', start: 15, stop: 25, end: 43,
    q: '수영장 옆에서 결혼식 중. 들러리가 반지를 건네려는 순간!',
    opts: ['신랑이 감동해서 눈물을 흘린다', '반지를 잃어버려 다 같이 찾는다', '신부가 수영장에 풍덩 빠진다'], a: 2 },
];
