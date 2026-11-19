"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import type { Thread } from "@/lib/types";

const SUGGESTED = ["Question about my statement", "Update my contact information", "Schedule a review", "Contribution question"];

/** New conversation when threadId is omitted, otherwise a reply. */
export function MessageComposer({ threadId, defaultSubject = "" }: { threadId?: string; defaultSubject?: string }) {
  const router = useRouter();
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setErrors({});
    try {
      if (threadId) {
        await apiFetch<Thread>(`/api/messages/${threadId}`, { method: "POST", body: { body } });
        setBody("");
        toast.success("Reply sent");
        router.refresh();
      } else {
        const thread = await apiFetch<Thread>("/api/messages", { method: "POST", body: { subject, body } });
        toast.success("Message sent to your branch");
        router.push(`/messages/${thread.id}`);
      }
    } catch (error) {
      setErrors(fieldErrors(error));
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-4">
      {!threadId && (
        <div>
          <Label htmlFor="subject" className="mb-1.5">
            Subject
          </Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(s)}
                className="rounded-full border border-border px-2.5 py-0.5 text-[12px] text-muted-foreground hover:border-forest-700 hover:text-forest-800"
              >
                {s}
              </button>
            ))}
          </div>
          {errors.subject && <p className="mt-1 text-[12px] text-destructive">{errors.subject}</p>}
        </div>
      )}
      <div>
        <Label htmlFor="body" className={threadId ? "sr-only" : "mb-1.5"}>
          Message
        </Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={threadId ? 4 : 8}
          maxLength={4000}
          placeholder={threadId ? "Write a reply…" : "How can your branch team help?"}
        />
        <div className="mt-1 flex justify-between text-[11.5px] text-muted-foreground">
          <span className="text-destructive">{errors.body}</span>
          <span className="tabular">{body.length.toLocaleString()} / 4,000</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-muted-foreground">Your branch typically replies within one business day.</p>
        <Button type="submit" disabled={sending || !body.trim() || (!threadId && !subject.trim())}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />} {threadId ? "Send reply" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
