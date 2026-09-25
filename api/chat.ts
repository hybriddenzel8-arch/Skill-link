import {
  AssistantNotConfiguredError,
  generateAssistantReply,
  parseAssistantInput,
} from "../artifacts/api-server/src/lib/assistant-provider";

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

const REQUEST_LIMIT = 20;
const WINDOW_MS = 60_000;
const requestBuckets = new Map<string, { count: number; resetsAt: number }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader?.("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    return;
  }

  const forwardedFor = req.headers?.["x-forwarded-for"];
  const clientKey = Array.isArray(forwardedFor)
    ? forwardedFor[0]?.split(",")[0]?.trim()
    : forwardedFor?.split(",")[0]?.trim();
  const bucketKey = clientKey || "unknown";
  const now = Date.now();
  const bucket = requestBuckets.get(bucketKey);
  if (!bucket || bucket.resetsAt <= now) {
    requestBuckets.set(bucketKey, { count: 1, resetsAt: now + WINDOW_MS });
  } else if (bucket.count >= REQUEST_LIMIT) {
    res.status(429).json({ error: "RATE_LIMITED" });
    return;
  } else {
    bucket.count += 1;
  }

  const input = parseAssistantInput(req.body);
  if (!input) {
    res.status(400).json({ error: "INVALID_CHAT_REQUEST" });
    return;
  }

  try {
    res.status(200).json(await generateAssistantReply(input));
  } catch (error) {
    if (error instanceof AssistantNotConfiguredError) {
      res.status(503).json({ error: "AI_NOT_CONFIGURED" });
      return;
    }
    console.error("SkillLink chat provider request failed");
    res.status(502).json({ error: "AI_UNAVAILABLE" });
  }
}