"use client";

import { useState, useTransition } from "react";
import { createBookAction, type SectionInput } from "../actions";
import { parseAnswers } from "@/lib/normalize";

const blank = (start = 1): SectionInput => ({ name: "", start, compact: false, answers: "" });

export default function RegisterForm() {
  const [meta, setMeta] = useState({ title: "", subject: "", publisher: "", year: "" });
  const [sections, setSections] = useState<SectionInput[]>([blank()]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const upd = (i: number, patch: Partial<SectionInput>) =>
    setSections((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = () => {
    setError("");
    start(async () => {
      const r = await createBookAction({ ...meta, sections });
      if (r?.error) setError(r.error);
    });
  };

  return (
    <div className="form">
      <div className="fields">
        <label>문제집 이름 *
          <input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="예: 수학의 시발점 미적분Ⅰ" />
        </label>
        <label>과목 *
          <input value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} placeholder="예: 미적분Ⅰ" />
        </label>
        <label>출판사
          <input value={meta.publisher} onChange={(e) => setMeta({ ...meta, publisher: e.target.value })} />
        </label>
        <label>출판 연도
          <input value={meta.year} onChange={(e) => setMeta({ ...meta, year: e.target.value })} inputMode="numeric" maxLength={4} placeholder="2026" />
        </label>
      </div>

      <details className="help">
        <summary>정답 입력 방법</summary>
        <ul>
          <li>문제 순서대로, 띄어쓰기로 구분해 적습니다. 예: <code>3 1 4 12 -2 3/4</code></li>
          <li>1~5 한 글자는 객관식, 그 외는 단답형으로 인식합니다.</li>
          <li>단답형인데 정답이 1~5이면 앞에 <code>=</code>를 붙입니다. 예: <code>=3</code></li>
          <li>복수 정답은 작은 번호부터 붙여 씁니다. 예: ②,④ → <code>24</code></li>
          <li>여러 값·구간처럼 자동 채점이 어려운 답은 앞에 <code>?</code>를 붙이면 채점 후 본인이 직접 확인합니다. 예: <code>?a=1,b=2</code> (띄어쓰기 없이)</li>
          <li>&lsquo;풀이 참조&rsquo; 서술형 문항은 넣지 말고 시작 번호를 나눠 단원을 따로 만드세요.</li>
          <li>전부 객관식이면 &lsquo;객관식만&rsquo;을 켜고 <code>31425 23415</code>처럼 붙여 써도 됩니다.</li>
        </ul>
      </details>

      {sections.map((s, i) => {
        const qs = parseAnswers(s.answers, s.start, s.compact);
        return (
          <fieldset key={i} className="secbox">
            <div className="fields">
              <label>단원 이름
                <input value={s.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="예: 1. 수열의 극한 — STEP 1" />
              </label>
              <label>시작 번호
                <input type="number" min={0} value={s.start} onChange={(e) => upd(i, { start: Number(e.target.value) || 0 })} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={s.compact} onChange={(e) => upd(i, { compact: e.target.checked })} />
              객관식만 (숫자 붙여쓰기)
            </label>
            <textarea rows={3} value={s.answers} onChange={(e) => upd(i, { answers: e.target.value })} placeholder="정답을 순서대로 입력" />
            <div className="row between">
              <span className="muted">
                {qs.length > 0
                  ? `${qs[0].label}~${qs[qs.length - 1].label}번 · ${qs.length}문항 (객관식 ${qs.filter((q) => q.kind === "choice").length}, 단답형 ${qs.filter((q) => q.kind === "short").length}${qs.some((q) => q.kind === "self") ? `, 직접 확인 ${qs.filter((q) => q.kind === "self").length}` : ""})`
                  : "정답을 입력하면 문항 수가 표시됩니다"}
              </span>
              {sections.length > 1 && (
                <button className="btn ghost" onClick={() => setSections(sections.filter((_, j) => j !== i))}>단원 삭제</button>
              )}
            </div>
          </fieldset>
        );
      })}

      <button className="btn" onClick={() => setSections([...sections, blank()])}>+ 단원 추가</button>
      {error && <p className="error">{error}</p>}
      <button className="btn primary big" onClick={submit} disabled={pending}>
        {pending ? "등록 중…" : "등록하기"}
      </button>
    </div>
  );
}
