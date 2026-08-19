// ====================== State ======================
const STORAGE_KEY = "recap2026_v1";
const CATEGORIES = ["dramas", "movies", "shows", "travels", "performances", "exhibitions"];
const TABLE = "recap_items";

const hasSupabaseConfig =
  typeof SUPABASE_URL === "string" && SUPABASE_URL.trim() &&
  typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.trim() &&
  window.supabase;

const sb = hasSupabaseConfig ? window.supabase.createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim()) : null;

let state = { dramas: [], movies: [], shows: [], travels: [], performances: [], exhibitions: [] };

function emptyState() { return { dramas: [], movies: [], shows: [], travels: [], performances: [], exhibitions: [] }; }

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn("local state load failed", e); }
  return JSON.parse(JSON.stringify(INITIAL_DATA));
}

function saveLocalCache() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn("local cache save failed", e); }
}

function buildStateFromRows(rows) {
  const next = emptyState();
  rows.forEach(row => {
    if (!next[row.category]) next[row.category] = [];
    next[row.category].push(row.payload);
  });
  return next;
}

async function seedSupabase() {
  const rows = [];
  CATEGORIES.forEach(cat => {
    (INITIAL_DATA[cat] || []).forEach(item => {
      rows.push({ id: item.id, category: cat, payload: item });
    });
  });
  const { error } = await sb.from(TABLE).insert(rows);
  if (error) throw error;
}

function setSyncStatus(text) {
  const el = document.getElementById("sync-status");
  if (el) el.textContent = text;
}

async function initState() {
  if (sb) {
    try {
      const { data, error } = await sb.from(TABLE).select("*");
      if (error) throw error;
      if (!data || data.length === 0) {
        await seedSupabase();
        state = JSON.parse(JSON.stringify(INITIAL_DATA));
      } else {
        state = buildStateFromRows(data);
      }
      setSyncStatus("☁️ Supabase 연결됨");
      saveLocalCache();
      return;
    } catch (e) {
      console.warn("Supabase load failed, falling back to local storage", e);
      setSyncStatus("⚠️ 연결 실패 · 로컬 저장");
    }
  } else {
    setSyncStatus("💾 로컬 저장 모드");
  }
  state = loadLocalState();
}

// Persist a single item after add/edit/status-change.
async function persistUpsert(category, item) {
  saveLocalCache();
  if (!sb) return;
  try {
    const { error } = await sb.from(TABLE).upsert({
      id: item.id, category, payload: item, updated_at: new Date().toISOString()
    });
    if (error) throw error;
  } catch (e) {
    console.warn("supabase upsert failed", e);
    setSyncStatus("⚠️ 저장 실패 · 로컬만 반영됨");
  }
}

// Persist a deletion.
async function persistDelete(category, id) {
  saveLocalCache();
  if (!sb) return;
  try {
    const { error } = await sb.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  } catch (e) {
    console.warn("supabase delete failed", e);
    setSyncStatus("⚠️ 삭제 실패 · 로컬만 반영됨");
  }
}

window.resetAllData = async function resetAllData() {
  if (sb) {
    try {
      await sb.from(TABLE).delete().neq("id", "__never__");
      await seedSupabase();
      return;
    } catch (e) {
      console.warn("supabase reset failed, clearing local only", e);
    }
  }
  localStorage.removeItem(STORAGE_KEY);
};

function uid(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ====================== Tabs ======================
const TABS = [
  { key: "dramas", label: "드라마", emoji: "📺" },
  { key: "movies", label: "영화", emoji: "🎥" },
  { key: "shows", label: "예능&교양", emoji: "📺" },
  { key: "performances", label: "공연", emoji: "🫶🏻" },
  { key: "exhibitions", label: "전시", emoji: "🖼️" },
  { key: "travels", label: "여행", emoji: "✈️" },
  { key: "insights", label: "통합 인사이트", emoji: "📊" }
];

let activeTab = "dramas";

// Status/type/region badges get their own fixed, vivid colors (independent of
// the now-neutral UI chrome) so they're the colorful accents on the page.
const STATUS_COLOR = { "완료": "#22a06b", "보는중": "#f2a93b", "중도하차": "#c4536b" };
const STATUS_ORDER = ["보는중", "완료", "중도하차"];

// ====================== Filter / sort ======================
const filterState = {
  dramas: { sort: "asc", sortBy: "order" },
  shows: { sort: "asc", sortBy: "order" },
  movies: { sort: "asc", sortBy: "order" },
  travels: { sort: "asc", region: "" },
  performances: { sort: "asc" },
  exhibitions: { sort: "asc" }
};

function sortValue(key, item) {
  const f = filterState[key];
  if (key === "movies") {
    if (f.sortBy === "type") return `${item.type}_${String(item.order || 0).padStart(4, "0")}`;
    return item.order || 0;
  }
  if (key === "dramas" || key === "shows") {
    if (f.sortBy === "broadcaster") return `${(item.broadcaster || "zzz").toLowerCase()}_${(item.title || "").toLowerCase()}`;
    if (f.sortBy === "title") return (item.title || "").toLowerCase();
    // 시청순서: the original items were seeded with ids "d1".."d31" / "s1".."s16"
    // in exact viewing order — that id never changes even if the title gets
    // edited later (e.g. after pulling in a poster/cast via TMDB), so it's a
    // more reliable source of truth than either the title text or whatever
    // Supabase happens to have stored for "order".
    const m = /^[ds](\d+)$/.exec(item.id || "");
    if (m) return Number(m[1]);
    return item.order || 0; // newly added items (non-original ids)
  }
  if (key === "travels") return item.startDate;
  if (key === "performances" || key === "exhibitions") return item.date;
  return (item.title || "").toLowerCase();
}

function applyFilterSort(key, list) {
  const f = filterState[key];
  let out = list;
  if (key === "travels" && f.region) {
    const wantIntl = f.region === "international";
    out = out.filter(item => !!item.international === wantIntl);
  }
  out = [...out].sort((a, b) => {
    const va = sortValue(key, a), vb = sortValue(key, b);
    const cmp = (typeof va === "number" && typeof vb === "number")
      ? va - vb
      : String(va).localeCompare(String(vb), "ko");
    return f.sort === "asc" ? cmp : -cmp;
  });
  return out;
}

function distinctValues(list, field) {
  return Array.from(new Set(list.map(x => x[field]).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko"));
}

// "정렬 기준" — groups everything by broadcaster/viewing-method instead of
// filtering any of it out, so e.g. all OTT and all 영화관 items are visible
// together, just clustered by type.
function renderSortByFilter(key) {
  if (key === "dramas" || key === "shows") {
    const current = filterState[key].sortBy || "order";
    return `<select class="filter-select" data-filter-key="${key}" data-filter-field="sortBy">
      <option value="order" ${current === "order" ? "selected" : ""}>시청 순서대로</option>
      <option value="title" ${current === "title" ? "selected" : ""}>제목순</option>
      <option value="broadcaster" ${current === "broadcaster" ? "selected" : ""}>방송사별로 모아보기</option>
    </select>`;
  }
  if (key === "movies") {
    const current = filterState.movies.sortBy || "order";
    return `<select class="filter-select" data-filter-key="movies" data-filter-field="sortBy">
      <option value="order" ${current === "order" ? "selected" : ""}>감상 순서대로</option>
      <option value="type" ${current === "type" ? "selected" : ""}>영화관/OTT별로 모아보기</option>
    </select>`;
  }
  return "";
}

function renderRegionFilter() {
  const current = filterState.travels.region || "";
  return `<select class="filter-select" data-filter-key="travels" data-filter-field="region">
    <option value="">전체</option>
    <option value="domestic" ${current === "domestic" ? "selected" : ""}>국내</option>
    <option value="international" ${current === "international" ? "selected" : ""}>해외</option>
  </select>`;
}

function renderFilterBar(key, extraSelectHtml) {
  const { sort } = filterState[key];
  return `
    <div class="filter-bar">
      ${extraSelectHtml || ""}
      <button class="btn small" data-action="toggleSort" data-key="${key}">${sort === "asc" ? "오름차순" : "내림차순"}</button>
    </div>
  `;
}

// ====================== Poster placeholder ======================
const PALETTE = ["#3b4a63", "#5b3a4a", "#3a5b4f", "#5b4a3a", "#43395b", "#3a5057"];
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return h;
}
function posterGradient(title) {
  const h = hashStr(title);
  const c1 = PALETTE[h % PALETTE.length];
  const c2 = PALETTE[(h >> 3) % PALETTE.length];
  return `linear-gradient(150deg, ${c1}, ${c2})`;
}

function posterBlock(item, emoji) {
  if (item.poster) {
    return `<img src="${escapeAttr(item.poster)}" alt="" onerror="this.style.display='none'">`;
  }
  return `<span>${emoji}<br>${escapeHtml(item.title)}</span>`;
}

// Give each broadcaster/channel its own consistent shade from the site's blue
// Give each broadcaster/channel a maximally-distinct hue using the golden
// angle (~137.5°) — this guarantees good separation between colors no matter
// how many broadcasters exist, unlike a small fixed palette (which can repeat
// or land on very similar shades). Order is alphabetical so it's stable
// across reloads regardless of render/sort order.
function broadcasterColor(name) {
  if (!name) return null;
  const all = Array.from(new Set(
    [...state.dramas, ...state.shows]
      .map(x => (x.broadcaster || "").trim())
      .filter(Boolean)
      .map(n => n.toLowerCase())
  )).sort((a, b) => a.localeCompare(b, "ko"));
  const idx = Math.max(0, all.indexOf(name.trim().toLowerCase()));
  const hue = (idx * 137.508) % 360;
  return { bg: `hsl(${hue}, 68%, 50%)`, text: "#fff" };
}

// ====================== Escaping ======================
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }

// ====================== Render root ======================
const root = document.getElementById("app-root");

function render() {
  const tab = TABS.find(t => t.key === activeTab);
  root.innerHTML = `
    ${renderTabs()}
    <div id="swipe-area">
      <div id="content"></div>
      <div id="insights"></div>
    </div>
  `;
  document.getElementById("insights").innerHTML = renderInsights(activeTab);
  document.getElementById("content").innerHTML = renderContent(activeTab);
  attachEvents();
  if (activeTab === "travels") mountKoreaMap();
}

function renderTabs() {
  return `<div class="tabs" role="tablist">
    ${TABS.map(t => `
      <button class="tab-btn ${t.key === activeTab ? "active" : ""}" data-tab="${t.key}" role="tab" aria-selected="${t.key === activeTab}">
        ${t.emoji} ${t.label}
      </button>
    `).join("")}
  </div>`;
}

// ====================== Insights ======================
function insightCard(num, label, detail) {
  return `<div class="insight-card"><div class="num">${num}</div><div class="label">${label}</div>${detail ? `<div class="detail">${detail}</div>` : ""}</div>`;
}

function topCounts(list, splitter) {
  const counts = {};
  list.forEach(v => {
    if (!v) return;
    v.split(splitter).map(s => s.trim()).filter(Boolean).forEach(name => {
      if (name === "혼자") return;
      counts[name] = (counts[name] || 0) + 1;
    });
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted;
}

// Same title watched more than once still counts toward the total watched
// count, but for "who/what shows up most" stats a rewatch shouldn't inflate
// the tally — count each distinct title once there.
function dedupeByTitle(list) {
  const seen = new Set();
  return list.filter(item => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  });
}

const EYEBROW_EMOJI = {
  "GENRE": "🎭", "CAST": "🌟", "CHANNEL": "📡", "DROPPED": "🛑",
  "VENUE": "🎬", "DISTANCE": "🧭", "COMPANION": "🤝", "TOP COMPANION": "💛",
  "SPENDING": "💸", "MOST WATCHED": "🔁", "SCREEN TIME": "📺",
  "OUT & ABOUT": "🚪", "MOST OF ALL": "🏆", "NIGHTS AWAY": "🌙"
};
function statCard(eyebrow, big, unit, desc) {
  const emoji = EYEBROW_EMOJI[eyebrow] || (eyebrow.includes("WRAPPED") ? "🎉" : "✨");
  return { eyebrow, big, unit, desc, emoji, kind: "stat" };
}

function buildInsightCards(tab) {
  if (tab === "insights") {
    const dramas = state.dramas, shows = state.shows, movies = state.movies, travels = state.travels, performances = state.performances, exhibitions = state.exhibitions;
    const dramasDone = dramas.filter(x => x.status === "완료").length;
    const showsDone = shows.filter(x => x.status === "완료").length;
    const watchTotal = dramasDone + showsDone + movies.length;
    const totalMoments = dramas.length + shows.length + movies.length + travels.length + performances.length + exhibitions.length;
    const perfTotal = performances.reduce((a, x) => a + (Number(x.price) || 0), 0);
    const exhibitTotal = exhibitions.reduce((a, x) => a + (Number(x.price) || 0), 0);
    const outingsSpend = perfTotal + exhibitTotal;
    const travelKm = travels.reduce((a, x) => a + (Number(x.distanceKm) || 0), 0);
    const outings = travels.length + performances.length + exhibitions.length;

    const counts = [
      { label: "드라마", n: dramas.length }, { label: "예능&교양", n: shows.length },
      { label: "영화", n: movies.length }, { label: "여행", n: travels.length },
      { label: "공연", n: performances.length }, { label: "전시", n: exhibitions.length }
    ].sort((a, b) => b.n - a.n);

    const cards = [
      statCard("2026 THE YEAR WRAPPED", String(totalMoments), "개의 순간을 기록했어요",
        `드라마 ${dramas.length}편 · 영화 ${movies.length}편 · 예능 ${shows.length}편 · 여행 ${travels.length}회 · 공연 ${performances.length}회 · 전시 ${exhibitions.length}회예요.`),
      statCard("SCREEN TIME", String(watchTotal), "편의 영상 콘텐츠", `드라마 완료 ${dramasDone}편 · 예능 완료 ${showsDone}편 · 영화 ${movies.length}편을 봤어요.`),
      statCard("OUT & ABOUT", String(outings), "번은 집 밖으로", `여행 ${travels.length}회, 공연 ${performances.length}회, 전시 ${exhibitions.length}회로 총 ${outings}번 나갔어요.`),
      statCard("SPENDING", "₩" + outingsSpend.toLocaleString(), "공연·전시에 쓴 돈", `공연 ₩${perfTotal.toLocaleString()} · 전시 ₩${exhibitTotal.toLocaleString()}을 썼어요.`),
      statCard("DISTANCE", travelKm.toLocaleString() + "km", "여행으로 이동한 거리(추정)", `편도 기준 추정치예요.`)
    ];
    if (counts.length && counts[0].n > 0) {
      cards.push(statCard("MOST OF ALL", counts[0].label, "가장 많이 기록한 카테고리", `올해 ${counts[0].n}개로 가장 많았어요.`));
    }

    const tags = [`#총_${totalMoments}개`, `#영상_${watchTotal}편`, `#외출_${outings}회`];
    if (outingsSpend) tags.push(`#공연전시지출_₩${outingsSpend.toLocaleString()}`);
    if (travelKm) tags.push(`#이동거리_${travelKm.toLocaleString()}km`);
    cards.push({
      kind: "summary", title: "2026 종합 결산",
      body: [
        `2026년 한 해, 드라마·영화·예능·여행·공연·전시를 합쳐 총 ${totalMoments}개의 기록을 남겼어요.`,
        `영상 콘텐츠 ${watchTotal}편을 보고, ${outings}번은 여행·공연·전시로 집 밖을 나섰어요.`
      ],
      tags, highlights: counts[0] && counts[0].n > 0 ? [{ label: "가장 많이 기록한 카테고리", value: counts[0].label, sub: `${counts[0].n}개 기록` }] : []
    });
    return cards;
  }

  if (tab === "dramas" || tab === "shows") {
    const list = state[tab];
    const label = tab === "dramas" ? "드라마" : "예능&교양";
    const eng = tab === "dramas" ? "DRAMA" : "SHOW";
    const done = list.filter(x => x.status === "완료").length;
    const watching = list.filter(x => x.status === "보는중").length;
    const dropped = list.filter(x => x.status === "중도하차").length;
    const dedupList = dedupeByTitle(list);
    const castCounts = topCounts(dedupList.map(x => x.cast).filter(Boolean), /[,\/]/);
    const genreCounts = topCounts(dedupList.map(x => x.genre).filter(Boolean), /[,\/]/);
    const bcCounts = topCounts(dedupList.map(x => x.broadcaster).filter(Boolean), /[,\/]/);
    const droppedTitles = list.filter(x => x.status === "중도하차").map(x => x.title);

    const cards = [
      statCard(`2026 ${eng} WRAPPED`, String(list.length), "편의 이야기",
        `완료 ${done}편${watching ? ` · 보는 중 ${watching}편` : ""}${dropped ? ` · 중도하차 ${dropped}편` : ""}, 한 해 동안 쌓아온 기록이에요.`)
    ];
    if (genreCounts.length) {
      cards.push(statCard("GENRE", genreCounts[0][0], "가장 즐겨 본 장르", `${list.length}편 중 ${genreCounts[0][1]}편이 «${genreCounts[0][0]}»였어요.`));
    }
    if (castCounts.length) {
      cards.push(statCard("CAST", castCounts[0][0], "최다 등장 배우/출연진", `«${castCounts[0][0]}»이(가) 나온 작품을 ${castCounts[0][1]}편 봤어요.`));
    }
    if (bcCounts.length) {
      cards.push(statCard("CHANNEL", bcCounts[0][0], "최다 방송사/채널", `«${bcCounts[0][0]}»에서 ${bcCounts[0][1]}편을 봤어요.`));
    }
    if (dropped) {
      cards.push(statCard("DROPPED", String(dropped), "중도하차한 작품", droppedTitles.join(" · ")));
    }

    const tags = [`#총_${list.length}편`, `#완료_${done}편`];
    if (dropped) tags.push(`#중도하차_${dropped}편`);
    if (genreCounts.length) tags.push(`#${genreCounts[0][0]}`);
    if (bcCounts.length) tags.push(`#${bcCounts[0][0]}`);
    const highlights = [];
    if (castCounts.length) highlights.push({ label: "최다 등장 배우/출연진", value: castCounts[0][0], sub: `${castCounts[0][1]}편에 등장` });
    if (bcCounts.length) highlights.push({ label: "최다 방송사/채널", value: bcCounts[0][0], sub: `${bcCounts[0][1]}편 시청` });
    cards.push({
      kind: "summary", title: `2026 ${label} 결산`,
      body: [`2026년, «${label}» ${list.length}편을 기록했어요. 완료 ${done}편${watching ? ` · 보는 중 ${watching}편` : ""}${dropped ? ` · 중도하차 ${dropped}편` : ""}이에요.`],
      tags, highlights
    });
    return cards;
  }

  if (tab === "movies") {
    const list = state.movies;
    const ott = list.filter(x => x.type === "OTT").length;
    const theater = list.filter(x => x.type === "영화관").length;
    const pct = list.length ? Math.round((theater / list.length) * 100) : 0;
    const castCounts = topCounts(dedupeByTitle(list).map(x => x.cast).filter(Boolean), /[,\/]/);    const cards = [
      statCard("2026 MOVIE WRAPPED", String(list.length), "편의 영화", `영화관 ${theater}편 · OTT ${ott}편을 봤어요.`),
      statCard("VENUE", `${pct}%`, "영화관 관람 비중", `영화관 ${theater}편 · OTT ${ott}편이었어요.`)
    ];
    if (castCounts.length) {
      cards.push(statCard("CAST", castCounts[0][0], "최다 등장 배우", `«${castCounts[0][0]}»이(가) 나온 영화를 ${castCounts[0][1]}편 봤어요.`));
    }

    const tags = [`#총_${list.length}편`, `#영화관_${theater}편`, `#OTT_${ott}편`];
    const highlights = [];
    if (castCounts.length) highlights.push({ label: "최다 등장 배우", value: castCounts[0][0], sub: `${castCounts[0][1]}편에 등장` });
    cards.push({
      kind: "summary", title: "2026 영화 결산",
      body: [`2026년, 영화 ${list.length}편을 봤어요. 영화관 ${theater}편 · OTT ${ott}편으로, 영화관 관람 비중이 ${pct}%였어요.`],
      tags, highlights
    });
    return cards;
  }

  if (tab === "travels") {
    const list = state.travels;
    const domestic = list.filter(x => !x.international).length;
    const intl = list.filter(x => x.international).length;
    const solo = list.filter(x => x.solo).length;
    const withOthers = list.length - solo;
    const totalKm = list.reduce((a, x) => a + (Number(x.distanceKm) || 0), 0);
    const totalSpent = list.reduce((a, x) => a + travelCostTotal(x), 0);
    const flat = list.map(x => (x.companions || "").replace(/[가-힣]+:\s*/g, "")).join(",");
    const companionCounts = topCounts([flat], /,/);
    const totalNights = list.reduce((a, x) => a + tripNights(x), 0);
    const totalDays = list.reduce((a, x) => a + tripNights(x) + 1, 0);

    const cards = [
      statCard("2026 TRAVEL WRAPPED", String(list.length), "번의 여행", `국내 ${domestic}회 · 해외 ${intl}회를 다녀왔어요.`),
      statCard("NIGHTS AWAY", String(totalNights), "박", `${list.length}번의 여행에서 잔 날을 모두 더하면 ${totalNights}박, 오간 날까지 합치면 총 ${totalDays}일이에요.`),
      statCard("DISTANCE", totalKm.toLocaleString(), "총 이동 거리(km, 추정)", "KTX는 서울역, 국내선은 김포·해외는 인천 기준 편도 추정치예요."),
      statCard("COMPANION", `${solo} : ${withOthers}`, "혼자 : 함께", `혼자 ${solo}회 · 함께 ${withOthers}회 떠났어요.`)
    ];
    if (totalSpent) {
      cards.push(statCard("SPENDING", "₩" + totalSpent.toLocaleString(), "총 여행 경비", `${list.length}번의 여행에 총 ₩${totalSpent.toLocaleString()}을 썼어요.`));
    }
    if (companionCounts.length) {
      cards.push(statCard("TOP COMPANION", companionCounts[0][0], "최다 동행", `${companionCounts[0][1]}회 함께했어요.`));
    }

    const tags = [`#여행_${list.length}회`, `#${totalNights}박${totalDays}일`, `#국내_${domestic}회`, `#해외_${intl}회`, `#이동거리_${totalKm.toLocaleString()}km`];
    if (totalSpent) tags.push(`#여행경비_₩${totalSpent.toLocaleString()}`);
    const highlights = [];
    if (companionCounts.length) highlights.push({ label: "최다 동행", value: companionCounts[0][0], sub: `${companionCounts[0][1]}회 함께함` });
    cards.push({
      kind: "summary", title: "2026 여행 결산",
      body: [`2026년, 여행을 총 ${list.length}번 다녀왔어요. 총 ${totalNights}박 ${totalDays}일, 국내 ${domestic}회 · 해외 ${intl}회, 추정 이동거리는 편도 총 ${totalKm.toLocaleString()}km예요.`],
      tags, highlights
    });
    return cards;
  }

  if (tab === "performances") {
    const list = state.performances;
    const total = list.reduce((a, x) => a + (Number(x.price) || 0), 0);
    const solo = list.filter(x => x.solo).length;
    const withOthers = list.length - solo;
    const titleCounts = {};
    list.forEach(x => { titleCounts[x.title] = (titleCounts[x.title] || 0) + 1; });
    const topTitle = Object.entries(titleCounts).sort((a, b) => b[1] - a[1])[0];
    const avg = list.length ? Math.round(total / list.length) : 0;

    const cards = [
      statCard("2026 SHOW WRAPPED", String(list.length), "번의 공연", `혼자 ${solo}회 · 함께 ${withOthers}회 봤어요.`),
      statCard("SPENDING", "₩" + total.toLocaleString(), "총 지출", `평균 ₩${avg.toLocaleString()}/회를 썼어요.`)
    ];
    if (topTitle) {
      cards.push(statCard("MOST WATCHED", topTitle[0], "가장 많이 본 공연", `${topTitle[1]}회 관람했어요.`));
    }

    const tags = [`#공연_${list.length}회`, `#총지출_₩${total.toLocaleString()}`, `#혼자_${solo}회`, `#함께_${withOthers}회`];
    const highlights = [];
    if (topTitle) highlights.push({ label: "가장 많이 본 공연", value: topTitle[0], sub: `${topTitle[1]}회 관람` });
    cards.push({
      kind: "summary", title: "2026 공연 결산",
      body: [`2026년, 공연을 총 ${list.length}번 봤어요. 총 지출은 ₩${total.toLocaleString()}, 평균 ₩${avg.toLocaleString()}/회였어요.`],
      tags, highlights
    });
    return cards;
  }

  if (tab === "exhibitions") {
    const list = state.exhibitions;
    const total = list.reduce((a, x) => a + (Number(x.price) || 0), 0);
    const solo = list.filter(x => x.solo).length;
    const withOthers = list.length - solo;
    const titleCounts = {};
    list.forEach(x => { titleCounts[x.title] = (titleCounts[x.title] || 0) + 1; });
    const topTitle = Object.entries(titleCounts).sort((a, b) => b[1] - a[1])[0];
    const avg = list.length ? Math.round(total / list.length) : 0;

    const cards = [
      statCard("2026 EXHIBIT WRAPPED", String(list.length), "번의 전시", `혼자 ${solo}회 · 함께 ${withOthers}회 봤어요.`),
      statCard("SPENDING", "₩" + total.toLocaleString(), "총 지출", `평균 ₩${avg.toLocaleString()}/회를 썼어요.`)
    ];
    if (topTitle) {
      cards.push(statCard("MOST WATCHED", topTitle[0], "가장 많이 본 전시", `${topTitle[1]}회 관람했어요.`));
    }

    const tags = [`#전시_${list.length}회`, `#총지출_₩${total.toLocaleString()}`, `#혼자_${solo}회`, `#함께_${withOthers}회`];
    const highlights = [];
    if (topTitle) highlights.push({ label: "가장 많이 본 전시", value: topTitle[0], sub: `${topTitle[1]}회 관람` });
    cards.push({
      kind: "summary", title: "2026 전시 결산",
      body: [`2026년, 전시를 총 ${list.length}번 봤어요. 총 지출은 ₩${total.toLocaleString()}, 평균 ₩${avg.toLocaleString()}/회였어요.`],
      tags, highlights
    });
    return cards;
  }

  return [];
}

function renderInsightCardInner(card) {
  if (card.kind === "summary") {
    const tagsHtml = card.tags.map(t => `<span class="icard-tag">${escapeHtml(t)}</span>`).join("");
    const highlightsHtml = card.highlights.map(h => `
      <div class="icard-highlight">
        <div class="h-label">${escapeHtml(h.label)}</div>
        <div class="h-value">${escapeHtml(h.value)}</div>
        <div class="h-sub">${escapeHtml(h.sub)}</div>
      </div>
    `).join("");
    return `
      <div class="icard-emoji">🎊</div>
      <div class="icard-title">${escapeHtml(card.title)}</div>
      <div class="icard-body">${card.body.map(p => `<p>${escapeHtml(p)}</p>`).join("")}</div>
      <div class="icard-tags">${tagsHtml}</div>
      ${highlightsHtml ? `<div class="icard-highlights">${highlightsHtml}</div>` : ""}
    `;
  }
  return `
    <div class="icard-emoji">${escapeHtml(card.emoji)}</div>
    <div class="icard-eyebrow">${escapeHtml(card.eyebrow)}</div>
    <div class="icard-big">${escapeHtml(card.big)}</div>
    <div class="icard-unit">${escapeHtml(card.unit)}</div>
    <div class="icard-desc">${escapeHtml(card.desc)}</div>
  `;
}

const INSIGHT_CARD_PALETTE = [
  "linear-gradient(150deg, #4361ee, #4cc9f0)",
  "linear-gradient(150deg, #7209b7, #d6249f)",
  "linear-gradient(150deg, #f72585, #ff8fa3)",
  "linear-gradient(150deg, #06a77d, #4ce0b3)",
  "linear-gradient(150deg, #f77f00, #ffca3a)",
  "linear-gradient(150deg, #3a0ca3, #7209b7)"
];

function renderInsights(tab) {
  const cards = buildInsightCards(tab);
  if (!cards.length) return "";

  const slidesHtml = cards.map((card, i) => `
    <div class="insight-slide">
      <div class="insight-card-9x16" id="insight-export-card-${i}" style="background:${INSIGHT_CARD_PALETTE[i % INSIGHT_CARD_PALETTE.length]}">
        ${renderInsightCardInner(card)}
        <div class="icard-footer">2026 · ${i + 1} / ${cards.length}</div>
      </div>
      <button class="btn primary" data-action="saveInsight" data-index="${i}">📸 이미지로 저장</button>
    </div>
  `).join("");

  const dotsHtml = cards.map((_, i) => `<span class="insight-dot ${i === 0 ? "active" : ""}" data-dot="${i}"></span>`).join("");

  return `
    <div class="insight-frame">
      <div class="insight-carousel" id="insight-carousel">${slidesHtml}</div>
      <div class="insight-dots" id="insight-dots">${dotsHtml}</div>
    </div>
  `;
}

// ====================== Content ======================
function renderContent(tab) {
  if (tab === "dramas") return renderMediaTab("dramas", "📺", true, "방송사/채널", "주연배우");
  if (tab === "shows") return renderMediaTab("shows", "📺", true, "방송사/채널", "출연진");
  if (tab === "movies") return renderMoviesTab();
  if (tab === "travels") return renderTravelsTab();
  if (tab === "performances") return renderPerformancesTab();
  if (tab === "exhibitions") return renderExhibitionsTab();
  if (tab === "insights") {
    return `<div class="section-row"><h2>2026년 전체를 한눈에</h2></div>
      <div class="empty-state">아래 카드를 넘겨보면서 드라마·영화·예능·공연·전시·여행을 한 번에 확인해보세요.</div>`;
  }
  return "";
}

function renderMediaTab(key, emoji, grouped, bcLabel, castLabel) {
  const filtered = applyFilterSort(key, state[key]);
  const addBtn = `<div class="section-row"><h2>${TABS.find(t=>t.key===key).label} 목록</h2><button class="btn primary" data-add="${key}">+ 추가하기</button></div>`
    + renderFilterBar(key, renderSortByFilter(key));
  if (!grouped) return addBtn + renderGrid(filtered, key, emoji, bcLabel, castLabel);

  const groups = STATUS_ORDER
    .map(status => ({ status, items: filtered.filter(x => x.status === status) }))
    .filter(g => g.items.length > 0);

  if (!groups.length) return addBtn + `<div class="empty-state">해당하는 항목이 없어요</div>`;

  return addBtn + groups.map(g => `
    <div class="status-group">
      <div class="status-title"><span class="dot" style="background:${STATUS_COLOR[g.status]}"></span>${g.status} <span class="count">${g.items.length}편</span></div>
      ${renderGrid(g.items, key, emoji, bcLabel, castLabel)}
    </div>
  `).join("");
}

function renderGrid(items, key, emoji, bcLabel, castLabel) {
  return `<div class="grid">${items.map(item => mediaCard(item, key, emoji, bcLabel, castLabel)).join("")}</div>`;
}

function mediaCard(item, key, emoji, bcLabel, castLabel) {
  const bg = item.poster ? "" : `style="background:${posterGradient(item.title)}"`;
  const bc = item.broadcaster ? broadcasterColor(item.broadcaster) : null;
  return `
  <div class="stub" data-card-id="${item.id}">
    ${bc ? `<span class="badge" style="background:${bc.bg};color:${bc.text}">${escapeHtml(item.broadcaster)}</span>` : ""}
    <div class="poster" ${bg} data-action="detail" data-key="${key}" data-id="${item.id}">${posterBlock(item, emoji)}</div>
    <div class="tear"></div>
    <div class="info">
      <div class="title">${escapeHtml(item.title)}</div>
      <div class="meta">
        ${item.cast ? `${escapeHtml(item.cast)}` : ""}
      </div>
    </div>
  </div>`;
}

function renderMoviesTab() {
  const filtered = applyFilterSort("movies", state.movies);
  const addBtn = `<div class="section-row"><h2>영화 목록</h2><button class="btn primary" data-add="movies">+ 추가하기</button></div>`
    + renderFilterBar("movies", renderSortByFilter("movies"));
  return addBtn + `<div class="grid">${filtered.map(item => movieCard(item)).join("")}</div>`;
}

function movieCard(item) {
  const bg = item.poster ? "" : `style="background:${posterGradient(item.title)}"`;
  const badgeColor = item.type === "OTT" ? "#8b5cf6" : "#0d9488";
  return `
  <div class="stub" data-card-id="${item.id}">
    <span class="badge" style="background:${badgeColor}">${escapeHtml(item.type)}</span>
    <div class="poster" ${bg} data-action="detail" data-key="movies" data-id="${item.id}">${posterBlock(item, "🎬")}</div>
    <div class="tear"></div>
    <div class="info">
      <div class="title">${escapeHtml(item.title)}</div>
      <div class="meta">${item.cast ? escapeHtml(item.cast) : ""}</div>
    </div>
  </div>`;
}

const KOREA_REGIONS = [
  { code: "gw", name: "강원", svgId: "gangwon", keywords: ["강원", "강릉", "춘천", "속초", "양양", "묵호", "동해"] },
  { code: "gg", name: "경기", svgId: "gyeonggi", keywords: ["경기", "수원", "성남", "양평", "용인", "고양"] },
  { code: "gb", name: "경북", svgId: "north-gyeongsang", keywords: ["경북", "경주", "포항", "안동", "울릉"] },
  { code: "ic", name: "인천", svgId: "incheon", keywords: ["인천"] },
  { code: "sl", name: "서울", svgId: "seoul", keywords: ["서울"] },
  { code: "cb", name: "충북", svgId: "north-chungcheong", keywords: ["충북", "청주", "충주"] },
  { code: "dg", name: "대구", svgId: "daegu", keywords: ["대구"] },
  { code: "cn", name: "충남", svgId: "south-chungcheong", keywords: ["충남", "천안", "공주", "서산"] },
  { code: "sj", name: "세종", svgId: "sejong", keywords: ["세종"] },
  { code: "gn", name: "경남", svgId: "south-gyeongsang", keywords: ["경남", "창원", "진주", "통영", "거제"] },
  { code: "us", name: "울산", svgId: "ulsan", keywords: ["울산"] },
  { code: "jb", name: "전북", svgId: "north-jeolla", keywords: ["전북", "전주", "군산", "익산"] },
  { code: "dj", name: "대전", svgId: "daejeon", keywords: ["대전"] },
  { code: "bs", name: "부산", svgId: "busan", keywords: ["부산"] },
  { code: "gj", name: "광주", svgId: "gwangju", keywords: ["광주"] },
  { code: "jn", name: "전남", svgId: "south-jeolla", keywords: ["전남", "순천", "여수", "목포", "담양"] },
  { code: "jj", name: "제주", svgId: "jeju", keywords: ["제주"] }
];

function matchRegion(destination) {
  const d = destination || "";
  for (const r of KOREA_REGIONS) {
    if (r.keywords.some(k => d.includes(k))) return r.code;
  }
  return null;
}

function computeVisitedRegions() {
  const domesticTravels = state.travels.filter(t => !t.international);
  const visitedCodes = new Set();
  const labelsByCode = {}; // code -> Set of destination texts as the person wrote them
  const unmatched = [];
  domesticTravels.forEach(t => {
    const code = matchRegion(t.destination);
    if (code) {
      visitedCodes.add(code);
      if (!labelsByCode[code]) labelsByCode[code] = new Set();
      if (t.destination) labelsByCode[code].add(t.destination.replace(/\s*\([^)]*\)/g, "").trim());
    } else if (t.destination) {
      unmatched.push(t.destination);
    }
  });
  const intlTravels = state.travels.filter(t => t.international);
  return { visitedCodes, labelsByCode, unmatched, intlTravels };
}

function renderKoreaMap() {
  const { unmatched, intlTravels } = computeVisitedRegions();

  const intlHtml = intlTravels.length
    ? `<div class="hint" style="text-align:center; margin-top:10px; margin-bottom:0;">✈️ 해외: ${intlTravels.map(t => escapeHtml(t.destination)).join(", ")}</div>`
    : "";
  const unmatchedHtml = unmatched.length
    ? `<div class="hint" style="text-align:center; margin-top:4px; margin-bottom:0;">지도에서 못 찾은 목적지: ${unmatched.map(d => escapeHtml(d)).join(", ")}</div>`
    : "";

  return `
    <div class="section-row"><h2>가본 지역</h2></div>
    <div class="kr-svg-wrap" id="kr-map-svg-container"><div class="empty-state">지도를 불러오는 중…</div></div>
    ${intlHtml}${unmatchedHtml}
  `;
}

// The map SVG (real provincial boundaries) is fetched once and cached, then
// injected and colored to match visited provinces — done after the content
// is actually in the DOM, since fetching is async.
let koreaSvgTextCache = null;
async function mountKoreaMap() {
  const container = document.getElementById("kr-map-svg-container");
  if (!container) return;
  try {
    if (!koreaSvgTextCache) {
      const res = await fetch("korea-map.svg");
      koreaSvgTextCache = await res.text();
    }
    container.innerHTML = koreaSvgTextCache;
    const svgEl = container.querySelector("svg");
    if (!svgEl) return;
    svgEl.classList.add("kr-svg-map");
    const svgNS = "http://www.w3.org/2000/svg";

    const { visitedCodes, labelsByCode } = computeVisitedRegions();
    const visitedRegions = KOREA_REGIONS.filter(r => visitedCodes.has(r.code));

    visitedRegions.forEach(r => {
      const path = svgEl.querySelector(`path[id="${r.svgId}"]`);
      if (!path) return;
      path.classList.add("visited-province"); // subtle outline only — filling the
      // whole province would be misleading when only one city in it was visited
      // (e.g. 경주 is a small city, but 경북 the province is huge).

      const labelText = Array.from(labelsByCode[r.code] || []).join(" · ") || r.name;
      try {
        const bbox = path.getBBox();
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;

        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", cx);
        text.setAttribute("y", cy);
        text.setAttribute("class", "kr-label");
        text.textContent = labelText;
        svgEl.appendChild(text);
      } catch (e) { /* getBBox can fail before layout; skip label if so */ }
    });
  } catch (e) {
    console.warn("Korea map load failed", e);
    container.innerHTML = `<div class="empty-state">지도를 불러오지 못했어요.</div>`;
  }
}

function renderTravelsTab() {
  const filtered = applyFilterSort("travels", state.travels);
  const addBtn = `<div class="section-row"><h2>여행 목록</h2><button class="btn primary" data-add="travels">+ 추가하기</button></div>`
    + renderFilterBar("travels", renderRegionFilter());
  return renderKoreaMap() + addBtn + `<div class="grid" style="grid-template-columns:1fr;">${filtered.map(t => travelRow(t)).join("")}</div>`;
}

function fmtDateRange(a, b) {
  const f = d => d.slice(5).replace("-", "/");
  return a === b ? f(a) : `${f(a)}~${f(b)}`;
}

function tripNights(t) {
  if (!t.startDate || !t.endDate) return 0;
  const start = new Date(t.startDate);
  const end = new Date(t.endDate);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function travelCostTotal(t) {
  if (t.cost) return Number(t.cost) || 0;
  // backward-compat: some entries may still have the old category breakdown
  const c = t.costs || {};
  return (Number(c.transport) || 0) + (Number(c.lodging) || 0) + (Number(c.food) || 0) + (Number(c.etc) || 0);
}

function travelRow(t) {
  const tagColor = t.international ? "#f97316" : "#3b82f6";
  const total = travelCostTotal(t);
  return `
  <div class="list-stub" data-card-id="${t.id}">
    <div class="lead">
      <div class="num">${fmtDateRange(t.startDate, t.endDate)}</div>
      <div class="tag" style="background:${tagColor}">${t.international ? "해외" : "국내"}</div>
    </div>
    <div class="body">
      <div class="title">${escapeHtml(t.destination)} ${t.solo ? "· 혼자" : ""}</div>
      <div class="meta">
        <b>이동수단</b> ${escapeHtml(t.transport)} · <b>함께</b> ${escapeHtml(t.companions || "혼자")}<br>
        <b>추정 이동거리</b> 편도 약 ${Number(t.distanceKm || 0).toLocaleString()}km
        ${total ? `<br><b>경비</b> ₩${total.toLocaleString()}` : ""}
      </div>
    </div>
    <div class="right">
      <button class="btn small" data-action="edit" data-key="travels" data-id="${t.id}">편집</button>
      <button class="btn small danger" data-action="delete" data-key="travels" data-id="${t.id}">삭제</button>
    </div>
  </div>`;
}

function renderPerformancesTab() {
  const filtered = applyFilterSort("performances", state.performances);
  const addBtn = `<div class="section-row"><h2>공연 목록</h2><button class="btn primary" data-add="performances">+ 추가하기</button></div>`
    + renderFilterBar("performances");
  return addBtn + `<div class="grid">${filtered.map(perfCard).join("")}</div>`;
}

function perfCard(p) {
  const bg = p.poster ? "" : `style="background:${posterGradient(p.title)}"`;
  const tagColor = p.solo ? "#f59e0b" : "#0ea5e9";
  return `
  <div class="stub" data-card-id="${p.id}">
    <span class="badge" style="background:${tagColor}">${p.solo ? "혼자" : "함께"}</span>
    <div class="poster" ${bg} data-action="detail" data-key="performances" data-id="${p.id}">${posterBlock(p, "🎫")}</div>
    <div class="tear"></div>
    <div class="info">
      <div class="title">${escapeHtml(p.title)}</div>
      <div class="meta">
        ${p.date.slice(5).replace("-", "/")} · ${escapeHtml(p.venue)}<br>
        ₩${Number(p.price || 0).toLocaleString()}
      </div>
    </div>
  </div>`;
}

function renderExhibitionsTab() {
  const filtered = applyFilterSort("exhibitions", state.exhibitions);
  const addBtn = `<div class="section-row"><h2>전시 목록</h2><button class="btn primary" data-add="exhibitions">+ 추가하기</button></div>`
    + renderFilterBar("exhibitions");
  return addBtn + `<div class="grid">${filtered.map(exhibitionCard).join("")}</div>`;
}

function exhibitionCard(p) {
  const bg = p.poster ? "" : `style="background:${posterGradient(p.title)}"`;
  const tagColor = p.solo ? "#f59e0b" : "#0ea5e9";
  return `
  <div class="stub" data-card-id="${p.id}">
    <span class="badge" style="background:${tagColor}">${p.solo ? "혼자" : "함께"}</span>
    <div class="poster" ${bg} data-action="detail" data-key="exhibitions" data-id="${p.id}">${posterBlock(p, "🖼️")}</div>
    <div class="tear"></div>
    <div class="info">
      <div class="title">${escapeHtml(p.title)}</div>
      <div class="meta">
        ${p.date.slice(5).replace("-", "/")} · ${escapeHtml(p.venue)}<br>
        ₩${Number(p.price || 0).toLocaleString()}
      </div>
    </div>
  </div>`;
}

// ====================== Events ======================
function attachEvents() {
  root.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => { activeTab = btn.dataset.tab; render(); });
  });
  root.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => openAddModal(btn.dataset.add));
  });
  root.querySelectorAll('[data-action="setStatus"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      const item = state[key].find(x => x.id === btn.dataset.id);
      if (item) { item.status = btn.dataset.status; persistUpsert(key, item); render(); }
    });
  });
  root.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener("click", () => {
      if (!confirm("이 항목을 삭제할까요?")) return;
      const key = btn.dataset.key, id = btn.dataset.id;
      state[key] = state[key].filter(x => x.id !== id);
      persistDelete(key, id); render();
    });
  });
  root.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.key, btn.dataset.id));
  });
  root.querySelectorAll('[data-action="search"]').forEach(btn => {
    btn.addEventListener("click", () => {
      window.open(`https://search.naver.com/search.naver?query=${encodeURIComponent(btn.dataset.title)}`, "_blank");
    });
  });
  root.querySelectorAll('[data-action="detail"]').forEach(el => {
    el.addEventListener("click", () => openDetailPopup(el.dataset.key, el.dataset.id));
  });
  root.querySelectorAll('.filter-select[data-filter-key]').forEach(sel => {
    sel.addEventListener("change", () => {
      const key = sel.dataset.filterKey;
      const field = sel.dataset.filterField;
      filterState[key][field] = sel.value;
      render();
    });
  });
  root.querySelectorAll('[data-action="toggleSort"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      filterState[key].sort = filterState[key].sort === "asc" ? "desc" : "asc";
      render();
    });
  });
  root.querySelectorAll('[data-action="saveInsight"]').forEach(btn => {
    btn.addEventListener("click", (e) => saveInsightImage(btn.dataset.index, e.currentTarget));
  });
  attachInsightCarousel();
  attachSwipe();
}

// ---- Insight carousel: sync dot indicators with scroll position, and let
// tapping a dot jump to that card.
function attachInsightCarousel() {
  const carousel = document.getElementById("insight-carousel");
  const dotsWrap = document.getElementById("insight-dots");
  if (!carousel || !dotsWrap) return;

  const dots = Array.from(dotsWrap.querySelectorAll(".insight-dot"));
  dots.forEach(dot => {
    dot.addEventListener("click", () => {
      const slide = carousel.children[Number(dot.dataset.dot)];
      if (slide) slide.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  });

  let ticking = false;
  carousel.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const slideWidth = carousel.children[0] ? carousel.children[0].offsetWidth + 14 : 1;
      const idx = Math.round(carousel.scrollLeft / slideWidth);
      dots.forEach((d, i) => d.classList.toggle("active", i === idx));
      ticking = false;
    });
  }, { passive: true });
}

// ---- Export an insight card as a transparent-background PNG
async function saveInsightImage(index, btnEl) {
  const cardEl = document.getElementById(`insight-export-card-${index}`);
  if (!cardEl) return;
  if (typeof html2canvas === "undefined") {
    alert("이미지 저장 기능을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.");
    return;
  }
  const originalDisplay = btnEl.style.display;
  btnEl.style.display = "none"; // exclude the save button itself from the capture
  try {
    const canvas = await html2canvas(cardEl, {
      backgroundColor: null, // transparent outside the card's own rounded shape
      scale: 2,
      useCORS: true
    });
    const link = document.createElement("a");
    link.download = `2026결산_${index}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (e) {
    console.warn("insight image export failed", e);
    alert("이미지를 만드는 중 문제가 생겼어요. 포스터 이미지가 있다면 외부 이미지 로딩 문제일 수 있어요.");
  } finally {
    btnEl.style.display = originalDisplay;
  }
}

// ---- Swipe left/right anywhere in the tab area (insights + content) to switch tabs
function attachSwipe() {
  const area = document.getElementById("swipe-area");
  if (!area) return;
  let startX = 0, startY = 0, startT = 0, startedInCarousel = false;

  area.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startT = Date.now();
    startedInCarousel = !!e.target.closest("#insight-carousel");
  }, { passive: true });

  area.addEventListener("touchend", (e) => {
    if (startedInCarousel) return; // let the carousel handle its own horizontal scroll
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const dt = Date.now() - startT;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);

    // Require a clearly horizontal, reasonably quick, reasonably long swipe
    // so normal vertical scrolling never gets mistaken for a tab switch.
    if (absDx < 70 || absDx < absDy * 1.5 || dt > 600) return;

    const idx = TABS.findIndex(t => t.key === activeTab);
    if (dx < 0) { activeTab = TABS[(idx + 1) % TABS.length].key; render(); }
    else { activeTab = TABS[(idx - 1 + TABS.length) % TABS.length].key; render(); }
  }, { passive: true });
}

// ====================== Modal helpers ======================
const modalOverlay = document.getElementById("modal-overlay");
const modalBody = document.getElementById("modal-body");

function closeModal() { modalOverlay.classList.remove("open"); modalBody.innerHTML = ""; }
modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closeModal(); });

function openModal(html) { modalBody.innerHTML = html; modalOverlay.classList.add("open"); }

// Some poster URLs don't load (hotlink-blocked, broken link, etc.) — this lets
// the person pick a photo from their device instead. Resizes/compresses it
// client-side before storing as a data URL, since it goes straight into
// Supabase as text.
function wireImageUpload() {
  const fileInput = document.getElementById("f-poster-file");
  const btn = document.getElementById("f-poster-upload-btn");
  const urlInput = document.getElementById("f-poster");
  if (!fileInput || !btn || !urlInput) return;
  btn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 900;
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height >= width && height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        urlInput.value = canvas.toDataURL("image/jpeg", 0.82);
        btn.textContent = "✅ 사진 선택됨 (다시 선택하려면 클릭)";
      };
      img.onerror = () => alert("이미지를 불러오지 못했어요. 다른 사진으로 시도해주세요.");
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function posterFieldHtml(currentUrl) {
  return `
    <div class="field">
      <label>포스터 이미지 URL</label>
      <input id="f-poster" value="${escapeAttr(currentUrl || "")}">
      <div class="hint" style="margin-top:6px; margin-bottom:0;">URL이 안 뜨는 이미지가 있다면, 사진을 직접 올려도 돼요.</div>
      <button type="button" class="btn small" id="f-poster-upload-btn" style="margin-top:6px;">📁 내 사진에서 선택</button>
      <input type="file" id="f-poster-file" accept="image/*" style="display:none;">
    </div>
  `;
}

// ====================== TMDB auto-fill ======================
// mediaType: "tv" (dramas/shows) or "movie". Requires TMDB_API_KEY in config.js.
async function tmdbLookup(mediaType, query) {
  const key = (typeof TMDB_API_KEY === "string") ? TMDB_API_KEY.trim() : "";
  if (!key) {
    alert('config.js에 TMDB_API_KEY를 먼저 채워넣어야 자동 정보 가져오기를 쓸 수 있어요. (README 참고)');
    return null;
  }
  try {
    const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${encodeURIComponent(key)}&language=ko-KR&query=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    if (!searchData.results || !searchData.results.length) {
      alert(`"${query}"에 대한 검색 결과를 TMDB에서 찾지 못했어요. (한국 예능/일부 드라마는 TMDB에 없을 수 있어요)`);
      return null;
    }
    const best = searchData.results[0];
    const detailUrl = `https://api.themoviedb.org/3/${mediaType}/${best.id}?api_key=${encodeURIComponent(key)}&language=ko-KR&append_to_response=credits`;
    const detailRes = await fetch(detailUrl);
    const detail = await detailRes.json();
    const cast = ((detail.credits && detail.credits.cast) || []).slice(0, 5).map(c => c.name).join(", ");
    const broadcaster = mediaType === "tv"
      ? (((detail.networks || [])[0] || {}).name || "")
      : (((detail.production_companies || [])[0] || {}).name || "");
    const poster = detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : "";
    const synopsis = detail.overview || "";
    return { poster, cast, broadcaster, synopsis };
  } catch (e) {
    console.warn("TMDB lookup failed", e);
    alert("TMDB에서 정보를 가져오는 중 문제가 생겼어요. API 키가 올바른지 확인해주세요.");
    return null;
  }
}

function wireTmdbButton(mediaType, titleGetter) {
  const btn = document.getElementById("tmdb-fill");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const query = titleGetter();
    if (!query) return;
    btn.disabled = true;
    btn.textContent = "가져오는 중…";
    const info = await tmdbLookup(mediaType, query);
    btn.disabled = false;
    btn.textContent = "🔎 TMDB에서 정보 가져오기";
    if (!info) return;
    if (info.poster) document.getElementById("f-poster").value = info.poster;
    if (info.cast) document.getElementById("f-cast").value = info.cast;
    if (info.synopsis) document.getElementById("f-syn").value = info.synopsis;
    const bcField = document.getElementById("f-bc");
    if (bcField && info.broadcaster) bcField.value = info.broadcaster;
  });
}

// ====================== Wikipedia (한국어) auto-fill ======================
// No API key needed — ko.wikipedia.org's API allows anonymous cross-origin
// requests via origin=*. Good fallback for Korean variety shows / dramas
// that TMDB doesn't have.
function cleanWikitext(s) {
  return String(s || "")
    .replace(/\{\{[^{}]*\}\}/g, "")           // strip nested templates (refs, etc.)
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1") // [[link|label]] -> label
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<[^>]+>/g, "")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractInfoboxField(wikitext, names) {
  for (const name of names) {
    const re = new RegExp("\\|\\s*" + name + "\\s*=\\s*([^\\n]+)");
    const m = wikitext.match(re);
    if (m && m[1].trim()) return cleanWikitext(m[1]);
  }
  return "";
}

async function wikiLookup(query) {
  try {
    const searchUrl = `https://ko.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const hits = searchData.query && searchData.query.search;
    if (!hits || !hits.length) {
      alert(`"${query}"에 대한 위키백과 문서를 찾지 못했어요.`);
      return null;
    }
    const pageTitle = hits[0].title;

    const introUrl = `https://ko.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=true&explaintext=true&piprop=original&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`;
    const wikitextUrl = `https://ko.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`;
    const [introRes, wtRes] = await Promise.all([fetch(introUrl), fetch(wikitextUrl)]);
    const introData = await introRes.json();
    const wtData = await wtRes.json();

    const introPages = introData.query.pages;
    const introPage = introPages[Object.keys(introPages)[0]];
    const synopsis = (introPage.extract || "").trim();
    const poster = introPage.original ? introPage.original.source : "";

    const wtPages = wtData.query.pages;
    const wtPage = wtPages[Object.keys(wtPages)[0]];
    const wikitext = (wtPage.revisions && wtPage.revisions[0].slots.main["*"]) || "";

    const broadcaster = extractInfoboxField(wikitext, ["방송 채널", "방송채널", "채널", "방송사"]);
    const cast = extractInfoboxField(wikitext, ["출연자", "출연"]);

    return { poster, synopsis, broadcaster, cast, pageTitle };
  } catch (e) {
    console.warn("Wikipedia lookup failed", e);
    alert("위키백과에서 정보를 가져오는 중 문제가 생겼어요.");
    return null;
  }
}

function wireWikiButton(titleGetter) {
  const btn = document.getElementById("wiki-fill");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const query = titleGetter();
    if (!query) return;
    btn.disabled = true;
    btn.textContent = "가져오는 중…";
    const info = await wikiLookup(query);
    btn.disabled = false;
    btn.textContent = "📖 위키백과에서 정보 가져오기";
    if (!info) return;
    if (info.poster) document.getElementById("f-poster").value = info.poster;
    if (info.synopsis) document.getElementById("f-syn").value = info.synopsis;
    const bcField = document.getElementById("f-bc");
    if (bcField && info.broadcaster) bcField.value = info.broadcaster;
    if (info.cast) document.getElementById("f-cast").value = info.cast;
  });
}

// ---- Edit modal (poster/cast/synopsis/etc, shared by dramas/shows/movies; separate for travel/perf)
// ---- Detail popup (opened by clicking a poster) ----
function openDetailPopup(key, id) {
  const item = state[key].find(x => x.id === id);
  if (!item) return;

  const emoji = key === "movies" ? "🎬" : key === "performances" ? "🎫" : key === "exhibitions" ? "🖼️" : "📺";
  const posterHtml = item.poster
    ? `<img src="${escapeAttr(item.poster)}" alt="" style="width:100%;border-radius:12px;margin-bottom:14px;display:block;" onerror="this.style.display='none'">`
    : `<div style="width:100%;aspect-ratio:2/3;border-radius:12px;margin-bottom:14px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;text-align:center;padding:16px;background:${posterGradient(item.title)}">${emoji}<br>${escapeHtml(item.title)}</div>`;

  let metaHtml = "";
  let bodyText = "";

  if (key === "dramas" || key === "shows") {
    metaHtml = `
      ${item.broadcaster ? `${key === "dramas" ? "방송사" : "채널"}: ${escapeHtml(item.broadcaster)}<br>` : ""}
      ${item.cast ? `${escapeHtml(item.cast)}` : ""}
    `;
    bodyText = item.synopsis || "등록된 줄거리가 없어요. 편집에서 추가해보세요.";
  } else if (key === "movies") {
    metaHtml = item.cast ? escapeHtml(item.cast) : "";
    bodyText = item.synopsis || "등록된 줄거리가 없어요. 편집에서 추가해보세요.";
  } else if (key === "performances") {
    metaHtml = `
      날짜: ${escapeHtml(item.date)}<br>
      장소: ${escapeHtml(item.venue)}<br>
      좌석: ${escapeHtml(item.seat || "-")}<br>
      함께: ${escapeHtml(item.companions || "혼자")}<br>
      가격: ₩${Number(item.price || 0).toLocaleString()}
    `;
    bodyText = item.link ? `<a href="${escapeAttr(item.link)}" target="_blank" rel="noopener">예매 페이지 바로가기 ↗</a>` : "";
  } else if (key === "exhibitions") {
    metaHtml = `
      날짜: ${escapeHtml(item.date)}<br>
      장소: ${escapeHtml(item.venue)}<br>
      ${item.note ? `메모: ${escapeHtml(item.note)}<br>` : ""}
      함께: ${escapeHtml(item.companions || "혼자")}<br>
      가격: ₩${Number(item.price || 0).toLocaleString()}
    `;
    bodyText = item.link ? `<a href="${escapeAttr(item.link)}" target="_blank" rel="noopener">전시 페이지 바로가기 ↗</a>` : "";
  }

  const setlistBtn = (key === "performances" && item.setlist && item.setlist.length)
    ? `<button class="btn small" id="popup-setlist-toggle" style="margin-bottom:12px;">🎶 셋리스트 보기</button>
       <div id="popup-setlist" style="display:none; font-size:13px; line-height:1.9; color:var(--ink); margin-bottom:14px;">
         ${item.setlist.map(block => `<div style="margin-bottom:10px;">${block.map(song => escapeHtml(song)).join("<br>")}</div>`).join("")}
       </div>`
    : "";

  let statusHtml = "";
  if ((key === "dramas" || key === "shows") && item.status === "보는중") {
    statusHtml = `
      <button class="btn small" data-action="setStatus" data-key="${key}" data-id="${item.id}" data-status2="완료">완료로 표시</button>
      <button class="btn small" data-action="setStatus" data-key="${key}" data-id="${item.id}" data-status2="중도하차">중도하차로 표시</button>
    `;
  } else if ((key === "dramas" || key === "shows") && item.status !== "보는중") {
    statusHtml = `<button class="btn small" data-action="setStatus" data-key="${key}" data-id="${item.id}" data-status2="보는중">보는중으로 표시</button>`;
  }

  openModal(`
    ${posterHtml}
    <h3 style="margin:0 0 8px;">${escapeHtml(item.title)}</h3>
    ${metaHtml ? `<div class="hint" style="margin-bottom:10px;">${metaHtml}</div>` : ""}
    <div style="font-size:13px; line-height:1.6; color:var(--ink); margin-bottom:16px;">${bodyText}</div>
    ${setlistBtn}
    ${statusHtml ? `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">${statusHtml}</div>` : ""}
    <div class="modal-actions" style="justify-content:space-between;">
      <button class="btn danger" id="popup-delete">삭제</button>
      <div style="display:flex; gap:8px;">
        <button class="btn" id="popup-close">닫기</button>
        <button class="btn primary" id="popup-edit">편집</button>
      </div>
    </div>
  `);
  document.getElementById("popup-close").onclick = closeModal;
  document.getElementById("popup-edit").onclick = () => { closeModal(); openEditModal(key, id); };
  const setlistToggleBtn = document.getElementById("popup-setlist-toggle");
  if (setlistToggleBtn) {
    setlistToggleBtn.addEventListener("click", () => {
      const box = document.getElementById("popup-setlist");
      const open = box.style.display !== "none";
      box.style.display = open ? "none" : "block";
      setlistToggleBtn.textContent = open ? "🎶 셋리스트 보기" : "🎶 셋리스트 접기";
    });
  }
  document.getElementById("popup-delete").onclick = () => {
    if (!confirm("이 항목을 삭제할까요?")) return;
    state[key] = state[key].filter(x => x.id !== id);
    persistDelete(key, id);
    closeModal();
    render();
  };
  modalBody.querySelectorAll('[data-action="setStatus"]').forEach(btn => {
    btn.addEventListener("click", () => {
      item.status = btn.dataset.status2;
      persistUpsert(key, item);
      closeModal();
      render();
    });
  });
}

function openEditModal(key, id) {
  const item = state[key].find(x => x.id === id);
  if (!item) return;

  if (key === "dramas" || key === "shows") {
    openModal(`
      <h3>${escapeHtml(item.title)} 편집</h3>
      <div style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
        <button class="btn small" id="tmdb-fill">🔎 TMDB에서 정보 가져오기</button>
        <button class="btn small" id="wiki-fill">📖 위키백과에서 정보 가져오기</button>
      </div>
      <div class="hint">해외 영화·유명 드라마는 TMDB가, 한국 예능/일부 드라마는 위키백과가 더 잘 찾을 때가 많아요. 둘 다 안 되면 아래 링크로 직접 찾아 붙여넣어주세요. <a href="https://search.naver.com/search.naver?query=${encodeURIComponent(item.title)}" target="_blank" rel="noopener">네이버에서 검색 ↗</a></div>
      <div class="field"><label>제목</label><input id="f-title" value="${escapeAttr(item.title)}"></div>
      ${posterFieldHtml(item.poster)}
      <div class="field"><label>방송사/채널</label><input id="f-bc" value="${escapeAttr(item.broadcaster || "")}"></div>
      <div class="field"><label>배우 (쉼표로 구분)</label><input id="f-cast" value="${escapeAttr(item.cast || "")}"></div>
      <div class="field"><label>줄거리</label><textarea id="f-syn">${escapeHtml(item.synopsis || "")}</textarea></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">저장</button>
      </div>
    `);
    wireTmdbButton("tv", () => document.getElementById("f-title").value.trim() || item.title);
    wireWikiButton(() => document.getElementById("f-title").value.trim() || item.title);
    wireImageUpload();
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      item.title = document.getElementById("f-title").value.trim() || item.title;
      item.poster = document.getElementById("f-poster").value.trim();
      item.broadcaster = document.getElementById("f-bc").value.trim();
      item.cast = document.getElementById("f-cast").value.trim();
      item.synopsis = document.getElementById("f-syn").value.trim();
      persistUpsert(key, item); closeModal(); render();
    };
  } else if (key === "movies") {
    openModal(`
      <h3>${escapeHtml(item.title)} 편집</h3>
      <div style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
        <button class="btn small" id="tmdb-fill">🔎 TMDB에서 정보 가져오기</button>
        <button class="btn small" id="wiki-fill">📖 위키백과에서 정보 가져오기</button>
      </div>
      <div class="hint">해외 영화는 TMDB가 대체로 더 잘 찾아요. 안 되면 아래 링크로 직접 찾아 붙여넣어주세요. <a href="https://search.naver.com/search.naver?query=${encodeURIComponent(item.title)}" target="_blank" rel="noopener">네이버에서 검색 ↗</a></div>
      <div class="field"><label>제목</label><input id="f-title" value="${escapeAttr(item.title)}"></div>
      ${posterFieldHtml(item.poster)}
      <div class="field"><label>관람 방식</label>
        <select id="f-type"><option ${item.type==="OTT"?"selected":""}>OTT</option><option ${item.type==="영화관"?"selected":""}>영화관</option></select>
      </div>
      <div class="field"><label>배우 (쉼표로 구분)</label><input id="f-cast" value="${escapeAttr(item.cast || "")}"></div>
      <div class="field"><label>줄거리</label><textarea id="f-syn">${escapeHtml(item.synopsis || "")}</textarea></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">저장</button>
      </div>
    `);
    wireTmdbButton("movie", () => document.getElementById("f-title").value.trim() || item.title);
    wireWikiButton(() => document.getElementById("f-title").value.trim() || item.title);
    wireImageUpload();
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      item.title = document.getElementById("f-title").value.trim() || item.title;
      item.poster = document.getElementById("f-poster").value.trim();
      item.type = document.getElementById("f-type").value;
      item.cast = document.getElementById("f-cast").value.trim();
      item.synopsis = document.getElementById("f-syn").value.trim();
      persistUpsert(key, item); closeModal(); render();
    };
  } else if (key === "travels") {
    openModal(`
      <h3>${escapeHtml(item.destination)} 편집</h3>
      <div class="field"><label>목적지</label><input id="f-dest" value="${escapeAttr(item.destination)}"></div>
      <div class="field"><label>시작일</label><input id="f-start" type="date" value="${item.startDate}"></div>
      <div class="field"><label>종료일</label><input id="f-end" type="date" value="${item.endDate}"></div>
      <div class="field"><label>이동수단</label><input id="f-transport" value="${escapeAttr(item.transport)}"></div>
      <div class="field"><label>함께 (혼자면 "혼자")</label><input id="f-comp" value="${escapeAttr(item.companions || "")}"></div>
      <div class="field"><label>추정 편도 거리(km)</label><input id="f-km" type="number" value="${item.distanceKm || 0}"></div>
      <div class="field"><label>해외 여행인가요?</label><select id="f-intl"><option value="false" ${!item.international?"selected":""}>국내</option><option value="true" ${item.international?"selected":""}>해외</option></select></div>
      <div class="field"><label>총 여행 경비(원)</label><input id="f-cost" type="number" value="${item.cost || 0}"></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">저장</button>
      </div>
    `);
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      item.destination = document.getElementById("f-dest").value.trim();
      item.startDate = document.getElementById("f-start").value;
      item.endDate = document.getElementById("f-end").value;
      item.transport = document.getElementById("f-transport").value.trim();
      item.companions = document.getElementById("f-comp").value.trim();
      item.distanceKm = Number(document.getElementById("f-km").value) || 0;
      item.international = document.getElementById("f-intl").value === "true";
      item.solo = /^혼자$/.test(item.companions.trim());
      item.cost = Number(document.getElementById("f-cost").value) || 0;
      delete item.costs;
      persistUpsert(key, item); closeModal(); render();
    };
  } else if (key === "performances") {
    const setlistText = (item.setlist || []).map(block => block.join("\n")).join("\n\n");
    openModal(`
      <h3>${escapeHtml(item.title)} 편집</h3>
      ${posterFieldHtml(item.poster)}
      <div class="field"><label>공연명</label><input id="f-title" value="${escapeAttr(item.title)}"></div>
      <div class="field"><label>날짜</label><input id="f-date" type="date" value="${item.date}"></div>
      <div class="field"><label>장소</label><input id="f-venue" value="${escapeAttr(item.venue)}"></div>
      <div class="field"><label>가격(원)</label><input id="f-price" type="number" value="${item.price}"></div>
      <div class="field"><label>좌석</label><input id="f-seat" value="${escapeAttr(item.seat || "")}"></div>
      <div class="field"><label>함께 (혼자면 "혼자")</label><input id="f-comp" value="${escapeAttr(item.companions || "")}"></div>
      <div class="field"><label>예매 링크</label><input id="f-link" value="${escapeAttr(item.link || "")}"></div>
      <div class="field">
        <label>셋리스트 (한 줄에 한 곡, 구간은 빈 줄로 구분)</label>
        <textarea id="f-setlist" style="min-height:140px;">${escapeHtml(setlistText)}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">저장</button>
      </div>
    `);
    wireImageUpload();
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      item.poster = document.getElementById("f-poster").value.trim();
      item.title = document.getElementById("f-title").value.trim();
      item.date = document.getElementById("f-date").value;
      item.venue = document.getElementById("f-venue").value.trim();
      item.price = Number(document.getElementById("f-price").value) || 0;
      item.seat = document.getElementById("f-seat").value.trim();
      item.companions = document.getElementById("f-comp").value.trim();
      item.link = document.getElementById("f-link").value.trim();
      item.solo = /^혼자$/.test(item.companions.trim());
      const rawSetlist = document.getElementById("f-setlist").value;
      item.setlist = rawSetlist.trim()
        ? rawSetlist.split(/\n\s*\n/).map(block => block.split("\n").map(s => s.trim()).filter(Boolean)).filter(block => block.length)
        : [];
      persistUpsert(key, item); closeModal(); render();
    };
  } else if (key === "exhibitions") {
    openModal(`
      <h3>${escapeHtml(item.title)} 편집</h3>
      ${posterFieldHtml(item.poster)}
      <div class="field"><label>전시명</label><input id="f-title" value="${escapeAttr(item.title)}"></div>
      <div class="field"><label>날짜</label><input id="f-date" type="date" value="${item.date}"></div>
      <div class="field"><label>장소</label><input id="f-venue" value="${escapeAttr(item.venue)}"></div>
      <div class="field"><label>가격(원)</label><input id="f-price" type="number" value="${item.price}"></div>
      <div class="field"><label>메모 (작가, 작품 등)</label><input id="f-note" value="${escapeAttr(item.note || "")}"></div>
      <div class="field"><label>함께 (혼자면 "혼자")</label><input id="f-comp" value="${escapeAttr(item.companions || "")}"></div>
      <div class="field"><label>전시 페이지 링크</label><input id="f-link" value="${escapeAttr(item.link || "")}"></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">저장</button>
      </div>
    `);
    wireImageUpload();
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      item.poster = document.getElementById("f-poster").value.trim();
      item.title = document.getElementById("f-title").value.trim();
      item.date = document.getElementById("f-date").value;
      item.venue = document.getElementById("f-venue").value.trim();
      item.price = Number(document.getElementById("f-price").value) || 0;
      item.note = document.getElementById("f-note").value.trim();
      item.companions = document.getElementById("f-comp").value.trim();
      item.link = document.getElementById("f-link").value.trim();
      item.solo = /^혼자$/.test(item.companions.trim());
      persistUpsert(key, item); closeModal(); render();
    };
  }
}

// ---- Add modal
function openAddModal(key) {
  if (key === "dramas" || key === "shows") {
    openModal(`
      <h3>${key === "dramas" ? "드라마" : "예능&교양"} 추가</h3>
      <div class="hint">새로 추가하면 "보는중"으로 분류돼요.</div>
      <div class="field"><label>제목</label><input id="f-title" placeholder="제목을 입력하세요"></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">추가</button>
      </div>
    `);
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      const title = document.getElementById("f-title").value.trim();
      if (!title) return;
      const nextOrder = state[key].length ? Math.max(...state[key].map(x => x.order || 0)) + 1 : 1;
      const newItem = { id: uid(key[0]), title, status: "보는중", order: nextOrder };
      state[key].push(newItem);
      persistUpsert(key, newItem); closeModal(); render();
    };
  } else if (key === "movies") {
    openModal(`
      <h3>영화 추가</h3>
      <div class="field"><label>제목</label><input id="f-title" placeholder="제목을 입력하세요"></div>
      <div class="field"><label>관람 방식</label><select id="f-type"><option>영화관</option><option>OTT</option></select></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">추가</button>
      </div>
    `);
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      const title = document.getElementById("f-title").value.trim();
      if (!title) return;
      const order = state.movies.length ? Math.max(...state.movies.map(m => m.order)) + 1 : 1;
      const newItem = { id: uid("m"), order, title, type: document.getElementById("f-type").value };
      state.movies.push(newItem);
      persistUpsert("movies", newItem); closeModal(); render();
    };
  } else if (key === "travels") {
    openModal(`
      <h3>여행 추가</h3>
      <div class="field"><label>목적지</label><input id="f-dest" placeholder="예: 부산"></div>
      <div class="field"><label>시작일</label><input id="f-start" type="date"></div>
      <div class="field"><label>종료일</label><input id="f-end" type="date"></div>
      <div class="field"><label>이동수단</label><input id="f-transport" placeholder="KTX / 비행기 / 자차 등"></div>
      <div class="field"><label>함께 (혼자면 "혼자")</label><input id="f-comp" value="혼자"></div>
      <div class="field"><label>추정 편도 거리(km)</label><input id="f-km" type="number" value="0"></div>
      <div class="field"><label>해외 여행인가요?</label><select id="f-intl"><option value="false">국내</option><option value="true">해외</option></select></div>
      <div class="field"><label>총 여행 경비(원)</label><input id="f-cost" type="number" value="0"></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">추가</button>
      </div>
    `);
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      const destination = document.getElementById("f-dest").value.trim();
      const startDate = document.getElementById("f-start").value;
      if (!destination || !startDate) return;
      const endDate = document.getElementById("f-end").value || startDate;
      const companions = document.getElementById("f-comp").value.trim() || "혼자";
      const newItem = {
        id: uid("t"), destination, startDate, endDate,
        transport: document.getElementById("f-transport").value.trim(),
        companions, solo: /^혼자$/.test(companions),
        distanceKm: Number(document.getElementById("f-km").value) || 0,
        international: document.getElementById("f-intl").value === "true",
        cost: Number(document.getElementById("f-cost").value) || 0
      };
      state.travels.push(newItem);
      persistUpsert("travels", newItem); closeModal(); render();
    };
  } else if (key === "performances") {
    openModal(`
      <h3>공연 추가</h3>
      ${posterFieldHtml("")}
      <div class="field"><label>공연명</label><input id="f-title" placeholder="공연명을 입력하세요"></div>
      <div class="field"><label>날짜</label><input id="f-date" type="date"></div>
      <div class="field"><label>장소</label><input id="f-venue" placeholder="공연장"></div>
      <div class="field"><label>가격(원)</label><input id="f-price" type="number" value="0"></div>
      <div class="field"><label>좌석</label><input id="f-seat" placeholder="좌석 정보"></div>
      <div class="field"><label>함께 (혼자면 "혼자")</label><input id="f-comp" value="혼자"></div>
      <div class="field"><label>예매 링크</label><input id="f-link" placeholder="https://"></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">추가</button>
      </div>
    `);
    wireImageUpload();
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      const title = document.getElementById("f-title").value.trim();
      const date = document.getElementById("f-date").value;
      if (!title || !date) return;
      const companions = document.getElementById("f-comp").value.trim() || "혼자";
      const newItem = {
        id: uid("p"), title, date,
        poster: document.getElementById("f-poster").value.trim(),
        venue: document.getElementById("f-venue").value.trim(),
        price: Number(document.getElementById("f-price").value) || 0,
        seat: document.getElementById("f-seat").value.trim(),
        companions, solo: /^혼자$/.test(companions),
        link: document.getElementById("f-link").value.trim()
      };
      state.performances.push(newItem);
      persistUpsert("performances", newItem); closeModal(); render();
    };
  } else if (key === "exhibitions") {
    openModal(`
      <h3>전시 추가</h3>
      ${posterFieldHtml("")}
      <div class="field"><label>전시명</label><input id="f-title" placeholder="전시명을 입력하세요"></div>
      <div class="field"><label>날짜</label><input id="f-date" type="date"></div>
      <div class="field"><label>장소</label><input id="f-venue" placeholder="전시장"></div>
      <div class="field"><label>가격(원)</label><input id="f-price" type="number" value="0"></div>
      <div class="field"><label>메모 (작가, 작품 등)</label><input id="f-note" placeholder="선택 사항"></div>
      <div class="field"><label>함께 (혼자면 "혼자")</label><input id="f-comp" value="혼자"></div>
      <div class="field"><label>전시 페이지 링크</label><input id="f-link" placeholder="https://"></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">추가</button>
      </div>
    `);
    wireImageUpload();
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      const title = document.getElementById("f-title").value.trim();
      const date = document.getElementById("f-date").value;
      if (!title || !date) return;
      const companions = document.getElementById("f-comp").value.trim() || "혼자";
      const newItem = {
        id: uid("ex"), title, date,
        poster: document.getElementById("f-poster").value.trim(),
        venue: document.getElementById("f-venue").value.trim(),
        price: Number(document.getElementById("f-price").value) || 0,
        note: document.getElementById("f-note").value.trim(),
        companions, solo: /^혼자$/.test(companions),
        link: document.getElementById("f-link").value.trim()
      };
      state.exhibitions.push(newItem);
      persistUpsert("exhibitions", newItem); closeModal(); render();
    };
  }
}

// ====================== Clock ======================
function updateClock() {
  const el = document.getElementById("gate-clock");
  if (!el) return;
  const now = new Date();
  el.innerHTML = `2026 결산 진행 중<br><b>${now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}</b>`;
}

// ====================== One-time data migration ======================
// Backfills the "order" field (viewing sequence) onto existing drama/show
// records that predate it, and adds any item that was in the user's list but
// missing from the live data (e.g. 참교육). Runs once per browser via a
// localStorage flag, and pushes fixes back to Supabase if connected.
const DRAMA_ORDER_MAP = {
  "프로보노": [1, "완료"], "기묘한 이야기 시즌5": [2, "완료"], "자백의 대가": [3, "완료"],
  "당신이 죽였다": [4, "완료"], "언더커버 미쓰홍": [5, "완료"], "브리저튼 시즌4": [6, "완료"],
  "샬럿 왕비 : 브리저튼 외전": [7, "완료"], "레이디 두아": [8, "완료"], "프렌즈 시즌1": [9, "완료"],
  "사랑의 이해": [10, "완료"], "은중과 상연": [11, "완료"], "월간남친": [12, "완료"],
  "닥터신": [13, "완료"], "샤이닝": [14, "완료"], "유미의 세포들3": [15, "완료"],
  "허수아비": [16, "완료"], "멋진 신세계": [17, "완료"], "프렌즈 시즌2": [18, "완료"],
  "옥씨부인전": [19, "완료"], "백번의추억": [20, "완료"], "맨 끝줄 소년": [21, "완료"],
  "결혼의 완성": [22, "보는중"], "더 글로리": [23, "보는중"], "동궁": [24, "보는중"],
  "메이드 인 코리아": [25, "중도하차"], "은애하는 도적님아": [26, "중도하차"],
  "은밀한 감사": [27, "중도하차"], "취사병 전설이 되다": [28, "중도하차"],
  "신입사원 강회장": [29, "중도하차"], "참교육": [30, "중도하차"], "김부장": [31, "중도하차"]
};
const SHOW_ORDER_MAP = {
  "흑백요리사2": 1, "냉장고를 부탁해": 2, "풍향고 시즌2": 3,
  "스카이스크레이퍼 라이브 : 초고층 빌딩을 오르다": 4, "제프리 앱스타인 : 괴물이 된 억만장자": 5,
  "철학자의 요리": 6, "더 코리안 셰프": 7, "이서진의 달라달라": 8, "유퀴즈온더블록": 9,
  "공양간의 셰프들": 10, "다큐3일": 11, "마이클잭슨 재판 : 평결": 12,
  "콩콩팜팜": 13, "언더커버 셰프": 14, "모태솔로지만 연애는 하고싶어2": 15, "스트릿 레스토랑 파이터": 16
};

async function migrateOrderFields() {
  const FLAG = "recap2026_order_migration_v2";
  try { if (localStorage.getItem(FLAG) === "done") return; } catch (e) {}

  let changed = false;

  // Viewing order for the original items now comes from their stable id
  // (d1..d31 / s1..s16) rather than the stored "order" field or title text,
  // so this migration only needs to make sure nothing from the original
  // list is missing (e.g. 참교육, which was added after the initial seed).
  if (!state.dramas.some(x => x.title === "참교육")) {
    const newItem = { id: uid("d"), title: "참교육", status: "중도하차", order: 30 };
    state.dramas.push(newItem);
    persistUpsert("dramas", newItem);
    changed = true;
  }

  try { localStorage.setItem(FLAG, "done"); } catch (e) {}
  if (changed) render();
}

// Genre was removed from the app (card face, detail popup, edit form), so
// this clears out any genre values that were entered before that change.
async function clearGenreField() {
  const FLAG = "recap2026_genre_removed_v1";
  try { if (localStorage.getItem(FLAG) === "done") return; } catch (e) {}

  let changed = false;
  ["dramas", "shows"].forEach(key => {
    state[key].forEach(item => {
      if (item.genre) {
        delete item.genre;
        changed = true;
        persistUpsert(key, item);
      }
    });
  });

  try { localStorage.setItem(FLAG, "done"); } catch (e) {}
  if (changed) render();
}

// Same broadcaster ended up spelled two different ways (e.g. TMDB auto-fill
// returning "Netflix" vs a manually-typed "넷플릭스") — this normalizes known
// variants to one consistent label so the badge color/filter/insights treat
// them as the same channel.
const BROADCASTER_ALIASES = {
  "넷플릭스": "Netflix",
  "디즈니플러스": "Disney+",
  "디즈니 플러스": "Disney+",
  "티빙": "TVING",
  "웨이브": "Wavve",
  "쿠팡플레이": "Coupang Play",
  "kbs2tv": "KBS2",
  "kbs 2tv": "KBS2",
  "kbs2 tv": "KBS2",
  "kbs 2": "KBS2"
};
async function normalizeBroadcasterNames() {
  const FLAG = "recap2026_broadcaster_normalize_v2";
  try { if (localStorage.getItem(FLAG) === "done") return; } catch (e) {}

  let changed = false;
  ["dramas", "shows"].forEach(key => {
    state[key].forEach(item => {
      const raw = (item.broadcaster || "").trim();
      const alias = BROADCASTER_ALIASES[raw] || BROADCASTER_ALIASES[raw.toLowerCase()];
      if (alias && item.broadcaster !== alias) {
        item.broadcaster = alias;
        changed = true;
        persistUpsert(key, item);
      }
    });
  });

  try { localStorage.setItem(FLAG, "done"); } catch (e) {}
  if (changed) render();
}

// ====================== Init ======================
async function boot() {
  updateClock();
  setSyncStatus("연결 확인 중…");
  await initState();
  await migrateOrderFields();
  await clearGenreField();
  await normalizeBroadcasterNames();
  render();
}
boot();
