export const TALK_DISTANCE = 5;
export const SPEECH_LIFETIME = 12000;
export const MAX_SPEECH_LENGTH = 200;
export type Speech = { text: string; createdAt: number };
export type ConversationMessage = Speech & { id: string; name: string; self: boolean };
export type Conversation = { ready: boolean; unavailable: boolean; messages: ConversationMessage[] };
export const emptyConversation: Conversation = { ready: false, unavailable: false, messages: [] };
export const cleanSpeech = (text: string) => text.trim();
export function readSpeech(value: unknown, now: number): Speech | null {
  if (!value || typeof value !== "object") return null;
  const speech = value as Speech;
  if (typeof speech.text !== "string" || !speech.text.trim() || speech.text.length > MAX_SPEECH_LENGTH || !Number.isFinite(speech.createdAt) || speech.createdAt > now + 1000 || now - speech.createdAt > SPEECH_LIFETIME) return null;
  return speech;
}
export function canHear(a: { x: number; z: number; room?: string }, b: { x: number; z: number; room?: string }) {
  return (a.room || "outside") === (b.room || "outside") && Math.hypot(a.x - b.x, a.z - b.z) <= TALK_DISTANCE;
}
