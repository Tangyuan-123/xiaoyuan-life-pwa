/* 小圆生活助手 —— 应用外壳、路由、侧边栏（含移动端返回手势）、通用 UI */
(function () {
  // ---------- 通用 UI 工具 ----------
  const UI = {
    isMobile() { return window.matchMedia('(max-width: 860px)').matches; },
    today() { return this.fmtYMD(new Date()); },
    parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
    fmtYMD(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return y + '-' + m + '-' + day; },
    fmtMD(s) { const d = this.parseDate(s); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; },
    addDays(s, n) { const d = this.parseDate(s); d.setDate(d.getDate() + n); return this.fmtYMD(d); },
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
      const off = openOverlay(close); // 登记浮层，并（移动端）压入历史状态以拦截返回手势
      if (actions.length) {
        const act = UI.el('div', { class: 'modal-actions' });
        actions.forEach((a) => {
          const b = UI.el('button', { class: 'btn ' + (a.kind || ''), onclick: () => (a.onClick ? a.onClick(off) : off()) }, a.text);
          act.appendChild(b);
        });
        box.appendChild(act);
      }
      // 点击遮罩关闭（点击遮罩空白处，而非弹窗内容）
      mask.onclick = (e) => { if (e.target === mask && closeOnMask) off(); };
      mask.classList.add('show');
      if (onMount) onMount(box, off);
      return { close: off };
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
      const doClose = () => { cleanup(); mask.remove(); };
      prevBtn.addEventListener('click', (e) => { e.stopPropagation(); idx = (idx - 1 + photoIds.length) % photoIds.length; show(); });
      nextBtn.addEventListener('click', (e) => { e.stopPropagation(); idx = (idx + 1) % photoIds.length; show(); });
      closeBtn.addEventListener('click', () => off());
      mask.addEventListener('click', (e) => { if (e.target === mask) off(); });
      mask.appendChild(closeBtn); mask.appendChild(prevBtn); mask.appendChild(imgWrap); mask.appendChild(nextBtn); mask.appendChild(counter);
      document.body.appendChild(mask);
      // 登记浮层：手机返回键/侧滑优先关闭灯箱
      const off = openOverlay(doClose);
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
    { key: 'bjd', label: 'BJD 娃娃', icon: 'bjd' },
    { key: 'acg', label: '二次元娃', icon: 'acg' },
    { key: 'guzi', label: '谷子助手', icon: 'guzi' },
    { key: 'settings', label: '设置', icon: 'settings' }
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
    if (window.__homeRevoke) window.__homeRevoke();
    if (UI.isMobile() && sidebarOpen) closeSidebar(false);
  }

  // 供各模块在数据变更后做局部重渲染（替代整页 reload）
  window.rerenderCurrent = function () { renderRoute(); };

  // ---------- 弹窗/浮层返回手势 ----------
  // 打开弹窗、灯箱等浮层时压入一个历史状态；手机系统返回手势（侧滑/返回键）优先关闭浮层，而非退回上一级页面
  let _overlayStack = [];
  function openOverlay(closeUI, isModal) {
    const entry = { closeUI, isModal: !!isModal };
    _overlayStack.push(entry);
    if (UI.isMobile()) history.pushState({ overlay: true }, '');
    return function close() {
      const i = _overlayStack.indexOf(entry);
      if (i >= 0) _overlayStack.splice(i, 1);
      closeUI();
      if (UI.isMobile()) {
        // 手动关闭浮层时，用 replaceState 消费掉其对应的历史状态，
        // 既不触发 popstate，也不让浏览器后退栈残留多余条目。
        // 这样「详情弹窗→点编辑→紧跟着打开编辑弹窗」时不会被异步 popstate 误关。
        try { history.replaceState({}, ''); } catch (e) {}
      }
    };
  }

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
  // 系统返回手势 / 浏览器后退 -> 优先关闭浮层，其次关闭抽屉，最后才退回上一级页面
  window.addEventListener('popstate', (e) => {
    // 浮层优先：有未关闭的浮层时，用系统返回手势关闭它
    if (_overlayStack.length) {
      const entry = _overlayStack.pop();
      entry.closeUI();
      return;
    }
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

  // ---------- 主题（保留已保存主题的生效，设置入口已移除） ----------
  const THEME_KEY = 'xiaoyuan-theme';
  function applyTheme(id) {
    if (!id || id === 'pink') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', id);
  }

  window.openSettings = function () {
    if (UI.isMobile() && sidebarOpen) closeSidebar(false);
    const curTheme = (function () { try { return localStorage.getItem(THEME_KEY) || 'pink'; } catch (e) { return 'pink'; } })();
    const nickname = (function () { try { return localStorage.getItem('xiaoyuan-nickname') || '小圆'; } catch (e) { return '小圆'; } })();
    const nickInput = UI.el('input', { type: 'text', id: 'set-nickname', value: nickname, placeholder: '如 小圆', maxlength: '12' });
    // 今日概览照片开关：默认开（功能启用），关闭后首页照片区整块隐藏（含已添加照片）
    const addOn = !Store.data.hideHomePhotoAdd;
    const switchEl = UI.el('div', { class: 'switch' + (addOn ? ' on' : ''), role: 'switch', 'aria-checked': addOn ? 'true' : 'false' }, UI.el('div', { class: 'knob' }));
    switchEl.addEventListener('click', () => {
      const on = switchEl.classList.toggle('on');
      switchEl.setAttribute('aria-checked', on ? 'true' : 'false');
      Store.data.hideHomePhotoAdd = !on;
      Store.save();
    });
    const body = UI.el('div', {}, [
      UI.el('div', { class: 'field' }, [
        UI.el('label', {}, '主页称呼'),
        nickInput
      ]),
      UI.el('div', { class: 'setting-row' }, [
        UI.el('div', { class: 'setting-text' }, [
          UI.el('div', { class: 'setting-name' }, '今日概览照片'),
          UI.el('div', { class: 'setting-desc muted' }, '关闭后，首页「今日概览」不再显示照片区（含已添加的照片）')
        ]),
        switchEl
      ])
    ]);
    UI.openModal({
      title: '设置',
      body,
      actions: [
        { text: '取消', kind: 'btn-ghost' },
        { text: '完成', kind: 'btn-primary', onClick: (c) => {
          const newNick = nickInput.value.trim();
          if (newNick) {
            try { localStorage.setItem('xiaoyuan-nickname', newNick); } catch (e) {}
          } else {
            try { localStorage.removeItem('xiaoyuan-nickname'); } catch (e) {}
          }
          c(); window.rerenderCurrent();
        } }
      ]
    });
  };

  // ---------- 初始化 ----------
  let _inited = false;
  function init() {
    if (_inited) return;
    _inited = true;
    // 侧边栏导航项
    const nav = document.getElementById('nav');
    NAV.forEach((n) => {
      const btn = UI.el('button', {
        class: 'nav-item', 'data-route': n.key,
      onclick: () => {
        if (n.key === 'settings') { if (UI.isMobile()) closeSidebar(false); window.openSettings(); return; }
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

    // 应用已保存的主题
    (function () { try { applyTheme(localStorage.getItem(THEME_KEY) || 'pink'); } catch (e) {} })();

      // 注册视图（Period 需先于 Home，因为首页依赖其预测方法）
      if (window.PeriodView) PeriodView.register();
      if (window.WeightView) WeightView.register();
      if (window.BjdView) BjdView.register();
      if (window.AcgView) AcgView.register();
      if (window.GuziView) GuziView.register();
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
