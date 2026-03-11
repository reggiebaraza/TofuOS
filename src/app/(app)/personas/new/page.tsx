"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERSONA_TEMPLATES } from "@/lib/persona-templates";

type Tab = "create" | "generate" | "templates";

export default function NewPersonaPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("templates");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    avatarEmoji: "👤",
    age: "",
    role: "",
    company: "",
    companySize: "",
    industry: "",
    experienceYears: "",
    background: "",
    toolsUsed: "",
    painPoints: "",
    communicationStyle: "",
    personality: "",
  });

  const [genParams, setGenParams] = useState({
    role: "",
    company: "",
    companySize: "",
    industry: "",
    experienceYears: "",
    additionalContext: "",
  });

  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const savePersona = async (data: Record<string, unknown>) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      router.push("/personas");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save persona");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.role) {
      setError("Name and role are required");
      return;
    }
    await savePersona(form);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...genParams,
          experienceYears: genParams.experienceYears
            ? parseInt(genParams.experienceYears)
            : undefined,
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const persona = await res.json();
      await savePersona(persona);
    } catch {
      setError("Failed to generate persona. Make sure your Gemini API key is configured.");
      setLoading(false);
    }
  };

  const handleTemplate = async (templateIndex: number) => {
    const template = PERSONA_TEMPLATES[templateIndex];
    await savePersona({ ...template });
  };

  const tabStyle = (t: Tab) => ({
    background: tab === t ? "var(--card)" : "transparent",
    color: tab === t ? "var(--foreground)" : "var(--muted)",
    borderColor: tab === t ? "var(--card-border)" : "transparent",
  });

  const inputStyle = {
    background: "var(--card)",
    borderColor: "var(--card-border)",
    color: "var(--foreground)",
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-4 text-sm transition-colors hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          ← Back
        </button>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          New Persona
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Create a PM persona to interview
        </p>
      </div>

      <div
        className="mb-6 flex gap-1 rounded-xl p-1"
        style={{ background: "var(--muted-bg)" }}
      >
        {(["templates", "create", "generate"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(""); }}
            className="flex-1 rounded-lg border px-2 py-2 text-xs font-medium capitalize transition-all sm:px-3 sm:text-sm"
            style={tabStyle(t)}
          >
            {t === "create" ? "Manual" : t === "generate" ? "AI Generate" : "Templates"}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: "#ff3b3014", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      {tab === "create" && (
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={inputStyle}
                placeholder="e.g., Sarah Chen"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Emoji</label>
              <input
                type="text"
                value={form.avatarEmoji}
                onChange={(e) => updateForm("avatarEmoji", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={inputStyle}
                maxLength={4}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Role *</label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => updateForm("role", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={inputStyle}
                placeholder="e.g., Senior Product Manager"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Age</label>
              <input
                type="number"
                value={form.age}
                onChange={(e) => updateForm("age", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={inputStyle}
                placeholder="32"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Company</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => updateForm("company", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={inputStyle}
                placeholder="e.g., Stripe"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Company Size</label>
              <input
                type="text"
                value={form.companySize}
                onChange={(e) => updateForm("companySize", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={inputStyle}
                placeholder="e.g., Series B, ~200 people"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Industry</label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => updateForm("industry", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={inputStyle}
                placeholder="e.g., FinTech"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Years of Experience</label>
              <input
                type="number"
                value={form.experienceYears}
                onChange={(e) => updateForm("experienceYears", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={inputStyle}
                placeholder="5"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Background</label>
            <textarea
              value={form.background}
              onChange={(e) => updateForm("background", e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={inputStyle}
              rows={3}
              placeholder="Career history, education, how they got into PM..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Tools Used</label>
            <textarea
              value={form.toolsUsed}
              onChange={(e) => updateForm("toolsUsed", e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={inputStyle}
              rows={2}
              placeholder="Jira, Figma, Amplitude, Notion..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>
              Pain Points
              <span className="ml-1 font-normal" style={{ color: "var(--muted)" }}>(hidden — revealed naturally in conversation)</span>
            </label>
            <textarea
              value={form.painPoints}
              onChange={(e) => updateForm("painPoints", e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={inputStyle}
              rows={4}
              placeholder="Specific frustrations, challenges, blockers..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Communication Style</label>
            <textarea
              value={form.communicationStyle}
              onChange={(e) => updateForm("communicationStyle", e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={inputStyle}
              rows={2}
              placeholder="Data-driven, storyteller, blunt, diplomatic..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Personality</label>
            <textarea
              value={form.personality}
              onChange={(e) => updateForm("personality", e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={inputStyle}
              rows={2}
              placeholder="Key traits, strengths, rough edges..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Creating..." : "Create Persona"}
          </button>
        </form>
      )}

      {tab === "generate" && (
        <form onSubmit={handleGenerate} className="space-y-4">
          <div
            className="rounded-xl p-4 text-sm"
            style={{ background: "var(--accent-light)", color: "var(--accent)" }}
          >
            Describe the type of PM you want to interview. AI will generate a complete, realistic persona with backstory, pain points, and personality.
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Role</label>
            <input
              type="text"
              value={genParams.role}
              onChange={(e) => setGenParams((p) => ({ ...p, role: e.target.value }))}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={inputStyle}
              placeholder="e.g., Senior PM, VP of Product, First PM hire"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Company</label>
            <input
              type="text"
              value={genParams.company}
              onChange={(e) => setGenParams((p) => ({ ...p, company: e.target.value }))}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={inputStyle}
              placeholder="e.g., Mercedes, a YC startup, or leave blank for AI to decide"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Company Size</label>
              <input
                type="text"
                value={genParams.companySize}
                onChange={(e) => setGenParams((p) => ({ ...p, companySize: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={inputStyle}
                placeholder="e.g., 50 people, Fortune 500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Industry</label>
              <input
                type="text"
                value={genParams.industry}
                onChange={(e) => setGenParams((p) => ({ ...p, industry: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={inputStyle}
                placeholder="e.g., HealthTech, FinTech, Developer Tools"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>Years of Experience</label>
            <input
              type="number"
              value={genParams.experienceYears}
              onChange={(e) => setGenParams((p) => ({ ...p, experienceYears: e.target.value }))}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={inputStyle}
              placeholder="e.g., 5"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }}>
              Additional Context
              <span className="ml-1 font-normal">(optional)</span>
            </label>
            <textarea
              value={genParams.additionalContext}
              onChange={(e) => setGenParams((p) => ({ ...p, additionalContext: e.target.value }))}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={inputStyle}
              rows={3}
              placeholder="Any extra details: 'PM at Mercedes who just went through a reorg', 'Ex-engineer turned PM struggling with stakeholder management'..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Generating with AI..." : "Generate Persona with AI"}
          </button>
        </form>
      )}

      {tab === "templates" && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Pre-built realistic PM personas. Add them to your library with one click.
          </p>
          {PERSONA_TEMPLATES.map((template, i) => (
            <div
              key={i}
              className="rounded-2xl border p-4 transition-all hover:shadow-sm sm:p-5"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                <span className="text-4xl">{template.avatarEmoji}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {template.name}
                  </h3>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {template.role} · {template.company}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {template.industry} · {template.experienceYears}y experience
                  </p>
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                    {template.background}
                  </p>
                </div>
                <button
                  onClick={() => handleTemplate(i)}
                  disabled={loading}
                  className="shrink-0 rounded-xl px-4 py-2 text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--accent)" }}
                >
                  {loading ? "..." : "Add"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
