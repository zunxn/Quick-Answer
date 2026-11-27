"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { gradeAction, revealAction, selfMarkAction, type GradeResult } from "../../actions";

type Q = { id: number; label: string; kind: "choice" | "short" | "self" };

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
    const blank = active.filter((q) => q.kind !== "self" && !(values[q.id] ?? "").trim()).length;
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
    const wrong = new Set(result.items.filter((i) => i.isCorrect === false).map((i) => i.questionId));
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

  const selfMark = (questionId: number, ok: boolean) => {
    if (!result) return;
    start(async () => {
      const r = await selfMarkAction(result.attemptId, questionId, ok);
      if (!r.ok) return;
      setResult((prev) => {
        if (!prev) return prev;
        const items = prev.items.map((it) => (it.questionId === questionId ? { ...it, isCorrect: ok } : it));
        return { ...prev, items, correct: items.filter((it) => it.isCorrect === true).length };
      });
    });
  };

  if (result) {
    const itemOf = new Map(result.items.map((i) => [i.questionId, i]));
    const selfQs = active.filter((q) => q.kind === "self");
    const pendingSelf = selfQs.filter((q) => itemOf.get(q.id)?.isCorrect === null).length;
    const wrong = active.filter((q) => itemOf.get(q.id)?.isCorrect === false);
    return (
      <div>
        <div className="score">
          <div>
            <b>{result.correct}</b> / {result.total}
          </div>
          <span className="muted">풀이 시간 {fmt(seconds)}</span>
        </div>

        {selfQs.length > 0 && (
          <div className="selfbox">
            <strong>직접 확인할 문항 {pendingSelf > 0 && `(${pendingSelf}개 남음)`}</strong>
            <p className="muted small">답이 여러 값·구간이라 자동 채점이 어려운 문항입니다. 정답과 비교해 직접 표시해 주세요.</p>
            {selfQs.map((q) => {
              const it = itemOf.get(q.id)!;
              return (
                <div key={q.id} className="selfrow">
                  <span className="num">{q.label}</span>
                  <span className="selfans">
                    <span className="muted small">내 답</span> {values[q.id] || "–"}
                    <br />
                    <span className="muted small">정답</span> <b>{it.answer}</b>
                    {it.ref && <span className="muted small"> · {it.ref}</span>}
                  </span>
                  <span className="row">
                    <button className={`btn ${it.isCorrect === true ? "okb" : ""}`} disabled={pending} onClick={() => selfMark(q.id, true)}>○</button>
                    <button className={`btn ${it.isCorrect === false ? "ngb" : ""}`} disabled={pending} onClick={() => selfMark(q.id, false)}>✕</button>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {wrong.length === 0 ? (
          pendingSelf === 0 && <p className="empty">전부 맞혔습니다. 🎉</p>
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
            const st = it?.isCorrect === true ? "ok" : it?.isCorrect === false ? "ng" : "pend";
            return (
              <div key={q.id} className={`cell ${st} ${q.kind}`}>
                <span className="num">{q.label}</span>
                <span className="mark">{st === "ok" ? "○" : st === "ng" ? "✕" : "?"}</span>
                <span className="mine">{values[q.id] || "–"}</span>
                {answers && st === "ng" && q.kind !== "self" && <span className="ans">정답 {answers[q.id]}</span>}
                {st === "ng" && it?.ref && <span className="ref">{it.ref}</span>}
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

  const gradable = active.filter((q) => q.kind !== "self");
  const filled = gradable.filter((q) => (values[q.id] ?? "").trim()).length;
  return (
    <div>
      <div className="bar">
        <span>{filled} / {gradable.length} 입력</span>
        <span className="timer">{fmt(seconds)}</span>
      </div>
      <p className="muted hint">
        객관식은 숫자만 누르면 다음 칸으로 넘어갑니다. 단답형은 입력 후 Enter. 분수는 3/4, 루트는 √2 또는 루트2, 제곱은 x^2, 이하는 &lt;=.
      </p>
      <div className="grid">
        {active.map((q, i) => (
          <label key={q.id} className={`cell ${q.kind}`}>
            <span className="num">{q.label}{q.kind === "self" && <em> 직접 확인</em>}</span>
            <input
              ref={(el) => { inputs.current[i] = el; }}
              value={values[q.id] ?? ""}
              onChange={(e) => onChange(i, q, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, q, e)}
              onFocus={(e) => e.target.select()}
              inputMode={q.kind === "choice" ? "numeric" : "text"}
              autoComplete="off"
              maxLength={q.kind === "choice" ? 2 : 50}
              placeholder={q.kind === "choice" ? "" : q.kind === "self" ? "메모(선택)" : "단답"}
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
