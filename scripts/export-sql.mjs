// data/*.json → 한 개의 SQL (스키마 + 문제집). Supabase SQL 편집기/API로 실행 가능.
// 사용법: node scripts/export-sql.mjs data/a.json data/b.json > data/seed.sql
import { readFileSync } from "node:fs";

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
let out = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8") + "\n";
for (const file of process.argv.slice(2)) {
  const b = JSON.parse(readFileSync(file, "utf8"));
  out += `\n-- ${b.title}\ndelete from books where title = ${q(b.title)};\n`;
  out += `with bk as (insert into books (title, subject, publisher, year, status) values (${q(b.title)}, ${q(b.subject)}, ${q(b.publisher ?? "")}, ${b.year ?? "null"}, 'approved') returning id)\n`;
  b.sections.forEach((s, i) => {
    out += `, s${i} as (insert into sections (book_id, grp, name, ord, note) select id, ${q(s.grp ?? "")}, ${q(s.name)}, ${i}, ${q(s.note ?? "")} from bk returning id)\n`;
  });
  const rows = b.sections.flatMap((s, i) =>
    s.questions.map((x, j) => `(${i}, ${q(x.label)}, ${j}, ${q(x.kind)}, ${q(x.answer)}, ${q(x.ref ?? "")})`));
  out += `insert into questions (section_id, label, ord, kind, answer, ref)\nselect case v.si ${b.sections.map((_, i) => `when ${i} then (select id from s${i})`).join(" ")} end, v.label, v.ord, v.kind, v.answer, v.ref\nfrom (values\n${rows.join(",\n")}\n) as v(si, label, ord, kind, answer, ref);\n`;
}
process.stdout.write(out);
