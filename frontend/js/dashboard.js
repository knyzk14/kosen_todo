const today=new Date();
const days= document.querySelector(".days");
const month_title=document.querySelector("#month-title");


function createCalendar(year, month) {

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // カレンダーを一旦空にする
    days.innerHTML = "";

    month_title.textContent = `${year}年　　　　${month + 1}月のカレンダー`;

    // 1日の前の空白
    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyDay = document.createElement("div");
        days.appendChild(emptyDay);
    }

    // 日付を作る
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

next.addEventListener("click",function(){
    currentMonth++;
    if(currentMonth >11){
        currentMonth = 0;
        currentYear++;
    }
    createCalendar(currentYear, currentMonth);
});

prev.addEventListener("click",function(){
    currentMonth--;
    if(currentMonth < 0){
        currentMonth = 11;
        currentYear--;
    }
    createCalendar(currentYear, currentMonth);
})





