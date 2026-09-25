import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import {
  createJob,
  getSession,
  services,
} from "@/lib/store";

type Draft = {
  service: string;
  details: string;
  location: string;
  preferredDate: string;
  preferredTime: string;
};

type DraftField = keyof Draft;
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: { label: string; href: string };
};

type ApiResult = {
  reply?: string;
  draft?: Partial<Draft>;
};

const emptyDraft = (): Draft => ({
  service: "",
  details: "",
  location: "",
  preferredDate: "",
  preferredTime: "",
});

const fieldPrompts: Record<DraftField, string> = {
  service: "Which service do you need? You can choose from the services on SkillLink.",
  details: "What exactly needs fixing or doing?",
  location: "What area is the job in?",
  preferredDate: "What date would suit you? “Flexible” is fine too.",
  preferredTime: "What time would you prefer? “Flexible” is fine too.",
};

const fields: DraftField[] = [
  "service",
  "details",
  "location",
  "preferredDate",
  "preferredTime",
];

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Hi, I’m the SkillLink assistant. I can help you find a service, draft a job request, check bookings saved on this browser, or explain how SkillLink works.",
  },
];

function makeMessage(role: ChatMessage["role"], content: string, action?: ChatMessage["action"]): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    ...(action ? { action } : {}),
  };
}

function firstMissing(draft: Draft): DraftField | null {
  return fields.find((field) => !draft[field].trim()) ?? null;
}

function isComplete(draft: Draft) {
  return fields.every((field) => Boolean(draft[field].trim())) && draft.details.trim().length >= 10;
}

function canonicalService(value: string) {
  return services.find((item) => item.name.toLowerCase() === value.trim().toLowerCase())?.name ?? "";
}

function guessService(text: string) {
  const value = text.toLowerCase();
  const patterns: [RegExp, string][] = [
    [/\b(plumb(?:er|ing)?|sink|tap|faucet|pipe|drain|toilet|leak(?:ing)?)\b/, "Plumbing"],
    [/\b(electric(?:ian|al)?|socket|wiring|light(?:ing)?|power fault)\b/, "Electrical Work"],
    [/\b(carpent(?:er|ry)|door|cabinet|furniture|shelf)\b/, "Carpentry"],
    [/\b(clean(?:er|ing)|deep clean|house clean)\b/, "Cleaning"],
    [/\b(fridge|refrigerator|cooker|washing machine|appliance)\b/, "Appliance Repair"],
    [/\b(garden(?:er|ing)?|lawn|landscap(?:e|ing))\b/, "Gardening & Outdoor"],
    [/\b(mason(?:ry)?|til(?:e|ing)|plaster|concrete|wall)\b/, "Masonry"],
    [/\b(mechanic|car service|vehicle|engine|brakes)\b/, "Mechanics"],
    [/\b(general repair|handyman|odd job)\b/, "General Repairs"],
  ];
  return patterns.find(([pattern]) => pattern.test(value))?.[1] ?? "";
}

function initialDescription(text: string) {
  const because = text.match(/\b(?:because|the problem is|it is|it's)\s+(.+)$/i)?.[1];
  const needs = text.match(/\b(?:need|help|fix|repair)\s+(?:a|an|my|the)?\s*(.+)$/i)?.[1];
  return (because ?? needs ?? text)
    .replace(/[.!?]+$/, "")
    .trim()
    .slice(0, 500);
}

function localDraftUpdate(
  text: string,
  draft: Draft,
  expectedField: DraftField | null,
  startingRequest: boolean,
): Draft {
  const next = { ...draft };
  const service = guessService(text) || canonicalService(text);

  if (startingRequest) {
    if (service) next.service = service;
    const description = initialDescription(text);
    if (description && description.toLowerCase() !== service.toLowerCase()) {
      next.details = description;
    }
    const location = text.match(/\b(?:in|at|near|around)\s+([A-Z][\w' -]{1,40})/i)?.[1];
    if (location) next.location = location.trim().replace(/[,.!?]+$/, "");
  } else if (expectedField) {
    if (expectedField === "service") {
      next.service = service;
    } else if (expectedField === "details" && draft.details.trim().length < 10) {
      next.details = `${draft.details.trim()} ${text.trim()}`.trim().slice(0, 500);
    } else {
      next[expectedField] = text.trim().slice(0, 500);
    }
  } else {
    const time = text.match(/\b(?:change|set|make|prefer(?:red)?(?:\s+time)?\s*(?:to|is)?\s*)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\b/i)?.[1];
    const date = text.match(/\b(today|tomorrow|(?:this\s+)?(?:mon|tues|wednes|thurs|fri|satur|sun)day|flexible)\b/i)?.[1];
    if (service) next.service = service;
    if (time) next.preferredTime = time.trim();
    if (date) next.preferredDate = date.trim();
    const location = text.match(/\b(?:in|at|near|around)\s+([A-Z][\w' -]{1,40})/i)?.[1];
    const locationEdit = text.match(/\b(?:change|set|update)\s+(?:the\s+)?location\s+(?:to\s+)?(.+)$/i)?.[1];
    if (location || locationEdit) next.location = (location ?? locationEdit ?? "").trim().replace(/[,.!?]+$/, "");
    const detail = text.match(/\b(?:change|describe|details?|problem)\s*(?:to|is|:)?\s+(.+)$/i)?.[1];
    if (detail) next.details = detail.trim().slice(0, 500);
  }

  return next;
}

function mergeDraft(current: Draft, patch: Partial<Draft> | undefined): Draft {
  if (!patch) return current;
  const next = { ...current };
  for (const field of fields) {
    const value = patch[field];
    if (typeof value !== "string" || !value.trim()) continue;
    next[field] = field === "service" ? canonicalService(value) || current[field] : value.trim().slice(0, 500);
  }
  return next;
}

function helpReply(text: string) {
  const value = text.toLowerCase();
  if (/\b(service|services|what can you|categories)\b/.test(value)) {
    return `SkillLink lists these services:\n${services.map((service) => `• ${service.name}: ${service.detail}`).join("\n")}\n\nI can help you draft a request for any listed category.`;
  }
  if (/\b(how does|how do|how it works|explain skill.?link)\b/.test(value)) {
    return "Customers browse service listings, send a job request, and follow its status from the dashboard. Fundis review incoming requests and update the status there. This prototype stores its demo data in this browser.";
  }
  if (/\b(problem|issue|report|broken|not working|help)\b/.test(value)) {
    return "Tell me what went wrong and I can help you write a clear summary. This prototype does not have a support-submission endpoint, so I can’t send a report for you.";
  }
  return "I can explain SkillLink, list services, help draft a job request, or open your bookings. What would be most useful?";
}

function statusReply() {
  const session = getSession();
  if (!session) {
    return {
      content: "Sign in to open your bookings. This prototype keeps status details in the browser dashboard; the assistant has no secure shared status lookup.",
      action: { label: "Sign in", href: "/auth" },
    };
  }

  return {
    content:
      session.role === "fundi"
        ? "Incoming requests and their current statuses are shown in your fundi dashboard. This prototype’s assistant does not read job records directly."
        : "Your booking statuses are shown in your dashboard. This prototype’s assistant does not read job records directly.",
    action: { label: "Open bookings", href: "/dashboard" },
  };
}

function isJobRequest(text: string) {
  return /\b(i need|i want|looking for|find me|book|hire|job request|send a request|need help|fix(?:ing)?|repair|leaking|plumb(?:er|ing)?|electrician)\b/i.test(text);
}

function isAffirmative(text: string) {
  return /^(yes|yeah|yep|ok|okay|confirm|submit|create it|go ahead)[.! ]*$/i.test(text.trim());
}

function fieldLabel(field: DraftField) {
  return {
    service: "Service",
    details: "Description",
    location: "Location",
    preferredDate: "Preferred date",
    preferredTime: "Preferred time",
  }[field];
}

export function ChatAssistant() {
  const [currentLocation, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [draftMode, setDraftMode] = useState(false);
  const [expectedField, setExpectedField] = useState<DraftField | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [usingGuide, setUsingGuide] = useState(false);
  const [session, setSession] = useState(getSession);
  const endRef = useRef<HTMLDivElement>(null);
  const confirmLock = useRef(false);

  useEffect(() => {
    setSession(getSession());
  }, [currentLocation, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, draft, awaitingConfirmation]);

  function append(message: ChatMessage) {
    setMessages((current) => [...current, message]);
  }

  function appendFieldPrompt(nextDraft: Draft) {
    const firstMissingField = firstMissing(nextDraft);
    const missing = firstMissingField ?? (nextDraft.details.trim().length < 10 ? "details" : null);
    setExpectedField(missing);
    setAwaitingConfirmation(!missing && isComplete(nextDraft));
    if (missing) {
      append(
        makeMessage(
          "assistant",
          missing === "details" && nextDraft.details.trim().length > 0
            ? "Could you add a little more detail? The request form needs at least 10 characters."
            : fieldPrompts[missing],
        ),
      );
    } else if (isComplete(nextDraft)) {
      append(
        makeMessage(
          "assistant",
          "I’ve filled in the draft. Review the summary below; nothing is submitted until you press “Confirm & create request.”",
        ),
      );
    } else {
      append(
        makeMessage("assistant", "Please add a little more detail about the job so the request is useful."),
      );
    }
  }

  async function sendText(rawText: string) {
    const text = rawText.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    append(makeMessage("user", text));

    const lower = text.toLowerCase();
    if (awaitingConfirmation && isAffirmative(text)) {
      append(
        makeMessage(
          "assistant",
          "To avoid creating a request by accident, use the “Confirm & create request” button on the summary below.",
        ),
      );
      setSending(false);
      return;
    }

    if (/\b(cancel draft|start over|discard request)\b/i.test(text) && draftMode) {
      setDraft(emptyDraft());
      setDraftMode(false);
      setExpectedField(null);
      setAwaitingConfirmation(false);
      append(makeMessage("assistant", "I cleared that draft. Nothing was submitted. Tell me what you need whenever you’re ready."));
      setSending(false);
      return;
    }

    if (/\b(my bookings|my jobs|booking status|job status|status of|check my request|incoming jobs)\b/i.test(text)) {
      const result = statusReply();
      append(makeMessage("assistant", result.content, result.action));
      setSending(false);
      return;
    }

    if (/^(open |show |go to )?(my )?(bookings|jobs|dashboard)\b/i.test(text)) {
      append(makeMessage("assistant", "Opening your bookings.", { label: "Open bookings", href: "/dashboard" }));
      setLocation("/dashboard");
      setSending(false);
      return;
    }

    if (/\b(find a fundi|browse fundis|search fundis|look for a fundi)\b/i.test(text)) {
      append(
        makeMessage(
          "assistant",
          "I can’t verify live fundi availability from this browser-only prototype. Open search to review the marketplace listings.",
          { label: "Find a Fundi", href: "/search" },
        ),
      );
      setSending(false);
      return;
    }

    if (/\b(available|availability|which fundi|who can do)\b/i.test(text) && /\b(fundi|plumb|electric|carpenter|cleaner|mechanic)\b/i.test(text)) {
      append(
        makeMessage(
          "assistant",
          "I can’t verify live availability in this prototype. Open search to review the marketplace listings and their displayed details.",
          { label: "Find a Fundi", href: "/search" },
        ),
      );
      setSending(false);
      return;
    }

    if (session?.role === "fundi" && /\b(profile|skills|availability|incoming job)\b/i.test(text)) {
      append(
        makeMessage(
          "assistant",
          "Open your fundi dashboard to review incoming jobs and use the availability toggle. Profile and skills editing aren’t implemented in this prototype.",
          { label: "Open fundi dashboard", href: "/dashboard" },
        ),
      );
      setSending(false);
      return;
    }

    if (/\b(how it works|how does skill.?link|explain skill.?link)\b/i.test(text)) {
      append(makeMessage("assistant", helpReply(text), { label: "How it works", href: "/how-it-works" }));
      setSending(false);
      return;
    }

    if (/\b(report (?:a )?(?:problem|issue)|something is broken|problem with the app)\b/i.test(text)) {
      append(makeMessage("assistant", helpReply("report a problem")));
      setSending(false);
      return;
    }

    const startingRequest = !draftMode && isJobRequest(text);
    const inJobFlow = draftMode || startingRequest;
    const baseDraft = startingRequest ? emptyDraft() : draft;
    const nextMessages = [...messages, { id: "pending", role: "user" as const, content: text }];
    let nextDraft = baseDraft;
    let assistantReply = "";
    let aiFailed = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-18).map(({ role, content }) => ({ role, content })),
          draft: baseDraft,
          accountType: session?.role ?? "guest",
        }),
      });
      if (!response.ok) throw new Error(`Assistant endpoint returned ${response.status}`);
      const result = (await response.json()) as ApiResult;
      nextDraft = mergeDraft(baseDraft, result.draft);
      assistantReply = result.reply?.trim() ?? "";
    } catch {
      aiFailed = true;
      nextDraft = localDraftUpdate(text, baseDraft, startingRequest ? null : expectedField, startingRequest);
    }

    if (aiFailed) setUsingGuide(true);

    const foundDraft = fields.some((field) => Boolean(nextDraft[field].trim()));
    const shouldContinueDraft = inJobFlow || foundDraft;
    if (shouldContinueDraft) {
      setDraftMode(true);
      setDraft(nextDraft);
      appendFieldPrompt(nextDraft);
    } else {
      append(makeMessage("assistant", assistantReply || helpReply(text)));
    }

    setSending(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendText(input);
  }

  function confirmRequest() {
    if (confirmLock.current || !isComplete(draft)) return;
    if (!session) {
      append(makeMessage("assistant", "Sign in or create a customer account to save this request. Your draft is still here."));
      setLocation("/auth?mode=signup");
      return;
    }
    if (session.role !== "customer") {
      append(makeMessage("assistant", "A fundi account can review incoming work but cannot submit a customer request. Sign in with a customer account to continue."));
      return;
    }

    confirmLock.current = true;
    setConfirming(true);
    try {
      const created = createJob({
        customerId: session.id,
        customerName: session.name,
        service: draft.service,
        details: draft.details,
        location: draft.location,
        preferredDate: draft.preferredDate,
        preferredTime: draft.preferredTime,
      });
      setAwaitingConfirmation(false);
      setExpectedField(null);
      append(
        makeMessage(
          "assistant",
          `Your request (${created.id}) was saved to this browser’s SkillLink bookings with status “${created.status}.” This prototype does not sync it to a server.`,
          { label: "View bookings", href: "/dashboard" },
        ),
      );
      setDraft(emptyDraft());
      setDraftMode(false);
    } finally {
      setConfirming(false);
      confirmLock.current = false;
    }
  }

  function cancelDraft() {
    setDraft(emptyDraft());
    setDraftMode(false);
    setExpectedField(null);
    setAwaitingConfirmation(false);
    append(makeMessage("assistant", "Draft cleared. No request was created."));
  }

  const canSend = Boolean(input.trim()) && !sending;

  return (
    <>
      {open && (
        <section
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[60] flex h-[min(680px,calc(100dvh-7rem))] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[min(410px,calc(100vw-2rem))]"
          role="dialog"
          aria-label="SkillLink chat assistant"
          data-testid="chat-assistant-panel"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-[#f4f8f3] px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">SkillLink Assistant</p>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${usingGuide ? "bg-accent" : "bg-primary"}`} />
                  {usingGuide ? "Guided mode" : "Marketplace help"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-muted-foreground transition hover:bg-card hover:text-foreground"
              aria-label="Close chat"
              data-testid="button-close-assistant"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-background/70 px-3 py-4 sm:px-4" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-[13px] leading-5 ${
                    message.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-border bg-card text-foreground shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-line">{message.content}</p>
                  {message.action && (
                    <button
                      onClick={() => setLocation(message.action!.href)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-secondary px-3 py-1.5 text-xs font-bold text-primary"
                    >
                      {message.action.label}
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {draftMode && (
              <div className="mx-auto w-full max-w-[340px] rounded-2xl border border-primary/20 bg-card p-4 shadow-[var(--shadow-card)]" data-testid="assistant-job-summary">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-secondary text-primary"><Wrench size={15} /></span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">Request draft</p>
                    <p className="text-sm font-bold">{draft.service || "Service not selected"}</p>
                  </div>
                </div>
                <dl className="space-y-2 text-xs">
                  {fields.filter((field) => field !== "service").map((field) => {
                    const Icon = field === "location" ? MapPin : field === "preferredDate" ? CalendarDays : field === "preferredTime" ? Clock3 : Wrench;
                    return (
                      <div key={field} className="flex gap-2">
                        <Icon size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <dt className="sr-only">{fieldLabel(field)}</dt>
                          <dd className="break-words">
                            <span className="font-semibold text-foreground">{fieldLabel(field)}: </span>
                            <span className={draft[field] ? "text-muted-foreground" : "italic text-muted-foreground/70"}>
                              {draft[field] || "Not provided yet"}
                            </span>
                          </dd>
                        </div>
                      </div>
                    );
                  })}
                </dl>
                {awaitingConfirmation ? (
                  <div className="mt-4 grid gap-2">
                    <button
                      onClick={confirmRequest}
                      disabled={confirming}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground transition hover:brightness-95 disabled:opacity-60"
                      data-testid="button-confirm-assistant-job"
                    >
                      {confirming ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
                      Confirm &amp; create request
                    </button>
                    <button onClick={cancelDraft} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted">
                      Cancel draft
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                    {firstMissing(draft) ? `Next: ${fieldLabel(firstMissing(draft)!)}.` : "Add a little more detail before reviewing."}
                  </p>
                )}
              </div>
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-3 text-xs text-muted-foreground">
                  <LoaderCircle size={14} className="animate-spin text-primary" />
                  Thinking…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <footer className="shrink-0 border-t border-border bg-card p-3 sm:p-4">
            {messages.length === 1 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {["Find a service", "My bookings", "How it works"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => void sendText(suggestion)}
                    className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-primary/20">
              <label className="sr-only" htmlFor="skilllink-assistant-input">Message the SkillLink assistant</label>
              <textarea
                id="skilllink-assistant-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendText(input);
                  }
                }}
                rows={1}
                maxLength={800}
                placeholder={draftMode ? "Answer the next question…" : "Ask about services or jobs…"}
                className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
                data-testid="input-assistant-message"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:brightness-95 disabled:opacity-45"
                aria-label="Send message"
                data-testid="button-assistant-send"
              >
                <Send size={16} />
              </button>
            </form>
            <p className="mt-2 text-center text-[10px] leading-4 text-muted-foreground">
              Prototype · Requests save in this browser. Don’t share passwords or secrets.
              {!usingGuide && <span> If configured, chat text is sent to the AI provider.</span>}
              {usingGuide && <span> Add OPENAI_API_KEY to enable AI replies.</span>}
            </p>
          </footer>
        </section>
      )}

      <button
        onClick={() => {
          setSession(getSession());
          setOpen((value) => !value);
        }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-[61] inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_12px_30px_rgba(18,84,53,.26)] transition hover:-translate-y-0.5 hover:brightness-95 sm:bottom-6 sm:right-6"
        aria-label={open ? "Close chat assistant" : "Open SkillLink chat assistant"}
        aria-expanded={open}
        data-testid="button-open-assistant"
      >
        {open ? <X size={18} /> : <MessageCircle size={18} />}
        <span>{open ? "Close chat" : "Chat with us"}</span>
      </button>
    </>
  );
}