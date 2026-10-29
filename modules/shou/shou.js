/* ===== 証ナビモジュール（旧 証ナビ yatsu3-crypto/kampogairai の index.html を移したもの。4日目） =====
   ハッシュ：#/shou/<テーマ>/<サブタブ>（例 #/shou/mukumi/dx）。サブタブ：判定／比較表／方剤詳細／患者説明。
   - データは data.js（SHOU_D・SHOU_EXTRA・SHOU_MODS）。構成生薬は共通の方剤データ DATA.formulas（entries の「構成」）から出す。
   - 旧「生薬」タブは削り、併用チェックは副作用タブに一本化した（院長決定 Q11）。方剤詳細と判定結果の「併用チェックへ」で、
     選んだ方剤を共有の SELECTED（メモリのみ）に入れる。
   - 所見の選択はメモリの中だけで持つ（保存しない。所見はハッシュにも入れない）。保存するのはテーマとサブタブ（画面の状態）だけ。
   - 旧 証ナビの保存キー kampoNavi.mod（最後のテーマ）は、新しいキーが空のときだけ genten.shou.topic.v1 に写す（旧キーは消さない）。 */
(function(){
var MODS = SHOU_MODS, FX = DATA.formulas || {};
var KEYS7 = ["山梔子","黄芩","麻黄","大黄","附子","甘草","芒硝"];   /* 赤く表示する注意生薬（集計用の名前） */

/* 旧 証ナビの保存キー（画面の状態＝最後のテーマ）だけを引き継ぐ（設計案 5-3） */
(function(){
  if (store.get("shou", "topic")) return;
  var old = null;
  try { old = localStorage.getItem("kampoNavi.mod"); } catch (e){}
  if (old && MODS[old]) store.set("shou", "topic", old);
})();

var mod = MODS[store.get("shou", "topic")] ? store.get("shou", "topic") : Object.keys(MODS)[0];
var ST = {};   /* 所見：テーマごとにメモリだけで持つ */
Object.keys(MODS).forEach(function(k){ var t = Object.keys(MODS[k].types)[0]; ST[k] = {on: new Set(), red: new Set(), cur: t, curPt: t}; });
var built = null;   /* いま画面に組み立ててあるテーマ */

function M(){ return MODS[mod]; }
function S(){ return ST[mod]; }
function KEYS(){ return Object.keys(M().types); }
function hasTag(t){ return M().sx.filter(function(s){ return s[4] === t && S().on.has(s[0]); }).length; }
function idOf(n){ return NAME_INDEX[n] || null; }

/* ---------- ヘッダー：テーマ ---------- */
var topicsEl = $("#shTopics");
topicsEl.innerHTML = Object.keys(MODS).map(function(k){ return '<button type="button" data-m="' + k + '">' + esc(MODS[k].label) + '</button>'; }).join("");
topicsEl.addEventListener("click", function(ev){
  var b = ev.target.closest("button"); if (!b || b.dataset.m === mod) return;
  mod = b.dataset.m;
  store.set("shou", "topic", mod);
  window.scrollTo(0, 0);
  ROUTER.replace(SHOU.hashFor());
});
function markTopic(){
  Array.prototype.forEach.call(topicsEl.querySelectorAll("button"), function(b){ b.classList.toggle("on", b.dataset.m === mod); });
  var on = topicsEl.querySelector("button.on");
  if (on) topicsEl.scrollLeft = on.offsetLeft - (topicsEl.clientWidth - on.offsetWidth) / 2;
}

/* ---------- 判定 ---------- */
function chip(id, label, color, set, bold){
  var b = document.createElement("button");
  b.type = "button";
  b.className = "sh-chip" + (set.has(id) ? " on" : ""); b.style.setProperty("--c", color);
  b.innerHTML = bold ? "<b>" + label + "</b>" : label;
  b.setAttribute("aria-pressed", set.has(id) ? "true" : "false");
  b.onclick = function(){
    if (set.has(id)) set.delete(id); else set.add(id);
    b.classList.toggle("on"); b.setAttribute("aria-pressed", set.has(id) ? "true" : "false");
    render();
  };
  return b;
}
function buildFindings(){
  var m = M(), s = S();
  $("#shRedTitle").textContent = m.redTitle;
  $("#shIntro").innerHTML = m.intro ? '<div class="sh-card sh-intro">' + m.intro + "</div>" : "";
  var box = $("#shGroups"); box.innerHTML = "";
  m.groups.forEach(function(g){
    var h = document.createElement("div"); h.className = "sh-grp";
    h.innerHTML = '<span class="sh-dot" style="background:' + g[3] + '"></span>' + g[1] + (g[2] ? "<small>" + g[2] + "</small>" : "");
    var c = document.createElement("div"); c.className = "sh-chips";
    m.sx.filter(function(x){ return x[2] === g[0]; }).forEach(function(x){
      c.appendChild(chip(x[0], x[1], g[3], s.on, Object.keys(x[3]).some(function(k){ return x[3][k] >= 2; })));
    });
    box.appendChild(h); box.appendChild(c);
  });
  var r = $("#shRed"); r.innerHTML = "";
  m.red.forEach(function(x){ r.appendChild(chip(x[0], x[1], "var(--alert)", s.red)); });
}
function scores(){
  var sc = {}, mx = {};
  KEYS().forEach(function(k){ sc[k] = 0; mx[k] = 0; });
  M().sx.forEach(function(x){ for (var k in x[3]){ mx[k] += x[3][k]; if (S().on.has(x[0])) sc[k] += x[3][k]; } });
  return {sc: sc, mx: mx};
}
function render(){
  var m = M(), s = S(), T = m.types, r0 = scores(), sc = r0.sc, mx = r0.mx;
  var ranked = KEYS().slice().sort(function(a, b){ return sc[b] - sc[a]; });
  var top = ranked[0], sec = ranked[1];
  var bars = '<div class="sh-bars">' + KEYS().map(function(k){
    var p = mx[k] ? Math.round(sc[k] / mx[k] * 100) : 0;
    return '<div class="sh-bar"><span style="color:' + T[k].color + ';font-weight:700">' + T[k].bar + '</span><div class="sh-track"><div class="sh-fill" style="width:' + p + '%;background:' + T[k].color + '"></div></div><span>' + sc[k] + "</span></div>";
  }).join("") + "</div>";
  var html;
  if (sc[top] === 0){
    html = '<h3>所見を選択してください</h3><p class="hint">判定結果と推奨方剤がここに表示されます。</p>' + bars;
  } else {
    var combo = sec && sc[sec] > 0 && sc[sec] >= sc[top] * 0.6;
    var key = [top, sec].sort().join("+");
    var r = m.recommend(top, hasTag);
    var ids = formulaIds(r.rx).filter(function(f){ return FX[f]; });
    html = '<div class="hint">最も考えられる証</div>' +
      '<div class="sh-big" style="color:' + T[top].color + '">' + (T[top].no ? T[top].no + " " : "") + T[top].name +
      (combo ? '<span style="color:' + T[sec].color + '"> ＋ ' + (T[sec].no || T[sec].name) + "</span>" : "") + "</div>" +
      '<div class="sh-rxline">' + linkHTML(r.rx) + "</div>" +
      '<ul class="sh-why">' + r.why.map(function(w){ return "<li>" + w + "</li>"; }).join("") + "</ul>" +
      (combo && m.combo[key] ? '<div class="addon combo"><b>併存</b>：' + linkHTML(m.combo[key]) + "</div>" : "") +
      (ids.length ? '<div class="sh-row"><button type="button" class="sh-btn" data-chk="' + esc(ids.join("|")) + '">' +
        esc(ids.map(function(f){ return FX[f].name; }).join("・")) + " を併用チェックへ ›</button></div>" : "") +
      '<div style="margin-top:12px">' + bars + "</div>";
    s.cur = top; s.curPt = top;
  }
  html += linkHTML(m.addons(hasTag, sc[top] ? top : null));
  $("#shRes").style.borderLeftColor = sc[top] ? T[top].color : "var(--ink)";
  $("#shRes").innerHTML = html;
  $("#shRedMsg").innerHTML = s.red.size ? '<div class="alert">⚠ 該当あり：' + m.redMsg(s.red) + "</div>" : "";
  renderDetail(); renderPt();
}

/* ---------- 方剤詳細 ---------- */
function herbChips(n){
  var id = idOf(n), f = id && FX[id];
  if (f) return f.herbs.map(function(h){ return '<span class="sh-herb' + (KEYS7.indexOf(h.canon) !== -1 ? " k" : "") + '">' + esc(h.raw) + "</span>"; }).join("");
  if (SHOU_EXTRA[n]) return SHOU_EXTRA[n].h.split("・").map(function(h){ return '<span class="sh-herb">' + esc(h) + "</span>"; }).join("");
  return '<span class="todo">構成 要確認</span>';
}
function selBtn(n){
  var id = idOf(n); if (!id || !FX[id]) return "";
  var on = SELECTED.has(id);
  return '<button type="button" class="sh-sel' + (on ? " on" : "") + '" data-sel="' + esc(id) + '" aria-pressed="' + on + '">' + (on ? "✓ 併用チェックに入れた" : "＋ 併用チェックに入れる") + "</button>";
}
function seg(el, sel, fn){
  var T = M().types, ks = KEYS();
  el.style.gridTemplateColumns = "repeat(" + ks.length + ",1fr)";
  el.innerHTML = ks.map(function(k){ return '<button type="button" data-k="' + k + '" class="' + (k === sel ? "on" : "") + '" style="--c:' + T[k].color + '">' + T[k].seg + "</button>"; }).join("");
  Array.prototype.forEach.call(el.querySelectorAll("button"), function(b){ b.onclick = function(){ fn(b.dataset.k); }; });
}
function renderDetail(){
  var s = S(), T = M().types;
  seg($("#shSeg"), s.cur, function(k){ s.cur = k; renderDetail(); });
  var r = M().rx[s.cur], c = T[s.cur].color;
  var maker = function(n){ var id = idOf(n); return id && FX[id] && FX[id].maker && FX[id].maker !== "ツムラ" ? '<span class="ref">構成は' + esc(FX[id].maker) + "の製剤</span>" : ""; };
  $("#shDetail").innerHTML =
    '<div class="sh-card" style="border-top:5px solid ' + c + '"><h3 style="color:' + c + '">' + (T[s.cur].no ? T[s.cur].no + " " : "") + T[s.cur].name + "</h3>" +
    "<dl><dt>病態</dt><dd>" + r.path + "</dd><dt>症状の特徴</dt><dd>" + r.feat + "</dd><dt>舌・脈</dt><dd>" + r.tongue + "</dd></dl></div>" +
    '<div class="sh-card"><div class="hint">対応処方</div><div class="sh-rxline" style="color:' + c + '">' + linkHTML(r.main) + "</div>" +
    r.groups.map(function(g){
      return '<div class="sh-sublabel">' + g[0] + "</div>" + g[1].map(function(n){
        var id = idOf(n);
        return '<div class="sh-fm"><div class="sh-fmh"><b>' + (id ? linkify(n) : esc(n)) + "</b>" + maker(n) + selBtn(n) + "</div>" +
          "<div>" + herbChips(n) + '</div><div class="hint">' + (SHOU_D[n] || "") + "</div></div>";
      }).join("");
    }).join("") + "</div>" +
    (r.tcm ? '<div class="sh-card sh-kin"><h3>中医の代表方 → エキス剤</h3><table class="kv">' + r.tcm.map(function(t){ return "<tr><td>" + t[0] + "</td><td>" + linkHTML(t[1]) + "</td></tr>"; }).join("") + "</table></div>" : "") +
    '<div class="sh-card"><h3>代替・鑑別</h3><ul class="tight">' + r.alt.map(function(a){ return "<li>" + linkHTML(a) + "</li>"; }).join("") + "</ul></div>" +
    '<div class="sh-card sh-caution"><h3>注意</h3><ul class="tight">' + r.caution.map(function(a){ return "<li>" + a + "</li>"; }).join("") + "</ul>" +
    '<p class="hint">赤い生薬＝重複・副作用に注意。構成は原典（entries）の「構成」から。</p>' +
    '<div class="sh-row"><a class="sh-btn pri" href="#/fuku/check">併用チェックへ ›<small>' + (SELECTED.size ? SELECTED.size + "処方を選択中" : "") + "</small></a></div></div>";
}

/* ---------- 患者説明 ---------- */
function renderPt(){
  var s = S(), T = M().types;
  seg($("#shSeg2"), s.curPt, function(k){ s.curPt = k; renderPt(); });
  var p = M().pt[s.curPt];
  $("#shPt").innerHTML = '<div class="sh-card"><h3 style="color:' + T[s.curPt].color + ';font-size:1.25rem">' + p.t + '</h3><div class="sh-pt">' + p.b + "</div></div>";
}

/* ---------- 比較表 ---------- */
function buildCmp(){
  var m = M(), T = m.types;
  $("#shCmpTitle").textContent = m.cmpTitle;
  $("#shCmp").innerHTML = "<tr><th>証</th><th>病態</th><th>症状の特徴</th><th>対応処方</th></tr>" +
    KEYS().map(function(k){
      return '<tr><td class="tname" style="color:' + T[k].color + '">' + (T[k].no ? T[k].no + "<br>" : "") + T[k].name + "</td><td>" + m.rx[k].path + "</td><td>" + m.rx[k].feat +
        "</td><td><b>" + linkHTML(m.rx[k].main.replace(/／/g, "<br>")) + "</b></td></tr>";
    }).join("");
  $("#shCmpExtra").innerHTML = linkHTML(m.cmpExtra);
}

function buildAll(){
  built = mod;
  $("#appsub").textContent = M().sub;
  markTopic(); buildFindings(); buildCmp(); render();
}

/* ---------- 操作 ---------- */
$("#shReset").addEventListener("click", function(){ S().on.clear(); S().red.clear(); buildFindings(); render(); });
$("#shToDetail").addEventListener("click", function(){ window.scrollTo(0, 0); ROUTER.replace(SHOU.hashFor("rx")); });
/* 「併用チェックに入れる」：選択を切り替えるだけ（画面は移らない）。「…を併用チェックへ」：入れてから併用チェックへ（履歴を積む） */
$("#m-shou").addEventListener("click", function(ev){
  var b = ev.target.closest("[data-sel]");
  if (b){
    var id = b.dataset.sel;
    if (SELECTED.has(id)) SELECTED.delete(id); else SELECTED.add(id);
    renderDetail();
    return;
  }
  var c = ev.target.closest("[data-chk]");
  if (c){
    c.dataset.chk.split("|").forEach(function(id){ SELECTED.add(id); });
    location.hash = "#/fuku/check";
  }
});

var SHOU = subtabModule("shou", {
  title: "証ナビ",
  sub: M().sub,
  subs: [["dx", "判定"], ["cmp", "比較表"], ["rx", "方剤詳細"], ["pt", "患者説明"]],
  fit: true,
  top: true,
  path: function(){ return mod; },
  onPath: function(parts){
    if (!parts.length || !MODS[parts[0]]) return false;
    if (parts[0] !== mod){ mod = parts[0]; store.set("shou", "topic", mod); }
    return true;
  },
  onShow: function(t){
    if (built !== mod) buildAll();
    else {
      $("#appsub").textContent = M().sub;
      /* 原典や併用チェックから戻ったとき：選択の印だけ描き直す（所見・位置はそのまま） */
      if (t === "rx") renderDetail();
    }
  }
});
})();
