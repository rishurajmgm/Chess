(() => {
  // ---------- Chess engine ----------
  const GLYPH = { p: '♟\uFE0E', n: '♞\uFE0E', b: '♝\uFE0E', r: '♜\uFE0E', q: '♛\uFE0E', k: '♚\uFE0E' };
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const isW = p => p === p.toUpperCase();
  const name = i => 'abcdefgh'[i & 7] + (8 - (i >> 3));
  const N_OFF = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const K_OFF = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const ORTH = [[-1,0],[1,0],[0,-1],[0,1]], DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const inb = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;

  function initial() {
    const b = [];
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'.split('/').forEach(row =>
      [...row].forEach(c => isNaN(c) ? b.push(c) : b.push(...Array(+c).fill(''))));
    return { b, t: 'w', c: 'KQkq', ep: -1 };
  }

  function attacked(b, sq, byW) {
    const r = sq >> 3, f = sq & 7, mine = p => p && isW(p) === byW;
    const pr = byW ? r + 1 : r - 1;
    for (const df of [-1, 1]) if (inb(pr, f + df) && b[pr * 8 + f + df] === (byW ? 'P' : 'p')) return true;
    for (const [dr, df] of N_OFF) if (inb(r + dr, f + df) && b[(r + dr) * 8 + f + df] === (byW ? 'N' : 'n')) return true;
    for (const [dr, df] of K_OFF) if (inb(r + dr, f + df) && b[(r + dr) * 8 + f + df] === (byW ? 'K' : 'k')) return true;
    for (const [dirs, types] of [[ORTH, 'rq'], [DIAG, 'bq']])
      for (const [dr, df] of dirs) {
        let y = r + dr, x = f + df;
        while (inb(y, x)) {
          const p = b[y * 8 + x];
          if (p) { if (mine(p) && types.includes(p.toLowerCase())) return true; break; }
          y += dr; x += df;
        }
      }
    return false;
  }

  function pseudo(s) {
    const { b } = s, w = s.t === 'w', out = [];
    const add = (f, t, extra = {}) => {
      const p = b[f].toLowerCase();
      if (p === 'p' && (t >> 3) === (w ? 0 : 7)) for (const pr of 'qrbn') out.push({ f, t, promo: pr });
      else out.push({ f, t, ...extra });
    };
    for (let sq = 0; sq < 64; sq++) {
      const pc = b[sq]; if (!pc || isW(pc) !== w) continue;
      const type = pc.toLowerCase(), r = sq >> 3, f = sq & 7;
      if (type === 'p') {
        const d = w ? -1 : 1, nr = r + d;
        if (inb(nr, f) && !b[nr * 8 + f]) {
          add(sq, nr * 8 + f);
          if (r === (w ? 6 : 1) && !b[(r + 2 * d) * 8 + f]) add(sq, (r + 2 * d) * 8 + f);
        }
        for (const df of [-1, 1]) {
          if (!inb(nr, f + df)) continue;
          const t = nr * 8 + f + df;
          if (b[t] && isW(b[t]) !== w) add(sq, t);
          else if (t === s.ep) add(sq, t, { ep: true });
        }
      } else if (type === 'n' || type === 'k') {
        for (const [dr, df] of type === 'n' ? N_OFF : K_OFF) {
          if (!inb(r + dr, f + df)) continue;
          const t = (r + dr) * 8 + f + df;
          if (!b[t] || isW(b[t]) !== w) add(sq, t);
        }
        if (type === 'k') {
          const home = w ? 60 : 4, rights = w ? ['K', 'Q'] : ['k', 'q'];
          if (sq === home && !attacked(b, sq, !w)) {
            if (s.c.includes(rights[0]) && !b[home + 1] && !b[home + 2] && !attacked(b, home + 1, !w) && !attacked(b, home + 2, !w))
              add(sq, home + 2, { castle: true });
            if (s.c.includes(rights[1]) && !b[home - 1] && !b[home - 2] && !b[home - 3] && !attacked(b, home - 1, !w) && !attacked(b, home - 2, !w))
              add(sq, home - 2, { castle: true });
          }
        }
      } else {
        const dirs = type === 'r' ? ORTH : type === 'b' ? DIAG : [...ORTH, ...DIAG];
        for (const [dr, df] of dirs) {
          let y = r + dr, x = f + df;
          while (inb(y, x)) {
            const t = y * 8 + x;
            if (!b[t]) add(sq, t);
            else { if (isW(b[t]) !== w) add(sq, t); break; }
            y += dr; x += df;
          }
        }
      }
    }
    return out;
  }

  function apply(s, m) {
    const b = s.b.slice(), pc = b[m.f], w = isW(pc);
    b[m.t] = m.promo ? (w ? m.promo.toUpperCase() : m.promo) : pc;
    b[m.f] = '';
    if (m.ep) b[w ? m.t + 8 : m.t - 8] = '';
    if (m.castle) {
      if (m.t > m.f) { b[m.f + 1] = b[m.f + 3]; b[m.f + 3] = ''; }
      else { b[m.f - 1] = b[m.f - 4]; b[m.f - 4] = ''; }
    }
    let c = s.c;
    if (pc === 'K') c = c.replace(/[KQ]/g, ''); if (pc === 'k') c = c.replace(/[kq]/g, '');
    const corner = { 63: 'K', 56: 'Q', 7: 'k', 0: 'q' };
    for (const q of [m.f, m.t]) if (corner[q]) c = c.replace(corner[q], '');
    const ep = pc.toLowerCase() === 'p' && Math.abs(m.t - m.f) === 16 ? (m.f + m.t) / 2 : -1;
    return { b, t: w ? 'b' : 'w', c, ep };
  }

  const kingSq = (s, w) => s.b.indexOf(w ? 'K' : 'k');
  const inCheck = s => attacked(s.b, kingSq(s, s.t === 'w'), s.t !== 'w');
  const legal = s => pseudo(s).filter(m => { const n = apply(s, m); return !attacked(n.b, kingSq(n, s.t === 'w'), s.t !== 'w'); });

  // ---------- AI ----------
  function evaluate(s) {
    let v = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.b[i]; if (!p) continue;
      const t = p.toLowerCase(), w = isW(p), r = i >> 3, f = i & 7;
      let x = VAL[t];
      const center = 3 - Math.max(Math.abs(r - 3.5), Math.abs(f - 3.5)) + 0.5;
      if (t === 'n' || t === 'b') x += center * 8;
      if (t === 'p') x += (w ? 6 - r : r - 1) * 6 + center * 2;
      v += w ? x : -x;
    }
    return s.t === 'w' ? v : -v;
  }
  function order(s, ms) {
    const sc = m => (s.b[m.t] ? VAL[s.b[m.t].toLowerCase()] * 10 - VAL[s.b[m.f].toLowerCase()] : 0) + (m.promo ? 800 : 0);
    return ms.sort((a, b) => sc(b) - sc(a));
  }
  function search(s, d, a, b) {
    const ms = legal(s);
    if (!ms.length) return inCheck(s) ? -99999 - d : 0;
    if (!d) return evaluate(s);
    for (const m of order(s, ms)) {
      const v = -search(apply(s, m), d - 1, -b, -a);
      if (v >= b) return b;
      if (v > a) a = v;
    }
    return a;
  }
  function bestMove(s, depth) {
    const ms = order(s, legal(s).sort(() => Math.random() - .5));
    let best = null, bv = -Infinity;
    for (const m of ms) {
      let v = -search(apply(s, m), depth - 1, -Infinity, Infinity);
      if (depth === 1) v += Math.random() * 120;
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }

  // ---------- UI / game state ----------
  const $ = id => document.getElementById(id);
  let cur, hist, sel, targets, flipped, busy, gid = 0, over;
  const boardEl = $('board'), statusEl = $('status');
  const mode = () => $('mode').value, human = () => $('side').value;

  function newGame() {
    gid++; cur = initial(); hist = []; sel = -1; targets = []; busy = false; over = false;
    flipped = mode() === 'ai' && human() === 'b';
    $('side-l').style.display = $('lvl-l').style.display = mode() === 'ai' ? '' : 'none';
    $('promo').classList.add('hidden');
    render(); maybeAI();
  }

  function note(s, m, ns) {
    const pc = s.b[m.f], t = pc.toLowerCase();
    let n;
    if (m.castle) n = m.t > m.f ? 'O-O' : 'O-O-O';
    else {
      const cap = s.b[m.t] || m.ep;
      n = (t === 'p' ? '' : t.toUpperCase()) + name(m.f) + (cap ? 'x' : '-') + name(m.t) + (m.promo ? '=' + m.promo.toUpperCase() : '');
    }
    const has = legal(ns).length;
    return n + (inCheck(ns) ? (has ? '+' : '#') : '');
  }

  function play(m) {
    const ns = apply(cur, m);
    hist.push({ s: cur, m, n: note(cur, m, ns), cap: cur.b[m.t] || (m.ep ? (cur.t === 'w' ? 'p' : 'P') : '') });
    cur = ns; sel = -1; targets = [];
    render(); maybeAI();
  }

  function maybeAI() {
    if (mode() !== 'ai' || over || cur.t === human()) return;
    busy = true; const id = gid; render();
    setTimeout(() => {
      if (id !== gid) return;
      const m = bestMove(cur, +$('level').value);
      busy = false;
      if (m) play(m);
    }, 80);
  }

  function undo() {
    if (busy || !hist.length) return;
    const pop = () => { cur = hist.pop().s; };
    pop();
    if (mode() === 'ai') while (hist.length && cur.t !== human()) pop();
    sel = -1; targets = []; over = false; render(); maybeAI();
  }

  function click(sq) {
    if (busy || over || (mode() === 'ai' && cur.t !== human())) return;
    const p = cur.b[sq];
    if (sel >= 0) {
      const ms = targets.filter(m => m.t === sq);
      if (ms.length > 1) return askPromo(ms);
      if (ms.length === 1) return play(ms[0]);
    }
    if (p && isW(p) === (cur.t === 'w')) { sel = sq; targets = legal(cur).filter(m => m.f === sq); }
    else { sel = -1; targets = []; }
    render();
  }

  function askPromo(ms) {
    const box = $('promo'), w = cur.t === 'w';
    box.innerHTML = '';
    ms.forEach(m => {
      const b = document.createElement('button');
      b.innerHTML = `<span class="pc ${w ? 'w' : 'b'}">${GLYPH[m.promo]}</span>`;
      b.setAttribute('aria-label', 'Promote to ' + m.promo);
      b.onclick = () => { box.classList.add('hidden'); play(m); };
      box.appendChild(b);
    });
    box.classList.remove('hidden');
  }

  function render() {
    const last = hist.length ? hist[hist.length - 1].m : null;
    const chkSq = inCheck(cur) ? kingSq(cur, cur.t === 'w') : -1;
    let html = '';
    for (let i = 0; i < 64; i++) {
      const sq = flipped ? 63 - i : i, r = sq >> 3, f = sq & 7, p = cur.b[sq];
      const tg = targets.some(m => m.t === sq);
      const cls = ['sq', (r + f) % 2 ? 'd' : 'l'];
      if (last && (sq === last.f || sq === last.t)) cls.push('last');
      if (sq === sel) cls.push('sel');
      if (sq === chkSq) cls.push('chk');
      if (tg) cls.push('mv'); if (tg && (p || targets.find(m => m.t === sq && m.ep))) cls.push('cap');
      html += `<div class="${cls.join(' ')}" data-sq="${sq}" role="gridcell" aria-label="${name(sq)}${p ? ' ' + p : ''}">` +
        (p ? `<span class="pc ${isW(p) ? 'w' : 'b'}">${GLYPH[p.toLowerCase()]}</span>` : '') +
        (i % 8 === 0 ? `<span class="lab r">${8 - r}</span>` : '') +
        (i >> 3 === 7 ? `<span class="lab f">${'abcdefgh'[f]}</span>` : '') + `</div>`;
    }
    boardEl.innerHTML = html;

    // status
    const moves = legal(cur), chk = inCheck(cur), who = cur.t === 'w' ? 'White' : 'Black';
    over = !moves.length;
    statusEl.classList.toggle('over', over);
    statusEl.textContent = over
      ? (chk ? `Checkmate — ${who === 'White' ? 'Black' : 'White'} wins` : 'Stalemate — draw')
      : busy ? 'Computer is thinking…' : `${who} to move${chk ? ' — check!' : ''}`;

    // move list
    let ml = '';
    for (let i = 0; i < hist.length; i += 2)
      ml += `<li><span class="n">${i / 2 + 1}.</span><span class="${i === hist.length - 1 ? 'cur' : ''}">${hist[i].n}</span>` +
        `<span class="${i + 1 === hist.length - 1 ? 'cur' : ''}">${hist[i + 1] ? hist[i + 1].n : ''}</span></li>`;
    $('moves').innerHTML = ml; $('moves').scrollTop = 1e6;

    // players & captured pieces
    const capBy = w => hist.filter(h => h.cap && isW(h.cap) !== w)
      .sort((a, b) => VAL[b.cap.toLowerCase()] - VAL[a.cap.toLowerCase()]).map(h => GLYPH[h.cap.toLowerCase()]).join('');
    const label = w => mode() === 'pvp' ? (w ? 'White' : 'Black') : (human() === (w ? 'w' : 'b') ? 'You' : 'Computer') + (w ? ' (White)' : ' (Black)');
    const set = (el, w) => { el.querySelector('.name').textContent = label(w); el.querySelector('.caps').textContent = capBy(w); };
    set($('top-player'), flipped); set($('bottom-player'), !flipped);
    $('undo').disabled = busy || !hist.length;
  }

  boardEl.addEventListener('click', e => { const s = e.target.closest('.sq'); if (s) click(+s.dataset.sq); });
  $('new').onclick = newGame; $('undo').onclick = undo;
  $('flip').onclick = () => { flipped = !flipped; render(); };
  ['mode', 'side', 'level'].forEach(id => $(id).onchange = newGame);
  newGame();
})();
