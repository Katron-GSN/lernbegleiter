/* Lernbegleiter – Rätsel
 * Spielecke: Rätsel werden mit den Levels freigeschaltet und sind jederzeit spielbar (ohne XP).
 * Tagesrätsel: öffnet sich nach dem Tagesziel und gibt einen Sticker fürs Album.
 * Nutzt S, levelInfo, todayISO, save, render, go, toast, esc aus app.js (werden erst beim Aufruf gebraucht).
 */
'use strict';

const GAMES = [
  { id: 'sudoku4', name: 'Sudoku 4×4', short: 'S4', lvl: 1, color: '#4fe3c1', desc: 'Jede Zahl von 1 bis 4 genau einmal in jeder Zeile, Spalte und jedem Block.' },
  { id: 'kopf', name: 'Kopfrechen-Sprint', short: 'KR', lvl: 2, color: '#ffb547', desc: 'Zehn Aufgaben im Kopf, so schnell du kannst.' },
  { id: 'memory', name: 'Vokabel-Memory', short: 'VM', lvl: 3, color: '#38bdf8', desc: 'Finde die Paare aus Englisch und Deutsch.' },
  { id: 'sudoku6', name: 'Sudoku 6×6', short: 'S6', lvl: 5, color: '#a78bfa', desc: 'Zahlen von 1 bis 6, Blöcke mit 2×3 Feldern.' },
  { id: 'folgen', name: 'Zahlenfolgen', short: 'ZF', lvl: 6, color: '#f472b6', desc: 'Erkenne die Regel und finde die nächste Zahl.' },
  { id: 'schalter', name: 'Schalter-Rätsel', short: 'SR', lvl: 8, color: '#a3e635', desc: 'Ein Tipp schaltet ein Feld und seine Nachbarn um. Mach alle Lichter aus.' },
  { id: 'sudoku9', name: 'Sudoku 9×9', short: 'S9', lvl: 10, color: '#ff6b6b', desc: 'Der Klassiker mit Zahlen von 1 bis 9.' }
];
const gameById = id => GAMES.find(g => g.id === id);
const unlockedGames = (lvl = levelInfo().lvl) => GAMES.filter(g => g.lvl <= lvl);

const VOCAB = [
  ['journey', 'Reise'], ['to borrow', 'leihen'], ['to complain', 'sich beschweren'], ['neighbour', 'Nachbar'],
  ['weather', 'Wetter'], ['to explain', 'erklären'], ['environment', 'Umwelt'], ['to improve', 'verbessern'],
  ['advice', 'Rat'], ['to arrive', 'ankommen'], ['experience', 'Erfahrung'], ['dangerous', 'gefährlich'],
  ['to decide', 'entscheiden'], ['enough', 'genug'], ['to remember', 'sich erinnern'], ['village', 'Dorf'],
  ['to believe', 'glauben'], ['especially', 'besonders'], ['to describe', 'beschreiben'], ['probably', 'wahrscheinlich'],
  ['to discover', 'entdecken'], ['knowledge', 'Wissen'], ['healthy', 'gesund'], ['to forget', 'vergessen'],
  ['island', 'Insel'], ['to win', 'gewinnen'], ['to lose', 'verlieren'], ['mountain', 'Berg'],
  ['to agree', 'zustimmen'], ['to invite', 'einladen'], ['century', 'Jahrhundert'], ['bridge', 'Brücke'],
  ['to build', 'bauen'], ['to carry', 'tragen'], ['to catch', 'fangen'], ['to choose', 'auswählen'],
  ['to count', 'zählen'], ['to cross', 'überqueren'], ['to destroy', 'zerstören'], ['difference', 'Unterschied'],
  ['to disappear', 'verschwinden'], ['to earn', 'verdienen'], ['empty', 'leer'], ['enemy', 'Feind'],
  ['to escape', 'entkommen'], ['famous', 'berühmt'], ['to fight', 'kämpfen'], ['to follow', 'folgen'],
  ['foreign', 'ausländisch'], ['to grow', 'wachsen'], ['to hide', 'verstecken'], ['to hurt', 'verletzen'],
  ['immediately', 'sofort'], ['to invent', 'erfinden'], ['lazy', 'faul'], ['loud', 'laut'],
  ['to notice', 'bemerken'], ['often', 'oft'], ['to own', 'besitzen'], ['to pay', 'bezahlen'],
  ['to prepare', 'vorbereiten'], ['to protect', 'schützen'], ['quiet', 'leise'], ['to reach', 'erreichen'],
  ['to repair', 'reparieren'], ['to rescue', 'retten'], ['to shout', 'rufen'], ['to solve', 'lösen'],
  ['to steal', 'stehlen'], ['strange', 'seltsam'], ['to suggest', 'vorschlagen'], ['surprise', 'Überraschung'],
  ['to throw', 'werfen'], ['tired', 'müde'], ['to translate', 'übersetzen'], ['true', 'wahr'],
  ['to understand', 'verstehen'], ['useful', 'nützlich'], ['to wait', 'warten'], ['to wake up', 'aufwachen'],
  ['to worry', 'sich Sorgen machen'], ['wrong', 'falsch'], ['although', 'obwohl'], ['to happen', 'passieren'],
  ['to teach', 'unterrichten'], ['proud', 'stolz'], ['afraid', 'ängstlich'], ['brave', 'mutig'],
  ['to share', 'teilen'], ['luggage', 'Gepäck'], ['to remind', 'erinnern an'], ['the future', 'die Zukunft'],
  ['to exchange', 'austauschen'], ['opinion', 'Meinung'], ['to measure', 'messen'], ['height', 'Höhe'],
  ['to whisper', 'flüstern'], ['to pretend', 'so tun als ob'], ['coast', 'Küste'], ['to compare', 'vergleichen']
];

/* ---------- Zufall (mit Startwert, damit das Tagesrätsel den ganzen Tag gleich bleibt) ---------- */

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function seedFrom(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const range = n => Array.from({ length: n }, (_, i) => i);
function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const fmtN = (n, paren) => n < 0 ? (paren ? `(−${-n})` : `−${-n}`) : String(n);

/* ---------- Rätsel bauen ---------- */

function buildSudoku(n, br, bc, holes, rng) {
  // Gültiges Grundmuster, dann Bänder, Zeilen, Stapel, Spalten und Ziffern mischen.
  const pattern = (r, c) => (bc * (r % br) + Math.floor(r / br) + c) % n;
  const rows = shuffled(range(n / br), rng).flatMap(b => shuffled(range(br), rng).map(r => b * br + r));
  const cols = shuffled(range(n / bc), rng).flatMap(s => shuffled(range(bc), rng).map(c => s * bc + c));
  const nums = shuffled(range(n), rng);
  const cells = rows.flatMap(r => cols.map(c => nums[pattern(r, c)] + 1));
  const given = cells.map(() => true);
  shuffled(range(n * n), rng).slice(0, holes).forEach(i => { given[i] = false; });
  return { kind: 'sudoku', n, br, bc, given, val: cells.map((v, i) => given[i] ? v : 0), sel: -1 };
}

function mathTask(rng, lvl) {
  const tier = lvl >= 10 ? 3 : lvl >= 5 ? 2 : 1;
  const type = rint(rng, 0, tier === 1 ? 3 : tier === 2 ? 5 : 6);
  let q, a;
  switch (type) {
    case 0: { const x = rint(rng, 12, 99), y = rint(rng, 11, 99); q = `${x} + ${y}`; a = x + y; break; }
    case 1: { const x = rint(rng, 40, 160), y = rint(rng, 11, x - 5); q = `${x} − ${y}`; a = x - y; break; }
    case 2: { const x = rint(rng, 3, tier === 3 ? 19 : 12), y = rint(rng, 3, 12); q = `${x} · ${y}`; a = x * y; break; }
    case 3: { const y = rint(rng, 2, 12), r = rint(rng, 2, 12); q = `${y * r} : ${y}`; a = r; break; }
    case 4: {
      const x = rint(rng, -20, 20) || 7, y = rint(rng, -20, 20) || -5;
      if (rng() < 0.5) { q = `${fmtN(x)} + ${fmtN(y, true)}`; a = x + y; }
      else { const m = rint(rng, -9, 9) || -3; q = `${fmtN(x)} · ${fmtN(m, true)}`; a = x * m; }
      break;
    }
    case 5: {
      const ps = tier === 3 ? [5, 10, 15, 20, 25, 30, 50, 75] : [10, 25, 50];
      const p = ps[rint(rng, 0, ps.length - 1)];
      const base = 20 * rint(rng, 1, 20);
      q = `${p} % von ${base}`; a = base * p / 100;
      break;
    }
    default: { const x = rint(rng, 11, 20); q = `${x}²`; a = x * x; }
  }
  return { q, a };
}

function seqTask(rng, lvl) {
  const type = rint(rng, 0, lvl >= 9 ? 6 : 4);
  const s = [];
  switch (type) {
    case 0: { const a = rint(rng, 1, 30), d = rint(rng, 2, 9) * (lvl >= 9 && rng() < 0.4 ? -1 : 1); for (let i = 0; i < 6; i++) s.push(a + d * i); break; }
    case 1: { const a = rint(rng, 1, 4), r = rint(rng, 2, 3); for (let i = 0; i < 6; i++) s.push(a * r ** i); break; }
    case 2: { const x = rint(rng, 5, 12), y = rint(rng, 1, x - 1); s.push(rint(rng, 1, 20)); for (let i = 1; i < 6; i++) s.push(s[i - 1] + (i % 2 ? x : -y)); break; }
    case 3: { const d0 = rint(rng, 1, 4); s.push(rint(rng, 1, 15)); for (let i = 1; i < 6; i++) s.push(s[i - 1] + d0 + i - 1); break; }
    case 4: { const k = rint(rng, 1, 6); for (let i = 0; i < 6; i++) s.push((k + i) ** 2); break; }
    case 5: { s.push(rint(rng, 1, 6), rint(rng, 1, 6)); for (let i = 2; i < 6; i++) s.push(s[i - 1] + s[i - 2]); break; }
    default: { const c = rint(rng, 1, 3); s.push(rint(rng, c + 1, 7)); for (let i = 1; i < 6; i++) s.push(s[i - 1] * 2 - c); }
  }
  return { q: s.slice(0, 5).map(n => fmtN(n)).join(',  ') + ',  …', a: s[5] };
}

function toggleLights(on, n, i) {
  const r = Math.floor(i / n), c = i % n;
  [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) on[rr * n + cc] = !on[rr * n + cc];
  });
}

const BUILD = {
  sudoku4: (rng, lvl) => buildSudoku(4, 2, 2, lvl >= 4 ? 10 : 8, rng),
  sudoku6: (rng, lvl) => buildSudoku(6, 2, 3, 18 + Math.min(4, lvl - 5), rng),
  sudoku9: (rng, lvl) => buildSudoku(9, 3, 3, 42 + Math.min(10, lvl - 10), rng),
  kopf: (rng, lvl) => ({ kind: 'input', prompt: 'Rechne im Kopf', tasks: range(10).map(() => mathTask(rng, lvl)), i: 0, input: '', tries: 0 }),
  folgen: (rng, lvl) => ({ kind: 'input', prompt: 'Welche Zahl kommt als Nächstes?', tasks: range(5).map(() => seqTask(rng, lvl)), i: 0, input: '', tries: 0 }),
  memory: (rng, lvl) => {
    const pairs = shuffled(VOCAB, rng).slice(0, lvl >= 7 ? 8 : 6);
    const cards = shuffled(pairs.flatMap((p, k) => [{ t: p[0], k, en: true }, { t: p[1], k }]), rng);
    return { kind: 'memory', cards, open: [], found: [], moves: 0, lock: false };
  },
  schalter: (rng, lvl) => {
    const n = lvl >= 12 ? 5 : 4;
    let on;
    do {
      on = range(n * n).map(() => false);
      shuffled(range(n * n), rng).slice(0, rint(rng, n === 4 ? 4 : 5, n === 4 ? 6 : 8)).forEach(i => toggleLights(on, n, i));
    } while (on.every(x => !x));
    return { kind: 'lights', n, on, moves: 0 };
  }
};

/* ---------- Spielstand ---------- */

let G = null;

function dailyGame() {
  const d = todayISO();
  if (!S.daily || S.daily.date !== d) {
    const list = unlockedGames();
    S.daily = { date: d, game: list[seedFrom(d) % list.length].id };
    save();
  }
  return gameById(S.daily.game) || GAMES[0];
}
function dailyOpen() { const r = S.days[todayISO()]; return !!(r && r.goal); }
function dailySolved() { return !!S.stickers[todayISO()]; }

function startGame(id, daily) {
  const g = gameById(id);
  if (!g || g.lvl > levelInfo().lvl) return;
  if (daily && (!dailyOpen() || dailySolved())) daily = false;
  const seed = daily ? seedFrom(todayISO() + ':' + id) : (Math.random() * 4294967296) >>> 0;
  G = { id, daily, start: Date.now(), solved: false, mistakes: 0, ...BUILD[id](mulberry32(seed), levelInfo().lvl) };
  go('game');
}

function gameSolved() {
  G.solved = true;
  G.time = Date.now() - G.start;
  S.games ||= {};
  S.games.solved = (S.games.solved || 0) + 1;
  if (G.id === 'sudoku9') S.games.sudoku9 = true;
  if (G.daily && !dailySolved()) {
    S.stickers[todayISO()] = G.id;
    G.sticker = true;
  }
  checkBadges();
  save();
}

function fmtTime(ms) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)}`; }

/* ---------- Anzeige ---------- */

function stickerSVG(gameId, size = 34) {
  const g = gameById(gameId) || GAMES[0];
  return `<svg class="sticker" viewBox="0 0 40 40" width="${size}" height="${size}" role="img" aria-label="${esc(g.name)}">
    <path d="M20 2 L36 11 L36 29 L20 38 L4 29 L4 11 Z" fill="${g.color}"/>
    <path d="M20 6.5 L32 13.3 L32 26.7 L20 33.5 L8 26.7 L8 13.3 Z" fill="none" stroke="#080a17" stroke-opacity=".3" stroke-width="1.4"/>
    <text x="20" y="24.2" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="10.5" font-weight="700" fill="#080a17">${g.short}</text>
  </svg>`;
}

function sudokuConflicts() {
  const { n, br, bc, val } = G;
  const bad = new Set();
  const groups = [];
  for (let r = 0; r < n; r++) groups.push(range(n).map(c => r * n + c));
  for (let c = 0; c < n; c++) groups.push(range(n).map(r => r * n + c));
  for (let b = 0; b < n; b++) {
    const r0 = Math.floor(b / (n / bc)) * br, c0 = (b % (n / bc)) * bc;
    const cells = [];
    for (let r = 0; r < br; r++) for (let c = 0; c < bc; c++) cells.push((r0 + r) * n + c0 + c);
    groups.push(cells);
  }
  groups.forEach(g => {
    const seen = {};
    g.forEach(i => { const v = val[i]; if (v) (seen[v] ||= []).push(i); });
    Object.values(seen).forEach(list => { if (list.length > 1) list.forEach(i => bad.add(i)); });
  });
  return bad;
}

function gSudoku() {
  const { n, br, bc, given, val, sel } = G;
  const bad = sudokuConflicts();
  const selVal = sel >= 0 ? val[sel] : 0;
  return `<div class="sudoku" style="--n:${n}">${val.map((v, i) => {
    const r = Math.floor(i / n), c = i % n;
    const cls = ['cell', given[i] ? 'given' : 'free', i === sel ? 'sel' : '', bad.has(i) ? 'bad' : '',
      v && v === selVal && i !== sel ? 'same' : '',
      c % bc === bc - 1 && c < n - 1 ? 'br' : '', r % br === br - 1 && r < n - 1 ? 'bb' : ''].join(' ');
    return `<button class="${cls}" data-action="sd-cell" data-i="${i}" ${G.solved ? 'disabled' : ''} aria-label="Zeile ${r + 1}, Spalte ${c + 1}${v ? ': ' + v : ''}">${v || ''}</button>`;
  }).join('')}</div>
  ${G.solved ? '' : `<div class="numpad">${range(n).map(k => `<button class="btn" data-action="sd-num" data-v="${k + 1}">${k + 1}</button>`).join('')}<button class="btn ghost" data-action="sd-num" data-v="0" aria-label="Feld leeren">⌫</button></div>
  <p class="muted small">Feld antippen, dann Zahl wählen. Rot heißt: Die Zahl steht doppelt.</p>`}`;
}

function gInput() {
  if (G.solved) return '';
  const t = G.tasks[G.i];
  return `<section class="card task-card ${G.wrong ? 'wrong' : ''}">
    <div class="card-head"><span class="label">${esc(G.prompt)}</span><span class="label">${G.i + 1} / ${G.tasks.length}</span></div>
    <div class="steps">${G.tasks.map((_, k) => `<i class="${k < G.i ? 'done' : k === G.i ? 'now' : ''}"></i>`).join('')}</div>
    <div class="q">${esc(t.q)}</div>
    <div class="answer-box">${G.input ? esc(G.input) : '<span class="muted">?</span>'}</div>
    ${G.reveal ? `<p class="small hint">Die Lösung war ${esc(fmtN(G.reveal))}. Weiter geht’s.</p>` : G.wrong ? `<p class="small hint bad-text">Nicht ganz. Versuch es nochmal.</p>` : ''}
  </section>
  <div class="keypad">${['7', '8', '9', '4', '5', '6', '1', '2', '3', '−', '0', '⌫'].map(k => `<button class="btn" data-action="key" data-k="${k}">${k}</button>`).join('')}
    <button class="btn primary wide" data-action="key" data-k="ok">Prüfen</button></div>`;
}

function gMemory() {
  return `<div class="memory">${G.cards.map((c, i) => {
    const found = G.found.includes(c.k);
    const shown = found || G.open.includes(i);
    return `<button class="mcard ${shown ? 'shown' : ''} ${found ? 'found' : ''} ${c.en ? 'en' : 'de'}" data-action="mem" data-i="${i}" ${shown || G.solved ? 'disabled' : ''}>${shown ? `<span>${esc(c.t)}</span>` : ''}</button>`;
  }).join('')}</div>
  <p class="muted small">Züge: ${G.moves} · Englisch hell, Deutsch dunkel</p>`;
}

function gLights() {
  return `<div class="lights" style="--n:${G.n}">${G.on.map((v, i) => `<button class="light ${v ? 'on' : ''}" data-action="light" data-i="${i}" ${G.solved ? 'disabled' : ''} aria-label="Feld ${i + 1} ${v ? 'an' : 'aus'}"></button>`).join('')}</div>
  <p class="muted small">Züge: ${G.moves} · noch ${G.on.filter(Boolean).length} Lichter an</p>`;
}

function viewGame() {
  if (!G) return '';
  const g = gameById(G.id);
  const body = { sudoku: gSudoku, input: gInput, memory: gMemory, lights: gLights }[G.kind]();
  return `<div class="stack game">
    <div class="hello">
      <div><span class="label">${G.daily ? 'Tagesrätsel · gibt einen Sticker' : 'Spielecke · ohne XP'}</span><h1>${esc(g.name)}</h1></div>
      <button class="btn small ghost" data-action="game-quit">Zurück</button>
    </div>
    ${G.solved ? `<section class="card solved">
        <div class="solved-row">${stickerSVG(G.id, 56)}<div>
          <h2>Gelöst in ${fmtTime(G.time)}</h2>
          <p class="muted">${G.sticker ? 'Der Sticker klebt jetzt in deinem Album.' : G.mistakes ? `${G.mistakes} Fehlversuch${G.mistakes === 1 ? '' : 'e'}. Gut durchgezogen.` : 'Ohne Fehler. Stark.'}</p>
        </div></div>
        <div class="row">
          <button class="btn primary" data-action="game-again">${G.daily ? 'Frei weiterspielen' : 'Noch eins'}</button>
          <button class="btn ghost" data-action="game-quit">Zur Spielecke</button>
        </div>
      </section>` : `<p class="muted">${esc(g.desc)}</p>`}
    ${body}
  </div>`;
}

/* ---------- Eingaben ---------- */

function gameAction(action, el) {
  if (!G) return false;
  switch (action) {
    case 'sd-cell': {
      const i = Number(el.dataset.i);
      G.sel = G.given[i] ? -1 : i;
      break;
    }
    case 'sd-num': {
      if (G.sel < 0 || G.given[G.sel]) { toast('Erst ein leeres Feld antippen'); return true; }
      G.val[G.sel] = Number(el.dataset.v);
      if (G.val[G.sel] && sudokuConflicts().has(G.sel)) G.mistakes++;
      if (G.val.every(v => v) && sudokuConflicts().size === 0) gameSolved();
      break;
    }
    case 'key': {
      const k = el.dataset.k;
      if (k === '⌫') G.input = G.input.slice(0, -1);
      else if (k === '−') G.input = G.input.startsWith('−') ? G.input.slice(1) : '−' + G.input;
      else if (k === 'ok') {
        if (!G.input || G.input === '−') return true;
        const v = Number(G.input.replace('−', '-'));
        const t = G.tasks[G.i];
        G.reveal = null;
        if (v === t.a) { G.i++; G.input = ''; G.wrong = false; G.tries = 0; }
        else {
          G.mistakes++; G.tries++; G.wrong = true; G.input = '';
          if (G.tries >= 2) { G.reveal = t.a; G.i++; G.tries = 0; G.wrong = false; }
        }
        if (G.i >= G.tasks.length) { G.i = G.tasks.length - 1; gameSolved(); }
      } else if (G.input.replace('−', '').length < 6) G.input += k;
      break;
    }
    case 'mem': {
      if (G.lock) return true;
      const i = Number(el.dataset.i);
      if (G.open.includes(i)) return true;
      G.open.push(i);
      if (G.open.length === 2) {
        G.moves++;
        const [a, b] = G.open.map(x => G.cards[x]);
        if (a.k === b.k) {
          G.found.push(a.k); G.open = [];
          if (G.found.length * 2 === G.cards.length) gameSolved();
        } else {
          G.lock = true;
          setTimeout(() => { if (G) { G.open = []; G.lock = false; render(); } }, 950);
        }
      }
      break;
    }
    case 'light': {
      toggleLights(G.on, G.n, Number(el.dataset.i));
      G.moves++;
      if (G.on.every(x => !x)) gameSolved();
      break;
    }
    case 'game-again': startGame(G.id, false); return true;
    case 'game-quit': G = null; meTab = 'spiele'; go('me'); return true;
    default: return false;
  }
  render();
  return true;
}
