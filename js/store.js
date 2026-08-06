/* 本地数据层：localStorage 存储所有结构化数据，提供统一读写接口 */
const Store = (function () {
  const KEY = 'xiaoyuan_store_v1';

  const defaults = {
    weight: [],            // [{id, date, value, note}]
    targetWeight: null,    // 目标体重(kg)
    initialWeight: null,   // 初始体重(kg)，用于计算减肥进度；未设时取最早一条记录
    targetDate: null,      // 目标日期(YYYY-MM-DD)，期望在此日期前达成目标
    height: null,          // 身高(cm)
    circGroups: [          // 围度分组
      { id: 'g_chest', name: '胸围', color: '#FF6B9D' },
      { id: 'g_waist', name: '腰围', color: '#FFB3CE' },
      { id: 'g_hip', name: '臀围', color: '#B388FF' }
    ],
    circ: [],              // [{id, date, values:{groupId:number}}]
    period: [],            // [{id, start, end}]  start/end: YYYY-MM-DD
    periodSettings: { cycle: 28, luteal: 14, periodLen: 6 }, // 周期长度、黄体期长度、经期时长(天)
    dolls: [],             // [{id, name, company, size, skin, headCirc, neckCirc, price, gender, acquired, note, photos:[imgId]}]
    wishes: [],            // 心愿单：想要但未拥有的娃 [{id, name, category, company, size, price, note}]
    acg: [],               // 二次元娃：[{id, name, category(娃脸壳/娃体/头壳), company, size, price, received, photos:[imgId], note, date}]
    acgWishes: [],         // 二次元娃心愿单：[{id, name, category, company, size, price, note}]
    guzi: [],              // 谷子助手：[{id, name, character, type, price, received, photos:[imgId], note}]
    homePhotos: []         // 首页展示照片：[{id, photoId}]
  };

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaults));
      const parsed = JSON.parse(raw);
      // 合并默认结构，兼容旧版本
      return Object.assign(JSON.parse(JSON.stringify(defaults)), parsed);
    } catch (e) {
      return JSON.parse(JSON.stringify(defaults));
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {
      alert('存储空间不足，照片可能过大或记录过多。建议减少照片数量。');
    }
  }

  function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function today() { return new Date().toISOString().slice(0, 10); }

  // ---- 通用集合操作 ----
  function getArr(name) { return data[name] || (data[name] = []); }
  function add(name, obj) { const a = getArr(name); obj.id = obj.id || uid(); a.push(obj); save(); return obj; }
  function update(name, id, patch) {
    const a = getArr(name); const i = a.findIndex((x) => x.id === id);
    if (i >= 0) { a[i] = Object.assign({}, a[i], patch); save(); return a[i]; }
    return null;
  }
  function remove(name, id) {
    const a = getArr(name); const i = a.findIndex((x) => x.id === id);
    if (i >= 0) { const [del] = a.splice(i, 1); save(); return del; }
    return null;
  }
  function get(name, id) { return getArr(name).find((x) => x.id === id) || null; }
  // 拖拽排序：order 为「当前可见项」的新 id 顺序（不含被筛选隐藏的项）。
  // 隐藏项保持原有相对位置，可见项按新顺序填入原本属于可见项的位置。
  function reorder(name, idOrder) {
    const a = getArr(name);
    const map = {}; a.forEach((x) => { map[x.id] = x; });
    let vi = 0;
    const seen = {};
    const result = a.map((x) => {
      const pos = idOrder.indexOf(x.id);
      if (pos >= 0 && !seen[x.id]) { seen[x.id] = true; return map[idOrder[vi++]]; }
      return x;
    });
    data[name] = result; save(); return result;
  }

  // ---- 导出 / 导入（备份） ----
  function exportJSON() { return JSON.stringify(data, null, 2); }
  function importJSON(str) {
    const parsed = JSON.parse(str);
    data = Object.assign(JSON.parse(JSON.stringify(defaults)), parsed);
    save();
  }

  return {
    get data() { return data; },
    save, uid, today,
    getArr, add, update, remove, get, reorder,
    exportJSON, importJSON
  };
})();
