"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { gradeAction, revealAction, type GradeResult } from "../../actions";

type Q = { id: number; label: string; kind: "choice" | "short" };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function GradeForm({
  sectionId,
  questions,
  initialRetry,
}: {
  sectionId: number;
  questions: Q[];
  initialRetry: boolean;
}) {
  const [active, setActive] = useState<Q[]>(questions); // 지금 풀고 있는 문항들
  const [isRetry, setIsRetry] = useState(initialRetry);
  const [values, setValues] = useState<Record<number, string>>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [answers, setAnswers] = useState<Record<number, string> | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (result) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [result]);

  useEffect(() => {
    if (!result) inputs.current[0]?.focus();
  }, [result, active]);

  const focus = (i: number) => {
    const el = inputs.current[i];
    if (el) { el.focus(); el.select(); }
  };

  const onChange = (i: number, q: Q, raw: string) => {
    if (q.kind === "choice") {
      // 객관식: 숫자 하나 누르면 바로 다음 칸으로 (따다닥)
      const ch = raw.replace(/[^1-5]/g, "").slice(-1);
      setValues((v) => ({ ...v, [q.id]: ch }));
      if (ch) focus(i + 1);
    } else {
      setValues((v) => ({ ...v, [q.id]: raw }));
    }
  };

  const onKeyDown = (i: number, q: Q, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (i + 1 < active.length) focus(i + 1);
    } else if (e.key === "Backspace" && !(values[q.id] ?? "")) {
      e.preventDefault();
      focus(i - 1);
    }
  };

  const submit = () => {
    const blank = active.filter((q) => !(values[q.id] ?? "").trim()).length;
    if (blank > 0 && !confirm(`입력하지 않은 문항이 ${blank}개 있습니다. 틀린 것으로 채점할까요?`)) return;
    setError("");
    start(async () => {
      try {
        const r = await gradeAction(
          sectionId,
          active.map((q) => ({ questionId: q.id, response: values[q.id] ?? "" })),
          seconds,
          isRetry,
        );
        setResult(r);
        window.scrollTo({ top: 0 });
      } catch {
        setError("채점에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  const retryWrong = () => {
    if (!result) return;
    const wrong = new Set(result.items.filter((i) => !i.isCorrect).map((i) => i.questionId));
    setActive(active.filter((q) => wrong.has(q.id)));
    setIsRetry(true);
    setValues({});
    setAnswers(null);
    setResult(null);
    setSeconds(0);
  };

  const reveal = () => {
    if (!result) return;
    if (!confirm("정답을 보면 다시 풀어볼 기회가 사라집니다. 그래도 볼까요?")) return;
    start(async () => {
      const rows = await revealAction(result.attemptId);
      setAnswers(Object.fromEntries(rows.map((r) => [r.questionId, r.answer])));
    });
  };

  if (result) {
    const itemOf = new Map(result.items.map((i) => [i.questionId, i]));
    const wrong = active.filter((q) => !itemOf.get(q.id)?.isCorrect);
    return (
      <div>
        <div className="score">
          <div>
            <b>{result.correct}</b> / {result.total}
          </div>
          <span className="muted">풀이 시간 {fmt(seconds)}</span>
        </div>
        {wrong.length === 0 ? (
          <p className="empty">전부 맞혔습니다. 🎉</p>
        ) : (
          <>
            <p>
              <strong>틀린 문제:</strong> {wrong.map((q) => q.label).join(", ")}번
            </p>
            <div className="row">
              <button className="btn primary" onClick={retryWrong}>틀린 문제만 다시 풀기</button>
              {!answers && (
                <button className="btn ghost" onClick={reveal} disabled={pending}>정답 보기</button>
              )}
            </div>
          </>
        )}
        <div className="grid result">
          {active.map((q) => {
            const it = itemOf.get(q.id);
            return (
              <div key={q.id} className={`cell ${it?.isCorrect ? "ok" : "ng"}`}>
                <span className="num">{q.label}</span>
                <span className="mark">{it?.isCorrect ? "○" : "✕"}</span>
                <span className="mine">{values[q.id] || "–"}</span>
                {answers && !it?.isCorrect && <span className="ans">정답 {answers[q.id]}</span>}
                {it && it.solvers >= 3 && it.rate !== null && (
                  <span className="rate">정답률 {Math.round(it.rate * 100)}%</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const filled = active.filter((q) => (values[q.id] ?? "").trim()).length;
  return (
    <div>
      <div className="bar">
        <span>{filled} / {active.length} 입력</span>
        <span className="timer">{fmt(seconds)}</span>
      </div>
      <p className="muted hint">
        객관식은 숫자만 누르면 다음 칸으로 넘어갑니다. 단답형은 입력 후 Enter. 분수는 3/4, 루트는 √2 또는 루트2.
      </p>
      <div className="grid">
        {active.map((q, i) => (
          <label key={q.id} className={`cell ${q.kind}`}>
            <span className="num">{q.label}</span>
            <input
              ref={(el) => { inputs.current[i] = el; }}
              value={values[q.id] ?? ""}
              onChange={(e) => onChange(i, q, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, q, e)}
              onFocus={(e) => e.target.select()}
              inputMode={q.kind === "choice" ? "numeric" : "text"}
              autoComplete="off"
              maxLength={q.kind === "choice" ? 2 : 30}
              placeholder={q.kind === "choice" ? "" : "단답"}
              aria-label={`${q.label}번`}
            />
          </label>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn primary big" onClick={submit} disabled={pending}>
        {pending ? "채점 중…" : "채점하기"}
      </button>
    </div>
  );
}
