/* ===== 共通：サブタブ（ヘッダー内 pill）を持つモジュールの骨組み =====
   subtabModule(名前, {title, sub, subs:[[id,表示名],…]})
   ハッシュ：#/<名前>/<サブタブid>（証ナビは #/shou/<テーマ>/<サブタブ> を想定し、最後の区切りをサブタブとして読む）。
   サブタブの切替は履歴を積まない。最後のサブタブは画面の状態として genten.<名前>.tab.v1 に保存する。
   本体側：<… data-sub="id"> の要素があれば、選ばれたものだけ表示する（無ければ何もしない）。 */
function subtabModule(name, cfg){
  var ids = cfg.subs.map(function(s){ return s[0]; });
  var head = document.querySelector('.mhead[data-mod="' + name + '"]');
  var body = document.querySelector('.mod[data-mod="' + name + '"]');
  var tabs = document.createElement("div");
  tabs.className = "tabs"; tabs.setAttribute("role", "tablist");
  tabs.innerHTML = cfg.subs.map(function(s){
    return '<button type="button" class="tab" role="tab" data-sub="' + esc(s[0]) + '">' + esc(s[1]) + '</button>';
  }).join("");
  head.insertBefore(tabs, head.firstChild);
  tabs.addEventListener("click", function(ev){
    var b = ev.target.closest(".tab"); if (b) ROUTER.replace("#/" + name + "/" + b.dataset.sub);
  });
  var m = {
    title: cfg.title, sub: cfg.sub,
    home: function(){
      var t = store.get(name, "tab");
      return "#/" + name + "/" + (ids.indexOf(t) !== -1 ? t : ids[0]);
    },
    show: function(rest){
      var t = rest[rest.length - 1];
      if (ids.indexOf(t) === -1){ ROUTER.replace(m.home()); return false; }
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
