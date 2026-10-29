/* ===== 共通：サブタブ（ヘッダー内 pill）を持つモジュールの骨組み =====
   subtabModule(名前, {title, sub, subs:[[id,表示名],…], fit})
   fit:true … サブタブを横スクロールさせず、幅を分け合って全部見せる（4つ以下のとき）。
   ハッシュ：#/<名前>/<サブタブid>（証ナビは #/shou/<テーマ>/<サブタブ> を想定し、最後の区切りをサブタブとして読む）。
   サブタブの切替は履歴を積まない。最後のサブタブは画面の状態として genten.<名前>.tab.v1 に保存する。
   本体側：<… data-sub="id"> の要素があれば、選ばれたものだけ表示する（無ければ何もしない）。
   path（任意）：サブタブの前に入れる区切りを返す関数（証ナビのテーマ。例 "mukumi"）。
   onPath（任意）：ハッシュのサブタブより前の区切り（配列）を受け取り、正しくなければ false を返す（既定の画面へ置き換える）。
   top（任意）：サブタブを押したらページの先頭へ戻す。 */
function subtabModule(name, cfg){
  var ids = cfg.subs.map(function(s){ return s[0]; });
  var pre = function(){ return cfg.path ? encodeURIComponent(cfg.path()) + "/" : ""; };
  var head = document.querySelector('.mhead[data-mod="' + name + '"]');
  var body = document.querySelector('.mod[data-mod="' + name + '"]');
  var tabs = document.createElement("div");
  tabs.className = cfg.fit ? "tabs fit" : "tabs"; tabs.setAttribute("role", "tablist");
  tabs.innerHTML = cfg.subs.map(function(s){
    return '<button type="button" class="tab" role="tab" data-sub="' + esc(s[0]) + '">' + esc(s[1]) + '</button>';
  }).join("");
  head.insertBefore(tabs, head.firstChild);
  tabs.addEventListener("click", function(ev){
    var b = ev.target.closest(".tab"); if (!b) return;
    if (cfg.top) window.scrollTo(0, 0);
    ROUTER.replace("#/" + name + "/" + pre() + b.dataset.sub);
  });
  var m = {
    title: cfg.title, sub: cfg.sub,
    home: function(){
      var t = store.get(name, "tab");
      return "#/" + name + "/" + pre() + (ids.indexOf(t) !== -1 ? t : ids[0]);
    },
    /* いまのサブタブのまま、前の区切り（テーマ）だけ変えたハッシュ */
    hashFor: function(t){ return "#/" + name + "/" + pre() + (t || m.current || ids[0]); },
    current: null,
    show: function(rest){
      var t = rest[rest.length - 1];
      if (ids.indexOf(t) === -1){ ROUTER.replace(m.home()); return false; }
      if (cfg.onPath && cfg.onPath(rest.slice(0, -1)) === false){ ROUTER.replace(m.home()); return false; }
      m.current = t;
      store.set(name, "tab", t);
      $$('.mhead[data-mod="' + name + '"] .tab').forEach(function(b){
        var on = b.dataset.sub === t;
        b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false");
      });
      Array.prototype.forEach.call(body.querySelectorAll("[data-sub]"), function(v){ v.hidden = v.dataset.sub !== t; });
      if (cfg.onShow) cfg.onShow(t);
      return false;
    }
  };
  MODULES[name] = m;
  return m;
}
