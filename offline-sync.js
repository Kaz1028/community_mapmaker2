class OfflineSync {
  constructor() {
    this.dbName = 'mapmaker-offline';
    this.storeName = 'pendingPosts';
    this.db = null;
  }
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { this.db = request.result; resolve(); };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }
  async savePending(postData) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.add({ ...postData, timestamp: Date.now() });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async getPending() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async deletePending(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  async syncAll() {
    const pending = await this.getPending();
    console.log(`Syncing ${pending.length} pending posts...`);
    for (const post of pending) {
      try {
        const result = await window.sheetsDB.addPost(post);
        if (result.ok) {
          await this.deletePending(post.id);
          console.log('Synced post:', post.id);
        }
      } catch (err) {
        console.error('Sync failed for post:', post.id, err);
      }
    }
  }
}
window.offlineSync = new OfflineSync();
window.addEventListener('online', () => {
  console.log('Online - starting sync...');
  window.offlineSync.syncAll();
});
