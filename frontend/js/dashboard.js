const today = new Date();
const days = document.querySelector(".days");
const month_title = document.querySelector("#month-title");
const year_title = document.querySelector("#year-title");
const month_name = document.querySelector("#month-name");

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

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

prev.addEventListener("click", function(){
    days.classList.add("slide-out-prev");
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