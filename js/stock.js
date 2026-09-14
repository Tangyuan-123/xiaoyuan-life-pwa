/* 囤货管理（GSC脸壳）：记录库存款式、数量、成本、售价、购入渠道与状态，便于盘点与算利润 */
window.StockView = {
  register() {
    registerView('stock', (root) => {
      const all = Store.getArr('stock');
      const wrap = UI.el('div', {});

      // 状态筛选
      const statusTabs = UI.el('div', { class: 'status-tabs', style: 'margin-bottom:14px;' });
      ['全部'].concat(STOCK_STATUS).forEach((st) => {
        statusTabs.appendChild(UI.el('button', {
          class: 'status-tab' + (_stockStatus === st ? ' active' : ''),
          onclick: () => { _stockStatus = st; window.rerenderCurrent(); }
        }, st === '全部' ? '全部' : st));
      });
      wrap.appendChild(statusTabs);

      // 排序（按购入日期，方便判断黄化程度）
      const sortRow = UI.el('div', { class: 'sort-row', style: 'margin-bottom:14px;' }, [
        UI.el('span', { class: 'sort-label' }, '排序'),
        UI.el('select', { class: 'sort-select', onchange: (e) => { _stockSort = e.target.value; window.rerenderCurrent(); } }, [
          ['date_asc', '最早购入（旧→新·黄化优先）'],
          ['date_desc', '最近购入（新→旧）'],
          ['added', '添加顺序']
        ].map(([v, l]) => UI.el('option', { value: v, selected: _stockSort === v ? '' : null }, l)))
      ]);
      wrap.appendChild(sortRow);

      // 搜索
      const searchWrap = stockSearchBox();
      wrap.appendChild(searchWrap);

      // 统计
      const statRow = UI.el('div', { class: 'stat-row', style: 'margin-bottom:14px;' });
      wrap.appendChild(statRow);

      wrap.appendChild(UI.el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:14px;', onclick: () => stockForm(null) }, [svg('add'), '添加囤货']));

      const grid = UI.el('div', { class: 'bjd-grid' });
      wrap.appendChild(grid);

      function renderGrid() {
        const items = all
          .filter((s) => _stockStatus === '全部' || (s.status || '在库') === _stockStatus)
          .filter((s) => stockMatch(s, _stockSearch));
        // 时间排序（缺日期的记录始终排在最后，避免干扰判断）
        if (_stockSort === 'date_asc') items.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
        else if (_stockSort === 'date_desc') items.sort((a, b) => (b.date || '9999').localeCompare(a.date || '9999'));
        const totalQty = items.reduce((sum, s) => sum + (parseInt(s.qty, 10) || 1), 0);
        // 数量与成本均为「总」数值，直接累加，不做 qty×cost 相乘
        const totalCost = items.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0);
        const totalPrice = items.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
        statRow.innerHTML = '';
        statRow.appendChild(stockStatBox(items.length + ' 款', '囤货款式'));
        statRow.appendChild(stockStatBox(totalQty + ' 颗', '库存数量'));
        statRow.appendChild(stockStatBox('¥' + Math.round(totalCost).toLocaleString('zh-CN'), '总成本'));
        statRow.appendChild(stockStatBox('¥' + Math.round(totalPrice).toLocaleString('zh-CN'), '预估价值'));

        grid.innerHTML = '';
        if (items.length) items.forEach((s) => grid.appendChild(stockCard(s)));
        else grid.appendChild(UI.el('div', { class: 'empty' }, [UI.el('div', { class: 'em-ico', html: svg('stock') }), UI.el('div', { style: 'margin-top:8px;' }, '还没有囤货记录，点上面添加 💕')]));
      }
      renderGrid();

      const si = searchWrap.querySelector('#stock-search');
      if (si) si.addEventListener('input', () => { _stockSearch = si.value.trim(); renderGrid(); });

      root.appendChild(wrap);
    });
  }
};

const STOCK_STATUS = ['在库', '已用', '已预定', '已出'];
const STOCK_STATUS_COLOR = { '在库': '#6BCB9C', '已用': '#B0B7C3', '已预定': '#FFB36B', '已出': '#9AA6FF' };
let _stockStatus = '全部';
let _stockSearch = '';
let _stockSort = 'date_asc'; // 默认按购入日期升序（最旧→最新），方便一眼看出黄化最久的库存
let _stockUrls = [];
function stockRevokeAll() { _stockUrls.forEach((u) => URL.revokeObjectURL(u)); _stockUrls = []; }
window.__stockRevoke = stockRevokeAll;
function stockThumbURL(id, cb) { DB.getURL(id).then((u) => { if (u) { _stockUrls.push(u); cb(u); } }); }
// 取单价：手动填过就用手动值；否则按 总价÷数量 自动算（2 位小数）
function stockUnitOf(s) {
  if (s.unit != null && s.unit !== '' && !isNaN(parseFloat(s.unit))) return parseFloat(s.unit);
  const c = parseFloat(s.cost) || 0;
  const q = parseInt(s.qty, 10) || 1;
  return q > 0 ? Math.round(c / q * 100) / 100 : 0;
}

function stockCard(s) {
  const card = UI.el('div', { class: 'bjd-card', style: 'cursor:pointer;' });
  const thumb = UI.el('div', { class: 'thumb', html: svg('stock') });
  if (s.photos && s.photos.length) stockThumbURL(s.photos[0], (u) => { thumb.innerHTML = ''; thumb.appendChild(UI.el('img', { src: u, alt: s.name })); });
  card.appendChild(thumb);
  const stColor = STOCK_STATUS_COLOR[s.status] || STOCK_STATUS_COLOR['在库'];
  card.appendChild(UI.el('div', { class: 'info' }, [
    UI.el('div', { class: 'nm' }, [
      UI.el('span', {}, s.name || '未命名'),
      UI.el('span', { class: 'dot', title: s.status || '在库', style: 'background:' + stColor + ';' })
    ]),
    UI.el('div', { class: 'meta' }, [
      UI.el('div', {}, '数量：' + (s.qty || 1) + ' 颗'),
      UI.el('div', {}, '单价：¥' + stockUnitOf(s).toLocaleString('zh-CN', { maximumFractionDigits: 2 })),
      UI.el('div', {}, '成本：' + (s.cost ? '¥' + s.cost : '—')),
      UI.el('div', {}, '售价：' + (s.price ? '¥' + s.price : '—')),
      s.channel ? UI.el('div', {}, '渠道：' + s.channel) : null
    ].filter(Boolean))
  ]));
  card.addEventListener('click', () => stockDetail(s));
  return card;
}

function stockMatch(s, q) {
  if (!q) return true;
  q = String(q).toLowerCase();
  const hay = [s.name, s.channel, s.status, s.note].filter(Boolean).join(' ').toLowerCase();
  return hay.indexOf(q) >= 0;
}

function stockSearchBox() {
  const box = UI.el('div', { class: 'search-box', style: 'margin-bottom:14px;' });
  const input = UI.el('input', { type: 'search', class: 'search-input', id: 'stock-search', placeholder: '搜索款式 / 渠道', value: _stockSearch });
  box.appendChild(UI.el('span', { class: 'search-ico', html: svg('search') }));
  box.appendChild(input);
  if (_stockSearch) box.appendChild(UI.el('button', { class: 'search-clear', html: svg('close'), onclick: () => { _stockSearch = ''; window.rerenderCurrent(); } }));
  return box;
}

function stockDetail(s) {
  const body = UI.el('div', {});
  if (s.photos && s.photos.length) {
    const pgrid = UI.el('div', { class: 'photo-grid' });
    s.photos.forEach((pid) => stockThumbURL(pid, (u) => {
      const ph = UI.el('div', { class: 'pg-item' }, UI.el('img', { src: u, alt: s.name }));
      ph.addEventListener('click', () => UI.photoViewer(s.photos, pid));
      pgrid.appendChild(ph);
    }));
    body.appendChild(pgrid);
  } else {
    body.appendChild(UI.el('div', { class: 'muted', style: 'padding:8px 0;' }, '暂无照片'));
  }
  body.appendChild(UI.el('hr', { class: 'sep' }));
  const info = [
    ['角色/款式', s.name],
    ['数量', (s.qty || 1) + ' 颗'],
    ['单价', '¥' + stockUnitOf(s).toLocaleString('zh-CN', { maximumFractionDigits: 2 })],
    ['成本价', s.cost ? '¥' + s.cost : '—'],
    ['售价', s.price ? '¥' + s.price : '—'],
    ['购入渠道', s.channel],
    ['购入日期', s.date],
    ['状态', s.status || '在库'],
    ['备注', s.note]
  ];
  info.forEach(([k, v]) => {
    if (!v) return;
    body.appendChild(UI.el('div', { style: 'display:flex;gap:10px;padding:5px 0;' }, [
      UI.el('div', { class: 'muted', style: 'width:80px;flex:none;' }, k),
      UI.el('div', { style: 'font-weight:600;' }, String(v))
    ]));
  });
  const cm = (parseFloat(s.cost) || 0);
  const pm = (parseFloat(s.price) || 0);
  if (cm && pm) {
    const margin = Math.round((pm - cm) / cm * 100);
    body.appendChild(UI.el('div', { class: 'muted', style: 'padding:6px 0 0;' }, '毛利：¥' + Math.round(pm - cm).toLocaleString('zh-CN') + '（' + (margin >= 0 ? '+' : '') + margin + '%）'));
  }
  UI.openModal({
    title: s.name || '囤货详情', body,
    actions: [
      { text: '关闭', kind: 'btn-ghost' },
      { text: '删除', kind: 'btn-danger', onClick: (c) => { c(); stockDel(s); } },
      { text: '编辑', kind: 'btn-primary', onClick: (c) => { c(); stockForm(s); } }
    ]
  });
}

function stockForm(existing) {
  const isEdit = !!existing;
  const init = existing || {};
  let localPhotos = existing && existing.photos ? existing.photos.slice() : [];

  const photoBox = UI.el('div', {});
  const fileInput = UI.el('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none' });
  fileInput.addEventListener('change', async () => {
    for (const f of Array.from(fileInput.files)) {
      try {
        const id = Store.uid();
        const blob = await DB.fileToBlob(f, 1600, 0.85);
        await DB.put(id, blob);
        localPhotos.push(id);
      } catch (e) { UI.toast('图片读取失败'); }
    }
    fileInput.value = '';
    refreshStrip();
  });
  function refreshStrip() {
    photoBox.innerHTML = '';
    const strip = UI.el('div', { class: 'photo-strip' });
    localPhotos.forEach((pid, idx) => {
      stockThumbURL(pid, (u) => {
        const ph = UI.el('div', { class: 'ph' }, [
          UI.el('img', { src: u }),
          UI.el('button', { class: 'del', html: svg('close'), onclick: () => {
            localPhotos.splice(idx, 1);
            DB.del(pid);
            refreshStrip();
          } })
        ]);
        strip.appendChild(ph);
      });
    });
    photoBox.appendChild(strip);
    photoBox.appendChild(UI.el('button', { class: 'btn btn-sm', style: 'margin-top:8px;', onclick: () => fileInput.click() }, [svg('camera'), '从手机相册添加照片']));
    photoBox.appendChild(fileInput);
  }
  refreshStrip();

  const qtyInput = UI.el('input', { type: 'number', id: 's-qty', min: '1', step: '1', value: init.qty || '1' });
  const costInput = UI.el('input', { type: 'number', id: 's-cost', min: '0', step: '1', value: init.cost || '' });
  const unitInput = UI.el('input', { type: 'number', id: 's-unit', min: '0', step: '0.01', value: (init.unit != null && init.unit !== '') ? init.unit : '', placeholder: '留空自动算' });

  const body = UI.el('div', {}, [
    stockField('角色/款式', UI.el('input', { type: 'text', id: 's-name', value: init.name || '', placeholder: '如 GSC 初音未来 脸壳' })),
    UI.el('div', { class: 'row' }, [
      stockField('数量（颗）', qtyInput),
      stockField('状态', UI.el('select', { id: 's-status' }, STOCK_STATUS.map((st) =>
        UI.el('option', { value: st, selected: (init.status || '在库') === st ? '' : null }, st))))
    ]),
    UI.el('div', { class: 'row' }, [
      stockField('成本 (¥，总)', costInput),
      stockField('售价 (¥)', UI.el('input', { type: 'number', id: 's-price', min: '0', step: '1', value: init.price || '' }))
    ]),
    stockField('单价 (¥，留空 = 总价÷数量 自动算)', unitInput),
    UI.el('div', { class: 'row' }, [
      stockField('购入渠道', UI.el('input', { type: 'text', id: 's-channel', value: init.channel || '', placeholder: '如 淘宝 / 闲鱼' })),
      stockField('购入日期', UI.el('input', { type: 'date', id: 's-date', value: init.date || '' }))
    ]),
    stockField('备注', UI.el('textarea', { id: 's-note', rows: '2', placeholder: '可选' }, init.note || '')),
    UI.el('div', { class: 'field' }, [UI.el('label', {}, '添加照片'), photoBox])
  ]);

  // 单价联动：手动填过就不自动覆盖；否则随 成本/数量 实时算 总价÷数量
  let unitTouched = !!(init.unit != null && init.unit !== '');
  unitInput.addEventListener('input', () => { unitTouched = true; });
  function recalcUnit() {
    if (unitTouched) return;
    const c = parseFloat(costInput.value);
    const q = parseInt(qtyInput.value, 10);
    if (!isNaN(c) && !isNaN(q) && q > 0) unitInput.value = (Math.round(c / q * 100) / 100).toString();
    else unitInput.value = '';
  }
  costInput.addEventListener('input', recalcUnit);
  qtyInput.addEventListener('input', recalcUnit);
  recalcUnit();

  UI.openModal({
    title: isEdit ? '编辑囤货' : '添加囤货', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: isEdit ? '保存' : '添加', kind: 'btn-primary', onClick: (c) => {
        const name = document.getElementById('s-name').value.trim();
        if (!name) { UI.toast('请填写角色/款式'); return; }
        const obj = {
          name,
          qty: parseInt(document.getElementById('s-qty').value, 10) || 1,
          status: document.getElementById('s-status').value,
          cost: document.getElementById('s-cost').value || '',
          price: document.getElementById('s-price').value || '',
          unit: (function () {
            const u = parseFloat(unitInput.value);
            if (!isNaN(u)) return u;
            const c = parseFloat(costInput.value), q = parseInt(qtyInput.value, 10);
            return (!isNaN(c) && !isNaN(q) && q > 0) ? Math.round(c / q * 100) / 100 : '';
          })(),
          channel: document.getElementById('s-channel').value.trim(),
          date: document.getElementById('s-date').value,
          note: document.getElementById('s-note').value.trim(),
          photos: localPhotos.slice()
        };
        if (isEdit) {
          const removed = (existing.photos || []).filter((p) => !localPhotos.includes(p));
          removed.forEach((p) => DB.del(p));
          Store.update('stock', existing.id, obj);
        } else {
          Store.add('stock', obj);
        }
        UI.toast('已保存 💕'); c(); window.rerenderCurrent();
      } }
    ]
  });
}

function stockDel(s) {
  UI.confirm('删除囤货', '确定删除「' + (s.name || '该囤货') + '」及其所有照片吗？').then((ok) => {
    if (!ok) return;
    (s.photos || []).forEach((p) => DB.del(p));
    Store.remove('stock', s.id);
    UI.toast('已删除'); window.rerenderCurrent();
  });
}

function stockField(label, input) { return UI.el('div', { class: 'field' }, [UI.el('label', {}, label), input]); }
function stockStatBox(v, l) { return UI.el('div', { class: 'stat-box' }, [UI.el('div', { class: 'v' }, v), UI.el('div', { class: 'l' }, l)]); }
