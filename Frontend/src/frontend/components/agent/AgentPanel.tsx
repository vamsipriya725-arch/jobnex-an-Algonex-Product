// AI agent side panel: a floating button on every page opens a slide-in panel
// with multiple saved chats. Threads and messages live in the database per
// signed-in user; the model call streams through /api/chat.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, X, Plus, Trash2, MessageSquare, LogIn } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Link } from "@/lib/nav";
import {
  createThread,
  deleteThread,
  getThreadMessages,
  listThreads,
  type AgentStoredMessage,
  type AgentThread,
} from "@/lib/agent.functions";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/frontend/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/frontend/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/frontend/components/ai-elements/prompt-input";
import { Shimmer } from "@/frontend/components/ai-elements/shimmer";

export function AgentPanel() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setSignedIn(true);
      if (event === "SIGNED_OUT") setSignedIn(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Open AI assistant"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-brand-600 text-cream shadow-lg transition-transform hover:scale-105 active:scale-95 p-3.5"
      >
        <Bot className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-label="JobNex AI assistant"
            className="absolute inset-y-0 right-0 flex w-full max-w-[400px] flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-cream">
                  <Bot className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Nexa</p>
                  <p className="text-[11px] text-slate-500">JobNex career assistant</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close assistant"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {signedIn === false ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
                <LogIn className="h-8 w-8 text-brand-500" />
                <p className="text-sm font-medium text-slate-900">Sign in to chat with Nexa</p>
                <p className="text-xs text-slate-500">
                  Your conversations are saved to your account so you can pick them up on any
                  device.
                </p>
                <Link
                  href="/login"
                  className="mt-1 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-cream shadow-sm hover:bg-brand-700"
                >
                  Go to login
                </Link>
              </div>
            ) : signedIn ? (
              <AgentChat />
            ) : null}
          </aside>
        </div>
      )}
    </>
  );
}

function AgentChat() {
  const [threads, setThreads] = useState<AgentThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showThreads, setShowThreads] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let list = await listThreads();
        if (list.length === 0) {
          const created = await createThread();
          list = [created];
        }
        if (cancelled) return;
        setThreads(list);
        setActiveThreadId(list[0]?.id ?? null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load chats.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNewChat = useCallback(async () => {
    const created = await createThread();
    setThreads((prev) => [created, ...prev]);
    setActiveThreadId(created.id);
    setShowThreads(false);
  }, []);

  const handleDelete = useCallback(
    async (threadId: string) => {
      await deleteThread({ data: { threadId } });
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== threadId);
        if (activeThreadId === threadId) setActiveThreadId(next[0]?.id ?? null);
        return next;
      });
    },
    [activeThreadId],
  );

  if (loadError) {
    return <p className="p-4 text-xs text-red-600">{loadError}</p>;
  }
  if (!activeThreadId) {
    return <p className="p-4 text-xs text-slate-500">Loading your chats…</p>;
  }

  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <button
          type="button"
          onClick={() => setShowThreads((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100"
          aria-expanded={showThreads}
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{activeThread?.title ?? "New chat"}</span>
        </button>
        <button
          type="button"
          onClick={handleNewChat}
          className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-100"
        >
          <Plus className="h-3.5 w-3.5" /> New chat
        </button>
      </div>

      {showThreads && (
        <div className="max-h-44 overflow-y-auto border-b border-slate-200 bg-slate-50">
          {threads.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs ${
                t.id === activeThreadId ? "bg-brand-50 text-brand-800" : "text-slate-600"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveThreadId(t.id);
                  setShowThreads(false);
                }}
                className="min-w-0 flex-1 truncate text-left font-medium"
              >
                {t.title}
              </button>
              <button
                type="button"
                aria-label={`Delete chat ${t.title}`}
                onClick={() => handleDelete(t.id)}
                className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ChatWindow key={activeThreadId} threadId={activeThreadId} />
    </div>
  );
}

function ChatWindow({ threadId }: { threadId: string }) {
  // Sends the caller's session token with every request so /api/chat can
  // verify the user and scope the thread.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId },
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const headers = new Headers(init?.headers);
          if (data.session?.access_token) {
            headers.set("Authorization", `Bearer ${data.session.access_token}`);
          }
          return fetch(input, { ...init, headers });
        },
      }),
    [threadId],
  );

  const { messages, setMessages, status, sendMessage, stop, error } = useChat({
    id: threadId,
    transport,
  });

  const [historyLoaded, setHistoryLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = (await getThreadMessages({ data: { threadId } })) as AgentStoredMessage[];
        if (cancelled) return;
        setMessages(rows.map((r) => ({ id: r.id, role: r.role, parts: r.parts }) as UIMessage));
      } catch {
        // History is best-effort; the chat still works without it.
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId, setMessages]);

  const busy = status === "submitted" || status === "streaming";
  const composerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (historyLoaded && !busy) {
      composerRef.current?.querySelector("textarea")?.focus();
    }
  }, [historyLoaded, busy, threadId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="gap-4 px-3 py-3">
          {messages.length === 0 && historyLoaded && (
            <ConversationEmptyState
              title="Ask Nexa anything"
              description="Job suggestions from current listings, resume tips, interview prep, and career questions."
              icon={<Bot className="h-6 w-6 text-brand-500" />}
            />
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.parts?.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "assistant" ? (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ) : (
                      <span key={i}>{part.text}</span>
                    );
                  }
                  if (part.type === "reasoning") {
                    return (
                      <p key={i} className="text-[11px] italic text-slate-400">
                        {part.text}
                      </p>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && (
            <Shimmer className="text-xs text-slate-500">Thinking…</Shimmer>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              Something went wrong. Please try sending again.
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-slate-200 p-3" ref={composerRef}>
        <PromptInput
          onSubmit={(message) => {
            if (!message.text?.trim() || busy) return;
            sendMessage({ text: message.text });
          }}
        >
          <PromptInputTextarea
            placeholder="Ask about jobs, resumes, interviews…"
            className="text-sm"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
