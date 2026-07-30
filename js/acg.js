/* 二次元娃收藏：娃脸壳/娃体/头壳 + 心愿单，支持照片（原图存储，灯箱看大图不裁切） */
window.AcgView = {
  register() {
    registerView('acg', (root) => {
      const all = Store.getArr('acg');
      const wishes = Store.getArr('acgWishes');
      const wrap = UI.el('div', {});

      // 卡片交互初始化（多选 / 拖拽排序）
      CardActions.beginView({
        arrName: 'acg',
        root: wrap,
        items: all,
        getBuy: (d) => parseFloat(d.price) || 0,
        getSold: (d) => (d.received === '已售出') ? (parseFloat(d.soldPrice) || 0) : 0,
        onDelete: (id) => { const d = Store.get('acg', id); if (d) { (d.photos || []).forEach((p) => DB.del(p)); Store.remove('acg', id); } },
        onRerender: () => window.rerenderCurrent(),
        reorder: (name, order) => { Store.reorder(name, order); UI.toast('顺序已保存 💕'); window.rerenderCurrent(); }
      });

      // 分类筛选标签（含心愿单）
      const tabs = UI.el('div', { class: 'cat-tabs', style: 'margin-bottom:14px;' });
      const TABS = ['全部'].concat(ACG_CATS).concat(['心愿单']);
      TABS.forEach((cat) => {
        const isWish = cat === '心愿单';
        const count = cat === '全部' ? all.length
          : isWish ? wishes.length
          : all.filter((d) => (d.category || '脸壳') === cat).length;
        let label;
        if (isWish) label = [UI.el('span', { html: svg('heart'), style: 'display:inline-flex;vertical-align:-3px;margin-right:3px;' }), '心愿单' + (count ? ' ' + count : '')];
        else label = cat + (count ? ' ' + count : '');
        tabs.appendChild(UI.el('button', {
          class: 'cat-tab' + (cat === _acgFilter ? ' active' : ''),
          onclick: () => { _acgFilter = cat; window.rerenderCurrent(); }
        }, label));
      });
      wrap.appendChild(tabs);

      if (_acgFilter === '心愿单') {
        acgRenderWishlist(wrap, wishes);
      } else {
        const itemsBase = all.slice()
          .filter((d) => _acgFilter === '全部' || (d.category || '脸壳') === _acgFilter)
          .filter((d) => _acgStatusFilter === '全部' || (d.received || '未收到') === _acgStatusFilter);

        // 搜索框
        const searchWrap = acgSearchBox();
        wrap.appendChild(searchWrap);

        // 状态筛选（小按钮）
        const statusTabs = UI.el('div', { class: 'status-tabs', style: 'margin-bottom:14px;' });
        ['全部', '已收到', '未收到', '定金中', '已售出'].forEach((st) => {
          statusTabs.appendChild(UI.el('button', {
            class: 'status-tab' + (_acgStatusFilter === st ? ' active' : ''),
            onclick: () => { _acgStatusFilter = st; window.rerenderCurrent(); }
          }, st));
        });
        wrap.appendChild(statusTabs);

        // 统计（按当前筛选）
        const statRow = UI.el('div', { class: 'stat-row', style: 'margin-bottom:14px;' });
        wrap.appendChild(statRow);

        wrap.appendChild(UI.el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:14px;', onclick: () => acgItemForm(null, _acgFilter === '全部' ? null : _acgFilter) }, [svg('add'), '添加' + (_acgFilter === '全部' ? '娃' : _acgFilter)]));

        const grid = UI.el('div', { class: 'bjd-grid' });
        wrap.appendChild(grid);

        function renderGrid() {
          const items = itemsBase.filter((d) => acgMatch(d, _acgSearch));
          const isSoldFilter = _acgStatusFilter === '已售出';
          const total = items.reduce((s, d) => s + parseFloat(isSoldFilter ? (d.soldPrice || 0) : (d.price || 0)), 0);
          statRow.innerHTML = '';
          statRow.appendChild(acgStatBox(items.length + ' 件', _acgFilter === '全部' ? '全部收藏' : _acgFilter));
          statRow.appendChild(acgStatBox('¥' + total.toLocaleString('zh-CN', { maximumFractionDigits: 0 }), isSoldFilter ? '售出总额' : '总身价'));
          grid.innerHTML = '';
          if (items.length) {
            items.forEach((d) => grid.appendChild(acgItemCard(d, grid)));
          } else {
            grid.appendChild(UI.el('div', { class: 'empty' }, [UI.el('div', { class: 'em-ico', html: svg('acg') }), UI.el('div', { style: 'margin-top:8px;' }, '没有匹配的娃，换个关键词试试 💕')]));
          }
          CardActions.setItems(items);
          CardActions.refreshBar();
        }
        renderGrid();

        const searchInput = searchWrap.querySelector('#acg-search');
        if (searchInput) searchInput.addEventListener('input', () => { _acgSearch = searchInput.value.trim(); renderGrid(); });
      }
      root.appendChild(wrap);
      window.__acgRevoke = () => acgRevokeAll();
    });
  }
};

const ACG_CATS = ['脸壳', '娃体', '头壳', '整体', '娃衣', '其他'];
const ACG_CAT_COLORS = { '脸壳': '#FF6B9D', '娃体': '#3DB2FF', '头壳': '#7A4DD6', '整体': '#FFB14D', '娃衣': '#6BCB9C', '其他': '#B0B7C3' };
const ACG_SKIN_CATS = ['脸壳', '娃体', '整体'];
const ACG_SKINS = ['粉', '普', '烧'];
let _acgFilter = '全部';
let _acgStatusFilter = '全部';
let _acgSearch = '';
let _acgWishToRemoveOnSave = null;

let _acgUrls = [];
function acgRevokeAll() { _acgUrls.forEach((u) => URL.revokeObjectURL(u)); _acgUrls = []; }
function acgThumbURL(id, cb) { DB.getURL(id).then((u) => { if (u) { _acgUrls.push(u); cb(u); } }); }

function acgItemCard(d, grid) {
  const card = UI.el('div', { class: 'bjd-card' });
  const thumb = UI.el('div', { class: 'thumb', html: svg('acg') });
  if (d.photos && d.photos.length) acgThumbURL(d.photos[0], (u) => { thumb.innerHTML = ''; const img = UI.el('img', { src: u, alt: d.name }); thumb.appendChild(img); });
  card.appendChild(thumb);
  const recvColor = { '已收到': '#6BCB9C', '定金中': '#FFC46B', '未收到': '#B0B7C3', '已售出': '#9AA6FF' }[d.received || '未收到'];
  card.appendChild(UI.el('div', { class: 'info' }, [
    UI.el('div', { class: 'nm' }, [
      UI.el('span', {}, d.name || '未命名'),
      UI.el('span', { class: 'dot', title: d.category || '脸壳', style: 'background:' + (ACG_CAT_COLORS[d.category] || '#B0B7C3') + ';' }),
      UI.el('span', { class: 'dot', title: d.received || '未收到', style: 'background:' + recvColor + ';' })
    ]),
    UI.el('div', { class: 'meta' }, [
      UI.el('div', {}, '娃社：' + (d.company || '—')),
      UI.el('div', {}, '肤色：' + (d.skin || '—') + ' · 尺寸：' + (d.size || '—'))
    ])
  ]));
  card.appendChild(UI.el('div', { class: 'acts' }, [
    UI.el('button', { class: 'icon-btn', title: '编辑', html: svg('edit'), onclick: (e) => { e.stopPropagation(); acgItemForm(d); } }),
    UI.el('button', { class: 'icon-btn danger', title: '删除', html: svg('trash'), onclick: (e) => { e.stopPropagation(); acgDelItem(d); } })
  ]));
  if (CardActions.isSelected(d.id)) card.classList.add('selected');
  CardActions.attach(card, d, { gridEl: grid, onTap: () => acgItemDetail(d) });
  return card;
}

function acgMatch(d, q) {
  if (!q) return true;
  q = String(q).toLowerCase();
  const hay = [d.name, d.company, d.category, d.skin, d.size, d.note, d.received, d.character]
    .filter(Boolean).join(' ').toLowerCase();
  return hay.indexOf(q) >= 0;
}

function acgSearchBox() {
  const box = UI.el('div', { class: 'search-box', style: 'margin-bottom:14px;' });
  const input = UI.el('input', { type: 'search', class: 'search-input', id: 'acg-search', placeholder: '搜索名字', value: _acgSearch });
  box.appendChild(UI.el('span', { class: 'search-ico', html: svg('search') }));
  box.appendChild(input);
  if (_acgSearch) box.appendChild(UI.el('button', { class: 'search-clear', html: svg('close'), onclick: () => { _acgSearch = ''; window.rerenderCurrent(); } }));
  return box;
}

function acgItemDetail(d) {
  const body = UI.el('div', {});
  if (d.photos && d.photos.length) {
    const grid = UI.el('div', { class: 'photo-grid' });
    d.photos.forEach((pid) => acgThumbURL(pid, (u) => {
      const ph = UI.el('div', { class: 'pg-item' }, UI.el('img', { src: u, alt: d.name }));
      ph.addEventListener('click', () => UI.photoViewer(d.photos, pid));
      grid.appendChild(ph);
    }));
    body.appendChild(grid);
  } else {
    body.appendChild(UI.el('div', { class: 'muted', style: 'padding:8px 0;' }, '暂无照片'));
  }
  body.appendChild(UI.el('hr', { class: 'sep' }));
  const info = [
    ['名字', d.name], ['分类', d.category || '脸壳'], ['是否已收到', d.received || '未收到'],
    ['娃社', d.company], ['肤色', d.skin], ['尺寸', d.size], ['价格', d.price ? '¥' + d.price : ''],
    ['售出金额', d.soldPrice ? '¥' + d.soldPrice : ''], ['入手日期', d.date], ['备注', d.note]
  ];
  info.forEach(([k, v]) => {
    if (!v) return;
    body.appendChild(UI.el('div', { style: 'display:flex;gap:10px;padding:5px 0;' }, [
      UI.el('div', { class: 'muted', style: 'width:80px;flex:none;' }, k),
      UI.el('div', { style: 'font-weight:600;' }, String(v))
    ]));
  });
  UI.openModal({
    title: d.name || '娃详情', body,
    actions: [
      { text: '关闭', kind: 'btn-ghost' },
      { text: '删除', kind: 'btn-danger', onClick: (c) => { c(); acgDelItem(d); } },
      { text: '编辑', kind: 'btn-primary', onClick: (c) => { c(); acgItemForm(d); } }
    ]
  });
}

function acgItemForm(existing, defaultCat, prefill) {
  const isEdit = !!existing;
  const init = prefill || (existing || {});
  const initCat = existing ? existing.category : (defaultCat || (prefill && prefill.category) || '脸壳');
  const initSkin = existing ? (existing.skin || '') : (ACG_SKIN_CATS.includes(initCat) ? '白' : '');
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
      acgThumbURL(pid, (u) => {
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
    acgField('娃名', UI.el('input', { type: 'text', id: 'a-name', value: init.name || '', placeholder: '给娃起个名字' })),
    UI.el('div', { class: 'field' }, [
      UI.el('label', {}, '分类'),
      UI.el('select', { id: 'a-cat' }, ACG_CATS.map((c) => UI.el('option', { value: c, selected: (initCat === c) ? '' : null }, c)))
    ]),
    UI.el('div', { class: 'row' }, [
      acgField('娃社', UI.el('input', { type: 'text', id: 'a-company', value: init.company || '', placeholder: '如 娃社名' })),
      acgField('尺寸', UI.el('input', { type: 'text', id: 'a-size', value: init.size || '', placeholder: '如 1/4 / 60cm' }))
    ]),
    UI.el('div', { class: 'row' }, [
      UI.el('div', { id: 'a-skin-wrap' }, [
        acgField('肤色', UI.el('input', { type: 'text', id: 'a-skin', list: 'acg-skin-list', value: initSkin, placeholder: '选择或填写' })),
        UI.el('datalist', { id: 'acg-skin-list' }, ACG_SKINS.map((s) => UI.el('option', { value: s }, s)))
      ]),
      acgField('价格 (¥)', UI.el('input', { type: 'number', id: 'a-price', min: '0', step: '1', value: init.price || '', placeholder: '选填' }))
    ]),
    UI.el('div', { class: 'row' }, [
      acgField('是否已收到', UI.el('select', { id: 'a-received' }, [
        UI.el('option', { value: '未收到', selected: (init.received || '未收到') === '未收到' ? '' : null }, '未收到'),
        UI.el('option', { value: '定金中', selected: (init.received || '未收到') === '定金中' ? '' : null }, '定金中'),
        UI.el('option', { value: '已收到', selected: (init.received || '未收到') === '已收到' ? '' : null }, '已收到'),
        UI.el('option', { value: '已售出', selected: (init.received || '未收到') === '已售出' ? '' : null }, '已售出')
      ])),
      acgField('入手日期', UI.el('input', { type: 'date', id: 'a-date', value: init.date || '' }))
    ]),
    UI.el('div', { id: 'a-sold-wrap', style: 'display:' + ((init.received === '已售出') ? '' : 'none') + ';' }, [
      acgField('售出金额 (¥)', UI.el('input', { type: 'number', id: 'a-soldprice', min: '0', step: '1', value: init.soldPrice || '', placeholder: '选填' }))
    ]),
    acgField('备注', UI.el('textarea', { id: 'a-note', rows: '2', placeholder: '可选' }, init.note || '')),
    UI.el('div', { class: 'field' }, [UI.el('label', {}, '添加照片'), photoBox])
  ]);

  // 根据分类切换肤色字段显隐
  const catSel = body.querySelector('#a-cat');
  const skinWrap = body.querySelector('#a-skin-wrap');
  const aSkin = body.querySelector('#a-skin');
  function toggleSkin() {
    const show = ACG_SKIN_CATS.includes(catSel.value);
    skinWrap.style.display = show ? '' : 'none';
    if (show && !aSkin.value.trim()) aSkin.value = '白';
  }
  catSel.addEventListener('change', toggleSkin);
  toggleSkin();

  // 状态为「已售出」时显示售出金额
  const _recvSel = body.querySelector('#a-received');
  const _soldWrap = body.querySelector('#a-sold-wrap');
  if (_recvSel && _soldWrap) _recvSel.addEventListener('change', () => { _soldWrap.style.display = (_recvSel.value === '已售出') ? '' : 'none'; });

  UI.openModal({
    title: isEdit ? '编辑娃' : '添加娃', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: isEdit ? '保存' : '添加', kind: 'btn-primary', onClick: (c) => {
        const name = document.getElementById('a-name').value.trim();
        if (!name) { UI.toast('请填写娃名'); return; }
        const obj = {
          name,
          category: document.getElementById('a-cat').value,
          company: document.getElementById('a-company').value.trim(),
          skin: document.getElementById('a-skin').value,
          size: document.getElementById('a-size').value.trim(),
          price: document.getElementById('a-price').value || '',
          received: document.getElementById('a-received').value,
          soldPrice: document.getElementById('a-soldprice').value || '',
          date: document.getElementById('a-date').value,
          note: document.getElementById('a-note').value.trim(),
          photos: localPhotos.slice()
        };
        if (isEdit) {
          const removed = (existing.photos || []).filter((p) => !localPhotos.includes(p));
          removed.forEach((p) => DB.del(p));
          Store.update('acg', existing.id, obj);
        } else {
          Store.add('acg', obj);
          if (_acgWishToRemoveOnSave) { Store.remove('acgWishes', _acgWishToRemoveOnSave); _acgWishToRemoveOnSave = null; }
        }
        UI.toast('已保存 💕'); c(); window.rerenderCurrent();
      } }
    ]
  });
}

function acgDelItem(d) {
  UI.confirm('删除娃', '确定删除「' + (d.name || '该娃') + '」及其所有照片吗？').then((ok) => {
    if (!ok) return;
    (d.photos || []).forEach((p) => DB.del(p));
    Store.remove('acg', d.id);
    UI.toast('已删除'); window.rerenderCurrent();
  });
}

/* 心愿单 */
function acgRenderWishlist(wrap, wishes) {
  const total = wishes.reduce((s, w) => s + (parseFloat(w.price) || 0), 0);
  wrap.appendChild(UI.el('div', { class: 'stat-row', style: 'margin-bottom:14px;' }, [
    acgStatBox(wishes.length + ' 项', '心愿单'),
    acgStatBox('¥' + total.toLocaleString('zh-CN', { maximumFractionDigits: 0 }), '预估总花费')
  ]));
  wrap.appendChild(UI.el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:14px;', onclick: () => acgWishForm(null) }, [svg('add'), '添加心愿']));
  if (wishes.length) {
    const grid = UI.el('div', { class: 'bjd-grid' });
    wishes.forEach((w) => grid.appendChild(acgWishCard(w)));
    wrap.appendChild(grid);
  } else {
    wrap.appendChild(UI.el('div', { class: 'empty' }, [UI.el('div', { class: 'em-ico', html: svg('heart') }), UI.el('div', { style: 'margin-top:8px;' }, '心愿单还是空的，把想要的娃加进来吧 💕')]));
  }
}

function acgWishCard(w) {
  const card = UI.el('div', { class: 'bjd-card' });
  const thumb = UI.el('div', { class: 'thumb', html: svg('heart'), style: 'background:#FDEAF1;color:#FF6B9D;' });
  if (w.photos && w.photos.length) acgThumbURL(w.photos[0], (u) => { thumb.innerHTML = ''; const img = UI.el('img', { src: u, alt: w.name }); thumb.appendChild(img); });
  card.appendChild(thumb);
  card.appendChild(UI.el('div', { class: 'info' }, [
    UI.el('div', { class: 'nm' }, [
      UI.el('span', {}, w.name || '未命名'),
      UI.el('span', { class: 'dot', title: w.category || '脸壳', style: 'background:' + (ACG_CAT_COLORS[w.category] || '#B0B7C3') + ';' })
    ]),
    UI.el('div', { class: 'meta' }, [
      UI.el('div', {}, '娃社：' + (w.company || '—')),
      UI.el('div', {}, '肤色：' + (w.skin || '—')),
      UI.el('div', {}, '尺寸：' + (w.size || '—') + ' · 预估 ' + (w.price ? '¥' + w.price : '—'))
    ])
  ]));
  card.appendChild(UI.el('div', { class: 'acts' }, [
    UI.el('button', { class: 'icon-btn', title: '编辑', html: svg('edit'), onclick: (e) => { e.stopPropagation(); acgWishForm(w); } }),
    UI.el('button', { class: 'icon-btn danger', title: '删除', html: svg('trash'), onclick: (e) => { e.stopPropagation(); acgDelWish(w); } })
  ]));
  card.addEventListener('click', () => acgWishDetail(w));
  return card;
}

function acgWishDetail(w) {
  const body = UI.el('div', {});
  if (w.photos && w.photos.length) {
    const grid = UI.el('div', { class: 'photo-grid' });
    w.photos.forEach((pid) => acgThumbURL(pid, (u) => {
      const ph = UI.el('div', { class: 'pg-item' }, UI.el('img', { src: u, alt: w.name }));
      ph.addEventListener('click', () => UI.photoViewer(w.photos, pid));
      grid.appendChild(ph);
    }));
    body.appendChild(grid);
  } else {
    body.appendChild(UI.el('div', { class: 'muted', style: 'padding:8px 0;' }, '暂无照片'));
  }
  body.appendChild(UI.el('hr', { class: 'sep' }));
  const info = [
    ['名字', w.name], ['分类', w.category || '脸壳'], ['娃社', w.company], ['肤色', w.skin], ['尺寸', w.size],
    ['预估价格', w.price ? '¥' + w.price : ''], ['备注', w.note]
  ];
  info.forEach(([k, v]) => {
    if (!v) return;
    body.appendChild(UI.el('div', { style: 'display:flex;gap:10px;padding:5px 0;' }, [
      UI.el('div', { class: 'muted', style: 'width:80px;flex:none;' }, k),
      UI.el('div', { style: 'font-weight:600;' }, String(v))
    ]));
  });
  UI.openModal({
    title: w.name || '心愿详情', body,
    actions: [
      { text: '关闭', kind: 'btn-ghost' },
      { text: '删除', kind: 'btn-danger', onClick: (c) => { c(); acgDelWish(w); } },
      { text: '编辑', kind: 'btn-primary', onClick: (c) => { c(); acgWishForm(w); } }
    ]
  });
}

function acgMoveWishToItem(w) {
  _acgWishToRemoveOnSave = w.id;
  acgItemForm(null, w.category, {
    name: w.name, category: w.category, company: w.company, skin: w.skin, size: w.size,
    price: w.price, note: w.note, received: '未收到', photos: w.photos ? w.photos.slice() : []
  });
}

function acgDelWish(w) {
  UI.confirm('删除心愿', '确定从心愿单删除「' + (w.name || '该项') + '」吗？').then((ok) => {
    if (!ok) return;
    (w.photos || []).forEach((p) => DB.del(p));
    Store.remove('acgWishes', w.id);
    UI.toast('已删除'); window.rerenderCurrent();
  });
}

function acgWishForm(existing) {
  const isEdit = !!existing;
  const init = existing || {};
  const initCat = init.category || '脸壳';
  const initSkin = existing ? (existing.skin || '') : (ACG_SKIN_CATS.includes(initCat) ? '白' : '');
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
      acgThumbURL(pid, (u) => {
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
    acgField('名字', UI.el('input', { type: 'text', id: 'w-name', value: init.name || '', placeholder: '想要的娃' })),
    UI.el('div', { class: 'field' }, [
      UI.el('label', {}, '分类'),
      UI.el('select', { id: 'w-cat' }, ACG_CATS.map((c) => UI.el('option', { value: c, selected: (initCat === c) ? '' : null }, c)))
    ]),
    UI.el('div', { class: 'row' }, [
      acgField('娃社', UI.el('input', { type: 'text', id: 'w-company', value: init.company || '', placeholder: '如 娃社名' })),
      acgField('尺寸', UI.el('input', { type: 'text', id: 'w-size', value: init.size || '', placeholder: '如 1/4 / 60cm' }))
    ]),
    UI.el('div', { class: 'row' }, [
      UI.el('div', { id: 'w-skin-wrap' }, [
        acgField('肤色', UI.el('input', { type: 'text', id: 'w-skin', list: 'acg-skin-list', value: initSkin, placeholder: '选择或填写' })),
        UI.el('datalist', { id: 'acg-skin-list' }, ACG_SKINS.map((s) => UI.el('option', { value: s }, s)))
      ]),
      acgField('预估价格 (¥)', UI.el('input', { type: 'number', id: 'w-price', min: '0', step: '1', value: init.price || '', placeholder: '选填' }))
    ]),
    acgField('备注', UI.el('textarea', { id: 'w-note', rows: '2', placeholder: '可选' }, init.note || '')),
    UI.el('div', { class: 'field' }, [UI.el('label', {}, '添加照片'), photoBox])
  ]);

  // 根据分类切换肤色字段显隐
  const wCatSel = body.querySelector('#w-cat');
  const wSkinWrap = body.querySelector('#w-skin-wrap');
  const wSkin = body.querySelector('#w-skin');
  function toggleWSkin() {
    const show = ACG_SKIN_CATS.includes(wCatSel.value);
    wSkinWrap.style.display = show ? '' : 'none';
    if (show && !wSkin.value.trim()) wSkin.value = '白';
  }
  wCatSel.addEventListener('change', toggleWSkin);
  toggleWSkin();

  const actions = [{ text: '取消', kind: 'btn-ghost' }];
  if (isEdit) {
    actions.push(
      { text: '删除', kind: 'btn-danger', onClick: (c) => { c(); acgDelWish(existing); } },
      { text: '加入收藏', kind: 'btn', onClick: (c) => { c(); acgMoveWishToItem(existing); } }
    );
  }
  actions.push({ text: isEdit ? '保存' : '添加', kind: 'btn-primary', onClick: (c) => {
    const name = document.getElementById('w-name').value.trim();
    if (!name) { UI.toast('请填写名字'); return; }
    const obj = {
      name,
      category: document.getElementById('w-cat').value,
      company: document.getElementById('w-company').value.trim(),
      skin: document.getElementById('w-skin').value,
      size: document.getElementById('w-size').value.trim(),
      price: document.getElementById('w-price').value || '',
      note: document.getElementById('w-note').value.trim(),
      photos: localPhotos.slice()
    };
    if (isEdit) {
      const removed = (existing.photos || []).filter((p) => !localPhotos.includes(p));
      removed.forEach((p) => DB.del(p));
      Store.update('acgWishes', existing.id, obj);
    } else {
      Store.add('acgWishes', obj);
    }
    UI.toast('已保存 💕'); c(); window.rerenderCurrent();
  } });
  UI.openModal({
    title: isEdit ? '编辑心愿' : '添加心愿', body,
    actions: actions
  });
}

function acgField(label, input) { return UI.el('div', { class: 'field' }, [UI.el('label', {}, label), input]); }
function acgStatBox(v, l) { return UI.el('div', { class: 'stat-box' }, [UI.el('div', { class: 'v' }, v), UI.el('div', { class: 'l' }, l)]); }
