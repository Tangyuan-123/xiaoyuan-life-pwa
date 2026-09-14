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
        const totalQty = items.reduce((sum, s) => sum + (parseInt(s.qty, 10) || 1), 0);
        const totalCost = items.reduce((sum, s) => sum + (parseFloat(s.cost) || 0) * (parseInt(s.qty, 10) || 1), 0);
        const totalPrice = items.reduce((sum, s) => sum + (parseFloat(s.price) || 0) * (parseInt(s.qty, 10) || 1), 0);
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

function stockCard(s) {
  const card = UI.el('div', { class: 'bjd-card', style: 'cursor:pointer;' });
  const thumb = UI.el('div', { class: 'thumb', html: svg('stock') });
  card.appendChild(thumb);
  const stColor = STOCK_STATUS_COLOR[s.status] || STOCK_STATUS_COLOR['在库'];
  card.appendChild(UI.el('div', { class: 'info' }, [
    UI.el('div', { class: 'nm' }, [
      UI.el('span', {}, s.name || '未命名'),
      UI.el('span', { class: 'dot', title: s.status || '在库', style: 'background:' + stColor + ';' })
    ]),
    UI.el('div', { class: 'meta' }, [
      UI.el('div', {}, '数量：' + (s.qty || 1) + ' 颗'),
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
  body.appendChild(UI.el('hr', { class: 'sep' }));
  const info = [
    ['角色/款式', s.name],
    ['数量', (s.qty || 1) + ' 颗'],
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
    body.appendChild(UI.el('div', { class: 'muted', style: 'padding:6px 0 0;' }, '单颗毛利：¥' + Math.round(pm - cm) + '（' + (margin >= 0 ? '+' : '') + margin + '%）'));
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
  const body = UI.el('div', {}, [
    stockField('角色/款式', UI.el('input', { type: 'text', id: 's-name', value: init.name || '', placeholder: '如 GSC 初音未来 脸壳' })),
    UI.el('div', { class: 'row' }, [
      stockField('数量（颗）', UI.el('input', { type: 'number', id: 's-qty', min: '1', step: '1', value: init.qty || '1' })),
      stockField('状态', UI.el('select', { id: 's-status' }, STOCK_STATUS.map((st) =>
        UI.el('option', { value: st, selected: (init.status || '在库') === st ? '' : null }, st))))
    ]),
    UI.el('div', { class: 'row' }, [
      stockField('成本价 (¥)', UI.el('input', { type: 'number', id: 's-cost', min: '0', step: '1', value: init.cost || '' })),
      stockField('售价 (¥)', UI.el('input', { type: 'number', id: 's-price', min: '0', step: '1', value: init.price || '' }))
    ]),
    UI.el('div', { class: 'row' }, [
      stockField('购入渠道', UI.el('input', { type: 'text', id: 's-channel', value: init.channel || '', placeholder: '如 淘宝 / 闲鱼' })),
      stockField('购入日期', UI.el('input', { type: 'date', id: 's-date', value: init.date || '' }))
    ]),
    stockField('备注', UI.el('textarea', { id: 's-note', rows: '2', placeholder: '可选' }, init.note || ''))
  ]);
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
          channel: document.getElementById('s-channel').value.trim(),
          date: document.getElementById('s-date').value,
          note: document.getElementById('s-note').value.trim()
        };
        if (isEdit) Store.update('stock', existing.id, obj);
        else Store.add('stock', obj);
        UI.toast('已保存 💕'); c(); window.rerenderCurrent();
      } }
    ]
  });
}

function stockDel(s) {
  UI.confirm('删除囤货', '确定删除「' + (s.name || '该囤货') + '」吗？').then((ok) => {
    if (!ok) return;
    Store.remove('stock', s.id);
    UI.toast('已删除'); window.rerenderCurrent();
  });
}

function stockField(label, input) { return UI.el('div', { class: 'field' }, [UI.el('label', {}, label), input]); }
function stockStatBox(v, l) { return UI.el('div', { class: 'stat-box' }, [UI.el('div', { class: 'v' }, v), UI.el('div', { class: 'l' }, l)]); }
