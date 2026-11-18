(function () {
  'use strict';

  var KEY_STORAGE = 'momo_qweather_key_v1';
  var HOST_STORAGE = 'momo_qweather_host_v1';
  var CITY_STORAGE = 'momo_weather_city_v1';
  var API_BASE = 'http://127.0.0.1:3010';
  var TTL = 30 * 60 * 1000;

  var lastPayload = null;
  var lastFetchAt = 0;
  var lastContext = '';

  function read(name) {
    try { return String(localStorage.getItem(name) || '').trim(); } catch (e) { return ''; }
  }

  function write(name, value) {
    try {
      var v = String(value || '').trim();
      if (v) localStorage.setItem(name, v);
      else localStorage.removeItem(name);
    } catch (e) {}
  }

  function readKey() { return read(KEY_STORAGE); }
  function readHost() { return read(HOST_STORAGE); }
  function readCity() { return read(CITY_STORAGE) || '厦门'; }

  function setStatus(text, tone) {
    var el = document.getElementById('weather-status');
    if (!el) return;
    el.innerText = text;
    el.style.color = tone === 'ok' ? '#07c160' : (tone === 'error' ? '#ff6b6b' : 'var(--color-text-secondary)');
  }

  function setKeyStatus(text, tone) {
    var el = document.getElementById('weather-key-status');
    if (!el) return;
    el.innerText = text;
    el.style.color = tone === 'ok' ? '#07c160' : (tone === 'error' ? '#ff6b6b' : 'var(--color-text-secondary)');
  }

  function syncInputs() {
    var keyInput = document.getElementById('weather-key');
    var hostInput = document.getElementById('weather-host');
    var cityInput = document.getElementById('weather-city');
    if (keyInput) keyInput.value = readKey();
    if (hostInput) hostInput.value = readHost();
    if (cityInput) cityInput.value = readCity();
  }

  function normalizeHost(value) {
    return String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  }

  function refreshWeatherStatus() {
    syncInputs();
    if (!readKey() || !readHost()) {
      setStatus('还没有填写和风天气 Key 和专属 API Host，角色暂时不知道天气。');
      setKeyStatus('Key 只保存在这台浏览器，不会上传到服务器。');
      return;
    }
    setStatus('已填写 · 点「测试天气」验证 Key 与 API Host 是否可用。', 'ok');
    setKeyStatus('已保存在这台浏览器。位置默认按 IP 判断，不需要另外填 Key。', 'ok');
  }

  function saveWeatherKey() {
    var keyInput = document.getElementById('weather-key');
    var hostInput = document.getElementById('weather-host');
    var cityInput = document.getElementById('weather-city');
    var key = String(keyInput && keyInput.value || '').trim();
    var host = normalizeHost(hostInput && hostInput.value);
    var city = String(cityInput && cityInput.value || '').trim() || '厦门';
    if (!key) {
      setKeyStatus('Key 不能为空。', 'error');
      return;
    }
    if (key.length < 8) {
      setKeyStatus('这个 Key 看起来不完整，请重新复制。', 'error');
      return;
    }
    if (!host) {
      setKeyStatus('API Host 不能为空：控制台左侧「设置」里能看到，形如 h2a9cf3mhs.xy.qweatherapi.com。', 'error');
      return;
    }
    if (/[\s/]/.test(host)) {
      setKeyStatus('API Host 不该带空格或斜杠，只填那串域名。', 'error');
      return;
    }
    write(KEY_STORAGE, key);
    write(HOST_STORAGE, host);
    write(CITY_STORAGE, city);
    if (hostInput) hostInput.value = host;
    lastPayload = null;
    lastFetchAt = 0;
    setKeyStatus('已保存。建议点一次「测试天气」。', 'ok');
    setStatus('已填写 · 点「测试天气」验证是否可用。', 'ok');
  }

  function clearWeatherKey() {
    write(KEY_STORAGE, '');
    write(HOST_STORAGE, '');
    lastPayload = null;
    lastFetchAt = 0;
    var keyInput = document.getElementById('weather-key');
    var hostInput = document.getElementById('weather-host');
    if (keyInput) keyInput.value = '';
    if (hostInput) hostInput.value = '';
    setKeyStatus('已清除，角色不会知道天气和城市。');
    setStatus('未填写天气 Key。', 'error');
  }

  async function requestWeather() {
    var key = readKey();
    var host = readHost();
    var city = readCity();
    if (!key || !host) throw new Error('missing_key');
    var url = API_BASE + '/api/weather?key=' + encodeURIComponent(key)
      + '&host=' + encodeURIComponent(host)
      + '&city=' + encodeURIComponent(city);
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);
    var resp;
    try {
      resp = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) throw new Error('proxy_' + resp.status);
    var data = await resp.json();
    if (!data || !data.ok) throw new Error(String(data && data.error || 'unknown') + (data && data.detail ? '|' + data.detail : ''));
    return data;
  }

  function weatherErrorText(err) {
    var raw = String(err && err.message ? err.message : err);
    var parts = raw.split('|');
    var code = parts[0];
    var detail = parts.slice(1).join('|');
    if (code === 'missing_key') return '还没有填写和风天气 Key 和 API Host。';
    if (code === 'bad_host') return 'API Host 格式不对：控制台左侧「设置」里那串域名，原样复制。';
    if (code.indexOf('api_401') >= 0 || code.indexOf('http_401') >= 0) return 'Key 无效，请到控制台重新复制。';
    if (code.indexOf('api_403') >= 0 || code.indexOf('http_403') >= 0) return '这个 Key 没有天气 API 权限，检查凭据里是否启用了「天气预报」。';
    if (code.indexOf('api_404') >= 0 || code.indexOf('http_404') >= 0) return 'API Host 不对，和风新版每个账号有专属地址，别用 devapi.qweather.com。';
    if (code === 'city_not_found') return '找不到这个城市，换个城市名试试。';
    if (code === 'network') return '连不上和风（可能超时），再点一次试试；一直不行就看这段：' + (detail || '无详情');
    if (code.indexOf('proxy_') >= 0) return '本地代理没跑起来，先启动 server.py 再试。';
    return '天气请求失败：' + code;
  }

  async function testWeather() {
    if (!readKey() || !readHost()) {
      setStatus('请先填写并保存 Key 和 API Host。', 'error');
      return;
    }
    setStatus('正在用你的 Key 查天气…');
    try {
      var data = await requestWeather();
      lastPayload = data;
      lastFetchAt = Date.now();
      var now = data.now || {};
      var first = (data.daily && data.daily[0]) || {};
      var text = (data.province ? data.province + ' · ' : '') + data.city + ' · '
        + (now.text || '') + ' ' + (now.temp || '') + '℃'
        + '，湿度 ' + (now.humidity || '') + '%'
        + (first.max ? '；今天 ' + first.min + '~' + first.max + '℃' : '');
      setStatus('天气正常：' + text, 'ok');
      setKeyStatus('已验证可用，角色现在能知道天气和城市了。', 'ok');
    } catch (err) {
      setStatus(weatherErrorText(err), 'error');
    }
  }

  function buildContext(data) {
    var now = data.now || {};
    var lines = [];
    lines.push('【现实环境 · 天气】');
    lines.push('- 你现在在' + data.city + (data.province ? '（' + data.province + '）' : '') + '。角色知道这个位置，但不要主动报坐标、不要念城市名当播报。');
    lines.push('- 此刻 ' + (now.temp || '') + '℃，' + (now.text || '') + '，湿度 ' + (now.humidity || '') + '%，'
      + (now.windDir || '') + ' ' + (now.windScale || '') + ' 级风。');
    (data.daily || []).slice(0, 2).forEach(function (d) {
      lines.push('- ' + (d.date || '') + '：' + (d.min || '') + '~' + (d.max || '') + '℃，白天' + (d.day || '') + '，夜间' + (d.night || '') + '。');
    });
    lines.push('- 聊到天气、出门、穿衣时可以自然带一句；对方没问就别主动播报天气或位置，也别念得像天气预报。');
    return lines.join('\n');
  }

  async function buildWeatherContext() {
    if (!readKey() || !readHost()) return '';
    if (lastContext && (Date.now() - lastFetchAt) < TTL) return lastContext;
    try {
      var data = lastPayload || await requestWeather();
      lastPayload = data;
      lastFetchAt = Date.now();
      lastContext = buildContext(data);
      return lastContext;
    } catch (err) {
      console.warn('[Weather] 天气获取失败，本次不注入：', weatherErrorText(err));
      return '';
    }
  }

  function boot() {
    syncInputs();
    var keyInput = document.getElementById('weather-key');
    var hostInput = document.getElementById('weather-host');
    if (keyInput) keyInput.addEventListener('keydown', function (event) { if (event.key === 'Enter') { event.preventDefault(); saveWeatherKey(); } });
    if (hostInput) hostInput.addEventListener('keydown', function (event) { if (event.key === 'Enter') { event.preventDefault(); saveWeatherKey(); } });
    refreshWeatherStatus();
  }

  window.__momoWeatherToolsVersion = '2026111668';
  window.saveWeatherKey = saveWeatherKey;
  window.clearWeatherKey = clearWeatherKey;
  window.testWeather = testWeather;
  window.refreshWeatherStatus = refreshWeatherStatus;
  window.buildWeatherContext = buildWeatherContext;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
