/* 小圆智能助手：本地规则解析语音/文字指令，快速记录数据（无需联网） */
window.Assistant = {
  init() {
    if (document.getElementById('assistant-fab')) return;
    const fab = UI.el('button', { id: 'assistant-fab', class: 'assistant-fab', html: svg('robot'), title: '小圆助手', onclick: () => this.open() });
    document.body.appendChild(fab);
  },

  open() {
    const panel = UI.el('div', { id: 'assistant-panel', class: 'assistant-panel' });
    const messages = UI.el('div', { class: 'assistant-messages' });
    const input = UI.el('input', { type: 'text', class: 'assistant-input', placeholder: '输入指令，例如：体重 52.5' });
    const micBtn = UI.el('button', { class: 'assistant-mic', html: svg('mic'), title: '语音输入' });
    const sendBtn = UI.el('button', { class: 'assistant-send', html: svg('send'), title: '发送' });

    function addMsg(text, fromUser) {
      messages.appendChild(UI.el('div', { class: 'assistant-msg ' + (fromUser ? 'user' : 'bot') }, [
        UI.el('div', { class: 'assistant-bubble' }, text)
      ]));
      messages.scrollTop = messages.scrollHeight;
    }

    function close() { panel.remove(); document.getElementById('assistant-fab').style.display = ''; }

    panel.appendChild(UI.el('div', { class: 'assistant-header' }, [
      UI.el('span', {}, '小圆助手'),
      UI.el('button', { class: 'assistant-close', html: svg('close'), onclick: close })
    ]));
    panel.appendChild(messages);
    const bottom = UI.el('div', { class: 'assistant-bottom' }, [input, micBtn, sendBtn]);
    panel.appendChild(bottom);

    // 欢迎语
    if (!messages.childElementCount) addMsg('你好～我可以帮你记录体重、经期、娃娃档案和设置目标。\n试试说：\n• 体重 52.5\n• 月经 7月11\n• 添加娃娃 小汤圆 1/4\n• 身高 165', false);

    const doSend = () => {
      const text = input.value.trim();
      if (!text) return;
      addMsg(text, true);
      input.value = '';
      const reply = this.parse(text);
      setTimeout(() => addMsg(reply, false), 200);
    };

    sendBtn.addEventListener('click', doSend);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });

    // 语音输入
    let recognizer;
    micBtn.addEventListener('click', () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) { addMsg('你的浏览器不支持语音识别，请直接打字输入～', false); return; }
      if (recognizer && recognizer.listening) { recognizer.stop(); return; }
      recognizer = new SpeechRecognition();
      recognizer.lang = 'zh-CN';
      recognizer.interimResults = false;
      recognizer.maxAlternatives = 1;
      recognizer.onstart = () => { micBtn.classList.add('listening'); addMsg('我在听，请说～', false); };
      recognizer.onend = () => { micBtn.classList.remove('listening'); };
      recognizer.onresult = (e) => {
        const text = e.results[0][0].transcript;
        addMsg(text, true);
        const reply = this.parse(text);
        setTimeout(() => addMsg(reply, false), 200);
      };
      recognizer.onerror = () => { addMsg('没听清，请再说一次或打字输入。', false); };
      recognizer.start();
    });

    document.body.appendChild(panel);
    document.getElementById('assistant-fab').style.display = 'none';
    input.focus();
  },

  parse(raw) {
    const text = raw.replace(/[，。！？、]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

    // 日期解析：今天/昨天/数字月数字日/YYYY-MM-DD
    const today = UI.today();
    const yest = UI.addDays(today, -1);
    function parseDateStr(s) {
      if (/今天/.test(s)) return today;
      if (/昨天/.test(s)) return yest;
      const m1 = s.match(/(\d{1,2})月(\d{1,2})日?/);
      if (m1) return new Date().getFullYear() + '-' + String(m1[1]).padStart(2, '0') + '-' + String(m1[2]).padStart(2, '0');
      const m2 = s.match(/(\d{4}-\d{2}-\d{2})/);
      if (m2) return m2[1];
      return null;
    }

    // 体重
    if (/体[重秤]|称[了重]|胖|瘦/.test(text)) {
      const n = text.match(/(\d{2,3}(?:\.\d{1,2})?)\s*(?:kg|公斤|千克)?/);
      if (n) {
        const v = parseFloat(n[1]);
        Store.add('weight', { date: today, value: v, note: '' });
        window.rerenderCurrent && window.rerenderCurrent();
        return '已记录体重 ' + v + ' kg 📝';
      }
      return '请告诉我具体体重，例如"体重 52.5"';
    }

    // 目标体重
    if (/目标.*体[重]|想[要减].*\d|目标.*\d.*kg/.test(text)) {
      const n = text.match(/(\d{2,3}(?:\.\d{1,2})?)\s*(?:kg|公斤|千克)?/);
      if (n) { Store.data.targetWeight = parseFloat(n[1]); Store.save(); window.rerenderCurrent && window.rerenderCurrent(); return '目标体重已设为 ' + n[1] + ' kg 🎯'; }
    }

    // 身高
    if (/身高/.test(text)) {
      const n = text.match(/(\d{2,3}(?:\.\d{1,2})?)\s*(?:cm|厘米)?/);
      if (n) { Store.data.height = parseFloat(n[1]); Store.save(); window.rerenderCurrent && window.rerenderCurrent(); return '身高已设为 ' + n[1] + ' cm'; }
    }

    // 经期
    if (/月经|经期|大姨妈|来姨妈|来事了/.test(text)) {
      const ds = parseDateStr(text) || today;
      const pLen = Store.data.periodSettings.periodLen || 6;
      const end = UI.addDays(ds, pLen - 1);
      Store.add('period', { start: ds, end: end, note: '' });
      window.rerenderCurrent && window.rerenderCurrent();
      return '已记录经期 ' + UI.fmtMD(ds) + ' 开始，预计持续 ' + pLen + ' 天 🌸';
    }

    // BJD 娃娃
    if (/娃娃|bjd|添加.*娃/.test(text)) {
      // 格式：添加娃娃 名字 尺寸
      const parts = raw.split(/[\s,，]+/).filter(Boolean);
      let name = '', size = '';
      if (parts.length >= 3) { name = parts[1]; size = parts[2]; }
      else if (parts.length === 2) { name = parts[1]; }
      if (!name) return '添加娃娃请告诉我名字和尺寸，例如"添加娃娃 小汤圆 1/4"';
      Store.add('dolls', { name, size, status: '未收到', photos: [] });
      window.rerenderCurrent && window.rerenderCurrent();
      return '已添加娃娃「' + name + '」' + (size ? '，尺寸 ' + size : '') + ' 🧸';
    }

    return '抱歉，我没听懂。你可以说：\n• 体重 52.5\n• 月经 7月11\n• 添加娃娃 小汤圆 1/4\n• 身高 165\n• 目标体重 50';
  }
};

document.addEventListener('DOMContentLoaded', () => { if (window.Assistant) Assistant.init(); });
