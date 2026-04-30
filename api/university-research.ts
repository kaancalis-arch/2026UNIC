import type { ProgramLevel } from '../src/agents/universityProgramResearchAgent';

const N8N_WEBHOOK_URL = process.env.N8N_UNIVERSITY_RESEARCH_WEBHOOK_URL;

type UniversityResearchRequestBody = {
  university_name?: string;
  program_level?: ProgramLevel;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  const body: UniversityResearchRequestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const { university_name, program_level = 'all' } = body;

  console.log('University research input:', {
    university_name,
    program_level,
  });

  if (!N8N_WEBHOOK_URL) {
    return res.status(500).json({
      success: false,
      error: 'N8N webhook URL is not configured',
    });
  }

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      university_name,
      program_level,
    }),
  });

  const data = await response.json();

  return res.status(200).json(data);
}
