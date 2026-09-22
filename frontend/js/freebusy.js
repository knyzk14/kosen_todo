import { auth } from './firebase-init.js';

export function renderFreeBusyMembers(members) {
    const container = document.querySelector(".members");
    if (!container) return;
    
    container.innerHTML = ""; 

    if (!members || members.length === 0) {
        container.innerHTML = "<p>メンバーがいません</p>";
        return;
    }

    members.forEach(member => {
        const item = document.createElement("div");
        item.classList.add("freetime-member-item");
        item.dataset.id = member.username;
        
        if (auth.currentUser && auth.currentUser.email.startsWith(member.username)) {
            item.classList.add("active");
        }

        const img = document.createElement("img");
        img.src = member.icon_url || "/res/img/link.png";
        img.alt = member.username;
        img.onerror = () => { img.src = '/res/img/link.png'; };

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.classList.add("freetime-member-check");

        const span = document.createElement("span");
        span.classList.add("freetime-member-name");
        span.textContent = member.display_name || member.username;

        item.appendChild(checkbox);
        item.appendChild(img); 
        item.appendChild(span);
        container.appendChild(item);
    });
}

export function setupFreeBusy(apiBaseUrl) {
    const container = document.querySelector(".members");
    const btnSearch = document.querySelector(".freetime-search");
    const resultsContainer = document.querySelector("#freebusy-results");
    const startTimeInput = document.querySelector("#freetime-start");
    const endTimeInput = document.querySelector("#freetime-end");

    const toDatetimeLocalFormat = (date) => {
        const tzOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    };

    if (startTimeInput && endTimeInput) {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000); 

        const nowFormatted = toDatetimeLocalFormat(now);
        const tomorrowFormatted = toDatetimeLocalFormat(tomorrow);

        startTimeInput.min = nowFormatted;
        endTimeInput.min = nowFormatted;

        startTimeInput.value = nowFormatted;
        endTimeInput.value = tomorrowFormatted;
    }

    // if (container) {
    //     container.addEventListener("click", function(event) {
    //         const item = event.target.closest(".freetime-member-item");
    //         if (!item) return;
    //         item.classList.toggle("active");
    //     });
    // }

    if (btnSearch) {
        btnSearch.addEventListener("click", async function() {
            
            const activeItems = container.querySelectorAll(
                ".freetime-member-item:has(.freetime-member-check:checked)"
            );

            const selectedUsernames = Array.from(activeItems)
                .map(item => item.dataset.id);

            if (selectedUsernames.length === 0) {
                alert("検索対象のユーザーを選択してください。");
                return;
            }

            if (!startTimeInput.value || !endTimeInput.value) {
                alert("検索期間を入力してください。");
                return;
            }

            const startAt = new Date(startTimeInput.value).toISOString();
            const endAt = new Date(endTimeInput.value).toISOString();

            if (new Date(startAt) >= new Date(endAt)) {
                alert("終了日時は開始日時より後に設定してください。");
                return;
            }

            const payload = {
                usernames: selectedUsernames,
                start_at: startAt,
                end_at: endAt
            };

            resultsContainer.innerHTML = "<p>検索中...</p>";

            try {
                const res = await fetch(`${apiBaseUrl}/api/freebusy`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) throw new Error("空き時間検索に失敗しました");

                const data = await res.json();
                renderFreeBusyResults(data.free_slots, resultsContainer);

            } catch (e) {
                console.error(e);
                resultsContainer.innerHTML = "<p style='color:red;'>エラーが発生しました。</p>";
            }
        });
    }
}

function renderFreeBusyResults(freeSlots, container) {
    if (!freeSlots || freeSlots.length === 0) {
        container.innerHTML = "<p>共通の空き時間はありません。</p>";
        return;
    }

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    let html = '<div class="freebusy-result-list">';
    
    freeSlots.forEach(slot => {
        const startDate = new Date(slot.start_at);
        const endDate = new Date(slot.end_at);
        
        const month = startDate.getMonth() + 1;
        const date = startDate.getDate();
        const dayOfWeek = dayNames[startDate.getDay()];
        
        const startStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
        const endStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        
        html += `
            <div class="freetime-result-item freetime-result-free">
                <div class="freetime-result-dot"></div>
                <div class="freetime-result-time">
                    ${month}/${date} (${dayOfWeek}) ${startStr} - ${endStr}
                </div>
            </div>
`;
    });
    
    html += '</div>';
    container.innerHTML = html;
}