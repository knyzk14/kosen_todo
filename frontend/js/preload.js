import { auth } from './firebase-init.js';

// 背景の追加処理
document.addEventListener('DOMContentLoaded', () => {
    const html = '<div class="common-background"><img></div>';
    document.body.insertAdjacentHTML('afterbegin', html);
});

// テーマの初期化処理
const initTheme = () => {
    const root = document.documentElement;

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        root.setAttribute('data-theme', savedTheme);
        return;
    }

    root.setAttribute('data-theme', 'light');
};

export const toggleTheme = () => {
    const root = document.documentElement;

    root.classList.add('theme-transition');
    const currentTheme = root.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    setTimeout(() => {
        root.classList.remove('theme-transition');
    }, 300);
};

initTheme();

let currentCalendarId = null;

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocalhost ? 'https://todo.kyonshi.com' : '';

// Firebaseの認証状態が確定するのを待つ
const waitForAuth = new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged(user => {
        unsubscribe();
        resolve(user);
    }, reject);
});

try {
    const user = await waitForAuth;

    if (user) {
        const res = await fetch(`${API_BASE_URL}/api/calendars`);
        
        if (res.ok) {
            const calendars = await res.json();
            const defaultCalendar = calendars.find(cal => cal.is_default === true);

            if (defaultCalendar) {
                currentCalendarId = defaultCalendar.id;
            } else if (calendars.length > 0) {
                currentCalendarId = calendars[0].id;
            }
        } else {
            console.error("カレンダーデータの取得に失敗しました。Status:", res.status);
        }
    } else {
        console.warn("ユーザーがログインしていないため、カレンダー情報を取得しません。");
    }
} catch (e) {
    console.error("カレンダーAPIへのアクセス時にエラーが発生しました:", e);
}

export { currentCalendarId };