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
/* linkHTML(html) … すでに HTML になっている文字列（モジュールのデータ）の、タグの外の文字だけをリンクにする。
   <a>…</a> の中は触らない。中身はエスケープし直さない（データ側で HTML として書かれているため）。 */
function linkHTML(html, unreg){
  var parts = String(html == null ? "" : html).split(/(<[^>]*>)/), inA = 0;
  var out = parts.map(function(p){
    if (p.charAt(0) === "<"){
      if (/^<a[\s>]/i.test(p)) inA++; else if (/^<\/a>/i.test(p)) inA--;
      return p;
    }
    if (inA || !NAME_RE) return p;
    NAME_RE.lastIndex = 0;
    return p.replace(NAME_RE, function(n){ return '<a class="fx" href="' + gentenHref(NAME_INDEX[n]) + '">' + n + '</a>'; });
  }).join("");
  (unreg || []).forEach(function(n){ out = out.split(n).join(n + '<span class="unreg">原典未登録</span>'); });
  return out;
}
/* 文字列中の方剤名から、原典の id を出てくる順に重複なしで返す */
function formulaIds(text){
  var ids = [], m;
  if (!NAME_RE) return ids;
  NAME_RE.lastIndex = 0;
  while ((m = NAME_RE.exec(String(text || "")))){ var id = NAME_INDEX[m[0]]; if (ids.indexOf(id) === -1) ids.push(id); }
  return ids;
}
