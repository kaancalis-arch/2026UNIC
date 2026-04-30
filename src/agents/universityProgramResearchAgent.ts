export type ProgramLevel = 'all' | 'undergraduate' | 'master';

export interface UniversityProgramResearchResult {
  university_name: string;
  official_website?: string;
  country?: string;
  program_level: 'undergraduate' | 'master';
  program_name: string;
  degree_type: string;
  faculty_or_school: string;
  duration: string;
  tuition_fee: string;
  language_requirement: string;
  academic_requirement: string;
  application_deadline: string;
  intake_dates: string[];
  source_url: string;
  confidence_score: number;
  notes: string;
}

export const universityProgramResearchAgentPrompt = `
You are the University Program Research Agent for the UNIC university counselling platform.

Your task is to research official university program pages and return structured undergraduate and/or master's program information for the requested university.

Input:
- universityName: the target university name supplied by the user
- programLevel: one of "all", "undergraduate", or "master"

Research rules:
- Prefer official university domains and official admissions/program pages.
- Do not invent programs, fees, entry requirements, deadlines, or links.
- If a value cannot be verified from an official source, use "Not found" and explain the gap in notes.
- If program_level is "undergraduate", return only undergraduate programs.
- If program_level is "master", return only master's/postgraduate taught programs.
- If program_level is "all", return both undergraduate and master's programs when available.
- Normalize program_level in each result to "undergraduate" or "master".
- Return concise values suitable for table display and Excel export.
- Include a confidence_score between 0 and 1 based on source reliability and completeness.

Output requirements:
- Return only valid JSON.
- Return a JSON array of program result objects.
- Do not include markdown, prose, citations outside fields, or extra wrapper keys.
- Every object must match the universityProgramResearchOutputSchema exactly.
`;

export const universityProgramResearchOutputSchema = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: [
      'university_name',
      'program_level',
      'program_name',
      'degree_type',
      'faculty_or_school',
      'duration',
      'tuition_fee',
      'language_requirement',
      'academic_requirement',
      'application_deadline',
      'intake_dates',
      'source_url',
      'confidence_score',
      'notes',
    ],
    properties: {
      university_name: {
        type: 'string',
        description: 'Official or user-provided university name.',
      },
      official_website: {
        type: 'string',
        description: 'Official university website when available.',
      },
      country: {
        type: 'string',
        description: 'Country where the university is located when available.',
      },
      program_level: {
        type: 'string',
        enum: ['undergraduate', 'master'],
        description: 'Normalized program level.',
      },
      program_name: {
        type: 'string',
        description: 'Program title as listed by the university.',
      },
      degree_type: {
        type: 'string',
        description: 'Degree award or qualification type, for example BA, BSc, MA, MSc, MBA.',
      },
      faculty_or_school: {
        type: 'string',
        description: 'Faculty, school, department, or academic unit offering the program.',
      },
      duration: {
        type: 'string',
        description: 'Program duration, for example 3 years or 1 year full-time.',
      },
      tuition_fee: {
        type: 'string',
        description: 'International tuition fee when available, including currency and period.',
      },
      language_requirement: {
        type: 'string',
        description: 'English language requirement such as IELTS/TOEFL score.',
      },
      academic_requirement: {
        type: 'string',
        description: 'Summary of academic entry requirements.',
      },
      application_deadline: {
        type: 'string',
        description: 'Application deadline or Not found.',
      },
      intake_dates: {
        type: 'array',
        items: { type: 'string' },
        description: 'Available intake dates or terms.',
      },
      source_url: {
        type: 'string',
        description: 'Official source URL used for the result.',
      },
      confidence_score: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score between 0 and 1.',
      },
      notes: {
        type: 'string',
        description: 'Short verification notes, caveats, or missing data explanation.',
      },
    },
  },
} as const;

const mockResults: Omit<UniversityProgramResearchResult, 'university_name'>[] = [
  {
    official_website: 'https://www.example.com',
    country: 'United Kingdom',
    program_level: 'undergraduate',
    program_name: 'Business Management',
    degree_type: 'BSc',
    faculty_or_school: 'Business School',
    duration: '3 years full-time',
    tuition_fee: 'GBP 29,000 per year',
    language_requirement: 'IELTS 6.5 overall, no component below 6.0',
    academic_requirement: 'Strong high school diploma or equivalent international qualification.',
    application_deadline: 'Not found',
    intake_dates: ['September'],
    source_url: 'https://www.example.com/undergraduate/business-management',
    confidence_score: 0.82,
    notes: 'Mock result for UI development. Replace with verified official data when agent integration is added.',
  },
  {
    official_website: 'https://www.example.com',
    country: 'United Kingdom',
    program_level: 'undergraduate',
    program_name: 'Computer Science',
    degree_type: 'BSc',
    faculty_or_school: 'School of Computer Science',
    duration: '3 years full-time',
    tuition_fee: 'GBP 34,500 per year',
    language_requirement: 'IELTS 7.0 overall, no component below 6.5',
    academic_requirement: 'Mathematics-focused high school curriculum or equivalent qualification.',
    application_deadline: 'Not found',
    intake_dates: ['September'],
    source_url: 'https://www.example.com/undergraduate/computer-science',
    confidence_score: 0.8,
    notes: 'Mock result for UI development. Replace with verified official data when agent integration is added.',
  },
  {
    official_website: 'https://www.example.com',
    country: 'United Kingdom',
    program_level: 'master',
    program_name: 'Data Science',
    degree_type: 'MSc',
    faculty_or_school: 'Faculty of Science and Engineering',
    duration: '1 year full-time',
    tuition_fee: 'GBP 35,000 per year',
    language_requirement: 'IELTS 7.0 overall, no component below 6.5',
    academic_requirement: 'Upper second-class undergraduate degree or international equivalent in a quantitative subject.',
    application_deadline: 'Not found',
    intake_dates: ['September'],
    source_url: 'https://www.example.com/postgraduate/data-science',
    confidence_score: 0.84,
    notes: 'Mock result for UI development. Replace with verified official data when agent integration is added.',
  },
  {
    official_website: 'https://www.example.com',
    country: 'United Kingdom',
    program_level: 'master',
    program_name: 'Finance',
    degree_type: 'MSc',
    faculty_or_school: 'Business School',
    duration: '1 year full-time',
    tuition_fee: 'GBP 37,500 per year',
    language_requirement: 'IELTS 7.0 overall, no component below 6.5',
    academic_requirement: 'Undergraduate degree with strong quantitative modules. GMAT may strengthen the application.',
    application_deadline: 'Not found',
    intake_dates: ['September'],
    source_url: 'https://www.example.com/postgraduate/finance',
    confidence_score: 0.81,
    notes: 'Mock result for UI development. Replace with verified official data when agent integration is added.',
  },
];

export async function mockRunUniversityProgramResearchAgent(input: {
  universityName: string;
  programLevel: ProgramLevel;
}): Promise<UniversityProgramResearchResult[]> {
  const normalizedUniversityName = input.universityName.trim();

  if (!normalizedUniversityName) {
    return [];
  }

  const filteredResults = mockResults.filter((result) => {
    if (input.programLevel === 'all') {
      return true;
    }

    return result.program_level === input.programLevel;
  });

  return filteredResults.map((result) => ({
    ...result,
    university_name: normalizedUniversityName,
  }));
}
