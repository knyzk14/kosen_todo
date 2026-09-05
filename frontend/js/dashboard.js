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

let selectedDay = null;
let selectedYear = null;
let selectedMonth = null;

let data={};

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
        day.textContent = i;
        day.classList.add("day");
        day.dataset.day = i;
        days.appendChild(day);
    }
}

let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

createCalendar(currentYear, currentMonth);

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

    if (!event.target.classList.contains("day")) {
        return;
    }
    const clickedDay = event.target.dataset.day;

    selectedDay = clickedDay;
    selectedMonth = currentMonth;
    selectedYear = currentYear;

    if (scheduleOpen) {
        return;
    }

    showDay.textContent =  `${selectedMonth + 1}月${selectedDay}日のカレンダーの入力`;

    // const key = `schedule-${selectedYear}-${selectedMonth+1}-${selectedDay}`;
    // const saved_schedule = localStorage.getItem(key);

    // if (saved_schedule) {
    //     const data = JSON.parse(saved_schedule);
    //     startTime.value = data.startTime;
    //     endTime.value = data.endTime;
    //     scheduleTitle.value = data.title; 
        startTime.value = "";
        endTime.value = "";
        scheduleTitle.value = "";

    const rect = event.target.getBoundingClientRect();

    modal.style.display = "flex";
    modal.style.position = "fixed";
    modal.style.left = rect.left + 30 + "px";
    modal.style.top = rect.bottom + 30 + "px";

    scheduleOpen = true;
});

schedule_ok.addEventListener("click", function() {

    scheduleOpen = false;

    const start = startTime.value;
    const end = endTime.value;
    const title = scheduleTitle.value;

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

    data[year][month][day][time] = {
        title: title
    };


    if (start === "" || end === "" || title === "") {
        alert("入力されていない項目があります．");
        return;
    }

    localStorage.setItem("schedule", JSON.stringify(data));
    modal.style.display = "none";
});

scheduleCancel.addEventListener("click", function() {
    modal.style.display = "none";
    scheduleOpen = false;
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