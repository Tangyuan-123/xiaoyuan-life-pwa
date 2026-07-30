/* 通用卡片交互：长按多选 / 拖拽调序 / 选中汇总
 * 由 BJD / 二次元娃 / 谷子 三个模块复用。
 * 设计：
 *  - 单击卡片 → 打开详情（onTap）
 *  - 长按（~420ms，不移动）→ 进入多选模式，并选中该卡片
 *  - 长按后拖动 → 进入拖拽调序，松手后写入新顺序
 *  - 多选模式下单击卡片 → 切换选中；底部出现操作条（买入/售出总额、删除所选、完成）
 */
window.CardActions = (function () {
  let selecting = false;
  const selected = new Set();
  let opts = null;        // 当前模块的回调/配置
  let barEl = null;       // 底部操作条 DOM

  function beginView(o) {
    selecting = false;
    selected.clear();
    opts = o || {};
    barEl = null;
  }
  function setItems(arr) { opts.items = arr; if (selecting) refreshBar(); }
  function isSelecting() { return selecting; }
  function isSelected(id) { return selected.has(id); }

  function fmt(n) { return Math.round(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 }); }

  function totals() {
    const items = opts.items || [];
    let buy = 0, sold = 0;
    items.forEach((it) => {
      if (!selected.has(it.id)) return;
      if (opts.getBuy) buy += opts.getBuy(it) || 0;
      if (opts.getSold) { const s = opts.getSold(it); if (s) sold += s; }
    });
    return { buy, sold };
  }

  function removeBar() {
    if (barEl && barEl.parentNode) barEl.parentNode.removeChild(barEl);
    barEl = null;
  }

  // 重建/更新底部操作条
  function refreshBar() {
    if (!selecting) { removeBar(); return; }
    const t = totals();
    const root = opts.root;
    if (!root) return;
    if (!barEl) {
      barEl = UI.el('div', { class: 'sel-bar' });
      root.appendChild(barEl);
    }
    barEl.innerHTML = '';
    barEl.appendChild(UI.el('div', { class: 'sel-info' }, [
      UI.el('div', { class: 'sel-count' }, [
        UI.el('span', { class: 'sel-dot' }), '已选 ' + selected.size + ' 件'
      ]),
      UI.el('div', { class: 'sel-total' }, '买入 ¥' + fmt(t.buy) + ' · 售出 ¥' + fmt(t.sold))
    ]));
    barEl.appendChild(UI.el('div', { class: 'sel-btns' }, [
      UI.el('button', { class: 'btn btn-sm', onclick: () => exitSelect() }, '完成'),
      UI.el('button', { class: 'btn btn-sm btn-danger', onclick: () => deleteSelected() }, '删除所选')
    ]));
  }

  function exitSelect() {
    selecting = false;
    selected.clear();
    removeBar();
    if (opts.onRerender) opts.onRerender();
  }

  function deleteSelected() {
    const n = selected.size;
    if (!n) { exitSelect(); return; }
    UI.confirm('删除选中', '确定删除选中的 ' + n + ' 项吗？此操作不可撤销。').then((ok) => {
      if (!ok) return;
      const ids = Array.from(selected);
      ids.forEach((id) => { if (opts.onDelete) opts.onDelete(id); });
      selecting = false;
      selected.clear();
      removeBar();
      if (opts.onRerender) opts.onRerender();
    });
  }

  // 给卡片绑定手势
  function attach(cardEl, item, o) {
    cardEl.dataset.id = item.id;
    let startX = 0, startY = 0, startT = 0, moved = false, longPressed = false, timer = null;
    let dragEl = null, placeholder = null, origOrder = null, offsetX = 0, offsetY = 0;
    const GRID = o.gridEl;

    function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

    function beginDrag(e) {
      if (!GRID) return;
      dragEl = cardEl;
      const rect = dragEl.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      placeholder = UI.el('div', { class: 'drag-ph' });
      placeholder.style.width = rect.width + 'px';
      placeholder.style.height = rect.height + 'px';
      dragEl.parentNode.insertBefore(placeholder, dragEl);
      dragEl.style.width = rect.width + 'px';
      dragEl.style.height = rect.height + 'px';
      dragEl.style.position = 'fixed';
      dragEl.style.zIndex = '1000';
      dragEl.style.pointerEvents = 'none';
      dragEl.classList.add('dragging');
      dragEl.style.touchAction = 'none';
      origOrder = Array.from(GRID.children)
        .filter((c) => c.classList && c.classList.contains('bjd-card'))
        .map((c) => c.dataset.id);
      try { cardEl.setPointerCapture(e.pointerId); } catch (err) {}
      moveDrag(e);
    }

    function moveDrag(e) {
      if (!dragEl || !GRID) return;
      dragEl.style.left = (e.clientX - offsetX) + 'px';
      dragEl.style.top = (e.clientY - offsetY) + 'px';
      const siblings = Array.from(GRID.children).filter((c) => c !== dragEl && c !== placeholder);
      let inserted = false;
      for (const sib of siblings) {
        const r = sib.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { GRID.insertBefore(placeholder, sib); inserted = true; break; }
      }
      if (!inserted) GRID.appendChild(placeholder);
    }

    function endDrag() {
      if (!dragEl) return;
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.insertBefore(dragEl, placeholder);
        placeholder.parentNode.removeChild(placeholder);
      }
      dragEl.style.position = '';
      dragEl.style.left = ''; dragEl.style.top = '';
      dragEl.style.width = ''; dragEl.style.height = '';
      dragEl.style.zIndex = ''; dragEl.style.pointerEvents = '';
      dragEl.classList.remove('dragging');
      dragEl.style.touchAction = '';
      const order = Array.from(GRID.children)
        .filter((c) => c.classList && c.classList.contains('bjd-card'))
        .map((c) => c.dataset.id);
      const movedOrder = !origOrder || origOrder.join(',') !== order.join(',');
      dragEl = null; placeholder = null; origOrder = null;
      if (movedOrder && opts.reorder && opts.arrName) {
        opts.reorder(opts.arrName, order);
      }
    }

    cardEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.icon-btn') || e.target.closest('.acts')) return;
      if (e.button && e.button !== 0) return;
      startX = e.clientX; startY = e.clientY; startT = Date.now(); moved = false; longPressed = false;
      clearTimer();
      timer = setTimeout(() => {
        longPressed = true;
        selecting = true;
        if (!selected.has(item.id)) selected.add(item.id);
        cardEl.classList.add('selected');
        refreshBar();
        UI.toast('已进入多选，点击卡片可勾选', 1200);
      }, 420);
    });

    cardEl.addEventListener('pointermove', (e) => {
      if (!startT) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 16) {
        moved = true;
        if (timer && !longPressed) clearTimer(); // 视为滚动，放弃长按
      }
      if (longPressed && !dragEl) beginDrag(e);
      if (dragEl) moveDrag(e);
    });

    function onUp() {
      clearTimer();
      if (longPressed) {
        endDrag();
        if (!dragEl) startT = 0;
        return;
      }
      if (!moved) {
        if (selecting) {
          if (selected.has(item.id)) { selected.delete(item.id); cardEl.classList.remove('selected'); }
          else { selected.add(item.id); cardEl.classList.add('selected'); }
          refreshBar();
        } else if (o.onTap) {
          o.onTap();
        }
      }
      startT = 0;
    }
    cardEl.addEventListener('pointerup', onUp);
    cardEl.addEventListener('pointercancel', () => { clearTimer(); if (dragEl) endDrag(); startT = 0; });
  }

  return { beginView, attach, isSelecting, isSelected, refreshBar, setItems, exitSelect };
})();

/* 共享：肤色选择组件
 * 用真实 <select>（白/粉/普/烧）+「自定义」可填写，保证下拉框一定有内容
 * （修复部分浏览器 <input list> 不显示建议的问题）。最终值统一存在 #skin-value。
 */
window.makeSkinField = function (initValue) {
  const FIXED = ['白', '粉', '普', '烧'];
  const isCustom = initValue && !FIXED.includes(initValue);
  const sel = UI.el('select', { id: 'skin-sel' },
    FIXED.map((s) => UI.el('option', { value: s, selected: (initValue === s) ? '' : null }, s))
      .concat([UI.el('option', { value: '__custom__', selected: isCustom ? '' : null }, '自定义…')])
  );
  const input = UI.el('input', { type: 'text', id: 'skin-value', placeholder: '填写自定义肤色', value: isCustom ? initValue : '' });
  const wrap = UI.el('div', { class: 'skin-field' }, [sel, input]);
  function sync() {
    if (sel.value === '__custom__') { input.style.display = ''; input.style.marginTop = '8px'; }
    else { input.style.display = 'none'; input.value = sel.value; }
  }
  sel.addEventListener('change', sync);
  sync();
  return wrap;
};
