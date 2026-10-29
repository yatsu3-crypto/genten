/* ===== 共通：方剤名 → 原典へのリンク =====
   linkify(text) … 文字列中の方剤名を最長一致で <a class="fx" href="#/genten/<id>"> に置き換えた HTML を返す（text はそのまま渡す。中でエスケープする）。
   名前の索引：entries の 名前・ファイル名・別名（「・」区切り）＋ DATA.nameIndex（表記ゆれ表。2日目に build が作る）。
   unreg … 索引に無いが方剤名として印を付けたい名前（例：参苓白朮散）。「原典未登録」の小札を付ける。 */
var NAME_INDEX = (function(){
  var idx = {};
  function add(name, id){ name = String(name || "").trim(); if (name && !idx[name]) idx[name] = id; }
  DATA.entries.forEach(function(e){ add(e["名前"], e.file); add(e.file, e.file); });
  DATA.entries.forEach(function(e){ String(e["別名"] || "").split("・").forEach(function(a){ add(a, e.file); }); });
  var extra = DATA.nameIndex || {};
  Object.keys(extra).forEach(function(k){ add(k, extra[k]); });
  return idx;
})();
var NAME_RE = (function(){
  var names = Object.keys(NAME_INDEX).sort(function(a, b){ return b.length - a.length; });
  if (!names.length) return null;
  return new RegExp(names.map(function(n){ return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|"), "g");
})();
function gentenHref(id){ return "#/genten/" + encodeURIComponent(id); }
function linkify(text, unreg){
  var s = String(text == null ? "" : text), out = "", last = 0, m;
  if (NAME_RE){
    NAME_RE.lastIndex = 0;
    while ((m = NAME_RE.exec(s))){
      out += esc(s.slice(last, m.index)) + '<a class="fx" href="' + gentenHref(NAME_INDEX[m[0]]) + '">' + esc(m[0]) + '</a>';
      last = m.index + m[0].length;
    }
  }
  out += esc(s.slice(last));
  (unreg || []).forEach(function(n){
    var e = esc(n);
    out = out.split(e).join(e + '<span class="unreg">原典未登録</span>');
  });
  return out;
}
