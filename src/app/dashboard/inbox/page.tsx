"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Send, MessageCircle, FileText, Download, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface Conversation {
  counterparty_number: string;
  last_text: string | null;
  last_media_filename: string | null;
  last_direction: string;
  last_message_type: string;
  last_at: string;
  first_name: string | null;
  last_name: string | null;
  emp_id: string | null;
  company_name: string | null;
  message_count: number;
}

interface ThreadMessage {
  id: string;
  direction: "inbound" | "outbound";
  messageType: string;
  textBody: string | null;
  mediaFilename: string | null;
  attachmentToken: string | null;
  status: string;
  error: string | null;
  createdAt: string;
}

interface ThreadIdentity {
  firstName: string | null;
  lastName: string | null;
  empId: string | null;
  companyName: string | null;
}

interface ThreadResponse {
  number: string;
  identity: ThreadIdentity | null;
  messages: ThreadMessage[];
}

function conversationName(c: Conversation): string {
  if (c.first_name) return `${c.first_name} ${c.last_name ?? ""}`.trim();
  return c.counterparty_number;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const res = await fetch("/api/inbox");
      if (!cancelled && res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
      }
    }
    tick();
    const interval = setInterval(tick, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    async function tick() {
      const res = await fetch(`/api/inbox/${selected}`);
      if (!cancelled && res.ok) setThread(await res.json());
    }
    tick();
    const interval = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  async function handleSend() {
    if (!selected || (!draft.trim() && !file)) return;
    setSending(true);
    try {
      const formData = new FormData();
      if (draft.trim()) formData.append("text", draft.trim());
      if (file) formData.append("file", file);
      const res = await fetch(`/api/inbox/${selected}/reply`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Couldn't send — they may be outside the 24-hour reply window");
        return;
      }
      setDraft("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      const threadRes = await fetch(`/api/inbox/${selected}`);
      if (threadRes.ok) setThread(await threadRes.json());
    } finally {
      setSending(false);
    }
  }

  const selectedConversation = conversations?.find((c) => c.counterparty_number === selected);

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-6xl">
      <div className="flex w-80 shrink-0 flex-col border-r">
        <div className="border-b px-4 py-3">
          <h1 className="text-lg font-semibold">Inbox</h1>
          <p className="text-xs text-muted-foreground">Replies from employees, across every company</p>
        </div>
        <ScrollArea className="flex-1">
          {conversations === null ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground">
              <MessageCircle className="size-6" />
              No messages yet — when employees reply, they&apos;ll show up here.
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.counterparty_number}
                onClick={() => setSelected(c.counterparty_number)}
                className={`flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors hover:bg-muted ${
                  selected === c.counterparty_number ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{conversationName(c)}</span>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(c.last_at)}</span>
                </div>
                {c.company_name && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Building2 className="size-3" />
                    {c.company_name}
                  </span>
                )}
                <span className="truncate text-xs text-muted-foreground">
                  {c.last_direction === "outbound" ? "You: " : ""}
                  {c.last_text ?? (c.last_media_filename ? `📎 ${c.last_media_filename}` : "…")}
                </span>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      <div className="flex flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <MessageCircle className="size-8" />
            Select a conversation to view messages
          </div>
        ) : (
          <>
            <div className="border-b px-4 py-3">
              <div className="text-sm font-medium">
                {selectedConversation ? conversationName(selectedConversation) : selected}
              </div>
              <div className="text-xs text-muted-foreground">{selected}</div>
            </div>

            <ScrollArea className="flex-1 px-4 py-4">
              <div className="flex flex-col gap-3">
                {thread?.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                        m.direction === "outbound"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {m.textBody && <p className="whitespace-pre-wrap">{m.textBody}</p>}
                      {m.mediaFilename && (
                        <a
                          href={
                            m.attachmentToken
                              ? `/api/chat-attachments/${m.attachmentToken}`
                              : undefined
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center gap-1.5 rounded-md bg-background/20 px-2 py-1.5 text-xs underline"
                        >
                          <FileText className="size-3.5" />
                          {m.mediaFilename}
                          <Download className="size-3" />
                        </a>
                      )}
                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                        {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        {m.direction === "outbound" && (
                          <Badge variant="outline" className="h-4 border-current px-1 text-[9px]">
                            {m.status}
                          </Badge>
                        )}
                      </div>
                      {m.error && <p className="mt-1 text-[10px] text-destructive-foreground">{m.error}</p>}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="border-t p-3">
              {file && (
                <div className="mb-2 flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                  <Paperclip className="size-3.5" />
                  {file.name}
                  <button onClick={() => setFile(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                    ✕
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="size-4" />
                </Button>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  className="min-h-9 flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button onClick={handleSend} disabled={sending || (!draft.trim() && !file)}>
                  <Send />
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Replies only deliver within 24 hours of the employee&apos;s last message — WhatsApp&apos;s own rule,
                not ours.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
