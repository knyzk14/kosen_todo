import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import app from "./firebase-init.js";

const auth = getAuth(app);

const userIcon = document.getElementById("user-icon");
const userName = document.getElementById("user-name");
const userEmail = document.getElementById("user-email");

onAuthStateChanged(auth, (user) => {
  if (user) {
    // ユーザー情報をHTMLに反映
    if (userName) userName.textContent = user.displayName || "名無しユーザー";
    if (userEmail) userEmail.textContent = user.email || "";
    
    // アイコン画像が存在する場合のみsrcを書き換え
    if (userIcon && user.photoURL) {
      userIcon.src = user.photoURL;
    }

    console.log("ユーザーID:", user.uid);
  }
});