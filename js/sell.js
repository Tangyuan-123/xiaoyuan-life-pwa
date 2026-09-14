/* 成品售卖：上架现货、跟踪在售/已售/已下架状态与收入利润 */
window.SellView = {
  register() {
    registerView('sell', (root) => {
      const all = Store.getArr('sell');
      const wrap = UI.el('div', {});

      // 状态筛选
      const statusTabs = UI.el('div', { class: 'status-tabs', style: 'margin-bottom:14px;' });
      ['全部'].concat(SELL_STATUS).forEach((st) => {
        statusTabs.appendChild(UI.el('button', {
          class: 'status-tab' + (_sellStatus === st ? ' active' : ''),
          onclick: () => { _sellStatus = st; window.rerenderCurrent(); }
        }, st === '全部' ? '全部' : st));
      });
      wrap.appendChild(statusTabs);

      // 搜索
      const searchWrap = sellSearchBox();
      wrap.appendChild(searchWrap);

      // 统计
      const statRow = UI.el('div', { class: 'stat-row', style: 'margin-bottom:14px;' });
      wrap.appendChild(statRow);

      wrap.appendChild(UI.el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:14px;', onclick: () => sellForm(null) }, [svg('add'), '上架成品']));

      const grid = UI.el('div', { class: 'bjd-grid' });
      wrap.appendChild(grid);

      function renderGrid() {
        const items = all
          .filter((s) => _sellStatus === '全部' || (s.status || '在售') === _sellStatus)
          .filter((s) => sellMatch(s, _sellSearch));
        const onSale = items.filter((s) => (s.status || '在售') === '在售');
        const sold = items.filter((s) => s.status === '已售');
        const onSaleVal = onSale.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
        const soldIncome = sold.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
        const soldCost = sold.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0);
        const profit = soldIncome - soldCost;
        statRow.innerHTML = '';
        statRow.appendChild(sellStatBox(onSale.length + ' 件', '在售'));
        statRow.appendChild(sellStatBox(sold.length + ' 件', '已售'));
        statRow.appendChild(sellStatBox('¥' + Math.round(onSaleVal).toLocaleString('zh-CN'), '在售估值'));
        statRow.appendChild(sellStatBox('¥' + Math.round(soldIncome).toLocaleString('zh-CN'), profit >= 0 ? ('已售收入·利' + Math.round(profit)) : '已售收入'));

        grid.innerHTML = '';
        if (items.length) items.forEach((s) => grid.appendChild(sellCard(s)));
        else grid.appendChild(UI.el('div', { class: 'empty' }, [UI.el('div', { class: 'em-ico', html: svg('sell') }), UI.el('div', { style: 'margin-top:8px;' }, '还没有上架的成品，点上面添加 💕')]));
      }
      renderGrid();

      const si = searchWrap.querySelector('#sell-search');
      if (si) si.addEventListener('input', () => { _sellSearch = si.value.trim(); renderGrid(); });

      root.appendChild(wrap);
    });
  }
};

const SELL_STATUS = ['在售', '已售', '已下架'];
const SELL_STATUS_COLOR = { '在售': '#6BCB9C', '已售': '#9AA6FF', '已下架': '#B0B7C3' };
let _sellStatus = '全部';
let _sellSearch = '';

function sellCard(s) {
  const card = UI.el('div', { class: 'bjd-card', style: 'cursor:pointer;' });
  const thumb = UI.el('div', { class: 'thumb', html: svg('sell') });
  card.appendChild(thumb);
  const stColor = SELL_STATUS_COLOR[s.status] || SELL_STATUS_COLOR['在售'];
  card.appendChild(UI.el('div', { class: 'info' }, [
    UI.el('div', { class: 'nm' }, [
      UI.el('span', {}, s.name || '未命名'),
      UI.el('span', { class: 'dot', title: s.status || '在售', style: 'background:' + stColor + ';' })
    ]),
    UI.el('div', { class: 'meta' }, [
      UI.el('div', {}, '售价：' + (s.price ? '¥' + s.price : '—')),
      UI.el('div', {}, '状态：' + (s.status || '在售')),
      s.buyer ? UI.el('div', {}, '买家：' + s.buyer) : null
    ].filter(Boolean))
  ]));
  card.addEventListener('click', () => sellDetail(s));
  return card;
}

function sellMatch(s, q) {
  if (!q) return true;
  q = String(q).toLowerCase();
  const hay = [s.name, s.buyer, s.status, s.note].filter(Boolean).join(' ').toLowerCase();
  return hay.indexOf(q) >= 0;
}

function sellSearchBox() {
  const box = UI.el('div', { class: 'search-box', style: 'margin-bottom:14px;' });
  const input = UI.el('input', { type: 'search', class: 'search-input', id: 'sell-search', placeholder: '搜索商品 / 买家', value: _sellSearch });
  box.appendChild(UI.el('span', { class: 'search-ico', html: svg('search') }));
  box.appendChild(input);
  if (_sellSearch) box.appendChild(UI.el('button', { class: 'search-clear', html: svg('close'), onclick: () => { _sellSearch = ''; window.rerenderCurrent(); } }));
  return box;
}

function sellDetail(s) {
  const body = UI.el('div', {});
  body.appendChild(UI.el('hr', { class: 'sep' }));
  const info = [
    ['商品名', s.name],
    ['售价', s.price ? '¥' + s.price : '—'],
    ['成本价', s.cost ? '¥' + s.cost : '—'],
    ['状态', s.status || '在售'],
    ['买家/渠道', s.buyer],
    ['售出日期', s.soldDate],
    ['备注', s.note]
  ];
  info.forEach(([k, v]) => {
    if (!v) return;
    body.appendChild(UI.el('div', { style: 'display:flex;gap:10px;padding:5px 0;' }, [
      UI.el('div', { class: 'muted', style: 'width:80px;flex:none;' }, k),
      UI.el('div', { style: 'font-weight:600;' }, String(v))
    ]));
  });
  if (s.status === '已售') {
    const cm = (parseFloat(s.cost) || 0);
    const pm = (parseFloat(s.price) || 0);
    body.appendChild(UI.el('div', { class: 'muted', style: 'padding:6px 0 0;' }, '本单利润：¥' + Math.round(pm - cm) + (cm ? ('（' + (Math.round((pm - cm) / cm * 100) >= 0 ? '+' : '') + Math.round((pm - cm) / cm * 100) + '%）') : '')));
  }
  UI.openModal({
    title: s.name || '成品详情', body,
    actions: [
      { text: '关闭', kind: 'btn-ghost' },
      { text: '删除', kind: 'btn-danger', onClick: (c) => { c(); sellDel(s); } },
      { text: '编辑', kind: 'btn-primary', onClick: (c) => { c(); sellForm(s); } }
    ]
  });
}

function sellForm(existing) {
  const isEdit = !!existing;
  const init = existing || {};
  const body = UI.el('div', {}, [
    sellField('商品名 / 描述', UI.el('input', { type: 'text', id: 'sl-name', value: init.name || '', placeholder: '如 成品娃·初音未来' })),
    UI.el('div', { class: 'row' }, [
      sellField('售价 (¥)', UI.el('input', { type: 'number', id: 'sl-price', min: '0', step: '1', value: init.price || '' })),
      sellField('成本价 (¥)', UI.el('input', { type: 'number', id: 'sl-cost', min: '0', step: '1', value: init.cost || '', placeholder: '选填·算利润' }))
    ]),
    sellField('状态', UI.el('select', { id: 'sl-status' }, SELL_STATUS.map((st) =>
      UI.el('option', { value: st, selected: (init.status || '在售') === st ? '' : null }, st)))),
    UI.el('div', { id: 'sl-sold-wrap', style: 'display:' + ((init.status === '已售') ? '' : 'none') + ';' }, [
      UI.el('div', { class: 'row' }, [
        sellField('买家 / 渠道', UI.el('input', { type: 'text', id: 'sl-buyer', value: init.buyer || '', placeholder: '如 闲鱼昵称' })),
        sellField('售出日期', UI.el('input', { type: 'date', id: 'sl-date', value: init.soldDate || '' }))
      ])
    ]),
    sellField('备注', UI.el('textarea', { id: 'sl-note', rows: '2', placeholder: '可选' }, init.note || ''))
  ]);
  const _slStatusSel = body.querySelector('#sl-status');
  const _slSoldWrap = body.querySelector('#sl-sold-wrap');
  if (_slStatusSel && _slSoldWrap) _slStatusSel.addEventListener('change', () => { _slSoldWrap.style.display = (_slStatusSel.value === '已售') ? '' : 'none'; });
  UI.openModal({
    title: isEdit ? '编辑成品' : '上架成品', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: isEdit ? '保存' : '上架', kind: 'btn-primary', onClick: (c) => {
        const name = document.getElementById('sl-name').value.trim();
        if (!name) { UI.toast('请填写商品名'); return; }
        const obj = {
          name,
          price: document.getElementById('sl-price').value || '',
          cost: document.getElementById('sl-cost').value || '',
          status: document.getElementById('sl-status').value,
          buyer: document.getElementById('sl-buyer').value.trim(),
          soldDate: document.getElementById('sl-date').value,
          note: document.getElementById('sl-note').value.trim()
        };
        if (isEdit) Store.update('sell', existing.id, obj);
        else Store.add('sell', obj);
        UI.toast('已保存 💕'); c(); window.rerenderCurrent();
      } }
    ]
  });
}

function sellDel(s) {
  UI.confirm('删除成品', '确定删除「' + (s.name || '该成品') + '」吗？').then((ok) => {
    if (!ok) return;
    Store.remove('sell', s.id);
    UI.toast('已删除'); window.rerenderCurrent();
  });
}

function sellField(label, input) { return UI.el('div', { class: 'field' }, [UI.el('label', {}, label), input]); }
function sellStatBox(v, l) { return UI.el('div', { class: 'stat-box' }, [UI.el('div', { class: 'v' }, v), UI.el('div', { class: 'l' }, l)]); }
