/* 减肥助手：体重记录 + 多组围度记录，折线图，全屏横屏 */
window.WeightView = {
  register() {
    registerView('weight', (root) => {
      const wrap = UI.el('div', {});
      wrap.appendChild(UI.el('div', { class: 'seg', id: 'w-seg' }, [
        segBtn('weight', '体重', true),
        segBtn('circ', '围度', false)
      ]));
      const panel = UI.el('div', { style: 'margin-top:16px;' });
      wrap.appendChild(panel);
      root.appendChild(wrap);

      let tab = 'weight';
      function segBtn(key, label, active) {
        return UI.el('button', {
          class: (active ? 'active' : ''), 'data-tab': key,
          onclick: () => {
            tab = key;
            wrap.querySelectorAll('#w-seg button').forEach((b) => b.classList.toggle('active', b.dataset.tab === key));
            renderPanel();
          }
        }, label);
      }
      function renderPanel() { panel.innerHTML = ''; (tab === 'weight' ? renderWeight : renderCirc)(panel); }
      renderPanel();
    });
  }
};

/* ---------- 体重 ---------- */
function renderWeight(root) {
  const recs = Store.getArr('weight').slice().sort((a, b) => a.date.localeCompare(b.date));

  // 减肥计划卡片（目标体重 / 初始体重 / 目标日期 / 进度）
  const target = Store.data.targetWeight;
  const lastRec = recs.length ? recs[recs.length - 1] : null;
  const startWeight = Store.data.initialWeight != null ? Store.data.initialWeight : (recs.length ? recs[0].value : null);
  // 进度计算
  let progress = null; // 0~100
  if (target != null && startWeight != null && lastRec && startWeight > target) {
    const lost = startWeight - lastRec.value;
    const total = startWeight - target;
    progress = Math.max(0, Math.min(100, Math.round((lost / total) * 100)));
  }
  const targetCard = UI.el('div', { class: 'card', style: 'margin-bottom:14px;' }, [
    UI.el('div', { class: 'card-title' }, [svg('target'), '减肥计划']),
    target ? (() => {
      const remaining = lastRec ? (lastRec.value - target) : null;
      const done = remaining != null && remaining <= 0;
      const block = UI.el('div', { style: 'flex:1;' }, [
        UI.el('div', { style: 'font-size:20px;font-weight:800;' },
          target + ' kg' + (startWeight != null ? ' · 从 ' + startWeight + ' kg' : '')),
        UI.el('div', { class: 'muted', style: 'font-size:13px;margin-bottom:8px;' },
          done ? '已达成目标，太棒了 🎉' : (remaining != null ? '还差 ' + remaining.toFixed(1) + ' kg' : '记录体重后显示进度'))
      ]);
      // 进度条
      if (progress != null) {
        block.appendChild(UI.el('div', { class: 'progress', style: 'margin-bottom:6px;' }, [
          UI.el('div', { class: 'progress-fill', style: 'width:' + (done ? 100 : progress) + '%;' })
        ]));
        block.appendChild(UI.el('div', { style: 'display:flex;justify-content:space-between;font-size:12px;' }, [
          UI.el('span', { class: 'muted' }, '减肥进度'),
          UI.el('span', { style: 'font-weight:800;color:var(--primary-deep);' }, (done ? 100 : progress) + '%')
        ]));
      }
      // 目标日期
      if (Store.data.targetDate) {
        const diff = UI.diffDays(UI.today(), Store.data.targetDate);
        const daily = (remaining != null && remaining > 0 && diff > 0) ? (remaining / diff) : null;
        block.appendChild(UI.el('div', { class: 'muted', style: 'font-size:12.5px;margin-top:8px;' },
          diff > 0
            ? '目标日期 ' + UI.fmtMD(Store.data.targetDate) + ' · 还剩 ' + diff + ' 天' + (daily != null ? ' · 日均需减 ' + daily.toFixed(2) + ' kg' : '')
            : '目标日期 ' + UI.fmtMD(Store.data.targetDate) + (diff === 0 ? ' · 就是今天！' : ' · 已过去 ' + (-diff) + ' 天')));
      }
      return UI.el('div', { style: 'display:flex;align-items:flex-start;gap:14px;' }, [
        block,
        UI.el('button', { class: 'btn btn-sm', style: 'flex:none;', onclick: () => setGoal() }, '修改')
      ]);
    })() : UI.el('div', { style: 'display:flex;align-items:center;gap:14px;' }, [
      UI.el('div', { class: 'muted', style: 'flex:1;' }, '还没有设置减肥计划，设一个激励自己吧～'),
      UI.el('button', { class: 'btn btn-sm btn-primary', onclick: () => setGoal() }, '设置计划')
    ])
  ]);
  root.appendChild(targetCard);

  // 概览
  if (recs.length) {
    const first = recs[0].value, last = recs[recs.length - 1].value;
    const diff = (last - first).toFixed(1);
    const bmi = calcBMI(last, Store.data.height);
    const bi = bmi != null ? bmiInfo(bmi) : null;
    const bmiBox = bi ? W_statBox(bmi.toFixed(1), 'BMI · ' + bi.t, bi.c) : W_statBox('设置身高', 'BMI', '#FF6B9D');
    bmiBox.style.cursor = 'pointer';
    bmiBox.title = '点击设置身高';
    bmiBox.onclick = () => setHeight();
    const boxes = UI.el('div', { class: 'stat-row', style: 'margin-bottom:14px;' }, [
      W_statBox(last + ' kg', '当前体重'),
      W_statBox((diff >= 0 ? '+' : '') + diff + ' kg', '累计变化'),
      W_statBox(recs.length + ' 次', '记录次数'),
      bmiBox
    ]);
    root.appendChild(boxes);
    if (bi) root.appendChild(UI.el('div', { class: 'muted', style: 'font-size:12px;margin:-6px 0 12px;' }, '健康区间 BMI 18.5~24（中国标准），当前' + bi.t));
    else root.appendChild(UI.el('div', { class: 'muted', style: 'font-size:12px;margin:-6px 0 12px;cursor:pointer;', onclick: () => setHeight() }, '👆 点击 BMI 卡片设置身高，自动计算 BMI'));
  }

  // 图表
  if (recs.length >= 2) {
    const card = UI.el('div', { class: 'card' }, [
      UI.el('div', { class: 'card-title' }, [document.createTextNode('体重趋势'), UI.el('span', { class: 'badge' }, 'kg')]),
      chartCard([{ name: '体重', color: '#FF6B9D', points: recs.map((r) => ({ x: r.date, y: r.value })) }], 'kg', (s) => buildWeightFS(s))
    ]);
    root.appendChild(card);
  }

  // 记录按钮
  root.appendChild(UI.el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:14px;', onclick: () => weightForm(null) }, [svg('add'), '记录今日体重']));

  // 列表
  if (recs.length) {
    const list = UI.el('div', { class: 'list' });
    recs.slice().reverse().forEach((r) => {
      list.appendChild(UI.el('div', { class: 'list-row' }, [
        UI.el('div', { class: 'lr-main' }, [
          UI.el('div', { class: 'lr-title' }, r.value + ' kg'),
          UI.el('div', { class: 'lr-sub' }, UI.fmtMD(r.date) + ' · ' + UI.weekday(r.date) + (r.note ? ' · ' + r.note : ''))
        ]),
        UI.el('button', { class: 'icon-btn', title: '编辑', html: svg('edit'), onclick: () => weightForm(r) }),
        UI.el('button', { class: 'icon-btn', title: '删除', html: svg('trash'), onclick: () => delWeight(r) })
      ]));
    });
    root.appendChild(list);
  } else {
    root.appendChild(W_empty('weight', '还没有体重记录，点上面按钮开始吧～'));
  }
}

function weightForm(rec) {
  const isEdit = !!rec;
  const body = UI.el('div', {}, [
    W_field('日期', UI.el('input', { type: 'date', id: 'w-date', value: rec ? rec.date : UI.today(), max: UI.today() })),
    W_field('体重 (kg)', UI.el('input', { type: 'number', id: 'w-val', step: '0.1', min: '20', max: '300', value: rec ? rec.value : '', placeholder: '例如 52.5' })),
    W_field('备注（可选）', UI.el('input', { type: 'text', id: 'w-note', value: rec ? (rec.note || '') : '', placeholder: '心情 / 状态' }))
  ]);
  UI.openModal({
    title: isEdit ? '编辑体重' : '记录体重', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: isEdit ? '保存' : '添加', kind: 'btn-primary', onClick: (c) => {
        const v = parseFloat(document.getElementById('w-val').value);
        if (!v || v <= 0) { UI.toast('请输入有效体重'); return; }
        const obj = { date: document.getElementById('w-date').value || UI.today(), value: v, note: document.getElementById('w-note').value.trim() };
        if (isEdit) Store.update('weight', rec.id, obj); else Store.add('weight', obj);
        UI.toast('已保存'); c(); window.rerenderCurrent();
      } }
    ]
  });
}

function delWeight(rec) {
  UI.confirm('删除记录', '确定删除这条体重记录吗？').then((ok) => { if (ok) { Store.remove('weight', rec.id); UI.toast('已删除'); window.rerenderCurrent(); } });
}

function setGoal() {
  const recs = Store.getArr('weight').slice().sort((a, b) => a.date.localeCompare(b.date));
  const body = UI.el('div', {}, [
    W_field('目标体重 (kg)', UI.el('input', { type: 'number', id: 't-weight', step: '0.1', min: '20', max: '300', value: Store.data.targetWeight || '', placeholder: '例如 50.0' })),
    W_field('初始体重 (kg)', UI.el('input', { type: 'number', id: 't-initial', step: '0.1', min: '20', max: '300', value: Store.data.initialWeight != null ? Store.data.initialWeight : (recs.length ? recs[0].value : ''), placeholder: '留空则取最早记录' })),
    W_field('目标日期', UI.el('input', { type: 'date', id: 't-date', value: Store.data.targetDate || '', min: UI.today() }))
  ]);
  UI.openModal({
    title: '设置减肥计划', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: '保存', kind: 'btn-primary', onClick: (c) => {
        const v = parseFloat(document.getElementById('t-weight').value);
        if (!v || v <= 0) { UI.toast('请输入有效目标体重'); return; }
        Store.data.targetWeight = v;
        const ini = document.getElementById('t-initial').value;
        Store.data.initialWeight = ini ? parseFloat(ini) : null;
        const dt = document.getElementById('t-date').value;
        Store.data.targetDate = dt || null;
        Store.save();
        UI.toast('计划已更新'); c(); window.rerenderCurrent();
      } }
    ]
  });
}
// 身高单独设置（BMI 计算依赖，从目标体重弹窗中拆出，避免找不到入口）
function setHeight() {
  const body = UI.el('div', {}, [
    W_field('身高 (cm)', UI.el('input', { type: 'number', id: 'h-height', step: '0.1', min: '100', max: '250', value: Store.data.height || '', placeholder: '例如 165' }))
  ]);
  UI.openModal({
    title: '设置身高', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: '保存', kind: 'btn-primary', onClick: (c) => {
        const h = parseFloat(document.getElementById('h-height').value);
        if (!h || h < 100 || h > 250) { UI.toast('请输入有效身高(100~250cm)'); return; }
        Store.data.height = h; Store.save();
        UI.toast('身高已保存'); c(); window.rerenderCurrent();
      } }
    ]
  });
}

// BMI 计算与健康区间
function calcBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}
function bmiInfo(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return { t: '偏瘦', c: '#5BC8FF' };
  if (bmi < 24) return { t: '正常', c: '#6BCB9C' };
  if (bmi < 28) return { t: '偏胖', c: '#FFC46B' };
  return { t: '肥胖', c: '#FF6B9D' };
}

/* ---------- 围度 ---------- */
function renderCirc(root) {
  const groups = Store.getArr('circGroups');
  const recs = Store.getArr('circ').slice().sort((a, b) => a.date.localeCompare(b.date));

  // 管理分组
  const head = UI.el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:8px;' }, [
    UI.el('span', { class: 'muted', style: 'font-weight:700;' }, '测量分组'),
    UI.el('button', { class: 'btn btn-sm', style: 'margin-left:auto;', onclick: () => manageGroups() }, '管理分组')
  ]);
  root.appendChild(head);
  const chips = UI.el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;' });
  groups.forEach((g) => chips.appendChild(UI.el('span', { class: 'pill' }, [UI.el('span', { class: 'dot', style: 'width:10px;height:10px;border-radius:3px;background:' + g.color + ';display:inline-block;' }), g.name])));
  root.appendChild(chips);

  // 图表（多线）
  if (recs.length >= 2 && groups.length) {
    const series = groups.map((g) => ({
      name: g.name, color: g.color,
      points: recs.map((r) => ({ x: r.date, y: r.values && r.values[g.id] != null ? r.values[g.id] : null })).filter((p) => p.y != null)
    })).filter((s) => s.points.length);
    if (series.length) {
      const card = UI.el('div', { class: 'card' }, [
        UI.el('div', { class: 'card-title' }, [document.createTextNode('围度趋势'), UI.el('span', { class: 'badge' }, 'cm')]),
        chartCard(series, 'cm', (s) => buildCircFS(s))
      ]);
      root.appendChild(card);
    }
  }

  root.appendChild(UI.el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:14px;', onclick: () => circForm(null) }, [svg('add'), '记录围度']));

  if (recs.length) {
    const list = UI.el('div', { class: 'list' });
    recs.slice().reverse().forEach((r) => {
      const vals = groups.filter((g) => r.values && r.values[g.id] != null)
        .map((g) => g.name + ' ' + r.values[g.id] + 'cm').join(' · ');
      list.appendChild(UI.el('div', { class: 'list-row' }, [
        UI.el('div', { class: 'lr-main' }, [
          UI.el('div', { class: 'lr-title' }, UI.fmtMD(r.date)),
          UI.el('div', { class: 'lr-sub' }, vals || '无数据')
        ]),
        UI.el('button', { class: 'icon-btn', title: '编辑', html: svg('edit'), onclick: () => circForm(r) }),
        UI.el('button', { class: 'icon-btn', title: '删除', html: svg('trash'), onclick: () => delCirc(r) })
      ]));
    });
    root.appendChild(list);
  } else {
    root.appendChild(W_empty('weight', '还没有围度记录，至少记录 2 次才能看趋势图～'));
  }
}

function circForm(rec) {
  const isEdit = !!rec;
  const groups = Store.getArr('circGroups');
  const body = UI.el('div', {}, [
    W_field('日期', UI.el('input', { type: 'date', id: 'c-date', value: rec ? rec.date : UI.today(), max: UI.today() }))
  ]);
  groups.forEach((g) => {
    body.appendChild(W_field(g.name + ' (cm)', UI.el('input', {
      type: 'number', step: '0.1', min: '0', max: '300',
      id: 'c-' + g.id, value: rec && rec.values && rec.values[g.id] != null ? rec.values[g.id] : '', placeholder: '选填'
    })));
  });
  UI.openModal({
    title: isEdit ? '编辑围度' : '记录围度', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: isEdit ? '保存' : '添加', kind: 'btn-primary', onClick: (c) => {
        const values = {};
        groups.forEach((g) => { const v = parseFloat(document.getElementById('c-' + g.id).value); if (!isNaN(v) && v > 0) values[g.id] = v; });
        if (!Object.keys(values).length) { UI.toast('至少填一个围度'); return; }
        const obj = { date: document.getElementById('c-date').value || UI.today(), values };
        if (isEdit) Store.update('circ', rec.id, obj); else Store.add('circ', obj);
        UI.toast('已保存'); c(); window.rerenderCurrent();
      } }
    ]
  });
}

function manageGroups() {
  const render = () => {
    const groups = Store.getArr('circGroups');
    const box = UI.el('div', {});
    groups.forEach((g) => {
      box.appendChild(UI.el('div', { class: 'list-row' }, [
        UI.el('span', { class: 'dot', style: 'width:14px;height:14px;border-radius:5px;background:' + g.color + ';display:inline-block;' }),
        UI.el('div', { class: 'lr-main' }, [UI.el('div', { class: 'lr-title' }, g.name)]),
        UI.el('button', { class: 'icon-btn', title: '删除', html: svg('trash'), onclick: () => {
          UI.confirm('删除分组', '删除「' + g.name + '」？已有该分组的记录会保留数值但不再显示。').then((ok) => { if (ok) { Store.remove('circGroups', g.id); renderModal(); } });
        } })
      ]));
    });
    return box;
  };
  let modal;
  const renderModal = () => {
    const b = UI.el('div', {}, [render(), W_field('新增分组名称', UI.el('input', { type: 'text', id: 'ng-name', placeholder: '如 大腿围' }))]);
    modal = UI.openModal({
      title: '测量分组', body: b,
      actions: [
        { text: '关闭', kind: 'btn-ghost' },
        { text: '添加', kind: 'btn-primary', onClick: () => {
          const nm = document.getElementById('ng-name').value.trim();
          if (!nm) { UI.toast('请输入名称'); return; }
          const colors = ['#FF6B9D', '#FFB3CE', '#B388FF', '#6BCB9C', '#FFC46B', '#5BC8FF', '#FF8A8A'];
          Store.add('circGroups', { name: nm, color: colors[Store.getArr('circGroups').length % colors.length] });
          renderModal();
        } }
      ]
    });
  };
  renderModal();
}

function delCirc(rec) {
  UI.confirm('删除记录', '确定删除这条围度记录吗？').then((ok) => { if (ok) { Store.remove('circ', rec.id); UI.toast('已删除'); window.rerenderCurrent(); } });
}

/* ---------- 图表卡片 + 全屏 ---------- */
function chartCard(series, unit, fsBuilder) {
  const wrap = UI.el('div', { class: 'chart-wrap' });
  wrap.appendChild(buildChartSVG(series, unit));
  wrap.appendChild(UI.el('button', { class: 'icon-btn fullscreen-btn', title: '全屏横屏', html: svg('fullscreen'), onclick: () => openFullscreen('趋势图 · ' + unit, series, unit) }));
  return wrap;
}
function buildChartSVG(series, unit) {
  return Chart.render({
    width: 640, height: 300, series, yUnit: unit,
    yFmt: (v) => v.toFixed(1) + (unit || ''),
    xFmt: (x) => (typeof x === 'string' ? x.slice(5) : '')
  });
}
function buildWeightFS(series) { return buildChartSVG(series, 'kg'); }
function buildCircFS(series) { return buildChartSVG(series, 'cm'); }

function openFullscreen(title, series, unit) {
  const layer = document.getElementById('fs-layer');
  document.getElementById('fs-title').textContent = title;
  const body = document.getElementById('fs-body');
  body.innerHTML = '';
  body.appendChild(buildChartSVG(series, unit));
  layer.classList.add('show');
  if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
}
function closeFullscreen() {
  const layer = document.getElementById('fs-layer');
  layer.classList.remove('show');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
}

/* ---------- 小工具 ---------- */
function W_field(label, input) { return UI.el('div', { class: 'field' }, [UI.el('label', {}, label), input]); }
function W_statBox(v, l, color) { return UI.el('div', { class: 'stat-box' }, [UI.el('div', { class: 'v', style: color ? 'color:' + color + ';' : '' }, v), UI.el('div', { class: 'l' }, l)]); }
function W_empty(icon, text) {
  return UI.el('div', { class: 'empty' }, [UI.el('div', { class: 'em-ico', html: svg(icon) }), UI.el('div', { style: 'margin-top:8px;' }, text)]);
}
