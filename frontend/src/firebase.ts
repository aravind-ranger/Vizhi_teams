import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBFVP7wZZ_2puihTzD_GVsGm474N2zEBKY",
    authDomain: "vizhiteams.firebaseapp.com",
    projectId: "vizhiteams",
    storageBucket: "vizhiteams.firebasestorage.app",
    messagingSenderId: "442841581452",
    appId: "1:442841581452:web:a1f18b2d47fb2647d538a9",
    measurementId: "G-NCSLKTYWBP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { app, analytics, db, auth };
