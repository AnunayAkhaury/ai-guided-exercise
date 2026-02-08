// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyAQNGH2BNurUfZlPn2mWgkHcQb5kbD3QX8',
  authDomain: 'ai-guided-exercise-feedback.firebaseapp.com',
  projectId: 'ai-guided-exercise-feedback',
  storageBucket: 'ai-guided-exercise-feedback.firebasestorage.app',
  messagingSenderId: '396997576150',
  appId: '1:396997576150:web:951882abe0ac424de35077'
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
