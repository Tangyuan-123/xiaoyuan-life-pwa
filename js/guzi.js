/* 谷子助手：按「角色」分类管理谷子（吧唧/立牌/色纸等），支持照片（原图存储，灯箱看大图不裁切） */
window.GuziView = {
  register() {
    registerView('guzi', (root) => {
      const all = Store.getArr('guzi');
      const wrap = UI.el('div', {});

      // 角色标签：由数据中的「角色」去重自动生成
      const chars = [];
      all.forEach((g) => { const c = (g.character || '').trim(); if (c && !chars.includes(c)) chars.push(c); });
      const tabs = UI.el('div', { class: 'cat-tabs', style: 'margin-bottom:14px;' });
      const TABS = ['全部'].concat(chars);
      TABS.forEach((cat) => {
        const count = cat === '全部' ? all.length : all.filter((g) => (g.character || '') === cat).length;
        tabs.appendChild(UI.el('button', {
          class: 'cat-tab' + (cat === _guziFilter ? ' active' : ''),
          onclick: () => { _guziFilter = cat; window.rerenderCurrent(); }
        }, (cat === '全部' ? '全部 ' : (cat + ' ')) + count));
      });
      wrap.appendChild(tabs);

      const items = all.slice()
        .filter((g) => _guziFilter === '全部' || (g.character || '') === _guziFilter);

      // 统计
      const total = items.reduce((s, g) => s + (parseFloat(g.price) || 0), 0);
      wrap.appendChild(UI.el('div', { class: 'stat-row', style: 'margin-bottom:14px;' }, [
        guziStatBox(items.length + ' 件', _guziFilter === '全部' ? '全部谷子' : _guziFilter),
        guziStatBox('¥' + total.toLocaleString('zh-CN', { maximumFractionDigits: 0 }), '总花费')
      ]));

      wrap.appendChild(UI.el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:14px;', onclick: () => guziForm(null) }, [svg('add'), '添加谷子']));

      if (items.length) {
        const grid = UI.el('div', { class: 'bjd-grid' });
        items.forEach((g) => grid.appendChild(guziCard(g)));
        wrap.appendChild(grid);
      } else {
        wrap.appendChild(UI.el('div', { class: 'empty' }, [UI.el('div', { class: 'em-ico', html: svg('guzi') }), UI.el('div', { style: 'margin-top:8px;' }, '还没有谷子，点上面按钮加一个吧 💕')]));
      }
      root.appendChild(wrap);
      window.__guziRevoke = () => guziRevokeAll();
    });
  }
};

const GUZI_TYPES = ['吧唧', '亚克力立牌', '色纸', '挂件', '手办', '其他'];
let _guziFilter = '全部';

let _guziUrls = [];
function guziRevokeAll() { _guziUrls.forEach((u) => URL.revokeObjectURL(u)); _guziUrls = []; }
function guziThumbURL(id, cb) { DB.getURL(id).then((u) => { if (u) { _guziUrls.push(u); cb(u); } }); }

function guziCard(g) {
  const card = UI.el('div', { class: 'bjd-card' });
  const thumb = UI.el('div', { class: 'thumb', html: svg('guzi') });
  if (g.photos && g.photos.length) guziThumbURL(g.photos[0], (u) => { thumb.innerHTML = ''; const img = UI.el('img', { src: u, alt: g.name }); thumb.appendChild(img); });
  card.appendChild(thumb);
  const recvColor = (g.received === '已到手') ? '#6BCB9C' : '#B0B7C3';
  card.appendChild(UI.el('div', { class: 'info' }, [
    UI.el('div', { class: 'nm' }, [
      g.name || '未命名',
      UI.el('span', { class: 'badge cat' }, (g.character || '未分类')),
      UI.el('span', { style: 'margin-left:6px;font-size:11px;padding:2px 8px;border-radius:999px;background:' + recvColor + ';color:#fff;font-weight:700;' }, g.received || '未到手')
    ]),
    UI.el('div', { class: 'meta' }, [
      UI.el('div', {}, '种类：' + (g.type || '—')),
      UI.el('div', {}, '价格：' + (g.price ? '¥' + g.price : '—'))
    ])
  ]));
  card.addEventListener('click', () => guziDetail(g));
  return card;
}

function guziDetail(g) {
  const body = UI.el('div', {});
  if (g.photos && g.photos.length) {
    const grid = UI.el('div', { class: 'photo-grid' });
    g.photos.forEach((pid) => guziThumbURL(pid, (u) => {
      const ph = UI.el('div', { class: 'pg-item' }, UI.el('img', { src: u, alt: g.name }));
      ph.addEventListener('click', () => UI.photoViewer(g.photos, pid));
      grid.appendChild(ph);
    }));
    body.appendChild(grid);
  } else {
    body.appendChild(UI.el('div', { class: 'muted', style: 'padding:8px 0;' }, '暂无照片'));
  }
  body.appendChild(UI.el('hr', { class: 'sep' }));
  const info = [
    ['名称', g.name], ['角色', g.character], ['种类', g.type], ['是否已到手', g.received || '未到手'],
    ['价格', g.price ? '¥' + g.price : ''], ['入手日期', g.date], ['备注', g.note]
  ];
  info.forEach(([k, v]) => {
    if (!v) return;
    body.appendChild(UI.el('div', { style: 'display:flex;gap:10px;padding:5px 0;' }, [
      UI.el('div', { class: 'muted', style: 'width:80px;flex:none;' }, k),
      UI.el('div', { style: 'font-weight:600;' }, String(v))
    ]));
  });
  UI.openModal({
    title: g.name || '谷子详情', body,
    actions: [
      { text: '关闭', kind: 'btn-ghost' },
      { text: '删除', kind: 'btn-danger', onClick: (c) => { c(); guziDelGuzi(g); } },
      { text: '编辑', kind: 'btn-primary', onClick: (c) => { c(); guziForm(g); } }
    ]
  });
}

function guziForm(existing) {
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
      guziThumbURL(pid, (u) => {
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

  // 已有角色快速选择（点击填入输入框）
  const allChars = [];
  Store.getArr('guzi').forEach((g) => { const c = (g.character || '').trim(); if (c && !allChars.includes(c)) allChars.push(c); });
  if (isEdit && init.character && !allChars.includes(init.character)) allChars.unshift(init.character);

  const body = UI.el('div', {}, [
    guziField('名称', UI.el('input', { type: 'text', id: 'g-name', value: init.name || '', placeholder: '谷子名称' })),
    guziField('角色', (function () {
      const wrap = UI.el('div', {});
      const input = UI.el('input', { type: 'text', id: 'g-char', value: init.character || '', placeholder: '如 原神-钟离 / 单独角色名' });
      wrap.appendChild(input);
      if (allChars.length) {
        const chips = UI.el('div', { class: 'chips', style: 'margin-top:8px;' });
        allChars.forEach((c) => {
          chips.appendChild(UI.el('button', { type: 'button', class: 'chip', onclick: () => { input.value = c; } }, c));
        });
        wrap.appendChild(chips);
      }
      return wrap;
    })()),
    UI.el('div', { class: 'row' }, [
      guziField('种类', UI.el('select', { id: 'g-type' }, GUZI_TYPES.map((t) => UI.el('option', { value: t, selected: (init.type || '吧唧') === t ? '' : null }, t)))),
      guziField('价格 (¥)', UI.el('input', { type: 'number', id: 'g-price', min: '0', step: '1', value: init.price || '', placeholder: '选填' }))
    ]),
    UI.el('div', { class: 'row' }, [
      guziField('是否已到手', UI.el('select', { id: 'g-received' }, [
        UI.el('option', { value: '未到手', selected: (init.received || '未到手') === '未到手' ? '' : null }, '未到手'),
        UI.el('option', { value: '已到手', selected: (init.received || '未到手') === '已到手' ? '' : null }, '已到手')
      ])),
      guziField('入手日期', UI.el('input', { type: 'date', id: 'g-date', value: init.date || '' }))
    ]),
    guziField('备注', UI.el('textarea', { id: 'g-note', rows: '2', placeholder: '可选' }, init.note || '')),
    UI.el('div', { class: 'field' }, [UI.el('label', {}, '添加照片'), photoBox])
  ]);

  UI.openModal({
    title: isEdit ? '编辑谷子' : '添加谷子', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: isEdit ? '保存' : '添加', kind: 'btn-primary', onClick: (c) => {
        const name = document.getElementById('g-name').value.trim();
        if (!name) { UI.toast('请填写名称'); return; }
        const character = document.getElementById('g-char').value.trim();
        if (!character) { UI.toast('请填写角色'); return; }
        const obj = {
          name,
          character,
          type: document.getElementById('g-type').value,
          price: document.getElementById('g-price').value || '',
          received: document.getElementById('g-received').value,
          date: document.getElementById('g-date').value,
          note: document.getElementById('g-note').value.trim(),
          photos: localPhotos.slice()
        };
        if (isEdit) {
          const removed = (existing.photos || []).filter((p) => !localPhotos.includes(p));
          removed.forEach((p) => DB.del(p));
          Store.update('guzi', existing.id, obj);
        } else {
          Store.add('guzi', obj);
        }
        UI.toast('已保存 💕'); c(); window.rerenderCurrent();
      } }
    ]
  });
}

function guziDelGuzi(g) {
  UI.confirm('删除谷子', '确定删除「' + (g.name || '该谷子') + '」及其所有照片吗？').then((ok) => {
    if (!ok) return;
    (g.photos || []).forEach((p) => DB.del(p));
    Store.remove('guzi', g.id);
    UI.toast('已删除'); window.rerenderCurrent();
  });
}

function guziField(label, input) { return UI.el('div', { class: 'field' }, [UI.el('label', {}, label), input]); }
function guziStatBox(v, l) { return UI.el('div', { class: 'stat-box' }, [UI.el('div', { class: 'v' }, v), UI.el('div', { class: 'l' }, l)]); }
