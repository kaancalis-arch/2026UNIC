import { GoogleGenAI, Type } from "@google/genai";
import { Student, AnalysisResult, RoadmapStep } from "../types";

// Initialize Gemini Client
// NOTE: In a real production app, these calls might happen via a backend proxy (Supabase Edge Functions)
// to protect the API Key, but for this frontend-focused architecture, we call direct.
// Initialize Gemini Client lazily to prevent crash if API key is missing
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    // Priority: 1. localStorage (user configured) 2. environment variable
    const localKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
    const envKey = process.env.GEMINI_API_KEY;
    
    const apiKey = localKey || envKey;

    if (!apiKey || apiKey === 'undefined' || apiKey === '') {
      console.warn("GEMINI_API_KEY is missing. AI features will use fallback data.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

const MODEL_NAME = "gemini-2.5-flash";

/**
 * Analyzes a student profile to provide program recommendations and risk assessment.
 */
export const analyzeStudentProfile = async (student: Student): Promise<AnalysisResult> => {
  const ai = getAI();
  if (!ai) {
    return {
      recommendedPrograms: ["Computer Science", "Data Analytics", "Software Engineering"],
      visaRiskScore: 25,
      visaRiskReasoning: "Solid academic background and sufficient budget reduce risk. (Fallback Data)",
      scholarshipProbability: 60,
      suggestedUniversities: [
        { name: "Technical University of Munich", country: "Germany", matchScore: 95, tuition: 0 },
        { name: "University of Amsterdam", country: "Netherlands", matchScore: 88, tuition: 12000 },
      ],
      overallAssessment: "The student shows strong potential for European technical universities. Focus on IELTS preparation. (Fallback Data)"
    };
  }

  const prompt = `
    You are UNIC, an expert university counselor AI. 
    Analyze the following student profile and provide a structured assessment.
    
    Student Data:
    ${JSON.stringify(student)}

    Task:
    1. Recommend 3 specific university programs/majors based on interests and background.
    2. Estimate Visa Risk Score (0-100, where 100 is high risk).
    3. Provide reasoning for the risk.
    4. Suggest 3 specific universities (mock real names) with estimated tuition.
    5. Write a brief professional summary/overall assessment.

    Return strictly JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedPrograms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 3 recommended majors/programs"
            },
            visaRiskScore: {
              type: Type.NUMBER,
              description: "0 to 100 integer representing risk"
            },
            visaRiskReasoning: {
              type: Type.STRING,
              description: "Explanation of the risk score"
            },
            scholarshipProbability: {
              type: Type.NUMBER,
              description: "0 to 100 probability"
            },
            suggestedUniversities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  country: { type: Type.STRING },
                  matchScore: { type: Type.NUMBER },
                  tuition: { type: Type.NUMBER }
                }
              }
            },
            overallAssessment: {
              type: Type.STRING,
              description: "A 2-3 sentence professional summary."
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AnalysisResult;
    }
    throw new Error("No response text generated");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // Fallback mock data if API fails or key is missing
    return {
      recommendedPrograms: ["Computer Science", "Data Analytics", "Software Engineering"],
      visaRiskScore: 25,
      visaRiskReasoning: "Solid academic background and sufficient budget reduce risk.",
      scholarshipProbability: 60,
      suggestedUniversities: [
        { name: "Technical University of Munich", country: "Germany", matchScore: 95, tuition: 0 },
        { name: "University of Amsterdam", country: "Netherlands", matchScore: 88, tuition: 12000 },
      ],
      overallAssessment: "The student shows strong potential for European technical universities. Focus on IELTS preparation."
    };
  }
};

/**
 * Generates a personalized roadmap for the student.
 */
export const generateStudentRoadmap = async (student: Student): Promise<RoadmapStep[]> => {
  const ai = getAI();
  if (!ai) return [];

  const prompt = `
    Create a step-by-step application roadmap for this student:
    Target: ${student.targetDegree} in ${student.targetCountries.join(', ')}.
    Current Stage: ${student.pipelineStage}.
    
    Include steps for Documents, Application submission, and Visa.
    Assign realistic relative deadlines (e.g., "2024-05-01").
    
    Return strictly JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  deadline: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ['pending', 'in_progress', 'completed'] },
                  category: { type: Type.STRING, enum: ['document', 'application', 'visa', 'financial'] }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as { steps: RoadmapStep[] };
      return data.steps;
    }
    throw new Error("No roadmap generated");
  } catch (error) {
    console.error("Gemini Roadmap Error:", error);
    return [];
  }
};

/**
 * Chat bot functionality for the Counselor to ask questions about the database/rules.
 */
export const askUNIC = async (question: string, context: string): Promise<string> => {
    const ai = getAI();
    if (!ai) return "AI is currently unavailable. Please check configuration.";

    const prompt = `
      You are UNIC, the logic engine of this platform.
      Context: ${context}
      User Question: ${question}
      
      Answer briefly and professionally. If suggesting an action, mention that you can trigger an n8n workflow.
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt
        });
        return response.text || "I couldn't process that request.";
    } catch (error) {
        return "System is currently offline. Please check API keys.";
    }
}
