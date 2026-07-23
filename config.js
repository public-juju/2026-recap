// Supabase 연결 설정
//
// 1) https://supabase.com 에서 무료 프로젝트를 만드세요.
// 2) 프로젝트의 "Project Settings > API" 메뉴에서
//    - Project URL
//    - anon public key
//    두 값을 복사해서 아래에 붙여넣으세요.
// 3) README.md의 SQL을 Supabase의 "SQL Editor"에서 한 번 실행해 테이블을 만들어주세요.
//
// 값을 비워두면 앱은 자동으로 이 브라우저의 localStorage만 사용합니다
// (이전과 동일하게 동작하며, 다른 기기와는 동기화되지 않아요).

const SUPABASE_URL = "https://iytyrrjgldnmkaizkumd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5dHlycmpnbGRubWthaXprdW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3OTIzMTEsImV4cCI6MjEwMDM2ODMxMX0.a3MOceCMy2-2HAXpcg3ehzAZvh3qDE9qIEotSUOuE9Y";

// TMDB(The Movie Database) API 키 — 드라마/예능/영화 편집창의
// "🔎 TMDB에서 정보 가져오기" 버튼으로 포스터·출연진·줄거리를 자동으로 불러올 때 사용해요.
// https://www.themoviedb.org 가입 후 Settings > API 에서 무료로 발급받을 수 있어요 (v3 auth 키).
// 비워두면 자동 가져오기 버튼 대신 수동 검색 링크만 동작해요.
const TMDB_API_KEY = "ed91df70f9a3bcfada0a625108d5789a";
