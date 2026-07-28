/* BJD 娃娃收藏：基础信息 + 照片（IndexedDB 存储），支持增删改 */
window.BjdView = {
  register() {
    registerView('bjd', (root) => {
      const dolls = Store.getArr('dolls').slice().sort((a, b) => (b.acquired || '').localeCompare(a.acquired || '') || a.name.localeCompare(b.name));
      const wrap = UI.el('div', {});

      // 统计
      const total = dolls.reduce((s, d) => s + (parseFloat(d.price) || 0), 0);
      wrap.appendChild(UI.el('div', { class: 'stat-row', style: 'margin-bottom:14px;' }, [
        B_statBox(dolls.length + ' 只', '收藏数量'),
        B_statBox('¥' + total.toLocaleString('zh-CN', { maximumFractionDigits: 0 }), '总身价')
      ]));

      wrap.appendChild(UI.el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:14px;', onclick: () => dollForm(null) }, [svg('add'), '添加娃娃']));

      if (dolls.length) {
        const grid = UI.el('div', { class: 'bjd-grid' });
        dolls.forEach((d) => grid.appendChild(dollCard(d)));
        wrap.appendChild(grid);
      } else {
        wrap.appendChild(UI.el('div', { class: 'empty' }, [UI.el('div', { class: 'em-ico', html: svg('bjd') }), UI.el('div', { style: 'margin-top:8px;' }, '还没有娃娃档案，点上面按钮添加你的第一只娃吧 💕')]));
      }
      root.appendChild(wrap);

      // 退出时回收缩略图 URL
      window._bjdRevoke = () => revokeAll();
    });
  }
};

let _urls = [];
function revokeAll() { _urls.forEach((u) => URL.revokeObjectURL(u)); _urls = []; }
window.__bjdRevoke = revokeAll;
function thumbURL(id, cb) { DB.getURL(id).then((u) => { if (u) { _urls.push(u); cb(u); } }); }

function dollCard(d) {
  const card = UI.el('div', { class: 'bjd-card' });
  const thumb = UI.el('div', { class: 'thumb', html: svg('bjd') });
  if (d.photos && d.photos.length) thumbURL(d.photos[0], (u) => { thumb.innerHTML = ''; const img = UI.el('img', { src: u, alt: d.name }); thumb.appendChild(img); });
  card.appendChild(thumb);
  card.appendChild(UI.el('div', { class: 'info' }, [
    UI.el('div', { class: 'nm' }, d.name || '未命名'),
    UI.el('div', { class: 'meta' }, [
      UI.el('div', {}, '娃社：' + (d.company || '—')),
      UI.el('div', {}, '尺寸：' + (d.size || '—') + ' · 肤色：' + (d.skin || '—')),
      UI.el('div', {}, '价格：' + (d.price ? '¥' + d.price : '—'))
    ])
  ]));
  card.appendChild(UI.el('div', { class: 'acts' }, [
    UI.el('button', { class: 'btn btn-sm', onclick: () => dollDetail(d) }, '查看'),
    UI.el('button', { class: 'btn btn-sm', onclick: () => dollForm(d) }, [svg('edit')]),
    UI.el('button', { class: 'icon-btn', title: '删除', html: svg('trash'), onclick: (e) => { e.stopPropagation(); delDoll(d); } })
  ]));
  card.addEventListener('click', (e) => { if (e.target.closest('.acts')) return; dollDetail(d); });
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
  const info = [
    ['名字', d.name], ['娃社', d.company], ['尺寸', d.size], ['肤色', d.skin],
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

/* 照片灯箱查看器 */
function openPhotoViewer(photoIds, currentId) {
  const mask = UI.el('div', { class: 'photo-viewer' });
  let idx = Math.max(0, photoIds.indexOf(currentId));
  const imgWrap = UI.el('div', { class: 'pv-img-wrap' });
  const counter = UI.el('div', { class: 'pv-counter' });
  function show() {
    imgWrap.innerHTML = '';
    thumbURL(photoIds[idx], (u) => {
      imgWrap.appendChild(UI.el('img', { src: u, class: 'pv-img' }));
    });
    counter.textContent = (idx + 1) + ' / ' + photoIds.length;
  }
  show();
  const prevBtn = UI.el('button', { class: 'pv-nav pv-prev', html: svg('back') });
  const nextBtn = UI.el('button', { class: 'pv-nav pv-next', html: svg('chevron') });
  const closeBtn = UI.el('button', { class: 'pv-close', html: svg('close') });
  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); idx = (idx - 1 + photoIds.length) % photoIds.length; show(); });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); idx = (idx + 1) % photoIds.length; show(); });
  closeBtn.addEventListener('click', () => mask.remove());
  mask.addEventListener('click', (e) => { if (e.target === mask) mask.remove(); });
  mask.appendChild(closeBtn);
  mask.appendChild(prevBtn);
  mask.appendChild(imgWrap);
  mask.appendChild(nextBtn);
  mask.appendChild(counter);
  document.body.appendChild(mask);
}

function dollForm(existing) {
  const isEdit = !!existing;
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
    B_field('名字', UI.el('input', { type: 'text', id: 'd-name', value: existing ? (existing.name || '') : '', placeholder: '给娃起个名字' })),
    UI.el('div', { class: 'row' }, [
      B_field('娃社', UI.el('input', { type: 'text', id: 'd-company', value: existing ? (existing.company || '') : '', placeholder: '如 娃社名' })),
      B_field('尺寸', UI.el('input', { type: 'text', id: 'd-size', value: existing ? (existing.size || '') : '', placeholder: '如 1/4 / 60cm' }))
    ]),
    UI.el('div', { class: 'row' }, [
      B_field('肤色', UI.el('input', { type: 'text', id: 'd-skin', value: existing ? (existing.skin || '') : '', placeholder: '如 粉白 / 小麦' })),
      B_field('价格 (¥)', UI.el('input', { type: 'number', id: 'd-price', min: '0', step: '1', value: existing ? (existing.price || '') : '', placeholder: '选填' }))
    ]),
    UI.el('div', { class: 'row' }, [
      B_field('头围 (cm)', UI.el('input', { type: 'number', id: 'd-headcirc', step: '0.1', min: '0', value: existing ? (existing.headCirc || '') : '', placeholder: '选填' })),
      B_field('脖围 (cm)', UI.el('input', { type: 'number', id: 'd-neckcirc', step: '0.1', min: '0', value: existing ? (existing.neckCirc || '') : '', placeholder: '选填' }))
    ]),
    UI.el('div', { class: 'row' }, [
      B_field('性别', UI.el('select', { id: 'd-gender' }, [
        UI.el('option', { value: '' }, '不填'),
        UI.el('option', { value: '女', selected: existing && existing.gender === '女' ? '' : null }, '女'),
        UI.el('option', { value: '男', selected: existing && existing.gender === '男' ? '' : null }, '男'),
        UI.el('option', { value: '其他', selected: existing && existing.gender === '其他' ? '' : null }, '其他')
      ])),
      B_field('入手日期', UI.el('input', { type: 'date', id: 'd-acquired', value: existing ? (existing.acquired || '') : '' }))
    ]),
    B_field('备注', UI.el('textarea', { id: 'd-note', rows: '2', placeholder: '可选' }, existing ? (existing.note || '') : '')),
    UI.el('div', { class: 'field' }, [UI.el('label', {}, '照片'), photoBox])
  ]);

  UI.openModal({
    title: isEdit ? '编辑娃娃' : '添加娃娃', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: isEdit ? '保存' : '添加', kind: 'btn-primary', onClick: (c) => {
        const name = document.getElementById('d-name').value.trim();
        if (!name) { UI.toast('请填写名字'); return; }
        const obj = {
          name,
          company: document.getElementById('d-company').value.trim(),
          size: document.getElementById('d-size').value.trim(),
          skin: document.getElementById('d-skin').value.trim(),
          headCirc: document.getElementById('d-headcirc').value || '',
          neckCirc: document.getElementById('d-neckcirc').value || '',
          price: document.getElementById('d-price').value || '',
          gender: document.getElementById('d-gender').value,
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
