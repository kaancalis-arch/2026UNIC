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
type ParserProfile = 'auto' | 'generic' | 'birmingham' | 'manchester' | 'leeds' | 'sheffield';

type ScrapeResult = {
  markdown: string;
  rawText: string;
  data: unknown;
};

type UniversityRow = {
  id: string;
  name: string;
  departments_url: string | null;
  undergraduate_courses_url: string | null;
  master_courses_url: string | null;
  parser_profile: string | null;
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
  duration_years: number | null;
  placement_year: boolean;
  internship: boolean;
  study_abroad: boolean;
  foundation_required: boolean;
  portfolio_required: boolean;
  delivery_mode: string;
  discipline_tags: string[];
  career_areas: string[];
};

type DepartmentKeywordRule = {
  keyword: string | null;
  matched_department: string | null;
  department_name: string | null;
  major_keywords: string[] | null;
  required_match_keywords: string[] | null;
  priority: number | null;
  is_active: boolean | null;
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
      .select('id, name, departments_url, undergraduate_courses_url, master_courses_url, parser_profile')
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
      .select(`
        keyword,
        matched_department,
        department_name,
        major_keywords,
        required_match_keywords,
        priority,
        is_active
      `)
      .eq('is_active', true)
      .order('priority', { ascending: true });
    console.log('UNIVERSITY_RESEARCH_DEPARTMENT_KEYWORD_RULES:', {
      count: departmentKeywordRules?.length || 0,
      error: departmentKeywordRulesError,
    });
    console.log(
      'DEPARTMENT_RULE_DEBUG',
      departmentKeywordRules?.slice(0, 5)
    );

    if (departmentKeywordRulesError) {
      return jsonResponse({ success: false, error: departmentKeywordRulesError.message }, 500);
    }

    const courseUrl = level === 'undergraduate'
      ? university.undergraduate_courses_url || university.departments_url
      : university.master_courses_url;
    const parserProfile = normalizeParserProfile(university.parser_profile);
    console.log('UNIVERSITY_RESEARCH_SELECTED_COURSE_URL:', courseUrl);
    console.log('UNIVERSITY_RESEARCH_SELECTED_PARSER_PROFILE:', parserProfile);

    if (!courseUrl?.trim()) {
      return jsonResponse(
        { success: false, error: `${level === 'undergraduate' ? 'Lisans' : 'Master'} program URL'si bu üniversite için tanımlı değil.` },
        400,
      );
    }

    const researchUrl = parserProfile === 'birmingham' && level === 'undergraduate'
      ? normalizeBirminghamCourseSearchUrl(courseUrl)
      : courseUrl;
    console.log('UNIVERSITY_RESEARCH_EFFECTIVE_COURSE_URL:', researchUrl);

    const scrapeResult = parserProfile === 'birmingham'
      ? await scrapeBirminghamCourses(researchUrl, level, firecrawlApiKey)
      : await scrapeSingleCoursePage(researchUrl, level, firecrawlApiKey, parserProfile);
    const markdown = scrapeResult.markdown;
    const parsedPrograms = scrapeResult.programs;

    const programs = applyDepartmentKeywordRules(
      parsedPrograms,
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
      duration_years: program.duration_years,
      placement_year: program.placement_year,
      internship: program.internship,
      study_abroad: program.study_abroad,
      foundation_required: program.foundation_required,
      portfolio_required: program.portfolio_required,
      delivery_mode: program.delivery_mode,
      discipline_tags: program.discipline_tags,
      career_areas: program.career_areas,
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
        course_url: researchUrl,
        level,
        parser_profile: parserProfile,
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

async function scrapeSingleCoursePage(courseUrl: string, level: ProgramLevel, firecrawlApiKey: string, parserProfile: ParserProfile) {
  const scrape = await scrapeCoursePage(courseUrl, firecrawlApiKey);
  let programs = parseProgramsByProfile(scrape.markdown, '', level, parserProfile, courseUrl);

  if (programs.length === 0 && shouldUseDirectFetchFallback(parserProfile)) {
    const directHtml = await fetchDirectHtml(courseUrl);
    programs = parseProgramsByProfile(scrape.markdown, directHtml, level, parserProfile, courseUrl);
  }

  return {
    markdown: scrape.markdown,
    programs,
  };
}

async function scrapeBirminghamCourses(baseUrl: string, level: ProgramLevel, firecrawlApiKey: string) {
  const firstPage = await scrapeCoursePage(baseUrl, firecrawlApiKey);
  const markdownLinks = extractMarkdownLinks(firstPage.markdown);
  const nextLink = findNextLink(markdownLinks);
  const courseLinks = extractBirminghamCourseLinks(markdownLinks, baseUrl);
  const allMarkdown: string[] = [firstPage.markdown];
  let allPrograms = parseProgramsByProfile(firstPage.markdown, '', level, 'birmingham', baseUrl);
  let firstPageDirectHtml = '';
  let firstPageHtmlLinks: Array<{ text: string; url: string }> = [];
  let firstPageHtmlNextLink: { text: string; url: string } | null = null;
  let firstPageHtmlCourseLinks: Array<{ text: string; url: string }> = [];

  console.log('BIRMINGHAM_MARKDOWN_LINK_COUNT:', markdownLinks.length);
  console.log('BIRMINGHAM_MARKDOWN_LINK_SAMPLE:', markdownLinks.slice(0, 20));
  console.log('BIRMINGHAM_PAGINATION_NEXT_LINK:', nextLink);
  console.log('BIRMINGHAM_COURSE_LINK_COUNT:', courseLinks.length);
  console.log('BIRMINGHAM_COURSE_LINK_SAMPLE:', courseLinks.slice(0, 20));
  console.log('BIRMINGHAM_FIRECRAWL_METADATA_URL:', getFirecrawlMetadataUrl(firstPage.data));

  if (allPrograms.length === 0 || courseLinks.length > allPrograms.length) {
    allPrograms = mergeParsedPrograms(allPrograms, courseLinks.map((link) => createParsedProgramFromLink(link, level)));
  }

  if (allPrograms.length === 0 || !nextLink) {
    firstPageDirectHtml = await fetchDirectHtml(baseUrl);
    allMarkdown.push(firstPageDirectHtml);
    firstPageHtmlLinks = extractHtmlLinks(firstPageDirectHtml);
    firstPageHtmlNextLink = findNextLink(firstPageHtmlLinks);
    firstPageHtmlCourseLinks = extractBirminghamCourseLinks(firstPageHtmlLinks, baseUrl);

    console.log('BIRMINGHAM_HTML_LINK_COUNT:', firstPageHtmlLinks.length);
    console.log('BIRMINGHAM_HTML_LINK_SAMPLE:', firstPageHtmlLinks.slice(0, 20));
    console.log('BIRMINGHAM_HTML_PAGINATION_NEXT_LINK:', firstPageHtmlNextLink);
    console.log('BIRMINGHAM_HTML_COURSE_LINK_COUNT:', firstPageHtmlCourseLinks.length);
    console.log('BIRMINGHAM_HTML_COURSE_LINK_SAMPLE:', firstPageHtmlCourseLinks.slice(0, 20));

    allPrograms = mergeParsedPrograms(allPrograms, parseProgramsByProfile(firstPage.markdown, firstPageDirectHtml, level, 'birmingham', baseUrl));
    allPrograms = mergeParsedPrograms(allPrograms, firstPageHtmlCourseLinks.map((link) => createParsedProgramFromLink(link, level)));
  }

  const detectedPageCount = detectPaginationPageCount([
    firstPage.markdown,
    firstPage.rawText,
    firstPageDirectHtml,
    ...markdownLinks.map((link) => `${link.text} ${link.url}`),
    ...firstPageHtmlLinks.map((link) => `${link.text} ${link.url}`),
  ].join('\n'));
  const birminghamCourseUrls = buildBirminghamUndergraduateUrls();
  const pageUrls = detectedPageCount
    ? birminghamCourseUrls.slice(0, detectedPageCount)
    : birminghamCourseUrls;

  console.log('BIRMINGHAM_PAGINATION_DETECTED_PAGE_COUNT:', detectedPageCount);
  console.log('BIRMINGHAM_PAGINATION_USING_PAGE_COUNT:', pageUrls.length);
  console.log('BIRMINGHAM_PAGINATION_URL_SAMPLE:', pageUrls.slice(0, 3));

  for (const pageUrl of pageUrls) {
    if (pageUrl === baseUrl) continue;

    try {
      const pageScrape = await scrapeCoursePage(pageUrl, firecrawlApiKey);
      const pageLinks = extractMarkdownLinks(pageScrape.markdown);
      const pageNextLink = findNextLink(pageLinks);
      const pageCourseLinks = extractBirminghamCourseLinks(pageLinks, pageUrl);
      const pagePrograms = parseProgramsByProfile(pageScrape.markdown, '', level, 'birmingham', pageUrl);
      allMarkdown.push(pageScrape.markdown);

      console.log('BIRMINGHAM_PAGE_SCRAPE_RESULT:', {
        page_url: pageUrl,
        metadata_url: getFirecrawlMetadataUrl(pageScrape.data),
        next_link: pageNextLink,
        markdown_link_count: pageLinks.length,
        course_link_count: pageCourseLinks.length,
        program_count: pagePrograms.length,
      });

      allPrograms = mergeParsedPrograms(allPrograms, pagePrograms);
      allPrograms = mergeParsedPrograms(allPrograms, pageCourseLinks.map((link) => createParsedProgramFromLink(link, level)));

      if (pagePrograms.length === 0 && pageCourseLinks.length === 0) {
        const directHtml = await fetchDirectHtml(pageUrl);
        const htmlLinks = extractHtmlLinks(directHtml);
        const htmlNextLink = findNextLink(htmlLinks);
        const htmlCourseLinks = extractBirminghamCourseLinks(htmlLinks, pageUrl);
        allMarkdown.push(directHtml);

        console.log('BIRMINGHAM_PAGE_HTML_FALLBACK_RESULT:', {
          page_url: pageUrl,
          next_link: htmlNextLink,
          html_link_count: htmlLinks.length,
          course_link_count: htmlCourseLinks.length,
        });

        allPrograms = mergeParsedPrograms(allPrograms, parseProgramsByProfile(pageScrape.markdown, directHtml, level, 'birmingham', pageUrl));
        allPrograms = mergeParsedPrograms(allPrograms, htmlCourseLinks.map((link) => createParsedProgramFromLink(link, level)));
      }
    } catch (error) {
      console.error('BIRMINGHAM_PAGE_SCRAPE_ERROR:', { page_url: pageUrl, error });

      try {
        const directHtml = await fetchDirectHtml(pageUrl);
        const htmlLinks = extractHtmlLinks(directHtml);
        const htmlNextLink = findNextLink(htmlLinks);
        const htmlCourseLinks = extractBirminghamCourseLinks(htmlLinks, pageUrl);
        allMarkdown.push(directHtml);

        console.log('BIRMINGHAM_PAGE_HTML_FALLBACK_RESULT:', {
          page_url: pageUrl,
          next_link: htmlNextLink,
          html_link_count: htmlLinks.length,
          course_link_count: htmlCourseLinks.length,
        });

        allPrograms = mergeParsedPrograms(allPrograms, parseProgramsByProfile('', directHtml, level, 'birmingham', pageUrl));
        allPrograms = mergeParsedPrograms(allPrograms, htmlCourseLinks.map((link) => createParsedProgramFromLink(link, level)));
      } catch (fallbackError) {
        console.error('BIRMINGHAM_PAGE_HTML_FALLBACK_ERROR:', { page_url: pageUrl, error: fallbackError });
      }
    }
  }

  return {
    markdown: allMarkdown.join('\n\n'),
    programs: allPrograms,
  };
}

async function scrapeCoursePage(url: string, firecrawlApiKey: string): Promise<ScrapeResult> {
  console.log('UNIVERSITY_RESEARCH_FIRECRAWL_REQUEST_START:', { url });
  const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
    }),
  });
  console.log('UNIVERSITY_RESEARCH_FIRECRAWL_RESPONSE_STATUS:', firecrawlResponse.status);

  const rawText = await firecrawlResponse.text();
  console.log('UNIVERSITY_RESEARCH_FIRECRAWL_RESPONSE_BODY_FIRST_1000:', rawText.slice(0, 1000));

  if (!firecrawlResponse.ok) {
    console.error('Firecrawl scrape failed', firecrawlResponse.status, rawText);
    throw new Error('Firecrawl scrape failed');
  }

  const data = JSON.parse(rawText);
  const markdown = getMarkdown(data);

  if (!markdown?.trim()) {
    throw new Error('Firecrawl did not return markdown');
  }

  console.log('UNIVERSITY_RESEARCH_MARKDOWN_LENGTH:', markdown.length);

  return { markdown, rawText, data };
}

async function fetchDirectHtml(url: string) {
  console.log('UNIVERSITY_RESEARCH_DIRECT_FETCH_FALLBACK_START:', { url });
  const directResponse = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; UNIC University Research Bot/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const directHtml = await directResponse.text();
  console.log('UNIVERSITY_RESEARCH_DIRECT_FETCH_STATUS:', directResponse.status);
  console.log('UNIVERSITY_RESEARCH_DIRECT_FETCH_LENGTH:', directHtml.length);
  return directHtml;
}

function buildBirminghamUndergraduateUrls() {
  return Array.from({ length: 37 }, (_, index) => {
    const page = index + 1;

    return `https://www.birmingham.ac.uk/study/undergraduate/course-search?academicLevel=73e0fd63-0e06-4007-9898-316387e121ec&page=${page}&pageIndex=${page}&preventScrollTop=true`;
  });
}

function extractMarkdownLinks(markdown: string) {
  const links: Array<{ text: string; url: string }> = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    links.push({
      text: match[1]?.trim() || '',
      url: match[2]?.trim() || '',
    });
  }

  return links;
}

function extractHtmlLinks(html: string) {
  const links: Array<{ text: string; url: string }> = [];
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    links.push({
      text: stripHtmlEntities(stripHtmlTags(match[2]?.trim() || '')),
      url: match[1]?.trim() || '',
    });
  }

  return links;
}

function findNextLink(links: Array<{ text: string; url: string }>) {
  const nextLink = links.find((link) => link.text.toLowerCase().trim() === 'next') || null;

  return nextLink ? { ...nextLink, url: toAbsoluteUrl(nextLink.url, 'https://www.birmingham.ac.uk') } : null;
}

function extractBirminghamCourseLinks(links: Array<{ text: string; url: string }>, baseUrl: string) {
  const courseLinks = links
    .filter((link) => extractDegreeFromTitle(link.text))
    .map((link) => ({
      text: link.text,
      url: toAbsoluteUrl(link.url, baseUrl),
    }))
    .filter((link) => link.url && isBirminghamCourseUrl(link.url));
  const uniqueLinks = new Map(courseLinks.map((link) => [link.url, link]));

  return Array.from(uniqueLinks.values());
}

function isBirminghamCourseUrl(url: string) {
  return url.includes('birmingham.ac.uk') && (
    url.includes('/study/undergraduate/subjects/') ||
    url.includes('/undergraduate/subjects/') ||
    url.includes('/dubai/study/undergraduate/subjects/')
  );
}

function createParsedProgramFromLink(link: { text: string; url: string }, level: ProgramLevel): ParsedProgram {
  return {
    program_name: link.text,
    degree: extractDegreeFromTitle(link.text),
    duration: '',
    url: link.url,
    level,
    source_url: link.url,
    matched_departments: [],
    match_status: 'needs_manual_review',
    match_notes: 'No department keyword rule matched; manual review required.',
    ...extractProgramIntelligence(link.text, ''),
  };
}

function normalizeBirminghamCourseSearchUrl(courseUrl: string) {
  if (courseUrl.includes('birmingham.ac.uk') && !courseUrl.includes('/study/undergraduate/course-search')) {
    return buildBirminghamUndergraduateUrls()[0];
  }

  return courseUrl;
}

function detectPaginationPageCount(content: string) {
  const candidates = [
    ...Array.from(content.matchAll(/[?&]page=(\d{1,3})\b/gi), (match) => Number(match[1])),
    ...Array.from(content.matchAll(/\.\.\.\s*(\d{1,3})\s*Next/gi), (match) => Number(match[1])),
  ].filter((page) => Number.isInteger(page) && page > 1 && page <= 100);

  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function mergeParsedPrograms(currentPrograms: ParsedProgram[], nextPrograms: ParsedProgram[]) {
  const programsByUrl = new Map(currentPrograms.map((program) => [program.url, program]));

  nextPrograms.forEach((program) => {
    if (!programsByUrl.has(program.url)) {
      programsByUrl.set(program.url, program);
    }
  });

  return Array.from(programsByUrl.values());
}

function getFirecrawlMetadataUrl(data: unknown) {
  const root = isRecord(data) ? data : null;
  const nestedData = isRecord(root?.data) ? root.data : null;
  const metadata = isRecord(nestedData?.metadata)
    ? nestedData.metadata
    : isRecord(root?.metadata)
      ? root.metadata
      : null;
  const metadataUrl = metadata?.url || metadata?.sourceURL || metadata?.sourceUrl;

  if (typeof metadataUrl === 'string') return metadataUrl;
  if (typeof nestedData?.url === 'string') return nestedData.url;
  if (typeof root?.url === 'string') return root.url;

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeParserProfile(value: string | null | undefined): ParserProfile {
  if (value === 'birmingham' || value === 'birmingham_course_index') {
    return 'birmingham';
  }

  if (value === 'generic' || value === 'manchester' || value === 'leeds' || value === 'sheffield') {
    return value;
  }

  return 'auto';
}

function shouldUseDirectFetchFallback(parserProfile: ParserProfile) {
  return parserProfile === 'auto' || parserProfile === 'birmingham';
}

function parseProgramsByProfile(markdown: string, html: string, level: ProgramLevel, parserProfile: ParserProfile, courseUrl: string) {
  switch (parserProfile) {
    case 'manchester':
      return parseGenericPrograms(markdown, level);
    case 'birmingham':
      return parseBirminghamPrograms(markdown, html, level, courseUrl);
    case 'leeds':
      return parseLeedsPrograms(markdown, level, courseUrl);
    case 'sheffield':
      return parseSheffieldPrograms(markdown, level, courseUrl);
    case 'generic':
    case 'auto':
    default:
      return parseGenericPrograms(markdown || html, level, courseUrl);
  }
}

function parseBirminghamPrograms(markdown: string, html: string, level: ProgramLevel, courseUrl: string) {
  return parseProgramsFromMarkdown(`${markdown}\n${html}`, level, courseUrl, true);
}

function parseLeedsPrograms(markdown: string, level: ProgramLevel, courseUrl: string) {
  return parseGenericPrograms(markdown, level, courseUrl);
}

function parseSheffieldPrograms(markdown: string, level: ProgramLevel, courseUrl: string) {
  return parseGenericPrograms(markdown, level, courseUrl);
}

function parseGenericPrograms(markdown: string, level: ProgramLevel, courseUrl = '') {
  return parseProgramsFromMarkdown(markdown, level, courseUrl, false);
}

function parseProgramsFromMarkdown(markdown: string, level: ProgramLevel, sourceUrl: string, includeCourseIndexLinks: boolean) {
  const programs: ParsedProgram[] = [];
  const seenUrls = new Set<string>();
  const regex = /- \[([^\]]+)\]\((https?:\/\/[^\)]+)\)\s*\n\n([A-Za-z&\/\s]+)\s*\n\n([^\n]+)/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    addProgram(match[1]?.trim(), match[2]?.trim(), match[3]?.trim() || '', match[4]?.trim() || '');
  }

  const headingLinkRegex = /#{2,4}\s+\[([^\]]+)\]\(([^\)]+)\)/g;

  while ((match = headingLinkRegex.exec(markdown)) !== null) {
    const title = match[1]?.trim() || '';
    addProgram(title, match[2]?.trim(), extractDegreeFromTitle(title), '');
  }

  if (includeCourseIndexLinks) {
    const degreeLinkRegex = /\[([^\]]*\b(?:BA|BSc|BEng|MEng|LLB|MBChB|BMus|BNurs|MSci|BMedSc|BDS|BFA|FdA|FdSc)\b[^\]]*)\]\(([^\)]+)\)/gi;

    while ((match = degreeLinkRegex.exec(markdown)) !== null) {
      const title = match[1]?.trim() || '';
      addProgram(title, match[2]?.trim(), extractDegreeFromTitle(title), '');
    }

    const htmlLinkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    while ((match = htmlLinkRegex.exec(markdown)) !== null) {
      const title = stripHtmlEntities(stripHtmlTags(match[2]?.trim() || ''));
      if (!extractDegreeFromTitle(title)) continue;
      addProgram(title, match[1]?.trim(), extractDegreeFromTitle(title), '');
    }
  }

  return programs;

  function addProgram(title?: string, rawUrl?: string, degree = '', duration = '') {
    const url = toAbsoluteUrl(rawUrl, sourceUrl);

    if (!title || !url || seenUrls.has(url)) return;

    const lowerTitle = title.toLowerCase();
    const lowerDegree = degree.toLowerCase();

    const shouldSkip =
      lowerTitle.includes('foundation') ||
      lowerDegree.includes('foundation') ||
      lowerDegree.includes('ugcert') ||
      lowerDegree.includes('ugdip') ||
      lowerDegree.includes('certificate') ||
      lowerDegree.includes('diploma');

    if (shouldSkip) return;

    seenUrls.add(url);

    programs.push({
      program_name: title,
      degree,
      duration,
      url,
      level,
      source_url: url,
      matched_departments: [],
      match_status: 'needs_manual_review',
      match_notes: 'No department keyword rule matched; manual review required.',
      ...extractProgramIntelligence(title, duration),
    });
  }
}

function toAbsoluteUrl(rawUrl: string | undefined, sourceUrl: string) {
  if (!rawUrl?.trim()) return '';

  try {
    return new URL(rawUrl.trim(), sourceUrl).toString();
  } catch {
    return rawUrl.trim();
  }
}

function extractDegreeFromTitle(title: string) {
  const degreeMatch = title.match(/\b(BA|BSc|BEng|MEng|LLB|MBChB|BMus|BNurs|MSci|BMedSc|BDS|BFA|FdA|FdSc)\b/i);
  return degreeMatch?.[1] || '';
}

function stripHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function applyDepartmentKeywordRules(parsedPrograms: ParsedProgram[], rules: DepartmentKeywordRule[]) {
  const sortedRules = [...rules]
    .filter((rule) => rule.is_active && (rule.department_name?.trim() || rule.matched_department?.trim()))
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  sortedRules.forEach((rule) => {
    if (rule.department_name === 'Dilbilimi') {
      console.log('DILBILIMI_RULE_DEBUG:', {
        department_name: rule.department_name,
        major_keywords: rule.major_keywords,
        required_match_keywords: rule.required_match_keywords,
      });
    }
  });

  const programs: ParsedProgram[] = [];

  for (const program of parsedPrograms) {
    const normalizedProgram = program.program_name
      .toLowerCase()
      .trim();
    const matchedDepartments = new Set<string>();
    const matchedKeywords = new Set<string>();

    sortedRules.forEach((rule) => {
      const departmentName = rule.department_name?.trim() || rule.matched_department?.trim();
      if (!departmentName) return;

      const keyword = normalizeMatchText(rule.keyword);
      const majorKeywords = [keyword, ...normalizeKeywords(rule.major_keywords)].filter(Boolean) as string[];
      const requiredKeywords = normalizeKeywords(rule.required_match_keywords);
      const requiredMatch = requiredKeywords.find((keyword) => normalizedProgram.includes(keyword));
      const majorMatch = majorKeywords.find((keyword) => normalizedProgram.includes(keyword));
      const matchedRuleKeywords = [requiredMatch, majorMatch].filter(Boolean) as string[];

      if (matchedRuleKeywords.length === 0) return;

      matchedDepartments.add(departmentName);
      matchedRuleKeywords.forEach((keyword) => matchedKeywords.add(keyword));
    });

    const result = matchedDepartments.size === 0
      ? program
      : {
          ...program,
          matched_departments: Array.from(matchedDepartments),
          match_status: 'matched' as const,
          match_notes: `Matched by department keyword rules: ${Array.from(matchedKeywords).join(', ')}`,
        };

    const { matched_departments, match_status, match_notes } = result;

    console.log(
      'UNIVERSITY_RESEARCH_MATCH_RESULT:',
      {
        program_name: program.program_name,
        matched_departments,
        match_status,
        match_notes,
      }
    );

    programs.push(result);
  }

  return programs;
}

function normalizeKeywords(keywords: string[] | null) {
  return (keywords || [])
    .map(normalizeMatchText)
    .filter(Boolean);
}

function normalizeMatchText(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function extractProgramIntelligence(programName: string, duration?: string) {
  const normalized = programName.toLowerCase();

  const durationMatch = duration?.match(/(\d+)/);
  const durationYears = durationMatch ? Number(durationMatch[1]) : null;

  const placementKeywords = [
    'industrial experience',
    'professional experience',
    'placement year',
    'with placement',
    'year in industry',
    'sandwich year',
    'industry year'
  ];

  const studyAbroadKeywords = [
    'study abroad',
    'international study',
    'year abroad',
    'study in europe'
  ];

  const foundationKeywords = [
    'foundation year',
    'integrated foundation'
  ];

  const hasPlacement = placementKeywords.some(keyword => normalized.includes(keyword));
  const hasStudyAbroad = studyAbroadKeywords.some(keyword => normalized.includes(keyword));
  const hasFoundation = foundationKeywords.some(keyword => normalized.includes(keyword));

  return {
    duration_years: durationYears,
    placement_year: hasPlacement,
    internship: hasPlacement,
    study_abroad: hasStudyAbroad,
    foundation_required: hasFoundation,
    portfolio_required: normalized.includes('portfolio'),
    delivery_mode: 'full_time',
    discipline_tags: [],
    career_areas: []
  };
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
