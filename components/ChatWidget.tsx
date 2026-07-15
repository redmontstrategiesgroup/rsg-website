"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { postJson } from "@/lib/api";
import { trackEvent } from "@/lib/events";

/** Emitted by /api/chat when a lead is submitted mid-conversation. */
const QUALIFIED_LEAD_SENTINEL = "⁣";

type ChatMessage = { role: "user" | "assistant"; content: string };

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Looking to improve lead flow, follow-up, operations, or AI implementation? I can help point you in the right direction.",
};

const QUICK_REPLIES = [
  "What does RSG do?",
  "I want a Business Systems Audit",
  "Book a strategy call",
];

/** Render assistant text with bare URLs as links (e.g. the booking link). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    // Mirror of the server's conversation cap — save the round trip.
    if (messages.length > 40) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "This conversation has reached its limit. The best next step is the contact form in the Contact section. Share your details there and RSG will review your business directly.",
        },
      ]);
      setInput("");
      return;
    }

    const history = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(history);
    setInput("");
    setBusy(true);

    try {
      // The greeting is UI copy, not part of the model conversation.
      const res = await postJson("/api/chat", { messages: history.slice(1) });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              data.error ??
              "Something went wrong. Please try again, or use the contact form below.",
          },
        ]);
        return;
      }

      // Stream the reply token by token into a growing assistant message.
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        let chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        if (chunk.includes(QUALIFIED_LEAD_SENTINEL)) {
          trackEvent("chatbot_qualified_lead");
          chunk = chunk.replaceAll(QUALIFIED_LEAD_SENTINEL, "");
          if (!chunk) continue;
        }
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          next[next.length - 1] = {
            ...last,
            content: last.content + chunk,
          };
          return next;
        });
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Network error. Please try again, or use the contact form below.",
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const showQuickReplies = messages.length === 1 && !busy;

  return (
    <>
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            trackEvent("chatbot_open");
          }}
          className="fixed bottom-5 right-5 z-50 border border-white/20 bg-base-900 px-5 py-3 text-[0.65rem] font-medium uppercase tracking-[0.22em] text-white/75 shadow-card transition-colors hover:border-white/45 hover:text-white"
          aria-label="Open chat with Redmont Strategies Group"
        >
          Chat
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Chat with Redmont Strategies Group"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-4 right-4 z-50 flex h-[min(620px,calc(100dvh-5rem))] w-[min(400px,calc(100%-2rem))] flex-col border border-white/15 bg-base-900 shadow-lift sm:bottom-6 sm:right-6"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/rsg-mark.png"
                  alt="RSG"
                  className="h-6 w-auto"
                />
                <span className="text-[0.58rem] uppercase tracking-[0.24em] text-white/40">
                  Assistant
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center text-white/50 transition-colors hover:text-white"
                aria-label="Close chat"
              >
                <X size={16} />
              </button>
            </div>

            <div
              ref={scrollRef}
              data-lenis-prevent
              className="flex-1 space-y-5 overflow-y-auto px-5 py-5"
            >
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[85%] border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm leading-relaxed text-white/90">
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="max-w-[92%]">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">
                      <Linkified text={m.content} />
                      {busy && i === messages.length - 1 && (
                        <span className="ml-1 inline-block h-3.5 w-[2px] animate-pulse-soft bg-crimson-light align-middle" />
                      )}
                    </p>
                  </div>
                )
              )}

              {showQuickReplies && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK_REPLIES.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        if (q === "I want a Business Systems Audit") {
                          trackEvent("business_systems_audit_click", {
                            location: "chat_quick_reply",
                          });
                        }
                        void send(q);
                      }}
                      className="border border-white/15 px-3 py-2 text-left text-xs text-white/60 transition-colors hover:border-white/40 hover:text-white"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {busy && messages[messages.length - 1]?.role === "user" && (
                <div className="h-px w-8 animate-pulse-soft bg-white/30" />
              )}
            </div>

            <form onSubmit={onSubmit} className="border-t border-white/10 p-3.5">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question"
                  maxLength={2000}
                  className="w-full border border-white/15 bg-transparent px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 transition-colors focus:border-white/50 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="shrink-0 border border-white/20 px-4 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-white/75 transition-colors hover:border-white/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send
                </button>
              </div>
              <p className="mt-2.5 text-center text-[0.6rem] text-white/25">
                Ready to talk?{" "}
                <Link
                  href="/book"
                  onClick={() =>
                    trackEvent("book_strategy_call_click", { location: "chat" })
                  }
                  className="text-white/50 underline decoration-white/25 underline-offset-2 transition-colors hover:text-white"
                >
                  Book a Strategy Call
                </Link>
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
