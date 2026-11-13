"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { feedbackAction } from "../actions";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const pathname = usePathname();

  if (!open)
    return (
      <button className="fb-fab" onClick={() => { setOpen(true); setDone(false); }}>
        의견 보내기
      </button>
    );
  return (
    <div className="fb-panel" role="dialog" aria-label="의견 보내기">
      {done ? (
        <>
          <p>고맙습니다! 의견이 전달되었습니다.</p>
          <button className="btn" onClick={() => setOpen(false)}>닫기</button>
        </>
      ) : (
        <>
          <strong>불편한 점, 넣어줬으면 하는 문제집·기능</strong>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="자유롭게 적어주세요"
          />
          <div className="row">
            <button className="btn ghost" onClick={() => setOpen(false)}>취소</button>
            <button
              className="btn primary"
              disabled={pending || !text.trim()}
              onClick={() =>
                start(async () => {
                  const r = await feedbackAction(text, pathname);
                  if (r.ok) { setText(""); setDone(true); }
                })
              }
            >
              보내기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
