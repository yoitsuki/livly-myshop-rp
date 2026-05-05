import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";

interface RequestBody {
  apiKey: string;
  model?: string;
  /** "data:image/jpeg;base64,..." */
  imageDataUrl: string;
}

const SYSTEM_PROMPT = `リヴリーアイランドのマイショップ出品画面のスクリーンショットから、
次のフィールドを抽出して JSON のみを返してください。

{
  "name": string | null,
  "category": string | null,
  "description": string | null,
  "minPrice": number | null,
  "refPriceMin": number | null,
  "refPriceMax": number | null
}

- 数値はカンマや「GP」を取り除いた整数。
- 不明・読み取れない項目は null。
- 余計な文章やコードフェンスは含めず、JSON だけを返答してください。`;

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
  } catch (e) {
    const status =
      e && typeof e === "object" && "status" in e
        ? Number((e as { status?: number }).status) || 401
        : 401;
    const message =
      e instanceof Error ? e.message : "unauthorized";
    return NextResponse.json({ error: message }, { status });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.apiKey) {
    return NextResponse.json({ error: "missing apiKey" }, { status: 400 });
  }
  if (!body.imageDataUrl) {
    return NextResponse.json({ error: "missing imageDataUrl" }, { status: 400 });
  }

  const match = body.imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "imageDataUrl must be a base64 data URL" },
      { status: 400 }
    );
  }
  const mediaType = match[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const base64 = match[2];

  const client = new Anthropic({ apiKey: body.apiKey });
  const model = body.model ?? "claude-sonnet-4-6";

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: "このスクリーンショットからフィールドを抽出してください。",
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    if (!parsed) {
      return NextResponse.json(
        { error: "failed to parse model response", raw: text },
        { status: 502 }
      );
    }
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
