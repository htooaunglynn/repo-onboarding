import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ valid: false, error: "API key is required" }, { status: 400 });
    }

    // Detect provider from key prefix
    let provider, modelLabel;
    if (apiKey.startsWith("sk-ant-")) {
      provider = "anthropic";
      modelLabel = "Claude Sonnet 4";
    } else if (apiKey.startsWith("sk-proj-") || (apiKey.startsWith("sk-") && !apiKey.startsWith("sk-ant-"))) {
      provider = "openai";
      modelLabel = "GPT-4o";
    } else if (apiKey.startsWith("AIza")) {
      provider = "google";
      modelLabel = "Gemini 2.0 Flash";
    } else {
      return NextResponse.json({ valid: false, error: "Unknown API key format" }, { status: 400 });
    }

    // Validate by making a test call to the provider
    let valid = false;
    try {
      if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          method: "GET",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        });
        valid = res.status === 200;
      } else if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          method: "GET",
          headers: { "Authorization": `Bearer ${apiKey}` },
        });
        valid = res.status === 200;
      } else if (provider === "google") {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
          method: "GET",
        });
        valid = res.status === 200;
      }
    } catch (err) {
      return NextResponse.json({ valid: false, error: "Failed to validate API key" }, { status: 400 });
    }

    if (!valid) {
      return NextResponse.json({ valid: false, error: "Invalid API key" }, { status: 401 });
    }

    return NextResponse.json({ valid: true, provider, model: modelLabel });
  } catch (err) {
    return NextResponse.json({ valid: false, error: err.message }, { status: 400 });
  }
}
