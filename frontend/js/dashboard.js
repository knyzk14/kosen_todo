import { DefaultCalendarId } from './preload.js';
import { auth } from './firebase-init.js'; // Firebase初期化ファイルから取得

let activeCalendarId = DefaultCalendarId;

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
const modalButtons =document.querySelector(".modal-buttons");

let editingKey = null;
let existingId = null;

const planCount = document.querySelector("#plan");
const taskCount = document.querySelector("#task");
const planRadio = document.querySelector("#radio-plan");
const taskRadio = document.querySelector("#radio-task");

let selectedDay = null;
let selectedYear = null;
let selectedMonth = null;

let data={};

// APIのベースURL設定 (本番と開発環境で切り替え)
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocalhost ? 'https://todo.kyonshi.com' : '';

async function loadDataFromAPI() {
    if (!activeCalendarId) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/calendars/${activeCalendarId}/data`);
        if (!res.ok) throw new Error("データの取得に失敗しました");
        const apiData = await res.json();
        
        data = {}; // 初期化

        // 予定(Events)のパース
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
                id: event.id,          // 編集・削除用にUUIDを保持
                title: event.title,
                type: "plan"
            };
        });

        // タスク(Todos)のパース
        apiData.todos.forEach(todo => {
            // ToDoは due_date しかないため、例えば締切時刻の1時間前～締切時刻を枠として表示する
            const dueDate = new Date(todo.due_date);
            const year = dueDate.getFullYear();
            const month = dueDate.getMonth() + 1;
            const day = dueDate.getDate();
            
            // 例: 締切の1時間前を開始時間とする
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
                type: "task"
            };
        });
    } catch (e) {
        console.error(e);
    }
}

const dayViewModal = document.querySelector("#day-view-modal");
const dayViewTitle = document.querySelector("#day-view-title");
const dayViewHours = document.querySelector("#day-view-hours");
const dayViewEvents = document.querySelector("#day-view-events");
const dayViewBody = document.querySelector(".day-view-body");
const dayViewAdd = document.querySelector("#day-view-add");
const dayViewClose = document.querySelector("#day-view-close");

let selectedDayElement = null; // クリックした日付要素(入力ポップアップの位置決めに使用)
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


function updateMonthlyCounts(year = currentYear,month = currentMonth){
    let planTotal = 0;
    let taskTotal = 0;

    const monthData = data?.[year]?.[month + 1];

    if(monthData){
        Object.values(monthData).forEach(daySchedule=>{
            Object.values(daySchedule).forEach(entry=>{
                if(entry.type==="task"){
                    taskTotal++;
                }
                else{
                    planTotal++;
                }
            
            });
        });
    }
    planCount.textContent =  ` ${planTotal}`;
    taskCount.textContent =  ` ${taskTotal}`;
}
function createCalendar(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    days.innerHTML = "";
    month_title.textContent = month + 1;
    year_title.textContent = year;
    month_name.textContent = monthNames[month];

    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyDay = document.createElement("div");
        emptyDay.classList.add("disabled");
        days.appendChild(emptyDay);
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
        days.appendChild(day);
    }
    updateMonthlyCounts(year,month);
}

let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

// 初期化処理
async function initDashboard() {
    if (activeCalendarId) {
        await loadDataFromAPI();
    }
    createCalendar(currentYear, currentMonth);

    const reopenInfo = sessionStorage.getItem("reopenDayView");
    if(reopenInfo){
        sessionStorage.removeItem("reopenDayView");
        
        try{
            const info = JSON.parse(reopenInfo);

            currentYear = info.year;
            currentMonth = info.month;
            createCalendar(currentYear,currentMonth);

            selectedYear = info.year;
            selectedMonth = info.month;
            selectedDay = info.day;

            selectedDayElement = document.querySelector(`.day[data-day="${selectedDay}"]`);

            openDayView();
        }catch(e){
            console.error("再表示に失敗しました．",e);
        }
    }
}

initDashboard();


const prev = document.querySelector("#prev");
const next = document.querySelector("#next");

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

        setTimeout(function() {
            days.classList.remove("slide-in-next");
        }, 200);
    }, 200);
});

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

        setTimeout(function() {
            days.classList.remove("slide-in-prev");
        }, 200);
    }, 200);
});



days.addEventListener("click", function(event) {

    planRadio.checked = false;
    taskRadio.checked = false;

    if (!event.target.classList.contains("day")) {
        return;
    }
    const clickedDay = event.target.dataset.day;

    selectedDay = clickedDay;
    selectedMonth = currentMonth;
    selectedYear = currentYear;
    selectedDayElement = event.target

    if (scheduleOpen) {
        alert("スケジュールを入力中です。キャンセルするか入力をクリックしてください。");
        return;
    }
    // まず一日予定表を開くようにする
    openDayView();
});

schedule_ok.addEventListener("click", async function() {

    const start = startTime.value;
    const end = endTime.value;
    const title = scheduleTitle.value;
    const type = taskRadio.checked ? "task" :(planRadio.checked ? "plan" :null);

    if(start==="" || end===""||title ===""||!type){
        alert("入力されていない項目があります．");
        return;
    }
    if(start>end){
        alert("終了時刻より開始時刻のほうが遅いため，入力できません．")
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
                start_at: startDate.toISOString(),
                end_at: endDate.toISOString()
            };
        } else if (type === "task") {
            endpoint = existingId ? `${API_BASE_URL}/api/todos/${existingId}` : `${API_BASE_URL}/api/todos`;

            const userid = auth.currentUser.email.split('@')[0];
            payload = {
                calendar_id: activeCalendarId,
                title: title,
                due_date: endDate.toISOString(), // タスクは終了時間を締切とする
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

        // 成功したらデータを再取得してリロード
        sessionStorage.setItem("reopenDayView", JSON.stringify({
            year: selectedYear, month: selectedMonth, day: selectedDay
        }));
        location.reload();

    } catch(e) {
        console.error("保存失敗", e);
        alert("保存に失敗しました");
    }
});

async function handleDeleteSchedule(){
    if (!existingId) return;

    // 現在開いているモーダルがTaskかPlanか判定
    const type = taskRadio.checked ? "task" : "plan";
    const endpoint = type === "plan" ? `${API_BASE_URL}/api/events/${existingId}` : `${API_BASE_URL}/api/todos/${existingId}`;

    try {
        await fetch(endpoint, {
            method: "DELETE"
        });

        sessionStorage.setItem("reopenDayView", JSON.stringify({
            year: selectedYear, month: selectedMonth, day: selectedDay
        }));
        location.reload();
    } catch(e) {
        console.error("削除失敗", e);
        alert("削除に失敗しました");
    }
}

function openDayView(){

    restoreDayViewTOPopup();

    dayViewTitle.textContent = `${selectedMonth + 1}月${selectedDay}日の予定`;
    renderDayview();
    dayViewModal.style.display="flex"
}

function closeDayView(){
    dayViewModal.style.display = "none";
}

function timeToMinutes(timeStr){
    const [h,m] = timeStr.split(":").map(Number);
    return (h||0)* 60 +(m||0);
}

function renderDayview(){
    dayViewHours.innerHTML = "";
    dayViewEvents.innerHTML = "";

    for(let h=0;h<24;h++){
        const hourLabel = document.createElement("div");
        hourLabel.classList.add("day-view-hour-label");
        hourLabel.style.height = HOUR_HEIGHT +"px";
        hourLabel.textContent = `${String(h)}:00`;
        dayViewHours.appendChild(hourLabel);
    }

    dayViewEvents.style.height = (HOUR_HEIGHT * 24) + "px";
    for(let h=0;h<24;h++){
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
            if (end <= start) {
                end = start + 30; // 最低の高さを確保
            }
            return {
                time, startStr, endStr, start, end,
                title: info.title,
                type: info.type || "plan",
                id: info.id
            };
        });

        // 開始時刻順にソート
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

            const titleEl = document.createElement("span");
            titleEl.classList.add("day-view-event-title");
            titleEl.textContent = entry.title;

            eventEl.appendChild(timeEl);
            eventEl.appendChild(titleEl);
            dayViewEvents.appendChild(eventEl);

            eventEl.addEventListener("click",function(){
                const rect = selectedDayElement ? selectedDayElement.getBoundingClientRect() : null;

                openScheduleModal(rect,{
                    time: entry.time,
                    startStr: entry.startStr,
                    endStr: entry.endStr,
                    title: entry.title,
                    type: entry.type,
                    id: entry.id
                });
            });
        });

    }


}

window.openTodayDayView = function(){
    if(scheduleOpen){
        return;
    }
    const now = new Date();

        selectedYear =now.getFullYear();
        selectedMonth = now.getMonth();
        selectedDay = now.getDate();
        selectedDayElement = null;

        embedDayViewInSidebar();
        dayViewModal.style.display = "block";

    dayViewTitle.textContent = `${selectedMonth +1}月${selectedDay}日の予定`;
    renderDayview();

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


    dayViewBody.scrollTop = 7 * HOUR_HEIGHT;
}
    dayViewClose.addEventListener("click", closeDayView);

    const dayViewOriginalParent = dayViewModal.parentNode;
    const dayViewOriginalNextSibling = dayViewModal.nextSibling;
    const sidebarDayViewSlot = document.querySelector("#sidebar-day-view-slot");

    let dayViewEmbedded = false;

    function embedDayViewInSidebar(){
        if(dayViewEmbedded) return;

        sidebarDayViewSlot.appendChild(dayViewModal);
        dayViewModal.classList.add("day-view-embedded");

        dayViewEmbedded = true;
    }

function restoreDayViewTOPopup(){
    if(!dayViewEmbedded) return ;

    dayViewModal.classList.remove("day-view-embedded");
    dayViewModal.classList.add("modal","day-view-popup");
    dayViewModal.style.display= "none";

    if(dayViewOriginalNextSibling && dayViewOriginalNextSibling.parentNode ===dayViewOriginalParent){
        dayViewOriginalParent.insertBefore(dayViewModal,dayViewOriginalNextSibling);
    }else{
        dayViewOriginalParent.appendChild(dayViewModal);
    }

    dayViewEmbedded = false;

}

    // 背景(半透明の部分)をクリックしたら閉じる
    dayViewModal.addEventListener("click", function(event) {

        if(dayViewEmbedded) return;

        if (event.target === dayViewModal) {
            closeDayView();
            modal.style.display="none";
            scheduleOpen = false;
        }
    });

    dayViewAdd.addEventListener("click", function() {
        let rect;
        if (selectedDayElement) {
            rect = selectedDayElement.getBoundingClientRect();
            openScheduleModal(rect);
        } else {
            rect = null;
            openScheduleModal(rect);
        }
    });

function addDeleteButton(){
    removeDeleteButton();

    const deleteBtn = document.createElement("button");
    deleteBtn.id = "schedule-delete";
    deleteBtn.textContent = "削除";
    deleteBtn.classList.add("schedule-delete-button");

    deleteBtn.addEventListener("click",handleDeleteSchedule);

    modalButtons.appendChild(deleteBtn);
}

function removeDeleteButton(){
    const exsiting = document.querySelector("#schedule-delete");
    if(exsiting){
        exsiting.remove();
    }
}

function openScheduleModal(rect,existingEntry = null) {
    if (scheduleOpen) {
        alert("スケジュールを入力中です。キャンセルするか入力をクリックしてください。");
        return;
    }

    showDay.textContent = `${selectedMonth + 1}月${selectedDay}日のカレンダーの入力`;


    if(existingEntry){
        startTime.value = existingEntry.startStr;
        endTime.value = existingEntry.endStr;
        scheduleTitle.value = existingEntry.title;

        if(existingEntry.type==="task"){
            taskRadio.checked = true;
        }else{
            planRadio.checked = true;
        }

        editingKey = existingEntry.time;
        existingId = existingEntry.id;
        addDeleteButton();
    }
    else{
        startTime.value = "";
        endTime.value = "";
        scheduleTitle.value = "";
        planRadio.checked = false;
        taskRadio.checked = false;

        editingKey = null;
        existingId = null;
        removeDeleteButton();
    }

    modal.style.display = "flex";
    modal.style.position = "fixed";

    if (rect) {
        modal.style.left = rect.left + 30 + "px";
        modal.style.top = rect.bottom + 30 + "px";
    } else {
        modal.style.left = "40%";
        modal.style.top = "30%";
    }

    scheduleOpen = true;
}

scheduleCancel.addEventListener("click", function() {
    modal.style.display = "none";
    scheduleOpen = false;
    editingKey = null;
    existingId = null;
    removeDeleteButton();
});

let isDragging = false;
let offsetX = 0;
let offsetY = 0;

modalHeader.addEventListener("mousedown", function(event) {
    isDragging = true;
    const rect = modal.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
});

document.addEventListener("mousemove", function(event) {
    if (!isDragging) {
        return;
    }

    if (modal.contains(event.target)) {
        return;
    }

    let x = event.clientX - offsetX;
    let y = event.clientY - offsetY;

    const width = modal.offsetWidth;
    const height = modal.offsetHeight;

    if (x < 0) {
        x = 0;
    }
    if (y < 0) {
        y = 0;
    }

    if (x + width > window.innerWidth) {
        x = window.innerWidth - width;
    }
    if (y + height > window.innerHeight) {
        y = window.innerHeight - height;
    }

    modal.style.left = `${x}px`;
    modal.style.top = `${y}px`;
});

document.addEventListener("mouseup", function() {
    isDragging = false;
});


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

// document.addEventListener('DOMContentLoaded', () => {
    const addButton = document.querySelector('.app-add');
    const popup = document.querySelector('.app-icon-popup');
    const submitBtn = popup?.querySelector('.app-icon-submit');
    const nameInput = popup?.querySelector('.app-icon-name');
    const linkInput = popup?.querySelector('.app-icon-link');
    const appInput = popup?.querySelector('.app-icon-app');
    const contextMenu = document.querySelector('.app-icon-context');
    const deleteBtn = document.querySelector('.app-icon-delete');

    renderIcons();

    addButton.addEventListener('click', (e) => {
        e.stopPropagation();

        const rect = addButton.getBoundingClientRect();
        const centerX = rect.left + (rect.width / 2);
        const centerY = rect.top + (rect.height / 2);

        popup.style.left = `${centerX + 50}px`;
        popup.style.top = `${centerY + 50}px`;
        popup.classList.add('is-active');
    });

    document.addEventListener('click', (e) => {
        if (popup.classList.contains('is-active')) {
            if (!popup.contains(e.target)) {
                popup.classList.remove('is-active');
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (contextMenu && contextMenu.classList.contains('is-active')) {
            if (!contextMenu.contains(e.target)) {
                contextMenu.classList.remove('is-active');
            }
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
        if (storedData) {
            icons = JSON.parse(storedData);
        }

        const newIcon = {
            id: Date.now(),
            name: name,
            link: link
        };
        icons.push(newIcon);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(icons));

        nameInput.value = '';
        linkInput.value = '';
        if (appInput) appInput.value = '';
        popup.classList.remove('is-active');

        renderIcons();
    });
//});

const appMenu = document.querySelector('.app-menu');
if (appMenu) {
    appMenu.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

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

// ---------------
//   debug
// ---------------

window.switchCalendar = async function(newCalendarId) {
    if (!newCalendarId || activeCalendarId === newCalendarId) {
        return;
    }

    try {
        activeCalendarId = newCalendarId;
        await loadDataFromAPI();

        createCalendar(currentYear, currentMonth);

        closeDayView();
        modal.style.display = "none";
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