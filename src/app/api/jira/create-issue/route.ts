import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ message: 'Server configuration missing' }, { status: 500 });
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ message: 'Not authenticated - No token provided' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth Error:', authError);
      return NextResponse.json({ message: 'Not authenticated - Invalid token' }, { status: 401 });
    }

    const params = await req.json();

    const { data: config, error: configError } = await supabase
      .from('jira_configs')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (configError || !config) {
      return NextResponse.json({ message: 'Jira not configured' }, { status: 400 });
    }

    const { domain, email, api_token } = config;
    const projectKey = params.projectKey;

    if (!projectKey) {
      return NextResponse.json({ message: 'Project key is required' }, { status: 400 });
    }
    if (!domain || !email || !api_token) {
      return NextResponse.json({ message: 'Jira not configured. Add your Jira domain, email, and API token in Settings.' }, { status: 400 });
    }

    const issueType = params.issueType || 'Task';

    const response = await fetch(`https://${domain}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${email}:${api_token}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          project: {
            key: projectKey
          },
          summary: params.summary,
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: params.description || params.summary
                  }
                ]
              }
            ]
          },
          issuetype: {
            name: issueType
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({
        message: errorData?.errors ? Object.values(errorData.errors).join(', ') : 'Failed to create Jira issue'
      }, { status: response.status });
    }

    const jiraResult = await response.json();
    const issueUrl = `https://${domain}/browse/${jiraResult.key}`;

    await supabase
      .from('jira_configs')
      .update({ last_project_key: projectKey })
      .eq('user_id', user.id);

    // Save to project exports list when projectId provided (so it appears under Analysis)
    const projectId = params.projectId;
    if (projectId && typeof projectId === 'string' && projectId.trim()) {
      const { error: insertError } = await supabase
        .from('project_jira_exports')
        .insert({
          project_id: projectId.trim(),
          summary: params.summary || jiraResult.key,
          jira_key: jiraResult.key,
          jira_url: issueUrl,
        });
      if (insertError) {
        console.error('Failed to save export record:', insertError);
        // Still return success for the issue creation; client can retry or show list on next load
      }
    }

    return NextResponse.json({
      key: jiraResult.key,
      id: jiraResult.id,
      url: issueUrl
    });
  } catch (error: any) {
    console.error('Server Error:', error);
    return NextResponse.json({ message: error.message || 'Failed to create Jira issue' }, { status: 500 });
  }
}
