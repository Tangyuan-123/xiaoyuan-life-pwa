/* BJD 娃娃收藏：基础信息 + 照片（IndexedDB 存储），支持增删改 */
window.BjdView = {
  register() {
    registerView('bjd', (root) => {
      const all = Store.getArr('dolls');
      const wishes = Store.getArr('wishes');
      const wrap = UI.el('div', {});

      // 分类筛选标签（含心愿单 + 统计）
      const tabs = UI.el('div', { class: 'cat-tabs', style: 'margin-bottom:14px;' });
      const TABS = ['全部'].concat(CATS).concat(['心愿单', '统计']);
      TABS.forEach((cat) => {
        const isStat = cat === '统计';
        const count = cat === '全部' ? all.length
          : cat === '心愿单' ? wishes.length
          : cat === '统计' ? null
          : all.filter((d) => (d.category || '娃头') === cat).length;
        let label;
        if (cat === '心愿单') label = [UI.el('span', { html: svg('heart'), style: 'display:inline-flex;vertical-align:-3px;margin-right:3px;' }), '心愿单' + (count ? ' ' + count : '')];
        else if (isStat) label = '📊 统计';
        else label = cat + (count ? ' ' + count : '');
        tabs.appendChild(UI.el('button', {
          class: 'cat-tab' + (cat === _filter ? ' active' : '') + (isStat ? ' stat' : ''),
          onclick: () => { _filter = cat; window.rerenderCurrent(); }
        }, label));
      });
      wrap.appendChild(tabs);

      if (_filter === '心愿单') {
        renderWishlist(wrap, wishes);
      } else if (_filter === '统计') {
        renderCatStats(wrap, all);
      } else {
        const dolls = all.slice()
          .filter((d) => _filter === '全部' || (d.category || '娃头') === _filter)
          .filter((d) => _bjdStatusFilter === '全部' || (d.status || '未收到') === _bjdStatusFilter)
          .sort((a, b) => (b.acquired || '').localeCompare(a.acquired || '') || a.name.localeCompare(b.name));

        // 状态筛选（小按钮）
        const statusTabs = UI.el('div', { class: 'status-tabs', style: 'margin-bottom:14px;' });
        ['全部', '已收到', '未收到', '定金中'].forEach((st) => {
          statusTabs.appendChild(UI.el('button', {
            class: 'status-tab' + (_bjdStatusFilter === st ? ' active' : ''),
            onclick: () => { _bjdStatusFilter = st; window.rerenderCurrent(); }
          }, st));
        });
        wrap.appendChild(statusTabs);

        // 统计（按当前筛选）
        const total = dolls.reduce((s, d) => s + (parseFloat(d.price) || 0), 0);
        wrap.appendChild(UI.el('div', { class: 'stat-row', style: 'margin-bottom:14px;' }, [
          B_statBox(dolls.length + ' 件', _filter === '全部' ? '全部收藏' : _filter),
          B_statBox('¥' + total.toLocaleString('zh-CN', { maximumFractionDigits: 0 }), '总身价')
        ]));

        wrap.appendChild(UI.el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:14px;', onclick: () => dollForm(null, _filter === '全部' ? null : _filter) }, [svg('add'), '添加' + (_filter === '全部' ? '娃娃' : _filter)]));

        if (dolls.length) {
          const grid = UI.el('div', { class: 'bjd-grid' });
          dolls.forEach((d) => grid.appendChild(dollCard(d)));
          wrap.appendChild(grid);
        } else {
          wrap.appendChild(UI.el('div', { class: 'empty' }, [UI.el('div', { class: 'em-ico', html: svg('bjd') }), UI.el('div', { style: 'margin-top:8px;' }, '这个分类下还没有记录，点上面按钮添加吧 💕')]));
        }
      }
      root.appendChild(wrap);

      // 退出时回收缩略图 URL
      window._bjdRevoke = () => revokeAll();
    });
  }
};

/* 分类统计视图（独立标签）：按娃头/假发/娃体/娃衣/其他 统计数量与总价值，紧凑彩色卡片 */
function renderCatStats(wrap, all) {
  const colors = { '娃头': '#FF6B9D', '假发': '#7A4DD6', '娃体': '#3DB2FF', '娃衣': '#FFB14D', '其他': '#6BCB9C' };
  const totals = CATS.map((c) => {
    const items = all.filter((d) => (d.category || '娃头') === c);
    return { cat: c, count: items.length, value: items.reduce((s, d) => s + (parseFloat(d.price) || 0), 0) };
  });
  const grand = totals.reduce((s, t) => s + t.value, 0);
  const maxVal = Math.max(1, ...totals.map((t) => t.value));

  // 概要
  wrap.appendChild(UI.el('div', { class: 'stat-row', style: 'margin-bottom:14px;' }, [
    B_statBox(all.length + ' 件', '收藏总数'),
    B_statBox('¥' + grand.toLocaleString('zh-CN', { maximumFractionDigits: 0 }), '总身价')
  ]));

  // 各分类卡片
  const grid = UI.el('div', { class: 'cat-stats' });
  totals.forEach((t) => {
    const pct = Math.round((t.value / maxVal) * 100);
    const share = grand ? Math.round((t.value / grand) * 100) : 0;
    grid.appendChild(UI.el('div', { class: 'cs-card' }, [
      UI.el('div', { class: 'cs-top' }, [
        UI.el('span', { class: 'cs-dot', style: 'background:' + colors[t.cat] + ';' }),
        UI.el('span', { class: 'cs-cat' }, t.cat),
        UI.el('span', { class: 'cs-count' }, t.count + ' 件')
      ]),
      UI.el('div', { class: 'cs-value' }, '¥' + t.value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })),
      UI.el('div', { class: 'cs-bar-wrap' }, UI.el('div', { class: 'cs-bar', style: 'width:' + pct + '%;background:' + colors[t.cat] + ';' })),
      UI.el('div', { class: 'cs-share' }, '占总额 ' + share + '%')
    ]));
  });
  wrap.appendChild(grid);

  if (!all.length) {
    wrap.appendChild(UI.el('div', { class: 'empty', style: 'margin-top:14px;' }, [UI.el('div', { class: 'em-ico', html: svg('bjd') }), UI.el('div', { style: 'margin-top:8px;' }, '还没有收藏，先去添加吧 💕')]));
  }
}

/* 心愿单视图 */
function renderWishlist(wrap, wishes) {
  const total = wishes.reduce((s, w) => s + (parseFloat(w.price) || 0), 0);
  wrap.appendChild(UI.el('div', { class: 'stat-row', style: 'margin-bottom:14px;' }, [
    B_statBox(wishes.length + ' 项', '心愿单'),
    B_statBox('¥' + total.toLocaleString('zh-CN', { maximumFractionDigits: 0 }), '预估总花费')
  ]));
  wrap.appendChild(UI.el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:14px;', onclick: () => wishForm(null) }, [svg('add'), '添加心愿']));
  if (wishes.length) {
    const grid = UI.el('div', { class: 'bjd-grid' });
    wishes.forEach((w) => grid.appendChild(wishCard(w)));
    wrap.appendChild(grid);
  } else {
    wrap.appendChild(UI.el('div', { class: 'empty' }, [UI.el('div', { class: 'em-ico', html: svg('heart') }), UI.el('div', { style: 'margin-top:8px;' }, '心愿单还是空的，把想要的娃加进来吧 💕')]));
  }
}

function wishCard(w) {
  const card = UI.el('div', { class: 'bjd-card' });
  card.appendChild(UI.el('div', { class: 'thumb', html: svg('heart'), style: 'background:#FDEAF1;color:#FF6B9D;' }));
  card.appendChild(UI.el('div', { class: 'info' }, [
    UI.el('div', { class: 'nm' }, [w.name || '未命名', UI.el('span', { class: 'badge cat' }, (w.category || '娃头'))]),
    UI.el('div', { class: 'meta' }, [
      UI.el('div', {}, '娃社：' + (w.company || '—')),
      UI.el('div', {}, '尺寸：' + (w.size || '—') + ' · 预估 ' + (w.price ? '¥' + w.price : '—'))
    ])
  ]));
  card.appendChild(UI.el('div', { class: 'acts' }, [
    UI.el('button', { class: 'btn btn-sm', onclick: () => moveWishToDoll(w) }, '加入收藏'),
    UI.el('button', { class: 'icon-btn', title: '删除', html: svg('trash'), onclick: (e) => { e.stopPropagation(); delWish(w); } })
  ]));
  return card;
}

function moveWishToDoll(w) {
  _wishToRemoveOnSave = w.id;
  dollForm(null, w.category, { name: w.name, category: w.category, company: w.company, size: w.size, price: w.price, note: w.note, status: '未收到' });
}

function delWish(w) {
  UI.confirm('删除心愿', '确定从心愿单删除「' + (w.name || '该项') + '」吗？').then((ok) => {
    if (!ok) return;
    Store.remove('wishes', w.id);
    UI.toast('已删除'); window.rerenderCurrent();
  });
}

function wishForm(existing) {
  const isEdit = !!existing;
  const body = UI.el('div', {}, [
    B_field('名字', UI.el('input', { type: 'text', id: 'w-name', value: existing ? (existing.name || '') : '', placeholder: '想要的娃' })),
    UI.el('div', { class: 'field' }, [
      UI.el('label', {}, '分类'),
      UI.el('select', { id: 'w-cat' }, CATS.map((c) => UI.el('option', { value: c, selected: ((existing ? existing.category : '娃头') === c) ? '' : null }, c)))
    ]),
    UI.el('div', { class: 'row' }, [
      B_field('娃社', UI.el('input', { type: 'text', id: 'w-company', value: existing ? (existing.company || '') : '', placeholder: '如 娃社名' })),
      B_field('尺寸', UI.el('input', { type: 'text', id: 'w-size', value: existing ? (existing.size || '') : '', placeholder: '如 1/4 / 60cm' }))
    ]),
    UI.el('div', { class: 'row' }, [
      B_field('预估价格 (¥)', UI.el('input', { type: 'number', id: 'w-price', min: '0', step: '1', value: existing ? (existing.price || '') : '', placeholder: '选填' }))
    ]),
    B_field('备注', UI.el('textarea', { id: 'w-note', rows: '2', placeholder: '可选' }, existing ? (existing.note || '') : ''))
  ]);
  UI.openModal({
    title: isEdit ? '编辑心愿' : '添加心愿', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: isEdit ? '保存' : '添加', kind: 'btn-primary', onClick: (c) => {
        const name = document.getElementById('w-name').value.trim();
        if (!name) { UI.toast('请填写名字'); return; }
        const obj = {
          name,
          category: document.getElementById('w-cat').value,
          company: document.getElementById('w-company').value.trim(),
          size: document.getElementById('w-size').value.trim(),
          price: document.getElementById('w-price').value || '',
          note: document.getElementById('w-note').value.trim()
        };
        if (isEdit) Store.update('wishes', existing.id, obj); else Store.add('wishes', obj);
        UI.toast('已保存 💕'); c(); window.rerenderCurrent();
      } }
    ]
  });
}

const CATS = ['娃头', '假发', '娃体', '娃衣', '其他'];
const PHYSICAL_CATS = ['娃头', '假发', '娃体']; // 仅这些分类显示 肤色/头围/脖围/性别
let _filter = '全部';
let _bjdStatusFilter = '全部';
let _wishToRemoveOnSave = null;

let _urls = [];
function revokeAll() { _urls.forEach((u) => URL.revokeObjectURL(u)); _urls = []; }
window.__bjdRevoke = revokeAll;
function thumbURL(id, cb) { DB.getURL(id).then((u) => { if (u) { _urls.push(u); cb(u); } }); }

function dollCard(d) {
  const card = UI.el('div', { class: 'bjd-card' });
  const thumb = UI.el('div', { class: 'thumb', html: svg('bjd') });
  if (d.photos && d.photos.length) thumbURL(d.photos[0], (u) => { thumb.innerHTML = ''; const img = UI.el('img', { src: u, alt: d.name }); thumb.appendChild(img); });
  card.appendChild(thumb);
  const statusColor = { '已收到': '#6BCB9C', '定金中': '#FFC46B', '未收到': '#B0B7C3' }[d.status || '未收到'];
  card.appendChild(UI.el('div', { class: 'info' }, [
    UI.el('div', { class: 'nm' }, [
      d.name || '未命名',
      UI.el('span', { class: 'badge cat' }, (d.category || '娃头')),
      d.status ? UI.el('span', { style: 'margin-left:6px;font-size:11px;padding:2px 8px;border-radius:999px;background:' + statusColor + ';color:#fff;font-weight:700;' }, d.status) : null
    ]),
    UI.el('div', { class: 'meta' }, [
      UI.el('div', {}, '娃社：' + (d.company || '—')),
      UI.el('div', {}, '尺寸：' + (d.size || '—') + ' · 肤色：' + (d.skin || '—')),
      UI.el('div', {}, '价格：' + (d.price ? '¥' + d.price : '—'))
    ])
  ]));
  card.addEventListener('click', () => dollDetail(d));
  card.appendChild(UI.el('div', { class: 'acts' }, [
    UI.el('button', { class: 'btn btn-sm', onclick: (e) => { e.stopPropagation(); dollForm(d); } }, '编辑'),
    UI.el('button', { class: 'icon-btn', title: '删除', html: svg('trash'), onclick: (e) => { e.stopPropagation(); delDoll(d); } })
  ]));
  return card;
}

function dollDetail(d) {
  const body = UI.el('div', {});
  // 照片网格（统一尺寸）
  if (d.photos && d.photos.length) {
    const grid = UI.el('div', { class: 'photo-grid' });
    d.photos.forEach((pid) => thumbURL(pid, (u) => {
      const ph = UI.el('div', { class: 'pg-item' }, UI.el('img', { src: u, alt: d.name }));
      ph.addEventListener('click', () => openPhotoViewer(d.photos, pid));
      grid.appendChild(ph);
    }));
    body.appendChild(grid);
  } else {
    body.appendChild(UI.el('div', { class: 'muted', style: 'padding:8px 0;' }, '暂无照片'));
  }
  body.appendChild(UI.el('hr', { class: 'sep' }));
  const statusText = d.status || '未收到';
  const info = [
    ['名字', d.name], ['分类', d.category || '娃头'], ['状态', statusText], ['娃社', d.company], ['尺寸', d.size], ['肤色', d.skin],
    ['头围', d.headCirc ? d.headCirc + ' cm' : ''], ['脖围', d.neckCirc ? d.neckCirc + ' cm' : ''],
    ['价格', d.price ? '¥' + d.price : ''], ['性别', d.gender], ['入手日期', d.acquired], ['备注', d.note]
  ];
  info.forEach(([k, v]) => {
    if (!v) return;
    body.appendChild(UI.el('div', { style: 'display:flex;gap:10px;padding:5px 0;' }, [
      UI.el('div', { class: 'muted', style: 'width:80px;flex:none;' }, k),
      UI.el('div', { style: 'font-weight:600;' }, String(v))
    ]));
  });
  UI.openModal({
    title: d.name || '娃娃详情', body,
    actions: [
      { text: '关闭', kind: 'btn-ghost' },
      { text: '删除', kind: 'btn-danger', onClick: (c) => { c(); delDoll(d); } },
      { text: '编辑', kind: 'btn-primary', onClick: (c) => { c(); dollForm(d); } }
    ]
  });
}

/* 照片灯箱查看器（现复用 UI.photoViewer） */
function openPhotoViewer(photoIds, currentId) {
  UI.photoViewer(photoIds, currentId);
}

function dollForm(existing, defaultCat, prefill) {
  const isEdit = !!existing;
  const init = prefill || (existing || {});
  const initCat = existing ? existing.category : (defaultCat || (prefill && prefill.category) || '娃头');
  let localPhotos = existing && existing.photos ? existing.photos.slice() : [];

  const photoBox = UI.el('div', {});
  const fileInput = UI.el('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none' });
  fileInput.addEventListener('change', async () => {
    for (const f of Array.from(fileInput.files)) {
      try {
        const id = Store.uid();
        const blob = await DB.fileToBlob(f, 1000, 0.82);
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
      thumbURL(pid, (u) => {
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
    B_field('名字', UI.el('input', { type: 'text', id: 'd-name', value: init.name || '', placeholder: '给娃起个名字' })),
    UI.el('div', { class: 'field' }, [
      UI.el('label', {}, '分类'),
      UI.el('select', { id: 'd-cat' }, CATS.map((c) => UI.el('option', { value: c, selected: (initCat === c) ? '' : null }, c)))
    ]),
    UI.el('div', { class: 'row' }, [
      B_field('娃社', UI.el('input', { type: 'text', id: 'd-company', value: init.company || '', placeholder: '如 娃社名' })),
      B_field('尺寸', UI.el('input', { type: 'text', id: 'd-size', value: init.size || '', placeholder: '如 1/4 / 60cm' }))
    ]),
    B_field('价格 (¥)', UI.el('input', { type: 'number', id: 'd-price', min: '0', step: '1', value: init.price || '', placeholder: '选填' })),
    // 身体属性：仅 娃头/假发/娃体 显示，娃衣/其他 隐藏
    UI.el('div', { id: 'd-physical' }, [
      B_field('肤色', UI.el('input', { type: 'text', id: 'd-skin', value: init.skin || '', placeholder: '如 粉白 / 小麦' })),
      UI.el('div', { class: 'row' }, [
        B_field('头围 (cm)', UI.el('input', { type: 'text', id: 'd-headcirc', inputmode: 'text', value: init.headCirc || '', placeholder: '如 22-23（弹力发网可填范围）' })),
        B_field('脖围 (cm)', UI.el('input', { type: 'text', id: 'd-neckcirc', inputmode: 'text', value: init.neckCirc || '', placeholder: '如 12-13' }))
      ]),
      B_field('性别', UI.el('select', { id: 'd-gender' }, [
        UI.el('option', { value: '' }, '不填'),
        UI.el('option', { value: '女', selected: init.gender === '女' ? '' : null }, '女'),
        UI.el('option', { value: '男', selected: init.gender === '男' ? '' : null }, '男'),
        UI.el('option', { value: '其他', selected: init.gender === '其他' ? '' : null }, '其他')
      ]))
    ]),
    UI.el('div', { class: 'row' }, [
      B_field('状态', UI.el('select', { id: 'd-status' }, [
        UI.el('option', { value: '未收到', selected: (init.status || '未收到') === '未收到' ? '' : null }, '未收到'),
        UI.el('option', { value: '定金中', selected: (init.status || '未收到') === '定金中' ? '' : null }, '定金中'),
        UI.el('option', { value: '已收到', selected: (init.status || '未收到') === '已收到' ? '' : null }, '已收到')
      ])),
      B_field('入手日期', UI.el('input', { type: 'date', id: 'd-acquired', value: init.acquired || '' }))
    ]),
    B_field('备注', UI.el('textarea', { id: 'd-note', rows: '2', placeholder: '可选' }, init.note || '')),
    UI.el('div', { class: 'field' }, [UI.el('label', {}, '照片'), photoBox])
  ]);

  // 根据分类切换身体属性字段显隐
  const catSel = body.querySelector('#d-cat');
  const phys = body.querySelector('#d-physical');
  function togglePhys() { phys.style.display = PHYSICAL_CATS.includes(catSel.value) ? '' : 'none'; }
  catSel.addEventListener('change', togglePhys);
  togglePhys();

  UI.openModal({
    title: isEdit ? '编辑娃娃' : '添加娃娃', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: isEdit ? '保存' : '添加', kind: 'btn-primary', onClick: (c) => {
        const name = document.getElementById('d-name').value.trim();
        if (!name) { UI.toast('请填写名字'); return; }
        const obj = {
          name,
          category: document.getElementById('d-cat').value,
          company: document.getElementById('d-company').value.trim(),
          size: document.getElementById('d-size').value.trim(),
          skin: document.getElementById('d-skin').value.trim(),
          headCirc: document.getElementById('d-headcirc').value || '',
          neckCirc: document.getElementById('d-neckcirc').value || '',
          price: document.getElementById('d-price').value || '',
          gender: document.getElementById('d-gender').value,
          status: document.getElementById('d-status').value,
          acquired: document.getElementById('d-acquired').value,
          note: document.getElementById('d-note').value.trim(),
          photos: localPhotos.slice()
        };
        if (isEdit) {
          // 删除已移除的照片
          const removed = (existing.photos || []).filter((p) => !localPhotos.includes(p));
          removed.forEach((p) => DB.del(p));
          Store.update('dolls', existing.id, obj);
        } else {
          Store.add('dolls', obj);
          // 若来自心愿单，保存后移除对应心愿
          if (_wishToRemoveOnSave) { Store.remove('wishes', _wishToRemoveOnSave); _wishToRemoveOnSave = null; }
        }
        UI.toast('已保存 💕'); c(); window.rerenderCurrent();
      } }
    ]
  });
}

function delDoll(d) {
  UI.confirm('删除娃娃', '确定删除「' + (d.name || '该娃娃') + '」及其所有照片吗？').then((ok) => {
    if (!ok) return;
    (d.photos || []).forEach((p) => DB.del(p));
    Store.remove('dolls', d.id);
    UI.toast('已删除'); window.rerenderCurrent();
  });
}

function B_field(label, input) { return UI.el('div', { class: 'field' }, [UI.el('label', {}, label), input]); }
function B_statBox(v, l) { return UI.el('div', { class: 'stat-box' }, [UI.el('div', { class: 'v' }, v), UI.el('div', { class: 'l' }, l)]); }
