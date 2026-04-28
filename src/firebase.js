import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC1oQZ4bSPF_ncUmI6q8HTXBGjxGS28WQo",
  authDomain: "blabtesting-f9bfd.firebaseapp.com",
  projectId: "blabtesting-f9bfd",
  storageBucket: "blabtesting-f9bfd.firebasestorage.app",
  messagingSenderId: "790845221622",
  appId: "1:790845221622:web:2255c310bd6ac2a0211ad7",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
