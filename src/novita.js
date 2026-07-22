// Akash — cognition. Every plan/draft is a real token spend against AkashML.
// OpenAI-compatible. Offline fallback keeps the loop runnable with no key/wifi.

export async function think(prompt, env) {
  const key = env.AKASHML_API_KEY;
  const model = env.AKASHML_MODEL;
  if (!key || !model) {
    return { text: null, live: false, cost: 0.004 }; // simulated meter tick
  }
  try {
    const r = await fetch("https://api.akashml.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "You are the planning step of a deterministic build harness. Answer in one terse clause.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!r.ok) throw new Error(`AkashML ${r.status}`);
    const j = await r.json();
    const text = (j.choices?.[0]?.message?.content ?? "").trim();
    const toks = j.usage?.total_tokens ?? 0;
    return { text, live: true, cost: Math.max(0.001, toks * 0.0000012) };
  } catch (e) {
    return { text: null, live: false, cost: 0.004, error: String(e.message || e) };
  }
}
