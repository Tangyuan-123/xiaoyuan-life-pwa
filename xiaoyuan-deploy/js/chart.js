/* 轻量 SVG 折线图：多序列、网格、坐标轴、触摸提示、可缩放 */
const Chart = (function () {
  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  /**
   * render(opts) -> {svg, update}
   * opts: {
   *   width, height,
   *   series: [{name, color, points:[{x:Date|labelString, y:Number}]}],
   *   yUnit, xFmt(fn), yFmt(fn)
   * }
   */
  function render(opts) {
    const W = opts.width || 640;
    const H = opts.height || 320;
    const padL = 44, padR = 14, padT = 16, padB = 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // 汇总所有点用于范围
    let allY = [];
    opts.series.forEach((s) => s.points.forEach((p) => { if (p.y != null) allY.push(p.y); }));
    if (opts.refLines) opts.refLines.forEach((rl) => { if (rl.value != null) allY.push(rl.value); });
    if (!allY.length) allY = [0, 1];

    let yMin = Math.min(...allY), yMax = Math.max(...allY);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const yPad = (yMax - yMin) * 0.12;
    yMin = Math.floor(yMin - yPad); yMax = Math.ceil(yMax + yPad);
    if (yMin < 0 && Math.min(...allY) >= 0) yMin = 0;

    const n = opts.series.reduce((m, s) => Math.max(m, s.points.length), 0);
    const xAt = (i) => padL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
    const yAt = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', preserveAspectRatio: 'xMidYMid meet', role: 'img' });

    // 网格 + Y 轴刻度
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = yMin + ((yMax - yMin) * i) / ticks;
      const y = yAt(v);
      svg.appendChild(el('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: '#F3E4EC', 'stroke-width': 1 }));
      const t = el('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#A08C95' });
      t.textContent = (opts.yFmt ? opts.yFmt(v) : v.toFixed(1));
      svg.appendChild(t);
    }

    // X 轴标签（最多 ~6 个）
    const labels = opts.series[0] ? opts.series[0].points : [];
    const stepX = Math.max(1, Math.ceil(labels.length / 6));
    labels.forEach((p, i) => {
      if (i % stepX !== 0 && i !== labels.length - 1) return;
      const x = xAt(i);
      const t = el('text', { x, y: H - 8, 'text-anchor': 'middle', 'font-size': 10.5, fill: '#A08C95' });
      t.textContent = opts.xFmt ? opts.xFmt(p.x, i) : (p.x instanceof Date ? p.x.toISOString().slice(5, 10) : p.x);
      svg.appendChild(t);
    });

    // 折线 + 区域 + 点
    opts.series.forEach((s) => {
      if (!s.points.length) return;
      const pts = s.points.map((p, i) => [xAt(i), yAt(p.y)]);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      // 面积填充
      const area = `${d} L ${pts[pts.length - 1][0].toFixed(1)} ${yAt(yMin)} L ${pts[0][0].toFixed(1)} ${yAt(yMin)} Z`;
      const grad = el('linearGradient', { id: 'g_' + s.name, x1: 0, y1: 0, x2: 0, y2: 1 });
      grad.appendChild(el('stop', { offset: '0%', 'stop-color': s.color, 'stop-opacity': 0.22 }));
      grad.appendChild(el('stop', { offset: '100%', 'stop-color': s.color, 'stop-opacity': 0 }));
      const defs = el('defs', {}); defs.appendChild(grad); svg.appendChild(defs);
      svg.appendChild(el('path', { d: area, fill: `url(#g_${s.name})`, stroke: 'none' }));
      svg.appendChild(el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      pts.forEach((p, i) => {
        const c = el('circle', { cx: p[0], cy: p[1], r: 3.5, fill: '#fff', stroke: s.color, 'stroke-width': 2.5 });
        const title = el('title', {}); title.textContent = `${s.name}: ${opts.yFmt ? opts.yFmt(s.points[i].y) : s.points[i].y}`;
        c.appendChild(title);
        svg.appendChild(c);
      });
    });

    // 参考线（如目标体重）：虚线 + 标签
    if (opts.refLines) {
      opts.refLines.forEach((rl) => {
        if (rl.value == null) return;
        const y = yAt(rl.value);
        if (y < padT || y > padT + plotH) return;
        svg.appendChild(el('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: rl.color || '#999', 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }));
        const t = el('text', { x: W - padR - 4, y: y - 4, 'text-anchor': 'end', 'font-size': 11, 'font-weight': '700', fill: rl.color || '#999' });
        t.textContent = rl.label || (rl.value + (opts.yUnit || ''));
        svg.appendChild(t);
      });
    }

    return svg;
  }

  return { render };
})();
