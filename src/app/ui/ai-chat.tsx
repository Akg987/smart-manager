"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, parseApiBody } from "@/lib/api";

type ChatResult = {
  conversationId: string;
  message: {
    content: string;
    sourceReferences?: Array<{ id: string; title: string; kind: string }>;
  };
  recommendations: Array<{
    id: string;
    recommendationKey: string;
    details: Record<string, unknown>;
    status: string;
  }>;
};

type StoredConversation = {
  id: string | number;
  title: string;
};
const recommendationStatusLabel: Record<string, string> = {
  pending: "در انتظار بررسی",
  accepted: "پذیرفته‌شده",
  proposed: "پیشنهادی",
  rejected: "ردشده",
  applied: "اجراشده",
  completed: "تکمیل‌شده",
  dismissed: "ردشده",
};

async function recoverCompletedChat(question: string): Promise<ChatResult | null> {
  for (let attempt = 0; attempt < 7; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const listResponse = await apiFetch("/api/ai/conversations", {
      headers: { "accept-language": "fa" },
    }).catch(() => null);
    if (!listResponse?.ok) continue;
    const listBody = parseApiBody<StoredConversation[]>(
      await listResponse.json().catch(() => null),
    );
    const conversation = listBody.payload?.find(
      (item) => item.title === question,
    );
    if (!conversation) continue;

    const detailResponse = await apiFetch(
      `/api/ai/conversations/${conversation.id}`,
      { headers: { "accept-language": "fa" } },
    ).catch(() => null);
    if (!detailResponse?.ok) continue;
    const detailBody = parseApiBody<{
      messages?: Array<{
        role: string;
        content: string;
        sourceReferences?: ChatResult["message"]["sourceReferences"];
      }>;
      recommendations?: ChatResult["recommendations"];
    }>(await detailResponse.json().catch(() => null));
    const message = detailBody.payload.messages
      ?.filter((item) => item.role === "assistant" && item.content.trim())
      .at(-1);
    if (!message) continue;
    return {
      conversationId: String(conversation.id),
      message: {
        content: message.content,
        sourceReferences: message.sourceReferences,
      },
      recommendations: detailBody.payload.recommendations ?? [],
    };
  }
  return null;
}

export function AiChatPage() {
  const [question, setQuestion] = useState("");
  const [company, setCompany] = useState("");
  const [result, setResult] = useState<ChatResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [approverUserId, setApproverUserId] = useState("");
  const [dueAt, setDueAt] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/api/ai/context", { headers: { "accept-language": "fa" } })
      .then(async (response) => {
        const body = parseApiBody<{
          company?: { id: string | number };
          canAnalyze?: boolean;
          analysisPaused?: boolean;
        }>(await response.json());
        if (!response.ok)
          throw new Error(body.message || "دسترسی به دستیار هوشمند مجاز نیست.");
        if (active) {
          setCompany(String(body.payload.company?.id ?? ""));
          setConfigured(body.payload.canAnalyze === true);
          if (body.payload.analysisPaused)
            setError(
              "تحلیل خارجی تا تعیین مقصد سرویس و تأیید محدودهٔ اشتراک داده متوقف است.",
            );
        }
      })
      .catch(
        (reason: unknown) =>
          active &&
          setError(
            reason instanceof Error
              ? reason.message
              : "خطا در دریافت محدودهٔ دسترسی.",
          ),
      );
    return () => {
      active = false;
    };
  }, []);

  async function send() {
    if (!question.trim() || loading) return;
    const submittedQuestion = question.trim();
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept-language": "fa",
        },
        body: JSON.stringify({
          question: submittedQuestion,
          companyId: company ? Number(company) : undefined,
          conversationId: result?.conversationId
            ? Number(result.conversationId)
            : undefined,
        }),
      });
      const body = parseApiBody<ChatResult>(
        await response.json().catch(() => null),
      );
      if (!response.ok)
        throw new Error(body.message || "پاسخ دستیار دریافت نشد.");
      setResult(body.payload);
      setQuestion("");
    } catch (reason) {
      const recovered = await recoverCompletedChat(submittedQuestion).catch(
        () => null,
      );
      if (recovered) {
        setResult(recovered);
        setQuestion("");
        setError("");
        return;
      }
      setError(
        reason instanceof Error
          ? reason.message
          : "ارتباط با دستیار انجام نشد.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function decide(id: string, decision: "accepted" | "rejected") {
    if (!result) return;
    try {
      const response = await apiFetch(
        `/api/ai/conversations/${result.conversationId}/recommendations/${id}/review`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "accept-language": "fa",
          },
          body: JSON.stringify({
            decision,
            ...(decision === "accepted"
              ? {
                  departmentId: Number(departmentId),
                  ownerUserId: Number(ownerUserId),
                  approverUserId: Number(approverUserId),
                  dueAt,
                }
              : {}),
          }),
        },
      );
      const body = parseApiBody<unknown>(await response.json());
      if (!response.ok) throw new Error(body.message || "ثبت تصمیم انجام نشد.");
      setResult({
        ...result,
        recommendations: result.recommendations.map((row) =>
          row.id === id ? { ...row, status: decision } : row,
        ),
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "ثبت تصمیم انجام نشد.",
      );
    }
  }

  return (
    <section className="mx-auto grid max-w-5xl gap-5" dir="rtl">
      <header className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm font-medium text-primary">
          تحلیل مبتنی بر داده‌های مجاز
        </p>
        <h1 className="mt-2 text-2xl font-bold">دستیار هوشمند مدیریت</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          پاسخ‌ها فقط از شاخص‌های کلیدی عملکرد، پرچم‌های قرمز، اقدامات و مشاهدات در محدودهٔ دسترسی
          شما استفاده می‌کنند.
        </p>
      </header>
      <div className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
        <label className="mb-2 block text-sm font-medium" htmlFor="ai-question">
          سؤال مدیریتی
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="ai-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void send();
            }}
            placeholder="مثلاً روند شاخص‌های این دوره چه تغییری کرده؟"
            maxLength={12000}
          />
          <Button
            type="button"
            onClick={() => void send()}
            disabled={loading || !question.trim() || !configured}
          >
            {loading ? "در حال تحلیل…" : "تحلیل"}
          </Button>
        </div>
        {!configured && (
          <p className="mt-3 text-sm text-muted-foreground">
            تحلیل برای این نقش در دسترس نیست یا سرویس AI پیکربندی نشده است.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
      {result && (
        <>
          <article className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
            <h2 className="text-lg font-semibold">پاسخ</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
              {result.message.content}
            </p>
            {!!result.message.sourceReferences?.length && (
              <div className="mt-5 border-t pt-4">
                <h3 className="text-sm font-semibold">منابع داده</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {result.message.sourceReferences.map((source) => (
                    <li
                      key={source.id}
                      className="rounded-full bg-muted px-3 py-1 text-xs"
                    >
                      {source.title} · {source.kind}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
          {!!result.recommendations.length && (
            <section className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
              <h2 className="text-lg font-semibold">
                پیشنهادهای نیازمند تصمیم مدیر
              </h2>
              <div className="mt-3 grid gap-3">
                {result.recommendations.map((recommendation) => (
                  <article
                    key={recommendation.id}
                    className="rounded-lg border p-4"
                  >
                    <h3 className="font-medium">
                      {String(recommendation.details.title ?? "پیشنهاد")}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {String(recommendation.details.description ?? "")}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      شاخص موفقیت:{" "}
                      {String(
                        recommendation.details.successMetric ??
                          "تعریف پس از بررسی مدیر",
                      )}
                    </p>
                    {recommendation.status === "pending" && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <Input
                          type="number"
                          min="1"
                          value={departmentId}
                          onChange={(event) =>
                            setDepartmentId(event.target.value)
                          }
                          placeholder="شناسه واحد سازمانی"
                          aria-label="شناسه واحد سازمانی"
                        />
                        <Input
                          type="number"
                          min="1"
                          value={ownerUserId}
                          onChange={(event) =>
                            setOwnerUserId(event.target.value)
                          }
                          placeholder="شناسه مسئول اقدام"
                          aria-label="شناسه مسئول اقدام"
                        />
                        <Input
                          type="number"
                          min="1"
                          value={approverUserId}
                          onChange={(event) =>
                            setApproverUserId(event.target.value)
                          }
                          placeholder="شناسه تأییدکننده"
                          aria-label="شناسه تأییدکننده"
                        />
                        <Input
                          value={dueAt}
                          onChange={(event) => setDueAt(event.target.value)}
                          placeholder="موعد شمسی، مانند ۱۴۰۵/۰۸/۱۵"
                          aria-label="موعد شمسی"
                        />
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="me-auto text-xs text-muted-foreground">
                        وضعیت: {recommendationStatusLabel[recommendation.status] ?? recommendation.status}
                      </span>
                      {recommendation.status === "pending" && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() =>
                              void decide(recommendation.id, "rejected")
                            }
                          >
                            رد پیشنهاد
                          </Button>
                          <Button
                            disabled={
                              !departmentId ||
                              !ownerUserId ||
                              !approverUserId ||
                              !dueAt
                            }
                            onClick={() =>
                              void decide(recommendation.id, "accepted")
                            }
                          >
                            پذیرش و ایجاد اقدام
                          </Button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
