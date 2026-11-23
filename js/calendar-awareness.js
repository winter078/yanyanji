// ==========================================================================
// 📅 日历与重要日子感知
// 只做三件事：识别今天/农历、识别节日窗口、识别用户生日。
// 角色提示词只使用这里算出来的真实日期，避免模型自己编节日。
// ==========================================================================
(function () {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;
  const LEAD_DAYS = 7;
  const AFTER_DAYS = 3;
  const BIRTHDAY_KEY = 'momo_user_birthday';
  const LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
  const LUNAR_DAYS = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
  ];

  // 公历固定节日。duration 只用于“正在过/刚结束”的窗口，不冒充法定放假安排。
  const SOLAR_FESTIVALS = [
    { key: 'yuandan', name: '元旦', month: 1, day: 1, duration: 1, emoji: '🎊' },
    { key: 'qingren', name: '情人节', month: 2, day: 14, duration: 1, emoji: '💗' },
    { key: 'funv', name: '妇女节', month: 3, day: 8, duration: 1, emoji: '🌷' },
    { key: 'laodong', name: '劳动节', month: 5, day: 1, duration: 3, emoji: '🌿' },
    { key: 'ertong', name: '儿童节', month: 6, day: 1, duration: 1, emoji: '🍭' },
    { key: 'jiaoshi', name: '教师节', month: 9, day: 10, duration: 1, emoji: '📚' },
    { key: 'guoqing', name: '国庆节', month: 10, day: 1, duration: 7, emoji: '🇨🇳' },
    { key: 'pingan', name: '平安夜', month: 12, day: 24, duration: 1, emoji: '🍎' },
    { key: 'shengdan', name: '圣诞节', month: 12, day: 25, duration: 1, emoji: '🎄' },
    { key: 'kuanian', name: '跨年夜', month: 12, day: 31, duration: 1, emoji: '✨' }
  ];

  // 农历节日。除夕单独判断，因为它是“农历腊月最后一天”，不是固定日期。
  const LUNAR_FESTIVALS = [
    { key: 'chunjie', name: '春节', month: 1, day: 1, duration: 7, emoji: '🧧', lunarLabel: '正月初一' },
    { key: 'yuanxiao', name: '元宵节', month: 1, day: 15, duration: 1, emoji: '🏮', lunarLabel: '正月十五' },
    { key: 'duanwu', name: '端午节', month: 5, day: 5, duration: 1, emoji: '🍃', lunarLabel: '五月初五' },
    { key: 'qixi', name: '七夕', month: 7, day: 7, duration: 1, emoji: '🌌', lunarLabel: '七月初七' },
    { key: 'zhongqiu', name: '中秋节', month: 8, day: 15, duration: 1, emoji: '🌕', lunarLabel: '八月十五' },
    { key: 'chongyang', name: '重阳节', month: 9, day: 9, duration: 1, emoji: '🍁', lunarLabel: '九月初九' },
    { key: 'laba', name: '腊八节', month: 12, day: 8, duration: 1, emoji: '🥣', lunarLabel: '腊月初八' }
  ];

  const lunarFormatter = (function () {
    try {
      return new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'numeric', day: 'numeric' });
    } catch (e) {
      return null;
    }
  })();

  function startOfDay(value) {
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(value, n) {
    const d = new Date(value.getTime());
    d.setDate(d.getDate() + Number(n || 0));
    return startOfDay(d);
  }

  function dayDiff(a, b) {
    return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);
  }

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function monthDay(d) {
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function weekday(d) {
    return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()] || '';
  }

  function lunarParts(d) {
    if (!lunarFormatter) return null;
    try {
      const parts = lunarFormatter.formatToParts(startOfDay(d));
      const monthPart = parts.find(function (p) { return p.type === 'month'; });
      const dayPart = parts.find(function (p) { return p.type === 'day'; });
      if (!monthPart || !dayPart) return null;
      const rawMonth = String(monthPart.value || '');
      const leap = rawMonth.indexOf('闰') === 0;
      const month = parseInt(rawMonth.replace(/^闰/, ''), 10);
      const day = parseInt(dayPart.value, 10);
      if (!month || !day) return null;
      return { month: month, day: day, leap: leap };
    } catch (e) {
      return null;
    }
  }

  function lunarLabel(month, day) {
    const m = LUNAR_MONTHS[month - 1] || (month + '月');
    const d = LUNAR_DAYS[day - 1] || (day + '日');
    return m + d;
  }

  // 清明是节气，公历日期会浮动；用常用近似公式，误差控制在常见的 4/5 日。
  function qingmingDate(year) {
    const y = year % 100;
    const day = Math.floor(y * 0.2422 + 4.81) - Math.floor(y / 4);
    return new Date(year, 3, Math.max(4, Math.min(5, day)));
  }

  function nthWeekdayOfMonth(year, monthIndex, weekdayValue, nth) {
    const first = new Date(year, monthIndex, 1);
    const offset = (weekdayValue - first.getDay() + 7) % 7;
    return new Date(year, monthIndex, 1 + offset + (nth - 1) * 7);
  }

  function parseBirthdayInput(value, calendar) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return null;
    const m = text.match(/(?:(\d{4})\s*[年./-]\s*)?([0-9]{1,2})\s*(?:月|[./-])\s*([0-9]{1,2})\s*日?/);
    if (!m) return null;
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (!month || !day || month < 1 || month > 12) return null;
    const cal = calendar === 'lunar' ? 'lunar' : 'solar';
    if (cal === 'lunar') {
      if (day > 30) return null;
    } else {
      const max = new Date(2000, month, 0).getDate();
      if (day > max) return null;
    }
    return {
      month: month,
      day: day,
      calendar: cal,
      year: m[1] ? parseInt(m[1], 10) : 0
    };
  }

  function normalizeBirthdayObject(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') return parseBirthdayInput(raw, 'solar');
    if (typeof raw === 'object') {
      const month = parseInt(raw.month, 10);
      const day = parseInt(raw.day, 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= (raw.calendar === 'lunar' ? 30 : 31)) {
        return { month: month, day: day, calendar: raw.calendar === 'lunar' ? 'lunar' : 'solar', year: parseInt(raw.year, 10) || 0 };
      }
    }
    return null;
  }

  function readUserBirthday() {
    try {
      const raw = localStorage.getItem(BIRTHDAY_KEY);
      if (!raw) return null;
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
      return normalizeBirthdayObject(parsed);
    } catch (e) {
      return null;
    }
  }

  function birthdayText(b) {
    if (!b) return '未设置（不要猜、不要假装知道用户生日）';
    return (b.calendar === 'lunar' ? '农历' : '公历') + ' ' + b.month + '月' + b.day + '日';
  }

  function eventFromConfig(cfg, start, now, lunarLabelText) {
    const begin = startOfDay(start);
    const end = addDays(begin, Math.max(1, cfg.duration || 1) - 1);
    const today = startOfDay(now);
    if (end < addDays(today, -AFTER_DAYS - 1)) return null;
    if (begin > addDays(today, 45)) return null;
    return {
      key: cfg.key,
      name: cfg.name,
      emoji: cfg.emoji || '📅',
      kind: cfg.kind || 'festival',
      start: begin,
      end: end,
      duration: Math.max(1, cfg.duration || 1),
      lunarLabel: lunarLabelText || cfg.lunarLabel || ''
    };
  }

  function pushUnique(list, event) {
    if (!event) return;
    const key = event.key + '|' + ymd(event.start);
    if (list.some(function (e) { return (e.key + '|' + ymd(e.start)) === key; })) return;
    list.push(event);
  }

  function collectEvents(now, birthday) {
    const today = startOfDay(now);
    const events = [];
    const years = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1, today.getFullYear() + 2];

    SOLAR_FESTIVALS.forEach(function (cfg) {
      years.forEach(function (year) {
        pushUnique(events, eventFromConfig(cfg, new Date(year, cfg.month - 1, cfg.day), today, ''));
      });
    });

    years.forEach(function (year) {
      pushUnique(events, eventFromConfig({ key: 'qingming', name: '清明节', duration: 1, emoji: '🌱' }, qingmingDate(year), today, ''));
      pushUnique(events, eventFromConfig({ key: 'muqin', name: '母亲节', duration: 1, emoji: '💐' }, nthWeekdayOfMonth(year, 4, 0, 2), today, ''));
      pushUnique(events, eventFromConfig({ key: 'fuqin', name: '父亲节', duration: 1, emoji: '👔' }, nthWeekdayOfMonth(year, 5, 0, 3), today, ''));
    });

    // 农历节日：只扫当前前后这段窗口，比整年查表更稳，也不依赖外部库。
    const from = addDays(today, -12);
    const to = addDays(today, 45);
    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
      const lp = lunarParts(cursor);
      if (!lp) continue;
      if (!lp.leap) {
        LUNAR_FESTIVALS.forEach(function (cfg) {
          if (lp.month === cfg.month && lp.day === cfg.day) {
            pushUnique(events, eventFromConfig(cfg, cursor, today, cfg.lunarLabel));
          }
        });
      }
      const nextLp = lunarParts(addDays(cursor, 1));
      if (lp.month === 12 && nextLp && nextLp.month === 1 && nextLp.day === 1 && !nextLp.leap) {
        pushUnique(events, eventFromConfig({ key: 'chuxi', name: '除夕', duration: 1, emoji: '🧧' }, cursor, today, '腊月最后一天'));
      }
    }

    if (birthday) {
      const bCfg = {
        key: 'birthday',
        name: '用户生日',
        duration: 1,
        emoji: '🎂',
        kind: 'birthday',
        lunarLabel: birthday.calendar === 'lunar' ? '农历' + lunarLabel(birthday.month, birthday.day) : ''
      };
      if (birthday.calendar === 'lunar') {
        for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
          const lp = lunarParts(cursor);
          if (lp && !lp.leap && lp.month === birthday.month && lp.day === birthday.day) {
            pushUnique(events, eventFromConfig(bCfg, cursor, today, bCfg.lunarLabel));
          }
        }
      } else {
        years.forEach(function (year) {
          pushUnique(events, eventFromConfig(bCfg, new Date(year, birthday.month - 1, birthday.day), today, ''));
        });
      }
    }

    return events;
  }

  function phaseOf(event, now) {
    const today = startOfDay(now);
    if (today < event.start) {
      const days = dayDiff(event.start, today);
      return { key: 'upcoming', days: days };
    }
    if (today <= event.end) {
      return { key: 'ongoing', dayNo: dayDiff(today, event.start) + 1 };
    }
    const since = dayDiff(today, event.end);
    if (since <= AFTER_DAYS) return { key: 'ended', days: since };
    return null;
  }

  function eventLine(event, phase) {
    const lunar = event.lunarLabel ? '（' + event.lunarLabel + '）' : '';
    if (phase.key === 'upcoming') {
      const when = phase.days === 1 ? '明天' : phase.days === 2 ? '后天' : ('还有 ' + phase.days + ' 天');
      return '- ' + event.emoji + ' ' + event.name + lunar + '：' + when + '（' + monthDay(event.start) + '）';
    }
    if (phase.key === 'ongoing') {
      if (event.duration > 1) {
        return '- ' + event.emoji + ' ' + event.name + lunar + '：今天正在过，第 ' + phase.dayNo + ' 天（' + monthDay(event.start) + '—' + monthDay(event.end) + '）';
      }
      return '- ' + event.emoji + ' ' + event.name + lunar + '：今天就是';
    }
    const when = phase.days === 1 ? '昨天' : (phase.days + ' 天前');
    return '- ' + event.emoji + ' ' + event.name + lunar + '：' + when + '刚结束（' + monthDay(event.end) + '）';
  }

  function nextBirthdayLine(birthday, events, now) {
    if (!birthday) return '- 用户生日：未设置（不要猜、不要假装知道用户生日）。';
    const base = '- 用户生日：' + birthdayText(birthday);
    const today = startOfDay(now);
    const own = events.filter(function (e) { return e.kind === 'birthday'; })
      .sort(function (a, b) { return a.start - b.start; });
    const next = own.filter(function (e) { return e.start >= today; })[0];
    if (next) {
      const days = dayDiff(next.start, today);
      if (days === 0) return base + '；今天就是。';
      if (days <= LEAD_DAYS) return base + '；还有 ' + days + ' 天。';
      return base + '；下次在 ' + monthDay(next.start) + '，现在还早，不要主动提。';
    }
    const recent = own.filter(function (e) { return e.end < today; })
      .sort(function (a, b) { return b.end - a.end; })[0];
    if (recent) {
      const since = dayDiff(today, recent.end);
      if (since <= AFTER_DAYS) {
        const when = since === 1 ? '昨天' : (since + ' 天前');
        return base + '；' + when + '刚过，可以轻轻回味，但别反复提。';
      }
    }
    if (birthday.calendar === 'solar') {
      const nextDate = new Date(today.getFullYear() + (today.getMonth() + 1 > birthday.month || (today.getMonth() + 1 === birthday.month && today.getDate() > birthday.day) ? 1 : 0), birthday.month - 1, birthday.day);
      return base + '；下次在 ' + nextDate.getFullYear() + '年' + monthDay(nextDate) + '，现在还早，不要主动提。';
    }
    return base + '；只在临近 7 天、当天、结束后 3 天内自然提到。';
  }

  function buildContext(now, options) {
    const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
    const today = startOfDay(at);
    const opts = options || {};
    const birthday = Object.prototype.hasOwnProperty.call(opts, 'birthday') ? normalizeBirthdayObject(opts.birthday) : readUserBirthday();
    const events = collectEvents(today, birthday);
    const upcoming = [];
    const ongoing = [];
    const ended = [];

    events.forEach(function (event) {
      const phase = phaseOf(event, today);
      if (!phase) return;
      if (phase.key === 'upcoming' && phase.days <= LEAD_DAYS) upcoming.push({ event: event, phase: phase });
      if (phase.key === 'ongoing') ongoing.push({ event: event, phase: phase });
      if (phase.key === 'ended') ended.push({ event: event, phase: phase });
    });

    const sortByStart = function (a, b) { return a.event.start - b.event.start; };
    upcoming.sort(sortByStart);
    ongoing.sort(sortByStart);
    ended.sort(function (a, b) { return b.event.end - a.event.end; });

    const lp = lunarParts(today);
    const lunarText = lp ? ('农历' + lunarLabel(lp.month, lp.day) + (lp.leap ? '（闰月）' : '')) : '农历日期暂不可用';
    const lines = [];
    lines.push('- 今天：' + today.getFullYear() + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日 ' + weekday(today) + ' · ' + lunarText + '。');
    lines.push(nextBirthdayLine(birthday, events, today));
    lines.push('- 临近（未来 ' + LEAD_DAYS + ' 天）：' + (upcoming.length ? '' : '无。不要凭空编造节日或生日。'));
    upcoming.forEach(function (item) { lines.push(eventLine(item.event, item.phase)); });
    lines.push('- 今天正在过：' + (ongoing.length ? '' : '无。'));
    ongoing.forEach(function (item) { lines.push(eventLine(item.event, item.phase)); });
    lines.push('- 刚结束（过去 ' + AFTER_DAYS + ' 天内）：' + (ended.length ? '' : '无。'));
    ended.forEach(function (item) { lines.push(eventLine(item.event, item.phase)); });
    lines.push('- 提及规则：只在上面列出的真实日期和窗口内提。临近时可以自然地问她有没有安排、想怎么过；当天要主动祝福或陪她过节；结束后 1-3 天可以轻轻回味，不要硬拗。不要把节日当成每句话的开场白，也不要为了过节改变角色卡的关系边界。');

    return {
      date: ymd(today),
      lunar: lunarText,
      birthday: birthday,
      upcoming: upcoming,
      ongoing: ongoing,
      ended: ended,
      prompt: '【日历与重要日子感知（生日 / 节日 / 节前节后）】：\n' + lines.join('\n')
    };
  }

  let cachedKey = '';
  let cachedContext = null;

  function getCalendarContext(now, options) {
    return buildContext(now, options);
  }

  function getCalendarPromptBlock() {
    try {
      const b = readUserBirthday();
      const key = ymd(startOfDay(new Date())) + '|' + (b ? (b.calendar + b.month + '-' + b.day) : 'none');
      if (cachedKey === key && cachedContext) return cachedContext.prompt;
      cachedContext = buildContext(new Date());
      cachedKey = key;
      return cachedContext.prompt;
    } catch (e) {
      return '【日历与重要日子感知】：日历暂时读不到。不要编造节日或生日；用户主动提到时再自然回应。';
    }
  }

  window.getCalendarContext = getCalendarContext;
  window.getCalendarPromptBlock = getCalendarPromptBlock;
  window.parseBirthdayInput = parseBirthdayInput;
  window.readUserBirthday = readUserBirthday;
  window.normalizeBirthdayObject = normalizeBirthdayObject;
})();
