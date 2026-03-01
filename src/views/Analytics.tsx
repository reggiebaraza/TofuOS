'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchProjects,
  fetchSources,
  getProjectInsights,
  getChatMessages,
  type Project,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { BarChart3, ChevronLeft, FolderOpen, FileText, MessageSquare, Sparkles } from "lucide-react";

export interface ProjectStats {
  project: Project;
  sourcesCount: number;
  insightsCount: number;
  messagesCount: number;
}

const chartConfig = {
  sources: { label: "Sources", color: "hsl(var(--primary))" },
  messages: { label: "Chat messages", color: "hsl(142 76% 36%)" },
};

const Analytics = () => {
  const [stats, setStats] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setError(null);

    async function load() {
      try {
        const projects = await fetchProjects();
        if (!mounted) return;
        if (!projects.length) {
          setStats([]);
          setLoading(false);
          return;
        }

        const results = await Promise.all(
          projects.map(async (project) => {
            const [sources, insights, messages] = await Promise.all([
              fetchSources(project.id),
              getProjectInsights(project.id),
              getChatMessages(project.id),
            ]);
            return {
              project,
              sourcesCount: sources.length,
              insightsCount: insights.length,
              messagesCount: messages.length,
            };
          }),
        );
        if (mounted) {
          setStats(results);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Failed to load analytics");
          setStats([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const totalProjects = stats.length;
  const totalSources = stats.reduce((s, x) => s + x.sourcesCount, 0);
  const totalInsights = stats.reduce((s, x) => s + x.insightsCount, 0);
  const totalMessages = stats.reduce((s, x) => s + x.messagesCount, 0);

  const chartData = stats
    .slice(0, 10)
    .map((s) => ({
      name: s.project.name.length > 14 ? s.project.name.slice(0, 14) + "…" : s.project.name,
      sources: s.sourcesCount,
      messages: s.messagesCount,
    }));

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border panel-bg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/" className="rounded-lg">
              <ChevronLeft className="w-5 h-5" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Analytics
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {loading ? "—" : totalProjects}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {loading ? "—" : totalSources}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Chat messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {loading ? "—" : totalMessages}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {loading ? "—" : totalInsights}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        {!loading && chartData.length > 0 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Activity by project</CardTitle>
              <CardDescription>
                Sources and chat messages per project (up to 10 projects)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <BarChart data={chartData} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="sources" fill="var(--color-sources)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="messages" fill="var(--color-messages)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Per-project table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Project breakdown</CardTitle>
            <CardDescription>
              Counts per project for sources, chat messages, and saved insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">Loading…</p>
            ) : error ? (
              <p className="text-sm text-destructive py-4 text-center">{error}</p>
            ) : stats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No projects yet. Create one from the app header.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Sources</TableHead>
                    <TableHead className="text-right">Chat messages</TableHead>
                    <TableHead className="text-right">Insights</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map(({ project, sourcesCount, messagesCount, insightsCount }) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{sourcesCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{messagesCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{insightsCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
