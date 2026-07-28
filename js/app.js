/* 小圆生活助手 —— 应用外壳、路由、侧边栏（含移动端返回手势）、通用 UI */
(function () {
  // ---------- 通用 UI 工具 ----------
  const UI = {
    isMobile() { return window.matchMedia('(max-width: 860px)').matches; },
    today() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); },
    parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
    fmtMD(s) { const d = this.parseDate(s); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; },
    addDays(s, n) { const d = this.parseDate(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); },
    diffDays(a, b) { return Math.round((this.parseDate(b) - this.parseDate(a)) / 86400000); },
    daysFromToday(s) { return this.diffDays(this.today(), s); },
    weekday(s) { return ['日', '一', '二', '三', '四', '五', '六'][this.parseDate(s).getDay()]; },
    escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    el(tag, attrs, children) {
      const e = document.createElement(tag);
      if (attrs) for (const k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'html') e.innerHTML = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
      }
      function htmlNode(str) { const t = document.createElement('template'); t.innerHTML = str.trim(); return t.content.firstChild; }
      if (children) (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c == null) return;
        if (typeof c === 'string' && c.charAt(0) === '<') e.appendChild(htmlNode(c));
        else e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
      return e;
    },
    toast(msg, ms = 1800) {
      let t = document.getElementById('toast');
      t.textContent = msg; t.classList.add('show');
      clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), ms);
    },
    openModal({ title = '', body = null, actions = [], onMount, closeOnMask = true }) {
      const mask = document.getElementById('modal-mask');
      const box = document.getElementById('modal');
      box.innerHTML = '';
      const h = UI.el('h3', { html: title }); box.appendChild(h);
      if (body) box.appendChild(typeof body === 'string' ? UI.el('div', { html: body }) : body);
      const close = () => mask.classList.remove('show');
      if (actions.length) {
        const act = UI.el('div', { class: 'modal-actions' });
        actions.forEach((a) => {
          const b = UI.el('button', { class: 'btn ' + (a.kind || ''), onclick: () => (a.onClick ? a.onClick(close) : close()) }, a.text);
          act.appendChild(b);
        });
        box.appendChild(act);
      }
      // 点击遮罩关闭（点击遮罩空白处，而非弹窗内容）
      mask.onclick = (e) => { if (e.target === mask && closeOnMask) close(); };
      mask.classList.add('show');
      if (onMount) onMount(box, close);
      return { close };
    },
    confirm(title, msg) {
      return new Promise((res) => {
        UI.openModal({
          title, body: UI.el('p', { class: 'muted' }, msg),
          actions: [
            { text: '取消', kind: 'btn-ghost', onClick: (c) => { c(); res(false); } },
            { text: '确定', kind: 'btn-danger', onClick: (c) => { c(); res(true); } }
          ]
        });
      });
    },
    // 通用照片灯箱（BJD、减肥对比照共用）
    photoViewer(photoIds, currentId) {
      const urls = [];
      function cleanup() { urls.forEach((u) => URL.revokeObjectURL(u)); }
      const mask = UI.el('div', { class: 'photo-viewer' });
      let idx = Math.max(0, photoIds.indexOf(currentId));
      const imgWrap = UI.el('div', { class: 'pv-img-wrap' });
      const counter = UI.el('div', { class: 'pv-counter' });
      function show() {
        imgWrap.innerHTML = '';
        DB.getURL(photoIds[idx]).then((u) => {
          if (u) { urls.push(u); imgWrap.appendChild(UI.el('img', { src: u, class: 'pv-img' })); }
        });
        counter.textContent = (idx + 1) + ' / ' + photoIds.length;
      }
      show();
      const prevBtn = UI.el('button', { class: 'pv-nav pv-prev', html: svg('back') });
      const nextBtn = UI.el('button', { class: 'pv-nav pv-next', html: svg('chevron') });
      const closeBtn = UI.el('button', { class: 'pv-close', html: svg('close') });
      prevBtn.addEventListener('click', (e) => { e.stopPropagation(); idx = (idx - 1 + photoIds.length) % photoIds.length; show(); });
      nextBtn.addEventListener('click', (e) => { e.stopPropagation(); idx = (idx + 1) % photoIds.length; show(); });
      closeBtn.addEventListener('click', () => { cleanup(); mask.remove(); });
      mask.addEventListener('click', (e) => { if (e.target === mask) { cleanup(); mask.remove(); } });
      mask.appendChild(closeBtn); mask.appendChild(prevBtn); mask.appendChild(imgWrap); mask.appendChild(nextBtn); mask.appendChild(counter);
      document.body.appendChild(mask);
    }
  };
  window.UI = UI;

  // ---------- 路由 ----------
  const routes = {};
  window.registerView = function (name, render) { routes[name] = render; };

  const NAV = [
    { key: 'home', label: '首页', icon: 'home' },
    { key: 'weight', label: '减肥助手', icon: 'weight' },
    { key: 'period', label: '经期助手', icon: 'period' },
    { key: 'bjd', label: 'BJD 娃娃', icon: 'bjd' }
  ];

  function setRoute(name) {
    if (!routes[name]) name = 'home';
    location.hash = '#/' + name;
  }
  function currentRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    return routes[h] ? h : 'home';
  }

  function renderRoute() {
    const name = currentRoute();
    const main = document.getElementById('view');
    main.innerHTML = '';
    routes[name](main);
    // 侧边栏高亮
    document.querySelectorAll('.nav-item').forEach((b) => {
      b.classList.toggle('active', b.dataset.route === name);
    });
    document.getElementById('page-title').textContent = (NAV.find((n) => n.key === name) || {}).label || '小圆生活助手';
    if (window.__bjdRevoke) window.__bjdRevoke();
    if (UI.isMobile() && sidebarOpen) closeSidebar(false);
  }

  // 供各模块在数据变更后做局部重渲染（替代整页 reload）
  window.rerenderCurrent = function () { renderRoute(); };

  // ---------- 侧边栏 + 移动端返回手势 ----------
  let sidebarOpen = false;
  const sb = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');

  function openSidebar() {
    sidebarOpen = true;
    sb.classList.add('open');
    scrim.classList.add('show');
    if (UI.isMobile()) history.pushState({ sb: 1 }, '');
  }
  function closeSidebar(pop = true) {
    if (!sidebarOpen && !sb.classList.contains('open')) return;
    sidebarOpen = false;
    sb.classList.remove('open');
    scrim.classList.remove('show');
    if (pop && UI.isMobile() && history.state && history.state.sb) history.back();
  }
  // 系统返回手势 / 浏览器后退 -> 关闭抽屉
  window.addEventListener('popstate', (e) => {
    if (sidebarOpen) { closeSidebar(false); return; }
    // 导航后可能残留抽屉历史条目，静默跳过避免卡在同一页
    if (e.state && e.state.sb) history.back();
  });

  // 左边缘滑动打开抽屉
  let touchStartX = null;
  document.addEventListener('touchstart', (e) => {
    if (UI.isMobile() && !sidebarOpen && e.touches[0].clientX < 24) touchStartX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (touchStartX != null && e.touches[0].clientX - touchStartX > 60) { openSidebar(); touchStartX = null; }
  }, { passive: true });
  document.addEventListener('touchend', () => { touchStartX = null; });

  // ---------- 初始化 ----------
  function init() {
    // 侧边栏导航项
    const nav = document.getElementById('nav');
    NAV.forEach((n) => {
      const btn = UI.el('button', {
        class: 'nav-item', 'data-route': n.key,
      onclick: () => {
        // 先设路由再关抽屉，避免 closeSidebar 的 history.back() 与 hash 赋值竞态导致跳转失效
        setRoute(n.key);
        if (UI.isMobile()) closeSidebar(false);
      }
      }, [
        UI.el('span', { class: 'ico', html: svg(n.icon) }),
        UI.el('span', {}, n.label)
      ]);
      nav.appendChild(btn);
    });

    document.getElementById('menu-btn').addEventListener('click', () => {
      if (sidebarOpen) closeSidebar();
      else if (UI.isMobile()) openSidebar();
      else sb.classList.toggle('collapsed');
    });
    scrim.addEventListener('click', () => closeSidebar());

      // 注册视图（Period 需先于 Home，因为首页依赖其预测方法）
      if (window.PeriodView) PeriodView.register();
      if (window.WeightView) WeightView.register();
      if (window.BjdView) BjdView.register();
      if (window.HomeView) HomeView.register();

    window.addEventListener('hashchange', renderRoute);
    if (!location.hash) location.hash = '#/home';
    else renderRoute();

    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // 经期设置（仅经期助手页面调用）
  window.openPeriodSettings = function () {
    if (UI.isMobile() && sidebarOpen) closeSidebar(false);
    const ps = Store.data.periodSettings;
    const body = UI.el('div', {}, [
      UI.el('div', { class: 'field' }, [
        UI.el('label', {}, '经期时长（天，每次经期持续天数）'),
        UI.el('input', { type: 'number', id: 'set-periodlen', value: ps.periodLen || 6, min: 2, max: 10 })
      ]),
      UI.el('div', { class: 'field' }, [
        UI.el('label', {}, '经期周期长度（天）'),
        UI.el('input', { type: 'number', id: 'set-cycle', value: ps.cycle, min: 20, max: 45 })
      ]),
      UI.el('div', { class: 'field' }, [
        UI.el('label', {}, '黄体期长度（天，排卵期后到下次经期前）'),
        UI.el('input', { type: 'number', id: 'set-luteal', value: ps.luteal, min: 10, max: 18 })
      ])
    ]);
    UI.openModal({
      title: '经期设置', body,
      actions: [
        { text: '取消', kind: 'btn-ghost' },
        { text: '保存', kind: 'btn-primary', onClick: (c) => {
          const plen = parseInt(document.getElementById('set-periodlen').value, 10);
          const cyc = parseInt(document.getElementById('set-cycle').value, 10);
          const lut = parseInt(document.getElementById('set-luteal').value, 10);
          if (plen >= 2 && plen <= 10) Store.data.periodSettings.periodLen = plen;
          if (cyc >= 20 && cyc <= 45) Store.data.periodSettings.cycle = cyc;
          if (lut >= 10 && lut <= 18) Store.data.periodSettings.luteal = lut;
          Store.save(); UI.toast('设置已保存'); c(); window.rerenderCurrent();
        } }
      ]
    });
  };

  // 备份与恢复（首页独立入口）
  window.openBackup = function () {
    if (UI.isMobile() && sidebarOpen) closeSidebar(false);
    const body = UI.el('div', {}, [
      UI.el('p', { class: 'muted', style: 'margin-bottom:14px;' }, '小圆助手所有数据都保存在本机浏览器。换设备、清缓存或重新安装前，建议先导出备份。'),
      UI.el('div', { class: 'modal-actions' }, [
        UI.el('button', {
          class: 'btn', onclick: async () => {
            try {
              let photos = [];
              try {
                const all = await DB.getAll();
                photos = await Promise.all(all.map(async ({ id, blob }) => ({ id, dataUrl: await blobToDataURL(blob) })));
              } catch (e) { /* 无照片时忽略 */ }
              const out = Object.assign({}, Store.data, { __photos: photos });
              const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
              const a = UI.el('a', { href: URL.createObjectURL(blob), download: 'xiaoyuan-backup-' + UI.today() + '.json' });
              a.click();
              UI.toast('备份已导出（含 ' + photos.length + ' 张照片）');
            } catch (e) { UI.toast('导出失败'); }
          }
        }, '导出备份'),
        UI.el('button', {
          class: 'btn', onclick: () => {
            const inp = UI.el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
            inp.onchange = () => {
              const f = inp.files[0]; if (!f) return;
              const r = new FileReader();
              r.onload = async () => {
                try {
                  const parsed = JSON.parse(r.result);
                  const photos = parsed.__photos || [];
                  delete parsed.__photos;
                  Store.importJSON(JSON.stringify(parsed));
                  let okCount = 0;
                  await Promise.all(photos.map(async (p) => {
                    try { const b = await dataURLToBlob(p.dataUrl); await DB.put(p.id, b); okCount++; } catch (e) { /* 单张失败忽略 */ }
                  }));
                  UI.toast('已恢复备份' + (photos.length ? '（' + okCount + ' 张照片）' : ''));
                  setTimeout(() => location.reload(), 600);
                } catch (e) { UI.toast('备份文件无效'); }
              };
              r.readAsText(f);
            };
            inp.click();
          }
        }, '导入备份')
      ])
    ]);
    UI.openModal({ title: '数据备份与恢复', body, actions: [{ text: '关闭', kind: 'btn-ghost' }] });
  };

  function blobToDataURL(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  }
  function dataURLToBlob(dataUrl) { return fetch(dataUrl).then((r) => r.blob()); }

  document.addEventListener('DOMContentLoaded', init);
})();
