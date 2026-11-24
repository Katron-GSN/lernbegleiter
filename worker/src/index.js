/* Lernbegleiter-Abrufdienst
 *
 * Holt Stundenplan, Vertretungen, Hausaufgaben und Prüfungen aus WebUntis
 * und Aufgaben aus dem itslearning-iCal-Feed. Die App ruft nur GET /sync auf.
 *
 * Läuft unverändert auf zwei Wegen:
 *   - Cloudflare Workers: der `export default` unten (Cache über caches.default)
 *   - eigener Server mit Node.js 18+: `node server.js` (nutzt `handle` mit einem Speicher-Cache)
 * Die Logik selbst nutzt nur Web-Standards (fetch, Request, Response, Intl, btoa).
 *
 * Geheime Werte (bei Cloudflare als Secret, auf eigenem Server als Umgebungsvariable; nie ins Repo):
 *   APP_KEY         beliebiges langes Passwort, das auch in der App eingetragen wird
 *   UNTIS_SERVER    z. B. "nessa.webuntis.com" (steht in der Adresszeile von WebUntis)
 *   UNTIS_SCHOOL    optional: Schulname wie beim WebUntis-Login; leer = wird automatisch gesucht
 *   UNTIS_USER      Pauls WebUntis-Benutzername
 *   UNTIS_PASSWORD  Pauls WebUntis-Passwort
 *   ITSL_ICAL_URL   Pauls itslearning-iCal-Link (webcal:// oder https://)
 * Normale Variable (wrangler.toml): ALLOWED_ORIGIN
 */

const DAYS_BACK = 1;
const DAYS_AHEAD = 14;
export const CACHE_SECONDS = 600;

/* Plattformunabhängiger Kern.
 * cache = { get(): Promise<object|null>, put(data): Promise<void> } – vom jeweiligen Host bereitgestellt. */
export async function handle(request, env, cache = null, fetchFn = fetch) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  if (url.pathname === '/' || url.pathname === '/health') {
    return json({ ok: true, service: 'lernbegleiter-sync' }, 200, cors);
  }
  if (url.pathname !== '/sync') return json({ error: 'not_found' }, 404, cors);

  const key = request.headers.get('X-App-Key') || '';
  if (!env.APP_KEY || !timingSafeEqual(key, env.APP_KEY)) return json({ error: 'unauthorized' }, 401, cors);

  const fresh = url.searchParams.get('fresh') === '1';
  if (cache && !fresh) {
    const hit = await cache.get();
    if (hit) return json(hit, 200, cors);
  }
  const result = await collect(env, fetchFn);
  if (cache) await cache.put(result);
  return json(result, 200, cors);
}

/* Cloudflare-Workers-Einstieg */
export default {
  async fetch(request, env) {
    const key = new Request('https://cache.lernbegleiter/sync');
    const cache = {
      async get() { const r = await caches.default.match(key); return r ? r.json() : null; },
      async put(data) {
        await caches.default.put(key, json(data, 200, { 'Cache-Control': `max-age=${CACHE_SECONDS}` }));
      }
    };
    return handle(request, env, cache);
  }
};

export async function collect(env, fetchFn = fetch, now = new Date()) {
  const from = addDays(now, -DAYS_BACK);
  const to = addDays(now, DAYS_AHEAD);
  const out = { updated: now.toISOString(), lessons: [], homework: [], exams: [], assignments: [], errors: [] };

  if (env.UNTIS_SERVER && env.UNTIS_USER) {
    try {
      const u = await untis(env, fetchFn, from, to);
      out.lessons = u.lessons; out.homework = u.homework; out.exams = u.exams;
      out.errors.push(...u.errors);
    } catch (e) {
      out.errors.push({ source: 'webuntis', message: String(e.message || e) });
    }
  }
  if (env.ITSL_ICAL_URL) {
    try {
      const href = env.ITSL_ICAL_URL.replace(/^webcal:/i, 'https:');
      const res = await fetchFn(href, { headers: { 'User-Agent': 'Mozilla/5.0 Lernbegleiter' } });
      if (!res.ok) throw new Error('itslearning HTTP ' + res.status);
      const events = parseICS(await res.text());
      out.assignments = events
        .filter(e => e.start && e.start >= ymd(from) && e.start <= ymd(addDays(now, 60)))
        .map(e => ({ id: 'itsl:' + e.uid, title: e.summary, due: e.start, course: e.location || e.categories || '', info: e.description || '' }));
    } catch (e) {
      out.errors.push({ source: 'itslearning', message: String(e.message || e) });
    }
  }
  return out;
}

/* ---------- WebUntis (inoffizielle Schnittstelle, Schülerzugang) ---------- */

async function untis(env, fetchFn, from, to) {
  const server = String(env.UNTIS_SERVER).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const base = `https://${server}/WebUntis`;
  const school = env.UNTIS_SCHOOL || await findSchoolLoginName(server, fetchFn);
  const schoolCookie = `schoolname="_${btoa(unescape(encodeURIComponent(school)))}"`;
  let session = '';

  const rpc = async (method, params) => {
    const res = await fetchFn(`${base}/jsonrpc.do?school=${encodeURIComponent(school)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ id: 'lb', method, params, jsonrpc: '2.0' })
    });
    const data = await res.json().catch(() => ({}));
    if (data.error) throw new Error(`WebUntis ${method}: ${data.error.message || data.error.code}`);
    return data.result;
  };
  const cookie = () => `${session ? 'JSESSIONID=' + session + '; ' : ''}${schoolCookie}`;

  const auth = await rpc('authenticate', { user: env.UNTIS_USER, password: env.UNTIS_PASSWORD, client: 'Lernbegleiter' });
  if (!auth || !auth.sessionId) throw new Error('WebUntis-Anmeldung fehlgeschlagen');
  session = auth.sessionId;
  const personId = auth.personId;
  const personType = auth.personType || 5;

  const out = { lessons: [], homework: [], exams: [] };
  const errors = [];

  // REST-Endpunkte brauchen teils ein Token
  let bearer = '';
  try {
    const t = await fetchFn(`${base}/api/token/new`, { headers: { Cookie: cookie() } });
    if (t.ok) bearer = (await t.text()).trim();
  } catch { /* optional */ }
  const rest = async path => {
    const headers = { Cookie: cookie(), Accept: 'application/json' };
    if (bearer) headers.Authorization = 'Bearer ' + bearer;
    const res = await fetchFn(base + path, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} für ${path.split('?')[0]}`);
    return res.json();
  };

  try {
    const tt = await rpc('getTimetable', {
      options: {
        element: { id: personId, type: personType },
        startDate: untisDate(from), endDate: untisDate(to),
        showSubstText: true, showInfo: true, showLsText: true,
        subjectFields: ['id', 'name', 'longname'],
        roomFields: ['name'], teacherFields: ['name']
      }
    });
    out.lessons = mapTimetable(tt || []);
  } catch (e) { errors.push({ source: 'webuntis-stundenplan', message: String(e.message || e) }); }

  try {
    const hw = await rest(`/api/homeworks/lessons?startDate=${untisDate(from)}&endDate=${untisDate(to)}`);
    out.homework = mapHomework(hw);
  } catch (e) { errors.push({ source: 'webuntis-hausaufgaben', message: String(e.message || e) }); }

  try {
    const ex = await rest(`/api/exams?studentId=${personId}&klasseId=-1&startDate=${untisDate(now0())}&endDate=${untisDate(addDays(now0(), 90))}&withGrades=false`);
    out.exams = mapExams(ex);
  } catch (e) { errors.push({ source: 'webuntis-pruefungen', message: String(e.message || e) }); }

  try { await rpc('logout', {}); } catch { /* egal */ }
  return { ...out, errors };
}

/* Findet den Login-Namen der Schule über die öffentliche WebUntis-Schulsuche,
 * falls UNTIS_SCHOOL nicht gesetzt ist (z. B. bei Adressen wie schulname.webuntis.com). */
export async function findSchoolLoginName(server, fetchFn = fetch) {
  const sub = server.split('.')[0];
  const res = await fetchFn('https://mobile.webuntis.com/ms/schoolquery2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'lb', method: 'searchSchool', params: [{ search: sub }], jsonrpc: '2.0' })
  });
  const data = await res.json().catch(() => ({}));
  const schools = (data.result && data.result.schools) || [];
  const hit = schools.find(s => String(s.server || '').toLowerCase() === server.toLowerCase())
    || schools.find(s => String(s.loginName || '').toLowerCase() === sub.toLowerCase())
    || (schools.length === 1 ? schools[0] : null);
  if (!hit || !hit.loginName) throw new Error('Schule nicht gefunden. Bitte UNTIS_SCHOOL eintragen.');
  return hit.loginName;
}

export function mapTimetable(items) {
  return items
    .filter(l => l.lstype !== 'bs') // Bereitschaft ausblenden
    .map(l => {
      const su = (l.su && l.su[0]) || {};
      const status = l.code === 'cancelled' ? 'cancelled' : l.code === 'irregular' ? 'changed' : 'normal';
      return {
        date: fromUntisDate(l.date),
        start: fromUntisTime(l.startTime),
        end: fromUntisTime(l.endTime),
        subject: su.longname || su.name || l.lstext || 'Unterricht',
        short: su.name || '',
        room: (l.ro && l.ro[0] && l.ro[0].name) || '',
        status,
        info: [l.substText, l.info].filter(Boolean).join(' · ')
      };
    })
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

export function mapHomework(data) {
  const d = (data && data.data) || {};
  const lessons = new Map((d.lessons || []).map(l => [l.id, l]));
  return (d.homeworks || []).map(h => {
    const lesson = lessons.get(h.lessonId) || {};
    return {
      id: 'untis:' + h.id,
      subject: lesson.subject || '',
      text: [h.text, h.remark].filter(Boolean).join(' – ').trim(),
      due: fromUntisDate(h.dueDate),
      assigned: fromUntisDate(h.date)
    };
  }).filter(h => h.text && h.due);
}

export function mapExams(data) {
  const list = (data && data.data && data.data.exams) || [];
  return list.map(e => ({
    id: 'untis-exam:' + e.id,
    subject: e.subject || '',
    type: /klassenarbeit|klausur|schulaufgabe/i.test(e.examType || e.name || '') ? 'Klassenarbeit' : 'Test',
    title: e.name || e.examType || 'Prüfung',
    date: fromUntisDate(e.examDate),
    text: e.text || ''
  })).filter(e => e.date);
}

/* ---------- iCal ---------- */

export function parseICS(text) {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const name = line.slice(0, i).split(';')[0].toUpperCase();
    const value = line.slice(i + 1).replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
    if (name === 'UID') cur.uid = value;
    else if (name === 'SUMMARY') cur.summary = value;
    else if (name === 'DESCRIPTION') cur.description = value.slice(0, 500);
    else if (name === 'LOCATION') cur.location = value;
    else if (name === 'CATEGORIES') cur.categories = value;
    else if (name === 'DTSTART') cur.start = icsDate(value);
    else if (name === 'DTEND') cur.end = icsDate(value);
  }
  return events.map(e => ({ ...e, uid: e.uid || `${e.start}-${e.summary}` }));
}

function icsDate(v) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(v);
  if (!m) return null;
  if (m[7]) { // UTC -> Europe/Berlin Kalendertag
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d);
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/* ---------- Helfer ---------- */

function now0() { return new Date(); }
function addDays(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function ymd(d) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d); }
function untisDate(d) { return Number(ymd(d).replace(/-/g, '')); }
function fromUntisDate(n) { const s = String(n || ''); return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null; }
function fromUntisTime(n) { const s = String(n || 0).padStart(4, '0'); return `${s.slice(0, 2)}:${s.slice(2)}`; }

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '',
    'Access-Control-Allow-Headers': 'X-App-Key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin'
  };
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
