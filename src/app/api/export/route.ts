import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import JSZip from "jszip";
import { format } from "date-fns";

function interviewToMarkdown(
  interview: {
    title: string;
    status: string;
    summary: string | null;
    insights: string | null;
    createdAt: string | Date;
    persona: { name: string; role: string; company: string | null; industry: string | null };
    messages: { role: string; content: string; createdAt: string | Date }[];
  }
): string {
  let md = `# ${interview.title}\n\n`;
  md += `**Persona:** ${interview.persona.name} — ${interview.persona.role}`;
  if (interview.persona.company) md += ` at ${interview.persona.company}`;
  md += `\n`;
  if (interview.persona.industry) md += `**Industry:** ${interview.persona.industry}\n`;
  md += `**Date:** ${format(new Date(interview.createdAt), "PPP 'at' p")}\n`;
  md += `**Status:** ${interview.status}\n\n`;
  md += `---\n\n## Transcript\n\n`;

  for (const msg of interview.messages) {
    const speaker = msg.role === "user" ? "**Interviewer**" : `**${interview.persona.name}**`;
    md += `${speaker}: ${msg.content}\n\n`;
  }

  if (interview.insights) {
    try {
      const insights = JSON.parse(interview.insights);
      md += `---\n\n## Insights\n\n`;
      if (insights.summary) md += `### Summary\n${insights.summary}\n\n`;
      if (insights.painPoints?.length) {
        md += `### Pain Points\n`;
        for (const p of insights.painPoints) md += `- ${p}\n`;
        md += `\n`;
      }
      if (insights.themes?.length) {
        md += `### Themes\n`;
        for (const t of insights.themes) md += `- ${t}\n`;
        md += `\n`;
      }
      if (insights.keyQuotes?.length) {
        md += `### Key Quotes\n`;
        for (const q of insights.keyQuotes) md += `> ${q}\n\n`;
      }
    } catch {
      // insights not valid JSON, skip
    }
  }

  return md;
}

function interviewToJson(interview: {
  id: string;
  title: string;
  status: string;
  summary: string | null;
  insights: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  persona: { name: string; role: string; company: string | null; industry: string | null };
  messages: { role: string; content: string; createdAt: string | Date }[];
}) {
  return {
    id: interview.id,
    title: interview.title,
    status: interview.status,
    date: interview.createdAt,
    persona: interview.persona,
    messages: interview.messages.map((m) => ({
      speaker: m.role === "user" ? "Interviewer" : interview.persona.name,
      role: m.role,
      content: m.content,
      timestamp: m.createdAt,
    })),
    insights: interview.insights ? JSON.parse(interview.insights) : null,
    summary: interview.summary,
  };
}

function interviewsToCsv(
  interviews: {
    id: string;
    title: string;
    status: string;
    summary: string | null;
    insights: string | null;
    createdAt: string | Date;
    persona: { name: string; role: string; company: string | null; industry: string | null };
    messages: { role: string; content: string; createdAt: string | Date }[];
  }[]
): string {
  const headers = [
    "Interview ID",
    "Title",
    "Persona",
    "Role",
    "Company",
    "Industry",
    "Date",
    "Status",
    "Messages",
    "Summary",
    "Pain Points",
    "Themes",
  ];

  const rows = interviews.map((i) => {
    let painPoints = "";
    let themes = "";
    if (i.insights) {
      try {
        const ins = JSON.parse(i.insights);
        painPoints = (ins.painPoints || []).join("; ");
        themes = (ins.themes || []).join("; ");
      } catch {
        // skip
      }
    }
    return [
      i.id,
      i.title,
      i.persona.name,
      i.persona.role,
      i.persona.company || "",
      i.persona.industry || "",
      format(new Date(i.createdAt), "yyyy-MM-dd"),
      i.status,
      String(i.messages.length),
      i.summary || "",
      painPoints,
      themes,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { interviewIds, format: exportFormat } = await req.json();

    if (!interviewIds?.length) {
      return NextResponse.json(
        { error: "No interviews selected" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: interviewRows, error: interviewError } = await supabase
      .from("interviews")
      .select("*")
      .in("id", interviewIds)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (interviewError || !interviewRows?.length) {
      return NextResponse.json(
        { error: "No interviews found" },
        { status: 404 }
      );
    }

    const personaIds = [...new Set(interviewRows.map((r) => r.persona_id))];
    const { data: personaRows } = await supabase
      .from("personas")
      .select("id, name, role, company, industry")
      .in("id", personaIds);
    const personaMap = new Map((personaRows || []).map((p) => [p.id, p]));

    const { data: allMessages } = await supabase
      .from("messages")
      .select("interview_id, role, content, created_at")
      .in("interview_id", interviewRows.map((r) => r.id))
      .order("created_at", { ascending: true });

    const messagesByInterview = new Map<string, { role: string; content: string; createdAt: string }[]>();
    for (const m of allMessages || []) {
      const list = messagesByInterview.get(m.interview_id) || [];
      list.push({
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      });
      messagesByInterview.set(m.interview_id, list);
    }

    const interviews = interviewRows.map((row) => {
      const persona = personaMap.get(row.persona_id) ?? {
        name: "",
        role: "",
        company: null as string | null,
        industry: null as string | null,
      };
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        summary: row.summary,
        insights: row.insights,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        persona: {
          name: persona.name,
          role: persona.role,
          company: persona.company ?? null,
          industry: persona.industry ?? null,
        },
        messages: messagesByInterview.get(row.id) ?? [],
      };
    });

    if (interviews.length === 1 && exportFormat !== "csv") {
      const interview = interviews[0];
      if (exportFormat === "json") {
        return NextResponse.json(interviewToJson(interview));
      }
      const md = interviewToMarkdown(interview);
      return new Response(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${interview.title.replace(/[^a-z0-9]/gi, "_")}.md"`,
        },
      });
    }

    if (exportFormat === "csv") {
      const csv = interviewsToCsv(interviews);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="interviews_export.csv"',
        },
      });
    }

    const zip = new JSZip();

    for (const interview of interviews) {
      const safeName = interview.title.replace(/[^a-z0-9]/gi, "_");
      if (exportFormat === "json") {
        zip.file(`${safeName}.json`, JSON.stringify(interviewToJson(interview), null, 2));
      } else {
        zip.file(`${safeName}.md`, interviewToMarkdown(interview));
      }
    }

    const summaryData = {
      exportDate: new Date().toISOString(),
      totalInterviews: interviews.length,
      interviews: interviews.map((i) => interviewToJson(i)),
    };
    zip.file("summary.json", JSON.stringify(summaryData, null, 2));

    const zipBuffer = await zip.generateAsync({ type: "uint8array" });

    return new Response(zipBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="interviews_export.zip"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to export" },
      { status: 500 }
    );
  }
}
