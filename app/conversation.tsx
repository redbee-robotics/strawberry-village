import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { MAX_SPEECH_LENGTH, type Conversation } from "./chat";

type Props = { conversation: Conversation; nearby: string[]; send: (text: string) => Promise<{ ok: boolean; message: string }> };
export default function ConversationPanel({ conversation, nearby, send }: Props) {
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const ready = conversation.ready && nearby.length > 0 && !sending;
  useEffect(() => { input.current?.focus(); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || sendingRef.current || !text.trim()) return;
    sendingRef.current = true;
    setSending(true);
    try { const result = await send(text); setFeedback(result.message); if (result.ok) setText(""); }
    catch { setFeedback("말을 전하지 못했어요. 잠시 후 다시 시도해 주세요."); }
    finally { sendingRef.current = false; setSending(false); }
  }
  return <>
    <form className="conversation-form" onSubmit={(event) => void submit(event)}>
      <label className="sr-only" htmlFor="village-speech">말풍선 메시지</label>
      <input ref={input} type="text" id="village-speech" value={text} onChange={(event) => setText(event.target.value)} maxLength={MAX_SPEECH_LENGTH} placeholder={nearby.length ? "주변에 말하기…" : "가까운 이웃이 없어요"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); if (!event.repeat) void submit(event); } }} />
      <button className="primary-button" type="submit" disabled={!ready || !text.trim()} aria-label="보내기"><Send size={17} /></button>
    </form>
    {feedback && <p className="conversation-status" role="status">{feedback}</p>}
  </>;
}
