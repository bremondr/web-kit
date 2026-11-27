(function () {
  var D = window.UXL_DATA || {};
  var LANG = D.lang === "cs" ? "cs" : "en";
  var I18N = {
    en: { back: "Back", hot: "Show clickable areas", protoOnly: "Prototype only", notApp: "Not part of the app design:", reset: "Reset prototype", pagesLabel: "Screen", viewport: "Viewport", later: "Later", placeholder: "placeholder, not built yet", kinds: { page: "page", modal: "modal", drawer: "drawer", state: "state" }, close: "Close", viewport: "Viewport", pages: "Pages", empty: "No pages in the prototype data." },
    cs: { back: "Zpět", hot: "Zvýraznit klikací plochy", protoOnly: "Pouze prototyp", notApp: "Není součástí návrhu aplikace:", reset: "Obnovit prototyp", pagesLabel: "Obrazovka", viewport: "Zobrazení", later: "Později", placeholder: "zástupný blok, zatím se nevyvíjí", kinds: { page: "stránka", modal: "modál", drawer: "panel", state: "stav" }, close: "Zavřít", viewport: "Zobrazení", pages: "Stránky", empty: "V datech prototypu nejsou žádné stránky." }
  };
  var T = I18N[LANG];
  var PAGES = D.pages || [], byId = {};
  PAGES.forEach(function (p) { p.kind = p.kind || "page"; p.vp = p.viewport || {}; p.W = p.vp.w || 1200; p.H = p.vp.h || 780; byId[p.id] = p; });
  var VERS = (D.versions || []).filter(function (v) { return v && v.id && v.options && v.options.length; });
  var ver = {}; VERS.forEach(function (v) { ver[v.id] = v.default || v.options[0].id; });
  function visible(x) { var w = x.when; if (!w) return true; return Object.keys(w).every(function (k) { return ver[k] === w[k]; }); }
  var variants = []; PAGES.forEach(function (p) { if (p.kind === "page" && p.variant && variants.indexOf(p.variant) < 0) variants.push(p.variant); });
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  var variant = variants[0] || "", pageId = null, overlays = [], history = [], hot = false;
  var stagebox = $("stagebox"), scaler = $("scaler"), stage = $("stage");

  function pagesFor(v) { return PAGES.filter(function (p) { return p.kind === "page" && visible(p) && (!p.variant || p.variant === v); }); }
  function sameGroup(id, v) {
    var p = byId[id]; if (!p || !p.group) return id;
    var m = PAGES.filter(function (q) { return q.group === p.group && q.kind === "page" && q.variant === v; })[0]; return m ? m.id : id;
  }
  function go(id, noHistory) {
    if (!byId[id]) return;
    if (!noHistory && pageId) history.push(pageId);
    overlays = []; pageId = id; var p = byId[id]; if (p.variant && p.kind === "page") variant = p.variant;
    render();
  }
  function openOverlay(id) { if (byId[id] && overlays.indexOf(id) < 0) { overlays.push(id); render(); } }
  function closeOverlay() { overlays.pop(); render(); }

  function blockNode(b) {
    var n = el("div", "pb" + (b.later ? " later" : ""));
    n.style.left = b.x + "px"; n.style.top = b.y + "px"; n.style.width = b.w + "px"; n.style.height = b.h + "px";
    if (b.later) {
      var l = el("div", "lt"); l.appendChild(el("b", null, T.later + (b.phase ? " · " + b.phase : ""))); l.appendChild(el("span", null, b.title || "")); l.appendChild(el("small", null, T.placeholder)); n.appendChild(l);
    } else n.innerHTML = b.html || "";
    return n;
  }
  function layer(p, cls) {
    var wrap = el("div", cls); wrap.style.width = p.W + "px"; wrap.style.height = p.H + "px";
    (p.blocks || []).filter(visible).forEach(function (b) { wrap.appendChild(blockNode(b)); });
    return wrap;
  }
  function render() {
    var p = byId[pageId]; stage.textContent = "";
    if (!p) { stage.appendChild(el("p", "muted", T.empty)); return; }
    stage.style.width = p.W + "px"; stage.style.height = p.H + "px";
    stage.appendChild(layer(p, "pg"));
    overlays.forEach(function (oid, i) {
      var o = byId[oid], back = el("div", "backdrop"); back.addEventListener("click", function (e) { if (e.target === back) closeOverlay(); });
      var box = layer(o, "ov " + o.kind); box.setAttribute("role", "dialog"); box.setAttribute("aria-label", o.label || "");
      if (o.kind === "drawer") back.classList.add("drawer-side");
      back.appendChild(box); stage.appendChild(back);
    });
    stage.className = "stage" + (hot ? " hot" : "");
    fit(); renderBar();
  }
  function fit() {
    var p = byId[pageId]; if (!p) return;
    var s = Math.max(0.3, Math.min(1, stagebox.clientWidth / p.W));
    stage.style.transform = "scale(" + s + ")"; scaler.style.width = p.W * s + "px"; scaler.style.height = p.H * s + "px";
  }
  function renderBar() {
    var vb = $("variants"); vb.textContent = ""; vb.hidden = variants.length < 2;
    variants.forEach(function (v) {
      var b = el("button", null, v); b.type = "button"; b.setAttribute("aria-pressed", String(v === variant));
      b.addEventListener("click", function () { var cur = pageId; variant = v; go(sameGroup(cur, v), true); }); vb.appendChild(b);
    });
    var pb = $("pages"); pb.textContent = "";
    pagesFor(variant).forEach(function (p) {
      var b = el("button", null, p.label); b.type = "button"; b.setAttribute("aria-pressed", String(p.id === pageId));
      b.addEventListener("click", function () { go(p.id); }); pb.appendChild(b);
    });
    var vs = $("versions"); vs.textContent = ""; vs.hidden = !VERS.length;
    VERS.forEach(function (v) {
      var g = el("span", "vgroup"); g.appendChild(el("span", "muted", v.label || v.id));
      var seg = el("span", "seg"); seg.setAttribute("role", "group"); seg.setAttribute("aria-label", v.label || v.id);
      v.options.forEach(function (o) {
        var b = el("button", null, o.label || o.id); b.type = "button"; b.setAttribute("aria-pressed", String(ver[v.id] === o.id));
        b.addEventListener("click", function () { setVersion(v.id, o.id); }); seg.appendChild(b);
      });
      g.appendChild(seg); vs.appendChild(g);
    });
    $("back").disabled = !history.length && !overlays.length;
  }
  function setVersion(id, opt) {
    ver[id] = opt;
    var cur = byId[pageId]; if (cur && !visible(cur)) { var f = pagesFor(variant)[0]; if (f) { go(f.id, true); return; } }
    overlays = overlays.filter(function (o) { return visible(byId[o]); }); render();
  }
  function resetAll() {
    VERS.forEach(function (v) { ver[v.id] = v.default || v.options[0].id; });
    history = []; overlays = []; variant = variants[0] || "";
    var st = (D.start && byId[D.start]) ? D.start : (pagesFor(variant)[0] || PAGES[0] || {}).id; if (st) go(st, true); else render();
  }

  stage.addEventListener("click", function (ev) {
    var t = ev.target.closest && ev.target.closest("[data-goto],[data-open],[data-close],[data-toggle],[data-toast],[data-version-set]"); if (!t) return;
    ev.preventDefault();
    if (t.dataset.goto) go(sameGroup(t.dataset.goto, variant) || t.dataset.goto);
    else if (t.dataset.open) openOverlay(t.dataset.open);
    else if (t.hasAttribute("data-close")) closeOverlay();
    else if (t.dataset.toggle) { var x = stage.querySelector("#" + CSS.escape(t.dataset.toggle)); if (x) x.hidden = !x.hidden; }
    else if (t.dataset.toast) toast(t.dataset.toast);
    else if (t.dataset.versionSet) { var kv = t.dataset.versionSet.split("="); if (kv.length === 2) setVersion(kv[0], kv[1]); }
  });
  var toastTimer;
  function toast(msg) { var n = $("toast"); n.textContent = msg; n.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { n.hidden = true; }, 2200); }
  $("back").textContent = T.back;
  $("back").addEventListener("click", function () { if (overlays.length) closeOverlay(); else if (history.length) go(history.pop(), true); });
  $("hotlabel").textContent = T.hot;
  $("ptag").textContent = T.protoOnly; $("notapp").textContent = T.notApp; $("reset").textContent = T.reset;
  $("reset").addEventListener("click", resetAll);
  $("hot").addEventListener("change", function () { hot = $("hot").checked; stage.className = "stage" + (hot ? " hot" : ""); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && overlays.length) closeOverlay(); });
  window.addEventListener("resize", fit);
  document.title = D.title || document.title;
  $("title").textContent = D.title || ""; $("subtitle").textContent = D.subtitle || "";
  var start = (D.start && byId[D.start]) ? D.start : (pagesFor(variant)[0] || PAGES[0] || {}).id;
  if (start) go(start, true); else render();
})();
