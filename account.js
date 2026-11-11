// Accounts + cloud progress (Supabase). Usernames are turned into a private
// placeholder email behind the scenes, so learners only ever see a username.
(function () {
  "use strict";
  var cfg = window.EWJ_CONFIG || {};
  var configured = !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase);
  var client = null, user = null, timer = null, pending = null, status = "", lastSaved = null;
  var EMAIL_DOMAIN = "students.english-with-james.app";
  // Supabase requires passwords of 6+ characters; a fixed suffix lets short
  // passwords like a child's 4-letter one work. It is the same on every device.
  var PW_SUFFIX = "-ewj-course";

  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
  function cleanName(n) { return String(n || "").trim().toLowerCase(); }
  function validName(n) { return /^[a-z0-9._-]{3,20}$/.test(n); }
  function emailFor(n) { return n + "@" + EMAIL_DOMAIN; }
  function nameOf(u) { return (u && u.user_metadata && u.user_metadata.username) || (u && u.email ? u.email.split("@")[0] : ""); }

  function merge(a, b) {
    a = a || {}; b = b || {};
    var done = {}, tests = {}, days = {}, k;
    [a.done, b.done].forEach(function (o) { for (k in o || {}) done[k] = Math.max(done[k] || 0, o[k]); });
    [a.tests, b.tests].forEach(function (o) { for (k in o || {}) tests[k] = Math.max(tests[k] || 0, o[k]); });
    [a.days, b.days].forEach(function (arr) { (arr || []).forEach(function (d) { days[d] = 1; }); });
    return { done: done, tests: tests, days: Object.keys(days), last: b.last || a.last || null };
  }
  function payload(s) { return { done: s.done, tests: s.tests, days: s.days, last: s.last }; }

  function setStatus(s) { status = s; header(); }

  function header() {
    var btn = document.getElementById("acctBtn"), note = document.getElementById("acctNote");
    if (!btn) return;
    if (!configured) { btn.hidden = true; if (note) note.hidden = true; return; }
    btn.hidden = false;
    if (user) {
      btn.innerHTML = '<span class="dot ' + (status === "error" ? "bad" : status === "saving" ? "busy" : "ok") + '" aria-hidden="true"></span>' + esc(nameOf(user));
      btn.title = status === "error" ? "Progress not saved yet. Check your internet connection." : status === "saving" ? "Saving…" : "Progress saved to your account";
      if (note) note.hidden = true;
    } else {
      btn.textContent = "Sign in";
      btn.title = "Sign in to save progress to your account";
      if (note) { note.hidden = location.hash === "#account"; }
    }
  }

  async function flush() {
    if (!user || !pending) return;
    var data = pending; pending = null;
    setStatus("saving");
    var r = await client.from("progress").upsert({ user_id: user.id, data: data, updated_at: new Date().toISOString() });
    if (r.error) { pending = pending || data; setStatus("error"); }
    else { lastSaved = new Date(); setStatus("ok"); }
  }
  function push(s) {
    if (!user) return;
    pending = payload(s);
    clearTimeout(timer); timer = setTimeout(flush, 800);
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") { clearTimeout(timer); flush(); } });
  window.addEventListener("online", function () { if (user && status === "error") { pending = pending || payload(window.EWJApp.getState()); flush(); } });

  async function pull() {
    var r = await client.from("progress").select("data").eq("user_id", user.id).maybeSingle();
    if (r.error) { setStatus("error"); return; }
    var merged = merge(window.EWJApp.getState(), r.data ? r.data.data : null);
    window.EWJApp.replace(merged);
    pending = merged; await flush();
  }

  function friendly(err) {
    var m = (err && err.message) || String(err);
    if (/invalid login/i.test(m)) return "Wrong username or password.";
    if (/already registered|already exists/i.test(m)) return "That username is already taken.";
    if (/fetch|network/i.test(m)) return "Can't reach the server. Check your internet connection.";
    if (/signups? not allowed|disabled/i.test(m)) return "New accounts are turned off. Ask the person who set up the course.";
    return m;
  }

  function render(app) {
    var h = '<nav class="crumbs"><a href="#home">All units</a><span>›</span><span>Account</span></nav>';
    if (!configured) {
      h += '<section class="panel acct-card"><h1 class="lesson-title">Accounts aren\'t set up yet</h1><p>Progress is being saved in this browser for now.</p></section>';
    } else if (user) {
      var s = window.EWJApp.getState(), n = Object.keys(s.done || {}).length;
      h += '<section class="panel acct-card"><span class="ch">Signed in</span><h1 class="lesson-title">Hi, ' + esc(nameOf(user)) + '!</h1>' +
        '<p>Your progress saves to your account automatically, so you can sign in on any device and pick up where you left off.</p>' +
        '<p class="sub">' + n + ' lesson' + (n === 1 ? "" : "s") + ' completed · ' + (status === "error" ? "Not saved yet (check your connection)" : lastSaved ? "Last saved " + lastSaved.toLocaleTimeString() : "Saved") + '</p>' +
        '<div class="actions"><a class="btn" href="#home">Keep learning →</a><button class="btn ghost" id="signOut" type="button">Sign out</button></div></section>';
    } else {
      var mode = render.mode || "in";
      h += '<form class="panel acct-card" id="acctForm" novalidate><span class="ch">' + (mode === "in" ? "Welcome back" : "New here?") + '</span>' +
        '<h1 class="lesson-title">' + (mode === "in" ? "Sign in" : "Create an account") + '</h1>' +
        '<p>' + (mode === "in" ? "Sign in to save your progress to your account and use it on any device." : "Pick a username and password. You'll use them to sign in on any device.") + '</p>' +
        '<label class="lbl" for="acctUser">Username</label><input class="field" id="acctUser" autocomplete="username" autocapitalize="none" spellcheck="false" required>' +
        '<label class="lbl" for="acctPass">Password</label><input class="field" id="acctPass" type="password" autocomplete="' + (mode === "in" ? "current-password" : "new-password") + '" required>' +
        (mode === "up" ? '<label class="lbl" for="acctPass2">Type the password again</label><input class="field" id="acctPass2" type="password" autocomplete="new-password" required>' : "") +
        '<div class="actions"><button class="btn" type="submit" id="acctSubmit">' + (mode === "in" ? "Sign in" : "Create account") + '</button>' +
        '<button class="linkbtn" type="button" id="acctMode">' + (mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in") + '</button></div>' +
        '<div id="acctMsg" aria-live="polite"></div></form>';
    }
    app.innerHTML = h;
    header();

    var so = document.getElementById("signOut");
    if (so) so.addEventListener("click", async function () {
      clearTimeout(timer); await flush();
      await client.auth.signOut();
      user = null; window.EWJApp.replace({}); // clear this browser so the next person starts fresh
      location.hash = "#home"; header();
    });
    var form = document.getElementById("acctForm");
    if (!form) return;
    document.getElementById("acctMode").addEventListener("click", function () { render.mode = render.mode === "up" ? "in" : "up"; render(app); });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var msg = document.getElementById("acctMsg"), btn = document.getElementById("acctSubmit");
      var name = cleanName(document.getElementById("acctUser").value), pw = document.getElementById("acctPass").value;
      function fail(t) { msg.innerHTML = '<div class="result fail">' + esc(t) + '</div>'; btn.disabled = false; }
      if (!validName(name)) return fail("Usernames are 3–20 letters or numbers (dots, dashes and underscores are OK).");
      if (pw.length < 4) return fail("Passwords need at least 4 characters.");
      if (render.mode === "up" && pw !== document.getElementById("acctPass2").value) return fail("The two passwords don't match.");
      btn.disabled = true; msg.innerHTML = '<p class="sub">' + (render.mode === "up" ? "Creating your account…" : "Signing in…") + '</p>';
      try {
        var r = render.mode === "up"
          ? await client.auth.signUp({ email: emailFor(name), password: pw + PW_SUFFIX, options: { data: { username: name } } })
          : await client.auth.signInWithPassword({ email: emailFor(name), password: pw + PW_SUFFIX });
        if (r.error) return fail(friendly(r.error));
        if (!r.data.session) return fail("Account created, but it needs email confirmation. In Supabase, turn off \"Confirm email\" and try signing in.");
        user = r.data.session.user; render.mode = "in";
        await pull();
        location.hash = "#home";
      } catch (err) { fail(friendly(err)); }
    });
  }

  async function init() {
    if (!configured) { header(); window.EWJApp.rerender(); return; }
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    try {
      var s = await client.auth.getSession();
      if (s.data.session) { user = s.data.session.user; await pull(); }
    } catch (e) { setStatus("error"); }
    client.auth.onAuthStateChange(function (ev, session) {
      if (ev === "SIGNED_OUT") { user = null; header(); }
      else if (session) { user = session.user; header(); }
    });
    header();
    window.EWJApp.rerender();
    window.addEventListener("hashchange", header);
  }

  window.EWJAccount = { init: init, push: push, render: render };
})();
