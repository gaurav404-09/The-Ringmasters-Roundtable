// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCU_-gLuKAdNI5HRdF4K1J1QhqutHgY57c",
    authDomain: "ringmaster-roundtable.firebaseapp.com",
    projectId: "ringmaster-roundtable",
    storageBucket: "ringmaster-roundtable.firebasestorage.app",
    messagingSenderId: "792758543565",
    appId: "1:792758543565:web:a5133fe44bbed1ae88b584",
    measurementId: "G-PQZ7F6LBXH"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

export default app;
