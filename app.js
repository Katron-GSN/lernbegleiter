/* Lernbegleiter – Phase 1
 * Reine PWA, alle Daten liegen lokal im Browser (localStorage).
 */
'use strict';

/* ---------- Grundlagen ---------- */

const STORE_KEY = 'lernbegleiter.v1';
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
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
      name: 'Paul',
      periods: 8,
      afterSchoolHour: 14,
      baseItems: ['Federmäppchen', 'iPad geladen', 'Trinkflasche'],
      holidays: [],
      syncUrl: '',
      syncKey: ''
    },
    sync: null,
    subjects,
    timetable: { 1: [], 2: [], 3: [], 4: [], 5: [] },
    homework: [],
    events: [],
    xp: 0,
    log: [],
    days: {},
    weeks: {},
    ranzen: { date: null, checked: [] },
    equipped: { color: 'c-cyan', antenna: 'a-basic', eyes: 'e-basic', extra: 'x-none' }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
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
    || S.subjects.find(s => k.length >= 1 && s.name.toLowerCase().startsWith(k))
    || null;
}
function subjectFor(name, short) {
  return matchSubject(name, short) || { id: 'x:' + (short || name), name: name || short || 'Unterricht', color: '#94a3b8', items: [] };
}

function lessonsOn(s) {
  const wd = parse(s).getDay();
  const synced = S.sync && Array.isArray(S.sync.lessons) ? S.sync.lessons.filter(l => l.date === s) : [];
  if (synced.length) {
    return synced.map((l, i) => ({ nr: i + 1, time: l.start, subj: subjectFor(l.subject, l.short), status: l.status, info: l.info, room: l.room }));
  }
  if (wd < 1 || wd > 5 || inHoliday(s)) return [];
  const row = S.timetable[wd] || [];
  const out = [];
  for (let i = 0; i < S.settings.periods; i++) {
    const subj = row[i] && subjectById(row[i]);
    if (subj) out.push({ nr: i + 1, subj });
  }
  return out;
}

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
  S.log = S.log.slice(0, 300);
  const after = levelInfo().lvl;
  if (after > before) {
    setTimeout(() => toast(`Level ${after}! Neues für deinen Roboter freigeschaltet.`, 'level'), 900);
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

function checkGoals() {
  const today = todayISO();
  let gained = 0;
  const rec = dayRec(today);
  const tomorrow = nextSchoolDay(today);
  const openSoon = S.homework.filter(h => !h.doneAt && h.due <= tomorrow);
  if (!rec.goal && rec.ranzen && openSoon.length === 0) {
    rec.goal = true;
    gained += award(XP.dayGoal, 'Tagesziel erreicht', 'goal:' + today);
  }
  const wk = isoWeekKey(today);
  const mon = mondayOf(today);
  let goals = 0;
  for (let i = 0; i < 7; i++) { const r = S.days[addDays(mon, i)]; if (r && r.goal) goals++; }
  if (goals >= WEEK_GOAL_DAYS && !S.weeks[wk]) {
    S.weeks[wk] = true;
    gained += award(XP.weekGoal, 'Wochenziel erreicht', 'week:' + wk);
  }
  return gained;
}

function afterAction(gained, msg) {
  gained += checkGoals();
  save();
  if (gained > 0) toast(`+${gained} XP${msg ? ' · ' + msg : ''}`);
  render();
}

/* ---------- UI-Helfer ---------- */

let toastTimer;
function toast(text, kind) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
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
  const name = S.settings.name || 'du';
  const today = todayISO();
  const t = targetDay();
  const lessons = lessonsOn(t.date);
  const lines = [];
  const hour = new Date().getHours();
  lines.push(hour < 11 ? `Moin ${name}!` : hour < 17 ? `Hey ${name}!` : `Na ${name}, Feierabend in Sicht?`);
  if (lessons.length) {
    const running = lessons.filter(l => l.status !== 'cancelled');
    const names = [];
    running.forEach(l => { if (!names.includes(l.subj.name)) names.push(l.subj.name); });
    if (running.length && running[0].time) {
      lines.push(`${t.label} hast du ${running.length} Stunden, los geht's um ${running[0].time} Uhr: ${names.join(', ')}.`);
    } else if (running.length) {
      lines.push(`${t.label} hast du ${running.length} Stunden, von der ${running[0].nr}. bis zur ${running[running.length - 1].nr}. Stunde: ${names.join(', ')}.`);
    }
    const cancelled = lessons.filter(l => l.status === 'cancelled');
    if (cancelled.length) lines.push(`Fällt aus: ${cancelled.map(l => (l.time ? l.time + ' Uhr ' : l.nr + '. Stunde ') + l.subj.name).join(', ')}.`);
    const changed = lessons.filter(l => l.status === 'changed');
    if (changed.length) lines.push(`Geändert: ${changed.map(l => l.subj.name + (l.info ? ' (' + l.info + ')' : '')).join(', ')}.`);
  } else {
    lines.push(`${t.label} ist noch kein Stundenplan eingetragen. Das kannst du unter „Plan“ machen.`);
  }
  const items = ranzenItems(t.date).map(i => i.txt);
  if (items.length) lines.push(`Für den Ranzen: ${items.join(', ')}.`);
  const open = S.homework.filter(h => !h.doneAt).sort((a, b) => a.due.localeCompare(b.due));
  const late = open.filter(h => h.due < today);
  const soon = open.filter(h => h.due >= today && h.due <= t.date);
  if (late.length) lines.push(`Achtung, ${late.length === 1 ? 'eine Hausaufgabe ist' : late.length + ' Hausaufgaben sind'} schon überfällig.`);
  if (soon.length) {
    lines.push(`Bis ${t.label === 'Heute' ? 'heute' : t.label.toLowerCase() === 'morgen' ? 'morgen' : t.label} fällig: ` +
      soon.map(h => `${subjectById(h.subjectId)?.name || 'Sonstiges'}: ${h.text}`).join('; ') + '.');
  } else if (!late.length) {
    lines.push('Bis dahin ist keine Hausaufgabe fällig. Stark.');
  }
  const upcoming = S.events.filter(e => e.date >= today && diffDays(today, e.date) <= 7).sort((a, b) => a.date.localeCompare(b.date));
  upcoming.forEach(e => {
    const subj = subjectById(e.subjectId)?.name;
    lines.push(`${e.type}${subj ? ' in ' + subj : ''} ${relDay(e.date) === 'heute' ? 'ist heute' : relDay(e.date).startsWith('in ') ? relDay(e.date) : 'am ' + relDay(e.date)}${e.topic ? ', Thema: ' + e.topic : ''}.`);
  });
  const st = streakInfo().count;
  if (st >= 2) lines.push(`Deine Serie steht bei ${st} Schultagen. Weiter so!`);
  lines.push('Viel Erfolg!');
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

function viewToday() {
  const today = todayISO();
  const now = new Date();
  const t = targetDay();
  const lessons = lessonsOn(t.date);
  const rec = S.days[today] || {};
  const st = streakInfo();
  const lv = levelInfo();

  if (S.ranzen.date !== t.date) S.ranzen = { date: t.date, checked: [] };
  const items = ranzenItems(t.date);
  const checked = new Set(S.ranzen.checked);
  const allPacked = items.length > 0 && items.every(i => checked.has(i.txt));

  const open = S.homework.filter(h => !h.doneAt).sort((a, b) => a.due.localeCompare(b.due));
  const shownHw = open.filter(h => diffDays(today, h.due) <= 7);
  const events = S.events.filter(e => e.date >= today && diffDays(today, e.date) <= 14).sort((a, b) => a.date.localeCompare(b.date));

  const greet = now.getHours() < 11 ? 'Moin' : now.getHours() < 17 ? 'Hey' : 'Guten Abend';
  const briefing = briefingText();

  return `
  <div class="stack">
    <div class="hello">
      <div>
        <h1>${greet} ${esc(S.settings.name)}!</h1>
        <p class="date">${WEEKDAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]}${inHoliday(today) ? ' · Ferien 🌴' : ''}</p>
      </div>
      <div class="row">
        <span class="chip">🔥 Serie ${st.count}${st.count >= STREAK_BONUS_FROM ? ' · XP ×1,2' : ''}</span>
        <span class="chip">⭐ Level ${lv.lvl}</span>
      </div>
    </div>

    <section class="card briefing">
      <div class="card-head">
        <h2>🎧 Dein Briefing</h2>
        <span class="tag">${rec.briefing ? 'erledigt ✓' : `+${XP.briefing} XP`}</span>
      </div>
      <div class="text">${briefing.map(l => `<p>${esc(l)}</p>`).join('')}</div>
      <div class="row">
        <button class="btn primary" data-action="speak">${speaking ? '⏹ Stopp' : '▶️ Vorlesen'}</button>
        ${rec.briefing ? '' : `<button class="btn" data-action="briefing-done">Gelesen ✓</button>`}
      </div>
    </section>

    <div class="grid-2">
      <section class="card">
        <div class="card-head">
          <h2>${esc(t.label)}: Stundenplan</h2>
          <span class="tag">${fmtDate(t.date)}</span>
        </div>
        ${lessons.length ? `<div class="lessons">${lessons.map(l => `
          <div class="lesson ${l.status || ''}"><span class="nr">${l.time ? esc(l.time) : l.nr}</span><span class="subj">${subjectDot(l.subj)}<span class="nm">${esc(l.subj.name)}</span>
            ${l.status === 'cancelled' ? '<span class="flag bad">fällt aus</span>' : l.status === 'changed' ? '<span class="flag warn">geändert</span>' : ''}
            ${l.room ? `<span class="muted small">${esc(l.room)}</span>` : ''}</span>
            ${l.info ? `<span class="info">${esc(l.info)}</span>` : ''}</div>`).join('')}</div>`
        : `<p class="empty">Noch kein Stundenplan für diesen Tag. <button class="btn small" data-go="plan">Plan eintragen</button></p>`}
      </section>

      <section class="card">
        <div class="card-head">
          <h2>🎒 Ranzen-Check für ${esc(t.label === 'Heute' ? 'heute' : t.label)}</h2>
          <span class="tag">${rec.ranzen ? 'gepackt ✓' : `+${XP.ranzen} XP`}</span>
        </div>
        ${items.length ? `<ul class="check-list">${items.map(i => `
          <li><button class="check ${checked.has(i.txt) ? 'done' : ''}" data-action="pack" data-item="${esc(i.txt)}">
            <span class="box">${checked.has(i.txt) ? '✓' : ''}</span>
            <span class="label">${esc(i.txt)}</span>
            ${i.meta ? `<span class="meta">${esc(i.meta)}</span>` : ''}
          </button></li>`).join('')}</ul>
          ${allPacked ? '' : `<button class="btn small ghost" data-action="pack-all">Alles drin</button>`}`
        : `<p class="empty">Nichts zu packen.</p>`}
      </section>
    </div>

    <section class="card">
      <div class="card-head">
        <h2>📝 Hausaufgaben</h2>
        <button class="btn small primary" data-action="hw-new">+ Neu</button>
      </div>
      ${shownHw.length ? `<div class="stack" style="gap:6px">${shownHw.map(hwRow).join('')}</div>`
        : `<p class="empty">${open.length ? 'Diese Woche ist nichts fällig.' : 'Keine offenen Hausaufgaben. 🎉'}</p>`}
      ${open.length > shownHw.length ? `<button class="btn small ghost" data-go="homework">Alle ${open.length} offenen ansehen</button>` : ''}
    </section>

    <section class="card">
      <div class="card-head">
        <h2>📅 Bald dran</h2>
        <button class="btn small" data-action="ev-new">+ Termin</button>
      </div>
      ${events.length ? `<div class="stack" style="gap:6px">${events.map(evRow).join('')}</div>`
        : `<p class="empty">In den nächsten zwei Wochen stehen keine Arbeiten oder Tests an.</p>`}
    </section>

    <section class="card">
      <div class="card-head"><h2>🎯 Ziele</h2></div>
      <ul class="check-list">
        <li><div class="check ${rec.goal ? 'done' : ''}"><span class="box">${rec.goal ? '✓' : ''}</span>
          <span class="label">Tagesziel: Ranzen gepackt und alles bis zum nächsten Schultag erledigt</span><span class="meta">+${XP.dayGoal}</span></div></li>
        <li><div class="check ${S.weeks[isoWeekKey(today)] ? 'done' : ''}"><span class="box">${S.weeks[isoWeekKey(today)] ? '✓' : ''}</span>
          <span class="label">Wochenziel: Tagesziel an ${WEEK_GOAL_DAYS} Tagen dieser Woche (${weekGoalCount()}/${WEEK_GOAL_DAYS})</span><span class="meta">+${XP.weekGoal}</span></div></li>
      </ul>
    </section>
  </div>`;
}
function weekGoalCount() {
  const mon = mondayOf(todayISO());
  let n = 0;
  for (let i = 0; i < 7; i++) { const r = S.days[addDays(mon, i)]; if (r && r.goal) n++; }
  return n;
}

function hwRow(h) {
  const s = subjectById(h.subjectId);
  const done = !!h.doneAt;
  return `<div class="hw ${done ? 'done' : ''}">
    <button class="box" data-action="hw-toggle" data-id="${esc(h.id)}" aria-label="${done ? 'Als offen markieren' : 'Erledigt'}">${done ? '✓' : ''}</button>
    <div>
      <div class="text">${esc(h.text)}</div>
      <div class="sub">${subjectDot(s)}${esc(s ? s.name : 'Sonstiges')}${h.source ? ` · <span class="src">${h.source === 'webuntis' ? 'WebUntis' : 'itslearning'}</span>` : ''} · <span class="${done ? '' : dueClass(h.due)}">fällig ${esc(relDay(h.due))} (${fmtDate(h.due)})</span></div>
    </div>
    <button class="icon-btn" data-action="hw-edit" data-id="${esc(h.id)}" aria-label="Bearbeiten">✎</button>
  </div>`;
}

function evRow(e) {
  const s = subjectById(e.subjectId);
  const d = parse(e.date);
  return `<div class="event">
    <div class="when"><div class="d">${d.getDate()}</div><div class="m">${WD_SHORT[d.getDay()]} · ${MONTHS[d.getMonth()]}</div></div>
    <div>
      <div class="title">${esc(e.type)}${s ? ' ' + esc(s.name) : ''}</div>
      <div class="muted small">${s ? subjectDot(s) : ''} ${esc(e.topic || 'Kein Thema eingetragen')}</div>
    </div>
    <div class="row" style="gap:4px">${e.date >= todayISO() ? countdownBadge(e.date) : ''}
      <button class="icon-btn" data-action="ev-edit" data-id="${esc(e.id)}" aria-label="Bearbeiten">✎</button></div>
  </div>`;
}

/* ---------- Ansicht: Hausaufgaben ---------- */

function viewHomework() {
  const today = todayISO();
  const open = S.homework.filter(h => !h.doneAt).sort((a, b) => a.due.localeCompare(b.due));
  const late = open.filter(h => h.due < today);
  const upcoming = open.filter(h => h.due >= today);
  const done = S.homework.filter(h => h.doneAt && diffDays(h.doneAt, today) <= 14).sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  const section = (title, list, emptyText) => `
    <section class="card">
      <div class="card-head"><h2>${title}</h2><span class="tag">${list.length}</span></div>
      ${list.length ? `<div class="stack" style="gap:6px">${list.map(hwRow).join('')}</div>` : `<p class="empty">${emptyText}</p>`}
    </section>`;
  return `
  <div class="stack">
    <div class="hello">
      <div><h1>Hausaufgaben</h1><p class="muted">Erledigt +${XP.hwDone} XP, pünktlich +${XP.hwOnTime}, selbst eingetragen +${XP.hwSelf}</p></div>
      <button class="btn primary" data-action="hw-new">+ Neue Hausaufgabe</button>
    </div>
    ${late.length ? section('⚠️ Überfällig', late, '') : ''}
    ${section('Offen', upcoming, 'Alles erledigt. 🎉')}
    ${section('Erledigt (letzte 14 Tage)', done, 'Noch nichts abgehakt.')}
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
      <h2>${h ? 'Hausaufgabe bearbeiten' : 'Neue Hausaufgabe'}</h2>
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
  afterAction(g, 'Hausaufgabe erledigt');
}

/* ---------- Ansicht: Termine (Pauls eigener Schulkalender) ---------- */

function viewEvents() {
  const today = todayISO();
  const upcoming = S.events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = S.events.filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  return `
  <div class="stack">
    <div class="hello">
      <div><h1>Meine Termine</h1><p class="muted">Klassenarbeiten, Tests und Abgaben, die du selbst einträgst.</p></div>
      <button class="btn primary" data-action="ev-new">+ Termin eintragen</button>
    </div>
    <section class="card">
      <div class="card-head"><h2>Kommt noch</h2><span class="tag">${upcoming.length}</span></div>
      ${upcoming.length ? `<div class="stack" style="gap:6px">${upcoming.map(evRow).join('')}</div>`
        : `<p class="empty">Keine Termine eingetragen. Sobald eine Arbeit angekündigt wird: hier eintragen.</p>`}
    </section>
    ${past.length ? `<section class="card">
      <div class="card-head"><h2>Vorbei</h2></div>
      <div class="stack" style="gap:6px">${past.map(evRow).join('')}</div>
    </section>` : ''}
    <p class="muted small">Später (Phase 2) kommen Termine aus WebUntis und itslearning automatisch dazu. Ab Phase 3 baut die App aus jedem Termin einen Lernplan.</p>
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

function viewPlan() {
  const periods = S.settings.periods;
  const days = [1, 2, 3, 4, 5];
  return `
  <div class="stack">
    <div class="hello"><div><h1>Stundenplan</h1><p class="muted">${S.sync && S.sync.lessons && S.sync.lessons.length ? 'Der Stundenplan kommt automatisch aus WebUntis. Dieser Plan gilt nur, wenn keine Schuldaten da sind.' : 'Einmal eintragen, dann weiß die App jeden Tag, was in den Ranzen muss.'}</p></div></div>
    <section class="card">
      <div class="card-head">
        <h2>Woche</h2>
        <label class="row small muted">Stunden
          <select data-action="periods" class="btn small">${[5, 6, 7, 8, 9, 10].map(n => `<option ${n === periods ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </label>
      </div>
      <div class="tt-wrap"><table class="tt">
        <thead><tr><th></th>${days.map(d => `<th>${WD_SHORT[d]}</th>`).join('')}</tr></thead>
        <tbody>${Array.from({ length: periods }, (_, i) => `<tr><td>${i + 1}</td>${days.map(d => `
          <td><select data-action="tt" data-day="${d}" data-p="${i}" aria-label="${WEEKDAYS[d]} ${i + 1}. Stunde">
            <option value="">–</option>${S.subjects.map(s => `<option value="${esc(s.id)}" ${(S.timetable[d] || [])[i] === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select></td>`).join('')}</tr>`).join('')}
        </tbody>
      </table></div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Fächer und was in den Ranzen gehört</h2><button class="btn small primary" data-action="subj-new">+ Fach</button></div>
      <div class="stack" style="gap:6px">${S.subjects.map(s => `
        <div class="subject-row">
          <span class="sw" style="background:${esc(s.color)}"></span>
          <div><div><b>${esc(s.name)}</b></div><div class="items">${esc((s.items || []).join(', ') || 'keine Sachen eingetragen')}</div></div>
          <button class="icon-btn" data-action="subj-edit" data-id="${esc(s.id)}" aria-label="${esc(s.name)} bearbeiten">✎</button>
        </div>`).join('')}
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Kommt immer mit</h2><button class="icon-btn" data-action="base-edit" aria-label="Bearbeiten">✎</button></div>
      <p>${esc(S.settings.baseItems.join(', ') || 'Nichts eingetragen')}</p>
    </section>
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
      <label class="field">Sachen für den Ranzen (eine pro Zeile)
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

/* ---------- Roboter-Avatar ---------- */

const COSMETICS = [
  { id: 'c-cyan', cat: 'color', name: 'Cyan', lvl: 1, v: '#22d3ee' },
  { id: 'a-basic', cat: 'antenna', name: 'Standard-Antenne', lvl: 1 },
  { id: 'e-basic', cat: 'eyes', name: 'Standard-Augen', lvl: 1 },
  { id: 'x-none', cat: 'extra', name: 'Kein Extra', lvl: 1 },
  { id: 'c-orange', cat: 'color', name: 'Orange', lvl: 2, v: '#fb923c' },
  { id: 'a-bolt', cat: 'antenna', name: 'Blitz-Antenne', lvl: 3 },
  { id: 'e-visor', cat: 'eyes', name: 'Visier', lvl: 4 },
  { id: 'c-violet', cat: 'color', name: 'Lila', lvl: 5, v: '#a78bfa' },
  { id: 'x-jet', cat: 'extra', name: 'Jetpack', lvl: 6 },
  { id: 'a-dish', cat: 'antenna', name: 'Satellitenschüssel', lvl: 7 },
  { id: 'e-laser', cat: 'eyes', name: 'Laseraugen', lvl: 8 },
  { id: 'c-gold', cat: 'color', name: 'Gold', lvl: 9, v: '#facc15' },
  { id: 'x-cape', cat: 'extra', name: 'Umhang', lvl: 10 },
  { id: 'c-carbon', cat: 'color', name: 'Carbon', lvl: 12, v: '#475569' },
  { id: 'x-wings', cat: 'extra', name: 'Flügel', lvl: 15 }
];
const CAT_NAMES = { color: 'Farbe', antenna: 'Antenne', eyes: 'Augen', extra: 'Extra' };

function robotSVG(eq = S.equipped) {
  const col = (COSMETICS.find(c => c.id === eq.color) || COSMETICS[0]).v;
  const dark = '#0b1120';
  const extra = {
    'x-jet': `<rect x="40" y="96" width="22" height="56" rx="8" fill="#64748b"/><rect x="138" y="96" width="22" height="56" rx="8" fill="#64748b"/>
      <path d="M44 152 l7 22 l7 -22z" fill="#fb923c"/><path d="M142 152 l7 22 l7 -22z" fill="#fb923c"/>`,
    'x-cape': `<path d="M58 96 L142 96 L160 178 L40 178 Z" fill="#dc2626"/>`,
    'x-wings': `<path d="M60 110 C20 90 10 130 30 150 C40 140 50 135 62 135Z" fill="#e2e8f0"/><path d="M140 110 C180 90 190 130 170 150 C160 140 150 135 138 135Z" fill="#e2e8f0"/>`
  }[eq.extra] || '';
  const antenna = {
    'a-basic': `<line x1="100" y1="26" x2="100" y2="12" stroke="${dark}" stroke-width="4"/><circle cx="100" cy="10" r="6" fill="${col}" stroke="${dark}" stroke-width="3"/>`,
    'a-bolt': `<path d="M104 4 L92 18 L101 18 L95 30 L110 14 L101 14 Z" fill="#facc15" stroke="${dark}" stroke-width="2"/>`,
    'a-dish': `<line x1="100" y1="26" x2="100" y2="16" stroke="${dark}" stroke-width="4"/><path d="M84 6 Q100 26 116 6 Z" fill="#cbd5e1" stroke="${dark}" stroke-width="3"/>`
  }[eq.antenna] || '';
  const eyes = {
    'e-basic': `<circle cx="82" cy="54" r="9" fill="#e0f2fe"/><circle cx="118" cy="54" r="9" fill="#e0f2fe"/><circle cx="84" cy="54" r="4" fill="${dark}"/><circle cx="120" cy="54" r="4" fill="${dark}"/>`,
    'e-visor': `<rect x="66" y="44" width="68" height="20" rx="10" fill="#22d3ee"/><rect x="72" y="48" width="22" height="5" rx="2.5" fill="#e0f2fe" opacity=".8"/>`,
    'e-laser': `<circle cx="82" cy="54" r="9" fill="#f87171"/><circle cx="118" cy="54" r="9" fill="#f87171"/><circle cx="82" cy="54" r="4" fill="#fee2e2"/><circle cx="118" cy="54" r="4" fill="#fee2e2"/>`
  }[eq.eyes] || '';
  return `<svg viewBox="0 0 200 200" role="img" aria-label="Dein Roboter">
    ${extra}
    ${antenna}
    <rect x="56" y="26" width="88" height="62" rx="20" fill="${col}" stroke="${dark}" stroke-width="4"/>
    <rect x="66" y="38" width="68" height="34" rx="12" fill="${dark}"/>
    ${eyes}
    <rect x="86" y="76" width="28" height="5" rx="2.5" fill="${dark}" opacity=".6"/>
    <rect x="90" y="88" width="20" height="10" fill="${dark}"/>
    <rect x="60" y="96" width="80" height="64" rx="18" fill="${col}" stroke="${dark}" stroke-width="4"/>
    <circle cx="100" cy="122" r="12" fill="${dark}"/><circle cx="100" cy="122" r="6" fill="#34d399"/>
    <rect x="38" y="104" width="18" height="40" rx="9" fill="${col}" stroke="${dark}" stroke-width="4"/>
    <rect x="144" y="104" width="18" height="40" rx="9" fill="${col}" stroke="${dark}" stroke-width="4"/>
    <rect x="72" y="160" width="20" height="24" rx="6" fill="${col}" stroke="${dark}" stroke-width="4"/>
    <rect x="108" y="160" width="20" height="24" rx="6" fill="${col}" stroke="${dark}" stroke-width="4"/>
  </svg>`;
}

/* ---------- Ansicht: Ich (Fortschritt + Einstellungen) ---------- */

function viewMe() {
  const lv = levelInfo();
  const st = streakInfo();
  const today = todayISO();
  const mon = mondayOf(today);
  const week = [0, 1, 2, 3, 4].map(i => addDays(mon, i));
  const next = COSMETICS.filter(c => c.lvl > lv.lvl).sort((a, b) => a.lvl - b.lvl)[0];
  return `
  <div class="stack">
    <div class="grid-2">
      <section class="card">
        <div class="avatar-wrap">${robotSVG()}</div>
        <div class="card-head"><h2>Level ${lv.lvl}</h2><span class="tag">${S.xp} XP gesamt</span></div>
        <div class="bar"><span style="width:${lv.pct}%"></span></div>
        <p class="muted small">Noch ${lv.to - S.xp} XP bis Level ${lv.lvl + 1}${next ? ` · dann wartet: ${esc(next.name)} (ab Level ${next.lvl})` : ''}</p>
      </section>
      <section class="card">
        <div class="stats">
          <div class="stat"><div class="v">🔥 ${st.count}</div><div class="l">Serie (Schultage)</div></div>
          <div class="stat"><div class="v">${st.jokerUsedThisWeek ? '0' : '1'}</div><div class="l">Joker diese Woche</div></div>
          <div class="stat"><div class="v">${st.count >= STREAK_BONUS_FROM ? '×1,2' : '×1'}</div><div class="l">XP-Bonus</div></div>
        </div>
        <div class="week">${week.map(d => {
          const r = S.days[d] || {};
          const sym = inHoliday(d) ? '🌴' : r.goal ? '🎯' : r.active ? '✅' : d < today ? '·' : '';
          return `<div class="day ${d === today ? 'today' : ''}"><span class="s">${sym || '&nbsp;'}</span>${WD_SHORT[parse(d).getDay()]}</div>`;
        }).join('')}</div>
        <p class="muted small">Die Serie zählt Schultage, an denen du etwas gemacht hast. Wochenenden und Ferien unterbrechen sie nicht. Einen verpassten Tag pro Woche rettet der Joker automatisch. Ab ${STREAK_BONUS_FROM} Tagen gibt es ×1,2 auf alle XP.</p>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h2>🤖 Roboter anpassen</h2><span class="tag">Neues gibt es mit jedem Level</span></div>
      ${Object.keys(CAT_NAMES).map(cat => `
        <h3>${CAT_NAMES[cat]}</h3>
        <div class="cosmetics">${COSMETICS.filter(c => c.cat === cat).map(c => {
          const locked = c.lvl > lv.lvl;
          const on = S.equipped[cat] === c.id;
          return `<button class="cos ${on ? 'on' : ''} ${locked ? 'locked' : ''}" data-action="equip" data-id="${c.id}" ${locked ? 'disabled' : ''}>
            <span class="n">${locked ? '🔒 ' : ''}${esc(c.name)}</span><span class="h">${locked ? 'ab Level ' + c.lvl : on ? 'ausgerüstet' : 'antippen'}</span></button>`;
        }).join('')}</div>`).join('')}
    </section>

    <div class="grid-2">
      <section class="card">
        <div class="card-head"><h2>So gibt es XP</h2></div>
        <table class="xp-table"><tbody>
          <tr><td>Ranzen-Check erledigt</td><td>+${XP.ranzen}</td></tr>
          <tr><td>Briefing gelesen oder gehört</td><td>+${XP.briefing}</td></tr>
          <tr><td>Hausaufgabe erledigt</td><td>+${XP.hwDone}</td></tr>
          <tr><td>… pünktlich</td><td>+${XP.hwOnTime}</td></tr>
          <tr><td>… selbst eingetragen</td><td>+${XP.hwSelf}</td></tr>
          <tr><td>Tagesziel</td><td>+${XP.dayGoal}</td></tr>
          <tr><td>Wochenziel</td><td>+${XP.weekGoal}</td></tr>
        </tbody></table>
        <p class="muted small">Es gibt nie Abzüge. XP gibt es für Gewohnheiten, nicht für Noten.</p>
      </section>
      <section class="card">
        <div class="card-head"><h2>Zuletzt bekommen</h2></div>
        <div class="log">${S.log.slice(0, 12).map(l => `<div><span>${esc(l.r)} · ${fmtDate(l.d, false)}</span><b>+${l.a}</b></div>`).join('') || '<p class="empty">Noch keine XP. Fang mit dem Ranzen-Check an!</p>'}</div>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h2>⚙️ Einstellungen</h2></div>
      <label class="field">Name <input data-action="set-name" value="${esc(S.settings.name)}"></label>
      <label class="field">Ab wann zeigt „Heute“ schon den nächsten Schultag?
        <select data-action="set-hour">${[12, 13, 14, 15, 16, 17].map(h => `<option value="${h}" ${h === S.settings.afterSchoolHour ? 'selected' : ''}>ab ${h}:00 Uhr</option>`).join('')}</select>
      </label>
      <div class="card-head"><h3>Ferien</h3><button class="btn small" data-action="holiday-new">+ Ferien</button></div>
      ${S.settings.holidays.length ? `<div class="stack" style="gap:6px">${S.settings.holidays.slice().sort((a, b) => a.from.localeCompare(b.from)).map(h => `
        <div class="subject-row"><span>🌴</span><div><b>${esc(h.label || 'Ferien')}</b><div class="items">${fmtDate(h.from)} bis ${fmtDate(h.to)}</div></div>
        <button class="icon-btn" data-action="holiday-delete" data-id="${esc(h.id)}" aria-label="Löschen">✕</button></div>`).join('')}</div>`
        : `<p class="empty">Keine Ferien eingetragen. In den Ferien pausiert die Serie.</p>`}
      <div class="card-head"><h3>🔌 Schulanbindung (WebUntis, itslearning)</h3></div>
      <p class="muted small">Holt Stundenplan, Ausfälle, Hausaufgaben und Prüfungen automatisch. Die Adresse und den App-Schlüssel bekommst du beim Einrichten des Abrufdienstes.</p>
      <label class="field">Adresse des Abrufdienstes <input data-action="set-sync-url" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="https://lernbegleiter-sync.….workers.dev" value="${esc(S.settings.syncUrl)}"></label>
      <label class="field">App-Schlüssel <input data-action="set-sync-key" type="password" autocomplete="off" value="${esc(S.settings.syncKey)}"></label>
      <div class="row">
        <button class="btn" data-action="sync" ${S.settings.syncUrl && S.settings.syncKey ? '' : 'disabled'}>${syncing ? '⏳ Lädt …' : '🔄 Jetzt abrufen'}</button>
        <span class="muted small">${syncStatusText()}</span>
      </div>
      <div class="card-head"><h3>Datensicherung</h3></div>
      <p class="muted small">Alle Daten liegen nur auf diesem Gerät. Sichere sie ab und zu, z. B. in der Dateien-App.</p>
      <div class="row">
        <button class="btn" data-action="export">⬇️ Sichern</button>
        <label class="btn" style="display:inline-flex;align-items:center">⬆️ Wiederherstellen<input type="file" accept="application/json,.json" data-action="import" hidden></label>
      </div>
    </section>
    <p class="muted small" style="text-align:center">Lernbegleiter · Phase 1 · Daten bleiben auf diesem Gerät</p>
  </div>`;
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
      if (!confirmInline('Sicherung laden? Die aktuellen Daten werden ersetzt.')) return;
      S = Object.assign(defaultState(), data);
      save(); render();
      toast('Sicherung geladen');
    } catch (e) { toast('Diese Datei ist keine Lernbegleiter-Sicherung'); }
  };
  reader.readAsText(file);
}
function confirmInline(msg) { return window.confirm(msg); }

/* ---------- Schulanbindung ---------- */

let syncing = false;
const SYNC_EVERY_MS = 30 * 60 * 1000;

function syncStatusText() {
  if (!S.settings.syncUrl || !S.settings.syncKey) return 'Noch nicht eingerichtet';
  if (!S.sync || !S.sync.fetchedAt) return 'Noch nie abgerufen';
  const d = new Date(S.sync.fetchedAt);
  const errs = (S.sync.errors || []).map(e => e.source).join(', ');
  return `Stand: ${fmtDate(iso(d), false)}, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr${errs ? ' · Probleme: ' + errs : ''}`;
}

function applySync(data) {
  const today = todayISO();
  S.sync = { updated: data.updated, fetchedAt: Date.now(), lessons: data.lessons || [], errors: data.errors || [] };
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
    else { S.homework.push({ ...h, created: today, self: false, doneAt: null }); added++; }
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
  if (!S.settings.syncUrl || !S.settings.syncKey || !navigator.onLine) return;
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

const VIEWS = { today: viewToday, homework: viewHomework, events: viewEvents, plan: viewPlan, me: viewMe };
let current = (location.hash || '#today').slice(1);
if (!VIEWS[current]) current = 'today';

function render() {
  document.getElementById('view').innerHTML = VIEWS[current]();
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.go === current));
  const lv = levelInfo();
  const st = streakInfo();
  document.getElementById('xp-pill').innerHTML = `<span class="flame">🔥 ${st.count}</span><span>Lv ${lv.lvl} · ${S.xp} XP</span>`;
}
function go(view) {
  if (!VIEWS[view]) return;
  current = view;
  history.replaceState(null, '', '#' + view);
  render();
  window.scrollTo({ top: 0 });
}

document.addEventListener('click', ev => {
  const goEl = ev.target.closest('[data-go]');
  if (goEl) { go(goEl.dataset.go); return; }
  const el = ev.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const { action, id } = el.dataset;
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
      Object.keys(S.timetable).forEach(d => { S.timetable[d] = (S.timetable[d] || []).map(x => x === id ? '' : x); });
      dlg.close(); save(); render(); toast('Fach gelöscht');
      break;
    case 'base-edit': openBaseItemsDialog(); break;
    case 'equip': {
      const c = COSMETICS.find(x => x.id === id);
      if (c && c.lvl <= levelInfo().lvl) { S.equipped[c.cat] = c.id; save(); render(); }
      break;
    }
    case 'holiday-new': openHolidayDialog(); break;
    case 'holiday-delete':
      S.settings.holidays = S.settings.holidays.filter(h => h.id !== id);
      save(); render();
      break;
    case 'export': exportData(); break;
    case 'sync': syncNow(true); break;
  }
});

document.addEventListener('change', ev => {
  const el = ev.target;
  const action = el.dataset && el.dataset.action;
  if (!action) return;
  if (action === 'tt') {
    const d = el.dataset.day, p = Number(el.dataset.p);
    const row = S.timetable[d] || (S.timetable[d] = []);
    row[p] = el.value;
    save();
  } else if (action === 'periods') {
    S.settings.periods = Number(el.value); save(); render();
  } else if (action === 'set-name') {
    S.settings.name = el.value.trim() || 'du'; save(); render();
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

window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS[v] && v !== current) { current = v; render(); } });

// Beim Zurückkehren in die App (z. B. am nächsten Morgen) neu zeichnen.
document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); autoSync(); } });

if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => {};

render();
autoSync();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
