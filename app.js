if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

const SUPABASE_URL = "https://ptukvvbnbqbahwobitls.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0dWt2dmJuYnFiYWh3b2JpdGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODgzMzAsImV4cCI6MjA5MzE2NDMzMH0.P3Gwipqpc2poADf01mzcgl3p9V63LhdfCIi-JYIvfWQ";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

async function getAuthToken() {
  try {
    const raw = localStorage.getItem("sb-ptukvvbnbqbahwobitls-auth-token");
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.access_token || null;
    }
  } catch {}
  return null;
}

async function dbInsert(table, payload) {
  const token = await getAuthToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${token || SUPABASE_ANON}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    return { error: err };
  }
  return { error: null };
}

async function dbUpdate(table, payload, id) {
  const token = await getAuthToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${token || SUPABASE_ANON}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    return { error: err };
  }
  return { error: null };
}

async function dbDelete(table, id) {
  const token = await getAuthToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${token || SUPABASE_ANON}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    return { error: err };
  }
  return { error: null };
}

async function dbSelect(table) {
  const token = await getAuthToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=date.asc,start_time.asc`, {
    headers: {
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${token || SUPABASE_ANON}`,
    },
  });
  if (!res.ok) return { data: null, error: await res.json().catch(() => ({})) };
  const data = await res.json();
  return { data, error: null };
}

async function dbSelectNotices() {
  const token = await getAuthToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notices?select=*&order=created_at.desc`, {
    headers: {
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${token || SUPABASE_ANON}`,
    },
  });
  if (!res.ok) return { data: null, error: await res.json().catch(() => ({})) };
  return { data: await res.json(), error: null };
}

// Doctor names mapped to emails (set these emails when creating users in Supabase Auth)
const DOCTORS = [
  "Остап (головний лікар)",
  "Юрій (лікар)",
  "Устим (асистент)",
  "Іван (асистент)",
  "Ірина (асистент)",
];

// Timeline config
const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_HEIGHT = window.innerWidth < 760 ? 56 : 72; // px per hour

let selectedDate = new Date();
selectedDate.setHours(0, 0, 0, 0);
let selectedDoctor = "Всі лікарі";
let activeView = "day";
let activeTab = "calendar";
let editingId = null;
let appointments = [];
let currentUser = null;
let realtimeChannel = null;

// ─── DOM refs ───────────────────────────────────────────────────────────────

const els = {
  loginScreen: document.getElementById("loginScreen"),
  loginForm: document.getElementById("loginForm"),
  loginBtn: document.getElementById("loginBtn"),
  loginError: document.getElementById("loginError"),
  appShell: document.getElementById("appShell"),
  railUser: document.getElementById("railUser"),
  logoutBtn: document.getElementById("logoutBtn"),
  mobileLogoutBtn: document.getElementById("mobileLogoutBtn"),
  dayTitle: document.getElementById("dayTitle"),
  scheduleDate: document.getElementById("scheduleDate"),
  appointmentCount: document.getElementById("appointmentCount"),
  timelinePanel: document.getElementById("timelinePanel"),
  timelineGrid: document.getElementById("timelineGrid"),
  timelineWrap: document.getElementById("timelineWrap"),
  weekPanel: document.getElementById("weekPanel"),
  weekDate: document.getElementById("weekDate"),
  weekCount: document.getElementById("weekCount"),
  weekList: document.getElementById("weekList"),
  todayTotal: document.getElementById("todayTotal"),
  nextVisit: document.getElementById("nextVisit"),
  doctorFilter: document.getElementById("doctorFilter"),
  doctorFilterValue: document.getElementById("doctorFilterValue"),
  pulseDoctorPicker: document.getElementById("pulseDoctorPicker"),
  pulseDoctorValue: document.getElementById("pulseDoctorValue"),
  overlay: document.getElementById("overlay"),
  detailsSheet: document.getElementById("detailsSheet"),
  detailsContent: document.getElementById("detailsContent"),
  formSheet: document.getElementById("formSheet"),
  searchSheet: document.getElementById("searchSheet"),
  doctorSheet: document.getElementById("doctorSheet"),
  doctorOptions: document.getElementById("doctorOptions"),
  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),
  utilityPage: document.getElementById("utilityPage"),
  form: document.getElementById("appointmentForm"),
  formSaveBtn: document.getElementById("formSaveBtn"),
};

// ─── Auth ────────────────────────────────────────────────────────────────────

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = els.loginForm.elements.email.value.trim();
  const password = els.loginForm.elements.password.value;
  els.loginBtn.textContent = "Входжу…";
  els.loginBtn.disabled = true;
  els.loginError.hidden = true;

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    els.loginError.textContent = "Невірний email або пароль.";
    els.loginError.hidden = false;
    els.loginBtn.textContent = "Увійти";
    els.loginBtn.disabled = false;
  }
});

async function logout() {
  await db.auth.signOut();
}

els.logoutBtn.addEventListener("click", logout);
els.mobileLogoutBtn.addEventListener("click", logout);

els.loginScreen.hidden = true;
els.appShell.hidden = true;
const splash = document.getElementById("splash");
splash.hidden = false; // show splash while auth resolves

// Fallback: якщо onAuthStateChange не спрацює за 5 секунд — показати логін
const authFallback = setTimeout(() => {
  if (!splash.hidden) {
    splash.hidden = true;
    showLogin();
  }
}, 5000);

db.auth.onAuthStateChange(async (event, session) => {
  clearTimeout(authFallback);

  if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
    // SDK не знайшов сесію — спробуємо відновити через refresh_token
    if (!session?.user) {
      try {
        const raw = localStorage.getItem("sb-ptukvvbnbqbahwobitls-auth-token");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.refresh_token) {
            const { data } = await db.auth.refreshSession({ refresh_token: parsed.refresh_token });
            if (data?.session?.user) return; // SIGNED_IN спрацює знову
          }
        }
      } catch {}
      splash.hidden = true;
      showLogin();
      return;
    }
    splash.hidden = true;
    currentUser = session.user;
    showApp();
    await loadAppointments();
    subscribeRealtime();
  } else if (event === "SIGNED_OUT") {
    currentUser = null;
    splash.hidden = true;
    showLogin();
    unsubscribeRealtime();
  }
});

function showLogin() {
  els.loginScreen.hidden = false;
  els.appShell.hidden = true;
  els.loginBtn.textContent = "Увійти";
  els.loginBtn.disabled = false;
  els.loginForm.reset();
}

function showApp() {
  els.loginScreen.hidden = true;
  els.appShell.hidden = false;
  const email = currentUser?.email || "";
  els.railUser.textContent = email.split("@")[0];
  fillDoctorSelect();
  renderDoctorOptions();
  const initialTab = ["calendar", "clients", "alerts"].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "calendar";
  switchTab(initialTab);
}

// ─── Supabase data ───────────────────────────────────────────────────────────

async function loadAppointments() {
  const { data, error } = await dbSelect("appointments");
  if (error) { console.error(error); return; }
  appointments = (data || []).map(normalizeRow);
  render();
}

function normalizeRow(row) {
  return {
    id: row.id,
    date: row.date,
    start: row.start_time?.slice(0, 5) || "00:00",
    end: row.end_time?.slice(0, 5) || "00:30",
    client: row.client,
    phone: row.phone,
    pet: row.pet,
    animal: row.animal || row.pet,
    service: row.service,
    doctor: row.doctor,
    status: row.status,
    comment: row.comment || "",
  };
}

function subscribeRealtime() {
  unsubscribeRealtime();
  realtimeChannel = db
    .channel("appointments-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
      loadAppointments();
    })
    .subscribe();
}

function unsubscribeRealtime() {
  if (realtimeChannel) {
    db.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTitle(date) {
  return date.toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
}

function formatShortDate(date) {
  return date.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
}

function minutesFromTime(value) {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function timeFromMinutes(value) {
  const norm = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(norm / 60)).padStart(2, "0")}:${String(norm % 60).padStart(2, "0")}`;
}

function isToday(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return isoDate(date) === isoDate(today);
}

function visibleAppointments() {
  const current = isoDate(selectedDate);
  return appointments
    .filter((a) => a.date === current)
    .filter((a) => selectedDoctor === "Всі лікарі" || a.doctor === selectedDoctor)
    .sort((a, b) => a.start.localeCompare(b.start));
}

function weekAppointments() {
  const start = new Date(selectedDate);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return isoDate(d);
  });
  return appointments
    .filter((a) => dates.includes(a.date))
    .filter((a) => selectedDoctor === "Всі лікарі" || a.doctor === selectedDoctor)
    .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
}

function weekRangeLabel() {
  const start = new Date(selectedDate);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

// ─── Doctor colors ────────────────────────────────────────────────────────────

// Кольори для кожного лікаря: Остап, Юрій, Устим, Іван, Ірина
const DOCTOR_COLORS = [
  { bg: "#dbeafe", border: "#2563eb", text: "#1d4ed8" }, // Остап — синій
  { bg: "#dcfce7", border: "#16a34a", text: "#15803d" }, // Юрій — зелений
  { bg: "#fef3c7", border: "#d97706", text: "#b45309" }, // Устим — жовтий
  { bg: "#fce7f3", border: "#db2777", text: "#be185d" }, // Іван — рожевий
  { bg: "#ede9fe", border: "#7c3aed", text: "#6d28d9" }, // Ірина — фіолетовий
];

function doctorColor(doctorName) {
  const idx = DOCTORS.indexOf(doctorName);
  return DOCTOR_COLORS[idx >= 0 ? idx : 0];
}

// ─── Timeline (day view) ──────────────────────────────────────────────────────

function renderTimeline() {
  const list = visibleAppointments();
  const grid = els.timelineGrid;
  grid.innerHTML = "";

  const totalHours = HOUR_END - HOUR_START;
  const totalHeight = totalHours * HOUR_HEIGHT;
  grid.style.height = `${totalHeight}px`;

  // Hour lines
  for (let h = HOUR_START; h <= HOUR_END; h++) {
    const y = (h - HOUR_START) * HOUR_HEIGHT;
    const row = document.createElement("div");
    row.className = "tl-hour-row";
    row.style.top = `${y}px`;
    row.innerHTML = `<span class="tl-hour-label">${String(h).padStart(2, "0")}:00</span><div class="tl-hour-line"></div>`;
    grid.append(row);

    // half-hour dashed line
    if (h < HOUR_END) {
      const half = document.createElement("div");
      half.className = "tl-half-row";
      half.style.top = `${y + HOUR_HEIGHT / 2}px`;
      grid.append(half);
    }
  }

  // Current time indicator
  if (isToday(selectedDate)) {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const startMins = HOUR_START * 60;
    const endMins = HOUR_END * 60;
    if (nowMins >= startMins && nowMins <= endMins) {
      const pct = (nowMins - startMins) / ((endMins - startMins));
      const y = pct * totalHeight;
      const nowLine = document.createElement("div");
      nowLine.className = "tl-now";
      nowLine.style.top = `${y}px`;
      nowLine.innerHTML = `<div class="tl-now-dot"></div><div class="tl-now-line"></div>`;
      grid.append(nowLine);
    }
  }

  // Resolve overlaps: assign column index to each appointment
  const columns = assignColumns(list);

  // Event blocks
  list.forEach((item, idx) => {
    const startMins = minutesFromTime(item.start);
    const endMins = minutesFromTime(item.end);
    const top = (startMins - HOUR_START * 60) / 60 * HOUR_HEIGHT;
    const height = Math.max((endMins - startMins) / 60 * HOUR_HEIGHT, 28);

    const { col, totalCols } = columns[idx];
    const leftOffset = 64; // label column
    const usableWidth = `calc(100% - ${leftOffset + 8}px)`;

    const block = document.createElement("div");
    block.className = "tl-event";
    const color = doctorColor(item.doctor);
    block.style.cssText = `
      top: ${top}px;
      height: ${height - 3}px;
      left: calc(${leftOffset}px + ${col} / ${totalCols} * (100% - ${leftOffset + 8}px));
      width: calc(${usableWidth} / ${totalCols} - 4px);
      background: ${color.bg};
      border-left: 3px solid ${color.border};
      color: ${color.text};
    `;

    block.innerHTML = height >= 44
      ? `<span class="tl-event-time">${item.start}</span>
         <span class="tl-event-title">${item.pet} — ${item.service}</span>
         <span class="tl-event-meta">${item.doctor}</span>`
      : `<span class="tl-event-time">${item.start}</span>
         <span class="tl-event-title">${item.pet} — ${item.service}</span>`;

    block.addEventListener("click", () => openDetails(item));
    grid.append(block);
  });

  // Click on empty slot to create appointment at that time
  grid.addEventListener("click", (e) => {
    if (e.target.closest(".tl-event")) return;
    const rect = grid.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const mins = HOUR_START * 60 + Math.round(y / HOUR_HEIGHT * 60 / 15) * 15;
    const clampedMins = Math.min(Math.max(mins, HOUR_START * 60), (HOUR_END - 1) * 60);
    openForm({ clickedTime: timeFromMinutes(clampedMins) });
  });

  // Scroll to first appointment or 8am
  requestAnimationFrame(() => {
    const firstStart = list[0] ? minutesFromTime(list[0].start) : HOUR_START * 60;
    const scrollTo = Math.max(0, (firstStart - HOUR_START * 60 - 30) / 60 * HOUR_HEIGHT);
    els.timelineWrap.scrollTop = scrollTo;
  });

  els.scheduleDate.textContent = `${isToday(selectedDate) ? "Сьогодні, " : ""}${formatTitle(selectedDate)}`;
  els.appointmentCount.textContent = `${list.length} ${countLabel(list.length)}`;
}

function assignColumns(list) {
  const result = list.map(() => ({ col: 0, totalCols: 1 }));
  for (let i = 0; i < list.length; i++) {
    const aStart = minutesFromTime(list[i].start);
    const aEnd = minutesFromTime(list[i].end);
    const overlapping = [i];
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const bStart = minutesFromTime(list[j].start);
      const bEnd = minutesFromTime(list[j].end);
      if (aStart < bEnd && aEnd > bStart) overlapping.push(j);
    }
    const maxCols = overlapping.length;
    overlapping.forEach((idx, pos) => {
      result[idx].col = pos;
      result[idx].totalCols = maxCols;
    });
  }
  return result;
}

function countLabel(n) {
  if (n === 1) return "запис";
  if (n >= 2 && n <= 4) return "записи";
  return "записів";
}

// ─── Week list view ───────────────────────────────────────────────────────────

function renderWeekList() {
  const list = weekAppointments();
  els.weekDate.textContent = `Тиждень · ${weekRangeLabel()}`;
  els.weekCount.textContent = `${list.length} ${countLabel(list.length)}`;
  els.weekList.innerHTML = "";
  if (!list.length) {
    els.weekList.innerHTML = `<div class="empty-state">На цей тиждень записів немає.</div>`;
    return;
  }
  list.forEach((item) => els.weekList.append(appointmentCard(item, true)));
}

// ─── Appointment card ─────────────────────────────────────────────────────────

function appointmentCard(item, showDate = false) {
  const card = document.createElement("article");
  card.className = "appointment-card";
  card.role = "button";
  card.tabIndex = 0;
  const color = doctorColor(item.doctor);
  card.style.borderLeft = `4px solid ${color.border}`;
  card.style.background = color.bg;
  card.style.borderColor = color.border;

  const dateLabel = showDate || item.date !== isoDate(selectedDate)
    ? `<span class="meta card-date">${formatShortDate(new Date(item.date + "T12:00:00"))}</span>`
    : "";

  card.innerHTML = `
    <span class="time" style="color:${color.border}">${item.start}</span>
    <span class="card-main">
      <strong>${item.pet} — ${item.service}</strong>
      <span class="meta">${item.doctor} · ${item.client}</span>
      ${dateLabel}
    </span>
    <span class="card-actions">
      <a class="call-link" href="tel:${item.phone}" data-call>Подзвонити</a>
      <span class="status-pill" data-status="${item.status}">${item.status}</span>
    </span>
  `;
  card.addEventListener("click", () => openDetails(item));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetails(item); }
  });
  card.querySelector("[data-call]").addEventListener("click", (e) => e.stopPropagation());
  return card;
}

// ─── Pulse stats ──────────────────────────────────────────────────────────────

function renderPulse() {
  const todays = appointments.filter((a) => a.date === isoDate(selectedDate));
  els.todayTotal.textContent = String(todays.length);

  // Наступний запис від поточного часу
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const todayIso = isoDate(now);
  const next = appointments
    .filter((a) => a.date === todayIso && a.status !== "Завершено")
    .filter((a) => minutesFromTime(a.start) > nowMins)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  els.pulseDoctorValue.textContent = next ? next.start : "—";

  const short = selectedDoctor === "Всі лікарі"
    ? "Всі"
    : selectedDoctor.split(" ")[0];
  if (els.doctorFilterValue) els.doctorFilterValue.textContent = selectedDoctor;
}

// ─── Main render ──────────────────────────────────────────────────────────────

function render() {
  if (activeTab !== "calendar") return;

  const title = isToday(selectedDate) ? "Сьогодні" : formatTitle(selectedDate);
  els.dayTitle.textContent = title;
  els.doctorFilterValue.textContent = selectedDoctor;
  renderPulse();

  if (activeView === "week") {
    els.timelinePanel.hidden = true;
    els.weekPanel.hidden = false;
    renderWeekList();
  } else {
    els.timelinePanel.hidden = false;
    els.weekPanel.hidden = true;
    renderTimeline();
  }
}

// ─── Clients & Alerts pages ───────────────────────────────────────────────────

function uniqueClients() {
  const map = new Map();
  appointments.forEach((a) => {
    const key = `${a.client}-${a.phone}`;
    if (!map.has(key)) map.set(key, { client: a.client, phone: a.phone, pets: new Set(), last: a });
    map.get(key).pets.add(a.pet);
    map.get(key).last = a;
  });
  return [...map.values()];
}

function isHeadDoctor() {
  return currentUser?.email === "head@clinic.com";
}

function renderUtilityPage(tab) {
  if (tab === "clients") {
    els.dayTitle.textContent = "Клієнти";
    const list = uniqueClients();
    els.utilityPage.innerHTML = list.length
      ? list.map((c) => `
          <article class="utility-card">
            <h3>${c.client}</h3>
            <p class="meta">${[...c.pets].join(", ")} · ${c.phone}</p>
            <p class="meta">Останній запис: ${c.last.pet} — ${c.last.service}</p>
            <div class="utility-actions">
              <a class="mini-button" href="tel:${c.phone}">Подзвонити</a>
            </div>
          </article>`).join("")
      : `<div class="empty-state">Клієнтів поки немає.</div>`;
  } else if (tab === "alerts") {
    renderAlertsPage();
  }
}

async function renderAlertsPage() {
  els.dayTitle.textContent = "Сповіщення";
  els.utilityPage.innerHTML = `<div class="empty-state">Завантаження…</div>`;

  const { data, error } = await dbSelectNotices();
  if (error || !data) {
    els.utilityPage.innerHTML = `<div class="empty-state">Не вдалось завантажити сповіщення.</div>`;
    return;
  }

  const canEdit = isHeadDoctor();

  els.utilityPage.innerHTML = "";

  if (canEdit) {
    const form = document.createElement("form");
    form.className = "notice-form";
    form.innerHTML = `
      <textarea name="text" rows="3" placeholder="Текст сповіщення для всіх лікарів…" required></textarea>
      <button class="button save" type="submit">Додати сповіщення</button>
    `;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = form.elements.text.value.trim();
      if (!text) return;
      const btn = form.querySelector("button");
      btn.textContent = "Зберігаю…";
      btn.disabled = true;
      await dbInsert("notices", { text, created_by: currentUser?.id });
      form.reset();
      renderAlertsPage();
    });
    els.utilityPage.append(form);
  }

  if (!data.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Сповіщень поки немає.";
    els.utilityPage.append(empty);
    return;
  }

  data.forEach((notice) => {
    const card = document.createElement("article");
    card.className = "utility-card notice-card";
    const date = new Date(notice.created_at).toLocaleDateString("uk-UA", {
      day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
    });
    card.innerHTML = `
      <p class="notice-text">${notice.text}</p>
      <div class="notice-footer">
        <span class="meta">${date}</span>
        ${canEdit ? `<button class="notice-delete" data-id="${notice.id}" type="button">Видалити</button>` : ""}
      </div>
    `;
    if (canEdit) {
      card.querySelector(".notice-delete").addEventListener("click", async (e) => {
        if (!confirm("Видалити це сповіщення?")) return;
        await dbDelete("notices", e.target.dataset.id);
        renderAlertsPage();
      });
    }
    els.utilityPage.append(card);
  });
}

// ─── Tab switching ────────────────────────────────────────────────────────────

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll("[data-tab]").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab)
  );
  document.querySelectorAll(".calendar-only").forEach((s) => (s.hidden = tab !== "calendar"));
  els.utilityPage.hidden = tab === "calendar";
  if (tab === "calendar") {
    render();
  } else {
    renderUtilityPage(tab);
  }
  history.replaceState(null, "", `#${tab}`);
}

// ─── Sheets ───────────────────────────────────────────────────────────────────

function openSheet(sheet) {
  els.overlay.hidden = false;
  sheet.hidden = false;
}

function closeSheets() {
  els.overlay.hidden = true;
  document.querySelectorAll(".sheet").forEach((s) => (s.hidden = true));
}

// ─── Details sheet ────────────────────────────────────────────────────────────

function openDetails(item) {
  els.detailsContent.innerHTML = `
    <h2 class="detail-title" id="detailsTitle">${item.pet} — ${item.service}</h2>
    <p class="meta">${item.start}–${item.end} · ${formatShortDate(new Date(item.date + "T12:00:00"))}</p>
    <div class="detail-grid">
      <div><span>Клієнт</span><strong>${item.client}</strong></div>
      <div><span>Телефон</span><strong>${item.phone}</strong></div>
      <div><span>Тварина</span><strong>${item.animal || item.pet}</strong></div>
      <div><span>Лікар</span><strong>${item.doctor}</strong></div>
      <div><span>Статус</span><strong>${item.status}</strong></div>
      ${item.comment ? `<div><span>Коментар</span><strong>${item.comment}</strong></div>` : ""}
    </div>
    <label>
      Швидка зміна статусу
      <select class="status-select" id="detailsStatus">
        ${["Заплановано","Очікує","В кабінеті","Завершено"].map((s) =>
          `<option ${s === item.status ? "selected" : ""}>${s}</option>`).join("")}
      </select>
    </label>
    <div class="sheet-actions">
      <a class="button save" href="tel:${item.phone}">Подзвонити</a>
      <button class="button ghost" type="button" id="editBtn">Редагувати</button>
      <button class="button danger" type="button" id="deleteBtn">Видалити</button>
      <button class="button ghost" type="button" data-close>Закрити</button>
    </div>
  `;

  els.detailsContent.querySelector("#detailsStatus").addEventListener("change", async (e) => {
    await dbUpdate("appointments", { status: e.target.value }, item.id);
    closeSheets();
    loadAppointments();
  });
  els.detailsContent.querySelector("#editBtn").addEventListener("click", () => openForm(item));
  els.detailsContent.querySelector("#deleteBtn").addEventListener("click", async () => {
    if (confirm(`Видалити запис: ${item.pet} — ${item.service}?`)) {
      await dbDelete("appointments", item.id);
      closeSheets();
      loadAppointments();
    }
  });
  els.detailsContent.querySelector("[data-close]").addEventListener("click", closeSheets);
  openSheet(els.detailsSheet);
}

// ─── Form sheet ───────────────────────────────────────────────────────────────

function fillDoctorSelect() {
  els.form.elements.doctor.innerHTML = DOCTORS
    .map((d) => `<option>${d}</option>`)
    .join("");
}

function openForm(item = null) {
  const appt = item?.date ? item : null;
  editingId = appt?.id || null;
  els.form.reset();
  document.getElementById("formTitle").textContent = editingId ? "Редагувати запис" : "Новий запис";

  const duration = appt
    ? String(minutesFromTime(appt.end) - minutesFromTime(appt.start))
    : "30";

  els.form.elements.date.value = appt?.date || isoDate(selectedDate);
  els.form.elements.start.value = appt?.start || item?.clickedTime || "09:00";
  els.form.elements.duration.value = duration;
  els.form.elements.client.value = appt?.client || "";
  els.form.elements.phone.value = appt?.phone || "";
  els.form.elements.pet.value = appt?.pet || "";
  els.form.elements.animal.value = appt?.animal || "";
  els.form.elements.service.value = appt?.service || "";
  els.form.elements.doctor.value = appt?.doctor || DOCTORS[0];
  els.form.elements.status.value = appt?.status || "Заплановано";
  els.form.elements.comment.value = appt?.comment || "";

  closeSheets();
  openSheet(els.formSheet);
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(els.form));
  const endTime = timeFromMinutes(minutesFromTime(data.start) + Number(data.duration || 30));

  const payload = {
    date: data.date,
    start_time: data.start,
    end_time: endTime,
    client: data.client.trim(),
    phone: data.phone.trim(),
    pet: data.pet.trim(),
    animal: (data.animal || data.pet).trim(),
    service: data.service.trim(),
    doctor: data.doctor,
    status: data.status,
    comment: data.comment.trim(),
    created_by: currentUser?.id,
  };

  els.formSaveBtn.textContent = "Зберігаю…";
  els.formSaveBtn.disabled = true;

  let error;
  try {
    const result = editingId
      ? await dbUpdate("appointments", payload, editingId)
      : await dbInsert("appointments", payload);
    error = result.error;
  } catch (e) {
    error = e;
  }

  els.formSaveBtn.textContent = "Зберегти";
  els.formSaveBtn.disabled = false;

  if (error) {
    showFormError(error?.message || JSON.stringify(error));
    return;
  }

  selectedDate = new Date(data.date + "T12:00:00");
  selectedDate.setHours(0, 0, 0, 0);
  editingId = null;
  closeSheets();
  loadAppointments();
});

function showFormError(msg) {
  let err = els.form.querySelector(".form-error");
  if (!err) {
    err = document.createElement("div");
    err.className = "form-error";
    els.form.prepend(err);
  }
  err.textContent = "Помилка: " + msg;
  err.hidden = false;
  setTimeout(() => { err.hidden = true; }, 5000);
}

// ─── Doctor filter sheet ──────────────────────────────────────────────────────

function renderDoctorOptions() {
  els.doctorOptions.innerHTML = "";
  ["Всі лікарі", ...DOCTORS].forEach((doc) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = doc;
    if (doc === selectedDoctor) btn.classList.add("active");
    btn.addEventListener("click", () => {
      selectedDoctor = doc;
      closeSheets();
      render();
    });
    els.doctorOptions.append(btn);
  });
}

els.doctorFilter.addEventListener("click", () => {
  renderDoctorOptions();
  openSheet(els.doctorSheet);
});


// ─── Search ───────────────────────────────────────────────────────────────────

function renderSearch() {
  const q = els.searchInput.value.trim().toLowerCase();
  const result = appointments.filter((a) => {
    if (!q) return false;
    return [a.client, a.phone, a.pet, a.service, a.doctor].join(" ").toLowerCase().includes(q);
  });
  els.searchResults.innerHTML = "";
  if (!result.length && q) {
    els.searchResults.innerHTML = `<div class="empty-state">Нічого не знайдено.</div>`;
    return;
  }
  result.forEach((item) => els.searchResults.append(appointmentCard(item)));
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function moveDay(delta) {
  selectedDate.setDate(selectedDate.getDate() + delta);
  render();
}

document.getElementById("prevDay").addEventListener("click", () => moveDay(-1));
document.getElementById("nextDay").addEventListener("click", () => moveDay(1));
document.getElementById("todayButton").addEventListener("click", () => {
  selectedDate = new Date();
  selectedDate.setHours(0, 0, 0, 0);
  render();
});
document.getElementById("newAppointment").addEventListener("click", () => openForm());
document.getElementById("deskNewBtn").addEventListener("click", () => openForm());
document.querySelectorAll("[data-tab]").forEach((b) =>
  b.addEventListener("click", () => switchTab(b.dataset.tab))
);
els.overlay.addEventListener("click", closeSheets);
els.searchInput.addEventListener("input", renderSearch);
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeSheets));
document.querySelectorAll(".view-switcher button").forEach((b) => {
  b.addEventListener("click", () => {
    activeView = b.dataset.view;
    document.querySelectorAll(".view-switcher button").forEach((x) =>
      x.classList.toggle("active", x === b)
    );
    render();
  });
});

// ─── Touch swipe ──────────────────────────────────────────────────────────────

let touchStartX = 0;
document.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0]?.screenX || 0;
}, { passive: true });
document.addEventListener("touchend", (e) => {
  if (!els.overlay.hidden) return;
  const dx = (e.changedTouches[0]?.screenX || 0) - touchStartX;
  if (Math.abs(dx) > 70) moveDay(dx < 0 ? 1 : -1);
}, { passive: true });

window.addEventListener("hashchange", () => {
  const t = ["calendar","clients","alerts"].includes(location.hash.slice(1))
    ? location.hash.slice(1) : "calendar";
  if (t !== activeTab) switchTab(t);
});

// ─── Auto-refresh now-line every minute ──────────────────────────────────────

setInterval(() => {
  if (activeView === "day" && activeTab === "calendar" && isToday(selectedDate)) {
    renderTimeline();
  }
}, 60_000);
