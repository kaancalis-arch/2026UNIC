export type AdvisorReportContent = {
  title: string;
  summary: string;
  observations: string[];
  questions: string[];
  actions: string[];
  warning: string;
};

export type GenerateAdvisorReportInput = {
  systemInstructions: string;
  dataBlock: Record<string, unknown>;
};

export type AdvisorProvider = {
  name: 'openai';
  model: string;
  generateReport: (input: GenerateAdvisorReportInput) => Promise<AdvisorReportContent>;
};
