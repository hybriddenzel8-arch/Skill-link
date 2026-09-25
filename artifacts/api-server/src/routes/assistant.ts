import { Router, type IRouter } from "express";
import {
  AssistantNotConfiguredError,
  generateAssistantReply,
  parseAssistantInput,
} from "../lib/assistant-provider";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const REQUEST_LIMIT = 20;
const WINDOW_MS = 60_000;
const requestBuckets = new Map<string, { count: number; resetsAt: number }>();

router.post("/chat", async (req, res) => {
  const now = Date.now();
  const bucketKey = req.ip || "unknown";
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
    res.json(await generateAssistantReply(input));
  } catch (error) {
    if (error instanceof AssistantNotConfiguredError) {
      res.status(503).json({ error: "AI_NOT_CONFIGURED" });
      return;
    }

    logger.warn("SkillLink chat provider request failed");
    res.status(502).json({ error: "AI_UNAVAILABLE" });
  }
});

export default router;