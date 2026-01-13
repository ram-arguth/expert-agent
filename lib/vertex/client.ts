/**
 * Vertex AI Client
 *
 * Client for interacting with Vertex AI Agent Engine (Gemini 3).
 * Uses structured output mode for consistent JSON responses.
 *
 * @see docs/DESIGN.md - Vertex AI Integration section
 */

import { z } from 'zod';

// Environment configuration
const VERTEX_AI_CONFIG = {
  projectId: process.env.GCP_PROJECT_ID || 'expert-ai-dev',
  location: 'global', // Gemini 3 requires global endpoint
  model: 'gemini-3-pro-preview',
  flashModel: 'gemini-3-flash-preview',
} as const;

// Response schema for structured output
export interface VertexAIResponse<T> {
  content: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  metadata: {
    model: string;
    finishReason: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  };
}

// Query options
export interface QueryOptions {
  /** Agent/model to use */
  model?: 'pro' | 'flash';

  /** Session ID for multi-turn conversations */
  sessionId?: string;

  /** Maximum tokens to generate */
  maxOutputTokens?: number;

  /** Temperature for response randomness (0-2) */
  temperature?: number;

  /** Files to include as context */
  files?: Array<{
    mimeType: string;
    uri: string;
  }>;
}

/**
 * Check if Vertex AI should be mocked (for testing)
 */
export function shouldMockVertexAI(): boolean {
  return process.env.VERTEX_AI_MOCK === 'true' || process.env.NODE_ENV === 'test';
}

/**
 * Query Vertex AI with structured JSON output
 *
 * @param prompt - The assembled prompt
 * @param outputSchema - Zod schema for expected output
 * @param options - Query options
 * @returns Parsed and validated response
 */
export async function queryVertexAI<T extends z.ZodType>(
  prompt: string,
  outputSchema: T,
  options: QueryOptions = {}
): Promise<VertexAIResponse<z.infer<T>>> {
  // Mock mode for testing
  if (shouldMockVertexAI()) {
    return getMockResponse(outputSchema);
  }

  const model = options.model === 'flash' ? VERTEX_AI_CONFIG.flashModel : VERTEX_AI_CONFIG.model;

  // Build request payload
  const requestPayload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          // Include files if provided
          ...(options.files || []).map((file) => ({
            fileData: {
              mimeType: file.mimeType,
              fileUri: file.uri,
            },
          })),
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      // responseSchema would be added here for production
      maxOutputTokens: options.maxOutputTokens || 8192,
      temperature: options.temperature ?? 0.7,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  // Build API URL
  const apiUrl = `https://${VERTEX_AI_CONFIG.location}-aiplatform.googleapis.com/v1/projects/${VERTEX_AI_CONFIG.projectId}/locations/${VERTEX_AI_CONFIG.location}/publishers/google/models/${model}:generateContent`;

  try {
    // Get access token (uses ADC in Cloud Run)
    const accessToken = await getAccessToken();

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Vertex AI error: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();

    // Extract and parse response
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      throw new Error('No content in Vertex AI response');
    }

    // Parse JSON and validate against schema
    const parsedContent = JSON.parse(textContent);
    const validatedContent = outputSchema.parse(parsedContent);

    return {
      content: validatedContent,
      usage: {
        inputTokens: result.usageMetadata?.promptTokenCount || 0,
        outputTokens: result.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: result.usageMetadata?.totalTokenCount || 0,
      },
      metadata: {
        model,
        finishReason: result.candidates?.[0]?.finishReason || 'UNKNOWN',
        safetyRatings: result.candidates?.[0]?.safetyRatings,
      },
    };
  } catch (error) {
    console.error('Vertex AI query failed:', error);
    throw error;
  }
}

/**
 * Get access token for Vertex AI
 * Uses Application Default Credentials in Cloud Run
 */
async function getAccessToken(): Promise<string> {
  // In Cloud Run, get token from metadata server
  if (process.env.K_SERVICE) {
    const metadataUrl =
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
    const response = await fetch(metadataUrl, {
      headers: { 'Metadata-Flavor': 'Google' },
    });

    if (!response.ok) {
      throw new Error('Failed to get access token from metadata server');
    }

    const data = await response.json();
    return data.access_token;
  }

  // Local development: use gcloud auth
  // This requires running: gcloud auth application-default login
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error('Failed to get access token. Run: gcloud auth application-default login');
  }

  return token.token;
}

/**
 * Generate mock response for testing
 */
function getMockResponse<T extends z.ZodType>(
  _schema: T
): VertexAIResponse<z.infer<T>> {
  // Return a minimal mock that satisfies most schemas
  // In real tests, use vi.mock to provide specific responses
  return {
    content: {} as z.infer<T>,
    usage: {
      inputTokens: 100,
      outputTokens: 500,
      totalTokens: 600,
    },
    metadata: {
      model: 'gemini-3-pro-preview-mock',
      finishReason: 'STOP',
    },
  };
}

/**
 * Estimate token count for a prompt
 * Rough estimation: ~4 characters per token
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if a response was blocked by safety filters
 */
export function wasBlocked(response: VertexAIResponse<unknown>): boolean {
  return response.metadata.finishReason === 'SAFETY';
}
