const doctors = ["Всі лікарі", "Головний лікар", "Лікар Ірина", "Лікар Андрій", "Лікар Оксана", "Лікар Марта"];
const editableRoles = true;

let selectedDate = new Date(2026, 5, 2);
let selectedDoctor = "Всі лікарі";
let activeView = "day";
let activeTab = "calendar";
let editingId = null;

const appointments = [
  { id: 1, date: "2026-06-02", start: "09:00", end: "09:30", pet: "Рекс", service: "вакцинація", doctor: "Лікар Ірина", client: "Олена", phone: "+380671112233", animal: "собака, лабрадор", status: "Заплановано", comment: "Планова вакцинація." },
  { id: 2, date: "2026-06-02", start: "10:00", end: "10:40", pet: "Муся", service: "огляд", doctor: "Лікар Андрій", client: "Ігор", phone: "+380931112244", animal: "кішка, метис", status: "Очікує", comment: "Скарга на апетит." },
  { id: 3, date: "2026-06-02", start: "11:30", end: "12:00", pet: "Боня", service: "УЗД", doctor: "Головний лікар", client: "Марта", phone: "+380501112255", animal: "собака, шпіц", status: "Заплановано", comment: "Підготовка до процедури підтверджена." },
  { id: 4, date: "2026-06-03", start: "08:45", end: "09:15", pet: "Лакі", service: "аналіз крові", doctor: "Лікар Оксана", client: "Назар", phone: "+380671119900", animal: "кіт, британський", status: "Заплановано", comment: "" },
  { id: 5, date: "2026-06-01", start: "13:20", end: "13:50", pet: "Тіна", service: "стрижка кігтів", doctor: "Лікар Марта", client: "Софія", phone: "+380631234567", animal: "кролик", status: "Завершено", comment: "" }
];

const els = {
  dayTitle: document.querySelector("#dayTitle"),
  scheduleDate: document.querySelector("#scheduleDate"),
  appointmentCount: document.querySelector("#appointmentCount"),
  appointmentList: document.querySelector("#appointmentList"),
  todayTotal: document.querySelector("#todayTotal"),
  nextVisit: document.querySelector("#nextVisit"),
  doctorFilter: document.querySelector("#doctorFilter"),
  doctorFilterValue: document.querySelector("#doctorFilterValue"),
  overlay: document.querySelector("#overlay"),
  detailsSheet: document.querySelector("#detailsSheet"),
  detailsContent: document.querySelector("#detailsContent"),
  formSheet: document.querySelector("#formSheet"),
  searchSheet: document.querySelector("#searchSheet"),
  doctorSheet: document.querySelector("#doctorSheet"),
  doctorOptions: document.querySelector("#doctorOptions"),
  searchInput: document.querySelector("#searchInput"),
  searchResults: document.querySelector("#searchResults"),
  utilityPage: document.querySelector("#utilityPage"),
  form: document.querySelector("#appointmentForm")
};

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTitle(date) {
  return date.toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
}

function formatShortDate(date) {
  return date.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
}

function minutesFromTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function timeFromMinutes(value) {
  const normalized = ((value % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function durationFromAppointment(item) {
  if (!item?.start || !item?.end) return "30";
  const duration = minutesFromTime(item.end) - minutesFromTime(item.start);
  return String(duration > 0 ? duration : 30);
}

function isToday(date) {
  const today = new Date(2026, 5, 2);
  return isoDate(date) === isoDate(today);
}

function visibleAppointments() {
  const current = isoDate(selectedDate);
  return appointments
    .filter((item) => item.date === current)
    .filter((item) => selectedDoctor === "Всі лікарі" || item.doctor === selectedDoctor)
    .sort((a, b) => a.start.localeCompare(b.start));
}

function weekAppointments() {
  const start = new Date(selectedDate);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return isoDate(date);
  });
  return appointments
    .filter((item) => dates.includes(item.date))
    .filter((item) => selectedDoctor === "Всі лікарі" || item.doctor === selectedDoctor)
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

function appointmentCard(item) {
  const card = document.createElement("article");
  card.className = "appointment-card";
  card.role = "button";
  card.tabIndex = 0;
  card.innerHTML = `
    <span class="time">${item.start}</span>
    <span class="card-main">
      <strong>${item.pet} — ${item.service}</strong>
      <span class="meta">${item.doctor} · ${item.client}</span>
    </span>
    <span class="card-actions">
      <a class="call-link" href="tel:${item.phone}" data-call>Подзвонити</a>
      <span class="status-pill">${item.status}</span>
    </span>
  `;
  card.addEventListener("click", () => openDetails(item));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetails(item);
    }
  });
  card.querySelector("[data-call]").addEventListener("click", (event) => event.stopPropagation());
  return card;
}

function renderAppointments(list = visibleAppointments(), target = els.appointmentList) {
  target.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "На цю дату записів немає.";
    target.append(empty);
    return;
  }
  list.forEach((item) => target.append(appointmentCard(item)));
}

function renderPulse() {
  const todays = appointments.filter((item) => item.date === isoDate(selectedDate));
  const visible = visibleAppointments();
  els.todayTotal.textContent = String(todays.length);
  els.nextVisit.textContent = visible.find((item) => item.status !== "Завершено")?.start || "--:--";
}

function render() {
  const list = activeView === "week" ? weekAppointments() : visibleAppointments();
  const title = `${isToday(selectedDate) ? "Сьогодні, " : ""}${formatTitle(selectedDate)}`;
  if (activeTab === "calendar") {
    els.dayTitle.textContent = isToday(selectedDate) ? "Сьогодні" : formatTitle(selectedDate);
  }
  els.scheduleDate.textContent = activeView === "week" ? `Тиждень · ${weekRangeLabel()}` : title;
  els.appointmentCount.textContent = `${list.length} ${list.length === 1 ? "запис" : "записи"}`;
  els.doctorFilterValue.textContent = selectedDoctor;
  renderPulse();
  renderAppointments(list);
}

function uniqueClients() {
  const map = new Map();
  appointments.forEach((item) => {
    const key = `${item.client}-${item.phone}`;
    if (!map.has(key)) {
      map.set(key, { client: item.client, phone: item.phone, pets: new Set(), last: item });
    }
    map.get(key).pets.add(item.pet);
    map.get(key).last = item;
  });
  return [...map.values()];
}

function renderUtilityPage(tab) {
  const pages = {
    clients: {
      title: "Клієнти",
      html: uniqueClients().map((item) => `
        <article class="utility-card">
          <h3>${item.client}</h3>
          <p class="meta">${[...item.pets].join(", ")} · ${item.phone}</p>
          <p class="meta">Останній запис: ${item.last.pet} — ${item.last.service}</p>
          <div class="utility-actions">
            <a class="mini-button" href="tel:${item.phone}">Подзвонити</a>
          </div>
        </article>
      `).join("")
    },
    alerts: {
      title: "Сповіщення",
      html: `
        <article class="utility-card">
          <h3>Завтра скорочений день</h3>
          <p class="meta">Клініка працює до 15:00. Нові записи після 14:30 краще не створювати.</p>
        </article>
        <article class="utility-card">
          <h3>Потрібно підтвердити УЗД</h3>
          <p class="meta">Боня · Марта · сьогодні 11:30.</p>
        </article>
      `
    },
  };

  const page = pages[tab];
  els.dayTitle.textContent = page.title;
  els.utilityPage.innerHTML = page.html;
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  document.querySelectorAll(".calendar-only").forEach((section) => {
    section.hidden = tab !== "calendar";
  });
  els.utilityPage.hidden = tab === "calendar";
  if (tab === "calendar") {
    render();
  } else {
    renderUtilityPage(tab);
  }
  history.replaceState(null, "", `#${tab}`);
}

function openSheet(sheet) {
  els.overlay.hidden = false;
  sheet.hidden = false;
}

function closeSheets() {
  els.overlay.hidden = true;
  document.querySelectorAll(".sheet").forEach((sheet) => (sheet.hidden = true));
}

function openDetails(item) {
  els.detailsContent.innerHTML = `
    <h2 class="detail-title" id="detailsTitle">${item.pet} — ${item.service}</h2>
    <p class="meta">${item.start}–${item.end}</p>
    <div class="detail-grid">
      <div><span>Клієнт</span><strong>${item.client}</strong></div>
      <div><span>Телефон</span><strong>${item.phone}</strong></div>
      <div><span>Тварина</span><strong>${item.animal}</strong></div>
      <div><span>Лікар</span><strong>${item.doctor}</strong></div>
      <div><span>Статус</span><strong>${item.status}</strong></div>
    </div>
    <label>
      Швидка зміна статусу
      <select class="status-select" id="detailsStatus">
        ${["Заплановано", "Очікує", "В кабінеті", "Завершено"].map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
    </label>
    <div class="sheet-actions">
      <a class="button save" href="tel:${item.phone}">Подзвонити</a>
      ${editableRoles ? `<button class="button ghost" type="button" id="editStatus">Редагувати</button>` : ""}
      <button class="button ghost" type="button" data-close>Закрити</button>
    </div>
  `;
  els.detailsContent.querySelector("#detailsStatus").addEventListener("change", (event) => {
    item.status = event.target.value;
    closeSheets();
    render();
  });
  const editButton = els.detailsContent.querySelector("#editStatus");
  if (editButton) {
    editButton.addEventListener("click", () => {
      openForm(item);
    });
  }
  els.detailsContent.querySelector("[data-close]").addEventListener("click", closeSheets);
  openSheet(els.detailsSheet);
}

function openForm(item = null) {
  const appointment = item?.date && item?.start ? item : null;
  editingId = appointment?.id || null;
  els.form.reset();
  document.querySelector("#formTitle").textContent = editingId ? "Редагувати запис" : "Новий запис";
  els.form.elements.date.value = appointment?.date || isoDate(selectedDate);
  els.form.elements.start.value = appointment?.start || "12:00";
  els.form.elements.duration.value = appointment ? durationFromAppointment(appointment) : "30";
  els.form.elements.client.value = appointment?.client || "";
  els.form.elements.phone.value = appointment?.phone || "";
  els.form.elements.pet.value = appointment?.pet || "";
  els.form.elements.service.value = appointment?.service || "";
  els.form.elements.doctor.value = appointment?.doctor || "Лікар Ірина";
  els.form.elements.status.value = appointment?.status || "Заплановано";
  els.form.elements.comment.value = appointment?.comment || "";
  closeSheets();
  openSheet(els.formSheet);
}

function renderDoctorOptions() {
  els.doctorOptions.innerHTML = "";
  doctors.forEach((doctor) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = doctor;
    button.addEventListener("click", () => {
      selectedDoctor = doctor;
      closeSheets();
      render();
    });
    els.doctorOptions.append(button);
  });
}

function renderSearch() {
  const query = els.searchInput.value.trim().toLowerCase();
  const result = appointments.filter((item) => {
    const haystack = [item.client, item.phone, item.pet, item.service, item.doctor].join(" ").toLowerCase();
    return query && haystack.includes(query);
  });
  renderAppointments(result, els.searchResults);
}

function moveDay(delta) {
  selectedDate.setDate(selectedDate.getDate() + delta);
  render();
}

document.querySelector("#prevDay").addEventListener("click", () => moveDay(-1));
document.querySelector("#nextDay").addEventListener("click", () => moveDay(1));
document.querySelector("#todayButton").addEventListener("click", () => {
  selectedDate = new Date(2026, 5, 2);
  render();
});
document.querySelector("#newAppointment").addEventListener("click", () => openForm());
document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});
document.querySelector("#openSearch").addEventListener("click", () => {
  els.searchInput.value = "";
  els.searchResults.innerHTML = "";
  openSheet(els.searchSheet);
  setTimeout(() => els.searchInput.focus(), 60);
});
els.doctorFilter.addEventListener("click", () => openSheet(els.doctorSheet));
els.overlay.addEventListener("click", closeSheets);
els.searchInput.addEventListener("input", renderSearch);
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeSheets));
document.querySelectorAll(".view-switcher button").forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    document.querySelectorAll(".view-switcher button").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

els.form.querySelector("select[name='doctor']").innerHTML = doctors
  .filter((doctor) => doctor !== "Всі лікарі")
  .map((doctor) => `<option>${doctor}</option>`)
  .join("");

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.form));
  const payload = {
    date: data.date,
    start: data.start,
    end: timeFromMinutes(minutesFromTime(data.start) + Number(data.duration || 30)),
    pet: data.pet,
    service: data.service,
    doctor: data.doctor,
    client: data.client,
    phone: data.phone,
    animal: data.pet,
    status: data.status,
    comment: data.comment
  };
  if (editingId) {
    const index = appointments.findIndex((item) => item.id === editingId);
    if (index >= 0) appointments[index] = { ...appointments[index], ...payload };
  } else {
    appointments.push({ id: Date.now(), ...payload });
  }
  selectedDate = new Date(`${data.date}T12:00:00`);
  editingId = null;
  closeSheets();
  render();
});

let touchStartX = 0;
document.addEventListener("touchstart", (event) => {
  touchStartX = event.changedTouches[0]?.screenX || 0;
}, { passive: true });

document.addEventListener("touchend", (event) => {
  if (!els.overlay.hidden) return;
  const touchEndX = event.changedTouches[0]?.screenX || 0;
  const distance = touchEndX - touchStartX;
  if (Math.abs(distance) > 70) moveDay(distance < 0 ? 1 : -1);
}, { passive: true });

window.addEventListener("hashchange", () => {
  const nextTab = ["calendar", "clients", "alerts"].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "calendar";
  if (nextTab !== activeTab) switchTab(nextTab);
});

renderDoctorOptions();
const initialTab = ["calendar", "clients", "alerts"].includes(location.hash.slice(1))
  ? location.hash.slice(1)
  : "calendar";
switchTab(initialTab);
