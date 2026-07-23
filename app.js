// ====================== State ======================
const STORAGE_KEY = "recap2026_v1";
const CATEGORIES = ["dramas", "movies", "shows", "travels", "performances"];
const TABLE = "recap_items";

const hasSupabaseConfig =
  typeof SUPABASE_URL === "string" && SUPABASE_URL.trim() &&
  typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.trim() &&
  window.supabase;

const sb = hasSupabaseConfig ? window.supabase.createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim()) : null;

let state = { dramas: [], movies: [], shows: [], travels: [], performances: [] };

function emptyState() { return { dramas: [], movies: [], shows: [], travels: [], performances: [] }; }

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
  { key: "dramas", label: "드라마", gate: "01", emoji: "📺" },
  { key: "movies", label: "영화", gate: "02", emoji: "🎥" },
  { key: "shows", label: "예능&교양", gate: "03", emoji: "📺" },
  { key: "performances", label: "공연", gate: "04", emoji: "🫶🏻" },
  { key: "travels", label: "여행", gate: "05", emoji: "✈️" }
];

let activeTab = "dramas";

const STATUS_COLOR = { "완료": "var(--accent-soft)", "보는중": "var(--mint)", "중도하차": "var(--deep)" };
const STATUS_ORDER = ["보는중", "완료", "중도하차"];

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
    <div id="insights"></div>
    <div id="content"></div>
  `;
  document.getElementById("insights").innerHTML = renderInsights(activeTab);
  document.getElementById("content").innerHTML = renderContent(activeTab);
  attachEvents();
}

function renderTabs() {
  return `<div class="tabs" role="tablist">
    ${TABS.map(t => `
      <button class="tab-btn ${t.key === activeTab ? "active" : ""}" data-tab="${t.key}" role="tab" aria-selected="${t.key === activeTab}">
        <span class="gate-no">GATE ${t.gate}</span> ${t.emoji} ${t.label}
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

function renderInsights(tab) {
  if (tab === "dramas" || tab === "shows") {
    const list = state[tab];
    const done = list.filter(x => x.status === "완료").length;
    const watching = list.filter(x => x.status === "보는중").length;
    const dropped = list.filter(x => x.status === "중도하차").length;
    const castCounts = topCounts(list.map(x => x.cast).filter(Boolean), /[,\/]/);
    const genreCounts = topCounts(list.map(x => x.genre).filter(Boolean), /[,\/]/);
    const bcCounts = topCounts(list.map(x => x.broadcaster).filter(Boolean), /[,\/]/);
    return `<div class="insights">
      ${insightCard(done, "시청 완료", `보는 중 ${watching} · 중도하차 ${dropped}`)}
      ${insightCard(list.length, "전체 등록 편수", null)}
      ${genreCounts.length ? insightCard(genreCounts[0][0], "최다 장르", `${genreCounts[0][1]}편 · 카드 편집에서 장르를 태그해보세요`) : insightCard("—", "최다 장르", "카드의 편집 버튼에서 장르를 추가하면 여기 표시돼요")}
      ${castCounts.length ? insightCard(castCounts[0][0], "최다 등장 배우/출연진", `${castCounts[0][1]}편에 등장`) : insightCard("—", "최다 등장 배우/출연진", "카드의 편집 버튼에서 배우를 추가하면 여기 표시돼요")}
      ${bcCounts.length ? insightCard(bcCounts[0][0], "최다 방송사/채널", `${bcCounts[0][1]}편`) : ""}
    </div>`;
  }

  if (tab === "movies") {
    const list = state.movies;
    const ott = list.filter(x => x.type === "OTT").length;
    const theater = list.filter(x => x.type === "영화관").length;
    const castCounts = topCounts(list.map(x => x.cast).filter(Boolean), /[,\/]/);
    return `<div class="insights">
      ${insightCard(list.length, "총 관람 편수", null)}
      ${insightCard(`${theater} : ${ott}`, "영화관 : OTT 비중", `영화관 ${theater}편 · OTT ${ott}편`)}
      ${insightCard(Math.round((theater / list.length) * 100) + "%", "영화관 관람 비중", null)}
      ${castCounts.length ? insightCard(castCounts[0][0], "최다 등장 배우", `${castCounts[0][1]}편에 등장`) : insightCard("—", "최다 등장 배우", "카드의 편집 버튼에서 배우를 추가해보세요")}
    </div>`;
  }

  if (tab === "travels") {
    const list = state.travels;
    const domestic = list.filter(x => !x.international).length;
    const intl = list.filter(x => x.international).length;
    const solo = list.filter(x => x.solo).length;
    const withOthers = list.length - solo;
    const totalKm = list.reduce((a, x) => a + (Number(x.distanceKm) || 0), 0);
    // strip "지역: " style labels before counting companions
    const flat = list.map(x => (x.companions || "").replace(/[가-힣]+:\s*/g, "")).join(",");
    const counts2 = topCounts([flat], /,/);
    return `<div class="insights">
      ${insightCard(list.length, "총 여행 횟수", null)}
      ${insightCard(`${domestic} : ${intl}`, "국내 : 해외", `국내 ${domestic}회 · 해외 ${intl}회`)}
      ${insightCard(`${solo} : ${withOthers}`, "혼자 : 동행", `혼자 ${solo}회 · 동행 ${withOthers}회`)}
      ${insightCard(totalKm.toLocaleString(), "총 이동 거리(km, 추정)", "KTX는 서울역, 국내선은 김포·해외는 인천 기준 편도 추정치")}
      ${counts2.length ? insightCard(counts2[0][0], "최다 동행", `${counts2[0][1]}회 함께함`) : ""}
    </div>`;
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
    return `<div class="insights">
      ${insightCard(list.length, "총 관람 횟수", null)}
      ${insightCard("₩" + total.toLocaleString(), "총 지출", `평균 ₩${avg.toLocaleString()} / 회`)}
      ${insightCard(`${solo} : ${withOthers}`, "혼자 : 동행", `혼자 ${solo}회 · 동행 ${withOthers}회`)}
      ${topTitle ? insightCard(topTitle[0], "가장 많이 본 공연", `${topTitle[1]}회 관람`) : ""}
    </div>`;
  }

  return "";
}

// ====================== Content ======================
function renderContent(tab) {
  if (tab === "dramas") return renderMediaTab("dramas", "📺", true, "방송사/채널", "주연배우");
  if (tab === "shows") return renderMediaTab("shows", "📺", true, "방송사/채널", "출연진");
  if (tab === "movies") return renderMoviesTab();
  if (tab === "travels") return renderTravelsTab();
  if (tab === "performances") return renderPerformancesTab();
  return "";
}

function renderMediaTab(key, emoji, grouped, bcLabel, castLabel) {
  const list = state[key];
  const addBtn = `<div class="section-row"><h2>${TABS.find(t=>t.key===key).label} 목록</h2><button class="btn primary" data-add="${key}">+ 추가하기</button></div>`;
  if (!grouped) return addBtn + renderGrid(list, key, emoji, bcLabel, castLabel);

  const groups = STATUS_ORDER.map(status => ({
    status, items: list.filter(x => x.status === status)
  }));

  return addBtn + groups.map(g => `
    <div class="status-group">
      <div class="status-title"><span class="dot" style="background:${STATUS_COLOR[g.status]}"></span>${g.status} <span class="count">${g.items.length}편</span></div>
      ${g.items.length ? renderGrid(g.items, key, emoji, bcLabel, castLabel) : `<div class="empty-state">아직 항목이 없어요</div>`}
    </div>
  `).join("");
}

function renderGrid(items, key, emoji, bcLabel, castLabel) {
  return `<div class="grid">${items.map(item => mediaCard(item, key, emoji, bcLabel, castLabel)).join("")}</div>`;
}

function mediaCard(item, key, emoji, bcLabel, castLabel) {
  const bg = item.poster ? "" : `style="background:${posterGradient(item.title)}"`;
  const statusButtons = key !== "movies" && item.status === "보는중" ? `
    <button class="btn small" data-action="setStatus" data-key="${key}" data-id="${item.id}" data-status="완료">완료</button>
    <button class="btn small" data-action="setStatus" data-key="${key}" data-id="${item.id}" data-status="중도하차">중도하차</button>
  ` : "";
  const reopenBtn = key !== "movies" && item.status !== "보는중" ? `
    <button class="btn small" data-action="setStatus" data-key="${key}" data-id="${item.id}" data-status="보는중">보는중으로</button>
  ` : "";
  return `
  <div class="stub" data-card-id="${item.id}">
    <div class="poster" ${bg}>${posterBlock(item, emoji)}</div>
    <div class="tear"></div>
    <div class="info">
      <div class="title">${escapeHtml(item.title)}</div>
      <div class="meta">
        ${item.broadcaster ? `${escapeHtml(bcLabel)}: ${escapeHtml(item.broadcaster)}<br>` : ""}
        ${item.cast ? `${escapeHtml(castLabel)}: ${escapeHtml(item.cast)}<br>` : ""}
        ${item.genre ? `장르: ${escapeHtml(item.genre)}` : ""}
      </div>
      ${item.synopsis ? `
        <button class="synopsis-toggle" data-action="toggleSyn">줄거리 보기 ▾</button>
        <div class="synopsis">${escapeHtml(item.synopsis)}</div>
      ` : ""}
      <div class="actions">
        ${statusButtons}${reopenBtn}
        <button class="btn small" data-action="edit" data-key="${key}" data-id="${item.id}">편집</button>
        <button class="btn small" data-action="search" data-title="${escapeAttr(item.title)}">포털검색</button>
        <button class="btn small danger" data-action="delete" data-key="${key}" data-id="${item.id}">삭제</button>
      </div>
    </div>
  </div>`;
}

function renderMoviesTab() {
  const list = [...state.movies].sort((a, b) => a.order - b.order);
  const addBtn = `<div class="section-row"><h2>영화 목록</h2><button class="btn primary" data-add="movies">+ 추가하기</button></div>`;
  return addBtn + `<div class="grid">${list.map(item => movieCard(item)).join("")}</div>`;
}

function movieCard(item) {
  const bg = item.poster ? "" : `style="background:${posterGradient(item.title)}"`;
  const badgeColor = item.type === "OTT" ? "var(--accent-soft)" : "var(--deep)";
  return `
  <div class="stub" data-card-id="${item.id}">
    <span class="badge" style="background:${badgeColor}">${item.order}. ${escapeHtml(item.type)}</span>
    <div class="poster" ${bg}>${posterBlock(item, "🎬")}</div>
    <div class="tear"></div>
    <div class="info">
      <div class="title">${escapeHtml(item.title)}</div>
      <div class="meta">${item.cast ? `주연배우: ${escapeHtml(item.cast)}` : ""}</div>
      ${item.synopsis ? `
        <button class="synopsis-toggle" data-action="toggleSyn">줄거리 보기 ▾</button>
        <div class="synopsis">${escapeHtml(item.synopsis)}</div>
      ` : ""}
      <div class="actions">
        <button class="btn small" data-action="edit" data-key="movies" data-id="${item.id}">편집</button>
        <button class="btn small" data-action="search" data-title="${escapeAttr(item.title)}">포털검색</button>
        <button class="btn small danger" data-action="delete" data-key="movies" data-id="${item.id}">삭제</button>
      </div>
    </div>
  </div>`;
}

function renderTravelsTab() {
  const list = [...state.travels].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const addBtn = `<div class="section-row"><h2>여행 목록</h2><button class="btn primary" data-add="travels">+ 추가하기</button></div>`;
  return addBtn + `<div class="grid" style="grid-template-columns:1fr;">${list.map(t => travelRow(t)).join("")}</div>`;
}

function fmtDateRange(a, b) {
  const f = d => d.slice(5).replace("-", "/");
  return a === b ? f(a) : `${f(a)}~${f(b)}`;
}

function travelRow(t) {
  const tagColor = t.international ? "var(--deep)" : "var(--accent)";
  return `
  <div class="list-stub" data-card-id="${t.id}">
    <div class="lead">
      <div class="num">${fmtDateRange(t.startDate, t.endDate)}</div>
      <div class="tag" style="background:${tagColor}">${t.international ? "해외" : "국내"}</div>
    </div>
    <div class="body">
      <div class="title">${escapeHtml(t.destination)} ${t.solo ? "· 혼자" : ""}</div>
      <div class="meta">
        <b>이동수단</b> ${escapeHtml(t.transport)} · <b>동행</b> ${escapeHtml(t.companions || "혼자")}<br>
        <b>추정 이동거리</b> 편도 약 ${Number(t.distanceKm || 0).toLocaleString()}km
      </div>
    </div>
    <div class="right">
      <button class="btn small" data-action="edit" data-key="travels" data-id="${t.id}">편집</button>
      <button class="btn small danger" data-action="delete" data-key="travels" data-id="${t.id}">삭제</button>
    </div>
  </div>`;
}

function renderPerformancesTab() {
  const list = [...state.performances].sort((a, b) => a.date.localeCompare(b.date));
  const addBtn = `<div class="section-row"><h2>공연 목록</h2><button class="btn primary" data-add="performances">+ 추가하기</button></div>`;
  return addBtn + `<div class="grid" style="grid-template-columns:1fr;">${list.map(p => perfRow(p)).join("")}</div>`;
}

function perfRow(p) {
  return `
  <div class="list-stub" data-card-id="${p.id}">
    <div class="lead">
      <div class="num">${p.date.slice(5).replace("-", "/")}</div>
      <div class="tag" style="background:${p.solo ? "var(--accent)" : "var(--deep)"}">${p.solo ? "혼자" : "동행"}</div>
    </div>
    <div class="body">
      <div class="title">${p.link ? `<a href="${escapeAttr(p.link)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;">${escapeHtml(p.title)} ↗</a>` : escapeHtml(p.title)}</div>
      <div class="meta">
        <b>장소</b> ${escapeHtml(p.venue)}<br>
        <b>좌석</b> ${escapeHtml(p.seat || "-")} ${p.companions && p.companions !== "혼자" ? `· <b>동행</b> ${escapeHtml(p.companions)}` : ""}
      </div>
    </div>
    <div class="right">
      <div class="price">₩${Number(p.price || 0).toLocaleString()}</div>
      <button class="btn small" data-action="edit" data-key="performances" data-id="${p.id}">편집</button>
      <button class="btn small danger" data-action="delete" data-key="performances" data-id="${p.id}">삭제</button>
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
  root.querySelectorAll('[data-action="toggleSyn"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const box = btn.nextElementSibling;
      box.classList.toggle("open");
      btn.textContent = box.classList.contains("open") ? "줄거리 접기 ▴" : "줄거리 보기 ▾";
    });
  });
}

// ====================== Modal helpers ======================
const modalOverlay = document.getElementById("modal-overlay");
const modalBody = document.getElementById("modal-body");

function closeModal() { modalOverlay.classList.remove("open"); modalBody.innerHTML = ""; }
modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closeModal(); });
document.getElementById("modal-close").addEventListener("click", closeModal);

function openModal(html) { modalBody.innerHTML = html; modalOverlay.classList.add("open"); }

// ---- Edit modal (poster/cast/synopsis/etc, shared by dramas/shows/movies; separate for travel/perf)
function openEditModal(key, id) {
  const item = state[key].find(x => x.id === id);
  if (!item) return;

  if (key === "dramas" || key === "shows") {
    openModal(`
      <h3>${escapeHtml(item.title)} 편집</h3>
      <div class="hint">포스터는 직접 찾은 이미지 URL을 붙여넣어 주세요. <a href="https://search.naver.com/search.naver?query=${encodeURIComponent(item.title + " 포스터")}" target="_blank" rel="noopener">네이버에서 포스터 검색 ↗</a></div>
      <div class="field"><label>포스터 이미지 URL</label><input id="f-poster" value="${escapeAttr(item.poster || "")}"></div>
      <div class="field"><label>방송사/채널</label><input id="f-bc" value="${escapeAttr(item.broadcaster || "")}"></div>
      <div class="field"><label>${key === "dramas" ? "주연배우" : "출연진"} (쉼표로 구분)</label><input id="f-cast" value="${escapeAttr(item.cast || "")}"></div>
      <div class="field"><label>장르 (쉼표로 구분)</label><input id="f-genre" value="${escapeAttr(item.genre || "")}"></div>
      <div class="field"><label>줄거리</label><textarea id="f-syn">${escapeHtml(item.synopsis || "")}</textarea></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">저장</button>
      </div>
    `);
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      item.poster = document.getElementById("f-poster").value.trim();
      item.broadcaster = document.getElementById("f-bc").value.trim();
      item.cast = document.getElementById("f-cast").value.trim();
      item.genre = document.getElementById("f-genre").value.trim();
      item.synopsis = document.getElementById("f-syn").value.trim();
      persistUpsert(key, item); closeModal(); render();
    };
  } else if (key === "movies") {
    openModal(`
      <h3>${escapeHtml(item.title)} 편집</h3>
      <div class="hint">포스터는 직접 찾은 이미지 URL을 붙여넣어 주세요. <a href="https://search.naver.com/search.naver?query=${encodeURIComponent(item.title + " 포스터")}" target="_blank" rel="noopener">네이버에서 포스터 검색 ↗</a></div>
      <div class="field"><label>포스터 이미지 URL</label><input id="f-poster" value="${escapeAttr(item.poster || "")}"></div>
      <div class="field"><label>관람 방식</label>
        <select id="f-type"><option ${item.type==="OTT"?"selected":""}>OTT</option><option ${item.type==="영화관"?"selected":""}>영화관</option></select>
      </div>
      <div class="field"><label>주연배우 (쉼표로 구분)</label><input id="f-cast" value="${escapeAttr(item.cast || "")}"></div>
      <div class="field"><label>줄거리</label><textarea id="f-syn">${escapeHtml(item.synopsis || "")}</textarea></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">저장</button>
      </div>
    `);
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
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
      <div class="field"><label>동행 (혼자면 "혼자")</label><input id="f-comp" value="${escapeAttr(item.companions || "")}"></div>
      <div class="field"><label>추정 편도 거리(km)</label><input id="f-km" type="number" value="${item.distanceKm || 0}"></div>
      <div class="field"><label>해외 여행인가요?</label><select id="f-intl"><option value="false" ${!item.international?"selected":""}>국내</option><option value="true" ${item.international?"selected":""}>해외</option></select></div>
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
      persistUpsert(key, item); closeModal(); render();
    };
  } else if (key === "performances") {
    openModal(`
      <h3>${escapeHtml(item.title)} 편집</h3>
      <div class="field"><label>공연명</label><input id="f-title" value="${escapeAttr(item.title)}"></div>
      <div class="field"><label>날짜</label><input id="f-date" type="date" value="${item.date}"></div>
      <div class="field"><label>장소</label><input id="f-venue" value="${escapeAttr(item.venue)}"></div>
      <div class="field"><label>가격(원)</label><input id="f-price" type="number" value="${item.price}"></div>
      <div class="field"><label>좌석</label><input id="f-seat" value="${escapeAttr(item.seat || "")}"></div>
      <div class="field"><label>동행 (혼자면 "혼자")</label><input id="f-comp" value="${escapeAttr(item.companions || "")}"></div>
      <div class="field"><label>예매 링크</label><input id="f-link" value="${escapeAttr(item.link || "")}"></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">저장</button>
      </div>
    `);
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      item.title = document.getElementById("f-title").value.trim();
      item.date = document.getElementById("f-date").value;
      item.venue = document.getElementById("f-venue").value.trim();
      item.price = Number(document.getElementById("f-price").value) || 0;
      item.seat = document.getElementById("f-seat").value.trim();
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
      const newItem = { id: uid(key[0]), title, status: "보는중" };
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
      <div class="field"><label>동행 (혼자면 "혼자")</label><input id="f-comp" value="혼자"></div>
      <div class="field"><label>추정 편도 거리(km)</label><input id="f-km" type="number" value="0"></div>
      <div class="field"><label>해외 여행인가요?</label><select id="f-intl"><option value="false">국내</option><option value="true">해외</option></select></div>
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
        international: document.getElementById("f-intl").value === "true"
      };
      state.travels.push(newItem);
      persistUpsert("travels", newItem); closeModal(); render();
    };
  } else if (key === "performances") {
    openModal(`
      <h3>공연 추가</h3>
      <div class="field"><label>공연명</label><input id="f-title" placeholder="공연명을 입력하세요"></div>
      <div class="field"><label>날짜</label><input id="f-date" type="date"></div>
      <div class="field"><label>장소</label><input id="f-venue" placeholder="공연장"></div>
      <div class="field"><label>가격(원)</label><input id="f-price" type="number" value="0"></div>
      <div class="field"><label>좌석</label><input id="f-seat" placeholder="좌석 정보"></div>
      <div class="field"><label>동행 (혼자면 "혼자")</label><input id="f-comp" value="혼자"></div>
      <div class="field"><label>예매 링크</label><input id="f-link" placeholder="https://"></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">취소</button>
        <button class="btn primary" id="modal-save">추가</button>
      </div>
    `);
    document.getElementById("modal-cancel").onclick = closeModal;
    document.getElementById("modal-save").onclick = () => {
      const title = document.getElementById("f-title").value.trim();
      const date = document.getElementById("f-date").value;
      if (!title || !date) return;
      const companions = document.getElementById("f-comp").value.trim() || "혼자";
      const newItem = {
        id: uid("p"), title, date,
        venue: document.getElementById("f-venue").value.trim(),
        price: Number(document.getElementById("f-price").value) || 0,
        seat: document.getElementById("f-seat").value.trim(),
        companions, solo: /^혼자$/.test(companions),
        link: document.getElementById("f-link").value.trim()
      };
      state.performances.push(newItem);
      persistUpsert("performances", newItem); closeModal(); render();
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

// ====================== Init ======================
async function boot() {
  updateClock();
  setSyncStatus("연결 확인 중…");
  await initState();
  render();
}
boot();
