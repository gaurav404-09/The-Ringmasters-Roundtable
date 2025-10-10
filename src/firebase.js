// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBLxAbY5HlIE69WuLPi8DIWZNlHXsucJ-4",
  authDomain: "webster-88d49.firebaseapp.com",
  projectId: "webster-88d49",
  storageBucket: "webster-88d49.firebasestorage.app",
  messagingSenderId: "156431116865",
  appId: "1:156431116865:web:eebc2e91ff370f29e1f4c0",
  measurementId: "G-YTVCJZLGLR"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service 
export const auth = getAuth(app);

export default app;