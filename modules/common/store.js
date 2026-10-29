/* ===== 共通：データ・小道具・保存 ===== */
var DATA = JSON.parse(document.getElementById("genten-data").textContent);
var LOCAL = DATA.edition === "local";
var $ = function(s){ return document.querySelector(s); };
var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };

function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
/* 検索用：カタカナ→ひらがな、全角英数→半角、空白除去 */
function norm(s){
  return String(s||"").toLowerCase()
    .replace(/[ァ-ヶ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0)-0x60); })
    .replace(/[！-～]/g, function(c){ return String.fromCharCode(c.charCodeAt(0)-0xfee0); })
    .replace(/\s+/g, "");
}

/* localStorage：キーは genten.<モジュール>.<項目>.v1。
   保存してよいのは画面の状態（タブ・表示の明るさ）だけ。所見・リスク因子・選んだ処方は保存しない（院長決定 Q7）。
   保存できない環境（プライベートブラウズ等）では黙って何もしない。 */
var STORE_ALLOWED = ["common.theme", "common.tab", "genten.tab", "shou.tab", "shou.topic", "myaku.tab", "fuku.tab"];
var store = {
  key: function(mod, item){ return "genten." + mod + "." + item + ".v1"; },
  get: function(mod, item){
    try { return localStorage.getItem(store.key(mod, item)); } catch (e){ return null; }
  },
  set: function(mod, item, v){
    if (STORE_ALLOWED.indexOf(mod + "." + item) === -1) throw new Error("保存しない項目です: " + mod + "." + item);
    try { localStorage.setItem(store.key(mod, item), v); } catch (e){}
  }
};

/* 表示の明るさ：auto（端末に従う）／light／dark */
var theme = {
  apply: function(v){
    if (v === "light" || v === "dark") document.documentElement.setAttribute("data-theme", v);
    else { document.documentElement.removeAttribute("data-theme"); v = "auto"; }
    $$("[data-theme-set]").forEach(function(b){ b.classList.toggle("on", b.dataset.themeSet === v); });
    var dark = v === "dark" || (v === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    $$('meta[name="theme-color"]').forEach(function(m){
      if (v === "auto") m.setAttribute("content", m.media.indexOf("dark") !== -1 ? "#1C1A17" : "#FBF5E6");
      else m.setAttribute("content", dark ? "#1C1A17" : "#FBF5E6");
    });
  },
  set: function(v){ store.set("common", "theme", v); theme.apply(v); }
};
theme.apply(store.get("common", "theme"));
document.addEventListener("click", function(ev){
  var b = ev.target.closest("[data-theme-set]"); if (b) theme.set(b.dataset.themeSet);
});

/* モジュールの登録先。各モジュールが MODULES.<名前> = {...} を入れ、最後に router.js が動かす */
var MODULES = {};
