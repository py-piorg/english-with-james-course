(function () {
  "use strict";
  var C = window.COURSE;
  var app = document.getElementById("app");
  var KEY = "ewj-progress-v1";
  var PASS = 2;          // lesson quiz: correct answers needed out of 3
  var TEST_SIZE = 10;    // unit test: number of questions
  var TEST_PASS = 8;     // unit test: correct answers needed

  // ---------- storage ----------
  // review: { "lessonId:q": rightInARow }  log: [[timeMs, type, id, score, total]]  watch: { "y-m-d": seconds }
  var state = { done: {}, tests: {}, days: [], last: null, theme: "auto", review: {}, log: [], watch: {}, ctests: {}, badges: {}, name: "" };
  function obj(o) { return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }
  function load(o) {
    if (!o || typeof o !== "object") return false;
    state.done = obj(o.done); state.tests = obj(o.tests);
    state.days = Array.isArray(o.days) ? o.days : [];
    state.last = o.last || null;
    state.theme = o.theme || state.theme || "auto";
    state.review = obj(o.review); state.log = Array.isArray(o.log) ? o.log : []; state.watch = obj(o.watch);
    state.ctests = obj(o.ctests); state.badges = obj(o.badges); state.name = typeof o.name === "string" ? o.name : (state.name || "");
    return true;
  }
  function logEvent(type, id, score, total) {
    state.log.push([Date.now(), type, id, score, total]);
    if (state.log.length > 2000) state.log.splice(0, state.log.length - 2000);
  }
  var REVIEW_GOAL = 2; // right answers in a row to clear a question from review
  function noteAnswer(lessonId, qi, ok) {
    var k = lessonId + ":" + qi;
    if (!ok) state.review[k] = 0;
    else if (state.review[k] != null) { state.review[k]++; if (state.review[k] >= REVIEW_GOAL) delete state.review[k]; }
  }
  function reviewCount() { return Object.keys(state.review).filter(function (k) { return byId[k.split(":")[0]]; }).length; }
  try { load(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} if (typeof checkBadges === "function") checkBadges(); }

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
  // refOf(q, qi) -> [lessonId, questionIndex] so answers feed the review pile
  function grade(form, items, refOf) {
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
      var ref = refOf && refOf(q, qi); if (ref) noteAnswer(ref[0], ref[1], ok);
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
      '<div class="quick"><a class="btn ghost" href="#review">Review mistakes <span class="count-badge" data-review-count>' + reviewCount() + '</span></a>' +
      '<a class="btn ghost" href="#badges">Badges <span class="count-badge">' + earnedCount() + '</span></a><a class="btn ghost" href="#report">Progress report</a></div>' +
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

  // ---------- chapter tests ----------
  function ctKey(c) { return c.unit.num + "." + c.num; }
  function ctSize(c) { return Math.min(10, c.lessons.length * 3); }
  function ctPass(c) { return Math.ceil(ctSize(c) * 0.8); }
  function ctPassed(c) { return (state.ctests[ctKey(c)] || 0) >= ctPass(c); }
  function allChapters() { var a = []; C.units.forEach(function (u) { a = a.concat(u.chapters); }); return a; }
  function unitComplete(u) { return countDone(u.all) === u.all.length && testPassed(u); }
  function chapterTestRow(c) {
    var best = state.ctests[ctKey(c)], passed = ctPassed(c);
    return '<div class="ctest' + (passed ? " passed" : "") + '"><span class="check" aria-hidden="true">' + (passed ? "✓" : "?") + '</span>' +
      '<span class="t"><b>Chapter ' + c.num + ' test</b><small>' + ctSize(c) + ' questions · ' + ctPass(c) + ' to pass' + (best != null ? ' · best ' + best + '/' + ctSize(c) : "") + '</small></span>' +
      '<a class="btn' + (passed ? " ghost" : "") + ' small" href="#ctest-' + ctKey(c) + '">' + (passed ? "Retake" : best != null ? "Try again" : "Take test") + '</a></div>';
  }

  function testCard(u) {
    var ud = countDone(u.all), tp = testPassed(u), best = state.tests[u.num];
    if (unitComplete(u)) return '<div class="test-card passed"><div style="flex:1;min-width:220px"><span class="ch">Unit ' + u.num + ' complete</span><h2>You finished this unit!</h2>' +
      '<p>Every lesson done and the unit test passed (best ' + best + '/' + TEST_SIZE + '). Your certificate is ready.</p></div>' +
      '<div class="actions"><a class="btn" href="#cert-' + u.num + '">View certificate</a><a class="btn ghost" href="#test-' + u.num + '">Retake test</a></div></div>';
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
      h += '<details class="chapter"' + (open ? " open" : "") + '><summary><span style="flex:1;min-width:0"><span class="ch">Chapter ' + c.num + (cd === c.lessons.length ? " · Complete ✓" : "") + (ctPassed(c) ? " · Test passed ✓" : "") + '</span><h2>' + esc(c.title) + '</h2></span>' +
        '<span class="count">' + cd + '/' + c.lessons.length + '</span><span class="chev" aria-hidden="true">▶</span></summary>' + lessonList(c.lessons) + chapterTestRow(c) + '</details>';
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

  // ---------- video player ----------
  // Shows a clean preview first. The YouTube player only loads after Play,
  // and when the video ends it is swapped for our own card (no suggested videos).
  var ytLoading = null;
  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytLoading) return ytLoading;
    ytLoading = new Promise(function (resolve, reject) {
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); resolve(); };
      var s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.onerror = function () { ytLoading = null; reject(new Error("blocked")); };
      document.head.appendChild(s);
      setTimeout(function () { if (!(window.YT && window.YT.Player)) reject(new Error("timeout")); }, 8000);
    });
    return ytLoading;
  }
  function showPoster(box, l) {
    box.innerHTML = '<button class="poster" type="button" aria-label="Play video: ' + esc(l.title) + '">' +
      '<img src="https://i.ytimg.com/vi/' + l.id + '/hqdefault.jpg" alt="" loading="eager">' +
      '<span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="34" height="34"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>' +
      '<span class="ptitle">' + (l.len ? "Play · " + dur(l.len) : "Play video") + '</span></button>';
    box.querySelector(".poster").addEventListener("click", function () { playVideo(box, l); });
  }
  function plainEmbed(box, l) {
    box.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + l.id + '?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1" title="' + esc(l.title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  }
  // In-video questions: the lesson's quiz questions pause the video at their
  // time ("at", seconds). Answers there also fill in the quiz below the video.
  function checkpoints(l) {
    return l.quiz.map(function (q, i) { return { i: i, at: q.at }; })
      .filter(function (c) { return typeof c.at === "number"; })
      .sort(function (a, b) { return a.at - b.at; });
  }
  function renderDots(l) {
    var el = document.getElementById("cpDots"); if (!el) return;
    var asked = l._asked || {};
    el.innerHTML = checkpoints(l).map(function (c, n) {
      var a = asked[c.i], cls = a == null ? "" : a ? " right" : " wrong";
      return '<span class="cpdot' + cls + '" title="Question ' + (n + 1) + ' at ' + dur(c.at) + (a == null ? "" : a ? " · correct" : " · missed") + '"></span>';
    }).join("");
  }
  function playVideo(box, l) {
    box.innerHTML = '<div class="loading">Loading video…</div><div id="ytp-' + l.id + '"></div><div class="cp" id="cpBox" hidden></div>';
    l._asked = l._asked || {};
    var player = null, timer = null, open = null;
    var cps = checkpoints(l);
    function stop() { clearInterval(timer); timer = null; }
    var watchTicks = 0;
    function tick() {
      if (!document.body.contains(box)) return stop();
      if (!player || !player.getCurrentTime || open) return;
      var t = player.getCurrentTime();
      if (player.getPlayerState && player.getPlayerState() === 1) { // playing: count watch time
        var dk = today(); state.watch[dk] = (state.watch[dk] || 0) + 0.4;
        if (++watchTicks % 25 === 0) save();
      }
      for (var k = 0; k < cps.length; k++) {
        if (l._asked[cps[k].i] == null && t >= cps[k].at) { ask(cps[k], k); return; }
      }
    }
    function ask(cp, n) {
      open = cp;
      try { player.pauseVideo(); } catch (e) {}
      if (document.fullscreenElement && document.fullscreenElement !== box) document.exitFullscreen();
      var q = l.quiz[cp.i], ov = document.getElementById("cpBox");
      var opts = shuffle(withIndex(q.a), seeded(l.id + ":" + cp.i));
      ov.innerHTML = '<div class="cpcard" role="dialog" aria-modal="true" aria-labelledby="cpQ"><span class="ch">Pop quiz · question ' + (n + 1) + ' of ' + cps.length + ' · ' + dur(cp.at) + '</span>' +
        '<h3 id="cpQ">' + esc(q.q) + '</h3><div class="cpopts">' +
        opts.map(function (o) { return '<button type="button" class="cpopt" data-v="' + o.i + '">' + esc(o.x) + '</button>'; }).join("") +
        '</div><div class="cpfoot" id="cpFoot"></div></div>';
      ov.hidden = false;
      var first = ov.querySelector(".cpopt"); if (first) first.focus({ preventScroll: true });
      ov.querySelectorAll(".cpopt").forEach(function (b) {
        b.addEventListener("click", function () {
          var v = b.getAttribute("data-v"), ok = v === "0";
          ov.querySelectorAll(".cpopt").forEach(function (x) {
            x.disabled = true;
            if (x.getAttribute("data-v") === "0") x.classList.add("right"); else if (x === b) x.classList.add("wrong");
          });
          l._asked[cp.i] = ok; renderDots(l);
          noteAnswer(l.id, cp.i, ok); logEvent("pop", l.id, ok ? 1 : 0, 1); save(); updateReviewLink();
          // fill the same answer into the quiz below (if it hasn't been checked yet)
          var inp = document.querySelector('#quiz input[name="q' + cp.i + '"][value="' + v + '"]');
          if (inp && !inp.disabled) inp.checked = true;
          document.getElementById("cpFoot").innerHTML = '<span class="cpmsg ' + (ok ? "ok" : "no") + '">' + (ok ? "Correct!" : "Not quite. The answer is: " + esc(q.a[0])) + '</span>' +
            '<button type="button" class="btn" id="cpGo">Keep watching ▶</button>';
          var go = document.getElementById("cpGo"); go.focus({ preventScroll: true });
          go.addEventListener("click", function () { ov.hidden = true; ov.innerHTML = ""; open = null; try { player.playVideo(); } catch (e) {} });
        });
      });
    }
    loadYT().then(function () {
      if (!document.body.contains(box)) return;
      player = new window.YT.Player("ytp-" + l.id, {
        host: "https://www.youtube-nocookie.com",
        videoId: l.id,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, playsinline: 1, fs: 0 },
        events: {
          onReady: function () { var ld = box.querySelector(".loading"); if (ld) ld.remove(); timer = setInterval(tick, 400); },
          onStateChange: function (e) {
            var S = window.YT.PlayerState;
            if (e.data === S.PLAYING && open) { try { player.pauseVideo(); } catch (x) {} }
            if (e.data === S.ENDED && document.body.contains(box)) {
              // ask anything still unanswered before showing the end card
              var left = cps.filter(function (c) { return l._asked[c.i] == null; });
              if (left.length) { ask(left[0], cps.indexOf(left[0])); return; }
              stop(); try { e.target.destroy(); } catch (x) {}
              if (document.fullscreenElement) document.exitFullscreen();
              endCard(box, l);
            }
          }
        }
      });
      window._ewjPlayer = player;
    }, function () { if (document.body.contains(box)) plainEmbed(box, l); });
  }
  function endCard(box, l) {
    var done = isDone(l);
    box.innerHTML = '<div class="endcard"><img src="https://i.ytimg.com/vi/' + l.id + '/hqdefault.jpg" alt=""><div class="endinner">' +
      '<h2>' + (done ? "Video finished!" : "Video finished! Ready for the quiz?") + '</h2>' +
      '<div class="actions"><button class="btn" type="button" id="toQuiz">' + (done ? "Go to the quiz" : "Take the quiz ↓") + '</button><button class="btn ghost light" type="button" id="again">Watch again</button></div></div></div>';
    document.getElementById("toQuiz").addEventListener("click", function () { var q = document.getElementById("quiz"); if (q) { q.scrollIntoView({ behavior: "smooth", block: "start" }); var f = q.querySelector("input"); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 400); } });
    document.getElementById("again").addEventListener("click", function () { playVideo(box, l); });
  }

  function lessonView(id) {
    var l = byId[id]; if (!l) return home();
    state.last = id; save();
    var idx = all.indexOf(l), prev = all[idx - 1] || null, next = all[idx + 1] || null;
    var u = l.unit, c = l.chapter, dn = isDone(l);
    var h ='<nav class="crumbs"><a href="#home">All units</a><span>›</span><a href="#unit-' + u.num + '">Unit ' + u.num + ': ' + esc(u.title) + '</a><span>›</span><span>Chapter ' + c.num + ': ' + esc(c.title) + '</span></nav>' +
      '<div class="lesson-grid"><div><h1 class="lesson-title">' + esc(l.title) + '</h1>' +
      '<div class="lesson-sub"><span>Lesson ' + l.num + ' of ' + c.lessons.length + ' in this chapter</span>' + (l.len ? '<span>· ' + dur(l.len) + '</span>' : "") +
      (dn ? '<span class="pill">✓ Completed · ' + state.done[l.id] + '/3</span>' : "") + '</div></div>' +
      '<div class="video" id="videoBox"></div>' +
      '<div class="vbar"><span class="sub">' + checkpoints(l).length + ' pop-quiz questions appear during the video</span><span class="dots" id="cpDots"></span>' +
      '<button class="btn ghost small" type="button" id="fsBtn">⛶ Full screen</button></div>' +
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
    l._asked = {};
    var vbox = document.getElementById("videoBox");
    showPoster(vbox, l);
    renderDots(l);
    var fsBtn = document.getElementById("fsBtn");
    if (!vbox.requestFullscreen) fsBtn.hidden = true;
    fsBtn.addEventListener("click", function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else vbox.requestFullscreen().catch(function () { fsBtn.hidden = true; });
    });

    var form = document.getElementById("quiz"), res = document.getElementById("result");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var right = grade(form, l.quiz, function (q, qi) { return [l.id, qi]; });
      if (right < 0) { res.innerHTML = '<div class="result fail">Please answer all ' + l.quiz.length + ' questions first.</div>'; return; }
      logEvent("lesson", l.id, right, 3); save(); updateReviewLink();
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
    var items = lessons.map(function (l) { var qi = Math.floor(rand() * l.quiz.length), q = l.quiz[qi]; return { q: q.q, a: q.a, from: l, qi: qi }; });
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
      var right = grade(form, items, function (q) { return [q.from.id, q.qi]; });
      if (right < 0) { res.innerHTML = '<div class="result fail">Please answer all ' + items.length + ' questions first.</div>'; return; }
      logEvent("test", String(u.num), right, TEST_SIZE); updateReviewLink();
      state.tests[u.num] = Math.max(state.tests[u.num] || 0, right);
      if (right >= TEST_PASS) markStudied();
      save();
      res.innerHTML = right >= TEST_PASS
        ? '<div class="result pass"><span class="big">' + right + '/' + TEST_SIZE + '</span><span>You passed the Unit ' + u.num + ' test!</span>' +
          (unitComplete(u) ? '<a class="btn" href="#cert-' + u.num + '">Get your certificate</a>' : '<span>Finish the rest of the lessons to earn your Unit ' + u.num + ' certificate.</span>') +
          (n < C.units.length ? '<a class="btn ghost" href="#unit-' + (n + 1) + '">On to Unit ' + (n + 1) + ' →</a>' : "") + '</div>'
        : '<div class="result fail"><span class="big">' + right + '/' + TEST_SIZE + '</span><span>So close! You need ' + TEST_PASS + ' to pass. Review the lessons linked under the missed questions, then take a new test.</span></div>';
      document.getElementById("checkBtn").hidden = true;
      document.getElementById("retryBtn").hidden = false;
      res.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.getElementById("retryBtn").addEventListener("click", function () { testView(n); window.scrollTo(0, 0); });
  }

  function chapterTestView(key) {
    var p = key.split("."), u = C.units[+p[0] - 1], c = u && u.chapters[+p[1] - 1]; if (!c) return home();
    var size = ctSize(c), need = ctPass(c), rand = seeded(String(Date.now()));
    // one question from each lesson first, then fill up to the test size
    var lessons = shuffle(c.lessons, rand), picked = {}, items = [];
    for (var round = 0; items.length < size && round < 3; round++) {
      lessons.forEach(function (l) {
        if (items.length >= size) return;
        var free = l.quiz.map(function (q, i) { return i; }).filter(function (i) { return !picked[l.id + ":" + i]; });
        if (!free.length) return;
        var qi = free[Math.floor(rand() * free.length)]; picked[l.id + ":" + qi] = 1;
        items.push({ q: l.quiz[qi].q, a: l.quiz[qi].a, from: l, qi: qi });
      });
    }
    items = shuffle(items, rand);
    var best = state.ctests[key];
    var h = '<nav class="crumbs"><a href="#home">All units</a><span>›</span><a href="#unit-' + u.num + '">Unit ' + u.num + ': ' + esc(u.title) + '</a><span>›</span><span>Chapter ' + c.num + ' test</span></nav>' +
      '<div class="lesson-grid"><div><h1 class="lesson-title">Chapter ' + c.num + ' Test: ' + esc(c.title) + '</h1>' +
      '<div class="lesson-sub"><span>' + size + ' questions from ' + c.lessons.length + ' lessons · get ' + need + ' right to pass</span>' +
      (best != null ? '<span class="pill">Best: ' + best + '/' + size + '</span>' : "") + '</div></div>' +
      '<form class="panel" id="quiz"><h2>Chapter test</h2><p>Questions come from every lesson in this chapter, in a new mix each time.</p>' +
      quizHTML(items, function () { return rand; }) +
      '<div class="actions"><button class="btn" type="submit" id="checkBtn">Check answers</button><button class="btn ghost" type="button" id="retryBtn" hidden>New test</button></div><div id="result" aria-live="polite"></div></form>' +
      '<div class="nav"><a class="btn ghost" href="#unit-' + u.num + '">← Back to Unit ' + u.num + '</a></div></div>';
    app.innerHTML = h;
    document.title = "Chapter " + c.num + " Test";
    var form = document.getElementById("quiz"), res = document.getElementById("result");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var right = grade(form, items, function (q) { return [q.from.id, q.qi]; });
      if (right < 0) { res.innerHTML = '<div class="result fail">Please answer all ' + items.length + ' questions first.</div>'; return; }
      logEvent("ctest", key, right, size); updateReviewLink();
      state.ctests[key] = Math.max(state.ctests[key] || 0, right);
      if (right >= need) markStudied();
      save();
      var nextCh = u.chapters[c.num] ? u.chapters[c.num] : null;
      res.innerHTML = right >= need
        ? '<div class="result pass"><span class="big">' + right + '/' + size + '</span><span>You passed the Chapter ' + c.num + ' test!</span>' +
          (nextCh ? '<a class="btn" href="#unit-' + u.num + '">Next: ' + esc(nextCh.title) + ' →</a>' : '<a class="btn" href="#test-' + u.num + '">Take the Unit ' + u.num + ' test →</a>') + '</div>'
        : '<div class="result fail"><span class="big">' + right + '/' + size + '</span><span>You need ' + need + ' to pass. Check the lessons linked under the missed questions, then try a new test.</span></div>';
      document.getElementById("checkBtn").hidden = true;
      document.getElementById("retryBtn").hidden = false;
      res.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.getElementById("retryBtn").addEventListener("click", function () { chapterTestView(key); window.scrollTo(0, 0); });
  }

  // ---------- badges ----------
  function bestStreak() {
    var t = state.days.map(function (d) { var p = d.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); })
      .filter(function (x) { return !isNaN(x); }).sort(function (a, b) { return a - b; });
    var best = 0, run = 0, prev = null;
    t.forEach(function (x) { if (prev != null && Math.round((x - prev) / 86400000) === 1) run++; else if (prev == null || x !== prev) run = 1; best = Math.max(best, run); prev = x; });
    return best;
  }
  function badgeList() {
    var lessons = countDone(all), perfect = all.filter(function (l) { return state.done[l.id] === 3; }).length;
    var chapters = allChapters(), chPassed = chapters.filter(ctPassed).length, bs = bestStreak();
    var list = [];
    [3, 7, 14, 30, 60, 100].forEach(function (n, i) { list.push({ id: "streak-" + n, group: "Study streaks", tier: i, mark: n, name: n + "-day streak", desc: "Study " + n + " days in a row", have: bs, need: n }); });
    [[1, "First lesson"], [10, "10 lessons"], [25, "25 lessons"], [50, "50 lessons"], [100, "100 lessons"], [200, "200 lessons"], [all.length, "Every lesson"]].forEach(function (x, i) {
      list.push({ id: "lessons-" + x[0], group: "Lessons", tier: Math.min(5, i), mark: x[0], name: x[1], desc: "Complete " + (x[0] === 1 ? "your first lesson" : x[0] === all.length ? "all " + all.length + " lessons" : x[0] + " lessons"), have: lessons, need: x[0] });
    });
    [[10, 1], [50, 3], [150, 5]].forEach(function (x) { list.push({ id: "perfect-" + x[0], group: "Perfect scores", tier: x[1], mark: x[0], name: x[0] + " perfect quizzes", desc: "Get 3 out of 3 on " + x[0] + " lesson quizzes", have: perfect, need: x[0] }); });
    [[1, 0, "First chapter test"], [10, 2, "10 chapter tests"], [chapters.length, 5, "Every chapter test"]].forEach(function (x) { list.push({ id: "ctests-" + x[0], group: "Chapter tests", tier: x[1], mark: x[0], name: x[2], desc: "Pass " + (x[0] === 1 ? "a chapter test" : x[0] === chapters.length ? "all " + x[0] + " chapter tests" : x[0] + " chapter tests"), have: chPassed, need: x[0] }); });
    C.units.forEach(function (u) { list.push({ id: "unit-" + u.num, group: "Unit tests", tier: 4, mark: "U" + u.num, name: "Unit " + u.num + ": " + u.title, desc: "Pass the Unit " + u.num + " test", have: testPassed(u) ? 1 : 0, need: 1 }); });
    list.push({ id: "champion", group: "Unit tests", tier: 5, mark: "★", name: "Course champion", desc: "Complete every unit", have: C.units.filter(unitComplete).length, need: C.units.length });
    return list;
  }
  function checkBadges() {
    var fresh = badgeList().filter(function (b) { return b.have >= b.need && !state.badges[b.id]; });
    if (!fresh.length) return;
    fresh.forEach(function (b) { state.badges[b.id] = Date.now(); });
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    toast(fresh.sort(function (a, b) { return b.tier - a.tier; }));
  }
  var TIERS = ["bronze", "bronze", "silver", "silver", "gold", "gold"];
  function medal(b, earned) {
    var m = String(b.mark), small = m.length > 2;
    return '<span class="medal ' + (earned ? TIERS[b.tier] : "locked") + '" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29"/><circle cx="32" cy="32" r="23" class="ring"/>' +
      '<text x="32" y="' + (small ? 38 : 40) + '" text-anchor="middle" font-size="' + (small ? 17 : 22) + '">' + esc(m) + '</text></svg></span>';
  }
  function toast(badges) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    var b = badges[0];
    t.innerHTML = medal(b, true) + '<span><b>Badge earned!</b><br>' + esc(b.name) + (badges.length > 1 ? " +" + (badges.length - 1) + " more" : "") + '</span><a class="btn small" href="#badges">See badges</a>';
    t.hidden = false; t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.hidden = true; }, 400); }, 7000);
  }
  function earnedCount() { return badgeList().filter(function (b) { return state.badges[b.id]; }).length; }

  function badgesView() {
    var list = badgeList(), groups = {};
    list.forEach(function (b) { (groups[b.group] = groups[b.group] || []).push(b); });
    var h = '<nav class="crumbs"><a href="#home">All units</a><span>›</span><span>Badges & certificates</span></nav>' +
      '<div class="unit-head"><h1>Badges & certificates</h1><p>' + earnedCount() + ' of ' + list.length + ' badges earned · ' + C.units.filter(unitComplete).length + ' of ' + C.units.length + ' certificates</p></div>' +
      '<section class="panel"><h2>Certificates</h2><p class="sub">Finish every lesson in a unit and pass its unit test to earn a certificate you can print.</p><div class="certs">';
    C.units.forEach(function (u) {
      var done = unitComplete(u), ud = countDone(u.all);
      h += done ? '<a class="certmini" href="#cert-' + u.num + '"><span class="ch">Unit ' + u.num + '</span><b>' + esc(u.title) + '</b><span class="go">View & print →</span></a>'
        : '<div class="certmini locked"><span class="ch">Unit ' + u.num + '</span><b>' + esc(u.title) + '</b><span class="sub">' + ud + '/' + u.all.length + ' lessons · test ' + (testPassed(u) ? "passed" : "not passed") + '</span></div>';
    });
    h += '</div></section>';
    Object.keys(groups).forEach(function (g) {
      h += '<section class="panel badge-group"><h2>' + esc(g) + '</h2><div class="badges">';
      groups[g].forEach(function (b) {
        var got = state.badges[b.id];
        h += '<div class="badge' + (got ? "" : " locked") + '">' + medal(b, !!got) + '<b>' + esc(b.name) + '</b><small>' +
          (got ? "Earned " + new Date(got).toLocaleDateString() : esc(b.desc) + (b.need > 1 ? " · " + Math.min(b.have, b.need) + "/" + b.need : "")) + '</small></div>';
      });
      h += '</div></section>';
    });
    app.innerHTML = h;
    document.title = "Badges & certificates";
  }

  // ---------- certificates ----------
  function certView(n) {
    var u = C.units[n - 1]; if (!u) return home();
    var crumbs = '<nav class="crumbs noprint"><a href="#home">All units</a><span>›</span><a href="#badges">Badges & certificates</a><span>›</span><span>Unit ' + u.num + ' certificate</span></nav>';
    if (!unitComplete(u)) {
      app.innerHTML = crumbs + '<section class="panel empty"><h1 class="lesson-title">Unit ' + u.num + ' certificate is still locked</h1>' +
        '<p>To earn it: complete all ' + u.all.length + ' lessons (' + countDone(u.all) + ' done so far) and pass the Unit ' + u.num + ' test (' + (testPassed(u) ? "passed ✓" : "not passed yet") + ').</p>' +
        '<div class="actions"><a class="btn" href="#unit-' + u.num + '">Go to Unit ' + u.num + '</a></div></section>';
      document.title = "Certificate locked"; return;
    }
    if (!state.name) {
      app.innerHTML = crumbs + '<form class="panel acct-card" id="nameForm"><span class="ch">Almost there</span><h1 class="lesson-title">Whose name goes on the certificate?</h1>' +
        '<p>Type your name the way you want it printed. You can change it later.</p><label class="lbl" for="certName">Your name</label>' +
        '<input class="field" id="certName" maxlength="60" autocomplete="name" required value="' + esc(certView.prev || '') + '"><div class="actions"><button class="btn" type="submit">Make my certificate</button></div></form>';
      document.getElementById("nameForm").addEventListener("submit", function (e) { e.preventDefault(); var v = document.getElementById("certName").value.trim(); if (!v) return; state.name = v; save(); certView(n); });
      document.getElementById("certName").focus();
      document.title = "Your certificate"; return;
    }
    var when = new Date(state.badges["unit-" + u.num] || Date.now());
    app.innerHTML = crumbs +
      '<div class="cert-actions noprint"><button class="btn" type="button" id="printBtn">Print certificate</button><button class="btn ghost" type="button" id="renameBtn">Change name</button>' +
      '<span class="sub">Tip: in the print window, choose Landscape. To save a file instead, pick "Save as PDF" or "Microsoft Print to PDF".</span></div>' +
      '<article class="certificate"><div class="cert-inner">' +
      '<div class="cert-seal" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29"/><circle cx="32" cy="32" r="23" class="ring"/><text x="32" y="39" text-anchor="middle" font-size="20">U' + u.num + '</text></svg></div>' +
      '<p class="cert-kicker">Certificate of Completion</p>' +
      '<p class="cert-line">This certifies that</p>' +
      '<h1 class="cert-name">' + esc(state.name) + '</h1>' +
      '<p class="cert-line">has successfully completed</p>' +
      '<h2 class="cert-unit">Unit ' + u.num + ': ' + esc(u.title) + '</h2>' +
      '<p class="cert-detail">' + u.all.length + ' video lessons in ' + u.chapters.length + ' chapters, and passed the unit test with ' + state.tests[u.num] + ' out of ' + TEST_SIZE + '.</p>' +
      '<div class="cert-foot"><div><span class="cert-sig">' + when.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) + '</span><small>Date</small></div>' +
      '<div><span class="cert-sig">English with James Course</span><small>Lessons by ENGLISH with James · engVid</small></div></div>' +
      '</div></article>';
    document.title = "Unit " + u.num + " Certificate";
    document.getElementById("printBtn").addEventListener("click", function () { window.print(); });
    document.getElementById("renameBtn").addEventListener("click", function () { certView.prev = state.name; state.name = ""; save(); certView(n); });
  }

  // ---------- review mistakes ----------
  function updateReviewLink() {
    var n = reviewCount();
    document.querySelectorAll("[data-review-count]").forEach(function (el) { el.textContent = n; });
  }
  function reviewView() {
    var keys = Object.keys(state.review).filter(function (k) { return byId[k.split(":")[0]]; });
    var h = '<nav class="crumbs"><a href="#home">All units</a><span>›</span><span>Review mistakes</span></nav>';
    if (!keys.length) {
      app.innerHTML = h + '<section class="panel empty"><h1 class="lesson-title">Nothing to review right now</h1>' +
        '<p>Any question you miss in a lesson quiz, pop quiz, or unit test shows up here. Get it right ' + REVIEW_GOAL + ' times in a row and it leaves the pile.</p>' +
        '<div class="actions"><a class="btn" href="#home">Back to lessons</a></div></section>';
      document.title = "Review mistakes"; return;
    }
    var rand = seeded(String(Date.now()));
    // questions with the fewest right answers come first
    keys = shuffle(keys, rand).sort(function (a, b) { return state.review[a] - state.review[b]; }).slice(0, 10);
    var items = keys.map(function (k) { var p = k.split(":"), l = byId[p[0]], qi = +p[1], q = l.quiz[qi]; return { q: q.q, a: q.a, from: l, qi: qi }; });
    var total = keys.length === 10 ? reviewCount() : keys.length;
    h += '<div class="lesson-grid"><div><h1 class="lesson-title">Review mistakes</h1>' +
      '<div class="lesson-sub"><span>' + reviewCount() + ' question' + (reviewCount() === 1 ? "" : "s") + ' in your review pile · this round: ' + items.length + '</span></div></div>' +
      '<form class="panel" id="quiz"><h2>Practice round</h2><p>Get a question right ' + REVIEW_GOAL + ' times in a row to clear it. Miss it and it stays.</p>' +
      quizHTML(items, function () { return rand; }) +
      '<div class="actions"><button class="btn" type="submit" id="checkBtn">Check answers</button><button class="btn ghost" type="button" id="retryBtn" hidden>Next round</button></div><div id="result" aria-live="polite"></div></form></div>';
    app.innerHTML = h;
    document.title = "Review mistakes";
    var form = document.getElementById("quiz"), res = document.getElementById("result");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var before = reviewCount();
      var right = grade(form, items, function (q) { return [q.from.id, q.qi]; });
      if (right < 0) { res.innerHTML = '<div class="result fail">Please answer all ' + items.length + ' questions first.</div>'; return; }
      logEvent("review", "", right, items.length); markStudied(); save(); updateReviewLink();
      var after = reviewCount(), cleared = before - after;
      res.innerHTML = '<div class="result ' + (right === items.length ? "pass" : "fail") + '"><span class="big">' + right + '/' + items.length + '</span><span>' +
        (cleared > 0 ? cleared + " question" + (cleared === 1 ? "" : "s") + " cleared! " : "") +
        (after ? after + " left in your pile." : "Your review pile is empty. Great job!") + '</span></div>';
      var rb = document.getElementById("retryBtn");
      document.getElementById("checkBtn").hidden = true;
      rb.hidden = false; rb.textContent = after ? "Next round" : "Back to lessons";
      res.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.getElementById("retryBtn").addEventListener("click", function () { if (reviewCount()) { reviewView(); window.scrollTo(0, 0); } else location.hash = "#home"; });
  }

  // ---------- weekly progress report ----------
  function dayKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function mins(sec) { return Math.round((sec || 0) / 60); }
  function reportView() {
    var now = new Date(), DAY = 86400000;
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - 6 * DAY; // 7 days incl. today
    var prevStart = start - 7 * DAY;
    function summarize(from, to) {
      var ev = state.log.filter(function (e) { return e[0] >= from && e[0] < to; });
      var lessonsDone = {}, scores = [], tests = 0, testsPassed = 0, pops = 0, popsRight = 0, reviews = 0;
      ev.forEach(function (e) {
        if (e[1] === "lesson") { scores.push(e[3] / e[4]); if (e[3] >= PASS) lessonsDone[e[2]] = 1; }
        if (e[1] === "test") { tests++; if (e[3] >= TEST_PASS) testsPassed++; }
        if (e[1] === "pop") { pops++; popsRight += e[3]; }
        if (e[1] === "review") reviews++;
      });
      var watch = 0, active = 0;
      for (var t = from; t < to; t += DAY) { var k = dayKey(new Date(t)); watch += state.watch[k] || 0; if (state.days.indexOf(k) >= 0 || state.watch[k] > 60) active++; }
      return { lessons: Object.keys(lessonsDone).length, avg: scores.length ? Math.round(100 * scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : null,
        tests: tests, testsPassed: testsPassed, pops: pops, popPct: pops ? Math.round(100 * popsRight / pops) : null, reviews: reviews, watch: watch, active: active, events: ev };
    }
    var wk = summarize(start, now.getTime() + 1), pv = summarize(prevStart, start);
    function delta(a, b, unit) { if (b == null || a == null) return ""; var d = a - b; return '<small class="delta ' + (d > 0 ? "up" : d < 0 ? "down" : "") + '">' + (d > 0 ? "▲ " + d : d < 0 ? "▼ " + (-d) : "same as") + (d === 0 ? " last week" : (unit || "") + " vs last week") + '</small>'; }
    function tile(label, val, sub) { return '<div class="tile"><span class="ch">' + label + '</span><b>' + val + '</b>' + (sub || "") + '</div>'; }

    // daily chart
    var days = [], maxMin = 1;
    for (var i = 0; i < 7; i++) {
      var dt = new Date(start + i * DAY), k = dayKey(dt);
      var ls = state.log.filter(function (e) { var d = new Date(e[0]); return dayKey(d) === k && e[1] === "lesson" && e[3] >= PASS; }).length;
      var m = mins(state.watch[k]); maxMin = Math.max(maxMin, m);
      days.push({ label: dt.toLocaleDateString(undefined, { weekday: "short" }), m: m, ls: ls, today: i === 6 });
    }
    var chart = '<div class="week" role="img" aria-label="Minutes watched each day this week">' + days.map(function (d) {
      return '<div class="wday' + (d.today ? " today" : "") + '"><span class="wval">' + (d.m ? d.m + "m" : "") + '</span><span class="wbar"><i style="height:' + Math.round(100 * d.m / maxMin) + '%"></i></span>' +
        '<span class="wlab">' + d.label + '</span><span class="wls">' + (d.ls ? d.ls + " lesson" + (d.ls === 1 ? "" : "s") : "&nbsp;") + '</span></div>';
    }).join("") + '</div>';

    // topics that need work: current review pile grouped by chapter
    var byCh = {};
    Object.keys(state.review).forEach(function (k) { var l = byId[k.split(":")[0]]; if (!l) return; var key = l.unit.num + "." + l.chapter.num; (byCh[key] = byCh[key] || { c: l.chapter, n: 0 }).n++; });
    var weak = Object.keys(byCh).map(function (k) { return byCh[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5);

    // recent activity
    var recent = state.log.slice(-12).reverse().map(function (e) {
      var when = new Date(e[0]).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }), what;
      if (e[1] === "lesson") what = (e[3] >= PASS ? "Completed " : "Tried ") + '<a href="#lesson-' + e[2] + '">' + esc(short(byId[e[2]] ? byId[e[2]].title : "a lesson")) + '</a> · ' + e[3] + '/3';
      else if (e[1] === "test") what = "Unit " + e[2] + " test · " + e[3] + "/" + e[4] + (e[3] >= TEST_PASS ? " · passed" : "");
      else if (e[1] === "ctest") what = "Chapter " + e[2] + " test · " + e[3] + "/" + e[4];
      else if (e[1] === "review") what = "Review round · " + e[3] + "/" + e[4];
      else what = "Pop quiz in " + '<a href="#lesson-' + e[2] + '">' + esc(short(byId[e[2]] ? byId[e[2]].title : "a lesson")) + '</a> · ' + (e[3] ? "right" : "missed");
      return '<li><span class="when">' + when + '</span><span>' + what + '</span></li>';
    }).join("");

    var since = state.log.length ? new Date(state.log[0][0]).toLocaleDateString() : null;
    var h = '<nav class="crumbs"><a href="#home">All units</a><span>›</span><span>Progress report</span></nav>' +
      '<div class="unit-head"><h1>Progress report</h1><p>The last 7 days, compared with the week before. ' + (since ? "Activity tracking started " + since + "." : "Activity will show up here as lessons are completed.") + '</p></div>' +
      '<div class="tiles">' +
      tile("Lessons completed", wk.lessons, delta(wk.lessons, pv.lessons)) +
      tile("Minutes watched", mins(wk.watch), delta(mins(wk.watch), mins(pv.watch))) +
      tile("Days studied", wk.active + "/7", delta(wk.active, pv.active)) +
      tile("Quiz average", wk.avg == null ? "–" : wk.avg + "%", wk.avg != null && pv.avg != null ? delta(wk.avg, pv.avg, " pts") : "") +
      tile("Pop quizzes right", wk.popPct == null ? "–" : wk.popPct + "%", '<small class="delta">' + wk.pops + ' answered</small>') +
      tile("Unit tests passed", wk.testsPassed + (wk.tests ? " of " + wk.tests : ""), "") +
      '</div>' +
      '<section class="panel"><h2>This week, day by day</h2>' + chart + '</section>' +
      '<div class="report-cols"><section class="panel"><h2>Topics to work on</h2>' +
      (weak.length ? '<ul class="weak">' + weak.map(function (w) { return '<li><a href="#unit-' + w.c.unit.num + '">Unit ' + w.c.unit.num + ' · ' + esc(w.c.title) + '</a><span class="count">' + w.n + ' missed</span></li>'; }).join("") + '</ul><div class="actions"><a class="btn" href="#review">Review mistakes (' + reviewCount() + ')</a></div>'
        : '<p>No missed questions waiting. Nice!</p>') + '</section>' +
      '<section class="panel"><h2>Recent activity</h2>' + (recent ? '<ul class="recent">' + recent + '</ul>' : '<p>No activity yet.</p>') + '</section></div>' +
      '<section class="panel"><h2>All time</h2><p>' + countDone(all) + ' of ' + all.length + ' lessons complete · ' + C.units.filter(testPassed).length + ' of ' + C.units.length + ' unit tests passed · ' + streak() + '-day streak · ' + reviewCount() + ' questions in the review pile</p></section>';
    app.innerHTML = h;
    document.title = "Progress report";
  }

  // ---------- router ----------
  function route() {
    var h = location.hash.replace(/^#/, "");
    closeResults();
    if (h.indexOf("lesson-") === 0) lessonView(h.slice(7));
    else if (h.indexOf("unit-") === 0) unitView(parseInt(h.slice(5), 10));
    else if (h.indexOf("test-") === 0) testView(parseInt(h.slice(5), 10));
    else if (h.indexOf("ctest-") === 0) chapterTestView(h.slice(6));
    else if (h.indexOf("cert-") === 0) certView(parseInt(h.slice(5), 10));
    else if (h === "badges") badgesView();
    else if (h === "review") reviewView();
    else if (h === "report") reportView();
    else home();
    updateReviewLink();
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
  function encode() { return btoa(unescape(encodeURIComponent(JSON.stringify({ done: state.done, tests: state.tests, days: state.days, last: state.last, review: state.review, log: state.log, watch: state.watch, ctests: state.ctests, badges: state.badges, name: state.name })))); }
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
      document.getElementById("yesReset").addEventListener("click", function () { state.done = {}; state.tests = {}; state.days = []; state.last = null; state.review = {}; state.log = []; state.watch = {}; state.ctests = {}; state.badges = {}; save(); resetButton(); route(); });
      document.getElementById("noReset").addEventListener("click", resetButton);
    });
  }
  resetButton();

  route();
})();
