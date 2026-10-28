const API = "https://api.groq.com/openai/v1";
const PARSE_MODEL = process.env.PARSE_MODEL ?? "openai/gpt-oss-120b";

// Appelle Groq et renvoie un objet JSON (le prompt doit décrire le format attendu).
export async function chatJson(system: string, user: string): Promise<unknown> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");

  const res = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: PARSE_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq request failed: ${res.status}`);
  const json = await res.json();
  return JSON.parse(String(json.choices?.[0]?.message?.content ?? "{}"));
}
