(function () {
  "use strict";
  var C = window.COURSE;
  var app = document.getElementById("app");
  var KEY = "ewj-progress-v1";
  var PASS = 2; // correct answers needed (out of 3) to complete a lesson

  // ---------- storage ----------
  var state = { done: {}, last: null, hideGrown: false };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved) state = Object.assign(state, saved); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  // ---------- flatten course ----------
  var all = []; // every lesson with its position
  C.units.forEach(function (u, ui) {
    u.num = ui + 1;
    u.chapters.forEach(function (c, ci) {
      c.num = ci + 1;
      c.lessons.forEach(function (l, li) {
        l.unit = u; l.chapter = c; l.num = li + 1;
        all.push(l);
      });
    });
  });
  var byId = {};
  all.forEach(function (l) { byId[l.id] = l; });

  function visible(l) { return !(state.hideGrown && l.grown); }
  function vis(list) { return list.filter(visible); }
  function isDone(l) { return state.done[l.id] != null; }
  function countDone(list) { return list.filter(isDone).length; }
  function unitLessons(u) { var a = []; u.chapters.forEach(function (c) { a = a.concat(c.lessons); }); return vis(a); }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
  function dur(s) { if (!s) return ""; var m = Math.floor(s / 60), r = s % 60; return m + ":" + (r < 10 ? "0" : "") + r; }
  function bar(p) { return '<div class="bar" role="progressbar" aria-valuenow="' + p + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + p + '%"></i></div>'; }

  // deterministic shuffle so answer order is stable per question but not always first
  function seeded(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }
  function shuffled(arr, seed) { var r = seeded(seed), a = arr.map(function (x, i) { return { x: x, i: i }; }); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function updatePill() {
    var v = vis(all);
    document.getElementById("pill").textContent = countDone(v) + " / " + v.length + " done";
  }

  function nextUp() {
    var v = vis(all);
    if (state.last && byId[state.last] && !isDone(byId[state.last]) && visible(byId[state.last])) return byId[state.last];
    for (var i = 0; i < v.length; i++) if (!isDone(v[i])) return v[i];
    return null;
  }

  // ---------- views ----------
  function home() {
    var v = vis(all), d = countDone(v), p = pct(d, v.length), nx = nextUp();
    var h = '<section class="hero"><h1>Learn English, one lesson at a time</h1>' +
      '<p>' + v.length + ' video lessons from ' + esc(C.channel) + ', organized into ' + C.units.length + ' units. Watch a video, take the quick quiz, and get ' + PASS + ' out of 3 right to check the lesson off.</p>' +
      '<div class="stats"><span class="big">' + p + '%</span><span style="flex:1;min-width:160px">' + bar(p) + '<small style="color:var(--muted);font-weight:700">' + d + ' of ' + v.length + ' lessons complete</small></span></div>' +
      (nx ? '<div><a class="btn" href="#lesson-' + nx.id + '">' + (d ? "Continue" : "Start") + ': ' + esc(short(nx.title)) + ' →</a></div>' : '<div class="result pass">Every lesson is complete. Amazing work!</div>') +
      '</section><div class="units">';
    C.units.forEach(function (u) {
      var ul = unitLessons(u), ud = countDone(ul), up = pct(ud, ul.length);
      h += '<a class="unit' + (ul.length && ud === ul.length ? " complete" : "") + '" href="#unit-' + u.num + '">' +
        '<span class="num">Unit ' + u.num + '</span><h2>' + esc(u.title) + '</h2><p>' + esc(u.desc) + '</p>' +
        bar(up) + '<span class="meta"><span>' + u.chapters.length + ' chapters · ' + ul.length + ' lessons</span><span>' + ud + '/' + ul.length + '</span></span></a>';
    });
    h += '</div>';
    app.innerHTML = h;
    document.title = "English with James Course";
  }

  function short(t) { return t.length > 60 ? t.slice(0, 57) + "…" : t; }

  function unitView(n) {
    var u = C.units[n - 1]; if (!u) return home();
    var ul = unitLessons(u), ud = countDone(ul), up = pct(ud, ul.length);
    var h = '<nav class="crumbs"><a href="#home">All units</a><span>›</span><span>Unit ' + u.num + '</span></nav>' +
      '<div class="unit-head"><h1>Unit ' + u.num + ': ' + esc(u.title) + '</h1><p>' + esc(u.desc) + '</p>' + bar(up) +
      '<small style="color:var(--muted);font-weight:700">' + ud + ' of ' + ul.length + ' lessons complete</small></div>';
    u.chapters.forEach(function (c) {
      var cl = vis(c.lessons); if (!cl.length) return;
      var cd = countDone(cl), open = cd < cl.length;
      h += '<details class="chapter"' + (open ? " open" : "") + '><summary><span style="flex:1;min-width:0"><span class="ch">Chapter ' + c.num + '</span><h2>' + esc(c.title) + '</h2></span>' +
        '<span class="count">' + cd + '/' + cl.length + '</span><span class="chev" aria-hidden="true">▶</span></summary><ol class="lessons">';
      cl.forEach(function (l) {
        var dn = isDone(l);
        h += '<li class="' + (dn ? "done" : "") + '"><a href="#lesson-' + l.id + '"><span class="check" aria-label="' + (dn ? "Completed" : "Not completed") + '">' + (dn ? "✓" : l.num) + '</span>' +
          '<span class="t">' + esc(l.title) + (l.grown ? '<span class="tag">Grown-up topic</span>' : "") + '<small>Lesson ' + l.num + (l.len ? " · " + dur(l.len) : "") + '</small></span>' +
          (dn ? '<span class="score">' + state.done[l.id] + '/3</span>' : "") + '</a></li>';
      });
      h += '</ol></details>';
    });
    h += '<div class="nav">' + (n > 1 ? '<a class="btn ghost" href="#unit-' + (n - 1) + '">← Unit ' + (n - 1) + '</a>' : "<span></span>") +
      (n < C.units.length ? '<a class="btn ghost" href="#unit-' + (n + 1) + '">Unit ' + (n + 1) + ' →</a>' : "") + '</div>';
    app.innerHTML = h;
    document.title = "Unit " + u.num + ": " + u.title;
  }

  function lessonView(id) {
    var l = byId[id]; if (!l) return home();
    state.last = id; save();
    var v = vis(all), idx = v.indexOf(l), prev = idx > 0 ? v[idx - 1] : null, next = idx >= 0 && idx < v.length - 1 ? v[idx + 1] : null;
    if (idx < 0) { prev = null; next = null; }
    var u = l.unit, c = l.chapter, dn = isDone(l);
    var src = "https://www.youtube-nocookie.com/embed/" + l.id + "?rel=0&modestbranding=1";
    var h = '<nav class="crumbs"><a href="#home">All units</a><span>›</span><a href="#unit-' + u.num + '">Unit ' + u.num + ': ' + esc(u.title) + '</a><span>›</span><span>Chapter ' + c.num + ': ' + esc(c.title) + '</span></nav>' +
      '<div class="lesson-grid"><div><h1 class="lesson-title">' + esc(l.title) + '</h1>' +
      '<div class="lesson-sub"><span>Lesson ' + l.num + ' of ' + vis(c.lessons).length + ' in this chapter</span>' + (l.len ? '<span>· ' + dur(l.len) + '</span>' : "") +
      (l.grown ? '<span class="tag">Grown-up topic</span>' : "") + (dn ? '<span class="pill">✓ Completed · ' + state.done[l.id] + '/3</span>' : "") + '</div></div>' +
      '<div class="video"><iframe src="' + src + '" title="' + esc(l.title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' +
      '<div class="yt-link">Video not playing? <a href="https://www.youtube.com/watch?v=' + l.id + '" target="_blank" rel="noopener">Watch it on YouTube</a>' +
      (location.protocol === "file:" ? ' — or open the course with <b>Start Course.bat</b> so videos can play here.' : "") + '</div>' +
      '<form class="panel" id="quiz"><h2>Lesson quiz</h2><p>Answer all 3 questions, then check. Get ' + PASS + ' or more right to complete the lesson.</p>';
    l.quiz.forEach(function (q, qi) {
      h += '<fieldset class="q"><legend>' + (qi + 1) + '. ' + esc(q.q) + '</legend>';
      shuffled(q.a, l.id + ":" + qi).forEach(function (o, oi) {
        var oid = "q" + qi + "o" + oi;
        h += '<label class="opt" for="' + oid + '"><input type="radio" id="' + oid + '" name="q' + qi + '" value="' + o.i + '"><span>' + esc(o.x) + '</span></label>';
      });
      h += '</fieldset>';
    });
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit" id="checkBtn">Check answers</button><button class="btn ghost" type="button" id="retryBtn" hidden>Try again</button></div><div id="result"></div></form>' +
      '<div class="nav">' + (prev ? '<a class="btn ghost" href="#lesson-' + prev.id + '">← <span>' + esc(short(prev.title)) + '</span></a>' : "<span></span>") +
      (next ? '<a class="btn" href="#lesson-' + next.id + '"><span>Next: ' + esc(short(next.title)) + '</span> →</a>' : '<a class="btn" href="#home">Back to all units</a>') + '</div></div>';
    app.innerHTML = h;
    document.title = short(l.title);
    window.scrollTo(0, 0);

    var form = document.getElementById("quiz");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var answered = 0, right = 0;
      l.quiz.forEach(function (q, qi) {
        var pick = form.querySelector('input[name="q' + qi + '"]:checked');
        if (pick) answered++;
      });
      var res = document.getElementById("result");
      if (answered < l.quiz.length) { res.innerHTML = '<div class="result fail">Please answer all ' + l.quiz.length + ' questions first.</div>'; return; }
      l.quiz.forEach(function (q, qi) {
        form.querySelectorAll('input[name="q' + qi + '"]').forEach(function (inp) {
          var lab = inp.closest(".opt");
          inp.disabled = true;
          if (inp.value === "0") lab.classList.add("right");
          else if (inp.checked) lab.classList.add("wrong");
          if (inp.checked && inp.value === "0") right++;
        });
      });
      var stars = '<span class="stars" aria-label="' + right + ' of 3">' + "★".repeat(right) + "☆".repeat(3 - right) + '</span>';
      if (right >= PASS) {
        var prevBest = state.done[l.id] || 0;
        state.done[l.id] = Math.max(prevBest, right); save(); updatePill();
        res.innerHTML = '<div class="result pass">' + stars + '<span>' + (right === 3 ? "Perfect score!" : "Nice work!") + ' Lesson complete.</span>' +
          (next ? '<a class="btn" href="#lesson-' + next.id + '">Next lesson →</a>' : "") + '</div>';
      } else {
        res.innerHTML = '<div class="result fail">' + stars + '<span>You got ' + right + ' of 3. Rewatch the video and try again. The correct answers are shown in green.</span></div>';
      }
      document.getElementById("checkBtn").hidden = true;
      document.getElementById("retryBtn").hidden = false;
    });
    document.getElementById("retryBtn").addEventListener("click", function () {
      form.querySelectorAll("input").forEach(function (i) { i.disabled = false; i.checked = false; });
      form.querySelectorAll(".opt").forEach(function (o) { o.classList.remove("right", "wrong"); });
      document.getElementById("result").innerHTML = "";
      document.getElementById("checkBtn").hidden = false;
      this.hidden = true;
    });
  }

  // ---------- router ----------
  function route() {
    var h = location.hash.replace(/^#/, "");
    document.getElementById("results").hidden = true;
    if (h.indexOf("lesson-") === 0) lessonView(h.slice(7));
    else if (h.indexOf("unit-") === 0) unitView(parseInt(h.slice(5), 10));
    else home();
    window.scrollTo(0, 0);
    updatePill();
  }
  window.addEventListener("hashchange", route);

  // ---------- search ----------
  var qi = document.getElementById("q"), rs = document.getElementById("results");
  qi.addEventListener("input", function () {
    var t = qi.value.trim().toLowerCase();
    if (t.length < 2) { rs.hidden = true; return; }
    var hits = vis(all).filter(function (l) { return l.title.toLowerCase().indexOf(t) >= 0 || l.chapter.title.toLowerCase().indexOf(t) >= 0; }).slice(0, 25);
    rs.innerHTML = hits.length ? hits.map(function (l) {
      return '<a href="#lesson-' + l.id + '">' + (isDone(l) ? "✓ " : "") + esc(l.title) + '<small>Unit ' + l.unit.num + ' · ' + esc(l.chapter.title) + '</small></a>';
    }).join("") : '<a aria-disabled="true">No lessons match "' + esc(qi.value) + '"</a>';
    rs.hidden = false;
  });
  rs.addEventListener("click", function () { rs.hidden = true; qi.value = ""; });
  document.addEventListener("click", function (e) { if (!e.target.closest(".search")) rs.hidden = true; });

  // ---------- settings ----------
  var hg = document.getElementById("hideGrown");
  hg.checked = !!state.hideGrown;
  hg.addEventListener("change", function () { state.hideGrown = hg.checked; save(); route(); });

  var area = document.getElementById("resetArea");
  function resetButton() {
    area.innerHTML = '<button class="linkbtn" id="resetBtn">Reset progress</button>';
    document.getElementById("resetBtn").addEventListener("click", function () {
      area.innerHTML = '<span class="confirm">Erase all progress? <button class="btn danger" id="yesReset">Yes, reset</button><button class="btn ghost" id="noReset">Cancel</button></span>';
      document.getElementById("yesReset").addEventListener("click", function () { state.done = {}; state.last = null; save(); resetButton(); route(); });
      document.getElementById("noReset").addEventListener("click", resetButton);
    });
  }
  resetButton();

  route();
})();
