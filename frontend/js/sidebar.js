import { auth } from './firebase-init.js';

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
        active.dispatchEvent(new Event("click"))
    }, 1000);
});

window.addEventListener('resize', () => {
    const currentActive = document.querySelector('.tab.active');
    updateBackground(currentActive);
});

// ================================================================
// API連携 & タイムスケジュールツリー
// ================================================================

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocalhost ? 'https://todo.kyonshi.com' : '';

let apiCalendars = [];
let allUsers = []; // 全ユーザーリスト (ダミーの代わりに使う)

let group_mode = null;             // null(ふつう) / 'delete'(削除中) / 'edit'(修正中)
const group_checked = new Set();   // 削除・編集モードでチェックされたグループID
let edit_target_id = null;         // 修正中のグループID

const group_select_view  = document.getElementById('group-select-view');
const group_add_view     = document.getElementById('group-add-view'); 

// 大きいカレンダーに映すため、詳細ビューやミニカレンダーは不要
// メンバー詳細も大きいカレンダー＋フリータイム検索タブで対応できるため非表示・削除化
const group_detail_view  = document.getElementById('group-detail-view');
const member_detail_view = document.getElementById('member-detail-view');
if(group_detail_view) group_detail_view.style.display = 'none';
if(member_detail_view) member_detail_view.style.display = 'none';

function showView(view) {  
    group_select_view.style.display  = 'none';
    group_add_view.style.display     = 'none';
    view.style.display = 'block';
}

function createAvatar(name, iconUrl) {
    const avatar = document.createElement('div');
    avatar.classList.add('group-member-avatar');
    if (iconUrl) {
        const img = document.createElement('img');
        img.src = iconUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.borderRadius = '50%';
        img.onerror = () => { img.src = '/res/img/link.png'; };
        avatar.appendChild(img);
    } else {
        avatar.textContent = name ? name.slice(0, 1) : '?';
    }
    return avatar;
}

// サーバーからカレンダー一覧を取得

// Firebaseの認証状態が確定するのを待つPromise
const waitForAuth = new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(user => {
        unsubscribe();
        resolve(user);
    });
});

async function fetchCalendars() {
    await waitForAuth; // ★ここで認証完了を待つ
    try {
        const res = await fetch(`${API_BASE_URL}/api/calendars`);
        if(res.ok) {
            apiCalendars = await res.json();
            renderGroupList();
        }
    } catch(e) {
        console.error("カレンダーの取得に失敗:", e);
    }
}

// グループ(カレンダー)リストを描画
function renderGroupList() {
    const group_list = document.getElementById('group-list');
    group_list.innerHTML = '';
 
    apiCalendars.forEach(cal => {
        const block = document.createElement('div');
        block.classList.add('group-block');

        const title = document.createElement('div');
        title.classList.add('group-block-title');

        // デフォルトカレンダーは削除/編集不可にする制御
        const isDefault = cal.is_default;

        if (group_mode !== null && !isDefault) {
            const check = document.createElement('input');
            check.type = 'checkbox';
            check.classList.add('group-check');
            check.checked = group_checked.has(cal.id);
            title.appendChild(check);
        } else if (group_mode !== null && isDefault) {
            // デフォルトカレンダーにはチェックボックスを付けないが、マージンを合わせる
            const spacer = document.createElement('span');
            spacer.style.display = 'inline-block';
            spacer.style.width = '16px';
            spacer.style.marginRight = '8px';
            title.appendChild(spacer);
        }
 
        const title_text = document.createElement('span');
        // デフォルトカレンダーにわかりやすいラベルをつける
        title_text.textContent = isDefault ? `⭐ ${cal.title} (マイカレンダー)` : cal.title;
        title.appendChild(title_text);
 
        title.addEventListener('click', () => {
            if (group_mode === null) {
                // 大きいカレンダーに切り替え
                if (typeof window.switchCalendar === 'function') {
                    window.switchCalendar(cal.id);
                }
            } else {
                if(!isDefault) { // デフォルトは操作不可
                    const check = title.querySelector('.group-check');
                    if (check) onGroupCheck(cal.id, check);
                }
            }
        });
        block.appendChild(title);
 
        // メンバー一覧のプレビュー (オーナー + メンバー)
        const members = [cal.owner, ...cal.members].filter(Boolean);
        members.forEach(member => {
            const row = document.createElement('div');
            row.classList.add('group-member-row');
            const name = document.createElement('span');
            name.textContent = member.display_name || member.username;
            row.append(createAvatar(name.textContent, member.icon_url), name);
            block.appendChild(row);
        });
 
        group_list.appendChild(block);
    });
}
 
// モード管理
function startGroupMode(mode) {
    group_mode = mode;
    group_checked.clear();
 
    document.getElementById('group-mode-note').textContent =
        mode === 'delete' ? '削除する共有カレンダーを選んでください'
                          : '修正する共有カレンダーを選んでください';
    document.getElementById('group-mode-submit').style.display = mode === 'delete' ? '' : 'none';
    document.getElementById('group-mode-bar').style.display = 'flex';
 
    updateModeSubmit();
    renderGroupList();
}
 
function endGroupMode() {
    group_mode = null;
    group_checked.clear();
    document.getElementById('group-mode-bar').style.display = 'none';
    renderGroupList();
}
 
function updateModeSubmit() {
    const n = group_checked.size;
    document.getElementById('group-mode-submit').textContent = n > 0 ? `削除(${n}件)` : '削除';
}
 
function onGroupCheck(calId, check) {
    check.checked = !check.checked;
    if (group_mode === 'delete') {
        if (check.checked) group_checked.add(calId);
        else group_checked.delete(calId);
        updateModeSubmit();
    } else if (group_mode === 'edit') {
        if (check.checked) openGroupEdit(calId); 
    }
}
 
// 新規追加 / 編集用メンバー選択UI
const add_selected = new Set(); // 選択されたusernameのSet

function updateAddSubmit() {
    const n = add_selected.size;
    const label = edit_target_id ? '保存' : '追加';
    // document.getElementById('group-add-submit').textContent = n > 0 ? `${label}(${n}人)` : label;
    // 今回の仕様ではメンバーが0人でもカレンダー自体は作れる
    document.getElementById('group-add-submit').textContent = label;
}

// ユーザーを追加するUI (※現状全ユーザーを取得するAPIがないため、メンバー追加は手動入力などの代替が必要。
// ここでは簡易的に「名前を入力して追加する」テキストボックスを想定しますが、
// 仕様上 APIに全ユーザー一覧がないので、一時的に追加用の簡単なインプットのみ設けます。
function renderGroupAddList(existingMembers = []) {
    const group_add_list = document.getElementById('group-add-list');
    group_add_list.innerHTML = `
        <div style="margin-bottom:10px;">
            <input type="text" id="new-member-username" placeholder="追加するユーザーのOMUIDを入力...">
            <button id="add-member-temp-btn" style="padding:4px 8px;">追加</button>
        </div>
        <div id="selected-members-container"></div>
    `;

    const container = document.getElementById('selected-members-container');

    const renderSelected = () => {
        container.innerHTML = '';
        add_selected.forEach(username => {
            const item = document.createElement('div');
            item.classList.add('group-member-item', 'selected');
            const name = document.createElement('span');
            name.textContent = username;
            item.append(createAvatar(username, null), name);
            item.addEventListener('click', () => {
                add_selected.delete(username);
                renderSelected();
            });
            container.appendChild(item);
        });
    };

    document.getElementById('add-member-temp-btn').addEventListener('click', () => {
        const val = document.getElementById('new-member-username').value.trim();
        if (val) {
            add_selected.add(val);
            document.getElementById('new-member-username').value = '';
            renderSelected();
        }
    });

    renderSelected();
}

function openGroupAdd() {
    endGroupMode(); 
    edit_target_id = null;
    document.getElementById('group-add-title').textContent = '新規追加';
    document.getElementById('group-add-note').textContent = '共有メンバーのOMUIDを入力して追加できます';
    add_selected.clear();
    document.getElementById('group-add-name').value = '';
    updateAddSubmit();
    renderGroupAddList();
    showView(group_add_view);
}
 
function openGroupEdit(calId) {
    endGroupMode();
    edit_target_id = calId;
    const group = apiCalendars.find(c => c.id === calId);
    
    add_selected.clear();
    if (group && group.members) {
        group.members.forEach(member => add_selected.add(member.username));
    }
 
    document.getElementById('group-add-title').textContent = '共有カレンダーを修正';
    document.getElementById('group-add-note').textContent = 'メンバーのOMUIDを追加・削除できます';
    document.getElementById('group-add-name').value = group ? group.title : '';
    
    updateAddSubmit();
    renderGroupAddList();
    showView(group_add_view);
}
 
// イベントリスナー
document.getElementById('group-add-btn').addEventListener('click', openGroupAdd);
document.getElementById('group-add-back-btn').addEventListener('click', () => showView(group_select_view));
document.getElementById('group-edit-btn').addEventListener('click', () => startGroupMode('edit'));
document.getElementById('group-delete-btn').addEventListener('click', () => startGroupMode('delete'));
document.getElementById('group-mode-cancel').addEventListener('click', endGroupMode);
 
// 新規作成・更新のサブミット
document.getElementById('group-add-submit').addEventListener('click', async () => {
    const group_name = document.getElementById('group-add-name').value.trim();
    if(!group_name) {
        alert("カレンダー名を入力してください。");
        return;
    }

    const member_usernames = Array.from(add_selected);

    try {
        if (edit_target_id) {
            // 更新
            await fetch(`${API_BASE_URL}/api/calendars/${edit_target_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: group_name, member_usernames: member_usernames })
            });
        } else {
            // 新規作成 (カレンダー作成後、メンバーがいる場合はPATCHで追加)
            const res = await fetch(`${API_BASE_URL}/api/calendars`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: group_name })
            });
            const newCal = await res.json();
            
            if (member_usernames.length > 0) {
                await fetch(`${API_BASE_URL}/api/calendars/${newCal.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ member_usernames: member_usernames })
                });
            }
        }
        
        edit_target_id = null;
        await fetchCalendars();
        showView(group_select_view);
    } catch(e) {
        console.error("保存失敗:", e);
        alert("保存に失敗しました");
    }
});
 
// 削除のサブミット
document.getElementById('group-mode-submit').addEventListener('click', async () => {
    if (group_checked.size === 0) {
        alert('削除する共有カレンダーを選んでください');
        return;
    }
    if (!confirm(`${group_checked.size}件の共有カレンダーを削除します。よろしいですか?`)) return;
 
    try {
        for (const calId of group_checked) {
            await fetch(`${API_BASE_URL}/api/calendars/${calId}`, {
                method: "DELETE"
            });
        }
        endGroupMode();
        await fetchCalendars();
        
        // 削除されたカレンダーを開いていた場合、リロードするかデフォルトに戻す等の処理
        location.reload(); 
    } catch(e) {
        console.error("削除失敗:", e);
        alert("削除に失敗しました");
    }
});

// 初期読み込み
fetchCalendars();
showView(group_select_view);

// ================================================================
// ログアウト機能
// ================================================================
const userMoreContainer = document.querySelector('.user-more');
if (userMoreContainer) {
    let logoutBtn = userMoreContainer.querySelector('.logout-btn');
    
    // イベントリスナーの登録
    logoutBtn.addEventListener('click', async () => {
        if (confirm('ログアウトしますか？')) {
            try {
                await auth.signOut();
                window.location.href = '/login.html'; // ログイン画面へ
            } catch (error) {
                console.error('ログアウトエラー:', error);
                alert('ログアウトに失敗しました');
            }
        }
    });

    const profileEl = document.querySelector('.profile');
    if (profileEl) {
        profileEl.addEventListener('click', () => {
            // プロフィールがクリックされたらクラスを付け外しする
            userMoreContainer.classList.toggle('show-logout');
        });
    }
}