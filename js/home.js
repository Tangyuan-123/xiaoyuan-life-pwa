/* 首页：功能卡片 + 快捷概览 */
window.HomeView = {
  register() {
    registerView('home', (root) => {
      const wrap = UI.el('div', {});

      const now = new Date();
      const greeting = (() => {
        const h = now.getHours();
        const t = h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
        return t + '，小圆';
      })();
      // 日期 + 农历
      const md = (now.getMonth() + 1) + '月' + now.getDate() + '日';
      const lunar = (window.Weather && window.Weather.toLunar) ? window.Weather.toLunar(now) : null;
      const lunarStr = lunar ? ('农历' + lunar.text) : '';
      const subLine = UI.el('div', { class: 'muted', style: 'margin-top:4px;' }, '今天 ' + md + (lunarStr ? ' · ' + lunarStr : '') + ' · 天气加载中…');
      const greetLine = UI.el('div', { style: 'font-size:20px;font-weight:800;display:flex;align-items:center;gap:6px;' }, [greeting, UI.el('span', { html: svg('flower'), style: 'color:#FF6B9D;display:inline-flex;' })]);
      wrap.appendChild(UI.el('div', { class: 'card' }, [greetLine, subLine]));

      // 异步拉天气，回来后更新副标题（带缓存/降级，失败不影响首页）
      if (window.Weather && window.Weather.getWeather) {
        window.Weather.getWeather().then((w) => {
          if (!w) { subLine.textContent = '今天 ' + md + (lunarStr ? ' · ' + lunarStr : '') + ' · 天气暂不可用'; return; }
          const cityPart = w.city ? (w.city + ' ') : '';
          subLine.textContent = '今天 ' + md + (lunarStr ? ' · ' + lunarStr : '') + ' · ' + cityPart + w.text + ' ' + w.temp + '°C' + (w.fromCache ? '（缓存）' : '');
        }).catch(() => {});
      }

      // 快捷概览
      const w = Store.getArr('weight');
      const latestW = w.length ? w.slice().sort((a, b) => b.date.localeCompare(a.date))[0] : null;
      const dolls = Store.getArr('dolls');
      const acgItems = Store.getArr('acg');
      const acgRecv = acgItems.filter((d) => d.received === '已收到').length;
      const guziItems = Store.getArr('guzi');
      const guziRecv = guziItems.filter((d) => d.received === '已到手').length;
      const period = window.PeriodView ? PeriodView.predict() : null;
      const target = Store.data.targetWeight;
      const weightLabel = (latestW && target) ? ('距目标 ' + (latestW.value - target).toFixed(1) + 'kg') : '最近体重';

      // 今日概览
      const periodRecs = Store.getArr('period');
      const nextP = periodRecs.length ? nextPeriodStart(periodRecs) : null;
      const daysLeft = nextP ? UI.diffDays(UI.today(), nextP) : null;
      const goalText = (latestW && target) ? (latestW.value - target > 0 ? '还差 ' + (latestW.value - target).toFixed(1) + ' kg' : '已达标 🎉') : '未设目标';
      const overview = UI.el('div', { class: 'card' }, [
        UI.el('div', { class: 'card-title' }, [svg('flower'), '今日概览']),
        UI.el('div', { class: 'stat-row' }, [
          statBox(daysLeft == null ? '—' : (daysLeft >= 0 ? daysLeft + ' 天' : '进行中'), '距下次经期'),
          statBox(goalText, '距目标体重'),
          statBox(acgItems.length ? (acgRecv + '/' + acgItems.length + ' 件') : '—', '二次元娃'),
          statBox(guziItems.length ? (guziRecv + '/' + guziItems.length + ' 件') : '—', '谷子到手')
        ])
      ]);
      wrap.appendChild(overview);

      // 功能卡
      const cards = UI.el('div', { class: 'home-grid', style: 'margin-top:16px;' });
      const defs = [
        { key: 'weight', icon: 'weight', color: 'linear-gradient(135deg,#FF9EC4,#FF6B9D)', title: '减肥助手', desc: '记录体重与围度变化', stat: latestW ? '已记录 ' + w.length + ' 次' : '开始第一次记录' },
        { key: 'period', icon: 'period', color: 'linear-gradient(135deg,#FFB3CE,#FF7EB3)', title: '经期助手', desc: '记录经期 · 预测排卵期', stat: period ? '预计 ' + period.nextLabel : '记录第一次经期' },
        { key: 'bjd', icon: 'bjd', color: 'linear-gradient(135deg,#C9A7FF,#9B6DFF)', title: 'BJD 娃娃', desc: '收藏档案与美照', stat: dolls.length ? '共 ' + dolls.length + ' 只收藏' : '添加你的娃' },
        { key: 'acg', icon: 'acg', color: 'linear-gradient(135deg,#FFC36B,#FF8A5B)', title: '二次元娃', desc: '娃脸壳·娃体·头壳', stat: acgItems.length ? ('已收 ' + acgRecv + ' / 共 ' + acgItems.length) : '添加你的娃' },
        { key: 'guzi', icon: 'guzi', color: 'linear-gradient(135deg,#5BD0C0,#3DB2FF)', title: '谷子助手', desc: '按角色收藏谷子', stat: guziItems.length ? ('到手 ' + guziRecv + ' / 共 ' + guziItems.length) : '收藏第一件谷子' }
      ];
      defs.forEach((d) => {
        const card = UI.el('button', {
          class: 'home-card', onclick: () => location.hash = '#/' + d.key
        }, [
          UI.el('div', { class: 'hc-ico', style: 'background:' + d.color, html: svg(d.icon) }),
          UI.el('div', { class: 'hc-title' }, d.title),
          UI.el('div', { class: 'hc-desc' }, d.desc),
          UI.el('div', { class: 'hc-stat' }, d.stat)
        ]);
        cards.appendChild(card);
      });
      wrap.appendChild(cards);

      // 数据备份提示
      wrap.appendChild(UI.el('div', { class: 'card', style: 'margin-top:14px;background:#f8f9fb;border-color:#e8eaed;' }, [
        UI.el('div', { class: 'card-title' }, [svg('download'), '数据备份']),
        UI.el('p', { class: 'muted', style: 'font-size:13px;margin-bottom:12px;' }, '小圆助手所有数据都保存在本机浏览器。换设备、清缓存或重新安装前，建议先导出备份。'),
        UI.el('div', { style: 'display:flex;gap:10px;' }, [
          UI.el('button', { class: 'btn', onclick: () => window.openBackup() }, '导出 / 导入备份')
        ])
      ]));

      root.appendChild(wrap);
    });
  }
};

function statBox(v, l) {
  return UI.el('div', { class: 'stat-box' }, [
    UI.el('div', { class: 'v' }, v),
    UI.el('div', { class: 'l' }, l)
  ]);
}
