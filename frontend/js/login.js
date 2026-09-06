// login.js
import { signInWithPopup, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { auth, provider } from "./firebase-init.js";

const loginButton = document.getElementById("login-btn");

// getRedirectResult(auth).catch((error) => {
//   alert("ログインに失敗しました。");
// });

if (loginButton) {
  loginButton.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, provider);
      // await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("ログインエラー:", error);
      alert("ログインに失敗しました。");
    }
  });
}