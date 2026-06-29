import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Counter Watch — cloud vision endpoint.
//
// Receives a photo of an Overwatch screen and returns the hero ids it sees for
// the requested team, using Claude's vision model. Deployed as a Supabase edge
// function (Deno). The ANTHROPIC_API_KEY is a function secret, set by the owner:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...    (or via the dashboard)
//
// Request  (POST JSON): { image: <base64>, mediaType: "image/jpeg", team: "mine"|"enemy",
//                         roster: [{ id, name }, ...] }
// Response (JSON):      { heroes: ["winston", ...] }
//
// Uses a raw fetch to the Messages API (no SDK) — a single call in a constrained
// Deno runtime is more deploy-robust without an npm dependency. Strict forced
// tool use guarantees a structured hero-id list.

const MODEL = "claude-opus-4-8"; // switch to "claude-haiku-4-5" for ~5x cheaper, lower accuracy

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  let payload: { image?: string; mediaType?: string; team?: string; roster?: { id: string; name: string }[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const { image, mediaType = "image/jpeg", team = "enemy", roster = [] } = payload;
  if (!image) return json({ error: "missing image" }, 400);
  if (!Array.isArray(roster) || roster.length === 0) return json({ error: "missing roster" }, 400);

  const validIds = new Set(roster.map((h) => h.id));
  const rosterList = roster.map((h) => `${h.id}: ${h.name}`).join("\n");
  const teamLabel = team === "mine" ? "the user's own team (their allies)" : "the enemy team";

  const prompt =
    `You are identifying Overwatch 2 heroes from a photo of a game screen. ` +
    `The photo may be taken with a phone camera pointed at a monitor or TV, so expect glare, angle, motion blur, and screen glow.\n\n` +
    `Identify which heroes appear for ${teamLabel}. ` +
    `Use the portraits, names, and any UI cues (ally vs enemy, blue vs red, your team's row) to decide.\n\n` +
    `Valid heroes (use these exact ids only):\n${rosterList}\n\n` +
    `Call report_heroes with the ids you are confident about for ${teamLabel}. ` +
    `If two teams are visible and you can tell them apart, report only that side. ` +
    `If you cannot identify any heroes, return an empty list.`;

  const body = {
    model: MODEL,
    max_tokens: 1024,
    tools: [
      {
        name: "report_heroes",
        description: "Report the Overwatch hero ids detected for the requested team.",
        strict: true,
        input_schema: {
          type: "object",
          properties: { heroes: { type: "array", items: { type: "string" } } },
          required: ["heroes"],
          additionalProperties: false,
        },
      },
    ],
    tool_choice: { type: "tool", name: "report_heroes" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: prompt },
        ],
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return json({ error: `vision request failed: ${err}` }, 502);
  }

  if (!res.ok) {
    const detail = await res.text();
    return json({ error: `Anthropic API ${res.status}`, detail: detail.slice(0, 500) }, 502);
  }

  const data = await res.json();
  const toolUse = (data.content || []).find((b: { type: string; name?: string }) => b.type === "tool_use" && b.name === "report_heroes");
  const raw: string[] = toolUse?.input?.heroes ?? [];
  // keep only ids the client actually knows about
  const heroes = [...new Set(raw.filter((id) => validIds.has(id)))];

  return json({ heroes, team });
});
