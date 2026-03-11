/** Map Supabase snake_case row to camelCase for API responses (match former Prisma shape). */
export function personaRowToJson(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    avatarEmoji: row.avatar_emoji ?? "👤",
    age: row.age,
    role: row.role,
    company: row.company,
    companySize: row.company_size,
    industry: row.industry,
    experienceYears: row.experience_years,
    background: row.background,
    toolsUsed: row.tools_used,
    painPoints: row.pain_points,
    communicationStyle: row.communication_style,
    personality: row.personality,
    systemPrompt: row.system_prompt,
    isTemplate: row.is_template ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function interviewRowToJson(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    personaId: row.persona_id,
    title: row.title,
    status: row.status ?? "active",
    summary: row.summary,
    insights: row.insights,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function messageRowToJson(row: Record<string, unknown>) {
  return {
    id: row.id,
    interviewId: row.interview_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}
