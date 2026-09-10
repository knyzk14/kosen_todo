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

const planCount = document.querySelector("#plan");
const taskCount = document.querySelector("#task");
const planRadio = document.querySelector("#radio-plan");
const taskRadio = document.querySelector("#radio-task");

let selectedDay = null;
let selectedYear = null;
let selectedMonth = null;


let data={};

const savedSchedule = localStorage.getItem("schedule");
if(savedSchedule){
    try{
        data=JSON.parse(savedSchedule);
    }catch(e){
        console.error("スケジュールデータの読み込みに失敗しました.",e);
        data={};
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
                    planTotal++;//typeがない古いデータは削除してあるが，予定扱いにしておく．
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

schedule_ok.addEventListener("click", function() {

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

    scheduleOpen = false;

    const year = selectedYear;
    const month = selectedMonth + 1;
    const day = selectedDay;
    const time = `${start} - ${end}`;   

    if (!data[year]) {
        data[year] = {};
    }

    if (!data[year][month]) {
        data[year][month] = {};
    }

    if (!data[year][month][day]) {
        data[year][month][day] = {};
    }

    if(editingKey && editingKey !== time && data[year][month][day][editingKey]){
        delete data[year][month][day][editingKey];
    }

    data[year][month][day][time] = {
        title: title,
        type:type
    };

    localStorage.setItem("schedule",JSON.stringify(data));

    sessionStorage.setItem("reopenDayView",JSON.stringify({
        year:year,
        month:month -1,
        day:day
    }));

    location.reload();

    updateMonthlyCounts();

    editingKey = null;
    removeDeleteButton();
    modal.style.display = "none";
});

function handleDeleteSchedule(){
    if(!editingKey){
        return;
    }
    const year = selectedYear;
    const month = selectedMonth + 1;
    const day = selectedDay;

    if (data?.[year]?.[month]?.[day]?.[editingKey]) {
        delete data[year][month][day][editingKey];

        if (Object.keys(data[year][month][day]).length === 0) {
            delete data[year][month][day];
        }
        if (Object.keys(data[year][month]).length === 0) {
            delete data[year][month];
        }
        if (Object.keys(data[year]).length === 0) {
            delete data[year];
        }

        localStorage.setItem("schedule", JSON.stringify(data));
        updateMonthlyCounts();
    }

    editingKey = null;
    removeDeleteButton();
    modal.style.display = "none";
    scheduleOpen = false;
}

function openDayView(){
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

    const daySchedule = data?.[selectedYear]?.[selectedMonth + 1]?.[selectedDay]; //オプショナルチェーン.存在しないならエラーにしない．

    if (daySchedule) {
        const entries = Object.entries(daySchedule).map(([time, info]) => {
            const [startStr, endStr] = time.split(" - ");
            let start = timeToMinutes(startStr);
            let end = timeToMinutes(endStr);
            if (end <= start) {
                end = start + 30; // 最低の高さを確保
            }
            return {time, startStr, endStr, start, end, title: info.title,type:info.type||"plan" };
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
            eventEl.style.left = `calc(${widthPercent * entry.column}% + 2px)`;//予定同士がぴったりくっつかないよう2pxのマージンを追加

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
                    type: entry.type
                });
            });
        });

    }

// entries(ソート済み)に対して、重なっているグループごとに
// column(自分が何番目か)と columnCount(グループの合計数)を割り当てる
function assignOverlapColumns(entries) {
    let i = 0;

    while (i < entries.length) {
        // ① iから始まる「連続して重なっているグループ」の終端 j を探す
        let groupEnd = entries[i].end;
        let j = i + 1;

        while (j < entries.length && entries[j].start < groupEnd) {
            groupEnd = Math.max(groupEnd, entries[j].end);
            j++;
        }
        // group は entries[i .. j-1]
        const group = entries.slice(i, j);//sliceはi以上j未満の要素を取り出す．
        const columnCount = group.length;

        // ② グループ内の各予定に column(0, 1, 2...)を振る
        group.forEach((entry, index) => {
            entry.column = index;
            entry.columnCount = columnCount;
        });

        i = j; // 次のグループへ
    }
}

    dayViewBody.scrollTop = 7 * HOUR_HEIGHT;
}
    dayViewClose.addEventListener("click", closeDayView);

    // 背景(半透明の部分)をクリックしたら閉じる
    dayViewModal.addEventListener("click", function(event) {
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

//one-day-view表示の時のみポップアップに削除を表示させる

function addDeleteButton(){
    removeDeleteButton(); //念のため既存の削除ボタンが存在した場合，削除する．

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


//以下one-day-view用の予定の詳細の確認を行うためのポップアップ呼び出し.
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
        addDeleteButton();
    }
    else{
        startTime.value = "";
        endTime.value = "";
        scheduleTitle.value = "";
        planRadio.checked = false;
        taskRadio.checked = false;

        editingKey = null;
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

document.addEventListener('DOMContentLoaded', () => {
    const addButton = document.querySelector('.app-add');
    const popup = document.querySelector('.app-icon-popup');
    const submitBtn = popup?.querySelector('.app-icon-submit');
    const nameInput = popup?.querySelector('.app-icon-name');
    const linkInput = popup?.querySelector('.app-icon-link');
    const appInput = popup?.querySelector('.app-icon-app');
    const contextMenu = document.querySelector('.app-icon-context');
    const deleteBtn = document.querySelector('.app-icon-delete');

    renderIcons();

    if (!addButton || !popup || !submitBtn) return;

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
});

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