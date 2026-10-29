/* ===== 原典モジュール（旧 template.html の処理をそのまま移したもの） =====
   ハッシュ：#/genten（一覧）、#/genten/<方剤ファイル名>（詳細）。旧形式 #<方剤名> は router.js が置き換える。 */
(function(){
DATA.entries.forEach(function(e){
  e._idx = norm([e["名前"], e["別名"], e["読み"], e["ツムラ番号"], e["出典"], e["本文"]["構成"]].join(" "));
});
var TODO = '<span class="todo">要確認</span>';
/* 本文中の「要確認」「要原本照合」を目立たせる（エスケープ後の文字列に使う） */
/* 確認の段階：要確認・要原本照合（未確認・朱）→ 翻刻確認（金茶）→ 院長確認（松葉）。読み：社員案・訳：社員案（藍） */
var FLAG_RE = /（(要確認|要原本照合)）|(要確認|要原本照合)/g;
var MARK_RE = /（(要確認|要原本照合|翻刻確認|院長確認|読み：社員案|訳：社員案)）|(要確認|要原本照合|翻刻確認|院長確認|読み：社員案|訳：社員案)/g;
var MARK_CLASS = {"翻刻確認":" hon", "院長確認":" ok", "読み：社員案":" yomi", "訳：社員案":" yomi"};
function flagify(html){
  return html.replace(MARK_RE, function(_, a, b){ var t = a || b; return '<span class="flag' + (MARK_CLASS[t] || "") + '">' + t + '</span>'; });
}

/* 本文の Markdown を表示用に変換する（### 見出し・**太字**・表・箇条書き・段落のみ） */
function inline(s){ return flagify(esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")); }
function cells(line){ return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function(c){ return c.trim(); }); }
var TBL_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
function md(text){
  var lines = text.split("\n"), out = [], i = 0, m, buf;
  var isBlock = function(l){ return !l.trim() || /^#{3,6}\s/.test(l) || /^\s*\|/.test(l) || /^\s*[-*]\s+/.test(l); };
  while (i < lines.length){
    var l = lines[i];
    if (!l.trim()){ i++; continue; }
    if ((m = l.match(/^#{3,6}\s+(.*)$/))){
      out.push("<h4>" + inline(m[1]) + "</h4>"); i++;
      /* 中身のない小見出し（資料にない項目）には「要確認」を出す */
      var j = i; while (j < lines.length && !lines[j].trim()) j++;
      if (j >= lines.length || /^#{3,6}\s/.test(lines[j])) out.push("<p>" + TODO + "</p>");
      continue;
    }
    if (/^\s*\|/.test(l)){
      buf = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) buf.push(lines[i++]);
      var head = buf.length > 1 && TBL_SEP.test(buf[1]) ? cells(buf[0]) : null;
      var rows = buf.filter(function(r, j){ return !(head && j < 2); });
      out.push('<div class="tbl"><table>' +
        (head ? "<thead><tr>" + head.map(function(c){ return "<th>" + inline(c) + "</th>"; }).join("") + "</tr></thead>" : "") +
        "<tbody>" + rows.map(function(r){ return "<tr>" + cells(r).map(function(c, j){
          /* data-label：カード表示のときに列名を出す。blank：中身が「—」だけの欄はカードでは隠す */
          return "<td" + (head && head[j] ? ' data-label="' + esc(head[j]) + '"' : "") + (/^[—-]?$/.test(c) ? ' class="blank"' : "") + ">" + inline(c) + "</td>";
        }).join("") + "</tr>"; }).join("") +
        "</tbody></table></div>");
      continue;
    }
    if (/^\s*[-*]\s+/.test(l)){
      buf = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) buf.push("<li>" + inline(lines[i++].replace(/^\s*[-*]\s+/, "")) + "</li>");
      out.push("<ul>" + buf.join("") + "</ul>");
      continue;
    }
    buf = [];
    while (i < lines.length && !isBlock(lines[i])) buf.push(inline(lines[i++]));
    out.push("<p>" + buf.join("<br>") + "</p>");
  }
  return out.join("");
}
function countFlags(e){
  return DATA.sections.reduce(function(n, k){ return n + (e["本文"][k].match(FLAG_RE) || []).length; }, 0);
}

function renderList(){
  var q = norm($("#q").value);
  var hits = DATA.entries.filter(function(e){ return !q || e._idx.indexOf(q) !== -1; });
  if (!DATA.entries.length){
    $("#count").textContent = "";
    $("#list").innerHTML = '<div class="listempty"><div class="big">🌼</div>まだ方剤が登録されていません<br>entries/ に方剤を足して build.py を実行してください</div>';
    return;
  }
  $("#count").textContent = q ? "該当 " + hits.length + " 件" : "方剤 " + hits.length + " 件";
  if (!hits.length){
    $("#list").innerHTML = '<div class="listempty"><div class="big">🔍</div>見つかりません</div>';
    return;
  }
  $("#list").innerHTML = hits.map(function(e){
    var sub = [e["読み"], e["出典"]].filter(Boolean).join("　");
    return '<button class="al" data-f="' + esc(e.file) + '">' +
      '<span class="num">' + (e["ツムラ番号"] ? esc(e["ツムラ番号"]) : "—") + '</span>' +
      '<span class="am"><span class="an" style="display:block">' + esc(e["名前"]) + '</span>' +
      '<span class="ax" style="display:block">' + (sub ? esc(sub) : "読み・出典 要確認") + '</span></span></button>';
  }).join("");
}

/* 「‹ 戻る」の文言：ほかのタブから飛んできたときはそのタブ名、それ以外は一覧へ */
var BACK_LABEL = {shou: "‹ 証ナビへ", myaku: "‹ 脈診へ", fuku: "‹ 副作用へ"};
function renderDetail(e){
  var h = '<button class="back" id="gback">' + (BACK_LABEL[ROUTER.prevMod()] || "‹ 一覧へ") + '</button>';
  h += '<div class="dhead"><h2>' + esc(e["名前"]) + '</h2>' +
    '<div class="yomi">' + (e["読み"] ? esc(e["読み"]) : TODO) + (e["別名"] ? '　別名 ' + esc(e["別名"]) : '') + '</div>' +
    '<div class="tags"><span class="pill num">ツムラ ' + (e["ツムラ番号"] ? esc(e["ツムラ番号"]) : "要確認") + '</span>' +
    '<span class="pill src">' + (e["出典"] ? esc(e["出典"]) : "出典 要確認") + '</span>' +
    (countFlags(e) ? '<span class="pill flagcount">要確認・要照合 ' + countFlags(e) + '</span>' : '') + '</div></div>';
  DATA.sections.forEach(function(k){
    var v = e["本文"][k], priv = e["非公開"].indexOf(k) !== -1;
    var body = v ? md(v) : (priv ? '<span class="privnote">手元版のみ</span>' : TODO);
    h += '<div class="sec' + (k === "条文" ? " jobun" : "") + (priv && LOCAL ? " priv" : "") + '"><h3>' + esc(k) +
      (priv && LOCAL ? '<span class="privbadge">非公開を含む</span>' : '') + '</h3>' +
      '<div class="body">' + body + '</div></div>';
  });
  $("#v-detail").innerHTML = h;
}

function go(f){ location.hash = f ? gentenHref(f) : "#/genten"; }

MODULES.genten = {
  title: "原典",
  sub: "方剤の条文・出典・構成・方意をすぐ引く",
  home: function(){ return "#/genten"; },
  /* rest：ハッシュの #/genten/ より後ろ（デコード済み）。戻り値 true＝ページ先頭へスクロールした */
  show: function(rest){
    var f = rest[0] || "";
    var e = f ? DATA.entries.filter(function(x){ return x.file === f; })[0] : null;
    $("#v-list").classList.toggle("on", !e);
    $("#v-detail").classList.toggle("on", !!e);
    if (e){ renderDetail(e); window.scrollTo(0, 0); return true; }
    return false;
  }
};

$("#list").addEventListener("click", function(ev){
  var b = ev.target.closest(".al"); if (b) go(b.dataset.f);
});
$("#v-detail").addEventListener("click", function(ev){
  if (ev.target.closest("#gback")) ROUTER.back("#/genten");
});
/* 検索したら一覧に戻る（詳細を開いていたら、履歴を積まずに一覧へ） */
$("#q").addEventListener("input", function(){
  renderList();
  if ($("#v-detail").classList.contains("on")) ROUTER.replace("#/genten");
});
renderList();
})();
