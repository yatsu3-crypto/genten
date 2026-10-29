/* ===== 脈診モジュール（公開版用の枠だけ）=====
   公開版（genten.html）には中身を入れない。build が modules/myaku/placeholder.html（「手元版のみ」）を差し込む。
   手元版の本体は modules-local/myaku/（gitignore）にあり、手元版ではこのフォルダの代わりにそちらが丸ごと入る（5日目）。 */
subtabModule("myaku", {
  title: "脈診ナビ",
  sub: "脈の所見を整理する",
  subs: [["judge", "判定"], ["list", "二十八脈"], ["tips", "脈診の要点"]],
  fit: true
});
