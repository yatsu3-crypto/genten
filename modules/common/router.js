/* ===== 共通：ルーター（最後に読み込む） =====
   #/genten …, #/shou/…, #/myaku/…, #/fuku/…。旧形式 #葛根湯 は #/genten/葛根湯 に置き換える（履歴は積まない）。
   - 下部タブ（アプリ切替）は履歴を積まない。各タブの最後のハッシュとスクロール位置をメモリに覚えて、戻ってきたら復元する。
   - 方剤名ジャンプ（location.hash = …）は履歴を積む。「‹ 戻る」は、アプリ内で積んだ履歴があれば history.back()、無ければ既定の画面へ。
     ホーム画面アプリ（standalone）にはブラウザの戻るボタンが無いので、履歴の有無はメモリ上のスタックで判断する。
   - 所見などの入力内容はハッシュに入れない。 */
var ROUTER = (function(){
  var ORDER = ["genten", "shou", "myaku", "fuku"];
  var current = null, lastHash = {}, scrollPos = {};
  var stack = [], replacing = false, restoring = false;

  function modOf(h){ var m = /^#\/([^\/]+)/.exec(h || ""); return m ? m[1] : null; }
  function parse(h){
    var raw = (h || "").replace(/^#/, "");
    if (!raw) return null;
    var dec = function(s){ try { return decodeURIComponent(s); } catch (e){ return s; } };
    if (raw.charAt(0) !== "/") return {legacy: dec(raw)};
    var parts = raw.slice(1).split("/").map(dec).filter(function(s){ return s !== ""; });
    if (!MODULES[parts[0]]) return null;
    return {mod: parts[0], rest: parts.slice(1)};
  }
  function defaultHash(){
    var t = store.get("common", "tab");
    return MODULES[t] ? MODULES[t].home() : MODULES.genten.home();
  }
  function replace(h){
    if (location.hash === h || decodeURIComponent(location.hash) === decodeURIComponent(h)){ render(); return; }
    replacing = true; location.replace(h);
  }

  function activate(mod){
    if (current && current !== mod) scrollPos[current] = window.scrollY;
    current = mod;
    $$(".mod").forEach(function(s){ s.classList.toggle("on", s.dataset.mod === mod); });
    $$(".mhead").forEach(function(s){ s.classList.toggle("on", s.dataset.mod === mod); });
    $$(".apptab").forEach(function(b){
      var on = b.dataset.mod === mod;
      b.classList.toggle("on", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    $("#apptitle").textContent = MODULES[mod].title;
    $("#appsub").textContent = MODULES[mod].sub || "";
    document.title = MODULES[mod].title + "｜やまもと皮膚科・漢方クリニック";
    store.set("common", "tab", mod);
  }

  function render(){
    var r = parse(location.hash);
    if (r && r.legacy !== undefined){
      /* 旧形式 #<方剤名>：履歴を積まずに新形式へ */
      history.replaceState(null, "", gentenHref(r.legacy));
      if (stack.length) stack[stack.length - 1] = location.hash;
      r = {mod: "genten", rest: [r.legacy]};
    }
    if (!r){ replace(defaultHash()); return; }
    var switched = current !== r.mod;
    if (switched) activate(r.mod);
    lastHash[r.mod] = location.hash;
    var scrolled = MODULES[r.mod].show(r.rest);
    if (restoring){ window.scrollTo(0, scrollPos[r.mod] || 0); restoring = false; }
    else if (switched && !scrolled) window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", function(){
    var h = location.hash;
    if (replacing){ if (stack.length) stack[stack.length - 1] = h; else stack.push(h); replacing = false; }
    else if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop();
    else stack.push(h);
    render();
  });

  /* 下部タブ */
  $$(".apptab").forEach(function(b){
    b.addEventListener("click", function(){
      var mod = b.dataset.mod;
      if (mod === current){
        /* 表示中のタブをもう一度押したら、そのタブの最初の画面の先頭へ */
        window.scrollTo(0, 0);
        replace(MODULES[mod].home());
        return;
      }
      restoring = true;
      replace(lastHash[mod] || MODULES[mod].home());
    });
  });

  return {
    replace: replace,
    /* fallback：アプリ内の履歴が無いときに行く先 */
    back: function(fallback){ if (stack.length > 1) history.back(); else replace(fallback); },
    /* ひとつ前の画面のモジュール名（「‹ 証ナビへ」などの文言用） */
    prevMod: function(){ return stack.length > 1 ? modOf(stack[stack.length - 2]) : null; },
    order: ORDER,
    start: function(){
      $("#built").textContent = "データ更新 " + DATA.built + (LOCAL ? "（手元版）" : "");
      $("#edition").hidden = !LOCAL;
      stack.push(location.hash);
      render();
    }
  };
})();
ROUTER.start();
