// @ts-ignore Deno remote imports are resolved by the Supabase Edge Runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type UniversityResearchPayload = {
  university_id?: string;
  level?: ProgramLevel;
};

type ProgramLevel = 'undergraduate' | 'master';

type UniversityRow = {
  id: string;
  name: string;
  undergraduate_courses_url: string | null;
  master_courses_url: string | null;
};

type ParsedProgram = {
  program_name: string;
  degree: string;
  duration: string;
  url: string;
  level: ProgramLevel;
  source_url: string;
  matched_departments: string[];
  match_status: 'matched' | 'needs_manual_review';
  match_notes: string;
};

type DepartmentKeywordRule = {
  department_name: string | null;
  required_match_keywords: string[] | null;
  major_keywords: string[] | null;
  priority: number | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  let payload: UniversityResearchPayload;

  try {
    payload = (await req.json()) as UniversityResearchPayload;
    console.log('UNIVERSITY_RESEARCH_REQUEST_BODY:', payload);
  } catch (error) {
    console.error('UNIVERSITY_RESEARCH_ERROR:', error);
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const validationError = validatePayload(payload);

  if (validationError) {
    return jsonResponse({ success: false, error: validationError }, 400);
  }

  const level = payload.level as ProgramLevel;
  console.log('UNIVERSITY_RESEARCH_UNIVERSITY_ID:', payload.university_id);
  console.log('UNIVERSITY_RESEARCH_LEVEL:', level);

  const supabaseUrl = Deno.env.get('PROJECT_SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('PROJECT_SUPABASE_SERVICE_ROLE_KEY');
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, error: 'Missing Supabase service configuration' }, 500);
  }

  if (!firecrawlApiKey) {
    return jsonResponse({ success: false, error: 'Firecrawl API key is not configured' }, 500);
  }

  try {
    console.log('SUPABASE URL EXISTS:', !!supabaseUrl);
    console.log('SERVICE ROLE EXISTS:', !!serviceRoleKey);
    console.log('FIRECRAWL KEY EXISTS:', !!firecrawlApiKey);
    console.log('SUPABASE URL VALUE:', supabaseUrl);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: university, error } = await supabase
      .from('universities')
      .select('id, name, undergraduate_courses_url, master_courses_url')
      .eq('id', payload.university_id)
      .maybeSingle<UniversityRow>();
    console.log('UNIVERSITY_RESEARCH_UNIVERSITY_QUERY_RESULT:', { university, error });

    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    if (!university) {
      return jsonResponse({ success: false, error: 'University not found' }, 404);
    }

    const { data: departmentKeywordRules, error: departmentKeywordRulesError } = await supabase
      .from('department_keyword_rules')
      .select('department_name, required_match_keywords, major_keywords, priority')
      .eq('is_active', true)
      .order('priority', { ascending: true });
    console.log('UNIVERSITY_RESEARCH_DEPARTMENT_KEYWORD_RULES:', {
      count: departmentKeywordRules?.length || 0,
      error: departmentKeywordRulesError,
    });

    if (departmentKeywordRulesError) {
      return jsonResponse({ success: false, error: departmentKeywordRulesError.message }, 500);
    }

    const courseUrl = level === 'undergraduate'
      ? university.undergraduate_courses_url
      : university.master_courses_url;
    console.log('UNIVERSITY_RESEARCH_SELECTED_COURSE_URL:', courseUrl);

    if (!courseUrl?.trim()) {
      return jsonResponse(
        { success: false, error: 'Course URL is not configured for this university and level' },
        400,
      );
    }

    console.log('UNIVERSITY_RESEARCH_FIRECRAWL_REQUEST_START:', { url: courseUrl });
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: courseUrl,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });
    console.log('UNIVERSITY_RESEARCH_FIRECRAWL_RESPONSE_STATUS:', firecrawlResponse.status);

    const firecrawlResponseText = await firecrawlResponse.clone().text();
    console.log('UNIVERSITY_RESEARCH_FIRECRAWL_RESPONSE_BODY_FIRST_1000:', firecrawlResponseText.slice(0, 1000));

    if (!firecrawlResponse.ok) {
      console.error('Firecrawl scrape failed', firecrawlResponse.status, firecrawlResponseText);

      return jsonResponse({ success: false, error: 'Firecrawl scrape failed' }, 502);
    }

    const firecrawlData = await firecrawlResponse.json();
    const markdown = getMarkdown(firecrawlData);

    if (!markdown?.trim()) {
      return jsonResponse({ success: false, error: 'Firecrawl did not return markdown' }, 502);
    }
    console.log('UNIVERSITY_RESEARCH_MARKDOWN_LENGTH:', markdown.length);

    const programs = applyDepartmentKeywordRules(
      parseProgramsFromMarkdown(markdown, level),
      (departmentKeywordRules || []) as DepartmentKeywordRule[],
    );
    console.log('UNIVERSITY_RESEARCH_PARSED_PROGRAM_COUNT:', programs.length);
    const rows = programs.map((program) => ({
      university_id: university.id,
      name: program.program_name,
      program_name: program.program_name,
      degree: program.degree,
      duration: program.duration,
      url: program.url,
      level: program.level,
      matched_departments: program.matched_departments,
      match_status: program.match_status,
      match_notes: program.match_notes,
      source_url: program.source_url,
      updated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      console.log('UNIVERSITY_RESEARCH_UPSERT_START:', { row_count: rows.length });
      const { error: upsertError } = await supabase
        .from('university_programs')
        .upsert(rows, { onConflict: 'university_id,url' });

      if (upsertError) {
        console.error('UNIVERSITY_RESEARCH_UPSERT_ERROR:', upsertError);
        return jsonResponse({ success: false, error: upsertError.message }, 500);
      }
    }

    const successResponse = {
      success: true,
      university: {
        id: university.id,
        name: university.name,
        course_url: courseUrl,
        level,
      },
      scrape: {
        markdown_length: markdown.length,
        program_count: programs.length,
        upserted_count: rows.length,
      },
      programs,
    };
    console.log('UNIVERSITY_RESEARCH_FINAL_SUCCESS_RESPONSE:', successResponse);

    return jsonResponse(successResponse, 200);
  } catch (error) {
    console.error('UNIVERSITY_RESEARCH_ERROR:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ success: false, error: message }, 500);
  }
});

function validatePayload(payload: UniversityResearchPayload) {
  if (!payload.university_id?.trim()) {
    return 'university_id is required';
  }

  if (payload.level !== 'undergraduate' && payload.level !== 'master') {
    return 'level must be undergraduate or master';
  }

  return null;
}

function getMarkdown(data: unknown) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const response = data as { markdown?: unknown; data?: { markdown?: unknown } };

  if (typeof response.markdown === 'string') {
    return response.markdown;
  }

  if (typeof response.data?.markdown === 'string') {
    return response.data.markdown;
  }

  return null;
}

function parseProgramsFromMarkdown(markdown: string, level: ProgramLevel) {
  const programs: ParsedProgram[] = [];
  const regex = /- \[([^\]]+)\]\((https?:\/\/[^\)]+)\)\s*\n\n([A-Za-z&\/\s]+)\s*\n\n([^\n]+)/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    const title = match[1]?.trim();
    const url = match[2]?.trim();
    const degree = match[3]?.trim() || '';
    const duration = match[4]?.trim() || '';

    if (!title || !url) continue;

    const lowerTitle = title.toLowerCase();
    const lowerDegree = degree.toLowerCase();

    const shouldSkip =
      lowerTitle.includes('foundation') ||
      lowerDegree.includes('foundation') ||
      lowerDegree.includes('ugcert') ||
      lowerDegree.includes('ugdip') ||
      lowerDegree.includes('certificate') ||
      lowerDegree.includes('diploma');

    if (shouldSkip) continue;

    programs.push({
      program_name: title,
      degree,
      duration,
      url,
      level,
      source_url: url,
      matched_departments: [],
      match_status: 'needs_manual_review',
      match_notes: 'Department matching not applied yet',
    });
  }

  return programs;
}

function applyDepartmentKeywordRules(programs: ParsedProgram[], rules: DepartmentKeywordRule[]) {
  const sortedRules = [...rules]
    .filter((rule) => rule.department_name?.trim())
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  return programs.map((program) => {
    const normalizedProgram = program.program_name.toLowerCase();
    const matchedDepartments = new Set<string>();
    const matchedKeywords = new Set<string>();

    sortedRules.forEach((rule) => {
      const departmentName = rule.department_name?.trim();
      if (!departmentName) return;

      const requiredKeywords = normalizeKeywords(rule.required_match_keywords);
      const majorKeywords = normalizeKeywords(rule.major_keywords);
      const matchingKeyword = [...requiredKeywords, ...majorKeywords]
        .find((keyword) => normalizedProgram.includes(keyword.toLowerCase()));

      if (!matchingKeyword) return;

      matchedDepartments.add(departmentName);
      matchedKeywords.add(matchingKeyword);
    });

    if (matchedDepartments.size === 0) {
      return program;
    }

    return {
      ...program,
      matched_departments: Array.from(matchedDepartments),
      match_status: 'matched' as const,
      match_notes: `Matched by department keyword rules: ${Array.from(matchedKeywords).join(', ')}`,
    };
  });
}

function normalizeKeywords(keywords: string[] | null) {
  return (keywords || [])
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
