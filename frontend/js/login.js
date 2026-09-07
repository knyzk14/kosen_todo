// login.js
import { signInWithPopup, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { auth, provider } from "./firebase-init.js";

const isLocalDev = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";

getRedirectResult(auth)
  .catch((error) => {
    console.error("リダイレクトログインエラー:", error);
    alert("ログインに失敗しました。");
  });

const loginButton = document.getElementById("login-btn");

if (loginButton) {
  loginButton.addEventListener("click", async () => {
    try {
      if (isLocalDev) {
        await signInWithPopup(auth, provider);
      } else {
        await signInWithRedirect(auth, provider);
      }
    } catch (error) {
      console.error("ログイン操作エラー:", error);
      alert("ログイン処理中にエラーが発生しました。");
    }
  });
}