(function () {
  "use strict";
  var C = window.COURSE;
  var app = document.getElementById("app");
  var KEY = "ewj-progress-v1";
  var PASS = 2;          // lesson quiz: correct answers needed out of 3
  var TEST_SIZE = 10;    // unit test: number of questions
  var TEST_PASS = 8;     // unit test: correct answers needed

  // ---------- storage ----------
  var state = { done: {}, tests: {}, days: [], last: null, theme: "auto" };
  function load(obj) {
    if (!obj || typeof obj !== "object") return false;
    state.done = obj.done && typeof obj.done === "object" ? obj.done : {};
    state.tests = obj.tests && typeof obj.tests === "object" ? obj.tests : {};
    state.days = Array.isArray(obj.days) ? obj.days : [];
    state.last = obj.last || null;
    state.theme = obj.theme || state.theme || "auto";
    return true;
  }
  try { load(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) {}
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    if (window.EWJAccount) window.EWJAccount.push(state);
  }
  // hooks for account.js (cloud sync)
  window.EWJApp = {
    getState: function () { return state; },
    replace: function (obj) { var th = state.theme; load(obj || {}); state.theme = th; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} route(); },
    rerender: function () { route(); }
  };

  function today() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function markStudied() { var t = today(); if (state.days.indexOf(t) < 0) { state.days.push(t); if (state.days.length > 400) state.days.shift(); } }
  function streak() {
    var set = {}; state.days.forEach(function (d) { set[d] = 1; });
    var d = new Date(), n = 0;
    function key(x) { return x.getFullYear() + "-" + (x.getMonth() + 1) + "-" + x.getDate(); }
    if (!set[key(d)]) d.setDate(d.getDate() - 1); // today not done yet: streak still counts from yesterday
    while (set[key(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---------- flatten course ----------
  var all = [];
  C.units.forEach(function (u, ui) {
    u.num = ui + 1; u.all = [];
    u.chapters.forEach(function (c, ci) {
      c.num = ci + 1; c.unit = u;
      c.lessons.forEach(function (l, li) { l.unit = u; l.chapter = c; l.num = li + 1; all.push(l); u.all.push(l); });
    });
  });
  var byId = {}; all.forEach(function (l) { byId[l.id] = l; });

  function isDone(l) { return state.done[l.id] != null; }
  function countDone(list) { return list.filter(isDone).length; }
  function testPassed(u) { return (state.tests[u.num] || 0) >= TEST_PASS; }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
  function dur(s) { if (!s) return ""; var m = Math.floor(s / 60), r = s % 60; return m + ":" + (r < 10 ? "0" : "") + r; }
  function short(t) { return t.length > 60 ? t.slice(0, 57) + "…" : t; }
  function bar(p) { return '<div class="bar" role="progressbar" aria-valuenow="' + p + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + p + '%"></i></div>'; }

  function seeded(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }
  function shuffle(arr, rand) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function withIndex(arr) { return arr.map(function (x, i) { return { x: x, i: i }; }); }

  function nextUp(list) {
    list = list || all;
    if (list === all && state.last && byId[state.last] && !isDone(byId[state.last])) return byId[state.last];
    for (var i = 0; i < list.length; i++) if (!isDone(list[i])) return list[i];
    return null;
  }

  function updatePill() {
    document.getElementById("pill").textContent = countDone(all) + " / " + all.length + " done";
  }

  // ---------- theme ----------
  var themeBtn = document.getElementById("themeBtn");
  var THEMES = { auto: "Theme: Auto", light: "Theme: Light", dark: "Theme: Dark" };
  function applyTheme() {
    if (state.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", state.theme);
    themeBtn.textContent = state.theme === "dark" ? "☾" : state.theme === "light" ? "☀" : "◐";
    themeBtn.title = THEMES[state.theme]; themeBtn.setAttribute("aria-label", THEMES[state.theme] + " (click to change)");
  }
  themeBtn.addEventListener("click", function () {
    state.theme = state.theme === "auto" ? "light" : state.theme === "light" ? "dark" : "auto";
    save(); applyTheme();
  });
  applyTheme();

  // ---------- quiz rendering (shared by lessons and unit tests) ----------
  // items: [{q, a:[correct, wrong, wrong], from?}] ; seedFn gives option order
  function quizHTML(items, rand) {
    var h = "";
    items.forEach(function (q, qi) {
      h += '<fieldset class="q" data-q="' + qi + '"><legend>' + (qi + 1) + '. ' + esc(q.q) + '</legend>';
      shuffle(withIndex(q.a), rand(qi)).forEach(function (o, oi) {
        var oid = "q" + qi + "o" + oi;
        h += '<label class="opt" for="' + oid + '"><input type="radio" id="' + oid + '" name="q' + qi + '" value="' + o.i + '"><span>' + esc(o.x) + '</span></label>';
      });
      h += '<div class="explain" hidden></div></fieldset>';
    });
    return h;
  }
  // returns number right, or -1 if not all answered
  function grade(form, items) {
    var answered = items.filter(function (q, qi) { return form.querySelector('input[name="q' + qi + '"]:checked'); }).length;
    if (answered < items.length) {
      var first = items.findIndex(function (q, qi) { return !form.querySelector('input[name="q' + qi + '"]:checked'); });
      var fs = form.querySelector('[data-q="' + first + '"]'); if (fs) fs.scrollIntoView({ behavior: "smooth", block: "center" });
      return -1;
    }
    var right = 0;
    items.forEach(function (q, qi) {
      var ok = false;
      form.querySelectorAll('input[name="q' + qi + '"]').forEach(function (inp) {
        var lab = inp.closest(".opt"); inp.disabled = true;
        if (inp.value === "0") lab.classList.add("right");
        else if (inp.checked) lab.classList.add("wrong");
        if (inp.checked && inp.value === "0") ok = true;
      });
      if (ok) right++;
      var ex = form.querySelector('[data-q="' + qi + '"] .explain');
      ex.hidden = false;
      ex.className = "explain " + (ok ? "ok" : "no");
      ex.innerHTML = ok ? "Correct!" : 'The answer is: <b>' + esc(q.a[0]) + '</b>' + (q.from ? ' <a href="#lesson-' + q.from.id + '">Review the lesson</a>' : "");
    });
    return right;
  }
  function stars(right, total) { return '<span class="stars" aria-label="' + right + ' of ' + total + '">' + "★".repeat(right) + "☆".repeat(total - right) + '</span>'; }

  // ---------- views ----------
  function home() {
    var d = countDone(all), p = pct(d, all.length), nx = nextUp(), s = streak();
    var testsDone = C.units.filter(testPassed).length;
    var h = '<section class="hero"><h1>Learn English, one lesson at a time</h1>' +
      '<p>' + all.length + ' video lessons from ' + esc(C.channel) + ', in ' + C.units.length + ' units. Watch a video, take the quick quiz, and get ' + PASS + ' out of 3 right to check it off. Finish a unit with its unit test.</p>' +
      '<div class="stats"><span class="big">' + p + '%</span><span style="flex:1;min-width:160px">' + bar(p) + '<small class="sub">' + d + ' of ' + all.length + ' lessons · ' + testsDone + ' of ' + C.units.length + ' unit tests passed</small></span>' +
      '<span class="streak" title="Days in a row with a finished lesson or test"><b>' + s + '</b> day' + (s === 1 ? "" : "s") + ' in a row</span></div>' +
      (nx ? '<div><a class="btn" href="#lesson-' + nx.id + '">' + (d ? "Continue" : "Start") + ': ' + esc(short(nx.title)) + ' →</a></div>' : '<div class="result pass">Every lesson is complete. Amazing work!</div>') +
      '</section><div class="units">';
    C.units.forEach(function (u) {
      var ud = countDone(u.all), up = pct(ud, u.all.length), tp = testPassed(u), complete = ud === u.all.length && tp;
      h += '<a class="unit' + (complete ? " complete" : "") + '" href="#unit-' + u.num + '">' +
        '<span class="num">Unit ' + u.num + '</span><h2>' + esc(u.title) + '</h2><p>' + esc(u.desc) + '</p>' +
        bar(up) + '<span class="meta"><span>' + u.chapters.length + ' chapters · ' + u.all.length + ' lessons</span><span>' + ud + '/' + u.all.length + '</span></span>' +
        '<span class="testbadge' + (tp ? " passed" : "") + '">' + (tp ? "✓ Unit test passed · " + state.tests[u.num] + "/" + TEST_SIZE : (state.tests[u.num] != null ? "Unit test: best " + state.tests[u.num] + "/" + TEST_SIZE : "Unit test not taken")) + '</span></a>';
    });
    h += '</div>';
    app.innerHTML = h;
    document.title = "English with James Course";
  }

  function testCard(u) {
    var ud = countDone(u.all), tp = testPassed(u), best = state.tests[u.num];
    return '<div class="test-card' + (tp ? " passed" : "") + '"><div style="flex:1;min-width:220px"><span class="ch">Unit ' + u.num + ' test</span><h2>' + (tp ? "Unit test passed!" : "Ready for the unit test?") + '</h2>' +
      '<p>' + TEST_SIZE + ' questions mixed from every lesson in this unit. Get ' + TEST_PASS + ' right to pass. ' +
      (best != null ? "Best score: <b>" + best + "/" + TEST_SIZE + "</b>." : (ud < u.all.length ? "Best taken after you finish the lessons, but you can try any time." : "You've finished every lesson, so go for it!")) + '</p></div>' +
      '<a class="btn' + (tp ? " ghost" : "") + '" href="#test-' + u.num + '">' + (tp ? "Retake test" : best != null ? "Try again" : "Take the test") + '</a></div>';
  }

  function unitView(n) {
    var u = C.units[n - 1]; if (!u) return home();
    var ud = countDone(u.all), up = pct(ud, u.all.length), nx = nextUp(u.all);
    var h = '<nav class="crumbs"><a href="#home">All units</a><span>›</span><span>Unit ' + u.num + '</span></nav>' +
      '<div class="unit-head"><h1>Unit ' + u.num + ': ' + esc(u.title) + '</h1><p>' + esc(u.desc) + '</p>' + bar(up) +
      '<small class="sub">' + ud + ' of ' + u.all.length + ' lessons complete</small>' +
      (nx ? '<div><a class="btn" href="#lesson-' + nx.id + '">' + (ud ? "Continue this unit" : "Start this unit") + ': ' + esc(short(nx.title)) + ' →</a></div>' : "") + '</div>';
    u.chapters.forEach(function (c) {
      var cd = countDone(c.lessons), open = cd < c.lessons.length;
      h += '<details class="chapter"' + (open ? " open" : "") + '><summary><span style="flex:1;min-width:0"><span class="ch">Chapter ' + c.num + (cd === c.lessons.length ? " · Complete ✓" : "") + '</span><h2>' + esc(c.title) + '</h2></span>' +
        '<span class="count">' + cd + '/' + c.lessons.length + '</span><span class="chev" aria-hidden="true">▶</span></summary>' + lessonList(c.lessons) + '</details>';
    });
    h += testCard(u);
    h += '<div class="nav">' + (n > 1 ? '<a class="btn ghost" href="#unit-' + (n - 1) + '">← Unit ' + (n - 1) + '</a>' : "<span></span>") +
      (n < C.units.length ? '<a class="btn ghost" href="#unit-' + (n + 1) + '">Unit ' + (n + 1) + ' →</a>' : "") + '</div>';
    app.innerHTML = h;
    document.title = "Unit " + u.num + ": " + u.title;
  }

  function lessonList(lessons, current) {
    var h = '<ol class="lessons">';
    lessons.forEach(function (l) {
      var dn = isDone(l);
      h += '<li class="' + (dn ? "done" : "") + (l === current ? " current" : "") + '"><a href="#lesson-' + l.id + '"' + (l === current ? ' aria-current="page"' : "") + '><span class="check" aria-label="' + (dn ? "Completed" : "Not completed") + '">' + (dn ? "✓" : l.num) + '</span>' +
        '<span class="t">' + esc(l.title) + '<small>Lesson ' + l.num + (l.len ? " · " + dur(l.len) : "") + (l === current ? " · You are here" : "") + '</small></span>' +
        (dn ? '<span class="score">' + state.done[l.id] + '/3</span>' : "") + '</a></li>';
    });
    return h + '</ol>';
  }

  function lessonView(id) {
    var l = byId[id]; if (!l) return home();
    state.last = id; save();
    var idx = all.indexOf(l), prev = all[idx - 1] || null, next = all[idx + 1] || null;
    var u = l.unit, c = l.chapter, dn = isDone(l);
    var src = "https://www.youtube-nocookie.com/embed/" + l.id + "?rel=0&modestbranding=1";
    var h = '<nav class="crumbs"><a href="#home">All units</a><span>›</span><a href="#unit-' + u.num + '">Unit ' + u.num + ': ' + esc(u.title) + '</a><span>›</span><span>Chapter ' + c.num + ': ' + esc(c.title) + '</span></nav>' +
      '<div class="lesson-grid"><div><h1 class="lesson-title">' + esc(l.title) + '</h1>' +
      '<div class="lesson-sub"><span>Lesson ' + l.num + ' of ' + c.lessons.length + ' in this chapter</span>' + (l.len ? '<span>· ' + dur(l.len) + '</span>' : "") +
      (dn ? '<span class="pill">✓ Completed · ' + state.done[l.id] + '/3</span>' : "") + '</div></div>' +
      '<div class="video"><iframe src="' + src + '" title="' + esc(l.title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' +
      '<div class="yt-link">Video not playing? <a href="https://www.youtube.com/watch?v=' + l.id + '" target="_blank" rel="noopener">Watch it on YouTube</a>' +
      (location.protocol === "file:" ? ' — or open the course with <b>Start Course.bat</b> so videos can play here.' : "") + '</div>' +
      '<form class="panel" id="quiz"><h2>Lesson quiz</h2><p>Answer all 3 questions, then check. Get ' + PASS + ' or more right to complete the lesson.</p>' +
      quizHTML(l.quiz, function (qi) { return seeded(l.id + ":" + qi); }) +
      '<div class="actions"><button class="btn" type="submit" id="checkBtn">Check answers</button><button class="btn ghost" type="button" id="retryBtn" hidden>Try again</button></div><div id="result" aria-live="polite"></div></form>' +
      '<div class="nav">' + (prev ? '<a class="btn ghost" href="#lesson-' + prev.id + '">← <span>' + esc(short(prev.title)) + '</span></a>' : "<span></span>") +
      (next ? '<a class="btn" href="#lesson-' + next.id + '"><span>Next: ' + esc(short(next.title)) + '</span> →</a>' : '<a class="btn" href="#home">Back to all units</a>') + '</div>' +
      '<details class="chapter"><summary><span style="flex:1;min-width:0"><span class="ch">In this chapter</span><h2>' + esc(c.title) + '</h2></span><span class="count">' + countDone(c.lessons) + '/' + c.lessons.length + '</span><span class="chev" aria-hidden="true">▶</span></summary>' + lessonList(c.lessons, l) + '</details></div>';
    app.innerHTML = h;
    document.title = short(l.title);

    var form = document.getElementById("quiz"), res = document.getElementById("result");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var right = grade(form, l.quiz);
      if (right < 0) { res.innerHTML = '<div class="result fail">Please answer all ' + l.quiz.length + ' questions first.</div>'; return; }
      if (right >= PASS) {
        var chapterWasDone = countDone(c.lessons) === c.lessons.length, unitWasDone = countDone(u.all) === u.all.length;
        state.done[l.id] = Math.max(state.done[l.id] || 0, right); markStudied(); save(); updatePill();
        var extra = "";
        if (!unitWasDone && countDone(u.all) === u.all.length) extra = '<div class="celebrate">You finished every lesson in Unit ' + u.num + '! Time for the <a href="#test-' + u.num + '">unit test</a>.</div>';
        else if (!chapterWasDone && countDone(c.lessons) === c.lessons.length) extra = '<div class="celebrate">Chapter complete: ' + esc(c.title) + '!</div>';
        res.innerHTML = '<div class="result pass">' + stars(right, 3) + '<span>' + (right === 3 ? "Perfect score!" : "Nice work!") + ' Lesson complete.</span>' +
          (next ? '<a class="btn" href="#lesson-' + next.id + '">Next lesson →</a>' : "") + '</div>' + extra;
      } else {
        res.innerHTML = '<div class="result fail">' + stars(right, 3) + '<span>You got ' + right + ' of 3. Rewatch the video and try again.</span></div>';
      }
      document.getElementById("checkBtn").hidden = true;
      document.getElementById("retryBtn").hidden = false;
      res.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.getElementById("retryBtn").addEventListener("click", function () { lessonView(id); window.scrollTo(0, document.getElementById("quiz").offsetTop - 80); });
  }

  function testView(n) {
    var u = C.units[n - 1]; if (!u) return home();
    var rand = seeded(String(Date.now()));
    // spread questions across lessons: pick one question from each of TEST_SIZE random lessons
    var lessons = shuffle(u.all, rand).slice(0, TEST_SIZE);
    var items = lessons.map(function (l) { var q = l.quiz[Math.floor(rand() * l.quiz.length)]; return { q: q.q, a: q.a, from: l }; });
    var h = '<nav class="crumbs"><a href="#home">All units</a><span>›</span><a href="#unit-' + u.num + '">Unit ' + u.num + ': ' + esc(u.title) + '</a><span>›</span><span>Unit test</span></nav>' +
      '<div class="lesson-grid"><div><h1 class="lesson-title">Unit ' + u.num + ' Test: ' + esc(u.title) + '</h1>' +
      '<div class="lesson-sub"><span>' + TEST_SIZE + ' questions from ' + u.all.length + ' lessons · get ' + TEST_PASS + ' right to pass</span>' +
      (state.tests[u.num] != null ? '<span class="pill">Best: ' + state.tests[u.num] + '/' + TEST_SIZE + '</span>' : "") + '</div></div>' +
      '<form class="panel" id="quiz"><h2>Unit test</h2><p>Every attempt picks a new mix of questions. Missed one? You can jump back to that lesson.</p>' +
      quizHTML(items, function () { return rand; }) +
      '<div class="actions"><button class="btn" type="submit" id="checkBtn">Check answers</button><button class="btn ghost" type="button" id="retryBtn" hidden>New test</button></div><div id="result" aria-live="polite"></div></form>' +
      '<div class="nav"><a class="btn ghost" href="#unit-' + u.num + '">← Back to Unit ' + u.num + '</a>' + (n < C.units.length ? '<a class="btn ghost" href="#unit-' + (n + 1) + '">Unit ' + (n + 1) + ' →</a>' : "") + '</div></div>';
    app.innerHTML = h;
    document.title = "Unit " + u.num + " Test";
    var form = document.getElementById("quiz"), res = document.getElementById("result");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var right = grade(form, items);
      if (right < 0) { res.innerHTML = '<div class="result fail">Please answer all ' + items.length + ' questions first.</div>'; return; }
      state.tests[u.num] = Math.max(state.tests[u.num] || 0, right);
      if (right >= TEST_PASS) markStudied();
      save();
      res.innerHTML = right >= TEST_PASS
        ? '<div class="result pass"><span class="big">' + right + '/' + TEST_SIZE + '</span><span>You passed the Unit ' + u.num + ' test!</span>' + (n < C.units.length ? '<a class="btn" href="#unit-' + (n + 1) + '">On to Unit ' + (n + 1) + ' →</a>' : '<a class="btn" href="#home">See all units</a>') + '</div>'
        : '<div class="result fail"><span class="big">' + right + '/' + TEST_SIZE + '</span><span>So close! You need ' + TEST_PASS + ' to pass. Review the lessons linked under the missed questions, then take a new test.</span></div>';
      document.getElementById("checkBtn").hidden = true;
      document.getElementById("retryBtn").hidden = false;
      res.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.getElementById("retryBtn").addEventListener("click", function () { testView(n); window.scrollTo(0, 0); });
  }

  // ---------- router ----------
  function route() {
    var h = location.hash.replace(/^#/, "");
    closeResults();
    if (h.indexOf("lesson-") === 0) lessonView(h.slice(7));
    else if (h.indexOf("unit-") === 0) unitView(parseInt(h.slice(5), 10));
    else if (h.indexOf("test-") === 0) testView(parseInt(h.slice(5), 10));
    else if (h === "account" && window.EWJAccount) { window.EWJAccount.render(app); document.title = "Your account"; }
    else home();
    window.scrollTo(0, 0);
    updatePill();
  }
  window.addEventListener("hashchange", route);

  // ---------- search ----------
  var qi = document.getElementById("q"), rs = document.getElementById("results");
  qi.placeholder = "Search " + all.length + " lessons…";
  qi.title = "Tip: press / to search from anywhere";
  function closeResults() { rs.hidden = true; }
  qi.addEventListener("input", function () {
    var t = qi.value.trim().toLowerCase();
    if (t.length < 2) { closeResults(); return; }
    var hits = all.filter(function (l) { return l.title.toLowerCase().indexOf(t) >= 0 || l.chapter.title.toLowerCase().indexOf(t) >= 0; }).slice(0, 25);
    rs.innerHTML = hits.length ? hits.map(function (l) {
      return '<a href="#lesson-' + l.id + '">' + (isDone(l) ? "✓ " : "") + esc(l.title) + '<small>Unit ' + l.unit.num + ' · ' + esc(l.chapter.title) + '</small></a>';
    }).join("") : '<span class="none">No lessons match "' + esc(qi.value) + '"</span>';
    rs.hidden = false;
  });
  qi.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { var a = rs.querySelector("a"); if (a) { location.hash = a.getAttribute("href"); qi.value = ""; qi.blur(); } }
    if (e.key === "Escape") { qi.value = ""; closeResults(); qi.blur(); }
    if (e.key === "ArrowDown") { var f = rs.querySelector("a"); if (f) { e.preventDefault(); f.focus(); } }
  });
  rs.addEventListener("keydown", function (e) {
    var a = document.activeElement; if (!a || a.parentNode !== rs) return;
    if (e.key === "ArrowDown" && a.nextElementSibling) { e.preventDefault(); a.nextElementSibling.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (a.previousElementSibling || qi).focus(); }
    if (e.key === "Escape") { closeResults(); qi.focus(); }
  });
  rs.addEventListener("click", function () { closeResults(); qi.value = ""; });
  document.addEventListener("click", function (e) { if (!e.target.closest(".search")) closeResults(); });
  document.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase();
    if (e.key === "/" && tag !== "input" && tag !== "textarea") { e.preventDefault(); qi.focus(); }
  });

  // ---------- backup / restore & reset ----------
  var panel = document.getElementById("toolsPanel");
  function encode() { return btoa(unescape(encodeURIComponent(JSON.stringify({ done: state.done, tests: state.tests, days: state.days, last: state.last })))); }
  function showBackup() {
    panel.hidden = false;
    panel.innerHTML = '<h2>Move or back up progress</h2><p>Progress is saved only in this browser. To continue on another device, copy this code there and paste it under "Restore".</p>' +
      '<label for="backupOut" class="lbl">Your progress code</label><textarea id="backupOut" readonly rows="3">' + encode() + '</textarea>' +
      '<div class="actions"><button class="btn" id="copyBtn" type="button">Copy code</button><span id="copyMsg" class="sub"></span></div>' +
      '<label for="backupIn" class="lbl">Restore from a code</label><textarea id="backupIn" rows="3" placeholder="Paste a progress code here"></textarea>' +
      '<div class="actions"><button class="btn ghost" id="restoreBtn" type="button">Restore progress</button><button class="btn ghost" id="closeTools" type="button">Close</button><span id="restoreMsg" class="sub"></span></div>';
    document.getElementById("copyBtn").addEventListener("click", function () {
      var ta = document.getElementById("backupOut"), msg = document.getElementById("copyMsg");
      function fallback() { ta.focus(); ta.select(); msg.textContent = "Selected. Press Ctrl+C (or Cmd+C) to copy."; }
      try { navigator.clipboard.writeText(ta.value).then(function () { msg.textContent = "Copied!"; }, fallback); } catch (e) { fallback(); }
    });
    document.getElementById("restoreBtn").addEventListener("click", function () {
      var msg = document.getElementById("restoreMsg");
      try {
        var obj = JSON.parse(decodeURIComponent(escape(atob(document.getElementById("backupIn").value.trim()))));
        if (!obj.done) throw new Error("bad");
        var theme = state.theme; load(obj); state.theme = theme; save(); route();
        var n = countDone(all); msg.textContent = "Restored " + n + " completed lesson" + (n === 1 ? "" : "s") + ".";
      } catch (e) { msg.textContent = "That code didn't work. Copy the whole code and try again."; }
    });
    document.getElementById("closeTools").addEventListener("click", function () { panel.hidden = true; });
    panel.scrollIntoView({ behavior: "smooth" });
  }
  document.getElementById("backupBtn").addEventListener("click", showBackup);

  var area = document.getElementById("resetArea");
  function resetButton() {
    area.innerHTML = '<button class="linkbtn" id="resetBtn" type="button">Reset progress</button>';
    document.getElementById("resetBtn").addEventListener("click", function () {
      area.innerHTML = '<span class="confirm">Erase all progress? <button class="btn danger" id="yesReset" type="button">Yes, reset</button><button class="btn ghost" id="noReset" type="button">Cancel</button></span>';
      document.getElementById("yesReset").addEventListener("click", function () { state.done = {}; state.tests = {}; state.days = []; state.last = null; save(); resetButton(); route(); });
      document.getElementById("noReset").addEventListener("click", resetButton);
    });
  }
  resetButton();

  if (window.EWJAccount) window.EWJAccount.init(); else route();
})();
