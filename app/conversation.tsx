import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { MAX_SPEECH_LENGTH, type Conversation } from "./chat";

type Props = { conversation: Conversation; nearby: string[]; send: (text: string) => Promise<{ ok: boolean; message: string }> };
export default function ConversationPanel({ conversation, nearby, send }: Props) {
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const ready = conversation.ready && nearby.length > 0 && !sending;
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [conversation.messages]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || !text.trim()) return;
    setSending(true);
    try { const result = await send(text); setFeedback(result.message); if (result.ok) setText(""); }
    finally { setSending(false); }
  }
  return <>
    <p className="conversation-neighbors">{nearby.length ? `${nearby.join(", ")} 님과 대화할 수 있어요.` : "가까운 이웃이 없어요."}</p>
    <div className="conversation-log" ref={log} role="log" aria-label="주변 대화" aria-live="polite">
      {conversation.messages.length ? conversation.messages.map((message) => <div key={`${message.id}-${message.createdAt}`} className={message.self ? "conversation-message self" : "conversation-message"}><strong>{message.self ? "나" : message.name}</strong><p>{message.text}</p></div>) : <p className="conversation-empty">가까운 이웃에게 인사를 건네보세요.</p>}
    </div>
    <form className="conversation-form" onSubmit={(event) => void submit(event)}>
      <label className="sr-only" htmlFor="village-speech">말풍선 메시지</label>
      <textarea id="village-speech" value={text} onChange={(event) => setText(event.target.value)} maxLength={MAX_SPEECH_LENGTH} rows={2} placeholder="어떤 이야기를 나눌까요?" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(event); } }} />
      <button className="primary-button" type="submit" disabled={!ready || !text.trim()}>보내기<Send size={17} /></button>
    </form>
    <p className="conversation-status" role="status">{feedback || (conversation.unavailable ? "지금은 대화에 연결할 수 없어요. 잠시 후 다시 시도해 주세요." : !conversation.ready ? "대화에 연결하는 중이에요." : "주변 이웃에게 말풍선으로 보여요.")}</p>
  </>;
}
