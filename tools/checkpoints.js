// Works out when each lesson-quiz question should pop up during its video.
// Input: data/videos.json, course-data.js and a descriptions JSON (fetched
// separately, not stored in the repo). Output: data/checkpoints.json
//   { videoId: { t: [sec, sec, sec], how: "text" | "chapters" | "spread" } }
// "t" lines up with the lesson's quiz questions.
const fs = require("fs");
const [, , vidsPath, coursePath, descPath, outPath] = process.argv;
const vids = JSON.parse(fs.readFileSync(vidsPath, "utf8"));
const len = {}; vids.forEach(v => (len[v.id] = v.s));
global.window = {}; eval(fs.readFileSync(coursePath, "utf8"));
const course = window.COURSE;
const descs = JSON.parse(fs.readFileSync(descPath, "utf8"));

const STOP = new Set(("a an the and or but of to in on at by for with from is are was were be been it its this that these those " +
  "what which who whom whose when where why how do does did you your i me my we our they them their he she his her " +
  "means mean meaning lesson james word words say says said use used using something someone very not no yes " +
  "can could would should will may might must have has had about into than then there here as if so all one two three " +
  "usually often always never good best better more most less other another same different correct answer means... " +
  "like just only also really thing things people person way").split(/\s+/));

function words(s) { return (s.toLowerCase().match(/[a-z']+/g) || []).map(w => w.replace(/'s$/, "").replace(/'/g, "")).filter(w => w.length > 2 && !STOP.has(w)); }
function stem(w) { return w.replace(/(ing|ed|es|s)$/, "").slice(0, 7); }

function transcriptOf(d) {
  const i = d.search(/TRANSCRIPT/i); if (i < 0) return null;
  const text = d.slice(i).replace(/^TRANSCRIPT:?/i, "");
  const w = (text.toLowerCase().match(/[a-z']+/g) || []);
  return w.length > 150 ? w : null;
}
function chaptersOf(d) {
  const out = [];
  d.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*(?:(\d+):)?(\d{1,2}):(\d{2})\s+(.+)$/);
    if (m) out.push({ t: (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]), title: m[4] });
  });
  return out.length >= 3 && out[0].t === 0 ? out : null;
}

const stats = { text: 0, chapters: 0, spread: 0, qText: 0, qFallback: 0 };
const out = {};
course.units.forEach(u => u.chapters.forEach(c => c.lessons.forEach(l => {
  const D = len[l.id] || 300, d = descs[l.id] || "";
  const tw = transcriptOf(d), ch = chaptersOf(d);
  const spread = [0.55, 0.75, 0.93].map(f => Math.round(D * f));
  let times = [null, null, null], how = "spread";

  if (tw) {
    const expected = D * 2.6; // ~155 words per minute
    const complete = tw.length > expected * 0.75;
    const secPerWord = complete ? D / tw.length : 1 / 2.6;
    const stems = tw.map(stem);
    l.quiz.forEach((q, qi) => {
      const kw = new Map();
      words(q.a[0]).forEach(w => kw.set(stem(w), 2));
      words(q.q).forEach(w => { const s = stem(w); if (!kw.has(s)) kw.set(s, 1); });
      const total = [...kw.values()].reduce((a, b) => a + b, 0);
      if (!total) return;
      let best = 0, bestEnd = -1; const W = 70;
      for (let i = 0; i < stems.length; i += 10) {
        const seen = new Set(); let sc = 0;
        for (let j = i; j < Math.min(stems.length, i + W); j++) { const v = kw.get(stems[j]); if (v && !seen.has(stems[j])) { seen.add(stems[j]); sc += v; } }
        if (sc > best) { best = sc; bestEnd = Math.min(stems.length, i + W); }
      }
      if (bestEnd > 0 && best >= Math.max(2, total * 0.4)) {
        times[qi] = Math.round(bestEnd * secPerWord + 4);
        stats.qText++;
      }
    });
    if (times.some(t => t != null)) how = "text";
  }
  if (how === "spread" && ch) {
    l.quiz.forEach((q, qi) => {
      const kw = new Set(words(q.a[0] + " " + q.q).map(stem)); let best = 0, bi = -1;
      ch.forEach((c, ci) => { const sc = words(c.title).map(stem).filter(s => kw.has(s)).length; if (sc > best) { best = sc; bi = ci; } });
      if (bi >= 0) { const end = ch[bi + 1] ? ch[bi + 1].t : D; times[qi] = Math.max(ch[bi].t + 20, end - 3); }
    });
    if (times.some(t => t != null)) how = "chapters";
  }
  // fill gaps, keep inside the video, keep questions 20s apart
  times = times.map((t, i) => { if (t == null) { stats.qFallback++; return spread[i]; } return t; })
    .map(t => Math.min(Math.max(t, Math.round(D * 0.12)), Math.round(D * 0.96)));
  const order = times.map((t, i) => [t, i]).sort((a, b) => a[0] - b[0]);
  for (let k = 1; k < order.length; k++) if (order[k][0] - order[k - 1][0] < 20) order[k][0] = Math.min(order[k - 1][0] + 20, Math.round(D * 0.98));
  order.forEach(([t, i]) => (times[i] = t));
  stats[how]++;
  out[l.id] = { t: times, how };
})));
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(JSON.stringify(stats));
