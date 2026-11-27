/* Lernbegleiter
 * Reine PWA, alle Daten liegen lokal im Browser (localStorage).
 * Weitere Dateien: quotes.js (Sprüche des Tages), games.js (Rätsel und Spielecke).
 */
'use strict';

/* ---------- Grundlagen ---------- */

const STORE_KEY = 'lernbegleiter.v1';
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTHS_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const COLORS = ['#f87171', '#fb923c', '#facc15', '#a3e635', '#34d399', '#22d3ee', '#60a5fa', '#818cf8', '#c084fc', '#f472b6', '#94a3b8', '#e2e8f0'];
const EVENT_TYPES = ['Klassenarbeit', 'Test', 'Referat', 'Abgabe', 'Sonstiges'];

const XP = { ranzen: 5, briefing: 5, hwDone: 10, hwOnTime: 5, hwSelf: 5, dayGoal: 20, weekGoal: 50 };
const STREAK_BONUS_FROM = 5;
const STREAK_MULT = 1.2;
const WEEK_GOAL_DAYS = 4;

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const todayISO = () => iso(new Date());
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function isoWeekKey(s) {
  const d = parse(s);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t - y0) / 864e5 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(w)}`;
}
const mondayOf = s => { const d = parse(s); const wd = d.getDay() || 7; return addDays(s, 1 - wd); };

function fmtDate(s, withWeekday = true) {
  const d = parse(s);
  return `${withWeekday ? WD_SHORT[d.getDay()] + ', ' : ''}${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}
function relDay(s) {
  const n = diffDays(todayISO(), s);
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === 2) return 'übermorgen';
  if (n === -1) return 'gestern';
  if (n < 0) return `vor ${-n} Tagen`;
  if (n < 7) return WEEKDAYS[parse(s).getDay()];
  return `in ${n} Tagen`;
}

/* ---------- Zustand ---------- */

const DEFAULT_EQUIPPED = { color: 'c-cyan', antenna: 'a-basic', eyes: 'e-basic', extra: 'x-none', buddy: 'b-none', room: 'r-none', theme: 't-amber', title: 'ti-rekrut' };

function defaultState() {
  const subj = (name, color, items) => ({ id: uid(), name, color, items });
  const subjects = [
    subj('Deutsch', '#f87171', ['Deutschbuch', 'Deutschheft']),
    subj('Mathe', '#60a5fa', ['Mathebuch', 'Matheheft', 'Geodreieck', 'Taschenrechner']),
    subj('Englisch', '#34d399', ['Englischbuch', 'Workbook']),
    subj('Biologie', '#a3e635', ['Bio-Mappe']),
    subj('Geschichte', '#fb923c', ['Geschichtsheft']),
    subj('Erdkunde', '#22d3ee', ['Atlas']),
    subj('Physik', '#818cf8', ['Physikheft']),
    subj('Kunst', '#f472b6', ['Kunstsachen']),
    subj('Musik', '#c084fc', ['Musikheft']),
    subj('Sport', '#facc15', ['Sportsachen', 'Turnschuhe']),
    subj('Religion', '#94a3b8', ['Reliheft'])
  ];
  return {
    version: 1,
    settings: {
      name: '',
      afterSchoolHour: 14,
      ranzen: false, // Taschen-Check (für Jüngere), in den Einstellungen einschaltbar
      extras: false, // Werkstatt, Rätsel und Sticker, in den Einstellungen einschaltbar
      baseItems: ['Federmäppchen', 'iPad geladen', 'Trinkflasche'],
      holidays: [],
      syncUrl: '',
      syncKey: ''
    },
    sync: null,
    subjects,
    homework: [],
    events: [],
    xp: 0,
    log: [],
    days: {},
    weeks: {},
    ranzen: { date: null, checked: [] },
    equipped: { ...DEFAULT_EQUIPPED },
    stickers: {},
    badges: {},
    games: {},
    bestStreak: 0,
    daily: null
  };
}

function normalize(data) {
  const d = defaultState();
  const s = Object.assign(d, data);
  s.settings = Object.assign(defaultState().settings, data.settings || {});
  s.equipped = Object.assign({ ...DEFAULT_EQUIPPED }, data.equipped || {});
  s.stickers ||= {}; s.badges ||= {}; s.games ||= {};
  return s;
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { console.warn('Laden fehlgeschlagen', e); }
  return defaultState();
}
let S = load();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { toast('Speichern hat nicht geklappt. Speicher voll?'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const subjectById = id => S.subjects.find(s => s.id === id);
const ranzenOn = () => !!S.settings.ranzen;
const extrasOn = () => !!S.settings.extras;
const packedOk = rec => !ranzenOn() || !!rec.ranzen; // ohne Taschen-Check zählt dieser Teil als erledigt
const greetName = () => S.settings.name ? ' ' + S.settings.name : '';
const dayRec = d => (S.days[d] ||= {});

/* ---------- Schultage, Serie, Level ---------- */

function inHoliday(s) {
  return S.settings.holidays.some(h => s >= h.from && s <= h.to);
}
function isSchoolDay(s) {
  const wd = parse(s).getDay();
  return wd >= 1 && wd <= 5 && !inHoliday(s);
}
function nextSchoolDay(s, includeSelf = false) {
  let d = includeSelf ? s : addDays(s, 1);
  for (let i = 0; i < 60; i++) { if (isSchoolDay(d)) return d; d = addDays(d, 1); }
  return d;
}
/* Ordnet ein Fach aus WebUntis (Langname oder Kürzel) einem Fach der App zu. */
function matchSubject(name, short) {
  const n = String(name || '').toLowerCase().trim();
  const k = String(short || '').toLowerCase().trim();
  if (!n && !k) return null;
  return S.subjects.find(s => s.short && k && s.short.toLowerCase() === k)
    || S.subjects.find(s => s.name.toLowerCase() === n || (k && s.name.toLowerCase() === k))
    || S.subjects.find(s => n && (s.name.toLowerCase().startsWith(n) || n.startsWith(s.name.toLowerCase())))
    || S.subjects.find(s => n.length > 3 && n.includes(s.name.toLowerCase()))
    || S.subjects.find(s => k.length >= 1 && s.name.toLowerCase().startsWith(k))
    || null;
}
function subjectFor(name, short) {
  return matchSubject(name, short) || { id: 'x:' + (short || name), name: name || short || 'Unterricht', color: '#94a3b8', items: [] };
}

/* Stunden eines Tages. Der Stundenplan kommt nur noch aus WebUntis. */
function lessonsOn(s) {
  if (inHoliday(s)) return [];
  const synced = S.sync && Array.isArray(S.sync.lessons) ? S.sync.lessons.filter(l => l.date === s) : [];
  return synced.map((l, i) => ({ nr: i + 1, time: l.start, end: l.end, subj: subjectFor(l.subject, l.short), status: l.status, info: l.info, room: l.room }));
}
const syncConfigured = () => !!(S.settings.syncUrl && S.settings.syncKey);

/* Serie: zählt Schultage mit Aktivität. Wochenenden und Ferien unterbrechen nicht.
 * Ein verpasster Schultag pro Woche wird automatisch durch den Joker gerettet. */
function streakInfo() {
  const today = todayISO();
  let d = today, count = 0;
  const jokerWeeks = new Set();
  const jokerDays = [];
  for (let i = 0; i < 400; i++) {
    if (isSchoolDay(d)) {
      const active = S.days[d] && S.days[d].active;
      if (active) count++;
      else if (d === today) { /* heute zählt noch nicht als verpasst */ }
      else {
        const wk = isoWeekKey(d);
        if (!jokerWeeks.has(wk)) { jokerWeeks.add(wk); jokerDays.push(d); }
        else break;
      }
    }
    d = addDays(d, -1);
  }
  // Ein Joker, der vor dem ersten aktiven Tag läge, wurde nicht wirklich gebraucht.
  const firstActive = Object.keys(S.days).filter(k => S.days[k].active).sort()[0];
  const used = jokerDays.filter(j => firstActive && j > firstActive);
  const thisWeek = isoWeekKey(today);
  return { count, jokerUsedThisWeek: used.some(j => isoWeekKey(j) === thisWeek) };
}

function levelThreshold(level) { // Gesamt-XP, die für dieses Level nötig sind (Level 1 = 0)
  let t = 0;
  for (let n = 1; n < level; n++) t += 100 + 50 * (n - 1);
  return t;
}
function levelInfo(xp = S.xp) {
  let lvl = 1;
  while (xp >= levelThreshold(lvl + 1)) lvl++;
  const from = levelThreshold(lvl), to = levelThreshold(lvl + 1);
  return { lvl, from, to, pct: Math.min(100, Math.round((xp - from) / (to - from) * 100)) };
}

/* ---------- XP vergeben ---------- */

function award(base, reason, key) {
  if (key && S.log.some(l => l.k === key)) return 0;
  const before = levelInfo().lvl;
  const bonus = streakInfo().count >= STREAK_BONUS_FROM;
  const amount = bonus ? Math.round(base * STREAK_MULT) : base;
  S.xp += amount;
  S.log.unshift({ d: todayISO(), a: amount, r: reason, k: key || null });
  S.log = S.log.slice(0, 1500);
  const after = levelInfo().lvl;
  if (after > before) {
    const game = GAMES.find(g => g.lvl === after);
    setTimeout(() => toast(`Level ${after}! ${game ? 'Neu in der Spielecke: ' + game.name : 'Neues in der Werkstatt'}`, 'level'), 900);
  }
  return amount;
}
function revoke(key) {
  const idx = S.log.findIndex(l => l.k === key);
  if (idx < 0) return 0;
  const [entry] = S.log.splice(idx, 1);
  S.xp = Math.max(0, S.xp - entry.a);
  return entry.a;
}

function markActive() {
  dayRec(todayISO()).active = true;
}

let goalJustReached = false;
function checkGoals() {
  const today = todayISO();
  let gained = 0;
  const rec = dayRec(today);
  const tomorrow = nextSchoolDay(today);
  const openSoon = S.homework.filter(h => !h.doneAt && h.due <= tomorrow);
  if (!rec.goal && packedOk(rec) && openSoon.length === 0) {
    rec.goal = true;
    goalJustReached = true;
    gained += award(XP.dayGoal, 'Tagesziel erreicht', 'goal:' + today);
  }
  const wk = isoWeekKey(today);
  if (weekGoalCount() >= WEEK_GOAL_DAYS && !S.weeks[wk]) {
    S.weeks[wk] = true;
    gained += award(XP.weekGoal, 'Wochenziel erreicht', 'week:' + wk);
  }
  return gained;
}
function weekGoalCount() {
  const mon = mondayOf(todayISO());
  let n = 0;
  for (let i = 0; i < 7; i++) { const r = S.days[addDays(mon, i)]; if (r && r.goal) n++; }
  return n;
}

function afterAction(gained, msg) {
  gained += checkGoals();
  checkBadges();
  save();
  if (goalJustReached) { goalJustReached = false; toast(`+${gained} XP · Tagesziel geschafft${extrasOn() ? ', das Tagesrätsel ist frei' : ''}`, 'level'); }
  else if (gained > 0) toast(`+${gained} XP${msg ? ' · ' + msg : ''}`);
  render();
}

/* ---------- Abzeichen ---------- */

const countLog = prefix => S.log.filter(l => l.k && l.k.startsWith(prefix)).length;
const BADGES = [
  { id: 'start', code: 'GO', name: 'Gestartet', desc: 'Die ersten XP gesammelt', test: () => S.xp > 0 },
  { id: 'ranzen20', code: 'R20', name: 'Gut gepackt', desc: '20 Taschen-Checks', needs: 'ranzen', test: () => countLog('ranzen:') >= 20 },
  { id: 'ontime10', code: 'P10', name: 'Pünktlich', desc: '10 Hausaufgaben pünktlich erledigt', test: () => countLog('hwt:') >= 10 },
  { id: 'self5', code: 'S5', name: 'Selbstständig', desc: '5 selbst eingetragene Aufgaben erledigt', test: () => countLog('hws:') >= 5 },
  { id: 'week1', code: 'W1', name: 'Wochensieg', desc: 'Erstes Wochenziel geschafft', test: () => countLog('week:') >= 1 },
  { id: 'week5', code: 'W5', name: 'Dauerläufer', desc: '5 Wochenziele geschafft', test: () => countLog('week:') >= 5 },
  { id: 'streak5', code: '5', name: 'Serie 5', desc: '5 Schultage am Stück', test: () => S.bestStreak >= 5 },
  { id: 'streak10', code: '10', name: 'Serie 10', desc: '10 Schultage am Stück', test: () => S.bestStreak >= 10 },
  { id: 'streak25', code: '25', name: 'Serie 25', desc: '25 Schultage am Stück', test: () => S.bestStreak >= 25 },
  { id: 'puzzle1', needs: 'extras', code: 'T1', name: 'Tüftler', desc: 'Erstes Tagesrätsel gelöst', test: () => Object.keys(S.stickers).length >= 1 },
  { id: 'puzzle10', needs: 'extras', code: 'T10', name: 'Rätselfuchs', desc: '10 Tagesrätsel gelöst', test: () => Object.keys(S.stickers).length >= 10 },
  { id: 'sudoku9', needs: 'extras', code: '9×9', name: 'Großmeister', desc: 'Ein Sudoku 9×9 gelöst', test: () => !!S.games.sudoku9 },
  { id: 'level10', code: 'L10', name: 'Level 10', desc: 'Level 10 erreicht', test: () => levelInfo().lvl >= 10 }
];
const shownBadges = () => BADGES.filter(b => !b.needs || S.settings[b.needs]);
function checkBadges() {
  const fresh = shownBadges().filter(b => !S.badges[b.id] && b.test());
  fresh.forEach(b => { S.badges[b.id] = todayISO(); });
  if (fresh.length) setTimeout(() => toast(`Neues Abzeichen: ${fresh.map(b => b.name).join(', ')}`, 'level'), 1600);
}
function badgeSVG(b, earned) {
  return `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
    <path d="M24 3 L42 13.5 L42 34.5 L24 45 L6 34.5 L6 13.5 Z" fill="${earned ? 'var(--accent)' : 'none'}" stroke="${earned ? 'var(--accent)' : 'var(--line-strong)'}" stroke-width="2" ${earned ? '' : 'stroke-dasharray="4 3"'}/>
    <text x="24" y="28.5" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="${b.code.length > 2 ? 10 : 12}" font-weight="700" fill="${earned ? 'var(--accent-ink)' : 'var(--muted)'}">${esc(b.code)}</text>
  </svg>`;
}

/* ---------- Spruch des Tages ---------- */

function schoolYearStart(s) {
  const d = parse(s);
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-08-01`;
}
function pickFrom(list, key, n) {
  // Jedes Schuljahr eine neue Reihenfolge, innerhalb des Jahres keine Wiederholung, solange die Liste reicht.
  const order = shuffled(range(list.length), mulberry32(seedFrom(key)));
  return list[order[((n % list.length) + list.length) % list.length]];
}
function fill(t, vars) { return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''); }

function quoteOfDay(s = todayISO()) {
  const wd = parse(s).getDay();
  const start = schoolYearStart(s);
  const dayN = diffDays(start, s);
  if (inHoliday(s)) return pickFrom(QUOTES.holiday, 'h' + start, dayN);
  // Test heute (vor Schulschluss) oder am nächsten Schultag
  const evName = e => { const sb = subjectById(e.subjectId); return e.type + (sb ? ' in ' + sb.name : ''); };
  const hour = new Date().getHours();
  const todayEv = S.events.find(e => e.date === s && ['Klassenarbeit', 'Test'].includes(e.type));
  if (todayEv && hour < S.settings.afterSchoolHour) return fill(pickFrom(QUOTES.testToday, 'tt' + start, dayN), { was: evName(todayEv) });
  const next = nextSchoolDay(s);
  const nextEv = S.events.find(e => e.date === next && ['Klassenarbeit', 'Test'].includes(e.type));
  if (nextEv) {
    const wann = diffDays(s, next) === 1 ? 'Morgen' : 'Am ' + WEEKDAYS[parse(next).getDay()];
    return fill(pickFrom(QUOTES.testSoon, 'ts' + start, dayN), { wann, was: evName(nextEv) });
  }
  if (isSchoolDay(s) && (inHoliday(addDays(s, -1)) || (wd === 1 && inHoliday(addDays(s, -3))))) return pickFrom(QUOTES.backToSchool, 'b' + start, dayN);
  const st = streakInfo().count;
  if ([5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200].includes(st) && S.days[s] && S.days[s].active) {
    return fill(pickFrom(QUOTES.streak, 's' + start, st), { n: st });
  }
  // Zähler je Wochentagsgruppe seit Schuljahresbeginn
  let n = 0;
  const group = wd === 1 ? 'monday' : wd === 5 ? 'friday' : wd === 0 || wd === 6 ? 'weekend' : 'general';
  for (let d = start; d < s; d = addDays(d, 1)) {
    const w = parse(d).getDay();
    const g = w === 1 ? 'monday' : w === 5 ? 'friday' : w === 0 || w === 6 ? 'weekend' : 'general';
    if (g === group) n++;
  }
  return pickFrom(QUOTES[group], group + start, n);
}

/* ---------- UI-Helfer ---------- */

let toastTimer;
function toast(text, kind) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, kind === 'level' ? 3600 : 2600);
}

function subjectDot(s) { return `<span class="dot" style="background:${esc(s ? s.color : '#94a3b8')}"></span>`; }
function subjectOptions(selected, allowNone = true) {
  return (allowNone ? `<option value="">– ohne Fach –</option>` : '') +
    S.subjects.map(s => `<option value="${esc(s.id)}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
}

function dueClass(due) {
  const n = diffDays(todayISO(), due);
  if (n < 0) return 'due-late';
  if (n <= 1) return 'due-soon';
  return '';
}
function countdownBadge(date) {
  const n = diffDays(todayISO(), date);
  const cls = n <= 1 ? 'now' : n <= 7 ? 'soon' : '';
  const label = n === 0 ? 'heute' : n === 1 ? 'morgen' : `noch ${n} Tage`;
  return `<span class="countdown ${cls}">${label}</span>`;
}
const ICON = {
  play: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5v14l12-7z" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};
const boxMark = done => done ? ICON.check : '';

/* ---------- Ansicht: Heute ---------- */

function targetDay() {
  const now = new Date();
  const today = todayISO();
  const after = now.getHours() >= S.settings.afterSchoolHour;
  if (isSchoolDay(today) && !after) return { date: today, label: 'Heute' };
  const next = nextSchoolDay(today);
  const label = diffDays(today, next) === 1 ? 'Morgen' : WEEKDAYS[parse(next).getDay()];
  return { date: next, label };
}

function ranzenItems(date) {
  const items = [];
  const seen = new Set();
  const push = (txt, meta) => { const k = txt.toLowerCase(); if (!seen.has(k)) { seen.add(k); items.push({ txt, meta }); } };
  const subs = [];
  lessonsOn(date).filter(l => l.status !== 'cancelled').forEach(l => { if (!subs.some(x => x.id === l.subj.id)) subs.push(l.subj); });
  subs.forEach(s => (s.items || []).forEach(i => push(i, s.name)));
  S.settings.baseItems.forEach(i => push(i, ''));
  return items;
}

function briefingText() {
  const name = greetName();
  const today = todayISO();
  const t = targetDay();
  const lessons = lessonsOn(t.date);
  const lines = [];
  const hour = new Date().getHours();
  lines.push(hour < 11 ? `Moin${name}.` : hour < 17 ? `Hey${name}.` : `Abend${name}.`);
  lines.push(`Spruch des Tages: ${quoteOfDay()}`);
  if (lessons.length) {
    const running = lessons.filter(l => l.status !== 'cancelled');
    const names = [];
    running.forEach(l => { if (!names.includes(l.subj.name)) names.push(l.subj.name); });
    if (running.length && running[0].time) {
      lines.push(`${t.label} hast du ${running.length} Stunden, los geht's um ${running[0].time} Uhr: ${names.join(', ')}.`);
    } else if (running.length) {
      lines.push(`${t.label} hast du ${running.length} Stunden: ${names.join(', ')}.`);
    }
    const cancelled = lessons.filter(l => l.status === 'cancelled');
    if (cancelled.length) lines.push(`Fällt aus: ${cancelled.map(l => (l.time ? l.time + ' Uhr ' : '') + l.subj.name).join(', ')}.`);
    const changed = lessons.filter(l => l.status === 'changed');
    if (changed.length) lines.push(`Geändert: ${changed.map(l => l.subj.name + (l.info ? ' (' + l.info + ')' : '')).join(', ')}.`);
  } else if (!inHoliday(t.date)) {
    lines.push(`Für ${t.label === 'Heute' ? 'heute' : t.label === 'Morgen' ? 'morgen' : t.label} habe ich noch keinen Stundenplan aus WebUntis.`);
  }
  const items = ranzenOn() ? ranzenItems(t.date).map(i => i.txt) : [];
  if (items.length) lines.push(`Einpacken: ${items.join(', ')}.`);
  const open = S.homework.filter(h => !h.doneAt).sort((a, b) => a.due.localeCompare(b.due));
  const late = open.filter(h => h.due < today);
  const soon = open.filter(h => h.due >= today && h.due <= t.date);
  if (late.length) lines.push(`Achtung, ${late.length === 1 ? 'eine Hausaufgabe ist' : late.length + ' Hausaufgaben sind'} schon überfällig.`);
  if (soon.length) {
    lines.push(`Bis ${t.label === 'Heute' ? 'heute' : t.label === 'Morgen' ? 'morgen' : t.label} fällig: ` +
      soon.map(h => `${subjectById(h.subjectId)?.name || 'Sonstiges'}: ${h.text}`).join('; ') + '.');
  } else if (!late.length) {
    lines.push('Bis dahin ist keine Hausaufgabe fällig.');
  }
  const upcoming = S.events.filter(e => e.date >= today && diffDays(today, e.date) <= 7).sort((a, b) => a.date.localeCompare(b.date));
  upcoming.forEach(e => {
    const subj = subjectById(e.subjectId)?.name;
    const rd = relDay(e.date);
    lines.push(`${e.type}${subj ? ' in ' + subj : ''} ${rd === 'heute' ? 'ist heute' : ['morgen', 'übermorgen'].includes(rd) || rd.startsWith('in ') ? 'ist ' + rd : 'am ' + rd}${e.topic ? ', Thema: ' + e.topic : ''}.`);
  });
  const st = streakInfo().count;
  if (st >= 2) lines.push(`Deine Serie steht bei ${st} Schultagen.`);
  lines.push('Viel Erfolg.');
  return lines;
}

let speaking = false;
function speak(lines) {
  if (!('speechSynthesis' in window)) { toast('Vorlesen geht in diesem Browser leider nicht.'); return; }
  const synth = window.speechSynthesis;
  if (speaking) { synth.cancel(); speaking = false; render(); return; }
  const u = new SpeechSynthesisUtterance(lines.join(' '));
  u.lang = 'de-DE';
  const voice = synth.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('de'));
  if (voice) u.voice = voice;
  u.rate = 1.02;
  u.onend = u.onerror = () => { speaking = false; render(); };
  speaking = true;
  synth.speak(u);
  render();
}

/* Was ist als Nächstes dran? Genau eine Sache, damit der Anfang leicht fällt. */
function nextAction(t, rec) {
  const today = todayISO();
  const horizon = nextSchoolDay(today);
  const open = S.homework.filter(h => !h.doneAt).sort((a, b) => a.due.localeCompare(b.due));
  const items = ranzenOn() ? ranzenItems(t.date) : [];
  const missing = items.filter(i => !S.ranzen.checked.includes(i.txt)).length;
  // Das Kind kann selbst wählen, was er als Nächstes macht. Die Wahl gilt bis sie erledigt ist oder bis morgen.
  const pick = S.nextPick && S.nextPick.date === today ? S.nextPick.id : null;
  if (pick === 'ranzen' && !rec.ranzen && missing) return { kind: 'ranzen', missing, chosen: true };
  const ph = pick && open.find(h => h.id === pick);
  if (ph) return { kind: 'hw', h: ph, label: 'Deine Wahl', chosen: true };
  const urgent = open.filter(h => h.due <= horizon);
  if (urgent.length) return { kind: 'hw', h: urgent[0], label: urgent[0].due < today ? 'Überfällig' : 'Als Nächstes' };
  if (!rec.ranzen && missing) return { kind: 'ranzen', missing };
  if (extrasOn() && rec.goal && !dailySolved()) return { kind: 'puzzle' };
  if (open.length) return { kind: 'hw', h: open[0], label: 'Vorarbeiten' };
  return { kind: 'free' };
}

let nextChoosing = false;
function nextChooser(a, t, rec) {
  const open = S.homework.filter(h => !h.doneAt).sort((x, y) => x.due.localeCompare(y.due));
  const opts = open.filter(h => !(a.kind === 'hw' && a.h.id === h.id)).map(h => {
    const s = subjectById(h.subjectId);
    return { id: h.id, tag: s ? `<span class="subj-tag" style="--c:${esc(s.color)}">${esc(s.name)}</span>` : '', text: h.text, meta: 'fällig ' + relDay(h.due) };
  });
  const missing = ranzenOn() ? ranzenItems(t.date).filter(i => !S.ranzen.checked.includes(i.txt)).length : 0;
  if (a.kind !== 'ranzen' && !rec.ranzen && missing) opts.push({ id: 'ranzen', tag: '', text: 'Tasche packen', meta: `noch ${missing} Sache${missing === 1 ? '' : 'n'}` });
  if (!opts.length && !a.chosen) return '';
  return `<div class="row tight chooser">
      ${opts.length ? `<button class="btn small ghost" data-action="next-choose">${nextChoosing ? 'Auswahl schließen' : `Lieber etwas anderes (${opts.length})`}</button>` : ''}
      ${a.chosen ? `<button class="btn small ghost" data-action="next-auto">Automatisch</button>` : ''}
    </div>
    ${nextChoosing && opts.length ? `<div class="pick-list">${opts.map(o => `<button class="pick" data-action="next-pick" data-id="${esc(o.id)}">
      <span class="pick-main">${o.tag}<b>${esc(o.text)}</b></span><span class="meta">${esc(o.meta)}</span></button>`).join('')}</div>` : ''}`;
}

/* Für welches Fach steht bald eine Arbeit oder ein Test an? */
function testFor(subjectId, from, days = 7) {
  if (!subjectId) return null;
  return S.events.filter(e => e.subjectId === subjectId && ['Klassenarbeit', 'Test'].includes(e.type) && e.date >= from && diffDays(from, e.date) <= days)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}
const subjTag = s => s ? `<span class="subj-tag" style="--c:${esc(s.color)}">${esc(s.name)}</span>` : '';

/* Ring: Tagesziel = (Tasche gepackt, falls eingeschaltet) + alles bis zum nächsten Schultag erledigt. */
function goalRing(rec) {
  const horizon = nextSchoolDay(todayISO());
  const hwOk = S.homework.filter(h => !h.doneAt && h.due <= horizon).length === 0;
  const total = ranzenOn() ? 2 : 1;
  const parts = (ranzenOn() && rec.ranzen ? 1 : 0) + (hwOk ? 1 : 0);
  const done = rec.goal ? total : Math.min(parts, total);
  const c = 2 * Math.PI * 46;
  return `<div class="ring" role="img" aria-label="Tagesziel ${done} von ${total}">
    <svg viewBox="0 0 112 112" aria-hidden="true"><circle class="track" cx="56" cy="56" r="46"/>${done ? `<circle class="bar" cx="56" cy="56" r="46" stroke-dasharray="${(c * done / total).toFixed(1)} ${c.toFixed(1)}"/>` : ''}</svg>
    <div class="rl"><div>${done === total ? ICON.check.replace('width="16" height="16"', 'width="30" height="30"') : done + '/' + total}<small>Tagesziel</small></div></div></div>`;
}

function nextCard(t, rec) {
  const a = nextAction(t, rec);
  let label, title, meta, extra = '', buttons;
  if (a.kind === 'hw') {
    const s = subjectById(a.h.subjectId);
    const ev = testFor(a.h.subjectId, todayISO());
    label = a.label;
    title = subjTag(s) + esc(a.h.text);
    meta = `fällig ${esc(relDay(a.h.due))}${a.h.source ? ' · aus ' + (a.h.source === 'webuntis' ? 'WebUntis' : 'itslearning') : ''}`;
    if (ev) { const rd = relDay(ev.date); extra = `<div><span class="countdown ${diffDays(todayISO(), ev.date) <= 1 ? 'now' : 'soon'}">${esc(ev.type)} ${rd === 'heute' || rd === 'morgen' || rd === 'übermorgen' || rd.startsWith('in ') ? esc(rd) : 'am ' + esc(rd)}</span></div>`; }
    buttons = `<button class="btn small primary" data-action="hw-toggle" data-id="${esc(a.h.id)}">${ICON.check} Erledigt</button>`;
  } else if (a.kind === 'ranzen') {
    label = 'Als Nächstes';
    title = `Tasche packen für ${esc(t.label === 'Heute' ? 'heute' : t.label === 'Morgen' ? 'morgen' : t.label)}`;
    meta = `Noch ${a.missing} Sache${a.missing === 1 ? '' : 'n'}`;
    buttons = `<button class="btn small primary" data-action="scroll-ranzen">Zum Taschen-Check</button>`;
  } else if (a.kind === 'puzzle') {
    const g = dailyGame();
    label = 'Tagesziel geschafft';
    title = 'Tagesrätsel: ' + esc(g.name);
    meta = 'Lösen und den Sticker fürs Album holen';
    buttons = `<button class="btn small primary" data-action="daily-start">Rätsel starten</button>`;
  } else {
    label = 'Alles erledigt';
    title = 'Nichts mehr offen. Feierabend.';
    meta = extrasOn() && dailySolved() ? 'Tagesrätsel gelöst, der Sticker ist im Album.' : 'Neue Aufgaben kommen automatisch aus WebUntis und itslearning.';
    buttons = '';
  }
  const today = todayISO();
  const horizon = nextSchoolDay(today);
  const openSoon = S.homework.filter(h => !h.doneAt && h.due <= horizon).length;
  const solved = dailySolved();
  return `<section class="card next-card ${a.label === 'Überfällig' ? 'late' : ''}">
    <div class="next">
      ${a.kind === 'puzzle' ? `<div class="ring sticker-ring">${stickerSVG(dailyGame().id, 72)}</div>` : goalRing(rec)}
      <div class="what">
        <span class="eyebrow">${label}</span>
        <div class="next-title">${title}</div>
        <div class="muted small">${meta}</div>
        ${extra}
      </div>
    </div>
    <div class="actions">${buttons}${nextChooser(a, t, rec)}</div>
    <div class="goalline" aria-label="Tagesziel">
      ${ranzenOn() ? `<span class="${rec.ranzen ? 'ok' : ''}">${rec.ranzen ? ICON.check + ' Tasche gepackt' : 'Tasche offen'}</span>` : ''}
      <span class="${openSoon === 0 ? 'ok' : ''}">${openSoon === 0 ? ICON.check + ' Aufgaben erledigt' : openSoon + (openSoon === 1 ? ' Aufgabe offen' : ' Aufgaben offen')}</span>
      ${extrasOn() ? `<span class="${solved ? 'ok' : rec.goal ? 'ready' : ''}">${solved ? ICON.check + ' Rätsel gelöst' : rec.goal ? 'Tagesrätsel frei' : ICON.lock + ' Tagesrätsel'}</span>` : ''}
      <span class="${S.weeks[isoWeekKey(today)] ? 'ok' : ''}">Woche ${weekGoalCount()}/${WEEK_GOAL_DAYS}</span>
    </div>
  </section>`;
}

/* Eine Unterrichtsstunde im Stil der Stundenkarten. */
function lessonRow(l, date, compact = false) {
  const first = !compact && lessonsOn(date).find(x => x.subj.id === l.subj.id && x.status !== 'cancelled') ;
  const ev = first && first.nr === l.nr && l.status !== 'cancelled' && S.events.find(e => e.date === date && e.subjectId === l.subj.id && ['Klassenarbeit', 'Test'].includes(e.type));
  const pill = l.status === 'cancelled' ? '<span class="pill p-bad">fällt aus</span>'
    : ev ? `<span class="pill p-grad">${esc(ev.type)}</span>`
    : l.status === 'changed' ? '<span class="pill p-warn">geändert</span>' : '';
  const meta = [l.room, l.info].filter(Boolean).join(' · ');
  return `<div class="lesson ${l.status === 'cancelled' ? 'cancelled' : ''}" style="--c:${esc(l.subj.color)}">
    <div class="time">${esc(l.time || l.nr + '.')}${l.end && !compact ? `<small>${esc(l.end)}</small>` : ''}</div>
    <div class="what"><div class="subj">${esc(l.subj.name)}</div>${meta ? `<div class="meta">${esc(meta)}</div>` : ''}</div>
    ${pill}
  </div>`;
}

const MOTTOS = ['Eins nach dem anderen.', 'Kurz rein, dann frei.', 'Schritt für Schritt.', 'Erst das Wichtige.', 'Läuft.', 'Dranbleiben.', 'Alles im Blick.'];

function viewToday() {
  const today = todayISO();
  const now = new Date();
  const t = targetDay();
  const lessons = lessonsOn(t.date);
  const rec = S.days[today] || {};

  if (S.ranzen.date !== t.date) S.ranzen = { date: t.date, checked: [] };
  const items = ranzenItems(t.date);
  const checked = new Set(S.ranzen.checked);
  const allPacked = items.length > 0 && items.every(i => checked.has(i.txt));

  const open = S.homework.filter(h => !h.doneAt).sort((a, b) => a.due.localeCompare(b.due));
  const shownHw = open.filter(h => diffDays(today, h.due) <= 7);
  const events = S.events.filter(e => e.date >= today && diffDays(today, e.date) <= 14).sort((a, b) => a.date.localeCompare(b.date));
  const tests = S.events.filter(e => e.date >= today && diffDays(today, e.date) <= 7 && ['Klassenarbeit', 'Test'].includes(e.type)).length;
  const tLower = t.label === 'Heute' ? 'heute' : t.label === 'Morgen' ? 'morgen' : t.label;
  const lv = levelInfo();
  const st = streakInfo();

  const greet = now.getHours() < 11 ? 'Moin' : now.getHours() < 17 ? 'Hey' : 'Guten Abend';
  const motto = rec.goal ? 'Für heute erledigt.' : MOTTOS[(Math.floor(parse(today) / 864e5)) % MOTTOS.length];
  const brief = briefingText().slice(2).filter(l => l !== 'Viel Erfolg.' && !l.startsWith('Deine Serie'));

  return `
  <div class="stack">
    <section class="hero">
      <div class="card hello-card">
        <div class="hello-top">
          <span class="eyebrow">Heute · ${WEEKDAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS_LONG[now.getMonth()]}${inHoliday(today) ? ' · Ferien' : ''}</span>
          <button class="xp" data-go="me" aria-label="Zu deinem Profil"><span class="streak">🔥 ${st.count}</span><span>Lv ${lv.lvl} · ${S.xp.toLocaleString('de-DE')} XP</span></button>
        </div>
        <h1>${greet}${esc(greetName())}. <span class="gradtext">${esc(motto)}</span></h1>
        <p class="quote">${esc(quoteOfDay())}</p>
        <div class="brief-text">${brief.map(l => `<p>${esc(l)}</p>`).join('')}</div>
        <div class="row tight">
          <button class="btn small primary" data-action="speak">${speaking ? ICON.stop + ' Stopp' : ICON.play + ' Briefing anhören'}</button>
          ${rec.briefing ? `<span class="pill p-good">${ICON.check} Briefing gelesen</span>` : `<button class="btn small ghost" data-action="briefing-done">Gelesen · +${XP.briefing} XP</button>`}
        </div>
      </div>
      ${nextCard(t, rec)}
    </section>

    <section class="stats">
      <button class="card stat c-accent" data-go="me"><span class="v">${lv.lvl}</span><span class="l">Level · noch ${(lv.to - S.xp).toLocaleString('de-DE')} XP</span></button>
      <button class="card stat c-violet" data-go="me"><span class="v">${st.count}</span><span class="l">${st.count === 1 ? 'Tag' : 'Tage'} Serie</span></button>
      <button class="card stat c-red" data-go="events"><span class="v">${tests}</span><span class="l">${tests === 1 ? 'Test' : 'Tests'} in 7 Tagen</span></button>
      <button class="card stat c-green" data-go="homework"><span class="v">${open.length}</span><span class="l">${open.length === 1 ? 'Aufgabe' : 'Aufgaben'} offen</span></button>
    </section>

    <div class="${ranzenOn() ? 'grid-2' : 'stack'}">
      <section class="card">
        <div class="card-head"><h2>Dein Tag ${esc(t.label === 'Heute' ? 'heute' : t.label === 'Morgen' ? 'morgen' : 'am ' + t.label)}</h2><span class="tag">${fmtDate(t.date)}</span></div>
        ${lessons.length ? `<div class="lessons">${lessons.map(l => lessonRow(l, t.date)).join('')}</div>`
        : inHoliday(t.date) ? `<p class="empty">Ferien.</p>`
        : syncConfigured() ? `<p class="empty">Für diesen Tag kommen noch keine Stunden aus WebUntis.</p>`
        : `<p class="empty">Der Stundenplan kommt aus WebUntis.</p><div class="row"><button class="btn small" data-action="open-settings">Schulanbindung einrichten</button></div>`}
      </section>

      ${ranzenOn() ? `<section class="card" id="ranzen">
        <div class="card-head"><h2>🎒 Tasche für ${esc(tLower)}</h2>${rec.ranzen ? `<span class="pill p-good">${ICON.check} gepackt</span>` : `<span class="tag">+${XP.ranzen} XP</span>`}</div>
        ${items.length ? `<ul class="check-list">${items.map(i => `
          <li><button class="check ${checked.has(i.txt) ? 'done' : ''}" data-action="pack" data-item="${esc(i.txt)}">
            <span class="box">${boxMark(checked.has(i.txt))}</span>
            <span class="label-txt">${esc(i.txt)}</span>
            ${i.meta ? `<span class="meta">${esc(i.meta)}</span>` : ''}
          </button></li>`).join('')}</ul>
          ${allPacked ? '' : `<div class="row"><button class="btn small ghost" data-action="pack-all">Alles drin</button></div>`}`
        : `<p class="empty">Nichts zu packen.</p>`}
      </section>` : ''}
    </div>

    <section class="card">
      <div class="card-head"><h2>Hausaufgaben</h2><button class="btn small ghost" data-action="hw-new">+ Neu</button></div>
      ${shownHw.length ? `<div class="list">${shownHw.map(hwRow).join('')}</div>`
        : `<p class="empty">${open.length ? 'Diese Woche ist nichts fällig.' : 'Keine offenen Hausaufgaben.'}</p>`}
      ${open.length > shownHw.length ? `<div class="row"><button class="btn small ghost" data-go="homework">Alle ${open.length} offenen ansehen</button></div>` : ''}
    </section>

    <section class="card">
      <div class="card-head"><h2>Bald dran</h2><button class="btn small ghost" data-action="ev-new">+ Termin</button></div>
      ${events.length ? `<div class="list">${events.map(evRow).join('')}</div>`
        : `<p class="empty">In den nächsten zwei Wochen stehen keine Arbeiten oder Tests an.</p>`}
    </section>
  </div>`;
}

function hwRow(h) {
  const s = subjectById(h.subjectId);
  const done = !!h.doneAt;
  const n = diffDays(todayISO(), h.due);
  const pill = done ? '' : n < 0 ? '<span class="pill p-bad">überfällig</span>' : n === 0 ? '<span class="pill p-warn">heute</span>' : n === 1 ? '<span class="pill p-warn">morgen</span>' : n <= 6 ? `<span class="pill p-blue">${WD_SHORT[parse(h.due).getDay()]}</span>` : '';
  return `<div class="hw ${done ? 'done' : ''}">
    <button class="box" data-action="hw-toggle" data-id="${esc(h.id)}" aria-label="${done ? 'Als offen markieren' : 'Erledigt'}">${boxMark(done)}</button>
    <div class="hw-main">
      <div class="text">${esc(h.text)}</div>
      <div class="sub">${esc(s ? s.name : 'Sonstiges')}${h.source ? ` · <span class="src">${h.source === 'webuntis' ? 'WebUntis' : 'itslearning'}</span>` : ''} · <span class="${done ? '' : dueClass(h.due)}">fällig ${esc(relDay(h.due))}</span></div>
    </div>
    <div class="row tight">${pill}<button class="icon-btn" data-action="hw-edit" data-id="${esc(h.id)}" aria-label="Bearbeiten">${ICON.edit}</button></div>
  </div>`;
}

function evRow(e) {
  const s = subjectById(e.subjectId);
  const d = parse(e.date);
  return `<div class="event">
    <div class="when"><div class="d">${d.getDate()}</div><div class="m">${WD_SHORT[d.getDay()]} · ${MONTHS[d.getMonth()]}</div></div>
    <div class="ev-main">
      <div class="title">${esc(e.type)}${s ? ' ' + esc(s.name) : ''}</div>
      <div class="muted small">${esc(e.topic || 'Kein Thema eingetragen')}</div>
    </div>
    <div class="row tight">${e.date >= todayISO() ? countdownBadge(e.date) : ''}
      <button class="icon-btn" data-action="ev-edit" data-id="${esc(e.id)}" aria-label="Bearbeiten">${ICON.edit}</button></div>
  </div>`;
}

/* ---------- Ansicht: Hausaufgaben ---------- */

function viewHomework() {
  const today = todayISO();
  const open = S.homework.filter(h => !h.doneAt).sort((a, b) => a.due.localeCompare(b.due));
  const late = open.filter(h => h.due < today);
  const upcoming = open.filter(h => h.due >= today);
  const done = S.homework.filter(h => h.doneAt && diffDays(h.doneAt, today) <= 14).sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  const section = (title, list, emptyText, cls = '') => `
    <section class="card ${cls}">
      <div class="card-head"><h2>${title}</h2><span class="tag">${list.length}</span></div>
      ${list.length ? `<div class="list">${list.map(hwRow).join('')}</div>` : `<p class="empty">${emptyText}</p>`}
    </section>`;
  return `
  <div class="stack">
    <div class="hello">
      <div><span class="label">Erledigt +${XP.hwDone} · pünktlich +${XP.hwOnTime} · selbst eingetragen +${XP.hwSelf}</span><h1>Aufgaben</h1></div>
      <button class="btn primary" data-action="hw-new">+ Neue Aufgabe</button>
    </div>
    ${late.length ? section('Überfällig', late, '', 'alert') : ''}
    ${section('Offen', upcoming, 'Alles erledigt.')}
    ${section('Erledigt in den letzten 14 Tagen', done, 'Noch nichts abgehakt.')}
  </div>`;
}

function nextLessonDate(subjectId) {
  if (!subjectId) return null;
  let d = todayISO();
  for (let i = 0; i < 21; i++) {
    d = addDays(d, 1);
    if (lessonsOn(d).some(l => l.subj.id === subjectId)) return d;
  }
  return null;
}

function openHomeworkDialog(id) {
  const h = id ? S.homework.find(x => x.id === id) : null;
  const defaultSubj = h ? h.subjectId : '';
  const due = h ? h.due : nextSchoolDay(todayISO());
  showDialog(`
    <form method="dialog" id="hw-form">
      <h2>${h ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h2>
      <label class="field">Fach
        <select name="subject">${subjectOptions(defaultSubj)}</select>
      </label>
      <label class="field">Was ist zu tun?
        <textarea name="text" required placeholder="z. B. S. 42 Nr. 3a–c">${esc(h ? h.text : '')}</textarea>
      </label>
      <label class="field">Fällig am
        <input type="date" name="due" value="${esc(due)}" required>
      </label>
      <div class="quick">
        <button type="button" class="btn small" data-due="next">Nächste Stunde</button>
        <button type="button" class="btn small" data-due="${esc(nextSchoolDay(todayISO()))}">Nächster Schultag</button>
        <button type="button" class="btn small" data-due="${esc(addDays(todayISO(), 7))}">In 1 Woche</button>
      </div>
      <div class="row end">
        ${h ? `<button type="button" class="btn danger ghost" data-action="hw-delete" data-id="${esc(h.id)}">Löschen</button><span class="spacer"></span>` : ''}
        <button type="button" class="btn ghost" data-close>Abbrechen</button>
        <button class="btn primary" value="ok">Speichern</button>
      </div>
    </form>`, form => {
    const data = new FormData(form);
    const text = String(data.get('text') || '').trim();
    if (!text) return false;
    const rec = { subjectId: data.get('subject') || '', text, due: String(data.get('due')) };
    if (h) Object.assign(h, rec);
    else S.homework.push({ id: uid(), created: todayISO(), self: true, doneAt: null, ...rec });
    save(); render();
    toast(h ? 'Gespeichert' : 'Eingetragen. Gibt XP, sobald sie erledigt ist.');
    return true;
  });
  const dlg = document.getElementById('dialog');
  dlg.querySelectorAll('[data-due]').forEach(b => b.addEventListener('click', () => {
    let v = b.dataset.due;
    if (v === 'next') {
      v = nextLessonDate(dlg.querySelector('[name=subject]').value);
      if (!v) { toast('Fach auswählen, das im Stundenplan steht'); return; }
    }
    dlg.querySelector('[name=due]').value = v;
  }));
}

function toggleHomework(id) {
  const h = S.homework.find(x => x.id === id);
  if (!h) return;
  if (h.doneAt) {
    h.doneAt = null;
    ['hw:', 'hwt:', 'hws:'].forEach(p => revoke(p + h.id));
    save(); render();
    return;
  }
  const today = todayISO();
  h.doneAt = today;
  markActive();
  let g = award(XP.hwDone, 'Hausaufgabe erledigt', 'hw:' + h.id);
  if (today <= h.due) g += award(XP.hwOnTime, 'Pünktlich erledigt', 'hwt:' + h.id);
  if (h.self) g += award(XP.hwSelf, 'Selbst eingetragen', 'hws:' + h.id);
  afterAction(g, 'Aufgabe erledigt');
}

/* ---------- Ansicht: Termine (eigener Schulkalender) ---------- */

function viewEvents() {
  const today = todayISO();
  const upcoming = S.events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = S.events.filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  return `
  <div class="stack">
    <div class="hello">
      <div><span class="label">Klassenarbeiten, Tests, Abgaben</span><h1>Termine</h1></div>
      <button class="btn primary" data-action="ev-new">+ Termin eintragen</button>
    </div>
    <section class="card">
      <div class="card-head"><h2>Kommt noch</h2><span class="tag">${upcoming.length}</span></div>
      ${upcoming.length ? `<div class="list">${upcoming.map(evRow).join('')}</div>`
        : `<p class="empty">Keine Termine eingetragen. Sobald eine Arbeit angekündigt wird: hier eintragen.</p>`}
    </section>
    ${past.length ? `<section class="card">
      <div class="card-head"><h2>Vorbei</h2></div>
      <div class="list">${past.map(evRow).join('')}</div>
    </section>` : ''}
    <p class="muted small">WebUntis gibt Prüfungstermine für Schülerkonten nicht heraus. Deshalb trägst du sie hier selbst ein. Am Tag davor erinnert dich der Spruch des Tages.</p>
  </div>`;
}

function openEventDialog(id) {
  const e = id ? S.events.find(x => x.id === id) : null;
  showDialog(`
    <form method="dialog">
      <h2>${e ? 'Termin bearbeiten' : 'Neuer Termin'}</h2>
      <label class="field">Art
        <select name="type">${EVENT_TYPES.map(t => `<option ${e && e.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </label>
      <label class="field">Fach
        <select name="subject">${subjectOptions(e ? e.subjectId : '')}</select>
      </label>
      <label class="field">Datum
        <input type="date" name="date" value="${esc(e ? e.date : addDays(todayISO(), 7))}" required>
      </label>
      <label class="field">Thema (optional)
        <input type="text" name="topic" value="${esc(e ? e.topic : '')}" placeholder="z. B. Bruchrechnung">
      </label>
      <div class="row end">
        ${e ? `<button type="button" class="btn danger ghost" data-action="ev-delete" data-id="${esc(e.id)}">Löschen</button><span class="spacer"></span>` : ''}
        <button type="button" class="btn ghost" data-close>Abbrechen</button>
        <button class="btn primary" value="ok">Speichern</button>
      </div>
    </form>`, form => {
    const d = new FormData(form);
    const rec = { type: String(d.get('type')), subjectId: d.get('subject') || '', date: String(d.get('date')), topic: String(d.get('topic') || '').trim() };
    if (e) Object.assign(e, rec); else S.events.push({ id: uid(), ...rec });
    save(); render();
    toast('Termin gespeichert');
    return true;
  });
}

/* ---------- Ansicht: Plan ---------- */

let planWeekOffset = 0;
function syncedWeek() {
  const mon = addDays(mondayOf(targetDay().date), 7 * planWeekOffset);
  const days = [0, 1, 2, 3, 4].map(i => addDays(mon, i));
  const today = todayISO();
  const kw = isoWeekKey(mon).split('-W')[1];
  return `<section class="card">
    <div class="card-head">
      <h2>KW ${Number(kw)} · ${fmtDate(days[0], false)} bis ${fmtDate(days[4], false)}</h2>
      <div class="row tight">
        <button class="btn small" data-action="plan-week" data-dir="-1" ${planWeekOffset <= -1 ? 'disabled' : ''} aria-label="Woche zurück">‹</button>
        <button class="btn small" data-action="plan-week" data-dir="0" ${planWeekOffset === 0 ? 'disabled' : ''}>Aktuell</button>
        <button class="btn small" data-action="plan-week" data-dir="1" ${planWeekOffset >= 1 ? 'disabled' : ''} aria-label="Woche vor">›</button>
      </div>
    </div>
    <div class="week-plan-wrap"><div class="week-plan">${days.map(day => {
      const ls = lessonsOn(day);
      return `<div class="wp-day ${day === today ? 'today' : ''}">
        <h3>${WD_SHORT[parse(day).getDay()]} ${parse(day).getDate()}.${day === today ? ' · heute' : ''}</h3>
        ${ls.length ? `<div class="lessons">${ls.map(l => lessonRow(l, day, true)).join('')}</div>`
        : `<p class="empty small">${inHoliday(day) ? 'Ferien' : 'Keine Daten'}</p>`}
      </div>`;
    }).join('')}</div></div>
    <p class="muted small">${esc(syncStatusText().replace(/ · Probleme.*$/, ''))} · aus WebUntis</p>
  </section>`;
}

function viewPlan() {
  const synced = !!(S.sync && S.sync.lessons && S.sync.lessons.length);
  return `
  <div class="stack">
    <div class="hello"><div><span class="label">Aus WebUntis, mit Ausfällen und Vertretungen</span><h1>Stundenplan</h1></div></div>
    ${synced ? syncedWeek() : `<section class="card">
      <p>${syncConfigured() ? 'Noch keine Stundenplan-Daten da. Einmal abrufen hilft meistens.' : 'Der Stundenplan kommt automatisch aus WebUntis. Dafür einmal die Schulanbindung einrichten.'}</p>
      <div class="row">${syncConfigured() ? `<button class="btn primary" data-action="sync">Jetzt abrufen</button>` : `<button class="btn primary" data-action="open-settings">Schulanbindung einrichten</button>`}</div>
    </section>`}

    <section class="card">
      <div class="card-head"><h2>${ranzenOn() ? 'Fächer und was in die Tasche gehört' : 'Fächer'}</h2><button class="btn small" data-action="subj-new">+ Fach</button></div>
      <div class="list">${S.subjects.map(s => `
        <div class="subject-row">
          <span class="sw" style="background:${esc(s.color)}"></span>
          <div><div><b>${esc(s.name)}</b></div>${ranzenOn() ? `<div class="items">${esc((s.items || []).join(', ') || 'keine Sachen eingetragen')}</div>` : ''}</div>
          <button class="icon-btn" data-action="subj-edit" data-id="${esc(s.id)}" aria-label="${esc(s.name)} bearbeiten">${ICON.edit}</button>
        </div>`).join('')}
      </div>
    </section>

    ${ranzenOn() ? `<section class="card">
      <div class="card-head"><h2>Kommt immer mit</h2><button class="icon-btn" data-action="base-edit" aria-label="Bearbeiten">${ICON.edit}</button></div>
      <p>${esc(S.settings.baseItems.join(', ') || 'Nichts eingetragen')}</p>
    </section>` : ''}
  </div>`;
}

function openSubjectDialog(id) {
  const s = id ? subjectById(id) : null;
  let color = s ? s.color : COLORS[S.subjects.length % COLORS.length];
  showDialog(`
    <form method="dialog">
      <h2>${s ? 'Fach bearbeiten' : 'Neues Fach'}</h2>
      <label class="field">Name <input name="name" required value="${esc(s ? s.name : '')}" placeholder="z. B. Französisch"></label>
      <label class="field">Kürzel in WebUntis (optional) <input name="short" autocapitalize="off" value="${esc(s ? s.short || '' : '')}" placeholder="z. B. F oder M"></label>
      <div class="field">Farbe
        <div class="swatches">${COLORS.map(c => `<button type="button" data-color="${c}" class="${c === color ? 'on' : ''}" style="background:${c}" aria-label="Farbe ${c}"></button>`).join('')}</div>
      </div>
      <label class="field">Sachen für die Tasche (eine pro Zeile, nur für den Taschen-Check)
        <textarea name="items" placeholder="Buch&#10;Heft">${esc(s ? (s.items || []).join('\n') : '')}</textarea>
      </label>
      <div class="row end">
        ${s ? `<button type="button" class="btn danger ghost" data-action="subj-delete" data-id="${esc(s.id)}">Löschen</button><span class="spacer"></span>` : ''}
        <button type="button" class="btn ghost" data-close>Abbrechen</button>
        <button class="btn primary" value="ok">Speichern</button>
      </div>
    </form>`, form => {
    const d = new FormData(form);
    const rec = {
      name: String(d.get('name')).trim(),
      short: String(d.get('short') || '').trim(),
      color,
      items: String(d.get('items') || '').split('\n').map(x => x.trim()).filter(Boolean)
    };
    if (!rec.name) return false;
    if (s) Object.assign(s, rec); else S.subjects.push({ id: uid(), ...rec });
    save(); render();
    return true;
  });
  const dlg = document.getElementById('dialog');
  dlg.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
    color = b.dataset.color;
    dlg.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('on', x === b));
  }));
}

function openBaseItemsDialog() {
  showDialog(`
    <form method="dialog">
      <h2>Kommt immer mit</h2>
      <label class="field">Eine Sache pro Zeile
        <textarea name="items">${esc(S.settings.baseItems.join('\n'))}</textarea>
      </label>
      <div class="row end"><button type="button" class="btn ghost" data-close>Abbrechen</button><button class="btn primary" value="ok">Speichern</button></div>
    </form>`, form => {
    S.settings.baseItems = String(new FormData(form).get('items') || '').split('\n').map(x => x.trim()).filter(Boolean);
    save(); render();
    return true;
  });
}

/* ---------- Werkstatt: Roboter und App anpassen ---------- */

const COSMETICS = [
  // Farbe des Roboters
  { id: 'c-cyan', cat: 'color', name: 'Cyan', lvl: 1, v: '#22d3ee' },
  { id: 'c-orange', cat: 'color', name: 'Orange', lvl: 2, v: '#fb923c' },
  { id: 'c-mint', cat: 'color', name: 'Mint', lvl: 3, v: '#14b8a6', v2: '#7ef0c8' },
  { id: 'c-violet', cat: 'color', name: 'Lila', lvl: 5, v: '#a78bfa' },
  { id: 'c-red', cat: 'color', name: 'Signalrot', lvl: 6, v: '#f05252' },
  { id: 'c-polar', cat: 'color', name: 'Polarweiß', lvl: 8, v: '#e2e8f0' },
  { id: 'c-gold', cat: 'color', name: 'Gold', lvl: 9, v: '#facc15' },
  { id: 'c-neon', cat: 'color', name: 'Neongrün', lvl: 11, v: '#22c55e', v2: '#d9f99d' },
  { id: 'c-carbon', cat: 'color', name: 'Carbon', lvl: 12, v: '#475569' },
  { id: 'c-chrome', cat: 'color', name: 'Chrom', lvl: 14, v: '#b8c4d6' },
  { id: 'c-stealth', cat: 'color', name: 'Tarnkappe', lvl: 16, v: '#2a3150' },
  { id: 'c-holo', cat: 'color', name: 'Hologramm', lvl: 20, v: 'holo' },
  // Antenne
  { id: 'a-basic', cat: 'antenna', name: 'Standard', lvl: 1 },
  { id: 'a-bolt', cat: 'antenna', name: 'Blitz', lvl: 3 },
  { id: 'a-double', cat: 'antenna', name: 'Doppelt', lvl: 5 },
  { id: 'a-dish', cat: 'antenna', name: 'Satellitenschüssel', lvl: 7 },
  { id: 'a-radar', cat: 'antenna', name: 'Radar', lvl: 10 },
  { id: 'a-mast', cat: 'antenna', name: 'Funkmast', lvl: 13 },
  // Augen
  { id: 'e-basic', cat: 'eyes', name: 'Standard', lvl: 1 },
  { id: 'e-visor', cat: 'eyes', name: 'Visier', lvl: 4 },
  { id: 'e-pixel', cat: 'eyes', name: 'Pixel', lvl: 6 },
  { id: 'e-laser', cat: 'eyes', name: 'Laser', lvl: 8 },
  { id: 'e-scan', cat: 'eyes', name: 'Scanner', lvl: 11 },
  { id: 'e-cross', cat: 'eyes', name: 'Zielkreuz', lvl: 15 },
  // Extra
  { id: 'x-none', cat: 'extra', name: 'Ohne', lvl: 1 },
  { id: 'x-jet', cat: 'extra', name: 'Jetpack', lvl: 6 },
  { id: 'x-cape', cat: 'extra', name: 'Umhang', lvl: 10 },
  { id: 'x-reactor', cat: 'extra', name: 'Reaktor-Kern', lvl: 12 },
  { id: 'x-wings', cat: 'extra', name: 'Flügel', lvl: 15 },
  { id: 'x-ring', cat: 'extra', name: 'Antigrav-Ring', lvl: 18 },
  // Begleiter
  { id: 'b-none', cat: 'buddy', name: 'Ohne', lvl: 1 },
  { id: 'b-drone', cat: 'buddy', name: 'Mini-Drohne', lvl: 2 },
  { id: 'b-sat', cat: 'buddy', name: 'Satellit', lvl: 7 },
  { id: 'b-rover', cat: 'buddy', name: 'Rover', lvl: 12 },
  { id: 'b-orb', cat: 'buddy', name: 'Energie-Kugel', lvl: 17 },
  // Raum hinter dem Roboter
  { id: 'r-none', cat: 'room', name: 'Dunkel', lvl: 1 },
  { id: 'r-stars', cat: 'room', name: 'Sternfeld', lvl: 3 },
  { id: 'r-nebula', cat: 'room', name: 'Nebel', lvl: 6 },
  { id: 'r-grid', cat: 'room', name: 'Werkstatt', lvl: 9 },
  { id: 'r-moon', cat: 'room', name: 'Mondoberfläche', lvl: 13 },
  { id: 'r-warp', cat: 'room', name: 'Hyperraum', lvl: 19 },
  // Farbe der ganzen App
  { id: 't-amber', cat: 'theme', name: 'Bernstein', lvl: 1, v: '#ff7a59', v2: '#ffc247' },
  { id: 't-mint', cat: 'theme', name: 'Mint', lvl: 2, v: '#14b8a6', v2: '#7ef0c8' },
  { id: 't-cyan', cat: 'theme', name: 'Eis', lvl: 4, v: '#3b82f6', v2: '#5cc8ff' },
  { id: 't-magenta', cat: 'theme', name: 'Magenta', lvl: 7, v: '#db2777', v2: '#f9a8d4' },
  { id: 't-red', cat: 'theme', name: 'Signalrot', lvl: 10, v: '#ff3d5a', v2: '#ff9a6b' },
  { id: 't-violet', cat: 'theme', name: 'Ultraviolett', lvl: 14, v: '#6d5dfc', v2: '#b4a8ff' },
  { id: 't-lime', cat: 'theme', name: 'Neon', lvl: 17, v: '#22c55e', v2: '#d9f99d' },
  { id: 't-white', cat: 'theme', name: 'Weißlicht', lvl: 20, v: '#94a3b8', v2: '#ffffff' },
  // Titel
  { id: 'ti-rekrut', cat: 'title', name: 'Rekrut', lvl: 1 },
  { id: 'ti-kadett', cat: 'title', name: 'Kadett', lvl: 3 },
  { id: 'ti-navigator', cat: 'title', name: 'Navigator', lvl: 5 },
  { id: 'ti-pilot', cat: 'title', name: 'Pilot', lvl: 8 },
  { id: 'ti-ingenieur', cat: 'title', name: 'Ingenieur', lvl: 11 },
  { id: 'ti-kommandant', cat: 'title', name: 'Kommandant', lvl: 15 },
  { id: 'ti-admiral', cat: 'title', name: 'Admiral', lvl: 20 }
];
const CAT_NAMES = { color: 'Farbe', antenna: 'Antenne', eyes: 'Augen', extra: 'Extra', buddy: 'Begleiter', room: 'Raum', theme: 'App-Farbe', title: 'Titel' };
const cosmetic = id => COSMETICS.find(c => c.id === id);
const equippedOf = cat => cosmetic(S.equipped[cat]) || COSMETICS.find(c => c.cat === cat);

function robotSVG(eq = S.equipped, idp = 'r', headOnly = false) {
  const colItem = cosmetic(eq.color) || COSMETICS[0];
  const col = colItem.v === 'holo' ? `url(#${idp}-holo)` : colItem.v;
  const dark = '#0b1120';
  const steel = '#9aa4c4';
  const glow = '#4fe3c1';
  const stars = [[18, 22], [44, 62], [172, 28], [152, 72], [28, 140], [184, 120], [122, 12], [70, 30], [162, 168], [16, 184], [96, 192], [188, 60]]
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.1 : 1.7}" fill="#fff" opacity="${i % 2 ? 0.45 : 0.8}"/>`).join('');
  const room = {
    'r-stars': stars,
    'r-nebula': `<rect width="200" height="200" fill="url(#${idp}-neb)"/>${stars}`,
    'r-grid': Array.from({ length: 9 }, (_, i) => `<line x1="${i * 25}" y1="0" x2="${i * 25}" y2="200" stroke="#fff" stroke-opacity=".06"/><line x1="0" y1="${i * 25}" x2="200" y2="${i * 25}" stroke="#fff" stroke-opacity=".06"/>`).join(''),
    'r-moon': `${stars}<ellipse cx="100" cy="222" rx="160" ry="48" fill="#2b3150"/><ellipse cx="44" cy="188" rx="12" ry="4" fill="#20253f"/><ellipse cx="150" cy="194" rx="16" ry="5" fill="#20253f"/>`,
    'r-warp': Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12; return `<line x1="${(100 + Math.cos(a) * 70).toFixed(1)}" y1="${(100 + Math.sin(a) * 70).toFixed(1)}" x2="${(100 + Math.cos(a) * 150).toFixed(1)}" y2="${(100 + Math.sin(a) * 150).toFixed(1)}" stroke="#a5b4fc" stroke-opacity="${i % 2 ? 0.25 : 0.5}" stroke-width="2"/>`; }).join('')
  }[eq.room] || '';
  const back = {
    'x-jet': `<rect x="40" y="96" width="22" height="56" rx="8" fill="#64748b"/><rect x="138" y="96" width="22" height="56" rx="8" fill="#64748b"/>
      <path d="M44 152 l7 22 l7 -22z" fill="#fb923c"/><path d="M142 152 l7 22 l7 -22z" fill="#fb923c"/>`,
    'x-cape': `<path d="M58 96 L142 96 L160 178 L40 178 Z" fill="#b91c1c"/>`,
    'x-wings': `<path d="M60 110 C20 90 10 130 30 150 C40 140 50 135 62 135Z" fill="#e2e8f0"/><path d="M140 110 C180 90 190 130 170 150 C160 140 150 135 138 135Z" fill="#e2e8f0"/>`
  }[eq.extra] || '';
  const front = {
    'x-reactor': `<circle cx="100" cy="122" r="17" fill="none" stroke="${glow}" stroke-width="3" opacity=".85"/><circle cx="100" cy="122" r="22" fill="none" stroke="${glow}" stroke-width="1.5" opacity=".4"/>`,
    'x-ring': `<ellipse cx="100" cy="192" rx="46" ry="7" fill="none" stroke="#a5b4fc" stroke-width="3" opacity=".9"/><ellipse cx="100" cy="192" rx="56" ry="9" fill="none" stroke="#a5b4fc" stroke-width="1.5" opacity=".4"/>`
  }[eq.extra] || '';
  const antenna = {
    'a-basic': `<line x1="100" y1="26" x2="100" y2="13" stroke="${steel}" stroke-width="4"/><circle cx="100" cy="10" r="6" fill="${col}" stroke="${dark}" stroke-width="3"/>`,
    'a-bolt': `<path d="M104 4 L92 18 L101 18 L95 30 L110 14 L101 14 Z" fill="#facc15" stroke="${dark}" stroke-width="2"/>`,
    'a-double': `<line x1="82" y1="28" x2="76" y2="12" stroke="${steel}" stroke-width="3.5"/><line x1="118" y1="28" x2="124" y2="12" stroke="${steel}" stroke-width="3.5"/><circle cx="75" cy="10" r="4.5" fill="${glow}"/><circle cx="125" cy="10" r="4.5" fill="${glow}"/>`,
    'a-dish': `<line x1="100" y1="26" x2="100" y2="16" stroke="${steel}" stroke-width="4"/><path d="M84 6 Q100 26 116 6 Z" fill="#cbd5e1" stroke="${dark}" stroke-width="3"/>`,
    'a-radar': `<line x1="100" y1="26" x2="100" y2="14" stroke="${steel}" stroke-width="4"/><path d="M86 12 A14 14 0 0 1 114 12" fill="none" stroke="${glow}" stroke-width="4" stroke-linecap="round"/><path d="M92 7 A8 8 0 0 1 108 7" fill="none" stroke="${glow}" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
    'a-mast': `<line x1="100" y1="26" x2="100" y2="3" stroke="${steel}" stroke-width="3"/><line x1="92" y1="11" x2="108" y2="11" stroke="${steel}" stroke-width="2.5"/><line x1="95" y1="18" x2="105" y2="18" stroke="${steel}" stroke-width="2.5"/><circle cx="100" cy="3" r="3.5" fill="#ff6b6b"/>`
  }[eq.antenna] || '';
  const eyes = {
    'e-basic': `<circle cx="82" cy="54" r="9" fill="#e0f2fe"/><circle cx="118" cy="54" r="9" fill="#e0f2fe"/><circle cx="84" cy="54" r="4" fill="${dark}"/><circle cx="120" cy="54" r="4" fill="${dark}"/>`,
    'e-visor': `<rect x="66" y="44" width="68" height="20" rx="10" fill="#22d3ee"/><rect x="72" y="48" width="22" height="5" rx="2.5" fill="#e0f2fe" opacity=".8"/>`,
    'e-pixel': `<rect x="74" y="47" width="14" height="14" fill="${glow}"/><rect x="112" y="47" width="14" height="14" fill="${glow}"/><rect x="74" y="47" width="5" height="5" fill="#e0fff7"/><rect x="112" y="47" width="5" height="5" fill="#e0fff7"/>`,
    'e-laser': `<circle cx="82" cy="54" r="9" fill="#f87171"/><circle cx="118" cy="54" r="9" fill="#f87171"/><circle cx="82" cy="54" r="4" fill="#fee2e2"/><circle cx="118" cy="54" r="4" fill="#fee2e2"/>`,
    'e-scan': `<rect x="68" y="49" width="64" height="10" rx="5" fill="#ff6b6b" opacity=".35"/><rect x="70" y="52" width="60" height="4" rx="2" fill="#ff8a8a"/>`,
    'e-cross': ['82', '118'].map(x => `<circle cx="${x}" cy="54" r="8" fill="none" stroke="#ffb547" stroke-width="2"/><line x1="${x - 11}" y1="54" x2="${+x + 11}" y2="54" stroke="#ffb547" stroke-width="1.5"/><line x1="${x}" y1="43" x2="${x}" y2="65" stroke="#ffb547" stroke-width="1.5"/>`).join('')
  }[eq.eyes] || '';
  const buddy = {
    'b-drone': `<g transform="translate(168 40)"><line x1="-14" y1="-8" x2="14" y2="-8" stroke="${steel}" stroke-width="2"/><ellipse cx="-14" cy="-10" rx="8" ry="2" fill="${steel}"/><ellipse cx="14" cy="-10" rx="8" ry="2" fill="${steel}"/><rect x="-9" y="-6" width="18" height="12" rx="5" fill="${glow}"/><circle cx="0" cy="0" r="2.5" fill="${dark}"/></g>`,
    'b-sat': `<g transform="translate(166 40) rotate(-20)"><rect x="-6" y="-6" width="12" height="12" rx="2" fill="#cbd5e1"/><rect x="-25" y="-4" width="16" height="8" fill="#38bdf8"/><rect x="9" y="-4" width="16" height="8" fill="#38bdf8"/><line x1="0" y1="-6" x2="0" y2="-12" stroke="${steel}" stroke-width="2"/></g>`,
    'b-rover': `<g transform="translate(172 178)"><rect x="-14" y="-10" width="28" height="12" rx="4" fill="#ffb547"/><circle cx="-9" cy="4" r="5" fill="#334155"/><circle cx="9" cy="4" r="5" fill="#334155"/><line x1="6" y1="-10" x2="10" y2="-20" stroke="${steel}" stroke-width="2"/><circle cx="10" cy="-21" r="3" fill="${glow}"/></g>`,
    'b-orb': `<g transform="translate(166 44)"><circle r="13" fill="#a78bfa" opacity=".22"/><circle r="8" fill="#c4b5fd"/><circle r="3" cx="-2.5" cy="-2.5" fill="#fff" opacity=".85"/></g>`
  }[eq.buddy] || '';
  const defs = `<defs>
    <linearGradient id="${idp}-holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4fe3c1"/><stop offset=".5" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
    <radialGradient id="${idp}-neb" cx=".72" cy=".28" r=".85"><stop offset="0" stop-color="#7c3aed" stop-opacity=".55"/><stop offset=".55" stop-color="#312e81" stop-opacity=".35"/><stop offset="1" stop-color="#0b0e2a" stop-opacity="0"/></radialGradient>
    <clipPath id="${idp}-clip"><rect width="200" height="200" rx="28"/></clipPath>
  </defs>`;
  const head = `${antenna}
    <rect x="56" y="26" width="88" height="62" rx="20" fill="${col}" stroke="${dark}" stroke-width="4"/>
    <rect x="66" y="38" width="68" height="34" rx="12" fill="${dark}"/>
    ${eyes}
    <rect x="86" y="76" width="28" height="5" rx="2.5" fill="${dark}" opacity=".6"/>`;
  if (headOnly) {
    return `<svg viewBox="50 0 100 92" role="img" aria-label="Dein Roboter">${defs}${head}</svg>`;
  }
  return `<svg viewBox="0 0 200 200" role="img" aria-label="Dein Roboter">
    ${defs}
    <g clip-path="url(#${idp}-clip)"><rect width="200" height="200" fill="#0d1130"/>${room}</g>
    ${back}
    ${head}
    <rect x="90" y="88" width="20" height="10" fill="${dark}"/>
    <rect x="60" y="96" width="80" height="64" rx="18" fill="${col}" stroke="${dark}" stroke-width="4"/>
    <circle cx="100" cy="122" r="12" fill="${dark}"/><circle cx="100" cy="122" r="6" fill="#34d399"/>
    <rect x="38" y="104" width="18" height="40" rx="9" fill="${col}" stroke="${dark}" stroke-width="4"/>
    <rect x="144" y="104" width="18" height="40" rx="9" fill="${col}" stroke="${dark}" stroke-width="4"/>
    <rect x="72" y="160" width="20" height="24" rx="6" fill="${col}" stroke="${dark}" stroke-width="4"/>
    <rect x="108" y="160" width="20" height="24" rx="6" fill="${col}" stroke="${dark}" stroke-width="4"/>
    ${front}
    ${buddy}
  </svg>`;
}

function applyTheme() {
  const th = equippedOf('theme');
  document.documentElement.style.setProperty('--accent', th.v);
  document.documentElement.style.setProperty('--accent2', th.v2 || th.v);
}

/* ---------- Ansicht: Ich ---------- */

let meTab = 'profil';
let shopCat = 'color';
let albumOffset = 0;

function viewMe() {
  const tabs = [['profil', 'Profil'], ...(extrasOn() ? [['werkstatt', 'Werkstatt'], ['spiele', 'Rätsel']] : []), ['settings', 'Einstellungen']];
  if (!tabs.some(([k]) => k === meTab)) meTab = 'profil';
  const body = { profil: meProfile, werkstatt: meShop, spiele: meGames, settings: meSettings }[meTab] || meProfile;
  return `
  <div class="stack">
    <div class="seg" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${meTab === k}" class="${meTab === k ? 'on' : ''}" data-action="me-tab" data-tab="${k}">${l}</button>`).join('')}</div>
    ${body()}
  </div>`;
}

function nextUnlocks(lvl) {
  if (!extrasOn()) return null;
  const all = [...COSMETICS.map(c => ({ lvl: c.lvl, name: c.name + ' (' + CAT_NAMES[c.cat] + ')' })), ...GAMES.map(g => ({ lvl: g.lvl, name: g.name }))];
  const nextLvl = Math.min(...all.filter(x => x.lvl > lvl).map(x => x.lvl));
  return isFinite(nextLvl) ? { lvl: nextLvl, names: all.filter(x => x.lvl === nextLvl).map(x => x.name) } : null;
}

function meProfile() {
  const lv = levelInfo();
  const st = streakInfo();
  const today = todayISO();
  const mon = mondayOf(today);
  const week = [0, 1, 2, 3, 4].map(i => addDays(mon, i));
  const next = nextUnlocks(lv.lvl);
  const badges = shownBadges();
  const earned = badges.filter(b => S.badges[b.id]).length;
  return `
    <section class="card profile">
      <div class="avatar">${robotSVG(S.equipped, 'p')}</div>
      <div class="profile-info">
        <span class="label">${esc(equippedOf('title').name)}</span>
        <h1>${esc(S.settings.name || 'Profil')}</h1>
        <div class="lvl-row"><b>Level ${lv.lvl}</b><span class="muted">${S.xp} XP</span></div>
        <div class="bar"><span style="width:${lv.pct}%"></span></div>
        <p class="muted small">Noch ${lv.to - S.xp} XP bis Level ${lv.lvl + 1}${next && next.lvl === lv.lvl + 1 ? ' · dann neu: ' + esc(next.names.join(', ')) : ''}</p>
        ${extrasOn() ? `<button class="btn small" data-action="me-tab" data-tab="werkstatt">Roboter anpassen</button>` : ''}
      </div>
    </section>

    <section class="card">
      <div class="stats inner">
        <div class="stat"><div class="v">${st.count}</div><div class="l">Serie</div></div>
        <div class="stat"><div class="v">${S.bestStreak || st.count}</div><div class="l">Bestwert</div></div>
        <div class="stat"><div class="v">${st.jokerUsedThisWeek ? '0' : '1'}</div><div class="l">Joker</div></div>
        <div class="stat"><div class="v">${st.count >= STREAK_BONUS_FROM ? '×1,2' : '×1'}</div><div class="l">XP-Bonus</div></div>
      </div>
      <div class="week">${week.map(d => {
        const r = S.days[d] || {};
        const cls = inHoliday(d) ? 'off' : r.goal ? 'goal' : r.active ? 'active' : '';
        return `<div class="day ${cls} ${d === today ? 'today' : ''}"><span class="pip"></span>${WD_SHORT[parse(d).getDay()]}</div>`;
      }).join('')}</div>
      <p class="muted small">Voll = Tagesziel, Ring = aktiv. Die Serie zählt Schultage, an denen du etwas gemacht hast. Wochenenden und Ferien unterbrechen sie nicht, einen verpassten Tag pro Woche rettet der Joker. Ab ${STREAK_BONUS_FROM} Tagen gibt es ×1,2 auf alle XP.</p>
    </section>

    <section class="card">
      <div class="card-head"><h2>Abzeichen</h2><span class="tag">${earned} von ${badges.length}</span></div>
      <div class="badges">${badges.map(b => `<div class="badge ${S.badges[b.id] ? 'on' : ''}" title="${esc(b.desc)}">${badgeSVG(b, !!S.badges[b.id])}<b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join('')}</div>
    </section>

    <details class="card fold">
      <summary><h2>So gibt es XP</h2></summary>
      <table class="xp-table"><tbody>
        ${ranzenOn() ? `<tr><td>Taschen-Check erledigt</td><td>+${XP.ranzen}</td></tr>` : ''}
        <tr><td>Briefing gelesen oder gehört</td><td>+${XP.briefing}</td></tr>
        <tr><td>Hausaufgabe erledigt</td><td>+${XP.hwDone}</td></tr>
        <tr><td>… pünktlich</td><td>+${XP.hwOnTime}</td></tr>
        <tr><td>… selbst eingetragen</td><td>+${XP.hwSelf}</td></tr>
        <tr><td>Tagesziel</td><td>+${XP.dayGoal}</td></tr>
        <tr><td>Wochenziel</td><td>+${XP.weekGoal}</td></tr>
      </tbody></table>
      <p class="muted small">Es gibt nie Abzüge. XP gibt es für Gewohnheiten, nicht für Noten.${extrasOn() ? ' Rätsel geben keine XP, dafür Sticker.' : ''}</p>
    </details>
    <details class="card fold">
      <summary><h2>Zuletzt bekommen</h2></summary>
      <div class="log">${S.log.slice(0, 15).map(l => `<div><span>${esc(l.r)} · ${fmtDate(l.d, false)}</span><b>+${l.a}</b></div>`).join('') || '<p class="empty">Noch keine XP. Hak deine erste Hausaufgabe ab.</p>'}</div>
    </details>`;
}

function meShop() {
  const lv = levelInfo().lvl;
  const items = COSMETICS.filter(c => c.cat === shopCat);
  const owned = COSMETICS.filter(c => c.lvl <= lv).length;
  return `
    <section class="card shop">
      <div class="shop-top">
        <div class="avatar small">${robotSVG(S.equipped, 'w')}</div>
        <div><span class="label">${esc(equippedOf('title').name)} · Level ${lv}</span><h2>Werkstatt</h2><p class="muted small">${owned} von ${COSMETICS.length} Teilen freigeschaltet. Mit jedem Level kommt Neues dazu.</p></div>
      </div>
      <div class="chips" role="tablist">${Object.entries(CAT_NAMES).map(([k, n]) => `<button class="chip-btn ${shopCat === k ? 'on' : ''}" data-action="shop-cat" data-cat="${k}">${n}</button>`).join('')}</div>
      <div class="cosmetics">${items.map(c => {
        const locked = c.lvl > lv;
        const on = S.equipped[c.cat] === c.id;
        const sw = c.v ? `<span class="cos-sw" style="background:${c.v === 'holo' ? 'linear-gradient(135deg,#4fe3c1,#a78bfa,#f472b6)' : c.v2 ? `linear-gradient(135deg,${c.v},${c.v2})` : c.v}"></span>` : '';
        return `<button class="cos ${on ? 'on' : ''} ${locked ? 'locked' : ''}" data-action="equip" data-id="${c.id}" ${locked ? 'disabled' : ''}>
          ${sw}<span class="n">${esc(c.name)}</span><span class="h">${locked ? ICON.lock + ' Level ' + c.lvl : on ? 'aktiv' : 'antippen'}</span></button>`;
      }).join('')}</div>
    </section>`;
}

function albumHTML() {
  const base = parse(todayISO().slice(0, 7) + '-01');
  base.setMonth(base.getMonth() + albumOffset);
  const y = base.getFullYear(), m = base.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const offset = (base.getDay() + 6) % 7;
  const today = todayISO();
  let count = 0;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span class="ad blank"></span>');
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${pad(m + 1)}-${pad(d)}`;
    const st = S.stickers[key];
    if (st) count++;
    cells.push(`<span class="ad ${key === today ? 'today' : ''} ${st ? 'got' : ''}">${st ? stickerSVG(st, 30) : `<i>${d}</i>`}</span>`);
  }
  return `<div class="card-head"><h2>Sticker-Album</h2>
      <div class="row tight"><button class="btn small" data-action="album" data-dir="-1" aria-label="Monat zurück">‹</button>
      <span class="tag">${MONTHS_LONG[m]} · ${count}</span>
      <button class="btn small" data-action="album" data-dir="1" ${albumOffset >= 0 ? 'disabled' : ''} aria-label="Monat vor">›</button></div></div>
    <div class="album">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<span class="ah">${d}</span>`).join('')}${cells.join('')}</div>`;
}

function meGames() {
  const rec = S.days[todayISO()] || {};
  const g = dailyGame();
  const solved = dailySolved();
  const lv = levelInfo().lvl;
  return `
    <section class="card daily ${solved ? 'solved' : rec.goal ? 'ready' : 'locked'}">
      <div class="card-head"><span class="label">Tagesrätsel</span><span class="tag ${solved ? 'ok' : ''}">${solved ? 'gelöst' : rec.goal ? 'frei' : 'gesperrt'}</span></div>
      <div class="reward-row">${stickerSVG(g.id, 52)}<div><h2>${esc(g.name)}</h2>
        <p class="muted small">${solved ? 'Heute schon gelöst. Der Sticker klebt im Album.' : rec.goal ? 'Tagesziel geschafft. Löse das Rätsel und hol dir den Sticker.' : `Öffnet sich mit dem Tagesziel: ${ranzenOn() ? 'Tasche gepackt und ' : ''}alles bis zum nächsten Schultag erledigt.`}</p></div></div>
      ${!solved && rec.goal ? `<div class="row"><button class="btn primary" data-action="daily-start">Rätsel starten</button></div>` : ''}
    </section>
    <section class="card">${albumHTML()}</section>
    <section class="card">
      <div class="card-head"><h2>Spielecke</h2><span class="tag">jederzeit, ohne XP</span></div>
      <div class="list">${GAMES.map(x => {
        const locked = x.lvl > lv;
        return `<div class="game-row ${locked ? 'locked' : ''}">${stickerSVG(x.id, 38)}
          <div><b>${esc(x.name)}</b><p class="muted small">${locked ? 'Ab Level ' + x.lvl : esc(x.desc)}</p></div>
          ${locked ? `<span class="lock-ico">${ICON.lock}</span>` : `<button class="btn small" data-action="game-start" data-id="${x.id}">Spielen</button>`}</div>`;
      }).join('')}</div>
    </section>`;
}

function meSettings() {
  return `
    <section class="card">
      <div class="card-head"><h2>Allgemein</h2></div>
      <label class="field">Name <input data-action="set-name" value="${esc(S.settings.name)}"></label>
      <label class="field">Ab wann zeigt „Heute“ schon den nächsten Schultag?
        <select data-action="set-hour">${[12, 13, 14, 15, 16, 17].map(h => `<option value="${h}" ${h === S.settings.afterSchoolHour ? 'selected' : ''}>ab ${h}:00 Uhr</option>`).join('')}</select>
      </label>
    </section>
    <section class="card">
      <div class="card-head"><h2>Funktionen</h2></div>
      <label class="field toggle"><input type="checkbox" data-action="set-feature" data-feature="ranzen" ${ranzenOn() ? 'checked' : ''}> Taschen-Check: zeigt, was für den nächsten Schultag eingepackt werden muss</label>
      <label class="field toggle"><input type="checkbox" data-action="set-feature" data-feature="extras" ${extrasOn() ? 'checked' : ''}> Werkstatt und Rätsel: Roboter gestalten, Tagesrätsel, Sticker und Spielecke</label>
    </section>
    <section class="card">
      <div class="card-head"><h2>Ferien</h2><button class="btn small" data-action="holiday-new">+ Ferien</button></div>
      ${S.settings.holidays.length ? `<div class="list">${S.settings.holidays.slice().sort((a, b) => a.from.localeCompare(b.from)).map(h => `
        <div class="subject-row"><span class="sw holiday"></span><div><b>${esc(h.label || 'Ferien')}</b><div class="items">${fmtDate(h.from)} bis ${fmtDate(h.to)}</div></div>
        <button class="icon-btn" data-action="holiday-delete" data-id="${esc(h.id)}" aria-label="Löschen">✕</button></div>`).join('')}</div>`
        : `<p class="empty">Keine Ferien eingetragen. In den Ferien pausiert die Serie.</p>`}
    </section>
    <section class="card" id="schulanbindung">
      <div class="card-head"><h2>Schulanbindung</h2><span class="tag">WebUntis · itslearning</span></div>
      <p class="muted small">Holt Stundenplan, Ausfälle und Hausaufgaben automatisch. Adresse und App-Schlüssel bekommst du beim Einrichten des Abrufdienstes.</p>
      <label class="field">Adresse des Abrufdienstes <input data-action="set-sync-url" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="https://lernbegleiter-sync.….workers.dev" value="${esc(S.settings.syncUrl)}"></label>
      <label class="field">App-Schlüssel <input data-action="set-sync-key" type="password" autocomplete="off" value="${esc(S.settings.syncKey)}"></label>
      <div class="row">
        <button class="btn" data-action="sync" ${syncConfigured() ? '' : 'disabled'}>${syncing ? 'Lädt …' : 'Jetzt abrufen'}</button>
        <span class="muted small">${esc(syncStatusText())}</span>
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Datensicherung</h2></div>
      <p class="muted small">Alle Daten liegen nur auf diesem Gerät. Sichere sie ab und zu, z. B. in der Dateien-App.</p>
      <div class="row">
        <button class="btn" data-action="export">Sichern</button>
        <label class="btn" style="display:inline-flex;align-items:center">Wiederherstellen<input type="file" accept="application/json,.json" data-action="import" hidden></label>
      </div>
    </section>
    <p class="muted small center">Lernbegleiter · Daten bleiben auf diesem Gerät</p>`;
}

function openHolidayDialog() {
  const t = todayISO();
  showDialog(`
    <form method="dialog">
      <h2>Ferien eintragen</h2>
      <label class="field">Name <input name="label" placeholder="z. B. Weihnachtsferien"></label>
      <label class="field">Erster Ferientag <input type="date" name="from" value="${t}" required></label>
      <label class="field">Letzter Ferientag <input type="date" name="to" value="${addDays(t, 13)}" required></label>
      <div class="row end"><button type="button" class="btn ghost" data-close>Abbrechen</button><button class="btn primary" value="ok">Speichern</button></div>
    </form>`, form => {
    const d = new FormData(form);
    const from = String(d.get('from')), to = String(d.get('to'));
    if (to < from) { toast('Der letzte Tag liegt vor dem ersten'); return false; }
    S.settings.holidays.push({ id: uid(), label: String(d.get('label') || '').trim(), from, to });
    save(); render();
    return true;
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `lernbegleiter-sicherung-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data || typeof data !== 'object' || !Array.isArray(data.subjects)) throw new Error('Format');
      if (!window.confirm('Sicherung laden? Die aktuellen Daten werden ersetzt.')) return;
      S = normalize(data);
      save(); render();
      toast('Sicherung geladen');
    } catch (e) { toast('Diese Datei ist keine Lernbegleiter-Sicherung'); }
  };
  reader.readAsText(file);
}

/* ---------- Schulanbindung ---------- */

let syncing = false;
const SYNC_EVERY_MS = 30 * 60 * 1000;

function syncStatusText() {
  if (!syncConfigured()) return 'Noch nicht eingerichtet';
  if (!S.sync || !S.sync.fetchedAt) return 'Noch nie abgerufen';
  const d = new Date(S.sync.fetchedAt);
  const errs = (S.sync.errors || []).map(e => e.source + (e.message ? ' (' + e.message + ')' : '')).join('; ');
  return `Stand: ${fmtDate(iso(d), false)}, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr${errs ? ' · Probleme: ' + errs : ''}`;
}

function applySync(data) {
  const today = todayISO();
  S.sync = { updated: data.updated, fetchedAt: Date.now(), lessons: data.lessons || [], errors: data.errors || [], debug: data.debug || null };
  // Fächer aus WebUntis, die die App noch nicht kennt, automatisch anlegen (Taschen-Sachen lassen sich unter „Plan“ ergänzen)
  (data.lessons || []).forEach(l => {
    if (l.subject && !matchSubject(l.subject, l.short)) {
      S.subjects.push({ id: uid(), name: l.subject, short: l.short || '', color: COLORS[S.subjects.length % COLORS.length], items: [] });
    }
  });
  const longOf = k => ((data.lessons || []).find(l => l.short && l.short === k) || {}).subject || k;
  const incoming = [
    ...(data.homework || []).map(h => ({ id: h.id, subjectId: matchSubject(longOf(h.subject), h.subject)?.id || '', text: h.text, due: h.due, source: 'webuntis' })),
    ...(data.assignments || []).map(a => ({ id: a.id, subjectId: matchSubject(a.course, '')?.id || '', text: a.title, due: a.due, source: 'itslearning' }))
  ].filter(h => h.text && h.due);
  const ids = new Set(incoming.map(h => h.id));
  let added = 0;
  incoming.forEach(h => {
    const ex = S.homework.find(x => x.id === h.id);
    if (ex) { ex.text = h.text; ex.due = h.due; if (!ex.subjectId) ex.subjectId = h.subjectId; }
    else if (h.due >= today) { S.homework.push({ ...h, created: today, self: false, doneAt: null }); added++; }
  });
  // Importierte Einträge, die die Schule entfernt hat und die schon vorbei sind, nicht als „überfällig“ stehen lassen.
  S.homework = S.homework.filter(h => !h.source || h.doneAt || ids.has(h.id) || h.due >= today);
  (data.exams || []).forEach(e => {
    const rec = { type: e.type, subjectId: matchSubject(longOf(e.subject), e.subject)?.id || '', date: e.date, topic: e.text || e.title, source: 'webuntis' };
    const ex = S.events.find(x => x.id === e.id);
    if (ex) Object.assign(ex, rec); else S.events.push({ id: e.id, ...rec });
  });
  return added;
}

async function syncNow(force = false, quiet = false) {
  const base = (S.settings.syncUrl || '').trim().replace(/\/+$/, '');
  if (!base || !S.settings.syncKey || syncing) return;
  syncing = true; render();
  try {
    const res = await fetch(base + '/sync' + (force ? '?fresh=1' : ''), { headers: { 'X-App-Key': S.settings.syncKey }, cache: 'no-store' });
    if (res.status === 401) throw new Error('App-Schlüssel stimmt nicht');
    if (!res.ok) throw new Error('Abrufdienst antwortet nicht (' + res.status + ')');
    const added = applySync(await res.json());
    save();
    if (!quiet || added) toast(`Schuldaten aktualisiert${added ? ` · ${added} neue Aufgabe${added === 1 ? '' : 'n'}` : ''}`);
  } catch (e) {
    if (!quiet) toast(e.message && !/fetch/i.test(e.message) ? e.message : 'Kein Netz oder Abrufdienst nicht erreichbar');
  } finally {
    syncing = false; render();
  }
}
function autoSync() {
  if (!syncConfigured() || !navigator.onLine) return;
  if (!S.sync || !S.sync.fetchedAt || Date.now() - S.sync.fetchedAt > SYNC_EVERY_MS) syncNow(false, true);
}

/* ---------- Dialog ---------- */

function showDialog(html, onSubmit) {
  const dlg = document.getElementById('dialog');
  dlg.innerHTML = html;
  const form = dlg.querySelector('form');
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    if (onSubmit(form) !== false) dlg.close();
  });
  dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
  dlg.showModal();
  const first = dlg.querySelector('textarea, input:not([type=date]), select');
  if (first && window.matchMedia('(pointer:fine)').matches) first.focus();
}

/* ---------- Routing und Ereignisse ---------- */

const VIEWS = { today: viewToday, homework: viewHomework, events: viewEvents, plan: viewPlan, me: viewMe, game: viewGame };
let current = (location.hash || '#today').slice(1);
if (!VIEWS[current] || current === 'game') current = 'today';

function render() {
  if (current === 'game' && !G) current = 'me';
  const st = streakInfo();
  if (st.count > (S.bestStreak || 0)) { S.bestStreak = st.count; checkBadges(); save(); }
  applyTheme();
  document.getElementById('view').innerHTML = VIEWS[current]();
  const tab = current === 'game' ? 'me' : current;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === tab));
}
function go(view) {
  if (!VIEWS[view]) return;
  current = view;
  history.replaceState(null, '', '#' + (view === 'game' ? 'me' : view));
  const main = document.getElementById('view');
  main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter');
  clearTimeout(go.t); go.t = setTimeout(() => main.classList.remove('enter'), 700);
  render();
  window.scrollTo({ top: 0 });
}

document.addEventListener('click', ev => {
  const goEl = ev.target.closest('[data-go]');
  if (goEl) { if (goEl.dataset.go === 'me' && current !== 'me' && current !== 'game') meTab = 'profil'; go(goEl.dataset.go); return; }
  const el = ev.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const { action, id } = el.dataset;
  if (gameAction(action, el)) return;
  const dlg = document.getElementById('dialog');
  switch (action) {
    case 'speak': speak(briefingText()); break;
    case 'briefing-done': {
      const rec = dayRec(todayISO());
      if (!rec.briefing) { rec.briefing = true; markActive(); afterAction(award(XP.briefing, 'Briefing gelesen', 'brief:' + todayISO()), 'Briefing'); }
      break;
    }
    case 'pack': case 'pack-all': {
      const items = ranzenItems(S.ranzen.date || targetDay().date).map(i => i.txt);
      if (action === 'pack-all') S.ranzen.checked = items.slice();
      else {
        const it = el.dataset.item;
        S.ranzen.checked = S.ranzen.checked.includes(it) ? S.ranzen.checked.filter(x => x !== it) : [...S.ranzen.checked, it];
      }
      const all = items.length && items.every(i => S.ranzen.checked.includes(i));
      const rec = dayRec(todayISO());
      let g = 0;
      if (all && !rec.ranzen) { rec.ranzen = true; markActive(); g = award(XP.ranzen, 'Ranzen-Check', 'ranzen:' + todayISO()); }
      afterAction(g, g ? 'Ranzen gepackt' : '');
      break;
    }
    case 'next-choose': nextChoosing = !nextChoosing; render(); break;
    case 'next-pick': S.nextPick = { date: todayISO(), id }; nextChoosing = false; save(); render(); break;
    case 'next-auto': S.nextPick = null; nextChoosing = false; save(); render(); break;
    case 'scroll-ranzen': document.getElementById('ranzen')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
    case 'hw-new': openHomeworkDialog(); break;
    case 'hw-edit': openHomeworkDialog(id); break;
    case 'hw-toggle': toggleHomework(id); break;
    case 'hw-delete':
      S.homework = S.homework.filter(h => h.id !== id);
      dlg.close(); save(); render(); toast('Gelöscht');
      break;
    case 'ev-new': openEventDialog(); break;
    case 'ev-edit': openEventDialog(id); break;
    case 'ev-delete':
      S.events = S.events.filter(e => e.id !== id);
      dlg.close(); save(); render(); toast('Termin gelöscht');
      break;
    case 'subj-new': openSubjectDialog(); break;
    case 'subj-edit': openSubjectDialog(id); break;
    case 'subj-delete':
      S.subjects = S.subjects.filter(s => s.id !== id);
      dlg.close(); save(); render(); toast('Fach gelöscht');
      break;
    case 'base-edit': openBaseItemsDialog(); break;
    case 'me-tab': meTab = el.dataset.tab; render(); window.scrollTo({ top: 0 }); break;
    case 'shop-cat': shopCat = el.dataset.cat; render(); break;
    case 'equip': {
      const c = cosmetic(id);
      if (c && c.lvl <= levelInfo().lvl) { S.equipped[c.cat] = c.id; save(); render(); }
      break;
    }
    case 'album': albumOffset = Math.min(0, albumOffset + Number(el.dataset.dir)); render(); break;
    case 'daily-start': startGame(dailyGame().id, true); break;
    case 'game-start': startGame(id, false); break;
    case 'open-settings': meTab = 'settings'; go('me'); break;
    case 'holiday-new': openHolidayDialog(); break;
    case 'holiday-delete':
      S.settings.holidays = S.settings.holidays.filter(h => h.id !== id);
      save(); render();
      break;
    case 'export': exportData(); break;
    case 'sync': syncNow(true); break;
    case 'plan-week': {
      const dir = Number(el.dataset.dir);
      planWeekOffset = dir === 0 ? 0 : Math.max(-1, Math.min(1, planWeekOffset + dir));
      render();
      break;
    }
  }
});

document.addEventListener('change', ev => {
  const el = ev.target;
  const action = el.dataset && el.dataset.action;
  if (!action) return;
  if (action === 'set-name') {
    S.settings.name = el.value.trim(); save(); render();
  } else if (action === 'set-feature') {
    S.settings[el.dataset.feature] = el.checked; checkBadges(); save(); render();
  } else if (action === 'set-hour') {
    S.settings.afterSchoolHour = Number(el.value); save(); render();
  } else if (action === 'set-sync-url') {
    S.settings.syncUrl = el.value.trim(); save(); render();
  } else if (action === 'set-sync-key') {
    S.settings.syncKey = el.value.trim(); save(); render(); autoSync();
  } else if (action === 'import' && el.files && el.files[0]) {
    importData(el.files[0]); el.value = '';
  }
});

window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS[v] && v !== 'game' && v !== current) { current = v; render(); } });

// Beim Zurückkehren in die App (z. B. am nächsten Morgen) neu zeichnen.
document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); autoSync(); } });

if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => {};

checkBadges();
render();
autoSync();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
