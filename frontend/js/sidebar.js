const background = document.querySelector('.tab-background');
const tabs = document.querySelectorAll('.tab');
const panes = document.querySelectorAll('.tab-pane');

const updateBackground = (activeTab) => {
    if (!activeTab) return;
    const tabLeft = activeTab.offsetLeft;
    const tabWidth = activeTab.offsetWidth;

    background.style.left = `${tabLeft}px`;
    background.style.width = `${tabWidth}px`;
};

document.addEventListener('DOMContentLoaded', () => {
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {

            tabs.forEach(t => t.classList.remove('active'));
            const clickedTab = e.target;
            clickedTab.classList.add('active');

            updateBackground(clickedTab);

            const targetId = clickedTab.getAttribute('data-target');
            panes.forEach(pane => {
                if (pane.id === targetId) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });

            if (targetId === 'todo-content'){
                if(typeof window.openTodayDayView === 'function'){
                    window.openTodayDayView();
                }
            }
        });
    });
});

window.addEventListener('load', () => {
    const active = document.querySelector('.tab.active');
    setTimeout(() => {
        updateBackground(active);
    }, 1000);
});

window.addEventListener('resize', () => {
    const currentActive = document.querySelector('.tab.active');
    updateBackground(currentActive);
});

const mini_cal_days = document.querySelector(".mini-cal-days")
const mini_month_title = document.querySelector("#mini-month-title")
const mini_year_title = document.querySelector("#mini-year-title")
const mini_month_name = document.querySelector("#mini-month-name")

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

let mini_year, mini_month;      // ★ グループのカレンダー
let member_year, member_month;  // ★ メンバーのカレンダー

let group_mode = null;             // ★ null(ふつう) / 'delete'(削除中) / 'edit'(修正中)
const group_checked = new Set();   // ★ 削除モードでチェックされたグループ
let edit_target = null;            // ★ 修正中のグループ(null なら新規追加)

const group_select_view  = document.getElementById('group-select-view');
const group_detail_view  = document.getElementById('group-detail-view');
const group_add_view     = document.getElementById('group-add-view'); 
const member_detail_view = document.getElementById('member-detail-view');


function showView(view) {  // ★
    group_select_view.style.display  = 'none';
    group_detail_view.style.display  = 'none';
    member_detail_view.style.display = 'none';
    group_add_view.style.display     = 'none';
    view.style.display = 'block';
}

// ================================================================
// ★★★★★ お試し用ダミーデータ(ここから) ★★★★★
//   ここは動作確認のためだけの嘘のデータ。
//   本物のデータをつなぐときは、この dummy_groups を消して、
//   API(fetch)の結果に差し替える。形は
//     [ { name: 'グループ名', members: [ { name: '人の名前' }, ... ] }, ... ]
//   にそろえておけば、下の renderGroupList / openGroupDetail は
//   そのまま動く。(dummy_groups を使っているのは renderGroupList の1か所だけ)
//   ヤンキーは8人にしてあり、メンバー一覧のスクロール確認用。
//   by 生成AI
// ================================================================

const dummy_groups = [
    { name: 'アルファ', members: [{ name: '山田 太郎' }, { name: '佐藤 花子' }] },
    { name: 'ブラボー', members: [{ name: '鈴木 一郎' }, { name: '高橋 健' }] },
    // ↓ 修正画面は dummy_people から「名前が同じ人」を探すので、dummy_people にいる名前にしてある
    { name: 'ヤンキー', members: ['渡辺 蓮', '中村 結衣', '小林 大輝', '加藤 美咲', '吉田 翔', '山本 葵', '松本 陽菜', '井上 拓海'].map(name => ({ name })) },
];

const dummy_people = [
    '山田 太郎', '佐藤 花子', '鈴木 一郎', '高橋 健', '伊藤 舞',
    '渡辺 蓮', '中村 結衣', '小林 大輝', '加藤 美咲', '吉田 翔',
    '山本 葵', '松本 陽菜', '井上 拓海', '木村 さくら', '林 悠斗', '清水 凛',
].map(name => ({ name }));

const add_selected = new Set();

// 丸いアイコン(名前の1文字目)を作る。画像にしたいときはここを変える(★)
function createAvatar(name) {
    const avatar = document.createElement('div');
    avatar.classList.add('group-member-avatar');
    avatar.textContent = name.slice(0, 1);
    return avatar;
}

// ---- ① グループ選択:グループごとのブロックを作る -------------------
function renderGroupList() {
    const group_list = document.getElementById('group-list');
    group_list.innerHTML = '';
 
    dummy_groups.forEach(group => {   // ← 本物にするときはここの dummy_groups を差し替える
        const block = document.createElement('div');
        block.classList.add('group-block');

        // グループ名の行(ふつうは押すと②へ)
        //   ★ title を先に作る。以前は check を title に入れる行が、この行より上にあって
        //     「Cannot access 'title' before initialization」になっていた
        const title = document.createElement('div');
        title.classList.add('group-block-title');

        // ★ 削除・修正モードのときだけチェックボックスを付ける
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.classList.add('group-check');
        check.checked = group_checked.has(group);
        if (group_mode !== null) title.appendChild(check);
 
        const title_text = document.createElement('span');
        title_text.textContent = group.name;
        title.appendChild(title_text);
 
        // ★ 押したときの動き(ふつうは②へ / モード中はチェックのON/OFF)
        //   ※ 古い  title.textContent = group.name;  と
        //      title.addEventListener('click', () => openGroupDetail(group));  は消した
        title.addEventListener('click', () => {
            if (group_mode === null) {
                openGroupDetail(group);
            } else {
                onGroupCheck(group, check);
            }
        });
        block.appendChild(title);
 
        // そのグループの人たち(見せるだけ)
        group.members.forEach(member => {
            const row = document.createElement('div');
            row.classList.add('group-member-row');
            const name = document.createElement('span');
            name.textContent = member.name;
            row.append(createAvatar(member.name), name);
            block.appendChild(row);
        });
 
        group_list.appendChild(block);
    });
}
 
 
// ---- ② グループ詳細:カレンダー+メンバー一覧 ----------------------
function openGroupDetail(group) {
    document.getElementById('group-detail-title').textContent = group.name;
 
    // メンバー一覧(多いときは CSS の .group-members でスクロール)
    const group_members = document.getElementById('group-members');
    group_members.innerHTML = '';
    group.members.forEach(member => {
        const item = document.createElement('div');
        item.classList.add('group-member-item');
        const name = document.createElement('span');
        name.textContent = member.name;
        item.append(createAvatar(member.name), name);
        item.addEventListener('click', () => openMemberDetail(member));  // 押すと③へ
        group_members.appendChild(item);
    });
 
    // カレンダーは今月から
    mini_year  = new Date().getFullYear();
    mini_month = new Date().getMonth();
    members_createCal(mini_year, mini_month);
 
    showView(group_detail_view);
}
 
 
// ---- ③ メンバー詳細:その人のカレンダー ----------------------------
function openMemberDetail(member) {
    document.getElementById('member-detail-title').textContent = member.name;
 
    // グループ側と同じ年月から開く
    member_year  = mini_year;
    member_month = mini_month;
    member_createCal(member_year, member_month);
 
    showView(member_detail_view);
}
 
 
// ---- ボタン ---------------------------------------------------
// グループのカレンダー ◀ ▶
document.getElementById('mini-cal-prev').addEventListener('click', () => {
    const d = new Date(mini_year, mini_month - 1, 1);
    mini_year = d.getFullYear();
    mini_month = d.getMonth();
    members_createCal(mini_year, mini_month);
});
document.getElementById('mini-cal-next').addEventListener('click', () => {
    const d = new Date(mini_year, mini_month + 1, 1);
    mini_year = d.getFullYear();
    mini_month = d.getMonth();
    members_createCal(mini_year, mini_month);
});
 
// メンバーのカレンダー ◀ ▶
document.getElementById('mini-member-cal-prev').addEventListener('click', () => {
    const d = new Date(member_year, member_month - 1, 1);
    member_year = d.getFullYear();
    member_month = d.getMonth();
    member_createCal(member_year, member_month);
});
document.getElementById('mini-member-cal-next').addEventListener('click', () => {
    const d = new Date(member_year, member_month + 1, 1);
    member_year = d.getFullYear();
    member_month = d.getMonth();
    member_createCal(member_year, member_month);
});
 
// 戻る
document.getElementById('group-back-btn').addEventListener('click', () => showView(group_select_view));
document.getElementById('member-back-btn').addEventListener('click', () => showView(group_detail_view));
 
 
// ---- 最初に1回だけ実行 -----------------------------------------
renderGroupList();
showView(group_select_view);

const today= new Date();
const year =today.getFullYear();
const month = today.getMonth();

function members_createCal(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    mini_cal_days.innerHTML = "";
    mini_month_title.textContent = month + 1;
    mini_year_title.textContent = year;
    mini_month_name.textContent = monthNames[month];

    for (let i = 0; i < firstDay.getDay(); i++) {
        const mini_emptyDay = document.createElement("div");
        mini_emptyDay.classList.add("mini-disabled");
        mini_cal_days.appendChild(mini_emptyDay);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
        const day = document.createElement("div");
        const p = document.createElement("p");
        const hr = document.createElement("hr");
        day.classList.add("mini_day");
        day.dataset.day = i;
        p.textContent = i;
        day.appendChild(p);
        day.appendChild(hr);
        mini_cal_days.appendChild(day);
    }
}

const mini_member_cal_days  = document.querySelector(".mini-member-cal-days")
const member_month_title = document.querySelector("#member-month-title")
const member_year_title  =document.querySelector("#member-year-title")
const member_month_name = document.querySelector("#member-month-name")


function member_createCal(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    mini_member_cal_days.innerHTML = "";
    member_month_title.textContent = month + 1;
    member_year_title.textContent= year;
    member_month_name.textContent = monthNames[month];

    for (let i = 0; i < firstDay.getDay(); i++) {
        const members_emptyDay = document.createElement("div");
        members_emptyDay.classList.add("members_disabled");
        mini_member_cal_days.appendChild(members_emptyDay);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
        const day = document.createElement("div");
        const p = document.createElement("p");
        const hr = document.createElement("hr");
        day.classList.add("members_day");
        day.dataset.day = i;
        p.textContent = i;
        day.appendChild(p);
        day.appendChild(hr);
        mini_member_cal_days.appendChild(day);
    }
}

function updateAddSubmit() {
    const n = add_selected.size;
    const label = edit_target ? '保存' : '追加';
    document.getElementById('group-add-submit').textContent = n > 0 ? `${label}(${n}人)` : label;
}

function renderGroupAddList() {
    const group_add_list = document.getElementById('group-add-list');
    group_add_list.innerHTML = '';
 
    dummy_people.forEach(person => {   // ← 本物にするときはここの dummy_people を差し替える
        const item = document.createElement('div');
        item.classList.add('group-member-item');
        const name = document.createElement('span');
        name.textContent = person.name;
        item.append(createAvatar(person.name), name);
        item.classList.toggle('selected', add_selected.has(person));   // ★ 追加: 開いた時点で選択済みの人(修正のとき今のメンバー)を青くする
 
        item.addEventListener('click', () => {
            if (add_selected.has(person)) {
                add_selected.delete(person);   // 選択中 → 解除
            } else {
                add_selected.add(person);      // 未選択 → 選択
            }
            item.classList.toggle('selected', add_selected.has(person));  // 見た目を合わせる
            updateAddSubmit();
        });
 
        group_add_list.appendChild(item);
    });
}

function openGroupAdd() {

    endGroupMode();                 // ★
    edit_target = null;             // ★ 新規追加なので「修正中のグループ」は無し

    document.getElementById('group-add-title').textContent = '新規追加';                            // ★
    document.getElementById('group-add-note').textContent = '新規追加する人を以下から選んでください';  // ★

    add_selected.clear();
    document.getElementById('group-add-name').value = '';
    updateAddSubmit();
    renderGroupAddList();
    showView(group_add_view);
}
 
document.getElementById('group-add-btn').addEventListener('click', openGroupAdd);
document.getElementById('group-add-back-btn').addEventListener('click', () => showView(group_select_view));
 
// 「追加」を押したとき: 選んだ人で新しい共有カレンダー(グループ)を作る / 修正中なら書き換える
document.getElementById('group-add-submit').addEventListener('click', () => {
    if (add_selected.size === 0) {
        alert('追加する人を1人以上選んでください');
        return;
    }
    const group_name = document.getElementById('group-add-name').value.trim()
                       || (edit_target ? edit_target.name : '新しいグループ');   // ★ 修正で名前が空なら今の名前のまま
    const members = dummy_people.filter(p => add_selected.has(p));   // 一覧の並び順で保存

    // ★★★★★ お試し(ここから) ★★★★★
    //   ダミーの一覧に足しているだけなので、ページを再読み込みすると消える。
    //   本物にするときは、ここを「APIにPOSTして保存 → グループ一覧を取り直す」に差し替える。
    if (edit_target) {
        edit_target.name = group_name;
        edit_target.members = members;
    } else {
        dummy_groups.push({ name: group_name, members });
    }
    // ★★★★★ お試し(ここまで) ★★★★★
    //   ※ この下にあった古い dummy_groups.push({...}) と、2回目の renderGroupList / showView は消した
    //     (残すと、追加も修正も「グループが2つ」になる)

    edit_target = null;
    renderGroupList();                 // グループ選択の一覧を作り直す → 変更が反映される
    showView(group_select_view);
    // ※ 作った直後にそのグループを開きたいなら、上の showView の代わりに
    //    openGroupDetail(dummy_groups[dummy_groups.length - 1]);
});
 

function startGroupMode(mode) {
    group_mode = mode;
    group_checked.clear();
 
    document.getElementById('group-mode-note').textContent =
        mode === 'delete' ? '削除する共有カレンダーを選んでください'
                          : '修正する共有カレンダーを選んでください';
    // 「削除」ボタンは削除モードのときだけ(修正は、チェックした時点で画面が変わる)
    document.getElementById('group-mode-submit').style.display = mode === 'delete' ? '' : 'none';
    document.getElementById('group-mode-bar').style.display = 'flex';
 
    updateModeSubmit();
    renderGroupList();
}
 
// モードを終わる(キャンセル / 削除が終わった / 他の画面に移るとき)
function endGroupMode() {
    group_mode = null;
    group_checked.clear();
    document.getElementById('group-mode-bar').style.display = 'none';
    renderGroupList();
}
 
// 「削除」ボタンに件数を出す
function updateModeSubmit() {
    const n = group_checked.size;
    document.getElementById('group-mode-submit').textContent = n > 0 ? `削除(${n}件)` : '削除';
}
 
// モード中にグループ名を押したとき
function onGroupCheck(group, check) {
    check.checked = !check.checked;          // チェックのON/OFFを切り替える
 
    if (group_mode === 'delete') {
        if (check.checked) {
            group_checked.add(group);
        } else {
            group_checked.delete(group);
        }
        updateModeSubmit();
    } else if (group_mode === 'edit') {
        if (check.checked) openGroupEdit(group);   // 修正: チェックした瞬間に修正画面へ
    }
}
 
// 修正画面を開く(④新規追加画面を、そのまま使い回す)
function openGroupEdit(group) {
    endGroupMode();          // 戻ってきたとき、一覧がふつうの状態になっているように
    edit_target = group;
 
    add_selected.clear();
    group.members.forEach(member => {
        // ★お試し: 名前が同じ人を dummy_people から探して、選択済みにする(本物ではidで探す)
        const person = dummy_people.find(p => p.name === member.name);
        if (person) add_selected.add(person);
    });
 
    document.getElementById('group-add-title').textContent = '共有カレンダーを修正';
    document.getElementById('group-add-note').textContent = 'メンバーを選び直してください';
    document.getElementById('group-add-name').value = group.name;
    updateAddSubmit();
    renderGroupAddList();
    showView(group_add_view);
}
 
// ボタン
document.getElementById('group-edit-btn').addEventListener('click', () => startGroupMode('edit'));
document.getElementById('group-delete-btn').addEventListener('click', () => startGroupMode('delete'));
document.getElementById('group-mode-cancel').addEventListener('click', endGroupMode);
 
// 「削除」を押したとき: 確認してから、チェックされたグループを消す
document.getElementById('group-mode-submit').addEventListener('click', () => {
    if (group_checked.size === 0) {
        alert('削除する共有カレンダーを選んでください');
        return;
    }
    if (!confirm(`${group_checked.size}件の共有カレンダーを削除します。よろしいですか?`)) return;
 
    // ★★★★★ お試し(ここから) ★★★★★
    //   ダミーの一覧から取り除いているだけ。再読み込みすると元に戻る。
    //   本物にするときは、チェックされたグループのidをAPIに DELETE で送り、
    //   一覧を取り直す処理に差し替える。
    for (let i = dummy_groups.length - 1; i >= 0; i--) {
        if (group_checked.has(dummy_groups[i])) dummy_groups.splice(i, 1);
    }
    // ★★★★★ お試し(ここまで) ★★★★★
 
    endGroupMode();
});   // ★ ファイルの最後の }); が抜けていたので足した