/* 首页问候增强：农历（本地计算）+ 天气（Open-Meteo 联网，带缓存与降级）
 * 天气使用免密钥的 Open-Meteo：https://api.open-meteo.com
 * 定位优先 navigator.geolocation；失败/拒绝时回退到用户设置的默认城市（localStorage 'xiaoyuan-city'）。
 * 缓存：每 30 分钟刷新一次，断网或失败时显示上次结果。
 */
window.Weather = (function () {
  const CACHE_KEY = 'xiaoyuan-weather';
  const CITY_KEY = 'xiaoyuan-city';
  const CACHE_MS = 30 * 60 * 1000;

  // ---------- 农历计算（1900-2100） ----------
  const LUNAR_INFO = [
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
    0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
    0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
    0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
    0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
    0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
    0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
    0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
    0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
    0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
    0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
    0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
    0x0d520
  ];
  const LUNAR_MONTH = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
  const LUNAR_DAY = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
  const SOLAR_TERM = ['小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'];
  const SOLAR_TERM_INFO = [
    0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693,
    263343, 285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758
  ];
  function lYearDays(y) { let sum = 348; for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0; return sum + leapDays(y); }
  function leapDays(y) { if (leapMonth(y)) { return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29; } return 0; }
  function leapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf; }
  function monthDays(y, m) { return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
  function solarTerm(y, n) {
    const offDate = new Date((31556925974.7 * (y - 1900) + SOLAR_TERM_INFO[n] * 60000) + Date.UTC(1900, 0, 6, 2, 5));
    return offDate.getUTCDate();
  }
  function toLunar(date) {
    const baseDate = Date.UTC(1900, 0, 31);
    const objDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    let offset = Math.round((objDate - baseDate) / 86400000);
    let temp = 0, i, leap = 0, isLeap = false;
    for (i = 1900; i < 2101 && offset > 0; i++) { temp = lYearDays(i); offset -= temp; }
    if (offset < 0) { offset += temp; i--; }
    const year = i;
    leap = leapMonth(i);
    for (i = 1; i < 13 && offset > 0; i++) {
      if (leap > 0 && i === (leap + 1) && !isLeap) { i--; isLeap = true; temp = leapDays(year); }
      else { temp = monthDays(year, i); }
      if (isLeap && i === (leap + 1)) isLeap = false;
      offset -= temp;
    }
    if (offset === 0 && leap > 0 && i === leap + 1) { if (isLeap) { isLeap = false; } else { isLeap = true; i--; } }
    if (offset < 0) { offset += temp; i--; }
    const month = i;
    const day = offset + 1;
    // 节气
    let term = '';
    for (let n = 0; n < 24; n++) {
      if (solarTerm(date.getFullYear(), n) === date.getDate() && (n >= 0 && (date.getMonth() * 2 + (n % 2 === 0 ? 0 : 1)) === n)) {
        // 简化：仅当月份与节气大致对应时显示
        if (Math.floor(n / 2) === date.getMonth()) { term = SOLAR_TERM[n]; break; }
      }
    }
    let s;
    if (day === 1 && term) s = term;
    else s = (isLeap ? '闰' : '') + LUNAR_MONTH[month - 1] + '月' + LUNAR_DAY[day - 1];
    return { year, month, day, isLeap, text: s, zodiac: '鼠牛虎兔龙蛇马羊猴鸡狗猪'[(year - 1900 + 36) % 12] };
  }

  // ---------- 天气 ----------
  // 城市 -> 经纬度（常用城市；够用，且无需联网解析）
  const CITY_COORDS = {
    '北京': [39.9042, 116.4074], '上海': [31.2304, 121.4737], '广州': [23.1291, 113.2644],
    '深圳': [22.5431, 114.0579], '成都': [30.5728, 104.0668], '杭州': [30.2741, 120.1551],
    '武汉': [30.5928, 114.3055], '南京': [32.0603, 118.7969], '西安': [34.3416, 108.9398],
    '重庆': [29.5630, 106.5516], '苏州': [31.2989, 120.5853], '天津': [39.3434, 117.3616],
    '长沙': [28.2282, 112.9388], '郑州': [34.7466, 113.6254], '青岛': [36.0671, 120.3826],
    '厦门': [24.4798, 118.0894], '昆明': [25.0389, 102.7183], '大连': [38.9140, 121.6147],
    '福州': [26.0745, 119.2965], '济南': [36.6512, 117.1201], '合肥': [31.8206, 117.2272],
    '南昌': [28.6829, 115.8579], '沈阳': [41.8057, 123.4315], '哈尔滨': [45.8038, 126.5350],
    '石家庄': [38.0428, 114.5149], '太原': [37.8706, 112.5489], '南宁': [22.8170, 108.3665],
    '贵阳': [26.6477, 106.6302], '兰州': [36.0611, 103.8343], '海口': [20.0444, 110.1989],
    '乌鲁木齐': [43.8256, 87.6168], '拉萨': [29.6548, 91.1409], '银川': [38.4872, 106.2309],
    '西宁': [36.6171, 101.7782], '呼和浩特': [40.8424, 111.7492]
  };

  function getCache() { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return c; } catch (e) { return null; } }
  function setCache(obj) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.assign({ t: Date.now() }, obj))); } catch (e) {} }
  function getCity() { try { return localStorage.getItem(CITY_KEY) || '北京'; } catch (e) { return '北京'; } }
  function setCity(c) { try { localStorage.setItem(CITY_KEY, c); } catch (e) {} }

  const WMO = {
    0: '晴', 1: '晴', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '毛毛雨', 53: '小雨', 55: '中雨', 56: '冻雨', 57: '冻雨',
    61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
    80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '强阵雪', 95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '强雷暴'
  };
  function wmoText(code) { return WMO[code] != null ? WMO[code] : '未知'; }

  function fetchWeather(lat, lon) {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,weather_code&timezone=auto';
    return fetch(url).then((r) => r.json()).then((j) => {
      if (!j || !j.current) throw new Error('no current');
      return { temp: Math.round(j.current.temperature_2m), code: j.current.weather_code, text: wmoText(j.current.weather_code) };
    });
  }

  function locate() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) return reject(new Error('no geo'));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve([p.coords.latitude, p.coords.longitude]),
        (e) => reject(e),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
      );
    });
  }

  // 返回 { temp, text, city, fromCache }
  function getWeather() {
    return new Promise((resolve) => {
      const cached = getCache();
      const fresh = cached && (Date.now() - cached.t < CACHE_MS);
      const tryNet = (coords) => {
        fetchWeather(coords[0], coords[1])
          .then((w) => { const out = Object.assign({ city: getCity(), fromCache: false }, w); setCache(out); resolve(out); })
          .catch(() => { if (cached) resolve(Object.assign({ fromCache: true }, cached)); else resolve(null); });
      };
      if (fresh && cached) return resolve(Object.assign({ fromCache: true }, cached));
      // 优先定位，失败回退城市
      locate()
        .then((coords) => { tryNet(coords); })
        .catch(() => {
          const c = getCity();
          const co = CITY_COORDS[c];
          if (co) tryNet(co);
          else if (cached) resolve(Object.assign({ fromCache: true }, cached));
          else resolve(null);
        });
    });
  }

  return { toLunar, getWeather, getCity, setCity, CITY_COORDS };
})();
