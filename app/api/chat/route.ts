import { createServerSupabaseClient } from "@/lib/server-utils";
import { ChatProviderError, generateResponse } from "@/lib/services/species-chat";
import { NextResponse } from "next/server";

// Cap the prompt so one request can't run up a large bill.
const MAX_MESSAGE_LENGTH = 2000;

// POST /api/chat  { message: string }  ->  { response: string }
export async function POST(request: Request) {
  // Only signed-in users may spend API credits, matching the app's other protected routes.
  const {
    data: { session },
  } = await createServerSupabaseClient().auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be signed in to use the chatbot." }, { status: 401 });
  }

  // 400: body isn't JSON, or `message` is missing / not a non-empty string / too long.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const message = typeof body === "object" && body !== null && "message" in body ? body.message : undefined;
  if (typeof message !== "string" || message.trim() === "") {
    return NextResponse.json({ error: "`message` must be a non-empty string." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `\`message\` must be at most ${MAX_MESSAGE_LENGTH} characters.` },
      { status: 400 },
    );
  }

  try {
    const response = await generateResponse(message.trim());
    return NextResponse.json({ response });
  } catch (error) {
    // 502: the LLM provider failed (bad key, rate limit, outage, network). Anything else is our own bug -> 500.
    if (error instanceof ChatProviderError) {
      return NextResponse.json(
        { error: "The chat service is unavailable right now. Please try again." },
        { status: 502 },
      );
    }
    console.error("Unexpected /api/chat error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
