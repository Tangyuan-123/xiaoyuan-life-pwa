/* 成品售卖：记录成本/售价，自动算盈利；以"已售出"为主，在售弱化，支持照片 */
window.SellView = {
  register() {
    registerView('sell', (root) => {
      const all = Store.getArr('sell');
      const wrap = UI.el('div', {});

      // 状态筛选：已售优先排前，在售弱化
      const statusTabs = UI.el('div', { class: 'status-tabs', style: 'margin-bottom:14px;' });
      ['全部'].concat(SELL_STATUS).forEach((st) => {
        statusTabs.appendChild(UI.el('button', {
          class: 'status-tab' + (_sellStatus === st ? ' active' : '') + (st === '在售' ? ' muted-tab' : ''),
          onclick: () => { _sellStatus = st; window.rerenderCurrent(); }
        }, st === '全部' ? '全部' : st));
      });
      wrap.appendChild(statusTabs);

      // 搜索
      const searchWrap = sellSearchBox();
      wrap.appendChild(searchWrap);

      // 盈利横幅（显眼）
      const profitBanner = UI.el('div', { class: 'profit-banner', style: 'margin-bottom:14px;' });
      wrap.appendChild(profitBanner);

      // 统计
      const statRow = UI.el('div', { class: 'stat-row', style: 'margin-bottom:14px;' });
      wrap.appendChild(statRow);

      wrap.appendChild(UI.el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:14px;', onclick: () => sellForm(null) }, [svg('add'), '记一笔成品']));

      const grid = UI.el('div', { class: 'bjd-grid' });
      wrap.appendChild(grid);

      function renderGrid() {
        const items = all
          .filter((s) => _sellStatus === '全部' || (s.status || '在售') === _sellStatus)
          .filter((s) => sellMatch(s, _sellSearch));
        const sold = items.filter((s) => s.status === '已售');
        const totalCost = items.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0);
        const totalPrice = items.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
        const profit = totalPrice - totalCost;
        const soldQty = sold.reduce((n, s) => n + sellQtyOf(s), 0);
        const shownQty = items.reduce((n, s) => n + sellQtyOf(s), 0);

        // 盈利横幅
        profitBanner.innerHTML = '';
        profitBanner.appendChild(sellProfitBanner(soldQty, totalCost, totalPrice, profit));

        // 统计
        statRow.innerHTML = '';
        statRow.appendChild(sellStatBox(shownQty + ' 件', '当前显示'));
        statRow.appendChild(sellStatBox('¥' + Math.round(totalCost).toLocaleString('zh-CN'), '总成本'));
        statRow.appendChild(sellStatBox('¥' + Math.round(totalPrice).toLocaleString('zh-CN'), _sellStatus === '已售' ? '总收入' : '售价合计'));
        statRow.appendChild(sellStatBox('¥' + Math.round(profit).toLocaleString('zh-CN'), '盈利', true, profit >= 0));

        grid.innerHTML = '';
        if (items.length) items.forEach((s) => grid.appendChild(sellCard(s)));
        else grid.appendChild(UI.el('div', { class: 'empty' }, [UI.el('div', { class: 'em-ico', html: svg('sell') }), UI.el('div', { style: 'margin-top:8px;' }, '还没有记录，点上面记一笔 💕')]));
      }
      renderGrid();

      const si = searchWrap.querySelector('#sell-search');
      if (si) si.addEventListener('input', () => { _sellSearch = si.value.trim(); renderGrid(); });

      root.appendChild(wrap);
    });
  }
};

const SELL_STATUS = ['已售', '在售', '已下架'];
const SELL_STATUS_COLOR = { '已售': '#9AA6FF', '在售': '#B7C0CC', '已下架': '#B0B7C3' };
let _sellStatus = '已售';
let _sellSearch = '';
let _sellUrls = [];
function sellRevokeAll() { _sellUrls.forEach((u) => URL.revokeObjectURL(u)); _sellUrls = []; }
window.__sellRevoke = sellRevokeAll;
function sellThumbURL(id, cb) { DB.getURL(id).then((u) => { if (u) { _sellUrls.push(u); cb(u); } }); }
function sellQtyOf(s) { const n = parseInt(s && s.qty, 10); return (n >= 1) ? n : 1; }

function sellCard(s) {
  const card = UI.el('div', { class: 'bjd-card', style: 'cursor:pointer;' });
  const thumb = UI.el('div', { class: 'thumb', html: svg('sell') });
  if (s.photos && s.photos.length) sellThumbURL(s.photos[0], (u) => { thumb.innerHTML = ''; thumb.appendChild(UI.el('img', { src: u, alt: s.name })); });
  card.appendChild(thumb);
  const stColor = SELL_STATUS_COLOR[s.status] || SELL_STATUS_COLOR['在售'];
  const cm = (parseFloat(s.cost) || 0);
  const pm = (parseFloat(s.price) || 0);
  const profit = pm - cm;
  const qty = sellQtyOf(s);
  const profitColor = profit >= 0 ? '#2fae6b' : '#e23b3b';
  const profitTxt = (profit >= 0 ? '+' : '') + '¥' + Math.round(profit).toLocaleString('zh-CN');
  const qtyTag = qty > 1 ? UI.el('span', { class: 'qty-pill', title: '数量' }, '×' + qty + '件') : null;
  card.appendChild(UI.el('div', { class: 'info' }, [
    UI.el('div', { class: 'nm' }, [
      UI.el('span', {}, s.name || '未命名'),
      qtyTag,
      UI.el('span', { class: 'dot', title: s.status || '在售', style: 'background:' + stColor + ';' })
    ]),
    UI.el('div', { class: 'meta' }, [
      UI.el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;font-weight:800;font-size:15px;' }, [
        UI.el('span', {}, '售价 ¥' + (s.price || '—')),
        UI.el('span', { style: 'color:' + profitColor + ';' }, '盈利 ' + profitTxt)
      ]),
      UI.el('div', { class: 'muted', style: 'margin-top:2px;' }, '成本 ¥' + (s.cost || '—') + ' · ' + (s.status === '已售' ? '已售出' : (s.status || '在售')) + (qty > 1 ? ' · ×' + qty + '件' : ''))
    ])
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

function sellProfitBanner(soldCount, cost, price, profit) {
  const profitColor = profit >= 0 ? '#2fae6b' : '#e23b3b';
  return UI.el('div', { class: 'profit-banner-inner' }, [
    UI.el('div', { class: 'pb-main' }, [
      UI.el('div', { class: 'pb-label' }, '净利润（盈利）'),
      UI.el('div', { class: 'pb-value', style: 'color:' + profitColor }, (profit >= 0 ? '+' : '') + '¥' + Math.round(profit).toLocaleString('zh-CN'))
    ]),
    UI.el('div', { class: 'pb-sub' }, [
      UI.el('span', {}, ['成本 ', UI.el('b', {}, '¥' + Math.round(cost).toLocaleString('zh-CN'))]),
      UI.el('span', {}, ['售价 ', UI.el('b', {}, '¥' + Math.round(price).toLocaleString('zh-CN'))]),
      UI.el('span', {}, ['已售 ', UI.el('b', {}, soldCount + ' 件')])
    ])
  ]);
}

function sellDetail(s) {
  const body = UI.el('div', {});
  const qty = sellQtyOf(s);
  if (s.photos && s.photos.length) {
    const pgrid = UI.el('div', { class: 'photo-grid' });
    s.photos.forEach((pid) => sellThumbURL(pid, (u) => {
      const ph = UI.el('div', { class: 'pg-item' }, UI.el('img', { src: u, alt: s.name }));
      ph.addEventListener('click', () => UI.photoViewer(s.photos, pid));
      pgrid.appendChild(ph);
    }));
    body.appendChild(pgrid);
  } else {
    body.appendChild(UI.el('div', { class: 'muted', style: 'padding:8px 0;' }, '暂无照片'));
  }
  body.appendChild(UI.el('hr', { class: 'sep' }));
  // 盈利横幅（详情内也显眼）
  const cm = (parseFloat(s.cost) || 0);
  const pm = (parseFloat(s.price) || 0);
  if (cm || pm) {
    const profit = pm - cm;
    const pColor = profit >= 0 ? '#2fae6b' : '#e23b3b';
    body.appendChild(UI.el('div', { class: 'profit-banner', style: 'margin-bottom:10px;' }, [
      UI.el('div', { class: 'profit-banner-inner' }, [
        UI.el('div', { class: 'pb-main' }, [
          UI.el('div', { class: 'pb-label' }, s.status === '已售' ? '本单净利润' : '预估盈利'),
          UI.el('div', { class: 'pb-value', style: 'color:' + pColor }, (profit >= 0 ? '+' : '') + '¥' + Math.round(profit).toLocaleString('zh-CN'))
        ]),
        UI.el('div', { class: 'pb-sub' }, [
          UI.el('span', {}, ['数量 ', UI.el('b', {}, qty + ' 件')]),
          UI.el('span', {}, ['成本 ', UI.el('b', {}, '¥' + Math.round(cm).toLocaleString('zh-CN'))]),
          UI.el('span', {}, ['售价 ', UI.el('b', {}, '¥' + Math.round(pm).toLocaleString('zh-CN'))])
        ])
      ])
    ]));
  }
  const info = [
    ['商品名', s.name],
    ['数量', qty + ' 件'],
    ['售价（合计）', s.price ? '¥' + s.price : '—'],
    ['成本价（合计）', s.cost ? '¥' + s.cost : '—'],
    ['状态', s.status || '在售'],
    ['买家/渠道', s.buyer],
    ['售出日期', s.soldDate],
    ['备注', s.note]
  ];
  if (qty > 1) {
    if (cm) info.push(['单件成本', '¥' + (cm / qty).toFixed(2)]);
    if (pm) info.push(['单件售价', '¥' + (pm / qty).toFixed(2)]);
  }
  info.forEach(([k, v]) => {
    if (!v) return;
    body.appendChild(UI.el('div', { style: 'display:flex;gap:10px;padding:5px 0;' }, [
      UI.el('div', { class: 'muted', style: 'width:80px;flex:none;' }, k),
      UI.el('div', { style: 'font-weight:600;' }, String(v))
    ]));
  });
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
      sellThumbURL(pid, (u) => {
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

  const body = UI.el('div', {}, [
    sellField('商品名 / 描述', UI.el('input', { type: 'text', id: 'sl-name', value: init.name || '', placeholder: '如 成品娃·初音未来' })),
    UI.el('div', { class: 'row' }, [
      sellField('售价 (¥)', UI.el('input', { type: 'number', id: 'sl-price', min: '0', step: '1', value: init.price || '' })),
      sellField('成本价 (¥)', UI.el('input', { type: 'number', id: 'sl-cost', min: '0', step: '1', value: init.cost || '', placeholder: '算盈利' }))
    ]),
    sellField('数量（一起卖几件）', UI.el('input', { type: 'number', id: 'sl-qty', min: '1', step: '1', value: (init.qty || 1) })),
    sellField('状态', UI.el('select', { id: 'sl-status' }, SELL_STATUS.map((st) =>
      UI.el('option', { value: st, selected: (init.status || '已售') === st ? '' : null }, st)))),
    UI.el('div', { id: 'sl-sold-wrap', style: 'display:' + ((init.status === '已售') ? '' : 'none') + ';' }, [
      UI.el('div', { class: 'row' }, [
        sellField('买家 / 渠道', UI.el('input', { type: 'text', id: 'sl-buyer', value: init.buyer || '', placeholder: '如 闲鱼昵称' })),
        sellField('售出日期', UI.el('input', { type: 'date', id: 'sl-date', value: init.soldDate || '' }))
      ])
    ]),
    sellField('备注', UI.el('textarea', { id: 'sl-note', rows: '2', placeholder: '可选' }, init.note || '')),
    UI.el('div', { class: 'field' }, [UI.el('label', {}, '添加照片'), photoBox])
  ]);
  const _slStatusSel = body.querySelector('#sl-status');
  const _slSoldWrap = body.querySelector('#sl-sold-wrap');
  if (_slStatusSel && _slSoldWrap) _slStatusSel.addEventListener('change', () => { _slSoldWrap.style.display = (_slStatusSel.value === '已售') ? '' : 'none'; });
  UI.openModal({
    title: isEdit ? '编辑成品' : '记一笔成品', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: isEdit ? '保存' : '保存', kind: 'btn-primary', onClick: (c) => {
        const name = document.getElementById('sl-name').value.trim();
        if (!name) { UI.toast('请填写商品名'); return; }
        const obj = {
          name,
          qty: parseInt(document.getElementById('sl-qty').value, 10) || 1,
          price: document.getElementById('sl-price').value || '',
          cost: document.getElementById('sl-cost').value || '',
          status: document.getElementById('sl-status').value,
          buyer: document.getElementById('sl-buyer').value.trim(),
          soldDate: document.getElementById('sl-date').value,
          note: document.getElementById('sl-note').value.trim(),
          photos: localPhotos.slice()
        };
        if (isEdit) {
          const removed = (existing.photos || []).filter((p) => !localPhotos.includes(p));
          removed.forEach((p) => DB.del(p));
          Store.update('sell', existing.id, obj);
        } else {
          Store.add('sell', obj);
        }
        UI.toast('已保存 💕'); c(); window.rerenderCurrent();
      } }
    ]
  });
}

function sellDel(s) {
  UI.confirm('删除成品', '确定删除「' + (s.name || '该成品') + '」及其所有照片吗？').then((ok) => {
    if (!ok) return;
    (s.photos || []).forEach((p) => DB.del(p));
    Store.remove('sell', s.id);
    UI.toast('已删除'); window.rerenderCurrent();
  });
}

function sellField(label, input) { return UI.el('div', { class: 'field' }, [UI.el('label', {}, label), input]); }
function sellStatBox(v, l, hl, positive) {
  if (hl) {
    const c = positive ? '#2fae6b' : '#e23b3b';
    return UI.el('div', { class: 'stat-box', style: 'border:1px solid ' + (positive ? '#BFE9D4' : '#F6C9C9') + ';' }, [
      UI.el('div', { class: 'v', style: 'color:' + c + ';' }, v),
      UI.el('div', { class: 'l' }, l)
    ]);
  }
  return UI.el('div', { class: 'stat-box' }, [UI.el('div', { class: 'v' }, v), UI.el('div', { class: 'l' }, l)]);
}
