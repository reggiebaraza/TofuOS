import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const MAX_PER_SOURCE = 25000; // per-source truncation for storage

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + '\n\n[... truncated for length ...]';
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ message: 'Server configuration missing' }, { status: 500 });
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const formData = await req.formData();
    const projectId = formData.get('projectId');
    const files = formData.getAll('files') as File[];
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return NextResponse.json({ message: 'projectId is required' }, { status: 400 });
    }
    if (!files?.length) {
      return NextResponse.json({ message: 'At least one file is required' }, { status: 400 });
    }

    const results: { id: string; name: string; type: string; content: string | null }[] = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;
      const name = file.name || 'Untitled';
      const lower = name.toLowerCase();
      let content: string | null = null;

      try {
        if (lower.endsWith('.pdf')) {
          const { PDFParse } = await import('pdf-parse');
          const arrayBuffer = await file.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);
          const parser = new PDFParse({ data });
          const result = await parser.getText();
          await parser.destroy();
          const rawText =
            typeof result === 'string'
              ? result
              : result?.text ?? (Array.isArray((result as { pages?: { text?: string }[] })?.pages)
                  ? (result as { pages: { text?: string }[] }).pages.map((p) => p?.text ?? '').join('\n\n')
                  : '');
          content = rawText && String(rawText).trim() ? truncate(String(rawText).trim(), MAX_PER_SOURCE) : null;
          if (!content) console.warn('[upload-documents] PDF produced no text:', name);
        } else if (lower.endsWith('.txt') || file.type === 'text/plain') {
          const text = await file.text();
          content = truncate(text, MAX_PER_SOURCE);
        }
        // .doc, .docx, .xls, .xlsx: no extraction for now; source is still created with content null
      } catch (e) {
        console.error('Extract error for', name, e);
        content = null;
      }

      const type = lower.endsWith('.pdf') ? 'pdf' : 'document';
      const { data: row, error } = await supabase
        .from('sources')
        .insert({
          name,
          type,
          selected: true,
          project_id: projectId.trim(),
          user_id: user.id,
          content,
        })
        .select('id, name, type, content')
        .single();

      if (error) {
        console.error('Insert source error:', error);
        return NextResponse.json({ message: error.message || 'Failed to save source' }, { status: 500 });
      }
      results.push({
        id: row.id,
        name: row.name,
        type: row.type,
        content: row.content ?? null,
      });
    }

    return NextResponse.json(results);
  } catch (error: unknown) {
    console.error('Upload documents error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ message }, { status: 500 });
  }
}
