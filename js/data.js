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
const CHARADES = {
  '예능 레전드 & 유행어': [
    '무야호~', '형이 왜 거기서 나와?', '무대를 뒤집어 놓으셨다', '나만 아니면 돼!', '까나리 액젓 복불복',
    '1박 2일 입수', '런닝맨 이름표 떼기', '무한도전 봅슬레이', '말벌 아저씨', '안녕히 계세요 여러분!',
    '이 차는 이제 제 겁니다', '예쁘면 다냐?', '4딸라', '뿌잉뿌잉', '정준하 쿵쾅쿵쾅',
    '이븐하게 익지 않았어요', '나야, 들기름', '나 혼자 산다 무지개 회원', '먹방 BJ', '1초 표정 연기',
  ],
  '영화·드라마 명장면': [
    '너나 잘하세요', '뭣이 중헌디', '누구냐 넌', '밥은 먹고 다니냐?', '나 다시 돌아갈래!',
    '아들아, 너는 계획이 다 있구나', '니가 가라 하와이', '어이가 없네', '살려는 드릴게', '동작 그만, 밑장 빼기냐?',
    '라면 먹고 갈래요?', '타이타닉 뱃머리', '매트릭스 총알 피하기', '부산행 좀비', '진실의 방으로',
    '무궁화 꽃이 피었습니다', '달고나 뽑기', '짜파구리 먹방', '도깨비 검 뽑기', '폭싹 속았수다',
  ],
  '추억 소환 2000년대': [
    '싸이월드 도토리', '미니홈피 배경음악', '버디버디', '폴더폰 열기', '슬라이드폰',
    'MP3 플레이어', '카세트테이프 연필로 감기', '다마고치', '포켓몬빵 띠부씰', '쫀드기 구워먹기',
    '스타크래프트', '카트라이더', '크레이지 아케이드', 'DDR 펌프', '롤러장 커플 타임',
    '노래방 탬버린', '얼짱 각도 셀카', '인라인 스케이트', '오락실 철권', '문방구 뽑기',
  ],
  '요즘 밈 & 챌린지': [
    '마라탕후루', '슬릭백 챌린지', '럭키비키 (원영적 사고)', 'APT. 아파트 챌린지', '골반이 안 멈추는데 어떡해',
    '칠 가이 (Chill guy)', '퉁퉁퉁 사후르', '두쫀쿠', '케데헌 골든', '중꺾마',
    '오운완', '갓생 살기', '킹받네', '너 T야?', '탕후루 먹방',
    '괜찮아 딩딩딩', '이건 첫 번째 레슨', '허거덩거덩스', '아무노래 챌린지', '장원영 OO',
  ],
  '직장인 공감': [
    '월요병', '칼퇴', '야근', '회식 건배사', '팀장님 호출',
    '연차 결재 올리기', '줌 회의 음소거 안 끔', '출근길 지옥철', '점심 메뉴 고르기', '커피 수혈',
    '최종_진짜최종.pptx', '부장님 개그 리액션', '법인카드 긁기', '퇴사 욕구', '엑셀 야근',
    '재택근무', '월급 로그인 로그아웃', '보고서 빨간펜', '워크샵 장기자랑', '에어컨 온도 전쟁',
  ],
  '스포츠 & 동물 (쉬움)': [
    '손흥민 찰칵 세리머니', '김연아 트리플 악셀', '우사인 볼트 번개', '컬링 영미~!', '펜싱',
    '역도', '서핑', '번지점프', '볼링', '양궁',
    '펭귄', '캥거루', '나무늘보', '치타', '문어',
    '고릴라', '플라밍고', '거북이', '독수리', '코끼리',
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
};

// ── 🎰 벌칙 룰렛 기본값 (설정에서 수정 가능) ─────────────────
const DEFAULT_PENALTIES = [
  '설거지 당첨', '내일 아침 라면 담당', '애교 3종 세트', '옆 사람 어깨 30초 안마', '상대 팀 신청곡 1절',
  '러브샷 지목', '원샷!', '흑역사 썰 풀기', '성대모사 하나', '통과! (면제)',
];
