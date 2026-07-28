/* 经期助手：手动记录经期，自动划分卵泡期/排卵期/黄体期，预测下次经期 */
window.PeriodView = {
  register() {
    registerView('period', (root) => {
      const recs = Store.getArr('period').slice().sort((a, b) => a.start.localeCompare(b.start));
      const wrap = UI.el('div', {});

      // 当前状态卡
      wrap.appendChild(buildStatusCard());

      // 记录按钮
      wrap.appendChild(UI.el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:14px;', onclick: () => periodForm(null) }, [svg('add'), '记录一次经期']));

      // 日历
      const calCard = UI.el('div', { class: 'card' });
      const now = new Date();
      let viewY = now.getFullYear(), viewM = now.getMonth();
      const calHost = UI.el('div', {});
      calCard.appendChild(calHost);
      function renderCal() { calHost.innerHTML = ''; calHost.appendChild(buildCalendar(viewY, viewM, () => { viewM--; if (viewM < 0) { viewM = 11; viewY--; } renderCal(); }, () => { viewM++; if (viewM > 11) { viewM = 0; viewY++; } renderCal(); })); }
      renderCal();
      wrap.appendChild(calCard);

      // 记录列表
      if (recs.length) {
        wrap.appendChild(UI.el('div', { class: 'card' }, [
          UI.el('div', { class: 'card-title' }, '历史记录'),
          (() => {
            const list = UI.el('div', { class: 'list' });
            recs.slice().reverse().forEach((r) => {
              const end = r.end || UI.addDays(r.start, (Store.data.periodSettings.periodLen || 6) - 1);
              const len = UI.diffDays(r.start, end) + 1;
              list.appendChild(UI.el('div', { class: 'list-row' }, [
                UI.el('div', { class: 'lr-main' }, [
                  UI.el('div', { class: 'lr-title' }, UI.fmtMD(r.start) + ' 起'),
                  UI.el('div', { class: 'lr-sub' }, '共 ' + len + ' 天' + (r.note ? ' · ' + r.note : ''))
                ]),
                UI.el('button', { class: 'icon-btn', title: '编辑', html: svg('edit'), onclick: () => periodForm(r) }),
                UI.el('button', { class: 'icon-btn', title: '删除', html: svg('trash'), onclick: () => delPeriod(r) })
              ]));
            });
            return list;
          })()
        ]));
      }
      root.appendChild(wrap);
    });
  },
  predict() {
    const recs = Store.getArr('period').slice().sort((a, b) => a.start.localeCompare(b.start));
    if (!recs.length) return null;
    return { nextLabel: UI.fmtMD(nextPeriodStart(recs)) };
  }
};

/* 基于历史记录统计周期与经期时长（智能预测核心） */
function historyStats(recs) {
  const starts = recs.map((r) => r.start).sort();
  const settings = Store.data.periodSettings;
  // 相邻经期间隔
  const intervals = [];
  for (let i = 1; i < starts.length; i++) intervals.push(UI.diffDays(starts[i - 1], starts[i]));
  // 周期长度：有历史时用中位数（抗异常值）+ 与设置值按数据量平滑混合；始终限制在 21~45 天
  let cycle = settings.cycle;
  if (intervals.length) {
    const si = intervals.slice().sort((a, b) => a - b);
    const med = si.length % 2 ? si[(si.length - 1) / 2] : Math.round((si[si.length / 2 - 1] + si[si.length / 2]) / 2);
    const w = Math.min(1, intervals.length / 3); // 历史≥3次时完全依赖数据
    cycle = med * w + settings.cycle * (1 - w);
  }
  cycle = Math.max(21, Math.min(45, Math.round(cycle)));
  // 经期时长：优先取历史平均值，否则用设置值
  let periodLen = settings.periodLen || 6;
  const lens = recs.filter((r) => r.end).map((r) => UI.diffDays(r.start, r.end) + 1);
  if (lens.length) periodLen = Math.round(lens.reduce((a, b) => a + b, 0) / lens.length);
  periodLen = Math.max(2, Math.min(12, periodLen));
  return { cycle, periodLen, lastStart: starts[starts.length - 1] };
}

/* 阶段算法 */
function periodPhase(d) {
  const recs = Store.getArr('period').slice().sort((a, b) => a.start.localeCompare(b.start));
  if (!recs.length) return null;
  const s = historyStats(recs);
  const cycle = s.cycle;
  const luteal = Store.data.periodSettings.luteal;
  const menstruationLen = s.periodLen;
  const ovulationDay = cycle - luteal;

  // 1) 已记录的经期
  for (const r of recs) {
    const end = r.end || UI.addDays(r.start, menstruationLen - 1);
    if (d >= r.start && d <= end) return { type: 'menstruation', recorded: true, start: d === r.start };
  }
  const lastStart = s.lastStart;
  const diff = UI.diffDays(lastStart, d);
  const cycles = Math.floor(diff / cycle);
  const cand = UI.addDays(lastStart, cycles * cycle); // 该周期起点
  const dayInCycle = UI.diffDays(cand, d); // 0..cycle-1
  const future = UI.daysFromToday(d) > 0;

  if (dayInCycle >= 0 && dayInCycle < menstruationLen) {
    if (future) return { type: 'menstruation', predicted: true, start: dayInCycle === 0 };
    return { type: 'follicular' };
  }
  // 排卵期（易孕窗口）：排卵日前 5 天 ~ 排卵日
  if (dayInCycle >= ovulationDay - 5 && dayInCycle <= ovulationDay) {
    return future ? { type: 'ovulation' } : { type: 'follicular' };
  }
  if (dayInCycle > ovulationDay) return { type: 'luteal' };
  return { type: 'follicular' };
}

function nextPeriodStart(recs) {
  if (!recs.length) return null;
  const s = historyStats(recs);
  let next = UI.addDays(s.lastStart, s.cycle);
  // 若预测日已过（如刚结束一次经期），顺延周期直到落在未来
  while (UI.diffDays(UI.today(), next) < 0) next = UI.addDays(next, s.cycle);
  return next;
}

function buildStatusCard() {
  const recs = Store.getArr('period');
  if (!recs.length) {
    return UI.el('div', { class: 'card' }, [
      UI.el('div', { class: 'card-title' }, [svg('period'), '当前状态']),
      UI.el('div', { class: 'muted' }, '还没有经期记录，点下方按钮记录第一次，即可自动预测排卵期与下次经期 🌸')
    ]);
  }
  const today = UI.today();
  const s = historyStats(recs);
  const ph = periodPhase(today) || { type: 'follicular' };
  const next = nextPeriodStart(recs);
  const daysLeft = UI.diffDays(today, next);
  const phaseInfo = {
    menstruation: { t: '经期中', d: '注意休息与保暖，多喝温水～' },
    follicular: { t: '卵泡期', d: '身体状态回升，适合运动与护肤。' },
    ovulation: { t: '排卵期', d: '易孕窗口期，注意身体变化。' },
    luteal: { t: '黄体期', d: '可能情绪/食欲波动，对自己温柔点。' }
  }[ph.type] || { t: '—', d: '' };

  const card = UI.el('div', { class: 'card' });
  card.appendChild(UI.el('div', { class: 'card-title' }, [svg('period'), '当前状态']));
  card.appendChild(UI.el('div', { style: 'display:flex;align-items:center;gap:14px;' }, [
    UI.el('div', { style: 'width:64px;height:64px;border-radius:20px;display:grid;place-items:center;font-size:26px;background:' + phaseColor(ph.type) + ';' }, phaseEmoji(ph.type)),
    UI.el('div', {}, [
      UI.el('div', { style: 'font-size:20px;font-weight:800;' }, phaseInfo.t),
      UI.el('div', { class: 'muted', style: 'font-size:13px;' }, phaseInfo.d)
    ])
  ]));
  card.appendChild(UI.el('div', { class: 'stat-row', style: 'margin-top:14px;' }, [
    P_statBox('还剩 ' + (daysLeft >= 0 ? daysLeft : 0) + ' 天', '距下次经期'),
    P_statBox(UI.fmtMD(next), '预计 ' + UI.weekday(next) + ' 来'),
    P_statBox(s.periodLen + ' 天', '经期时长'),
    P_statBox(s.cycle + ' 天', '周期长度')
  ]));
  return card;
}

function phaseColor(t) { return { menstruation: '#FFE3EE', follicular: '#E7F4EC', ovulation: '#FFF1C2', luteal: '#F1E8FB' }[t] || '#FFF'; }
function phaseEmoji(t) { return { menstruation: '🩸', follicular: '🌱', ovulation: '🌟', luteal: '🌙' }[t] || '🌸'; }

function buildCalendar(y, m, onPrev, onNext) {
  const box = UI.el('div', {});
  const head = UI.el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px;' }, [
    UI.el('button', { class: 'icon-btn', html: svg('back'), onclick: onPrev }),
    UI.el('div', { style: 'flex:1;text-align:center;font-weight:800;font-size:16px;' }, y + ' 年 ' + (m + 1) + ' 月'),
    UI.el('button', { class: 'icon-btn', html: svg('chevron'), onclick: onNext })
  ]);
  box.appendChild(head);

  const table = UI.el('table', { class: 'cal' });
  const thead = UI.el('tr', {});
  ['日', '一', '二', '三', '四', '五', '六'].forEach((d) => thead.appendChild(UI.el('th', {}, d)));
  table.appendChild(thead);

  const first = new Date(y, m, 1);
  const startW = first.getDay();
  const daysInM = new Date(y, m + 1, 0).getDate();
  const today = UI.today();
  let row = UI.el('tr', {});
  table.appendChild(row);
  // 前置空格
  for (let i = 0; i < startW; i++) row.appendChild(UI.el('td', {}, UI.el('div', { class: 'day out' }, '')));
  for (let d = 1; d <= daysInM; d++) {
    if (row.childElementCount === 7) { row = UI.el('tr', {}); table.appendChild(row); }
    const ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const ph = periodPhase(ds);
    let cls = 'day';
    if (ds === today) cls += ' today';
    if (ph) cls += ' ' + (ph.predicted ? 'predicted' : ph.type);
    if (ph && ph.start) cls += ' start';
    const cell = UI.el('td', {}, UI.el('div', { class: cls }, String(d)));
    cell.querySelector('.day').addEventListener('click', () => tapDay(ds));
    row.appendChild(cell);
  }
  box.appendChild(table);

  // 图例
  box.appendChild(UI.el('div', { class: 'phase-legend' }, [
    legendItem('#FF6B9D', '经期'),
    legendItem('#E7F4EC', '卵泡期'),
    legendItem('#FFF1C2', '排卵期'),
    legendItem('#F1E8FB', '黄体期'),
    legendItem('#FFD0E2', '预测经期')
  ]));
  return box;
}

function legendItem(color, label) {
  return UI.el('span', { class: 'ph' }, [UI.el('span', { class: 'dot', style: 'width:12px;height:12px;border-radius:4px;background:' + color + ';display:inline-block;' }), label]);
}

function tapDay(ds) {
  const recs = Store.getArr('period');
  const isStart = recs.some((r) => r.start === ds);
  if (isStart) { UI.toast('该日已是经期开始'); return; }
  // 打开表单，预填开始日期与默认结束日期，允许自由选择结束时间
  const defaultEnd = UI.addDays(ds, (Store.data.periodSettings.periodLen || 6) - 1);
  periodForm(null, ds, defaultEnd);
}

function periodForm(rec, prefillStart, prefillEnd) {
  const isEdit = !!rec;
  const startVal = rec ? rec.start : (prefillStart || UI.today());
  const endVal = rec && rec.end ? rec.end : (prefillEnd || '');
  const body = UI.el('div', {}, [
    P_field('开始日期', UI.el('input', { type: 'date', id: 'p-start', value: startVal, max: UI.today() })),
    P_field('结束日期（可选，不填则按设置中的经期时长自动计算）', UI.el('input', { type: 'date', id: 'p-end', value: endVal, min: startVal })),
    P_field('备注（可选）', UI.el('input', { type: 'text', id: 'p-note', value: rec && rec.note ? rec.note : '', placeholder: '状态 / 感受' }))
  ]);
  // 开始日期变化时同步结束日期的最小值
  const startInput = body.querySelector('#p-start');
  const endInput = body.querySelector('#p-end');
  startInput.addEventListener('change', () => { endInput.min = startInput.value; });
  UI.openModal({
    title: isEdit ? '编辑经期' : '记录经期', body,
    actions: [
      { text: '取消', kind: 'btn-ghost' },
      { text: isEdit ? '保存' : '添加', kind: 'btn-primary', onClick: (c) => {
        const start = document.getElementById('p-start').value;
        let end = document.getElementById('p-end').value;
        if (end && end < start) end = start;
        if (!start) { UI.toast('请选择开始日期'); return; }
        const obj = { start, end: end || null, note: document.getElementById('p-note').value.trim() };
        if (isEdit) Store.update('period', rec.id, obj); else Store.add('period', obj);
        UI.toast('已保存'); c(); window.rerenderCurrent();
      } }
    ]
  });
}

function delPeriod(rec) {
  UI.confirm('删除记录', '确定删除这条经期记录吗？').then((ok) => { if (ok) { Store.remove('period', rec.id); UI.toast('已删除'); window.rerenderCurrent(); } });
}

function P_field(label, input) { return UI.el('div', { class: 'field' }, [UI.el('label', {}, label), input]); }
function P_statBox(v, l) { return UI.el('div', { class: 'stat-box' }, [UI.el('div', { class: 'v' }, v), UI.el('div', { class: 'l' }, l)]); }
