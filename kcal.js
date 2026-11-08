// Calcola le kcal degli ingredienti con Groq. Serve la variabile GROQ_API_KEY su Netlify.
const SYS = `Sei un nutrizionista italiano. Ricevi gli ingredienti di una ricetta.
Per ogni ingrediente stima le kcal per la quantità indicata, usando valori medi da tabelle nutrizionali (CREA, USDA).
Regole: considera gli alimenti a crudo salvo indicazione diversa; se manca la quantità usa una porzione tipica;
spezie, erbe, aglio, limone "q.b." contano 0-5 kcal; sale e acqua 0.
Rispondi SOLO con JSON nel formato {"items":[{"ingredient":"testo originale","kcal":numero}]}, stesso ordine degli ingredienti.`;

export default async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Usa POST" }, { status: 405 });
  const key = process.env.GROQ_API_KEY;
  if (!key) return Response.json({ error: "Manca la chiave GROQ_API_KEY su Netlify." }, { status: 500 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Richiesta non valida." }, { status: 400 }); }
  const ingredients = (body.ingredients || []).filter(s => typeof s === "string" && s.trim()).slice(0, 40);
  if (!ingredients.length) return Response.json({ error: "Nessun ingrediente." }, { status: 400 });

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: JSON.stringify({ ricetta: body.title || "", ingredienti: ingredients }) }
      ]
    })
  });
  if (!r.ok) return Response.json({ error: `Il servizio delle kcal non risponde (${r.status}). Riprova tra poco.` }, { status: 502 });
  let out;
  try { out = JSON.parse((await r.json()).choices[0].message.content); }
  catch { return Response.json({ error: "Risposta non leggibile, riprova." }, { status: 502 }); }
  const items = (out.items || []).map((x, i) => ({
    ingredient: String(x.ingredient || ingredients[i] || ""),
    kcal: Math.max(0, Math.round(Number(x.kcal) || 0))
  }));
  const total = items.reduce((a, b) => a + b.kcal, 0);
  return Response.json({ items, total });
};
