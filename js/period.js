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
              const end = r.end || UI.addDays(r.start, 4);
              const len = UI.diffDays(r.start, end) + 1;
              list.appendChild(UI.el('div', { class: 'list-row' }, [
                UI.el('div', { class: 'lr-main' }, [
                  UI.el('div', { class: 'lr-title' }, UI.fmtMD(r.start) + ' 起'),
                  UI.el('div', { class: 'lr-sub' }, '共 ' + len + ' 天' + (r.note ? ' · ' + r.note : ''))
                ]),
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

/* 阶段算法 */
function periodPhase(d) {
  const recs = Store.getArr('period').slice().sort((a, b) => a.start.localeCompare(b.start));
  if (!recs.length) return null;
  const cycle = Store.data.periodSettings.cycle;
  const luteal = Store.data.periodSettings.luteal;
  const menstruationLen = 5;
  const ovulationDay = cycle - luteal;

  // 1) 已记录的经期
  for (const r of recs) {
    const end = r.end || UI.addDays(r.start, 4);
    if (d >= r.start && d <= end) return { type: 'menstruation', recorded: true };
  }
  const last = recs[recs.length - 1];
  const lastStart = last.start;
  const diff = UI.diffDays(lastStart, d);
  const cycles = Math.floor(diff / cycle);
  const cand = UI.addDays(lastStart, cycles * cycle); // 该周期起点
  const dayInCycle = UI.diffDays(cand, d); // 0..cycle-1
  const future = UI.daysFromToday(d) > 0;

  if (dayInCycle >= 0 && dayInCycle < menstruationLen) {
    if (future) return { type: 'menstruation', predicted: true };
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
  const cycle = Store.data.periodSettings.cycle;
  const last = recs[recs.length - 1];
  const diff = UI.diffDays(last.start, UI.today());
  let ahead = Math.ceil(diff / cycle);
  if (ahead < 1) ahead = 1;
  return UI.addDays(last.start, ahead * cycle);
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
    P_statBox(Store.data.periodSettings.cycle + ' 天', '周期长度')
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
  UI.confirm('记录经期', '将 ' + UI.fmtMD(ds) + ' 标记为经期第一天？').then((ok) => {
    if (ok) { Store.add('period', { start: ds, end: null }); UI.toast('已记录 🌸'); location.reload(); }
  });
}

function periodForm(rec) {
  const isEdit = !!rec;
  const body = UI.el('div', {}, [
    P_field('开始日期', UI.el('input', { type: 'date', id: 'p-start', value: rec ? rec.start : UI.today(), max: UI.today() })),
    P_field('结束日期（可选）', UI.el('input', { type: 'date', id: 'p-end', value: rec && rec.end ? rec.end : '', min: rec ? rec.start : UI.today() })),
    P_field('备注（可选）', UI.el('input', { type: 'text', id: 'p-note', value: rec && rec.note ? rec.note : '', placeholder: '状态 / 感受' }))
  ]);
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
        UI.toast('已保存'); c(); location.reload();
      } }
    ]
  });
}

function delPeriod(rec) {
  UI.confirm('删除记录', '确定删除这条经期记录吗？').then((ok) => { if (ok) { Store.remove('period', rec.id); UI.toast('已删除'); location.reload(); } });
}

function P_field(label, input) { return UI.el('div', { class: 'field' }, [UI.el('label', {}, label), input]); }
function P_statBox(v, l) { return UI.el('div', { class: 'stat-box' }, [UI.el('div', { class: 'v' }, v), UI.el('div', { class: 'l' }, l)]); }
