/* IndexedDB 图片存储层：用于 BJD 娃娃照片（Blob 持久化，支持离线） */
const DB = (function () {
  const DB_NAME = 'xiaoyuan_db';
  const STORE = 'images';
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function put(id, blob) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id, blob });
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    }));
  }

  function get(id) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(id);
      r.onsuccess = () => resolve(r.result ? r.result.blob : null);
      r.onerror = () => reject(r.error);
    }));
  }

  function del(id) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }

  function getURL(id) {
    return get(id).then((blob) => (blob ? URL.createObjectURL(blob) : null));
  }

  // 读取全部图片（用于备份导出，将 Blob 内嵌进 JSON）
  function getAll() {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    }));
  }

  // 将图片文件压缩并生成 Blob（统一 JPEG，最长边 maxSize，并居中裁切为正方形）
  function fileToBlob(file, maxSize = 1000, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const iw = img.naturalWidth, ih = img.naturalHeight;
          // 源图居中正方形裁剪区域
          const srcSide = Math.min(iw, ih);
          const sx = Math.round((iw - srcSide) / 2);
          const sy = Math.round((ih - srcSide) / 2);
          // 缩放到最长边不超过 maxSize
          const scale = Math.min(1, maxSize / srcSide);
          const destSide = Math.max(1, Math.round(srcSide * scale));
          const canvas = document.createElement('canvas');
          canvas.width = destSide; canvas.height = destSide;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, srcSide, srcSide, 0, 0, destSide, destSide);
          canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return { open, put, get, del, getURL, getAll, fileToBlob };
})();
