import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const MAX_PER_SOURCE = 25000; // per-source truncation for storage

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + '\n\n[... truncated for length ...]';
}

/**
 * Sanitize extracted text before storing.
 * Remove backslashes so no \u sequence can be interpreted as a Unicode escape
 * (avoids "unsupported Unicode escape sequence" in parsers/DB).
 */
function sanitizeExtractedText(s: string): string {
  if (typeof s !== "string" || !s.length) return s;
  return s.replace(/\\/g, "");
}

/** Ensure string is safe to send to DB/JSON (no invalid surrogates or control chars). */
function safeForDb(s: string | null): string | null {
  if (s == null || typeof s !== "string") return s;
  const noControl = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");
  const noBadSurrogates = noControl.replace(/[\uD800-\uDFFF]/g, "");
  return noBadSurrogates;
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
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          let rawText: string | null = null;

          try {
            const pdfParse = (await import('pdf-parse')).default;
            const data = await pdfParse(buffer);
            rawText = data?.text ? String(data.text).trim() : null;
          } catch (_err) {
            try {
              const { getDocumentProxy, extractText } = await import('unpdf');
              const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
              const out = await extractText(pdf, { mergePages: true });
              rawText = out?.text ? String(out.text).trim() : null;
            } catch (_unpdfErr) {
              rawText = null;
            }
          }

          const cleaned = rawText ? sanitizeExtractedText(rawText) : '';
          content = cleaned ? truncate(cleaned, MAX_PER_SOURCE) : null;
          if (!content) console.warn('[upload-documents] PDF produced no text:', name);
        } else if (lower.endsWith('.txt') || file.type === 'text/plain') {
          const text = await file.text();
          content = truncate(sanitizeExtractedText(text), MAX_PER_SOURCE);
        }
        // .doc, .docx, .xls, .xlsx: no extraction for now; source is still created with content null
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.warn('[upload-documents] Extract error for', name, errMsg);
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
          content: safeForDb(content),
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
