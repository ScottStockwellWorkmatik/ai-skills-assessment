/* Workmatik AI Skills Assessment
 * Browser-only. No network calls except loading data/framework.json.
 * All text from user input or imported files is rendered with textContent (never innerHTML).
 */
(function () {
  'use strict';

  var TOOL_NAME = 'Workmatik AI Skills Assessment';
  var RATER_LABELS = { self: 'Self-assessment', manager: 'Manager feedback', peer: 'Peer feedback' };
  var MAX_FILES = 200;
  var MAX_FILE_BYTES = 2 * 1024 * 1024;

  var fw = null;              // framework data
  var scores = [];            // current ratings, one per domain
  var submissions = [];       // imported files for rollup

  /* ---------- helpers ---------- */

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }
  function $(id) { return document.getElementById(id); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function levelName(i) { return fw.meta.levels[i]; }
  function avg(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0; }
  function round1(n) { return Math.round(n * 10) / 10; }
  function lvClass(n) { return 'lv' + Math.max(0, Math.min(4, Math.round(n))); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function skillItem(s) {
    var li = el('li', { text: s.t });
    if (s.eu) li.appendChild(el('span', { class: 'eu-tag', text: 'EU AI Act' }));
    return li;
  }

  /* ---------- tabs ---------- */

  var TAB_IDS = ['framework', 'assess', 'results', 'rollup', 'guide', 'toolkit'];
  function switchTab(id, focus) {
    TAB_IDS.forEach(function (t) {
      var sel = t === id;
      var tab = $('tab-' + t);
      tab.setAttribute('aria-selected', sel ? 'true' : 'false');
      tab.tabIndex = sel ? 0 : -1;
      $('panel-' + t).hidden = !sel;
      if (sel && focus) tab.focus();
    });
    if (id === 'results' && fw) renderResults();
  }
  function initTabs() {
    TAB_IDS.forEach(function (t, i) {
      $('tab-' + t).addEventListener('click', function () { switchTab(t); });
      $('tab-' + t).addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = (i + 1) % TAB_IDS.length;
        else if (e.key === 'ArrowLeft') n = (i + TAB_IDS.length - 1) % TAB_IDS.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = TAB_IDS.length - 1;
        if (n !== null) { e.preventDefault(); switchTab(TAB_IDS[n], true); }
      });
    });
  }

  /* ---------- framework tab ---------- */

  function buildFramework(filter) {
    var host = $('domainCards');
    clear(host);
    fw.domains.forEach(function (d) {
      if (filter !== 'all' && String(d.id) !== String(filter)) return;
      var count = d.levels.reduce(function (a, l) { return a + l.skills.length; }, 0);
      var grid = el('div', { class: 'level-grid' });
      d.levels.forEach(function (lv, li) {
        var ul = el('ul', { class: 'skills' });
        lv.skills.forEach(function (s) { ul.appendChild(skillItem(s)); });
        var dot = el('span', { class: 'dot ' + lvClass(li), 'aria-hidden': 'true' });
        grid.appendChild(el('div', { class: 'level-col' },
          el('div', { class: 'level-name' }, dot, levelName(li)),
          el('div', { class: 'level-sub', text: lv.label }),
          ul));
      });
      var summary = el('summary', null,
        el('span', null,
          el('span', { class: 'domain-title', text: d.name }),
          el('span', { class: 'domain-desc', text: d.desc })),
        el('span', { class: 'badge', text: count + ' indicators' }));
      var det = el('details', { class: 'domain' }, summary, grid);
      if (filter !== 'all') det.open = true;
      host.appendChild(det);
    });
  }

  function buildChips() {
    var host = $('domainChips');
    clear(host);
    var items = [{ id: 'all', label: 'All domains' }].concat(fw.domains.map(function (d) { return { id: d.id, label: d.short }; }));
    items.forEach(function (it, idx) {
      var b = el('button', { class: 'chip', type: 'button', 'aria-pressed': idx === 0 ? 'true' : 'false', text: it.label });
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(host.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        buildFramework(it.id);
      });
      host.appendChild(b);
    });
  }

  /* ---------- self-assessment tab ---------- */

  function nextStepNode(di) {
    var d = fw.domains[di];
    var s = scores[di];
    if (s >= 4) return el('div', { class: 'next-step' }, el('strong', { text: 'Top level reached. ' }), 'Focus on sustaining and sharing this expertise.');
    var next = d.levels[s + 1];
    var ul = el('ul', { class: 'skills' });
    next.skills.forEach(function (sk) { ul.appendChild(skillItem(sk)); });
    return el('div', { class: 'next-step' },
      el('strong', { text: 'Next step: ' + levelName(s + 1) + ' (' + next.label + ')' }), ul);
  }

  // Builds the row once. Later changes update only the pill, aria text and next-step
  // block, so the slider element is never replaced mid-drag.
  function buildRow(di) {
    var d = fw.domains[di];
    var row = el('div', { class: 'assess-row', id: 'row-' + di });
    var pill = el('span', { class: 'pill lv0', id: 'pill-' + di });
    var slider = el('input', {
      type: 'range', min: '0', max: '4', step: '1', value: '0',
      id: 'slider-' + di, 'aria-labelledby': 'name-' + di
    });
    slider.addEventListener('input', function () {
      scores[di] = parseInt(slider.value, 10);
      updateRow(di);
      renderSummary();
    });
    var scale = el('div', { class: 'scale', 'aria-hidden': 'true' });
    [0, 1, 2, 3, 4].forEach(function (i) { scale.appendChild(el('span', { text: String(i) })); });
    row.appendChild(el('div', { class: 'assess-top' },
      el('div', { class: 'assess-name', id: 'name-' + di }, d.name, el('small', { text: d.desc })),
      el('div', null, slider, scale),
      pill));
    row.appendChild(el('div', { id: 'next-' + di }));
    return row;
  }

  function updateRow(di) {
    var s = scores[di];
    var pill = $('pill-' + di);
    pill.className = 'pill ' + lvClass(s);
    pill.textContent = s + ' ' + levelName(s);
    var slider = $('slider-' + di);
    slider.value = String(s);
    slider.setAttribute('aria-valuetext', s + ', ' + levelName(s));
    var next = $('next-' + di);
    clear(next);
    next.appendChild(nextStepNode(di));
  }

  function buildAssess() {
    var host = $('assessRows');
    clear(host);
    scores = fw.domains.map(function () { return 0; });
    fw.domains.forEach(function (d, i) {
      host.appendChild(buildRow(i));
      updateRow(i);
    });
    renderSummary();
  }

  function renderSummary() {
    var host = $('summaryCards');
    clear(host);
    var a = avg(scores);
    var low = Math.min.apply(null, scores);
    var gaps = scores.filter(function (v) { return v <= 1; }).length;
    function metric(label, val) {
      return el('div', { class: 'metric' }, el('div', { class: 'label', text: label }), el('div', { class: 'val', text: val }));
    }
    host.appendChild(metric('Average proficiency', round1(a).toFixed(1) + ' (' + levelName(Math.round(a)) + ')'));
    host.appendChild(metric('Lowest domain', low + ' (' + levelName(low) + ')'));
    host.appendChild(metric('Priority gaps (Aware or below)', gaps + (gaps === 1 ? ' domain' : ' domains')));
  }


  /* ---------- results tab ---------- */

  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function radarChart() {
    var N = fw.domains.length, W = 360, C = 180, R = 112;
    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + W, role: 'img', 'aria-label': 'Radar chart of your six domain scores, each out of 4' });
    function pt(i, v) { var a = -Math.PI / 2 + i * 2 * Math.PI / N, r = R * v / 4; return [C + r * Math.cos(a), C + r * Math.sin(a)]; }
    [1, 2, 3, 4].forEach(function (ring) {
      var pts = fw.domains.map(function (d, i) { return pt(i, ring).join(','); }).join(' ');
      root.appendChild(svg('polygon', { points: pts, fill: 'none', stroke: '#D9D9D9', 'stroke-width': ring === 4 ? '1.5' : '1' }));
    });
    fw.domains.forEach(function (d, i) {
      var e = pt(i, 4), l = pt(i, 4.75);
      root.appendChild(svg('line', { x1: C, y1: C, x2: e[0], y2: e[1], stroke: '#D9D9D9' }));
      var anchor = l[0] < C - 8 ? 'end' : l[0] > C + 8 ? 'start' : 'middle';
      root.appendChild(svg('text', { x: l[0], y: l[1] + 4, 'text-anchor': anchor, 'font-size': '11', fill: '#0D0D0D' }, d.short));
    });
    var shape = fw.domains.map(function (d, i) { return pt(i, scores[i]).join(','); }).join(' ');
    root.appendChild(svg('polygon', { points: shape, fill: 'rgba(242,93,39,0.28)', stroke: '#F25D27', 'stroke-width': '2.5', 'stroke-linejoin': 'round' }));
    fw.domains.forEach(function (d, i) {
      var p = pt(i, scores[i]);
      root.appendChild(svg('circle', { cx: p[0], cy: p[1], r: '4', fill: '#F25D27' }));
    });
    return root;
  }

  function renderResults() {
    var host = $('resultsBody');
    clear(host);
    var rater = $('raterType').value, name = $('personName').value.trim(), team = $('teamName').value.trim();
    var who = [RATER_LABELS[rater], name, team].filter(Boolean).join(', ');
    host.appendChild(el('h2', { class: 'res-head', text: 'My results' }));
    host.appendChild(el('p', { class: 'res-sub', text: who + '. ' + todayISO() }));

    var allZero = scores.every(function (v) { return v === 0; });
    if (allZero) host.appendChild(el('p', { class: 'hint', text: 'All domains are still rated 0. Go to the Self-assessment tab and move the sliders to see your profile.' }));

    var cards = el('div', { class: 'summary-grid' });
    var a = avg(scores), low = Math.min.apply(null, scores), gaps = scores.filter(function (v) { return v <= 1; }).length;
    function metric(label, val) { return el('div', { class: 'metric' }, el('div', { class: 'label', text: label }), el('div', { class: 'val', text: val })); }
    cards.appendChild(metric('Average proficiency', round1(a).toFixed(1) + ' (' + levelName(Math.round(a)) + ')'));
    cards.appendChild(metric('Lowest domain', low + ' (' + levelName(low) + ')'));
    cards.appendChild(metric('Priority gaps (Aware or below)', gaps + (gaps === 1 ? ' domain' : ' domains')));
    host.appendChild(cards);

    var grid = el('div', { class: 'res-grid' });
    var bars = el('div', { class: 'res-bars' });
    fw.domains.forEach(function (d, i) {
      var pct = (scores[i] / 4) * 100;
      var bar = el('div', { class: 'bar', role: 'img', 'aria-label': d.short + ' ' + scores[i] + ' of 4, ' + levelName(scores[i]) }, el('span', { style: 'width:' + pct.toFixed(1) + '%' }));
      bars.appendChild(el('div', { class: 'avg-row' }, el('span', { text: d.name }), bar, el('strong', { text: scores[i] + ' ' + levelName(scores[i]) })));
    });
    grid.appendChild(bars);
    var radar = el('div', { class: 'res-radar' });
    radar.appendChild(radarChart());
    grid.appendChild(radar);
    host.appendChild(grid);

    host.appendChild(el('h3', { class: 'res-title', text: 'Your next steps' }));
    host.appendChild(el('p', { class: 'res-sub', text: 'Lowest domains first. Each list shows the indicators for the next level up.' }));
    var order = fw.domains.map(function (d, i) { return i; }).sort(function (x, y) { return scores[x] - scores[y] || x - y; });
    order.forEach(function (i) {
      var d = fw.domains[i], s = scores[i];
      var box = el('div', { class: 'res-next' });
      box.appendChild(el('h3', null, d.name, el('span', { class: 'pill ' + lvClass(s), text: s + ' ' + levelName(s) })));
      if (s >= 4) box.appendChild(el('p', { text: 'Top level reached. Focus on sustaining and sharing this expertise.' }));
      else {
        var nx = d.levels[s + 1], ul = el('ul', { class: 'skills' });
        nx.skills.forEach(function (sk) { ul.appendChild(skillItem(sk)); });
        box.appendChild(el('p', null, el('strong', { text: 'Next level: ' + levelName(s + 1) + ' (' + nx.label + ')' })));
        box.appendChild(ul);
      }
      host.appendChild(box);
    });

    var acts = el('div', { class: 'actions' });
    var dl = el('button', { class: 'btn primary', type: 'button', text: 'Download results (XLSX)' });
    dl.addEventListener('click', downloadAssessment);
    var back = el('button', { class: 'btn', type: 'button', text: 'Back to ratings' });
    back.addEventListener('click', function () { switchTab('assess', true); });
    acts.appendChild(dl); acts.appendChild(back);
    host.appendChild(acts);
    host.appendChild(el('p', { class: 'res-note', text: 'Results exist only in this browser tab. Download the XLSX to keep them and to use them in the Team rollup tab or the AI Strategy View.' }));
  }

  /* ---------- XLSX export / import ---------- */

  function nextIndicatorsText(di) {
    var s = scores[di];
    if (s >= 4) return 'Top level reached';
    return fw.domains[di].levels[s + 1].skills.map(function (sk) { return (sk.eu ? '[EU AI Act] ' : '') + sk.t; }).join('; ');
  }

  function downloadAssessment() {
    var rater = $('raterType').value;
    var meta = [
      ['Field', 'Value'],
      ['Tool', TOOL_NAME],
      ['Framework version', fw.meta.version],
      ['Rater type', rater],
      ['Name', $('personName').value.trim()],
      ['Team', $('teamName').value.trim()],
      ['Date', todayISO()]
    ];
    var rows = [['Domain ID', 'Domain', 'Score (0-4)', 'Level', 'Next-level indicators']];
    fw.domains.forEach(function (d, i) {
      rows.push([d.id, d.name, scores[i], levelName(scores[i]), nextIndicatorsText(i)]);
    });
    var wb = XLSX.utils.book_new();
    var wsA = XLSX.utils.aoa_to_sheet(rows);
    wsA['!cols'] = [{ wch: 10 }, { wch: 42 }, { wch: 12 }, { wch: 14 }, { wch: 100 }];
    var wsM = XLSX.utils.aoa_to_sheet(meta);
    wsM['!cols'] = [{ wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsA, 'Assessment');
    XLSX.utils.book_append_sheet(wb, wsM, 'Meta');
    // Shared-ID sheet for other Workmatik tools. The Assessment and Meta sheets above are unchanged, so earlier files and the team roll-up still work.
    var wd = [
      ['Field', 'Value'],
      ['Tool', TOOL_NAME],
      ['Tool key', 'skills'],
      ['Data version', fw.meta.version],
      ['Schema', 'workmatik-shared-ids-1'],
      ['Rater type', rater],
      ['Name', $('personName').value.trim()],
      ['Team', $('teamName').value.trim()],
      ['Date', todayISO()],
      ['Note', 'Domain IDs (SD01 to SD06) are stable. Other Workmatik tools match on these IDs.'],
      [],
      ['Domain ID', 'Domain', 'Score (0-4)', 'Level']
    ];
    fw.domains.forEach(function (d, i) { wd.push(['SD' + (d.id + 1 < 10 ? '0' : '') + (d.id + 1), d.name, scores[i], levelName(scores[i])]); });
    var wsW = XLSX.utils.aoa_to_sheet(wd);
    wsW['!cols'] = [{ wch: 20 }, { wch: 60 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsW, 'Workmatik data');
    var who = ($('personName').value.trim() || 'results').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 30) || 'results';
    XLSX.writeFile(wb, 'ai-skills-' + rater + '-' + who + '-' + todayISO() + '.xlsx');
  }

  function parseWorkbook(buf, fileName) {
    var wb = XLSX.read(buf, { type: 'array' });
    var wsA = wb.Sheets['Assessment'];
    var wsM = wb.Sheets['Meta'];
    if (!wsA || !wsM) throw new Error('not a file downloaded from this tool (missing Assessment or Meta sheet)');
    var meta = {};
    XLSX.utils.sheet_to_json(wsM, { header: 1, defval: '' }).forEach(function (r) {
      if (r[0] !== undefined && r[0] !== 'Field') meta[String(r[0])] = r[1];
    });
    if (meta['Tool'] !== TOOL_NAME) throw new Error('not a file downloaded from this tool');
    var rater = String(meta['Rater type'] || '').toLowerCase();
    if (!RATER_LABELS[rater]) throw new Error('unrecognised rater type');
    var byId = {};
    XLSX.utils.sheet_to_json(wsA, { header: 1, defval: '' }).forEach(function (r, i) {
      if (i === 0) return;
      var id = Number(r[0]);
      var sc = Number(r[2]);
      if (Number.isInteger(id) && Number.isInteger(sc) && sc >= 0 && sc <= 4) byId[id] = sc;
    });
    var out = [];
    for (var i = 0; i < fw.domains.length; i++) {
      var id = fw.domains[i].id;
      if (byId[id] === undefined) throw new Error('missing or invalid score for domain ' + id);
      out.push(byId[id]);
    }
    return {
      file: fileName,
      rater: rater,
      name: String(meta['Name'] || '').slice(0, 60),
      team: String(meta['Team'] || '').slice(0, 60),
      date: String(meta['Date'] || '').slice(0, 20),
      scores: out
    };
  }

  /* ---------- rollup ---------- */

  function setMessage(list, ok, text) {
    list.appendChild(el('li', { class: ok ? 'ok' : 'bad', text: (ok ? 'Loaded: ' : 'Skipped: ') + text }));
  }

  function handleFiles(fileList) {
    var msgs = $('importMessages');
    var files = Array.prototype.slice.call(fileList);
    if (!files.length) return;
    var pending = files.length;
    function done() {
      pending--;
      if (pending === 0) renderRollup();
    }
    files.forEach(function (f) {
      if (submissions.length >= MAX_FILES) { setMessage(msgs, false, f.name + ' (limit of ' + MAX_FILES + ' files reached)'); done(); return; }
      if (!/\.xlsx$/i.test(f.name)) { setMessage(msgs, false, f.name + ' (only .xlsx files are accepted)'); done(); return; }
      if (f.size > MAX_FILE_BYTES) { setMessage(msgs, false, f.name + ' (file is larger than 2 MB)'); done(); return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var sub = parseWorkbook(reader.result, f.name);
          var dup = submissions.some(function (s) { return s.file === sub.file && s.name === sub.name && s.rater === sub.rater && s.date === sub.date; });
          if (dup) setMessage(msgs, false, f.name + ' (already loaded)');
          else { submissions.push(sub); setMessage(msgs, true, f.name); }
        } catch (err) {
          setMessage(msgs, false, f.name + ' (' + err.message + ')');
        }
        done();
      };
      reader.onerror = function () { setMessage(msgs, false, f.name + ' (could not be read)'); done(); };
      reader.readAsArrayBuffer(f);
    });
  }

  function filtered() {
    var f = $('rollupFilter').value;
    return submissions.filter(function (s) { return f === 'all' || s.rater === f; });
  }

  function subLabel(s) {
    return s.name || s.file;
  }

  function domainAverages(list) {
    return fw.domains.map(function (d, i) { return avg(list.map(function (s) { return s.scores[i]; })); });
  }

  function renderAverages(list) {
    var host = $('rollupAverages');
    clear(host);
    if (!list.length) { host.appendChild(el('p', { class: 'empty', text: 'No files match this filter.' })); return; }
    var groupBy = $('rollupGroup').value;
    var groups = {};
    var order = [];
    list.forEach(function (s) {
      var key = groupBy === 'team' ? (s.team || '(no team)') : 'Everyone';
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(s);
    });
    order.forEach(function (key) {
      var g = groups[key];
      var avgs = domainAverages(g);
      if (groupBy === 'team') host.appendChild(el('h3', { text: key + ' (' + g.length + (g.length === 1 ? ' response)' : ' responses)') }));
      fw.domains.forEach(function (d, i) {
        var pct = (avgs[i] / 4) * 100;
        var bar = el('div', { class: 'bar', role: 'img', 'aria-label': d.short + ' average ' + round1(avgs[i]).toFixed(1) + ' of 4' }, el('span', { style: 'width:' + pct.toFixed(1) + '%' }));
        host.appendChild(el('div', { class: 'avg-row' }, el('span', { text: d.name }), bar, el('strong', { text: round1(avgs[i]).toFixed(1) })));
      });
    });
  }

  function renderMatrix(list) {
    var host = $('rollupMatrix');
    clear(host);
    if (!list.length) { host.appendChild(el('p', { class: 'empty', text: 'No files match this filter.' })); return; }
    var head = el('tr', null, el('th', { text: 'Name or file' }), el('th', { text: 'Rater' }), el('th', { text: 'Team' }));
    fw.domains.forEach(function (d) { head.appendChild(el('th', { text: d.short })); });
    head.appendChild(el('th', { text: 'Avg' }));
    var tbody = el('tbody');
    list.forEach(function (s) {
      var tr = el('tr', null, el('td', { text: subLabel(s) }), el('td', { text: RATER_LABELS[s.rater] }), el('td', { text: s.team }));
      s.scores.forEach(function (v) { tr.appendChild(el('td', { class: 'score ' + lvClass(v), text: String(v) })); });
      tr.appendChild(el('td', { class: 'score', text: round1(avg(s.scores)).toFixed(1) }));
      tbody.appendChild(tr);
    });
    var avgRow = el('tr', { class: 'avg' }, el('td', { text: 'Average' }), el('td'), el('td'));
    var avgs = domainAverages(list);
    avgs.forEach(function (v) { avgRow.appendChild(el('td', { class: 'score', text: round1(v).toFixed(1) })); });
    avgRow.appendChild(el('td', { class: 'score', text: round1(avg(avgs)).toFixed(1) }));
    tbody.appendChild(avgRow);
    host.appendChild(el('table', null, el('thead', null, head), tbody));
  }

  function calibrationRows() {
    var rows = [];
    var selfByName = {};
    submissions.forEach(function (s) {
      if (s.rater === 'self' && s.name) selfByName[s.name.toLowerCase()] = s;
    });
    submissions.forEach(function (o) {
      if (o.rater === 'self' || !o.name) return;
      var me = selfByName[o.name.toLowerCase()];
      if (!me) return;
      fw.domains.forEach(function (d, i) {
        var gap = o.scores[i] - me.scores[i];
        if (Math.abs(gap) > 1) rows.push({ name: o.name, rater: o.rater, domain: d.name, self: me.scores[i], other: o.scores[i], gap: gap });
      });
    });
    return rows;
  }

  function renderCalibration() {
    var host = $('rollupCalibration');
    clear(host);
    var rows = calibrationRows();
    if (!rows.length) {
      host.appendChild(el('p', { class: 'empty', text: 'No flags. Either no manager or peer files match a self-assessment by name, or all ratings are within one level.' }));
      return;
    }
    var head = el('tr', null);
    ['Name', 'Rater', 'Domain', 'Self', 'Other rater', 'Gap'].forEach(function (h) { head.appendChild(el('th', { text: h })); });
    var tbody = el('tbody');
    rows.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { text: r.name }), el('td', { text: RATER_LABELS[r.rater] }), el('td', { text: r.domain }),
        el('td', { class: 'score', text: String(r.self) }), el('td', { class: 'score', text: String(r.other) }),
        el('td', { class: 'score flag', text: (r.gap > 0 ? '+' : '') + r.gap })));
    });
    host.appendChild(el('table', null, el('thead', null, head), tbody));
  }

  function renderRollup() {
    $('rollupBody').hidden = submissions.length === 0;
    if (!submissions.length) return;
    var list = filtered();
    renderAverages(list);
    renderMatrix(list);
    renderCalibration();
  }

  function exportRollup() {
    var list = filtered();
    var wb = XLSX.utils.book_new();
    var m = [['Name or file', 'Rater', 'Team', 'Date'].concat(fw.domains.map(function (d) { return d.name; }), ['Average'])];
    list.forEach(function (s) {
      m.push([subLabel(s), RATER_LABELS[s.rater], s.team, s.date].concat(s.scores, [round1(avg(s.scores))]));
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(m), 'Matrix');
    var avgs = domainAverages(list);
    var a = [['Domain', 'Average (0-4)', 'Responses']];
    fw.domains.forEach(function (d, i) { a.push([d.name, round1(avgs[i]), list.length]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), 'Domain averages');
    var c = [['Name', 'Rater', 'Domain', 'Self', 'Other rater', 'Gap']];
    calibrationRows().forEach(function (r) { c.push([r.name, RATER_LABELS[r.rater], r.domain, r.self, r.other, r.gap]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(c), 'Calibration flags');
    XLSX.writeFile(wb, 'ai-skills-rollup-' + todayISO() + '.xlsx');
  }

  function initRollup() {
    var input = $('fileInput');
    input.addEventListener('change', function () { handleFiles(input.files); input.value = ''; });
    var dz = $('dropzone');
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); });
    });
    dz.addEventListener('drop', function (e) { handleFiles(e.dataTransfer.files); });
    $('rollupFilter').addEventListener('change', renderRollup);
    $('rollupGroup').addEventListener('change', renderRollup);
    $('btnRollupExport').addEventListener('click', exportRollup);
    $('btnRollupClear').addEventListener('click', function () {
      submissions = [];
      clear($('importMessages'));
      renderRollup();
    });
  }

  /* ---------- guide ---------- */

  var LEVEL_DESCS = [
    'No awareness of AI, its capabilities, or its implications. Has not engaged with AI tools or concepts in any professional context.',
    'Can describe what AI is at a conceptual level. Understands that AI is relevant to the organisation but has limited hands-on experience.',
    'Actively uses AI tools in daily work. Can identify use cases and risks in their own function. Understands basic EU AI Act obligations.',
    'Applies AI strategically within their domain. Can lead AI projects, conduct risk assessments, and ensure compliance in their area. Coaches others.',
    'Organisational authority on AI. Shapes policy, leads transformation, represents the organisation in regulatory contexts. Drives responsible AI culture.'
  ];
  function buildGuide() {
    var host = $('guideLevels');
    clear(host);
    fw.meta.levels.forEach(function (name, i) {
      host.appendChild(el('div', { class: 'guide-level' },
        el('div', { class: 'level-name' }, el('span', { class: 'dot ' + lvClass(i), 'aria-hidden': 'true' }), 'Level ' + i + ': ' + name),
        el('p', { class: 'level-sub', text: LEVEL_DESCS[i] })));
    });
  }

  /* ---------- init ---------- */

  function showError(msg) {
    var e = $('loadError');
    e.textContent = msg;
    e.hidden = false;
  }

  function init() {
    initTabs();
    fetch('data/framework.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        fw = data;
        $('euIntro').textContent = '';
        $('euIntro').appendChild(el('strong', { text: 'EU AI Act and AI literacy. ' }));
        $('euIntro').appendChild(document.createTextNode(fw.meta.euIntro));
        $('fwVersion').textContent = fw.meta.version;
        if (fw.meta.verification === 'pending') {
          var v = $('verifyNote');
          v.textContent = 'Regulatory references are being checked against the primary text of Regulation (EU) 2024/1689. Treat EU AI Act indicators as guidance, not legal advice.';
          v.hidden = false;
        } else if (fw.meta.verification === 'verified' && fw.meta.verifiedAgainst) {
          var n = $('verifiedNote');
          n.textContent = 'EU AI Act indicators checked on ' + fw.meta.verifiedDate + ' against ' + fw.meta.verifiedAgainst + '. The Act has been amended before, so check current text before relying on any indicator.';
          n.hidden = false;
        }
        buildChips();
        buildFramework('all');
        buildAssess();
        buildGuide();
        initRollup();
        $('btnDownload').addEventListener('click', downloadAssessment);
        $('btnDownloadToolkit').addEventListener('click', downloadAssessment);
        $('btnViewResults').addEventListener('click', function () { switchTab('results', true); });
        $('btnReset').addEventListener('click', buildAssess);
      })
      .catch(function (err) {
        showError('Could not load the framework data (' + err.message + '). If you opened index.html directly from a folder, browsers block this: use the published web address, or run a local server (python3 -m http.server) in this folder.');
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
