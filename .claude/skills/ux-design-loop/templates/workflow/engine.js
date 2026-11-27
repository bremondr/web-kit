(function () {
  var D = window.UXL_DATA || {};
  var LANG = D.lang === "cs" ? "cs" : "en";
  var I18N = {
    en: { loading: "loading…", local: "saved in this browser only", saving: "saving…", saved: "saved", noStore: "nothing stored yet", cantSave: "cannot save to the shared store; kept in this browser only", cantRead: "cannot read the shared store; kept in this browser only", notYet: "shared data not reachable yet",
      show: "Show", reset: "Reset to proposal", resetConfirm: "Click again to reset everything", stage: "Stage", addStage: "+ Add stage", moveL: "Move stage left", moveR: "Move stage right", insBefore: "+ before", del: "Delete", sure: "Sure?",
      newStage: "New stage", addFeature: "+ Add feature…", newFeature: "New feature…", untitled: "(untitled)", noFeatures: "No features yet. Use “+ Add feature…” in any stage.", name: "Feature name", phase: "Phase", ref: "Issue reference",
      desc: "What it does", notes: "Notes", usedIn: "Used in", noStageYet: "no stage yet", openIssue: "Open issue ", delFeature: "Delete feature everywhere", removeFrom: "Remove from stage ", stageName: "Stage name", scoreNone: "–", edit: "click to edit" },
    cs: { loading: "načítání…", local: "uloženo jen v tomto prohlížeči", saving: "ukládání…", saved: "uloženo", noStore: "zatím nic uloženo", cantSave: "nelze uložit do sdíleného úložiště; drženo jen v tomto prohlížeči", cantRead: "nelze číst sdílené úložiště; drženo jen v tomto prohlížeči", notYet: "sdílená data zatím nedostupná",
      show: "Zobrazit", reset: "Obnovit návrh", resetConfirm: "Klikněte znovu pro obnovení všeho", stage: "Fáze procesu", addStage: "+ Přidat krok", moveL: "Posunout krok doleva", moveR: "Posunout krok doprava", insBefore: "+ před", del: "Smazat", sure: "Opravdu?",
      newStage: "Nový krok", addFeature: "+ Přidat funkci…", newFeature: "Nová funkce…", untitled: "(bez názvu)", noFeatures: "Zatím žádné funkce. Použijte „+ Přidat funkci…“ v libovolném kroku.", name: "Název funkce", phase: "Fáze", ref: "Odkaz na issue",
      desc: "Co dělá", notes: "Poznámky", usedIn: "Použito v", noStageYet: "zatím v žádném kroku", openIssue: "Otevřít issue ", delFeature: "Smazat funkci všude", removeFrom: "Odebrat z kroku ", stageName: "Název kroku", scoreNone: "–", edit: "klikněte pro úpravu" }
  };
  var T = I18N[LANG];
  var PHASES = (D.phases || []).map(function (p, i) { return { id: p.id, label: p.label || p.id, color: p.color || "c" + ((i % 8) + 1) }; });
  var phById = {}; PHASES.forEach(function (p) { phById[p.id] = p; });
  var ROWS = D.rows || [{ key: "who", label: "Who", kind: "text" }, { key: "today", label: "Today", kind: "text" }, { kind: "features", label: "Features" }, { key: "notes", label: "Notes", kind: "text" }];
  var SCORES = D.scores || [];
  var FLAG = D.flagLabel || "";
  var BASE = D.issueBase || "";

  function defaults() {
    var feats = {};
    (D.features || []).forEach(function (f) { feats[String(f.id)] = { k: String(f.id), ref: f.ref || "", ph: f.ph || "", t: f.t || "", d: f.d || "", n: f.n || "", flag: !!f.flag, sc: (f.sc || []).slice(0, 3) }; });
    var n = 0;
    var stages = (D.stages || []).map(function (s) { n++; return { id: "s" + n, t: s.t || "", vals: s.vals || {}, f: (s.f || []).map(String) }; });
    return { v: 1, stages: stages, feats: feats, nextId: n + 1 };
  }
  var state = defaults();
  var active = {}; PHASES.forEach(function (p) { active[p.id] = true; }); active[""] = true;
  var selected = Object.keys(state.feats)[0] || "";
  var flow = document.getElementById("flow"), detail = document.getElementById("detail"), statusEl = document.getElementById("status");

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function uid(p) { return p + (state.nextId++); }
  function setStatus(t) { statusEl.textContent = t; }
  function phClass(p) { return "ph-" + (phById[p] ? phById[p].color : "none"); }
  function confirmClick(btn, label, fn) {
    var armed = false, orig = btn.textContent, timer;
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (!armed) { armed = true; btn.textContent = label; timer = setTimeout(function () { armed = false; btn.textContent = orig; }, 3000); return; }
      clearTimeout(timer); armed = false; btn.textContent = orig; fn();
    });
  }
  function editable(cls, value, placeholder, onCommit, label) {
    var d = el("div", "ed " + (cls || ""));
    d.contentEditable = "true"; d.spellcheck = false; d.setAttribute("role", "textbox"); d.setAttribute("aria-label", label);
    d.dataset.ph = placeholder; d.textContent = value;
    d.addEventListener("input", function () { onCommit(d.textContent); });
    d.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); d.blur(); } });
    d.addEventListener("paste", function (ev) { ev.preventDefault(); var t = (ev.clipboardData || window.clipboardData).getData("text").replace(/\s+/g, " "); document.execCommand("insertText", false, t); });
    return d;
  }
  var dragData = null;

  function newStage() { return { id: uid("s"), t: T.newStage, vals: {}, f: [] }; }

  function renderFlow() {
    flow.textContent = "";
    var st = state.stages, n = st.length;
    flow.style.gridTemplateColumns = "112px repeat(" + (n + 1) + ", 188px)";
    var all = [{ label: "", kind: "head" }].concat(ROWS);
    all.forEach(function (row, ri) {
      flow.appendChild(el("div", "c rl" + (ri === 0 ? " sh" : ""), row.label));
      st.forEach(function (s, si) {
        var c = el("div", "c" + (ri === 0 ? " sh" : ""));
        if (row.kind === "head") {
          var head = el("div", "shead");
          head.appendChild(el("span", "num", String(si + 1)));
          head.appendChild(editable("tt", s.t, T.stageName, function (v) { s.t = v; scheduleSave(); }, T.stageName));
          c.appendChild(head);
          var tools = el("div", "tools");
          var l = el("button", "mini", "◀"); l.type = "button"; l.setAttribute("aria-label", T.moveL); l.disabled = si === 0;
          l.addEventListener("click", function () { var t = st[si - 1]; st[si - 1] = s; st[si] = t; renderFlow(); renderDetail(); scheduleSave(); });
          var r = el("button", "mini", "▶"); r.type = "button"; r.setAttribute("aria-label", T.moveR); r.disabled = si === n - 1;
          r.addEventListener("click", function () { var t = st[si + 1]; st[si + 1] = s; st[si] = t; renderFlow(); renderDetail(); scheduleSave(); });
          var ins = el("button", "mini", T.insBefore); ins.type = "button";
          ins.addEventListener("click", function () { st.splice(si, 0, newStage()); renderFlow(); scheduleSave(); });
          var del = el("button", "mini danger", T.del); del.type = "button";
          confirmClick(del, T.sure, function () { st.splice(si, 1); renderFlow(); renderDetail(); scheduleSave(); });
          [l, r, ins, del].forEach(function (b) { tools.appendChild(b); });
          c.appendChild(tools);
        } else if (row.kind === "features") c.appendChild(chipCell(s));
        else if (row.kind === "level") {
          var levels = row.levels || ["none", "low", "medium", "high"], v = +s.vals[row.key] || 0;
          var p = el("div", "pain"); p.setAttribute("role", "group"); p.setAttribute("aria-label", row.label + ", " + (si + 1));
          for (var i = 1; i < levels.length; i++) (function (i) {
            var b = el("button", "dot" + (i <= v ? " on" : "")); b.type = "button"; b.setAttribute("aria-label", row.label + ": " + levels[i]);
            b.addEventListener("click", function () { s.vals[row.key] = v === i ? i - 1 : i; renderFlow(); scheduleSave(); });
            p.appendChild(b);
          })(i);
          p.appendChild(el("span", null, levels[v])); c.appendChild(p);
        } else c.appendChild(editable(row.cls || "", String(s.vals[row.key] || ""), row.placeholder || row.label, function (val) { s.vals[row.key] = val; scheduleSave(); }, row.label + ", " + (si + 1)));
        flow.appendChild(c);
      });
      var add = el("div", "c" + (ri === 0 ? " sh" : ""));
      if (ri === 0) {
        var ab = el("button", "addstage", T.addStage); ab.type = "button";
        ab.addEventListener("click", function () { st.push(newStage()); renderFlow(); scheduleSave(); }); add.appendChild(ab);
      }
      flow.appendChild(add);
    });
    paintChips();
  }

  function chipCell(s) {
    var wrap = el("div", "chips"); wrap.dataset.stage = s.id;
    wrap.addEventListener("dragover", function (ev) { if (dragData) { ev.preventDefault(); wrap.classList.add("over"); } });
    wrap.addEventListener("dragleave", function (ev) { if (!wrap.contains(ev.relatedTarget)) wrap.classList.remove("over"); });
    wrap.addEventListener("drop", function (ev) {
      ev.preventDefault(); wrap.classList.remove("over"); if (!dragData) return;
      var beforeEl = ev.target.closest && ev.target.closest(".chip");
      var beforeKey = beforeEl && beforeEl.parentNode === wrap ? beforeEl.dataset.k : null;
      var copy = ev.ctrlKey || ev.altKey;
      var src = state.stages.filter(function (x) { return x.id === dragData.from; })[0], key = dragData.k;
      if (src && !copy) src.f = src.f.filter(function (k) { return k !== key; });
      s.f = s.f.filter(function (k) { return k !== key; });
      var idx = beforeKey ? s.f.indexOf(beforeKey) : -1;
      if (idx < 0) s.f.push(key); else s.f.splice(idx, 0, key);
      dragData = null; renderFlow(); renderDetail(); scheduleSave();
    });
    s.f.forEach(function (k) {
      var f = state.feats[k]; if (!f) return;
      var b = el("button", "chip"); b.type = "button"; b.draggable = true; b.dataset.k = k; b.dataset.ph = f.ph;
      if (f.ref) b.appendChild(el("span", "n", f.ref));
      b.appendChild(el("span", "t", f.t || T.untitled));
      if (f.flag) b.appendChild(el("span", "flag", FLAG.slice(0, 2).toUpperCase()));
      b.addEventListener("click", function () { selected = k; paintChips(); renderDetail(); });
      b.addEventListener("dragstart", function (ev) { dragData = { k: k, from: s.id }; ev.dataTransfer.effectAllowed = "copyMove"; try { ev.dataTransfer.setData("text/plain", k); } catch (e) {} b.classList.add("drag"); });
      b.addEventListener("dragend", function () { dragData = null; b.classList.remove("drag"); });
      wrap.appendChild(b);
    });
    var sel = el("select", "addf"); sel.setAttribute("aria-label", T.addFeature);
    var o0 = el("option", null, T.addFeature); o0.value = ""; sel.appendChild(o0);
    var o1 = el("option", null, T.newFeature); o1.value = "__new"; sel.appendChild(o1);
    Object.keys(state.feats).filter(function (k) { return s.f.indexOf(k) < 0; }).forEach(function (k) {
      var f = state.feats[k]; var o = el("option", null, (f.ref ? f.ref + " " : "") + f.t); o.value = k; sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      var v = sel.value; if (!v) return;
      if (v === "__new") { var k = uid("c"); state.feats[k] = { k: k, ref: "", ph: PHASES[0] ? PHASES[0].id : "", t: T.newFeature.replace("…", ""), d: "", n: "", flag: false, sc: [] }; v = k; }
      s.f.push(v); selected = v; renderFlow(); renderDetail(); scheduleSave();
    });
    wrap.appendChild(sel);
    return wrap;
  }
  function paintChips() {
    flow.querySelectorAll(".chip").forEach(function (b) {
      b.className = "chip " + phClass(b.dataset.ph) + (b.dataset.k === selected ? " sel" : "") + (active[b.dataset.ph] !== false ? "" : " dim");
    });
    document.querySelectorAll(".flt").forEach(function (b) { b.setAttribute("aria-pressed", String(active[b.dataset.ph] !== false)); });
  }

  function field(label, node) { var w = el("label", "fld"); w.appendChild(el("span", null, label)); w.appendChild(node); return w; }
  function inputText(value, onIn) { var i = el("input"); i.type = "text"; i.value = value; i.addEventListener("input", function () { onIn(i.value); }); return i; }
  function area(value, onIn) { var t = el("textarea"); t.value = value; t.addEventListener("input", function () { onIn(t.value); }); return t; }
  function scoreSel(value, onCh, label) {
    var s = el("select"); s.setAttribute("aria-label", label);
    for (var i = 0; i <= 5; i++) { var o = el("option", null, i === 0 ? T.scoreNone : String(i)); o.value = String(i); s.appendChild(o); }
    s.value = String(value || 0); s.addEventListener("change", function () { onCh(+s.value); }); return s;
  }
  var chipTimer;
  function refreshChipsSoon() { clearTimeout(chipTimer); chipTimer = setTimeout(renderFlow, 250); }

  function renderDetail() {
    detail.textContent = "";
    var f = state.feats[selected];
    if (!f) { var any = Object.keys(state.feats)[0]; if (any) { selected = any; f = state.feats[any]; } }
    if (!f) { detail.appendChild(el("p", "note", T.noFeatures)); return; }
    var left = el("div", "col"), right = el("div", "col");
    left.appendChild(field(T.name, inputText(f.t, function (v) { f.t = v; refreshChipsSoon(); scheduleSave(); })));
    var row = el("div", "two");
    var ph = el("select"); var n0 = el("option", null, "–"); n0.value = ""; ph.appendChild(n0);
    PHASES.forEach(function (p) { var o = el("option", null, p.label); o.value = p.id; ph.appendChild(o); });
    ph.value = f.ph; ph.addEventListener("change", function () { f.ph = ph.value; renderFlow(); scheduleSave(); });
    row.appendChild(field(T.phase, ph)); row.appendChild(field(T.ref, inputText(f.ref, function (v) { f.ref = v; refreshChipsSoon(); scheduleSave(); })));
    left.appendChild(row);
    left.appendChild(field(T.desc, area(f.d, function (v) { f.d = v; scheduleSave(); })));
    right.appendChild(field(T.notes, area(f.n, function (v) { f.n = v; scheduleSave(); })));
    if (FLAG) {
      var fl = el("label", "chk"); var cb = el("input"); cb.type = "checkbox"; cb.checked = f.flag;
      cb.addEventListener("change", function () { f.flag = cb.checked; renderFlow(); scheduleSave(); });
      fl.appendChild(cb); fl.appendChild(el("span", null, FLAG)); right.appendChild(fl);
    }
    if (SCORES.length) {
      var sc = el("div", "scores");
      SCORES.slice(0, 3).forEach(function (name, i) { sc.appendChild(field(name, scoreSel((f.sc || [])[i], function (v) { f.sc = f.sc || []; f.sc[i] = v; scheduleSave(); }, name))); });
      right.appendChild(sc);
    }
    var used = el("div", "used"); used.appendChild(el("span", "lbl2", T.usedIn)); var any2 = false;
    state.stages.forEach(function (s, i) {
      if (s.f.indexOf(f.k) < 0) return; any2 = true;
      var b = el("button", "mini", (i + 1) + ". " + s.t + " ×"); b.type = "button"; b.setAttribute("aria-label", T.removeFrom + s.t);
      b.addEventListener("click", function () { s.f = s.f.filter(function (k) { return k !== f.k; }); renderFlow(); renderDetail(); scheduleSave(); });
      used.appendChild(b);
    });
    if (!any2) used.appendChild(el("span", "note", T.noStageYet));
    right.appendChild(used);
    var foot = el("div", "foot");
    if (BASE && /^#\d+$/.test(f.ref)) { var a = el("a", null, T.openIssue + f.ref); a.href = BASE + f.ref.slice(1); a.target = "_blank"; a.rel = "noopener"; foot.appendChild(a); }
    var del = el("button", "mini danger", T.delFeature); del.type = "button";
    confirmClick(del, T.sure, function () {
      delete state.feats[f.k]; state.stages.forEach(function (s) { s.f = s.f.filter(function (k) { return k !== f.k; }); });
      selected = Object.keys(state.feats)[0] || ""; renderFlow(); renderDetail(); scheduleSave();
    });
    foot.appendChild(del); right.appendChild(foot);
    detail.appendChild(left); detail.appendChild(right);
  }

  var STORE = (D.storage && D.storage.doc) || "workflow/main", LS = "uxl-wfl-" + STORE;
  var ref = null, lastJson = "", saveTimer = null, saving = false, dirty = false, loaded = false;
  function serialize() { return JSON.stringify(state); }
  function scheduleSave() {
    try { localStorage.setItem(LS, serialize()); } catch (e) {}
    if (!ref) { setStatus(T.local); return; }
    dirty = true; setStatus(T.saving); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 700);
  }
  function flush() {
    if (saving || !ref || !dirty) return;
    saving = true; dirty = false; var json = serialize(); lastJson = json;
    ref.set(JSON.parse(json)).then(function () { saving = false; if (dirty) { setStatus(T.saving); flush(); } else setStatus(T.saved); }, function () { saving = false; setStatus(T.cantSave); });
  }
  function sane(d) {
    if (!d || !Array.isArray(d.stages) || !d.feats || typeof d.feats !== "object") return null;
    var out = { v: 1, stages: [], feats: {}, nextId: Math.max(+d.nextId || 1, 1) };
    Object.keys(d.feats).forEach(function (k) {
      var f = d.feats[k] || {};
      out.feats[k] = { k: k, ref: String(f.ref || ""), ph: phById[f.ph] ? f.ph : "", t: String(f.t || ""), d: String(f.d || ""), n: String(f.n || ""), flag: !!f.flag, sc: Array.isArray(f.sc) ? f.sc.slice(0, 3).map(function (x) { return +x || 0; }) : [] };
    });
    d.stages.forEach(function (s, i) {
      var vals = {}; if (s.vals && typeof s.vals === "object") Object.keys(s.vals).forEach(function (k) { vals[k] = typeof s.vals[k] === "number" ? s.vals[k] : String(s.vals[k]); });
      out.stages.push({ id: String(s.id || "s" + (100 + i)), t: String(s.t || ""), vals: vals, f: (Array.isArray(s.f) ? s.f : []).map(String).filter(function (k) { return out.feats[k]; }) });
    });
    return out;
  }
  function applyData(d) { var ok = sane(d); if (!ok) return false; state = ok; if (!state.feats[selected]) selected = Object.keys(state.feats)[0] || ""; return true; }
  function editingNow() { var a = document.activeElement; return a && (a.isContentEditable || a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT"); }

  document.title = D.title || document.title;
  document.getElementById("title").textContent = D.title || ""; document.getElementById("subtitle").textContent = D.subtitle || "";
  document.getElementById("show").textContent = T.show;
  var bar = document.getElementById("filters");
  PHASES.forEach(function (p) {
    var b = el("button", "flt " + "ph-" + p.color); b.type = "button"; b.dataset.ph = p.id; b.setAttribute("aria-pressed", "true");
    b.appendChild(el("i")); b.appendChild(document.createTextNode(p.label));
    b.addEventListener("click", function () { active[p.id] = active[p.id] === false; paintChips(); }); bar.appendChild(b);
  });
  var rb = document.getElementById("reset"); rb.textContent = T.reset;
  confirmClick(rb, T.resetConfirm, function () { state = defaults(); selected = Object.keys(state.feats)[0] || ""; renderFlow(); renderDetail(); scheduleSave(); });

  try { var raw = localStorage.getItem(LS); if (raw) applyData(JSON.parse(raw)); } catch (e) {}
  renderFlow(); renderDetail(); setStatus(T.loading);
  var done = setTimeout(function () { if (!loaded) setStatus(ref ? T.notYet : T.local); }, 10000);
  Promise.resolve(window.claude && window.claude.use ? window.claude.use("db") : null).then(function (db) {
    if (!db) { clearTimeout(done); setStatus(T.local); return; }
    ref = db.doc(STORE);
    ref.onSnapshot(function (snap) {
      loaded = true; clearTimeout(done);
      if (!snap.exists) { setStatus(T.noStore); return; }
      var json = JSON.stringify(snap.data());
      if (!saving && !dirty && !editingNow() && json !== lastJson) {
        lastJson = json; var before = serialize();
        if (applyData(snap.data()) && serialize() !== before) { renderFlow(); renderDetail(); }
      }
      setStatus(T.saved);
    }, function () { setStatus(T.cantRead); });
  }, function () { setStatus(T.local); });
})();
