import { NextRequest, NextResponse } from "next/server";

const FEEDBACK_TYPES = ["bug", "suggestion", "other"] as const;
type FeedbackType = (typeof FEEDBACK_TYPES)[number];

function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isFeedbackType(v: unknown): v is FeedbackType {
  return typeof v === "string" && FEEDBACK_TYPES.includes(v as FeedbackType);
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json(
      { error: "Feedback service is not configured." },
      { status: 503 },
    );
  }

  const threadRaw = process.env.TELEGRAM_MESSAGE_THREAD_ID?.trim();
  let messageThreadId: number | undefined;
  if (threadRaw) {
    const n = Number.parseInt(threadRaw, 10);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json(
        { error: "Invalid TELEGRAM_MESSAGE_THREAD_ID" },
        { status: 503 },
      );
    }
    messageThreadId = n;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { type, title, description, contact } = body as Record<
    string,
    unknown
  >;

  if (!isFeedbackType(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (title.length > 100) {
    return NextResponse.json({ error: "Title too long" }, { status: 400 });
  }

  if (typeof description !== "string") {
    return NextResponse.json(
      { error: "Description is required" },
      { status: 400 },
    );
  }
  if (description.trim().length < 20) {
    return NextResponse.json(
      { error: "Description must be at least 20 characters" },
      { status: 400 },
    );
  }
  if (description.length > 2000) {
    return NextResponse.json(
      { error: "Description too long" },
      { status: 400 },
    );
  }

  let contactStr: string | undefined;
  if (contact !== undefined && contact !== null) {
    if (typeof contact !== "string") {
      return NextResponse.json({ error: "Invalid contact" }, { status: 400 });
    }
    if (contact.length > 200) {
      return NextResponse.json({ error: "Contact too long" }, { status: 400 });
    }
    contactStr = contact.trim() || undefined;
  }

  const typeHeader =
    type === "bug"
      ? "🐛 [BÁO LỖI]"
      : type === "suggestion"
        ? "💡 [GÓP Ý]"
        : "📋 [KHÁC]";

  const lines: string[] = [
    `<b>${escapeTelegramHtml(typeHeader)}</b>`,
    "",
    `<b>${escapeTelegramHtml(title.trim())}</b>`,
    "",
    escapeTelegramHtml(description.trim()),
  ];

  if (contactStr) {
    lines.push("", `📧 ${escapeTelegramHtml(contactStr)}`);
  }

  const now = new Date().toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  lines.push("", `⏱ ${escapeTelegramHtml(now)}`);

  const text = lines.join("\n");

  if (text.length > 4096) {
    return NextResponse.json(
      { error: "Message too long for Telegram" },
      { status: 400 },
    );
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const sendPayload: Record<string, string | number> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (messageThreadId !== undefined) {
    sendPayload.message_thread_id = messageThreadId;
  }

  const tgRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sendPayload),
  });

  const tgData = (await tgRes.json()) as { ok?: boolean; description?: string };

  if (!tgRes.ok || !tgData.ok) {
    return NextResponse.json(
      { error: tgData.description ?? "Failed to send to Telegram" },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true });
}
