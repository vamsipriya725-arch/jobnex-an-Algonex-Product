import { nanoid } from "nanoid";

export interface AgentThread {
  id: string;
  title: string;
  createdAt?: string;
}

export interface AgentStoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts?: any[];
  content?: string;
  createdAt?: string;
}

const STORAGE_THREADS_KEY = "jobnex_agent_threads";
const STORAGE_MESSAGES_KEY = "jobnex_agent_messages";

function getLocalThreads(): AgentThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_THREADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalThreads(threads: AgentThread[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_THREADS_KEY, JSON.stringify(threads));
  } catch {
    // ignore
  }
}

export async function listThreads(): Promise<AgentThread[]> {
  const threads = getLocalThreads();
  if (threads.length === 0) {
    const defaultThread: AgentThread = {
      id: nanoid(),
      title: "Career Assistant",
      createdAt: new Date().toISOString(),
    };
    saveLocalThreads([defaultThread]);
    return [defaultThread];
  }
  return threads;
}

export async function createThread(): Promise<AgentThread> {
  const newThread: AgentThread = {
    id: nanoid(),
    title: "New chat",
    createdAt: new Date().toISOString(),
  };
  const threads = getLocalThreads();
  saveLocalThreads([newThread, ...threads]);
  return newThread;
}

export async function deleteThread({ data }: { data: { threadId: string } }): Promise<void> {
  const threads = getLocalThreads().filter((t) => t.id !== data.threadId);
  saveLocalThreads(threads);
}

export async function getThreadMessages({
  data,
}: {
  data: { threadId: string };
}): Promise<AgentStoredMessage[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_MESSAGES_KEY}_${data.threadId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
