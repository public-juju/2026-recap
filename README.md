# 2026 결산 아카이브

드라마 · 영화 · 예능&교양 · 공연 · 여행을 한 곳에서 기록하는 개인 결산 웹앱입니다.
순수 HTML/CSS/JS로만 만들어져 있어 별도 빌드 과정 없이 바로 배포할 수 있습니다.

## 파일 구성
- `index.html` — 메인 페이지 (PWA 설정 포함)
- `style.css` — 디자인 (티켓 스텁 컨셉, 흰 배경 + Fresh Greens 포인트 컬러)
- `config.js` — Supabase / TMDB 접속 정보 (직접 채워넣는 파일)
- `data.js` — 2026년 초기 데이터 (알려주신 목록이 반영되어 있어요)
- `app.js` — 탭 전환, 카드 편집/추가/삭제, 인사이트 계산, Supabase/TMDB 연동 로직
- `manifest.json`, `sw.js`, `icons/` — 홈 화면에 앱처럼 설치하기 위한 PWA 파일

## GitHub + Vercel 배포 방법

1. **GitHub 저장소 만들기**
   - github.com에서 새 저장소 생성 (예: `2026-recap`)
   - 이 폴더의 파일들과 폴더(index.html, style.css, config.js, data.js, app.js, manifest.json, sw.js, icons/, README.md)를 그대로 업로드
     (저장소 페이지의 "Add file → Upload files"로 통째로 드래그 앤 드롭하면 폴더 구조가 그대로 올라가요)

2. **Vercel 연결**
   - vercel.com 로그인 → "Add New... → Project"
   - 방금 만든 GitHub 저장소 선택 → Import
   - Framework Preset은 **Other**로 두면 됩니다 (빌드 설정 필요 없음)
   - Deploy 클릭 → 몇 초 후 `xxx.vercel.app` 주소로 접속 가능

3. 이후 GitHub 저장소에 파일을 수정해서 push하면 Vercel이 자동으로 재배포합니다.

## 데이터 관리 방식 (Supabase 연동)

이제 이 앱은 **Supabase**를 연결하면 여러 기기(폰, 컴퓨터 등)에서 같은 데이터를 볼 수 있어요.
Supabase를 연결하지 않으면 자동으로 브라우저의 localStorage만 사용합니다 (기존과 동일, 이 기기에서만 유지).

### 1) Supabase 프로젝트 만들기
1. [supabase.com](https://supabase.com) 가입 → "New project" 생성 (무료 플랜으로 충분해요)
2. 프로젝트가 만들어지면 왼쪽 메뉴에서 **SQL Editor** 선택 → "New query" → 아래 SQL을 붙여넣고 실행(Run)

```sql
create table if not exists recap_items (
  id text primary key,
  category text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table recap_items enable row level security;

create policy "public read" on recap_items for select using (true);
create policy "public write" on recap_items for insert with check (true);
create policy "public update" on recap_items for update using (true);
create policy "public delete" on recap_items for delete using (true);
```

> ⚠️ 위 정책은 "누구나 이 테이블을 읽고 쓸 수 있음"으로 설정하는 가장 간단한 방식이에요.
> 개인 기록용으로 링크를 남에게 공유하지 않는다면 크게 문제되지 않지만, 더 엄격하게 하고 싶으면 나중에 로그인 기능을 추가해 정책을 바꿀 수 있어요.

### 2) 접속 정보 넣기
1. Supabase 프로젝트의 **Project Settings → API** 메뉴로 이동
2. **Project URL**과 **anon public key** 두 값을 복사
3. 이 폴더의 `config.js` 파일을 열어 아래처럼 채워넣기

```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

4. `config.js`를 GitHub에 다시 업로드(커밋)하면 Vercel이 자동으로 재배포합니다.

### 3) 확인하기
- 배포된 사이트를 열면 화면 오른쪽 위에 **"☁️ Supabase 연결됨"**이 뜨면 성공이에요.
- 처음 연결 시 테이블이 비어있으면 `data.js`의 초기 데이터가 자동으로 한 번 업로드(seed)돼요.
- 이후 다른 기기에서 같은 사이트에 접속해도 똑같은 데이터가 보입니다.
- "초기화" 버튼을 누르면 Supabase 테이블 전체를 지우고 `data.js`의 초기 데이터로 다시 채웁니다 (모든 기기에 반영되니 주의!).

### 계속 데이터 추가하기
- 앱의 "+ 추가하기" 버튼으로 그때그때 추가하면 Supabase에도 자동 저장됩니다.
- `data.js`는 "최초 시드 데이터"로만 쓰이고, 한 번 Supabase에 연결되면 이후 데이터는 Supabase가 기준이 돼요.

## 앱처럼 홈 화면에 설치하기

배포된 사이트를 앱처럼 아이콘으로 설치해서 쓸 수 있어요 (별도 앱스토어 없이).

- **iPhone (Safari)**: 사이트 접속 → 하단 공유 버튼 → "홈 화면에 추가"
- **안드로이드 (Chrome)**: 사이트 접속 → 우측 상단 점 3개 메뉴 → "앱 설치" 또는 "홈 화면에 추가"
- **컴퓨터 (Chrome/Edge)**: 주소창 오른쪽의 설치 아이콘 클릭

설치하면 브라우저 주소창 없이 일반 앱처럼 아이콘으로 실행되고, 초록색 티켓 아이콘이 표시돼요.

## TMDB / 위키백과 연동 (방송사/배우/줄거리 자동으로 불러오기)

드라마·예능·영화 카드의 **편집** 창에 자동 정보 가져오기 버튼이 두 개 있어요.

### 🔎 TMDB에서 정보 가져오기
[TMDB](https://www.themoviedb.org)(The Movie Database)에서 포스터, 출연진, 방송사/제작사, 줄거리(한국어)를 가져와요. 해외 영화·유명 드라마는 잘 찾지만, **한국 예능/교양 프로그램은 등록이 안 되어 있는 경우가 많아요.**

설정 방법:
1. [themoviedb.org](https://www.themoviedb.org) 가입
2. 우측 상단 프로필 → **설정(Settings) → API** → "API 키 발급" (무료, 몇 분이면 승인돼요)
3. 발급받은 **API Key (v3 auth)** 값을 `config.js`의 `TMDB_API_KEY`에 붙여넣기
4. GitHub에 다시 업로드하면 적용돼요

### 📖 위키백과에서 정보 가져오기
**API 키가 필요 없어요.** 한국어 위키백과에서 문서를 검색해 포스터(문서 대표 이미지), 줄거리(개요 문단), 그리고 문서 안의 인포박스에서 **방송 채널**·**출연자** 항목을 찾아 자동으로 채워줘요. 한국 예능/드라마 커버리지가 TMDB보다 넓은 편이라 서로 보완돼요.

- 다만 위키백과 문서마다 인포박스 형식이 달라서, 방송사/출연자 항목이 없거나 다른 이름으로 적혀 있으면 못 찾을 수 있어요. 그럴 땐 줄거리·포스터만 채워지고 방송사/출연자는 직접 입력하면 돼요.
- 문서 대표 이미지가 포스터가 아니라 다른 사진(로고, 인물 사진 등)일 수도 있어요 — 저장 전에 꼭 확인해주세요.

### 공통 안내
- 두 버튼 다 안 되면 기존처럼 **"네이버에서 검색"** 링크로 직접 찾아 붙여넣으면 돼요.
- 자동으로 채워진 내용은 저장 전 미리보기 상태이니, 저장 전에 확인하고 필요하면 고쳐서 저장하세요.
- 공연은 TMDB/위키백과 대상이 아니라서(콘서트는 DB에 없어요) 포스터는 편집창에서 직접 URL을 붙여넣는 방식 그대로예요.
- **나무위키 자동 연동은 지원하지 않아요** — 공식 API가 없어 브라우저에서 직접 가져올 수 없고(CORS 차단), 이를 위해서는 별도 서버(프록시)가 필요해서 이 정적 사이트 구조와는 맞지 않아요. 필요하면 나중에 서버리스 함수를 추가해서 시도해볼 수 있어요.

## 포스터 이미지에 대해

포털사이트 검색 결과를 자동으로 가져오는 기능은 별도 서버/이미지 검색 API가 필요해서, 이 버전에서는:
- 드라마·예능·영화는 위의 TMDB/위키백과 자동 가져오기로 상당수 커버돼요.
- **공연**도 이제 포스터를 넣을 수 있어요 — 편집(또는 추가) 창에서 이미지 URL을 붙여넣으면 목록에 작은 포스터가 표시돼요.
- TMDB에 없거나 직접 고른 이미지를 쓰고 싶다면, 각 카드의 **"포털검색"** 버튼(드라마/예능/영화) 또는 편집창의 검색 링크(공연)로 네이버 검색을 새 탭에서 열고, 마음에 드는 이미지의 주소를 복사해 편집창에 붙여넣으면 돼요.
- 이미지 URL을 넣지 않으면 제목 기반으로 자동 생성된 컬러 플레이스홀더가 대신 표시돼요.

## 앞으로 같이 발전시킬 수 있는 부분
- 이 초기 버전은 뼈대이니, 아래처럼 앞으로 하나씩 더 다듬어가면 좋을 것 같아요:
  - 공연 세트리스트 입력 UI
  - 드라마/예능 장르·배우 데이터를 채워 인사이트 고도화
  - 연말 결산용 요약 카드(공유 이미지) 생성 기능
