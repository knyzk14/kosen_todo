import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import app from "./firebase-init.js";

const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
  const currentPath = window.location.pathname;
  const isDashboard = currentPath.includes("dashboard");
  const isLogin = currentPath.includes("login");

  if (user) {
    if (isLogin) {
      window.location.replace("/dashboard");
    } else {
      document.body.style.display = 'flex';
    }
  } else {
    console.log("Unauthrized")
    if (isDashboard) {
      window.location.replace("/login");
    } else {
      document.body.style.display = 'flex';
    }
  }
});