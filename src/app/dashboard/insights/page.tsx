"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, CheckCircle2, Eye, MessageCircleReply, RefreshCw, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AnalyticsDay {
  date: string;
  total: number;
  delivered: number;
  read: number;
  failed: number;
  totalCredit: number;
  replyCount: number;
}

interface InsightsResponse {
  global: { days: AnalyticsDay[]; totals: AnalyticsDay & { avgDeliveryTime: number | null; totalCount: number } } | null;
  companies: {
    clientId: string;
    name: string;
    employeeCount: number;
    delivered: number;
    pending: number;
    failed: number;
  }[];
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/insights");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/insights")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = data?.global?.totals;
  const days = data?.global?.days ?? [];
  const maxDay = Math.max(1, ...days.map((d) => d.total));
  const deliveryRate = totals && totals.total > 0 ? Math.round((totals.delivered / totals.total) * 100) : null;
  const readRate = totals && totals.delivered > 0 ? Math.round((totals.read / totals.delivered) * 100) : null;
  const replyRate = totals && totals.delivered > 0 ? Math.round((totals.replyCount / totals.delivered) * 100) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BarChart3 className="size-5 text-muted-foreground" />
            Insights
          </h1>
          <p className="text-sm text-muted-foreground">
            Global numbers straight from MSG91&apos;s account, plus a per-company breakdown from your own data.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {!data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Global — last 30 days (your whole MSG91 account)
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Delivery rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-2xl font-semibold">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                    {deliveryRate ?? "—"}
                    {deliveryRate !== null && "%"}
                  </div>
                  <p className="text-xs text-muted-foreground">{totals?.delivered ?? 0} of {totals?.total ?? 0} sent</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Read rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-2xl font-semibold">
                    <Eye className="size-5 text-primary" />
                    {readRate ?? "—"}
                    {readRate !== null && "%"}
                  </div>
                  <p className="text-xs text-muted-foreground">of delivered messages</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg. delivery time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-2xl font-semibold">
                    <Timer className="size-5 text-muted-foreground" />
                    {totals?.avgDeliveryTime != null && totals.avgDeliveryTime >= 0
                      ? `${totals.avgDeliveryTime.toFixed(1)}s`
                      : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground">send to delivered</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Replies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-2xl font-semibold">
                    <MessageCircleReply className="size-5 text-primary" />
                    {totals?.replyCount ?? 0}
                    {replyRate !== null && <span className="text-sm font-normal text-muted-foreground">({replyRate}%)</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">of delivered messages replied to</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Messages per day</CardTitle>
            </CardHeader>
            <CardContent>
              {days.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No activity in the last 30 days.</p>
              ) : (
                <div className="flex h-40 items-end gap-1">
                  {days.map((d) => (
                    <Tooltip key={d.date}>
                      <TooltipTrigger asChild>
                        <div
                          className="flex-1 rounded-t bg-primary/80 transition-colors hover:bg-primary"
                          style={{ height: `${Math.max(4, (d.total / maxDay) * 100)}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{new Date(d.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
                        <p>{d.total} sent · {d.delivered} delivered · {d.read} read</p>
                        {d.failed > 0 && <p className="text-destructive">{d.failed} failed</p>}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Local — by company (from your own records)
            </p>
            <Card className="shadow-sm">
              <CardContent className="divide-y pt-6">
                {data.companies.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No companies yet.</p>
                ) : (
                  data.companies.map((c) => {
                    const total = c.delivered + c.pending + c.failed;
                    const rate = total > 0 ? Math.round((c.delivered / total) * 100) : null;
                    return (
                      <Link
                        key={c.clientId}
                        href={`/dashboard/companies/${c.clientId}`}
                        className="flex items-center justify-between py-3 hover:opacity-80"
                      >
                        <div>
                          <div className="text-sm font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.employeeCount} employees</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{rate ?? "—"}% delivered</span>
                          <Badge variant="default">{c.delivered} sent</Badge>
                          {c.failed > 0 && <Badge variant="destructive">{c.failed} failed</Badge>}
                        </div>
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
