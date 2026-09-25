import { DefaultCalendarId } from './preload.js';
import { auth } from './firebase-init.js';
import { renderFreeBusyMembers, setupFreeBusy } from './freebusy.js';

let activeCalendarId = localStorage.getItem('activeCalendarId') || DefaultCalendarId;
// もしlocalStorageから取れたIDを使う場合でも、後で初期化を確実に行う
let currentCalendarMembers = []; // ★修正: 変数宣言を追加

const today = new Date();
const days = document.querySelector(".days");
const month_title = document.querySelector("#month-title");
const year_title = document.querySelector("#year-title");
const month_name = document.querySelector("#month-name");
const STORAGE_KEY = 'app_icons';

const modal = document.querySelector("#schedule-modal");
const modalHeader = document.querySelector("#modal-header");
const modalContent = document.querySelector(".modal-content");
const showDay = document.querySelector("#showDay");
const modalButtons = document.querySelector(".modal-buttons");

let editingKey = null;
let existingId = null;

const planCount = document.querySelector("#plan");
const taskCount = document.querySelector("#task");
const planRadio = document.querySelector("#radio-plan");
const taskRadio = document.querySelector("#radio-task");

let selectedDay = null;
let selectedYear = null;
let selectedMonth = null;

let data = {};

// APIのベースURL設定
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocalhost ? 'https://todo.kyonshi.com' : '';

// --- カレンダーメンバー情報の取得 ---
async function fetchCalendarMembers() {
    if (!activeCalendarId) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/calendars`);
        const calendars = await res.json();
        const targetCalendar = calendars.find(cal => cal.id === activeCalendarId);
        
        if (targetCalendar) {
            currentCalendarMembers = [targetCalendar.owner, ...targetCalendar.members];
            renderFreeBusyMembers(currentCalendarMembers); 

            // ★ カレンダー名を画面に表示するUI改善
            let titleEl = document.querySelector("#current-calendar-name");
            if (!titleEl) {
                const header = document.querySelector(".overview");
                titleEl = document.createElement("h2");
                titleEl.id = "current-calendar-name";
                titleEl.className = "current-calendar-name";
                if (header) {
                    header.insertBefore(titleEl, header.firstChild);
                    header.insertBefore(document.createElement("hr"), header.firstChild);
                }
            }
            if (titleEl) {
                titleEl.textContent = targetCalendar.is_default 
                    ? `⭐ ${targetCalendar.title}` 
                    : targetCalendar.title;
            } 
        }
    } catch (e) {
        console.error("メンバー情報の取得に失敗:", e);
    }
}

// --- カレンダーデータ取得 ---
async function loadDataFromAPI() {
    if (!activeCalendarId) return;
    const omuid = auth.currentUser ? auth.currentUser.email.split('@')[0] : '';

    try {
        const res = await fetch(`${API_BASE_URL}/api/calendars/${activeCalendarId}/data`);
        if (!res.ok) throw new Error("データの取得に失敗しました");
        const apiData = await res.json();
        
        data = {}; 

        apiData.events.forEach(event => {
            const startDate = new Date(event.start_at);
            const endDate = new Date(event.end_at);
            const year = startDate.getFullYear();
            const month = startDate.getMonth() + 1;
            const day = startDate.getDate();
            
            const startStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
            const endStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
            const timeStr = `${startStr} - ${endStr}`;

            if (!data[year]) data[year] = {};
            if (!data[year][month]) data[year][month] = {};
            if (!data[year][month][day]) data[year][month][day] = {};

            data[year][month][day][timeStr] = {
                id: event.id,
                title: event.title,
                type: "plan"
            };
        });

        apiData.todos.forEach(todo => {
            const dueDate = new Date(todo.due_date);
            const year = dueDate.getFullYear();
            const month = dueDate.getMonth() + 1;
            const day = dueDate.getDate();
            
            const startDate = new Date(dueDate.getTime() - 60 * 60 * 1000);
            const startStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
            const endStr = `${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`;
            const timeStr = `${startStr} - ${endStr}`;

            if (!data[year]) data[year] = {};
            if (!data[year][month]) data[year][month] = {};
            if (!data[year][month][day]) data[year][month][day] = {};

            data[year][month][day][timeStr] = {
                id: todo.id,
                title: todo.title,
                type: "task",
                completed: todo.assignments && todo.assignments[omuid] ? todo.assignments[omuid].completed : false,
                source: todo.source,
                external_id: todo.external_id
            };
        });
    } catch (e) {
        console.error(e);
    }
}

// --- UI要素・初期化 ---
const dayViewModal = document.querySelector("#day-view-modal");
const dayViewTitle = document.querySelector("#day-view-title");
const dayViewHours = document.querySelector("#day-view-hours");
const dayViewEvents = document.querySelector("#day-view-events");
const dayViewBody = document.querySelector(".day-view-body");
const dayViewAdd = document.querySelector("#day-view-add");
const dayViewClose = document.querySelector("#day-view-close");

let selectedDayElement = null; 
const HOUR_HEIGHT = 60; 
let scheduleOpen = false;

const startTime = document.querySelector("#start-time");
const endTime = document.querySelector("#end-time");
const scheduleTitle = document.querySelector("#schedule-title");
const schedule_ok = document.querySelector("#schedule-ok");
const scheduleCancel = document.querySelector("#schedule-cancel");

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const appDictionary = {
    "discord://": { name: "Discord", icon: "/res/img/icons/discord.svg" },
    "msteams://": { name: "Microsoft Teams", icon: "https://teams.microsoft.com/favicon.ico" },
    "zoommtg://": { name: "Zoom", icon: "/res/img/icons/zoom.svg" },
    "line://": { name: "LINE", icon: "/res/img/icons/line.svg" },
    "vscode://": { name: "Visual Studio Code", icon: "/res/img/icons/vscode.svg" },
    "notion://": { name: "Notion", icon: "/res/img/icons/notion.svg" },
    "x-github-client://": { name: "GitHub Desktop", icon: "/res/img/icons/github.svg" },
    "spotify://": { name: "Spotify", icon: "/res/img/icons/spotify.svg" },
    "music://": { name: "Apple Music", icon: "/res/img/icons/music.svg" }
};

function updateMonthlyCounts(year = currentYear, month = currentMonth) {
    let planTotal = 0;
    let taskTotal = 0;
    const monthData = data?.[year]?.[month + 1];

    if (monthData) {
        Object.values(monthData).forEach(daySchedule => {
            Object.values(daySchedule).forEach(entry => {
                if (entry.type === "task") {
                    taskTotal++;
                } else {
                    planTotal++;
                }
            });
        });
    }
    if (planCount) planCount.textContent = ` ${planTotal}`;
    if (taskCount) taskCount.textContent = ` ${taskTotal}`;
}

function createCalendar(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    if (days) days.innerHTML = "";
    if (month_title) month_title.textContent = month + 1;
    if (year_title) year_title.textContent = year;
    if (month_name) month_name.textContent = monthNames[month];

    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyDay = document.createElement("div");
        emptyDay.classList.add("disabled");
        if (days) days.appendChild(emptyDay);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
        const day = document.createElement("div");
        const p = document.createElement("p");
        const hr = document.createElement("hr");
        day.classList.add("day");
        day.dataset.day = i;
        p.textContent = i;
        day.appendChild(p);
        day.appendChild(hr);

        const dayEntries = data?.[year]?.[month + 1]?.[i] || {};
        const upcomingEntries = Object.entries(dayEntries)
            .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
            .slice(0, 3);
        if (upcomingEntries.length > 0) {
            const scheduleList = document.createElement("ul");
            scheduleList.className = "day-schedules";
            upcomingEntries.forEach(([time, entry]) => {
                const item = document.createElement("li");
                item.className = `day-schedule-item day-schedule-${entry.type}`;
                const timeLabel = document.createElement("span");
                timeLabel.className = "day-schedule-time";
                timeLabel.textContent = time.split(" - ")[0];
                const title = document.createElement("span");
                title.className = "day-schedule-title";
                title.textContent = entry.title;
                item.append(timeLabel, title);
                scheduleList.appendChild(item);
            });
            day.appendChild(scheduleList);
        }

        if (days) days.appendChild(day);
    }
    updateMonthlyCounts(year, month);
}

let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

// --- 空き時間検索初期化 ---
setupFreeBusy(API_BASE_URL);

// 初期化処理
async function initDashboard() {
    if (activeCalendarId) {
        await fetchCalendarMembers(); // ★修正: ロード時にメンバー一覧を取得
        await loadDataFromAPI();
    }
    createCalendar(currentYear, currentMonth);

    const reopenInfo = sessionStorage.getItem("reopenDayView");
    if (reopenInfo) {
        sessionStorage.removeItem("reopenDayView");
        try {
            const info = JSON.parse(reopenInfo);
            currentYear = info.year;
            currentMonth = info.month;
            createCalendar(currentYear, currentMonth);

            selectedYear = info.year;
            selectedMonth = info.month;
            selectedDay = info.day;
            selectedDayElement = document.querySelector(`.day[data-day="${selectedDay}"]`);
            openDayView();
        } catch(e) {
            console.error("再表示に失敗しました．", e);
        }
    }
}

initDashboard();

// --- カレンダー操作 ---
const prev = document.querySelector("#prev");
const next = document.querySelector("#next");

if (next) {
    next.addEventListener("click", function() {
        days.classList.add("slide-out-next");
        setTimeout(function() {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            createCalendar(currentYear, currentMonth);
            days.classList.remove("slide-out-next");
            days.classList.add("slide-in-next");
            setTimeout(function() { days.classList.remove("slide-in-next"); }, 200);
        }, 200);
    });
}

if (prev) {
    prev.addEventListener("click", function() {
        days.classList.add("slide-out-prev");
        setTimeout(function() {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            createCalendar(currentYear, currentMonth);
            days.classList.remove("slide-out-prev");
            days.classList.add("slide-in-prev");
            setTimeout(function() { days.classList.remove("slide-in-prev"); }, 200);
        }, 200);
    });
}

if (days) {
    days.addEventListener("click", function(event) {
        if (planRadio) planRadio.checked = false;
        if (taskRadio) taskRadio.checked = false;

        if (!event.target.classList.contains("day")) return;
        
        selectedDay = event.target.dataset.day;
        selectedMonth = currentMonth;
        selectedYear = currentYear;
        selectedDayElement = event.target;

        if (scheduleOpen) {
            alert("スケジュールを入力中です。キャンセルするか入力をクリックしてください。");
            return;
        }
        openDayView();
    });
}

// --- 予定の保存・削除 ---
if (schedule_ok) {
    schedule_ok.addEventListener("click", async function() {
        const start = startTime.value;
        const end = endTime.value;
        const title = scheduleTitle.value;
        const type = taskRadio.checked ? "task" : (planRadio.checked ? "plan" : null);

        function toLocalISOString(date) {
            const tzOffset = date.getTimezoneOffset() * 60000;
            return new Date(date.getTime() - tzOffset).toISOString().slice(0, -1);
        }

        if (start === "" || end === "" || title === "" || !type) {
            alert("入力されていない項目があります．");
            return;
        }
        if (start > end) {
            alert("終了時刻より開始時刻のほうが遅いため，入力できません．");
            return;
        }

        const startDate = new Date(selectedYear, selectedMonth, selectedDay, start.split(":")[0], start.split(":")[1]);
        const endDate = new Date(selectedYear, selectedMonth, selectedDay, end.split(":")[0], end.split(":")[1]);

        try {
            let endpoint = "";
            let method = existingId ? "PATCH" : "POST";
            let payload = {};

            if (type === "plan") {
                endpoint = existingId ? `${API_BASE_URL}/api/events/${existingId}` : `${API_BASE_URL}/api/events`;
                payload = {
                    calendar_id: activeCalendarId,
                    title: title,
                    start_at: toLocalISOString(startDate),
                    end_at: toLocalISOString(endDate)
                };
            } else if (type === "task") {
                endpoint = existingId ? `${API_BASE_URL}/api/todos/${existingId}` : `${API_BASE_URL}/api/todos`;
                const userid = auth.currentUser.email.split('@')[0];
                payload = {
                    calendar_id: activeCalendarId,
                    title: title,
                    due_date: toLocalISOString(endDate),
                    assignments: {
                        [userid]: { assigned: true, completed: false }
                    }
                };
            }

            await fetch(endpoint, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            sessionStorage.setItem("reopenDayView", JSON.stringify({
                year: selectedYear, month: selectedMonth, day: selectedDay
            }));
            location.reload();
        } catch(e) {
            console.error("保存失敗", e);
            alert("保存に失敗しました");
        }
    });
}

async function handleDeleteSchedule() {
    if (!existingId) return;

    const type = taskRadio.checked ? "task" : "plan";
    const endpoint = type === "plan" ? `${API_BASE_URL}/api/events/${existingId}` : `${API_BASE_URL}/api/todos/${existingId}`;

    try {
        await fetch(endpoint, { method: "DELETE" });
        sessionStorage.setItem("reopenDayView", JSON.stringify({
            year: selectedYear, month: selectedMonth, day: selectedDay
        }));
        location.reload();
    } catch(e) {
        console.error("削除失敗", e);
        alert("削除に失敗しました");
    }
}

// --- 1日表示 (Day View) ---
function openDayView() {
    if (dayViewTitle) dayViewTitle.textContent = `${selectedMonth + 1}月${selectedDay}日の予定`;
    renderDayview();
    if (dayViewModal) dayViewModal.style.display = "flex";
}

function closeDayView() {
    if (dayViewModal) dayViewModal.style.display = "none";
}

function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
}

function renderDayview() {
    if (!dayViewHours || !dayViewEvents) return;
    dayViewHours.innerHTML = "";
    dayViewEvents.innerHTML = "";

    for (let h = 0; h < 24; h++) {
        const hourLabel = document.createElement("div");
        hourLabel.classList.add("day-view-hour-label");
        hourLabel.style.height = HOUR_HEIGHT + "px";
        hourLabel.textContent = `${String(h)}:00`;
        dayViewHours.appendChild(hourLabel);
    }

    dayViewEvents.style.height = (HOUR_HEIGHT * 24) + "px";
    for (let h = 0; h < 24; h++) {
        const line = document.createElement("div");
        line.classList.add("day-view-hour-line");
        line.style.top = (h * HOUR_HEIGHT) + "px";
        dayViewEvents.append(line);
    }

    const daySchedule = data?.[selectedYear]?.[selectedMonth + 1]?.[selectedDay];

    if (daySchedule) {
        const entries = Object.entries(daySchedule).map(([time, info]) => {
            const [startStr, endStr] = time.split(" - ");
            let start = timeToMinutes(startStr);
            let end = timeToMinutes(endStr);
            if (end <= start) end = start + 30;
            return { time, startStr, endStr, start, end, title: info.title, type: info.type || "plan", id: info.id, completed: info.completed, source: info.source, external_id: info.external_id };
        });

        entries.sort((a, b) => a.start - b.start);
        assignOverlapColumns(entries);

        entries.forEach((entry) => {
            const top = (entry.start / 60) * HOUR_HEIGHT;
            const height = Math.max(((entry.end - entry.start) / 60) * HOUR_HEIGHT, 18);

            const eventEl = document.createElement("div");
            eventEl.classList.add("day-view-event");
            eventEl.style.top = top + "px";
            eventEl.style.height = height + "px";

            const widthPercent = 100 / entry.columnCount;
            eventEl.style.width = `calc(${widthPercent}% - 4px)`;
            eventEl.style.left = `calc(${widthPercent * entry.column}% + 2px)`;

            const timeEl = document.createElement("span");
            timeEl.classList.add("day-view-event-time");
            timeEl.textContent = `${entry.startStr} - ${entry.endStr}`;

            const titleContainer = document.createElement("div");
            titleContainer.style.display = "flex";
            titleContainer.style.alignItems = "center";
            titleContainer.style.gap = "4px";
            titleContainer.style.overflow = "hidden"; // テキストのはみ出し防止

            const titleEl = document.createElement("span");
            titleEl.classList.add("day-view-event-title");
            titleEl.textContent = entry.title;

            if (entry.type === "task") {
                if (entry.completed) {
                    titleEl.style.textDecoration = "line-through";
                    titleEl.style.opacity = "0.5";
                }

                if (entry.source === "classroom") {
                    // Classroomの場合はチェックボックスではなくアイコン/リンクを表示
                    const classLink = document.createElement("a");
                    classLink.href = "https://classroom.google.com/";
                    classLink.target = "_blank";
                    classLink.textContent = "🏫";
                    classLink.style.textDecoration = "none";
                    classLink.style.fontSize = "12px";
                    classLink.style.marginRight = "4px";
                    classLink.title = "Classroomで提出してください";
                    classLink.addEventListener("click", (e) => e.stopPropagation()); // モーダル開くのを防ぐ
                    titleContainer.appendChild(classLink);
                } else {
                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.checked = entry.completed;
                    checkbox.style.margin = "0";
                    checkbox.style.cursor = "pointer";
                    checkbox.style.flexShrink = "0"; // チェックボックスが潰れないようにする

                    checkbox.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        const newStatus = e.target.checked;
                        const omuid = auth.currentUser ? auth.currentUser.email.split('@')[0] : '';

                        titleEl.style.textDecoration = newStatus ? "line-through" : "none";
                        titleEl.style.opacity = newStatus ? "0.5" : "1";

                        try {
                            await fetch(`${API_BASE_URL}/api/todos/${entry.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    assignments: {
                                        [omuid]: { assigned: true, completed: newStatus }
                                    }
                                })
                            });
                            
                            const targetDay = data[selectedYear]?.[selectedMonth + 1]?.[selectedDay];
                            if (targetDay && targetDay[entry.time]) {
                                targetDay[entry.time].completed = newStatus;
                            }
                        } catch (err) {
                            console.error("完了状態の更新に失敗", err);
                            alert("完了状態の更新に失敗しました");
                            e.target.checked = !newStatus;
                            titleEl.style.textDecoration = !newStatus ? "line-through" : "none";
                            titleEl.style.opacity = !newStatus ? "0.5" : "1";
                        }
                    });
                    titleContainer.appendChild(checkbox);
                }
            }

            titleContainer.appendChild(titleEl);

            eventEl.appendChild(timeEl);
            eventEl.appendChild(titleContainer);
            dayViewEvents.appendChild(eventEl);

            eventEl.addEventListener("click", function() {
                const rect = selectedDayElement ? selectedDayElement.getBoundingClientRect() : null;
                openScheduleModal(rect, {
                    time: entry.time, startStr: entry.startStr, endStr: entry.endStr,
                    title: entry.title, type: entry.type, id: entry.id
                });
            });
        });
    }

    function assignOverlapColumns(entries) {
        let i = 0;
        while (i < entries.length) {
            let groupEnd = entries[i].end;
            let j = i + 1;
            while (j < entries.length && entries[j].start < groupEnd) {
                groupEnd = Math.max(groupEnd, entries[j].end);
                j++;
            }
            const group = entries.slice(i, j);
            const columnCount = group.length;
            group.forEach((entry, index) => {
                entry.column = index;
                entry.columnCount = columnCount;
            });
            i = j;
        }
    }
    if (dayViewBody) dayViewBody.scrollTop = 7 * HOUR_HEIGHT;
}

if (dayViewClose) dayViewClose.addEventListener("click", closeDayView);



if (dayViewModal) {
    dayViewModal.addEventListener("click", function(event) {
        if (event.target === dayViewModal) {
            closeDayView();
            modal.style.display = "none";
            scheduleOpen = false;
        }
    });
}

if (dayViewAdd) {
    dayViewAdd.addEventListener("click", function() {
        let rect = selectedDayElement ? selectedDayElement.getBoundingClientRect() : null;
        openScheduleModal(rect);
    });
}

// --- スケジュールモーダル ---
function addDeleteButton() {
    removeDeleteButton();
    const deleteBtn = document.createElement("button");
    deleteBtn.id = "schedule-delete";
    deleteBtn.textContent = "削除";
    deleteBtn.classList.add("schedule-delete-button");
    deleteBtn.addEventListener("click", handleDeleteSchedule);
    if (modalButtons) modalButtons.appendChild(deleteBtn);
}

function removeDeleteButton() {
    const exsiting = document.querySelector("#schedule-delete");
    if (exsiting) exsiting.remove();
}

function openScheduleModal(rect, existingEntry = null) {
    if (scheduleOpen) {
        alert("スケジュールを入力中です。キャンセルするか入力をクリックしてください。");
        return;
    }
    if (showDay) showDay.textContent = `${selectedMonth + 1}月${selectedDay}日のカレンダーの入力`;

    if (existingEntry) {
        if (startTime) startTime.value = existingEntry.startStr;
        if (endTime) endTime.value = existingEntry.endStr;
        if (scheduleTitle) scheduleTitle.value = existingEntry.title;

        if (existingEntry.type === "task") {
            if (taskRadio) taskRadio.checked = true;
        } else {
            if (planRadio) planRadio.checked = true;
        }

        editingKey = existingEntry.time;
        existingId = existingEntry.id;
        addDeleteButton();
    } else {
        if (startTime) startTime.value = "";
        if (endTime) endTime.value = "";
        if (scheduleTitle) scheduleTitle.value = "";
        if (planRadio) planRadio.checked = false;
        if (taskRadio) taskRadio.checked = false;

        editingKey = null;
        existingId = null;
        removeDeleteButton();
    }

    if (modal) {
        modal.style.display = "flex";
        modal.style.position = "fixed";
        if (rect) {
            modal.style.left = rect.left + 30 + "px";
            modal.style.top = rect.bottom + 30 + "px";
        } else {
            modal.style.left = "40%";
            modal.style.top = "30%";
        }
    }
    scheduleOpen = true;
}

if (scheduleCancel) {
    scheduleCancel.addEventListener("click", function() {
        if (modal) modal.style.display = "none";
        scheduleOpen = false;
        editingKey = null;
        existingId = null;
        removeDeleteButton();
    });
}

// --- モーダルドラッグ (requestAnimationFrame版を維持) ---
let isDragging = false;
let offsetX = 0;
let offsetY = 0;
let animationFrameId = null;

if (modalHeader) {
    modalHeader.addEventListener("mousedown", function(event) {
        isDragging = true;
        const rect = modal.getBoundingClientRect();
        modal.style.transform = "none";
        modal.style.margin = "0";
        modal.style.left = rect.left + "px";
        modal.style.top = rect.top + "px";
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
    });
}

document.addEventListener("mousemove", function(event) {
    if (!isDragging || !modal) return;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    animationFrameId = requestAnimationFrame(() => {
        let x = event.clientX - offsetX;
        let y = event.clientY - offsetY;
        const width = modal.offsetWidth;
        const height = modal.offsetHeight;

        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x + width > window.innerWidth) x = window.innerWidth - width;
        if (y + height > window.innerHeight) y = window.innerHeight - height;

        modal.style.left = `${x}px`;
        modal.style.top = `${y}px`;
    });
});

document.addEventListener("mouseup", function() {
    isDragging = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
});

// --- アプリアイコン機能 ---
function renderIcons() {
    const appMenu = document.querySelector('.app-menu');
    const addButton = document.querySelector('.app-add');
    if (!appMenu) return;

    const existingIcons = appMenu.querySelectorAll('.app-icon:not(.app-add)');
    existingIcons.forEach(icon => icon.remove());

    const storedData = localStorage.getItem(STORAGE_KEY);
    if (!storedData) return;

    const icons = JSON.parse(storedData);

    icons.forEach(iconData => {
        const a = document.createElement('a');
        a.href = iconData.link;
        a.className = 'app-icon';
        a.target = '_blank';
        a.title = iconData.name;
        a.draggable = true;
        a.dataset.id = iconData.id;

        const img = document.createElement('img');
        img.alt = iconData.name;
        img.onerror = () => {
            img.src = '/res/img/link.png';
            img.onerror = null;
        };

        if (appDictionary[iconData.link]) {
            img.src = appDictionary[iconData.link].icon;
        } else {
            try {
                const domain = new URL(iconData.link).hostname;
                img.src = `https://unavatar.io/${domain}?fallback=false`;
            } catch (e) {
                img.src = '/res/img/link.png';
            }
        }

        a.appendChild(img);

        a.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', iconData.id);
            setTimeout(() => a.style.opacity = '0.5', 0);
        });

        a.addEventListener('dragend', () => {
            a.style.opacity = '1';
        });

        a.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const contextMenu = document.querySelector('.app-icon-context');
            if (!contextMenu) return;
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.top = `${e.clientY}px`;
            contextMenu.classList.add('is-active');
            contextMenu.dataset.targetId = iconData.id;
        });

        if (addButton && appMenu.contains(addButton)) {
            appMenu.insertBefore(a, addButton);
        } else {
            appMenu.appendChild(a);
        }
    });
}

const addButton = document.querySelector('.app-add');
const popup = document.querySelector('.app-icon-popup');
const submitBtn = popup?.querySelector('.app-icon-submit');
const nameInput = popup?.querySelector('.app-icon-name');
const linkInput = popup?.querySelector('.app-icon-link');
const appInput = popup?.querySelector('.app-icon-app');
const contextMenu = document.querySelector('.app-icon-context');
const deleteBtn = document.querySelector('.app-icon-delete');

renderIcons();

if (addButton) {
    addButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = addButton.getBoundingClientRect();
        const centerX = rect.left + (rect.width / 2);
        const centerY = rect.top + (rect.height / 2);
        if (popup) {
            popup.style.left = `${centerX + 50}px`;
            popup.style.top = `${centerY + 50}px`;
            popup.classList.add('is-active');
        }
    });
}

document.addEventListener('click', (e) => {
    if (popup && popup.classList.contains('is-active')) {
        if (!popup.contains(e.target)) popup.classList.remove('is-active');
    }
    if (contextMenu && contextMenu.classList.contains('is-active')) {
        if (!contextMenu.contains(e.target)) contextMenu.classList.remove('is-active');
    }
});

if (deleteBtn && contextMenu) {
    deleteBtn.addEventListener('click', () => {
        const targetId = contextMenu.dataset.targetId;
        if (!targetId) return;
        let icons = JSON.parse(localStorage.getItem(STORAGE_KEY));
        icons = icons.filter(icon => String(icon.id) !== String(targetId));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(icons));
        contextMenu.classList.remove('is-active');
        renderIcons();
    });
}

if (submitBtn) {
    submitBtn.addEventListener('click', () => {
        let name = nameInput.value.trim();
        let link = linkInput.value.trim();
        const appValue = appInput ? appInput.value.trim() : "";

        if (appValue) {
            if (appDictionary[appValue]) {
                name = appDictionary[appValue].name;
                link = appValue;
            } else {
                link = appValue;
                if (!name) name = appValue;
            }
        }

        if (!name || !link) return;

        const schemeList = Object.keys(appDictionary);
        if (!/^https?:\/\//i.test(link) && !schemeList.includes(link)) {
            link = 'https://' + link;
        }

        if (!schemeList.includes(link)) {
            try {
                new URL(link);
            } catch (error) {
                alert('有効なURLを入力してください。');
                return;
            }
        }

        let icons = [];
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) icons = JSON.parse(storedData);

        icons.push({ id: Date.now(), name: name, link: link });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(icons));

        nameInput.value = '';
        linkInput.value = '';
        if (appInput) appInput.value = '';
        popup.classList.remove('is-active');

        renderIcons();
    });
}

const appMenu = document.querySelector('.app-menu');
if (appMenu) {
    appMenu.addEventListener('dragover', (e) => e.preventDefault());
    appMenu.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId) return;

        const dropTarget = e.target.closest('.app-icon:not(.app-add)');
        if (!dropTarget) return;

        const targetId = dropTarget.dataset.id;
        if (draggedId === targetId) return;

        let icons = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const draggedIndex = icons.findIndex(icon => icon.id == draggedId);
        const targetIndex = icons.findIndex(icon => icon.id == targetId);

        const [removed] = icons.splice(draggedIndex, 1);
        icons.splice(targetIndex, 0, removed);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(icons));
        renderIcons();
    });
}

// --- カレンダー切り替え ---
window.switchCalendar = async function(newCalendarId) {
    if (!newCalendarId || activeCalendarId === newCalendarId) return;

    try {
        activeCalendarId = newCalendarId;
        localStorage.setItem('activeCalendarId', activeCalendarId); // ★現在開いているIDを保存
        await fetchCalendarMembers(); // ★修正: カレンダー切り替え時にメンバー一覧も再取得
        await loadDataFromAPI();

        createCalendar(currentYear, currentMonth);

        closeDayView();
        if (modal) modal.style.display = "none";
        scheduleOpen = false;
        editingKey = null;
        existingId = null;
        removeDeleteButton();

        console.log(`カレンダーを切り替えました: ${activeCalendarId}`);
    } catch (e) {
        console.error("カレンダーの切り替えに失敗しました", e);
        alert("カレンダーの切り替えに失敗しました。");
    }
};