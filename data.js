// 2026 결산 초기 데이터
// status: "완료" | "보는중" | "중도하차"
// poster, broadcaster, cast, synopsis 는 사용자가 카드의 "편집" 버튼으로 직접 채워넣을 수 있습니다.

const INITIAL_DATA = {
  dramas: [
    { id: "d1", title: "프로보노", status: "완료", order: 1 },
    { id: "d2", title: "기묘한 이야기 시즌5", status: "완료", order: 2 },
    { id: "d3", title: "자백의 대가", status: "완료", order: 3 },
    { id: "d4", title: "당신이 죽였다", status: "완료", order: 4 },
    { id: "d5", title: "언더커버 미쓰홍", status: "완료", order: 5 },
    { id: "d6", title: "브리저튼 시즌4", status: "완료", order: 6 },
    { id: "d7", title: "샬럿 왕비 : 브리저튼 외전", status: "완료", order: 7 },
    { id: "d8", title: "레이디 두아", status: "완료", order: 8 },
    { id: "d9", title: "프렌즈 시즌1", status: "완료", order: 9 },
    { id: "d10", title: "사랑의 이해", status: "완료", order: 10 },
    { id: "d11", title: "은중과 상연", status: "완료", order: 11 },
    { id: "d12", title: "월간남친", status: "완료", order: 12 },
    { id: "d13", title: "닥터신", status: "완료", order: 13 },
    { id: "d14", title: "샤이닝", status: "완료", order: 14 },
    { id: "d15", title: "유미의 세포들3", status: "완료", order: 15 },
    { id: "d16", title: "허수아비", status: "완료", order: 16 },
    { id: "d17", title: "멋진 신세계", status: "완료", order: 17 },
    { id: "d18", title: "프렌즈 시즌2", status: "완료", order: 18 },
    { id: "d19", title: "옥씨부인전", status: "완료", order: 19 },
    { id: "d20", title: "백번의추억", status: "완료", order: 20 },
    { id: "d21", title: "맨 끝줄 소년", status: "완료", order: 21 },
    { id: "d22", title: "결혼의 완성", status: "보는중", order: 22 },
    { id: "d23", title: "더 글로리", status: "보는중", order: 23 },
    { id: "d24", title: "동궁", status: "보는중", order: 24 },
    { id: "d25", title: "메이드 인 코리아", status: "중도하차", order: 25 },
    { id: "d26", title: "은애하는 도적님아", status: "중도하차", order: 26 },
    { id: "d27", title: "은밀한 감사", status: "중도하차", order: 27 },
    { id: "d28", title: "취사병 전설이 되다", status: "중도하차", order: 28 },
    { id: "d29", title: "신입사원 강회장", status: "중도하차", order: 29 },
    { id: "d30", title: "참교육", status: "중도하차", order: 30 },
    { id: "d31", title: "김부장", status: "중도하차", order: 31 }
  ],

  shows: [
    { id: "s1", title: "흑백요리사2", status: "완료", order: 1 },
    { id: "s2", title: "냉장고를 부탁해", status: "완료", order: 2 },
    { id: "s3", title: "풍향고 시즌2", status: "완료", order: 3 },
    { id: "s4", title: "스카이스크레이퍼 라이브 : 초고층 빌딩을 오르다", status: "완료", order: 4 },
    { id: "s5", title: "제프리 앱스타인 : 괴물이 된 억만장자", status: "완료", order: 5 },
    { id: "s6", title: "철학자의 요리", status: "완료", order: 6 },
    { id: "s7", title: "더 코리안 셰프", status: "완료", order: 7 },
    { id: "s8", title: "이서진의 달라달라", status: "완료", order: 8 },
    { id: "s9", title: "유퀴즈온더블록", status: "완료", order: 9 },
    { id: "s10", title: "공양간의 셰프들", status: "완료", order: 10 },
    { id: "s11", title: "다큐3일", status: "완료", order: 11 },
    { id: "s12", title: "마이클잭슨 재판 : 평결", status: "완료", order: 12 },
    { id: "s13", title: "콩콩팜팜", status: "보는중", order: 13 },
    { id: "s14", title: "언더커버 셰프", status: "보는중", order: 14 },
    { id: "s15", title: "모태솔로지만 연애는 하고싶어2", status: "보는중", order: 15 },
    { id: "s16", title: "스트릿 레스토랑 파이터", status: "보는중", order: 16 }
  ],

  movies: [
    { id: "m1", order: 1, title: "위대한 쇼맨", type: "OTT" },
    { id: "m2", order: 2, title: "아바타3", type: "영화관" },
    { id: "m3", order: 3, title: "강다니엘 - 홀드 유어 브레스", type: "영화관" },
    { id: "m4", order: 4, title: "어쩔 수가 없다", type: "OTT" },
    { id: "m5", order: 5, title: "비포 선라이즈", type: "OTT" },
    { id: "m6", order: 6, title: "왕과 사는 남자", type: "영화관" },
    { id: "m7", order: 7, title: "파반느", type: "OTT" },
    { id: "m8", order: 8, title: "만약에 우리", type: "OTT" },
    { id: "m9", order: 9, title: "워 머신 : 전쟁 기계", type: "OTT" },
    { id: "m10", order: 10, title: "프로젝트 헤일메리", type: "영화관" },
    { id: "m11", order: 11, title: "아노라", type: "OTT" },
    { id: "m12", order: 12, title: "레이디스 퍼스트 : 거꾸로 가는 남자", type: "OTT" },
    { id: "m13", order: 13, title: "세계의 주인", type: "OTT" },
    { id: "m14", order: 14, title: "토이스토리5", type: "영화관" },
    { id: "m15", order: 15, title: "호프", type: "영화관" }
  ],

  // distanceKm 은 대략적인 편도 거리(참고용 추정치)입니다.
  travels: [
    {
      id: "t1", startDate: "2026-01-12", endDate: "2026-01-13",
      destination: "묵호·강릉", transport: "KTX", international: false,
      companions: "묵호: 다영 / 강릉: 혼자", solo: false, distanceKm: 200
    },
    {
      id: "t2", startDate: "2026-01-27", endDate: "2026-01-30",
      destination: "제주", transport: "비행기", international: false,
      companions: "혼자", solo: true, distanceKm: 449
    },
    {
      id: "t3", startDate: "2026-02-04", endDate: "2026-02-05",
      destination: "광주", transport: "비행기", international: false,
      companions: "제시", solo: false, distanceKm: 267
    },
    {
      id: "t4", startDate: "2026-02-09", endDate: "2026-02-09",
      destination: "경주", transport: "KTX", international: false,
      companions: "혼자", solo: true, distanceKm: 352
    },
    {
      id: "t5", startDate: "2026-04-25", endDate: "2026-04-26",
      destination: "양평 (템플스테이)", transport: "자차", international: false,
      companions: "태인", solo: false, distanceKm: 60
    },
    {
      id: "t6", startDate: "2026-05-30", endDate: "2026-05-31",
      destination: "순천", transport: "KTX", international: false,
      companions: "제시", solo: false, distanceKm: 348
    },
    {
      id: "t7", startDate: "2026-07-29", endDate: "2026-08-01",
      destination: "제주", transport: "비행기", international: false,
      companions: "서연, 은경, 제시", solo: false, distanceKm: 449
    },
    {
      id: "t8", startDate: "2026-10-16", endDate: "2026-10-18",
      destination: "나트랑", transport: "비행기", international: true,
      companions: "현진, 서연, 제시", solo: false, distanceKm: 2900
    },
    {
      id: "t9", startDate: "2026-11-20", endDate: "2026-11-26",
      destination: "멜버른", transport: "비행기", international: true,
      companions: "제시", solo: false, distanceKm: 8058
    }
  ],

  performances: [
    {
      id: "p1", date: "2026-04-04", title: "박효신 콘서트 <LIVE A&E 2026>",
      venue: "인천 문학경기장 주경기장", price: 205700,
      seat: "좌석정보 추후 업데이트", companions: "혼자", solo: true,
      link: "https://ticket.melon.com/performance/index.htm?prodId=212757"
    },
    {
      id: "p2", date: "2026-04-05", title: "박효신 콘서트 <LIVE A&E 2026>",
      venue: "인천 문학경기장 주경기장", price: 224000,
      seat: "현장수령 Floor층 5R구역 15열 10번", companions: "혼자", solo: true,
      link: "https://ticket.melon.com/performance/index.htm?prodId=212757"
    },
    {
      id: "p3", date: "2026-04-11", title: "박효신 콘서트 <LIVE A&E 2026>",
      venue: "인천 문학경기장 주경기장", price: 224000,
      seat: "현장수령 Floor층 1구역 5열 19번", companions: "혼자", solo: true,
      link: "https://ticket.melon.com/performance/index.htm?prodId=212757"
    },
    {
      id: "p4", date: "2026-04-18", title: "패닉 콘서트 <PANIC IS COMING>",
      venue: "LG아트센터 서울 LG SIGNATURE홀", price: 156000,
      seat: "3층 05열 27번", companions: "은경", solo: false,
      link: "https://tickets.interpark.com/goods/L0000137"
    },
    {
      id: "p5", date: "2026-05-03", title: "이소라 여덟 번째 봄 콘서트 '봄의 미로'",
      venue: "경희대학교 평화의전당", price: 115700,
      seat: "3층 D열 199번", companions: "혼자", solo: true,
      link: "https://www.ticketlink.co.kr/product/62098",
      setlist: [
        ["바라봄", "Track9", "Fortuneteller", "나를 사랑하지 않는 그대에게", "사랑이 아니라고 하지 말아요"],
        ["그대가 이렇게 내맘에", "봄", "별", "Track 11"],
        ["나를 사랑하지않는그대에게", "그대와춤을", "청혼"],
        ["Track 3"],
        ["믿음", "Tears", "난행복해", "처음느낌그대로"],
        ["바람이분다", "순수의시절"],
        ["내곁에서 떠나가지말아요"]
      ]
    },
    {
      id: "p6", date: "2026-06-10", title: "뮤지컬 베토벤",
      venue: "세종문화회관 대극장", price: 56000,
      seat: "좌석정보 추후 업데이트", companions: "혼자", solo: true,
      link: "https://ticket.melon.com/performance/index.htm?prodId=213078"
    },
    {
      id: "p7", date: "2026-06-10", title: "뮤지컬 베토벤",
      venue: "세종문화회관 대극장", price: 80000,
      seat: "B석 3층 D열 30번", companions: "혼자", solo: true,
      link: "https://ticket.melon.com/performance/index.htm?prodId=213078"
    },
    {
      id: "p8", date: "2026-07-16", title: "피아니스트 조성진 체임버 콘서트",
      venue: "부천아트센터 콘서트홀", price: 101500,
      seat: "3층 R구역 01열 05번", companions: "현진", solo: false,
      link: "https://www.bac.or.kr/product/ko/performance/253440",
      setlist: [
        ["브람스 (J. Brahms)"],
        ["클라리넷, 첼로와 피아노를 위한 트리오 a단조, Op.114", "1. Allegro", "2. Adagio", "3. Andantino grazioso", "4. Allegro"],
        ["바이올린, 호른과 피아노를 위한 트리오 Eb장조, Op.40", "1. Andante", "2. Scherzo. Allegro - Molto meno Allegro", "3. Adagio mesto", "4. Finale. Allegro con brio"],
        ["인터미션(Intermission)"],
        ["피아노 콰르텟 1번 g단조, Op.25", "1. Allegro", "2. Intermezzo. Allegro, ma non troppo - Trio. Animato", "3. Andante con moto", "4. Rondo all Zingarese. Presto"]
      ]
    }
  ]
};
