import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBPAeA6kT6vwgcFevlQB5QUK8rYMn5AJCc",
    authDomain: "kosentodo.firebaseapp.com",
    projectId: "kosentodo",
    storageBucket: "kosentodo.firebasestorage.app",
    messagingSenderId: "862685638101",
    appId: "1:862685638101:web:158f85188f1d4d8100215c",
    measurementId: "G-4YY2HRZLBR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const originalFetch = window.fetch;

window.fetch = async (input, init = {}) => {
    const urlStr = typeof input === "string" ? input : (input instanceof Request ? input.url : input.toString());
    const urlObj = new URL(urlStr, window.location.origin);
    const isApiPath = urlObj.pathname.startsWith("/api/");
    const isPing = urlObj.pathname === "/api/ping";
    const isTargetDomain = urlObj.hostname === "todo.kyonshi.com" || urlObj.hostname === window.location.hostname;

    const user = auth.currentUser;

    if (user && isApiPath && !isPing && isTargetDomain) {
        const token = await user.getIdToken(false);

        init.headers = {
            ...init.headers,
            "Authorization": `Bearer ${token}`
        };
    }
    return originalFetch(input, init);
};

export default app;
export { auth, provider };