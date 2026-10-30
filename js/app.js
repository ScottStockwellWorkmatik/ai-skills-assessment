(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var D, byId = {}, unlocks = {}, btn = {}, sel = null;
  var LANE_NAME = { L: 'Leader', M: 'Marketer' };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // Logo files are optional: fall back to a text wordmark if they are not in /assets.
  ['logoScreen'].forEach(function (id) {
    var img = $(id); if (!img) return;
    function swap() {
      var w = el('p', 'logo wordmark', 'Workmatik');
      if (img.parentNode) img.parentNode.replaceChild(w, img);
    }
    if (img.complete && img.naturalWidth === 0) swap(); else img.addEventListener('error', swap);
  });

  function closure(start, next) {
    var seen = {}, stack = [start], out = [];
    while (stack.length) {
      var x = stack.pop();
      next(x).forEach(function (y) { if (!seen[y]) { seen[y] = true; out.push(y); stack.push(y); } });
    }
    return out;
  }

  function build() {
    $('mapVersion').textContent = D.meta.version + ', ' + D.meta.date;
    // key
    var key = $('key');
    Object.keys(D.categories).forEach(function (k) {
      key.appendChild(el('li', '', '<span class="id badge">' + k + '</span>' + esc(D.categories[k])));
    });
    key.appendChild(el('li', '', '<span class="id badge">&#9733;</span>Proposed critical'));
    D.nodes.forEach(function (n) { byId[n.id] = n; unlocks[n.id] = []; });
    D.nodes.forEach(function (n) { n.needs.forEach(function (m) { unlocks[m].push(n.id); }); });

    ['L', 'M'].forEach(function (lane) {
      var L = D.lanes[lane];
      $('h-' + lane).textContent = L.title;
      $('s-' + lane).textContent = L.sub;
      var g = $('g-' + lane), cols = [];
      D.phases.forEach(function (p, i) {
        g.appendChild(el('div', 'ph', '<b>' + (i + 1) + '. ' + esc(p) + '</b><span>' + esc(D.phaseSub[lane][i]) + '</span>'));
      });
      D.phases.forEach(function () { var c = el('div', 'col'); g.appendChild(c); cols.push(c); });
      L.order.forEach(function (ids, p) {
        ids.forEach(function (id) {
          var n = byId[id];
          var needs = n.needs.length ? n.needs.map(function (m) {
            return byId[m].lane !== n.lane ? '<b>' + m + '</b>' : m;
          }).join(', ') : 'none';
          var b = el('button', 'node' + (n.critical ? ' crit' : ''),
            '<span class="id">' + id + '</span><span class="t">' + esc(n.short) + '</span><span class="nf">Needs first: ' + needs + '</span>');
          b.type = 'button'; b.setAttribute('aria-pressed', 'false');
          b.setAttribute('aria-label', id + ' ' + n.short + (n.critical ? ', proposed critical' : ''));
          b.addEventListener('click', function () { select(sel === id ? null : id); });
          cols[p].appendChild(b); btn[id] = b;
        });
      });
    });
  }

  var stage, svg, layer;
  function rect(id) {
    var r = btn[id].getBoundingClientRect(), s = stage.getBoundingClientRect();
    return { l: r.left - s.left, r: r.right - s.left, t: r.top - s.top, b: r.bottom - s.top, cy: (r.top + r.bottom) / 2 - s.top };
  }
  function path(a, b) {
    var f = rect(a), t = rect(b);
    if (t.l > f.r + 10) { var dx = Math.max(18, (t.l - f.r) / 2); return 'M' + f.r + ',' + f.cy + ' C' + (f.r + dx) + ',' + f.cy + ' ' + (t.l - dx) + ',' + t.cy + ' ' + t.l + ',' + t.cy; }
    return 'M' + f.r + ',' + f.cy + ' C' + (f.r + 26) + ',' + f.cy + ' ' + (t.r + 26) + ',' + t.cy + ' ' + t.r + ',' + t.cy;
  }
  function addEdge(a, b, cls) {
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', path(a, b)); p.setAttribute('class', cls);
    p.setAttribute('marker-end', 'url(#m-' + cls.slice(2) + ')'); layer.appendChild(p);
  }
  function draw() {
    if (!stage) return;
    var s = stage.getBoundingClientRect();
    svg.setAttribute('width', s.width); svg.setAttribute('height', s.height);
    svg.setAttribute('viewBox', '0 0 ' + s.width + ' ' + s.height);
    layer.innerHTML = '';
    if (!sel && $('showAll').checked) D.nodes.forEach(function (n) { n.needs.forEach(function (m) { addEdge(m, n.id, 'e-all'); }); });
    if (sel) {
      var U = {}, W = {};
      U[sel] = W[sel] = true;
      closure(sel, function (x) { return byId[x].needs; }).forEach(function (x) { U[x] = true; });
      closure(sel, function (x) { return unlocks[x]; }).forEach(function (x) { W[x] = true; });
      D.nodes.forEach(function (n) { n.needs.forEach(function (m) {
        if (U[n.id] && U[m]) addEdge(m, n.id, 'e-up');
        if (W[n.id] && W[m]) addEdge(m, n.id, 'e-down');
      }); });
    }
  }

  function chip(id) {
    var n = byId[id];
    return '<button type="button" class="pchip" data-go="' + id + '"><span class="id">' + id + '</span>' + esc(n.short) + ' <i>' + LANE_NAME[n.lane] + '</i></button>';
  }
  function panel() {
    var p = $('panel');
    if (!sel) { p.innerHTML = '<p class="empty">Select an activity to see what it needs first, what it unlocks and what done looks like.</p>'; return; }
    var n = byId[sel], un = unlocks[sel];
    p.innerHTML = '<h3>' + (n.critical ? '&#9733; ' : '') + n.id + ' &middot; ' + esc(n.short) + '</h3>' +
      '<p class="meta">' + (n.lane === 'L' ? 'Marketing leader' : 'Marketer') + ' &middot; Phase ' + (n.phase + 1) + ', ' + esc(D.phases[n.phase]) +
      ' &middot; ' + esc(D.categories[n.id.charAt(0)]) + (n.critical ? ' &middot; Proposed critical' : '') + '</p>' +
      '<div class="pcols">' +
      '<div><h4>Activity</h4><p>' + esc(n.activity) + '</p></div>' +
      '<div><h4>Done when</h4><p>' + esc(n.doneWhen) + '</p></div>' +
      '<div><h4>Needs first (' + n.needs.length + ')</h4><div class="pchips">' + (n.needs.length ? n.needs.map(chip).join('') : '<span class="hint">Nothing. A good place to start.</span>') + '</div></div>' +
      '<div><h4>Unlocks (' + un.length + ')</h4><div class="pchips">' + (un.length ? un.map(chip).join('') : '<span class="hint">Nothing further. This closes a path.</span>') + '</div></div>' +
      '</div>';
    Array.prototype.forEach.call(p.querySelectorAll('[data-go]'), function (b) {
      b.addEventListener('click', function () {
        select(b.dataset.go);
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        btn[b.dataset.go].scrollIntoView({ block: 'center', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
      });
    });
  }
  function select(id) {
    sel = id;
    document.body.classList.toggle('has-sel', !!id);
    D.nodes.forEach(function (n) { var b = btn[n.id]; b.classList.remove('sel', 'up', 'down'); b.setAttribute('aria-pressed', 'false'); });
    if (id) {
      closure(id, function (x) { return byId[x].needs; }).forEach(function (x) { btn[x].classList.add('up'); });
      closure(id, function (x) { return unlocks[x]; }).forEach(function (x) { btn[x].classList.add('down'); });
      btn[id].classList.add('sel'); btn[id].setAttribute('aria-pressed', 'true');
    }
    try { history.replaceState(null, '', id ? '#' + id : location.pathname + location.search); } catch (e) {}
    panel(); draw();
  }

  fetch('data/journey.json').then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (j) {
    D = j; stage = $('stage'); svg = $('edges'); layer = $('edgeLayer');
    build();
    $('showAll').addEventListener('change', draw);
    window.addEventListener('resize', draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    function fromHash() { var h = (location.hash || '').replace('#', ''); return h && byId[h] ? h : null; }
    var h0 = fromHash();
    if (h0) select(h0); else draw();
    window.addEventListener('hashchange', function () { var h = fromHash(); if (h !== sel) select(h); });
  }).catch(function () {
    var e = $('loadError');
    e.textContent = 'Could not load the journey data. Check that data/journey.json is in the repository, then reload the page.';
    e.hidden = false;
  });
})();
