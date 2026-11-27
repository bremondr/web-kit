(function () {
  var D = window.UXL_DATA || {};
  var LANG = D.lang === "cs" ? "cs" : "en";
  var I18N = {
    en: {
      reset: "Reset this screen", resetConfirm: "Click again to reset this screen", loading: "loading…", local: "saved in this browser only", saving: "saving…", saved: "saved",
      noStore: "nothing stored yet", cantSave: "cannot save to the shared store; kept in this browser only", cantRead: "cannot read the shared store; kept in this browser only", notYet: "shared data not reachable yet",
      tray: "Outside the plan: park blocks you don't want on this screen", selected: "Selected block", toDecide: "To decide: ", note: "Note on this decision", phase: "Phase", noPhase: "(none)",
      park: "Park outside the plan", unpark: "Return to plan", keys: "Keys on a selected block: arrows move (Shift for a bigger step), k keep, l later, m maybe, x drop, p park.",
      outside: "Outside the plan", decisions: "Decisions on this screen", phases: "Phases and milestones", milestone: "Milestone / tracker label", snapshots: "Snapshots", snapName: "Snapshot name",
      snapSave: "Save snapshot", snapRestore: "Restore", snapNone: "No snapshots yet", snapRestoreConfirm: "Restore this snapshot? Click again", legendHint: "Click the badge in a block header to cycle the decision.",
      kinds: { page: "page", modal: "modal", drawer: "drawer", state: "state" }, trigger: "Opened by", laterHint: "Later: the prototype shows an empty placeholder of this size.",
      dec: { u: "Undecided", k: "Keep", l: "Later", m: "Maybe", x: "Drop" }, badge: { u: "?", k: "keep", l: "later", m: "maybe", x: "drop" }, inPhase: "in", counted: "kept + later per phase"
    },
    cs: {
      reset: "Obnovit tuto obrazovku", resetConfirm: "Klikněte znovu pro obnovení obrazovky", loading: "načítání…", local: "uloženo jen v tomto prohlížeči", saving: "ukládání…", saved: "uloženo",
      noStore: "zatím nic uloženo", cantSave: "nelze uložit do sdíleného úložiště; drženo jen v tomto prohlížeči", cantRead: "nelze číst sdílené úložiště; drženo jen v tomto prohlížeči", notYet: "sdílená data zatím nedostupná",
      tray: "Mimo plán: sem odložte bloky, které na této obrazovce nechcete", selected: "Vybraný blok", toDecide: "K rozhodnutí: ", note: "Poznámka k rozhodnutí", phase: "Fáze", noPhase: "(žádná)",
      park: "Odložit mimo plán", unpark: "Vrátit do plánu", keys: "Klávesy na vybraném bloku: šipky posouvají (Shift = větší krok), k ponechat, l později, m možná, x vyřadit, p odložit.",
      outside: "Mimo plán", decisions: "Rozhodnutí na této obrazovce", phases: "Fáze a milníky", milestone: "Milník / štítek v trackeru", snapshots: "Snímky", snapName: "Název snímku",
      snapSave: "Uložit snímek", snapRestore: "Obnovit", snapNone: "Zatím žádné snímky", snapRestoreConfirm: "Obnovit tento snímek? Klikněte znovu", legendHint: "Kliknutím na štítek v záhlaví bloku přepnete rozhodnutí.",
      kinds: { page: "stránka", modal: "modál", drawer: "panel", state: "stav" }, trigger: "Otevírá", laterHint: "Později: prototyp ukáže prázdný zástupný blok této velikosti.",
      dec: { u: "Nerozhodnuto", k: "Ponechat", l: "Později", m: "Možná", x: "Vyřadit" }, badge: { u: "?", k: "ponech", l: "později", m: "možná", x: "vyřaď" }, inPhase: "ve fázi", counted: "ponechat + později podle fáze"
    }
  };
  var T = I18N[LANG];

  var ST = D.stage || {};
  var GRID = ST.grid || 10, MIN_W = ST.minW || 100, MIN_H = ST.minH || 40, PARK = ST.park || 900;
  var DEC_ORDER = ["u", "k", "l", "m", "x"], DEC_CLASS = { u: "u", k: "keep", l: "later", m: "maybe", x: "drop" }, KEYS = { k: "k", l: "l", m: "m", x: "x" };
  var PHASES = (D.phases || []).map(function (p, i) { return { id: p.id, label: p.label || p.id, milestone: p.milestone || "", color: p.color || "c" + ((i % 8) + 1) }; });
  var phaseById = {}; PHASES.forEach(function (p) { phaseById[p.id] = p; });

  var TABS = (D.tabs || []).map(function (t) {
    var vp = t.viewport || {};
    var w = vp.w || ST.w || 1200, vh = vp.h || ST.h || 780;
    return { id: t.id, label: t.label, kind: t.kind || "page", variant: t.variant || "", parent: t.parent || "", trigger: t.trigger || "", context: t.context || [], blocks: t.blocks || [], W: w, VH: vh, H: vh + PARK };
  });
  var tabById = {}, E = [], byId = {};
  TABS.forEach(function (t) { tabById[t.id] = t; t.blocks.forEach(function (b) { b.s = t.id; E.push(b); byId[b.id] = b; }); });

  var state = { v: 2, tab: TABS[0] && TABS[0].id, els: {}, phases: {} };
  var selected = {}; TABS.forEach(function (t) { selected[t.id] = t.blocks[0] && t.blocks[0].id; });
  var dragging = false;

  function phaseOf(id) { var s = state.els[id]; var p = s && s.p != null ? s.p : byId[id].phase; return p || ""; }
  function phLabel(id) { var p = phaseById[id]; return p ? ((state.phases[id] && state.phases[id].label) || p.label) : T.noPhase; }
  function defaults() { var els = {}; E.forEach(function (e) { els[e.id] = { x: e.g[0], y: e.g[1], w: e.g[2], h: e.g[3], d: "u", n: "" }; }); return els; }
  state.els = defaults();
  PHASES.forEach(function (p) { state.phases[p.id] = { label: p.label, milestone: p.milestone }; });

  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage"), stagebox = $("stagebox"), scaler = $("scaler"), statusEl = $("status");
  var nodes = {}, scale = 1;
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function snap(v) { return Math.round(v / GRID) * GRID; }
  function dim(id) { return tabById[byId[id].s]; }
  function isParked(id, s) { return s.y + s.h / 2 >= dim(id).VH; }
  function cur() { return selected[state.tab]; }
  function tabNow() { return tabById[state.tab]; }

  function parkSlot(id, w, h) {
    var t = dim(id);
    var others = E.filter(function (e) { return e.id !== id && e.s === t.id && isParked(e.id, state.els[e.id]); }).map(function (e) { return state.els[e.id]; });
    for (var y = t.VH + 20; y + h <= t.H - 10; y += 20)
      for (var x = 20; x + w <= t.W - 10; x += 20) {
        var hit = others.some(function (o) { return x < o.x + o.w + 10 && x + w + 10 > o.x && y < o.y + o.h + 10 && y + h + 10 > o.y; });
        if (!hit) return [x, y];
      }
    return [20, t.VH + 20];
  }
  function park(id) {
    var s = state.els[id]; if (isParked(id, s)) return;
    s.pr = [s.x, s.y, s.w, s.h];
    var slot = parkSlot(id, s.w, s.h); s.x = slot[0]; s.y = slot[1]; selected[byId[id].s] = id; paint(); scheduleSave();
  }
  function unpark(id) {
    var s = state.els[id]; if (!isParked(id, s)) return; var g = byId[id].g, p = s.pr;
    if (p && !isParked(id, { y: p[1], h: p[3] })) { s.x = p[0]; s.y = p[1]; s.w = p[2]; s.h = p[3]; } else { s.x = g[0]; s.y = g[1]; s.w = g[2]; s.h = g[3]; }
    delete s.pr; selected[byId[id].s] = id; paint(); scheduleSave();
  }

  function build() {
    TABS.forEach(function (t) {
      var tray = el("div", "tray"); tray.dataset.tab = t.id; tray.style.top = t.VH + "px"; tray.style.width = t.W + "px"; tray.style.height = (t.H - t.VH) + "px";
      tray.appendChild(el("span", null, T.tray)); stage.appendChild(tray); t.tray = tray;
    });
    E.forEach(function (e) {
      var b = el("div", "blk"); b.tabIndex = 0;
      var h = el("div", "bh"); h.appendChild(el("span", "t", e.title));
      if (e.tag) h.appendChild(el("span", "tag", e.tag));
      var badge = el("button", "badge", "?"); badge.type = "button"; badge.setAttribute("aria-label", T.selected + ": " + e.title); h.appendChild(badge);
      var body = el("div", "bb"); body.innerHTML = e.html || "";
      var rz = el("div", "rz"); rz.setAttribute("aria-hidden", "true");
      b.appendChild(h); b.appendChild(body); b.appendChild(rz); stage.appendChild(b); nodes[e.id] = { b: b, badge: badge, h: h };
      badge.addEventListener("click", function (ev) { ev.stopPropagation(); var d = state.els[e.id].d; setDecision(e.id, DEC_ORDER[(DEC_ORDER.indexOf(d) + 1) % DEC_ORDER.length]); });
      badge.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); });
      b.addEventListener("pointerdown", function (ev) { if (ev.target === rz) startResize(ev, e.id); else startDrag(ev, e.id); });
      b.addEventListener("keydown", function (ev) { onKey(ev, e.id); });
    });
    var tabs = $("tabs");
    TABS.forEach(function (t) {
      var b = el("button", "tab"); b.type = "button"; b.dataset.tab = t.id; b.appendChild(el("span", null, t.label));
      var meta = [T.kinds[t.kind] || t.kind, t.variant].filter(Boolean).join(" · ");
      if (t.kind !== "page" || t.variant) b.appendChild(el("small", null, meta));
      b.addEventListener("click", function () { state.tab = t.id; paint(); fit(); scheduleSave(); }); tabs.appendChild(b);
    });
  }

  function paint() {
    E.forEach(function (e) {
      var s = state.els[e.id], n = nodes[e.id], vis = e.s === state.tab;
      n.b.hidden = !vis;
      n.b.style.left = s.x + "px"; n.b.style.top = s.y + "px"; n.b.style.width = s.w + "px"; n.b.style.height = s.h + "px";
      n.b.className = "blk d-" + DEC_CLASS[s.d] + (isParked(e.id, s) ? " parked" : "") + (cur() === e.id ? " sel" : "") + (dragging === e.id ? " dragging" : "");
      n.badge.textContent = T.badge[s.d];
      var tag = n.h.querySelector(".tag"); if (tag) tag.className = "tag ph-" + phColor(e.id);
    });
    TABS.forEach(function (t) { t.tray.hidden = t.id !== state.tab; });
    document.querySelectorAll(".tab").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.tab === state.tab)); });
    renderCtx(); renderInspector(); renderSummary(); renderPhases();
  }
  function phColor(id) { return phColor2(phaseOf(id)); }
  function phColor2(p) { return p && phaseById[p] ? phaseById[p].color : "none"; }

  function fit() {
    var t = tabNow(); if (!t) return;
    scale = Math.max(0.35, Math.min(1, stagebox.clientWidth / t.W));
    stage.style.width = t.W + "px"; stage.style.height = t.H + "px";
    stage.style.transform = "scale(" + scale + ")"; scaler.style.width = t.W * scale + "px"; scaler.style.height = t.H * scale + "px";
  }

  function startDrag(ev, id) {
    if (ev.button !== undefined && ev.button !== 0) return;
    selected[byId[id].s] = id; var s = state.els[id], t = dim(id);
    var sx = ev.clientX, sy = ev.clientY, ox = s.x, oy = s.y, moved = false, node = nodes[id].b; node.setPointerCapture(ev.pointerId);
    function move(e) {
      var dx = (e.clientX - sx) / scale, dy = (e.clientY - sy) / scale;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true; dragging = id; s.x = clamp(snap(ox + dx), 0, t.W - s.w); s.y = clamp(snap(oy + dy), 0, t.H - s.h); paint();
    }
    function up() { node.removeEventListener("pointermove", move); node.removeEventListener("pointerup", up); node.removeEventListener("pointercancel", up); dragging = false; paint(); if (moved) scheduleSave(); }
    node.addEventListener("pointermove", move); node.addEventListener("pointerup", up); node.addEventListener("pointercancel", up); paint();
  }
  function startResize(ev, id) {
    ev.stopPropagation(); selected[byId[id].s] = id; var s = state.els[id], t = dim(id);
    var sx = ev.clientX, sy = ev.clientY, ow = s.w, oh = s.h, moved = false, node = nodes[id].b; node.setPointerCapture(ev.pointerId);
    function move(e) { moved = true; s.w = clamp(snap(ow + (e.clientX - sx) / scale), MIN_W, t.W - s.x); s.h = clamp(snap(oh + (e.clientY - sy) / scale), MIN_H, t.H - s.y); paint(); }
    function up() { node.removeEventListener("pointermove", move); node.removeEventListener("pointerup", up); node.removeEventListener("pointercancel", up); if (moved) scheduleSave(); }
    node.addEventListener("pointermove", move); node.addEventListener("pointerup", up); node.addEventListener("pointercancel", up); paint();
  }
  function onKey(ev, id) {
    if (ev.target !== nodes[id].b) return;
    var s = state.els[id], t = dim(id), step = ev.shiftKey ? 4 * GRID : GRID, handled = true;
    if (ev.key === "ArrowLeft") s.x = clamp(s.x - step, 0, t.W - s.w);
    else if (ev.key === "ArrowRight") s.x = clamp(s.x + step, 0, t.W - s.w);
    else if (ev.key === "ArrowUp") s.y = clamp(s.y - step, 0, t.H - s.h);
    else if (ev.key === "ArrowDown") s.y = clamp(s.y + step, 0, t.H - s.h);
    else if (KEYS[ev.key]) return setDecision(id, ev.key);
    else if (ev.key === "p") { if (isParked(id, s)) unpark(id); else park(id); return; }
    else handled = false;
    if (handled) { ev.preventDefault(); selected[byId[id].s] = id; paint(); scheduleSave(); }
  }
  function setDecision(id, d) { state.els[id].d = d; selected[byId[id].s] = id; paint(); scheduleSave(); }

  function renderCtx() {
    var box = $("ctx"), t = tabNow(); box.textContent = "";
    var items = t.context.slice();
    if (t.trigger) items.unshift({ k: T.trigger, v: t.trigger });
    box.hidden = !items.length;
    items.forEach(function (c) { var d = el("div"); d.appendChild(el("b", null, c.k)); d.appendChild(document.createTextNode(c.v)); box.appendChild(d); });
  }
  function renderInspector() {
    var box = $("inspector"), id = cur(); box.textContent = "";
    if (!id) return;
    var e = byId[id], s = state.els[id];
    box.appendChild(el("h2", null, T.selected)); box.appendChild(el("h3", null, e.title));
    var meta = el("div", "meta"); if (e.tag) meta.appendChild(el("span", "tag ph-" + phColor(id), e.tag)); box.appendChild(meta);
    if (e.desc) box.appendChild(el("p", "muted", e.desc));
    if (e.q) box.appendChild(el("div", "question", T.toDecide + e.q));
    var dec = el("div", "dec");
    DEC_ORDER.forEach(function (k) {
      var bt = el("button", DEC_CLASS[k], T.dec[k]); bt.type = "button"; bt.setAttribute("aria-pressed", String(s.d === k)); bt.addEventListener("click", function () { setDecision(id, k); }); dec.appendChild(bt);
    });
    box.appendChild(dec);
    if (s.d === "l") box.appendChild(el("p", "muted", T.laterHint));
    if (PHASES.length) {
      var f = el("label", "fld"); f.appendChild(el("span", null, T.phase));
      var sel = el("select"); var o0 = el("option", null, T.noPhase); o0.value = ""; sel.appendChild(o0);
      PHASES.forEach(function (p) { var o = el("option", null, phLabel(p.id) + (state.phases[p.id].milestone ? " · " + state.phases[p.id].milestone : "")); o.value = p.id; sel.appendChild(o); });
      sel.value = phaseOf(id); sel.addEventListener("change", function () { state.els[id].p = sel.value; paint(); scheduleSave(); });
      f.appendChild(sel); box.appendChild(f);
    }
    var pk = el("button", null, isParked(id, s) ? T.unpark : T.park); pk.type = "button";
    pk.addEventListener("click", function () { if (isParked(id, state.els[id])) unpark(id); else park(id); }); box.appendChild(pk);
    var ta = el("textarea"); ta.placeholder = T.note; ta.value = s.n; ta.setAttribute("aria-label", T.note + ": " + e.title);
    ta.addEventListener("input", function () { state.els[id].n = ta.value; scheduleSave(); }); box.appendChild(ta);
    box.appendChild(el("p", "muted", T.keys));
  }
  function renderSummary() {
    var box = $("summary"); box.textContent = "";
    var list = E.filter(function (e) { return e.s === state.tab; });
    function row(label, items) {
      var r = el("div"); r.appendChild(el("b", null, label + " (" + items.length + ")"));
      items.forEach(function (e) { var bt = el("button", null, e.title); bt.type = "button"; bt.addEventListener("click", function () { selected[state.tab] = e.id; paint(); }); r.appendChild(bt); });
      box.appendChild(r);
    }
    row(T.outside, list.filter(function (e) { return isParked(e.id, state.els[e.id]); }));
    DEC_ORDER.slice(1).concat(["u"]).forEach(function (k) { row(T.dec[k], list.filter(function (e) { return state.els[e.id].d === k; })); });
  }
  function renderPhases() {
    var panel = $("phasepanel"); panel.hidden = !PHASES.length; if (!PHASES.length) return;
    if (editingNow() && panel.contains(document.activeElement)) { updateCounts(); return; }
    var box = $("phases"); box.textContent = "";
    PHASES.forEach(function (p) {
      var r = el("div", "phrow"); var nm = el("span", "tag ph-" + p.color, p.id);
      var lab = el("input"); lab.type = "text"; lab.value = state.phases[p.id].label; lab.setAttribute("aria-label", T.phase + " " + p.id);
      lab.addEventListener("input", function () { state.phases[p.id].label = lab.value; scheduleSave(); });
      var ms = el("input"); ms.type = "text"; ms.value = state.phases[p.id].milestone; ms.placeholder = T.milestone; ms.setAttribute("aria-label", T.milestone + " " + p.id);
      ms.addEventListener("input", function () { state.phases[p.id].milestone = ms.value; scheduleSave(); });
      var cnt = el("small", "cnt"); cnt.dataset.p = p.id;
      r.appendChild(nm); r.appendChild(lab); r.appendChild(ms); r.appendChild(cnt); box.appendChild(r);
    });
    box.appendChild(el("p", "muted", T.counted)); updateCounts();
  }
  function updateCounts() {
    document.querySelectorAll("#phases .cnt").forEach(function (c) {
      var n = E.filter(function (e) { var d = state.els[e.id].d; return phaseOf(e.id) === c.dataset.p && (d === "k" || d === "l"); }).length; c.textContent = String(n);
    });
  }

  var snapRef = null, snaps = [], armedSnap = null;
  function renderSnaps() {
    var box = $("snaplist"); box.textContent = "";
    if (!snaps.length) box.appendChild(el("p", "muted", T.snapNone));
    snaps.slice().reverse().forEach(function (sn) {
      var r = el("div", "snaprow"); r.appendChild(el("span", null, sn.name + " · " + new Date(sn.at).toLocaleString(LANG)));
      var b = el("button", "mini", T.snapRestore); b.type = "button";
      b.addEventListener("click", function () {
        if (armedSnap !== sn.at) { armedSnap = sn.at; b.textContent = T.snapRestoreConfirm; return; }
        armedSnap = null; apply({ tab: state.tab, els: sn.els, phases: sn.phases }); paint(); scheduleSave();
      });
      r.appendChild(b); box.appendChild(r);
    });
  }
  function saveSnapshot() {
    var inp = $("snapname"), name = inp.value.trim() || ("v" + (snaps.length + 1));
    snaps.push({ name: name, at: Date.now(), els: JSON.parse(JSON.stringify(state.els)), phases: JSON.parse(JSON.stringify(state.phases)) });
    if (snaps.length > 20) snaps = snaps.slice(-20);
    inp.value = ""; renderSnaps();
    try { localStorage.setItem(LS + "-snaps", JSON.stringify(snaps)); } catch (e) {}
    if (snapRef) snapRef.set({ v: 1, list: snaps }).catch(function () { setStatus(T.cantSave); });
  }

  var STORE = (D.storage && D.storage.doc) || "wireframe/main";
  var LS = "uxl-wf-" + STORE;
  var ref = null, lastJson = "", saveTimer = null, saving = false, dirty = false, loaded = false;
  function serialize() { return JSON.stringify({ v: 2, tab: state.tab, els: state.els, phases: state.phases }); }
  function setStatus(t) { statusEl.textContent = t; }
  function scheduleSave() {
    try { localStorage.setItem(LS, serialize()); } catch (e) {}
    if (!ref) { setStatus(T.local); return; }
    dirty = true; setStatus(T.saving); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 700);
  }
  function flush() {
    if (saving || !ref || !dirty) return;
    saving = true; dirty = false; var json = serialize(); lastJson = json;
    ref.set(JSON.parse(json)).then(function () { saving = false; if (dirty) { setStatus(T.saving); flush(); } else setStatus(T.saved); },
      function () { saving = false; setStatus(T.cantSave); });
  }
  function apply(data) {
    if (!data || !data.els) return;
    if (data.tab && tabById[data.tab]) state.tab = data.tab;
    E.forEach(function (e) {
      var s = data.els[e.id]; if (!s) return; var c = state.els[e.id], t = dim(e.id);
      c.w = clamp(+s.w || MIN_W, MIN_W, t.W); c.h = clamp(+s.h || MIN_H, MIN_H, t.H);
      c.x = clamp(+s.x || 0, 0, t.W - c.w); c.y = clamp(+s.y || 0, 0, t.H - c.h);
      c.d = T.dec[s.d] ? s.d : "u"; c.n = typeof s.n === "string" ? s.n : "";
      if (Array.isArray(s.pr)) c.pr = s.pr.slice(0, 4); else delete c.pr;
      if (typeof s.p === "string") c.p = s.p; else delete c.p;
    });
    if (data.phases) PHASES.forEach(function (p) { var q = data.phases[p.id]; if (q) state.phases[p.id] = { label: String(q.label || p.label), milestone: String(q.milestone || "") }; });
  }
  function editingNow() { var a = document.activeElement; return a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT" || a.tagName === "SELECT"); }

  var rb = $("reset"), armed = false, tm;
  rb.textContent = T.reset;
  rb.addEventListener("click", function () {
    if (!armed) { armed = true; rb.textContent = T.resetConfirm; tm = setTimeout(function () { armed = false; rb.textContent = T.reset; }, 3000); return; }
    clearTimeout(tm); armed = false; rb.textContent = T.reset;
    E.filter(function (e) { return e.s === state.tab; }).forEach(function (e) { var d = state.els[e.id]; state.els[e.id] = { x: e.g[0], y: e.g[1], w: e.g[2], h: e.g[3], d: d.d, n: d.n }; });
    paint(); scheduleSave();
  });
  window.addEventListener("resize", fit);

  document.title = D.title || document.title;
  $("title").textContent = D.title || ""; $("subtitle").textContent = D.subtitle || "";
  $("legend").textContent = T.legendHint;
  $("t-decisions").textContent = T.decisions; $("t-phases").textContent = T.phases; $("t-snaps").textContent = T.snapshots;
  $("snapname").placeholder = T.snapName; $("snapsave").textContent = T.snapSave; $("snapsave").addEventListener("click", saveSnapshot);

  build();
  try { var raw = localStorage.getItem(LS); if (raw) apply(JSON.parse(raw)); var rs = localStorage.getItem(LS + "-snaps"); if (rs) snaps = JSON.parse(rs) || []; } catch (e) {}
  paint(); fit(); renderSnaps(); setStatus(T.loading);
  var done = setTimeout(function () { if (!loaded) setStatus(ref ? T.notYet : T.local); }, 10000);
  Promise.resolve(window.claude && window.claude.use ? window.claude.use("db") : null).then(function (db) {
    if (!db) { clearTimeout(done); setStatus(T.local); return; }
    ref = db.doc(STORE); snapRef = db.doc(STORE.replace(/[^/]*$/, "snapshots"));
    snapRef.onSnapshot(function (snap) { if (snap.exists && snap.data() && Array.isArray(snap.data().list)) { snaps = snap.data().list; renderSnaps(); } }, function () {});
    ref.onSnapshot(function (snap) {
      loaded = true; clearTimeout(done);
      if (!snap.exists) { setStatus(T.noStore); return; }
      var json = JSON.stringify(snap.data());
      if (!dragging && !saving && !dirty && !editingNow() && json !== lastJson) { lastJson = json; var before = serialize(); apply(snap.data()); if (serialize() !== before) { paint(); fit(); } }
      setStatus(T.saved);
    }, function () { setStatus(T.cantRead); });
  }, function () { setStatus(T.local); });
})();
