// The escalation call. When the agent is denied, it composes a spoken line from
// the live run's real numbers (Novita MiniMax TTS) and plays it — the loan officer
// answers live. If Novita is unreachable the beat degrades to a text-only transcript
// card, so the floor holds.

import { writeFileSync } from "node:fs";

const TTS_URL = "https://api.novita.ai/v3/minimax-speech-02-turbo";
const OUT = new URL("../public/escalation.mp3", import.meta.url);

export function composeLine(r) {
  if (!r) return "This is the Wet Ink covenant monitor requesting a loan officer's attestation.";
  const deal = r.deal.replace(/-/g, " ");
  if (!r.breach) return `This is the Wet Ink covenant monitor. On deal ${deal}, interest coverage is ${r.corrected}, within the ${r.threshold} floor. No action required.`;
  return `This is the Wet Ink covenant monitor calling for the loan officer. On deal ${deal}, interest coverage has fallen to ${r.corrected}, below the ${r.threshold} floor. The dashboard still shows ${r.naive} on stale earnings. I am holding the determination and I require your attestation to serve formal notice.`;
}

export async function synthEscalation(r, env) {
  const text = composeLine(r);
  if (!env.NOVITA_API_KEY) return { mode: "SKIP", text, url: null, note: "no key — text only" };
  try {
    const res = await fetch(TTS_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.NOVITA_API_KEY}` },
      body: JSON.stringify({
        text,
        voice_setting: { voice_id: "English_expressive_narrator", speed: 1.0, vol: 1.0, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
      }),
    });
    if (!res.ok) throw new Error(`TTS ${res.status}`);
    const j = await res.json();
    if (!j.audio) throw new Error("no audio in response");
    writeFileSync(OUT, Buffer.from(j.audio, "hex"));
    return { mode: "REAL", text, url: "/escalation.mp3", durationMs: j.extra_info?.audio_length };
  } catch (e) {
    return { mode: "SKIP", text, url: null, note: String(e.message || e).slice(0, 60) };
  }
}
