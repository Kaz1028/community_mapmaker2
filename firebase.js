// Firebase SDK のインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, push, set, get, query, orderByChild } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyAwQIOORKvB8Upbl0lo60l5VoqxET-j14s",
  authDomain: "community-mapmaker.firebaseapp.com",
  databaseURL: "https://community-mapmaker-default-rtdb.firebaseio.com",
  projectId: "community-mapmaker",
  storageBucket: "community-mapmaker.firebasestorage.app",
  messagingSenderId: "628025717349",
  appId: "1:628025717349:web:a01afc6a3208aea4cdcc8c",
  measurementId: "G-Y4XM9FKKZE"
};

// Firebase 初期化
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

console.log("Firebase initialized successfully");

// グローバルに公開 (cmapmaker.js から使用できるように)
window.firebaseDB = {
  database,
  ref,
  push,
  set,
  get,
  query,
  orderByChild,
  
  // 投稿を追加する関数
  async addPost(postData) {
    try {
      const postsRef = ref(database, 'posts');
      const newPostRef = push(postsRef);
      const timestamp = Date.now();
      
      await set(newPostRef, {
        ...postData,
        id: newPostRef.key,
        updatetime: timestamp,
        created_at: timestamp
      });
      
      return { ok: true, id: newPostRef.key };
    } catch (error) {
      console.error("Firebase addPost error:", error);
      return { ok: false, error: error.message };
    }
  },
  
  // 全投稿を取得する関数
  async getPosts() {
    try {
      const postsRef = ref(database, 'posts');
      const snapshot = await get(postsRef);
      
      if (!snapshot.exists()) {
        return { ok: true, items: [] };
      }
      
      const items = [];
      snapshot.forEach((childSnapshot) => {
        items.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      
      // updatetime で降順ソート (新しい順)
      items.sort((a, b) => (b.updatetime || 0) - (a.updatetime || 0));
      
      return { ok: true, items };
    } catch (error) {
      console.error("Firebase getPosts error:", error);
      return { ok: false, error: error.message, items: [] };
    }
  }
};

console.log("Firebase DB utility exposed as window.firebaseDB");
