import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDSj0sTRj-TMEQfNabMrkyIzghfVUE9e2Q",
  authDomain: "maktabi-5.firebaseapp.com",
  projectId: "maktabi-5",
  storageBucket: "maktabi-5.firebasestorage.app",
  messagingSenderId: "1070728660772",
  appId: "1:1070728660772:web:fb3f88f570461d1552d5b1",
  measurementId: "G-96NGRMLVP0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
