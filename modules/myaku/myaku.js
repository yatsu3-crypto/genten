/* ===== 脈診モジュール（1日目：枠だけ）=====
   公開版（genten.html）には中身を入れない。build が modules/myaku/placeholder.html（「手元版のみ」）を差し込む。
   手元版の本体は5日目に modules-local/myaku/ に置く（gitignore）。 */
subtabModule("myaku", {
  title: "脈診ナビ",
  sub: "脈の所見を整理する",
  subs: [["judge", "判定"], ["list", "二十八脈"], ["tips", "脈診の要点"]],
  fit: true
});
