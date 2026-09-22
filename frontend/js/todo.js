import { auth } from './firebase-init.js';
import { GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Googleログイン（Classroomスコープ付き）を実行し、トークンを取得する関数
export async function authenticateWithGoogleForClassroom() {
    const provider = new GoogleAuthProvider();
    // Classroomの課題読み取り権限を追加
    provider.addScope('https://www.googleapis.com/auth/classroom.coursework.me.readonly');
    provider.addScope('https://www.googleapis.com/auth/classroom.courses.readonly');

    try {
        const result = await signInWithPopup(auth, provider);
        // Google API用のアクセストークンを取得
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential.accessToken;
        return accessToken;
    } catch (error) {
        console.error("Google認証エラー:", error);
        throw error;
    }
}

// バックエンドに同期リクエストを送信する関数
export async function syncClassroomTasks(apiBaseUrl, accessToken) {
    try {
        const res = await fetch(`${apiBaseUrl}/api/classroom/sync`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ access_token: accessToken })
        });

        if (!res.ok) {
            throw new Error(`同期失敗: ${res.status}`);
        }

        const data = await res.json();
        return data;
    } catch (error) {
        console.error("Classroom同期エラー:", error);
        throw error;
    }
}

// ---------------------------------------------------------
// ToDoリストのUI描画と操作
// ---------------------------------------------------------

export async function fetchAllTodos(apiBaseUrl) {
    try {
        const res = await fetch(`${apiBaseUrl}/api/todos`);
        if (!res.ok) throw new Error("ToDoの取得に失敗しました");
        const todos = await res.json();
        return todos;
    } catch (error) {
        console.error(error);
        return [];
    }
}

export function renderTodoList(todos, apiBaseUrl, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    const omuid = auth.currentUser ? auth.currentUser.email.split('@')[0] : '';

    if (!todos || todos.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#888; padding:20px;'>タスクはありません</p>";
        return;
    }

    const listElement = document.createElement('ul');
    listElement.className = "todo-list";

    todos.forEach(todo => {
        const isCompleted = todo.assignments && todo.assignments[omuid] ? todo.assignments[omuid].completed : false;

        const li = document.createElement('li');
        li.className = "todo-item";
        if (isCompleted) {
            li.classList.add("completed");
        }

        // タイトル
        const titleSpan = document.createElement('span');
        titleSpan.className = "todo-title";
        titleSpan.textContent = todo.title;

        // 期限 (ローカル日時に変換して表示)
        const dateSpan = document.createElement('span');
        dateSpan.className = "todo-date";
        if (todo.due_date) {
            const d = new Date(todo.due_date);
            dateSpan.textContent = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        } else {
            dateSpan.textContent = "期限なし";
        }

        // Classroom課題かどうかの分岐
        if (todo.source === "classroom") {
            const classLink = document.createElement('a');
            classLink.href = "https://classroom.google.com/";
            classLink.target = "_blank";
            classLink.textContent = "🏫";
            classLink.className = "todo-classroom-link";
            classLink.title = "Classroomで提出してください";
            classLink.style.textDecoration = "none";
            classLink.style.fontSize = "16px";
            classLink.style.display = "flex";
            classLink.style.alignItems = "center";
            classLink.style.justifyContent = "center";
            classLink.style.width = "20px";
            
            li.appendChild(classLink);
        } else {
            const checkbox = document.createElement('input');
            checkbox.type = "checkbox";
            checkbox.className = "todo-checkbox";
            checkbox.checked = isCompleted;

            checkbox.addEventListener('change', async (e) => {
                const newStatus = e.target.checked;
                if (newStatus) {
                    li.classList.add("completed");
                } else {
                    li.classList.remove("completed");
                }

                try {
                    const res = await fetch(`${apiBaseUrl}/api/todos/${todo.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            assignments: {
                                [omuid]: { assigned: true, completed: newStatus }
                            }
                        })
                    });
                    
                    if(!res.ok) throw new Error("Update failed");

                } catch (err) {
                    console.error("完了状態の更新に失敗", err);
                    alert("状態の更新に失敗しました");
                    e.target.checked = !newStatus;
                    if (!newStatus) {
                        li.classList.add("completed");
                    } else {
                        li.classList.remove("completed");
                    }
                }
            });

            li.appendChild(checkbox);
        }
        
        const infoDiv = document.createElement('div');
        infoDiv.className = "todo-info";
        infoDiv.appendChild(titleSpan);
        infoDiv.appendChild(dateSpan);
        li.appendChild(infoDiv);

        listElement.appendChild(li);
    });

    container.appendChild(listElement);
}

export function setupTodoTab(apiBaseUrl, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // ヘッダー部分を作成（タイトルと同期ボタン）
    const headerHTML = `
        <div class="todo-header">
            <h3>マイタスク</h3>
            <button id="btn-sync-classroom" class="sync-btn" title="Classroomと同期">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                <span>同期</span>
            </button>
        </div>
        <div id="todo-list-container" class="todo-list-container">
            <p>読み込み中...</p>
        </div>
    `;
    container.innerHTML = headerHTML;

    // 同期ボタンのイベント設定
    const syncBtn = document.getElementById('btn-sync-classroom');
    syncBtn.addEventListener('click', async () => {
        try {
            syncBtn.disabled = true;
            syncBtn.classList.add('syncing');
            
            // 1. GoogleからClassroomアクセス用のトークンを取得
            const accessToken = await authenticateWithGoogleForClassroom();
            
            // 2. バックエンドへ同期リクエスト
            const result = await syncClassroomTasks(apiBaseUrl, accessToken);
            alert(`${result.synced_count}件の課題を同期しました`);

            // 3. ToDoリストを再描画
            await refreshTodoList(apiBaseUrl);
            
        } catch (error) {
            console.error("同期処理中にエラーが発生しました:", error);
            alert("同期処理に失敗しました。ポップアップがブロックされていないか確認してください。");
        } finally {
            syncBtn.disabled = false;
            syncBtn.classList.remove('syncing');
        }
    });

    // 初回描画
    refreshTodoList(apiBaseUrl);
}

async function refreshTodoList(apiBaseUrl) {
    const todos = await fetchAllTodos(apiBaseUrl);
    renderTodoList(todos, apiBaseUrl, "todo-list-container");
}