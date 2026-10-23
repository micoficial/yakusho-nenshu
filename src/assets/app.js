// 自治体名の検索（索引は端末に読み込んで照合する。入力した文字は外に送らない）、表の並べ替え、リンクのコピー
(() => {
  const script = document.currentScript;
  const base = script ? script.src.replace(/assets\/app\.js.*$/, '') : '/';
  const ver = script ? (script.src.split('?v=')[1] || '') : '';
  let index = null;
  let loading = null;

  const KUBUN = { 1: '', 2: '政令市', 3: '市', 4: '特別区', 5: '町', 6: '村' };
  // 「函館市役所」「北海道庁」「〇〇町役場」でも当たるように役所の呼び名を外す
  const norm = (s) => s.normalize('NFKC').toLowerCase()
    .replace(/(役所|役場|庁舎|庁)$/, '')
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[\s・･.,，、。\-‐－—―ー〜~'’"“”()（）]/g, '');
  const noKind = (s) => s.replace(/(都|道|府|県|市|区|町|村)$/, '');

  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      loading = fetch(`${base}assets/index.json${ver ? `?v=${ver}` : ''}`)
        .then((r) => r.json())
        .then((j) => {
          index = j;
          index.n = j.d.map((row) => norm(row[1]));
          index.p = j.prefs.map((p) => norm(p));
          return index;
        });
    }
    return loading;
  }

  function search(q, limit) {
    const k = norm(q);
    if (!k) return [];
    const k2 = noKind(k);
    const out = [];
    const { d, n, p } = index;
    for (let i = 0; i < d.length; i++) {
      let s = -1;
      const pos = n[i].indexOf(k);
      if (pos === 0) s = 0;
      else if (pos > 0) s = 2;
      else if (k2.length >= 1 && n[i].startsWith(k2)) s = 1;
      else if (p[d[i][2] - 1].startsWith(k) || (k2 && p[d[i][2] - 1].startsWith(k2))) s = 3; // 都道府県名で探したとき
      if (s < 0) continue;
      // 先頭一致・都道府県→政令市→市の順・名前の短さで並べる
      out.push([s, d[i][3], n[i].length, i]);
    }
    out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
    return out.slice(0, limit).map((x) => d[x[3]]);
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const man = (k) => `${(k / 10).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}万円`;
  const meta = (row) => [row[3] === 1 ? '都道府県' : index.prefs[row[2] - 1], KUBUN[row[3]]].filter(Boolean).join('・');
  const url = (row) => `${base}d/${row[0]}/`;

  function bind(form) {
    const input = form.querySelector('.sb-i');
    const box = form.querySelector('.sb-r');
    if (!input || !box) return;
    let rows = [];
    let sel = -1;
    const close = () => { box.hidden = true; sel = -1; };
    const render = () => {
      if (!input.value.trim()) { close(); return; }
      rows = search(input.value, 8);
      box.innerHTML = rows.length
        ? rows.map((r, i) => `<a href="${url(r)}"${i === sel ? ' class="on"' : ''}>${esc(r[1])}<small>${esc(meta(r))}　推計年収 ${man(r[4])}</small></a>`).join('')
        : '<div class="sb-none">見つかりませんでした。「市」「町」などを外して、名前の一部で探してください。</div>';
      box.hidden = false;
    };
    input.addEventListener('focus', () => { load().then(() => input.value && render()); });
    input.addEventListener('input', () => { sel = -1; load().then(render); });
    input.addEventListener('keydown', (e) => {
      if (box.hidden || !rows.length) return;
      if (e.key === 'ArrowDown') { sel = Math.min(rows.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(-1, sel - 1); render(); e.preventDefault(); }
      else if (e.key === 'Escape') close();
    });
    form.addEventListener('submit', (e) => {
      if (sel >= 0 && rows[sel]) { e.preventDefault(); location.href = url(rows[sel]); }
    });
    document.addEventListener('click', (e) => { if (!form.contains(e.target)) close(); });
  }
  document.querySelectorAll('form.sb').forEach(bind);

  // 検索ページ
  const results = document.getElementById('results');
  if (results) {
    const q = new URLSearchParams(location.search).get('q') || '';
    const input = document.querySelector('.sb-page .sb-i');
    if (input) input.value = q;
    if (q) {
      results.textContent = '読み込み中…';
      load().then(() => {
        const rows = search(q, 200);
        results.innerHTML = `<p>「${esc(q)}」の結果：${rows.length >= 200 ? '200件以上（上位200件）' : `${rows.length}件`}</p>`
          + (rows.length ? `<ul>${rows.map((r) => `<li><a href="${url(r)}"><span>${esc(r[1])}<small>　${esc(meta(r))}</small></span><small>推計年収 ${man(r[4])}</small></a></li>`).join('')}</ul>` : '');
      }).catch(() => { results.textContent = '索引を読み込めませんでした。時間をおいてお試しください。'; });
    }
  }

  // 表の並べ替え（見出しを押す）
  const numOf = (td) => {
    const t = td.textContent.replace(/,/g, '');
    const m = t.match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };
  document.querySelectorAll('table.sortable').forEach((table) => {
    const ths = table.querySelectorAll('thead th');
    ths.forEach((th, ci) => {
      th.tabIndex = 0;
      const sort = () => {
        const body = table.tBodies[0];
        const rows = [...body.rows];
        const asc = th.getAttribute('aria-sort') === 'descending';
        ths.forEach((x) => x.removeAttribute('aria-sort'));
        th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
        const text = ci === 1 || (ci === 0 && !/順位/.test(ths[0].textContent));
        rows.sort((a, b) => {
          if (text) return asc ? a.cells[ci].textContent.localeCompare(b.cells[ci].textContent, 'ja') : b.cells[ci].textContent.localeCompare(a.cells[ci].textContent, 'ja');
          const x = numOf(a.cells[ci]);
          const y = numOf(b.cells[ci]);
          if (x == null && y == null) return 0;
          if (x == null) return 1;
          if (y == null) return -1;
          return asc ? x - y : y - x;
        });
        rows.forEach((r) => body.appendChild(r));
      };
      th.addEventListener('click', sort);
      th.addEventListener('keydown', (e) => { if (e.key === 'Enter') sort(); });
    });
  });

  // リンクのコピー
  document.querySelectorAll('.share').forEach((el) => {
    const btn = el.querySelector('.sh-copy');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const u = el.dataset.url || location.href;
      const done = () => { btn.textContent = 'コピーしました'; setTimeout(() => { btn.textContent = 'リンクをコピー'; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(u).then(done, () => prompt('このリンクをコピーしてください', u));
      else prompt('このリンクをコピーしてください', u);
    });
  });
})();
