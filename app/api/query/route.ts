/**
 * Query API - Execute Agent Query
 *
 * POST /api/query - Execute a query against an agent
 *
 * Flow:
 * 1. Validate input against agent's schema
 * 2. Check token quota
 * 3. Assemble prompt with context
 * 4. Call Vertex AI with structured output
 * 5. Validate response against output schema
 * 6. Deduct tokens and store session
 * 7. Return rendered response
 *
 * @see docs/DESIGN.md - Query Flow section
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getCedarEngine, CedarActions } from '@/lib/authz/cedar';
import { queryVertexAI, estimateTokens } from '@/lib/vertex/client';
import {
  guardInput,
  guardOutput,
  getEmbeddedSafetyInstructions,
  guardInputForPII,
  guardOutputForPII,
} from '@/lib/security';
import Handlebars from 'handlebars';

// Import agent registry
import {
  UX_ANALYST_CONFIG,
  UxAnalystInputSchema,
  UxAnalystOutputSchema,
  UX_ANALYST_PROMPT_TEMPLATE,
  renderToMarkdown,
} from '@/lib/agents/ux-analyst';

// Query request schema
const QueryRequestSchema = z.object({
  agentId: z.string().min(1),
  sessionId: z.string().uuid().optional(),
  inputs: z.record(z.unknown()),
  files: z
    .array(
      z.object({
        fieldName: z.string(),
        gcsPath: z.string(),
        filename: z.string(),
        mimeType: z.string().optional(),
      })
    )
    .optional(),
});

// Agent registry (expandable)
const AGENT_REGISTRY: Record<
  string,
  {
    config: typeof UX_ANALYST_CONFIG;
    inputSchema: z.ZodType;
    outputSchema: z.ZodType;
    promptTemplate: string;
    render: (output: unknown) => string;
  }
> = {
  'ux-analyst': {
    config: UX_ANALYST_CONFIG,
    inputSchema: UxAnalystInputSchema,
    outputSchema: UxAnalystOutputSchema,
    promptTemplate: UX_ANALYST_PROMPT_TEMPLATE,
    render: renderToMarkdown as (output: unknown) => string,
  },
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Parse request
    const body = await request.json();
    const requestValidation = QueryRequestSchema.safeParse(body);

    if (!requestValidation.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'Invalid request body',
          details: requestValidation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { agentId, sessionId, inputs, files } = requestValidation.data;

    // 3. Get agent configuration
    const agent = AGENT_REGISTRY[agentId];
    if (!agent) {
      return NextResponse.json(
        { error: 'Not Found', message: `Agent '${agentId}' not found` },
        { status: 404 }
      );
    }

    // 4. Authorization check
    const cedar = getCedarEngine();
    const decision = cedar.isAuthorized({
      principal: { type: 'User', id: session.user.id },
      action: { type: 'Action', id: CedarActions.QueryAgent },
      resource: {
        type: 'Agent',
        id: agentId,
        attributes: {
          isPublic: agent.config.isPublic,
          isBeta: agent.config.isBeta,
        },
      },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Not authorized to use this agent' },
        { status: 403 }
      );
    }

    // 5. Validate inputs against agent schema
    const inputValidation = agent.inputSchema.safeParse(inputs);
    if (!inputValidation.success) {
      return NextResponse.json(
        {
          error: 'Input Validation Error',
          message: 'Invalid inputs for this agent',
          details: inputValidation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const validatedInputs = inputValidation.data;

    // 5a. AI Safety Guard - Input validation
    // Check for prompt injection, jailbreak attempts, and off-topic requests
    const inputGuard = await guardInput(
      JSON.stringify(validatedInputs),
      {
        userId: session.user.id,
        agentId,
        // Enable AI check for suspicious but not blocked content
        useAICheck: false,
      }
    );

    if (!inputGuard.allowed) {
      return NextResponse.json(
        {
          error: 'Safety Check Failed',
          message: inputGuard.userMessage || 'Your request could not be processed',
          category: inputGuard.safetyResult.category,
        },
        { status: 400 }
      );
    }

    // 5b. PII Detection - Check for sensitive personal information
    // Blocks requests containing critical PII (SSN, credit card, etc.)
    const piiGuard = await guardInputForPII(
      JSON.stringify(validatedInputs),
      {
        userId: session.user.id,
        agentId,
      }
    );

    if (!piiGuard.allowed) {
      return NextResponse.json(
        {
          error: 'Privacy Protection',
          message: piiGuard.userMessage || 'Your request contains sensitive personal information that cannot be processed',
          piiTypesDetected: piiGuard.result?.summary,
        },
        { status: 400 }
      );
    }

    // 6. Check token quota
    const quotaResult = await checkQuota(session.user.id);
    if (!quotaResult.hasQuota) {
      return NextResponse.json(
        {
          error: 'Quota Exceeded',
          message: `Token quota exceeded. ${quotaResult.remaining} tokens remaining.`,
          upgradeUrl: '/pricing',
        },
        { status: 402 }
      );
    }

    // 7. Process files - generate signed URLs for reading
    const processedFiles = await processFiles(files || []);

    // 8. Load org context (if in org context)
    const orgContext = await loadOrgContext(session.user.id, agentId);

    // 9. Compile prompt
    const promptContext = {
      ...validatedInputs,
      ...processedFiles.files,
      orgContext,
    };

    const compiledPrompt = Handlebars.compile(agent.promptTemplate)(promptContext);

    // 9a. Prepend safety instructions to prompt
    // Embeds platform branding and content policy rules
    const safetyInstructions = getEmbeddedSafetyInstructions();
    const fullPrompt = safetyInstructions + '\n\n' + compiledPrompt;

    // 10. Estimate tokens for pre-check
    const estimatedInputTokens = estimateTokens(fullPrompt);

    // 11. Call Vertex AI (with safety-enhanced prompt)
    const aiResponse = await queryVertexAI(fullPrompt, agent.outputSchema, {
      files: processedFiles.fileUris,
    });

    // 12. Validate output (already done by queryVertexAI)
    const validatedOutput = aiResponse.content;

    // 12a. AI Safety Guard - Output sanitization
    // Removes model/provider references and checks for harmful content
    const outputGuard = await guardOutput(
      JSON.stringify(validatedOutput),
      {
        userId: session.user.id,
        agentId,
      }
    );

    // If output was sanitized, log it (but don't block - sanitization already applied)
    if (outputGuard.wasModified) {
      console.log('[Safety Guard] Output was sanitized for user:', session.user.id);
    }

    // 12b. PII Detection - Check AI output for accidentally generated PII
    // Redacts any sensitive information in the output (defensive measure)
    const outputPIIGuard = await guardOutputForPII(
      JSON.stringify(validatedOutput),
      {
        userId: session.user.id,
        agentId,
      }
    );

    // Use redacted output if PII was found (allows response but with PII masked)
    const finalOutput = outputPIIGuard.result?.redactedContent
      ? JSON.parse(outputPIIGuard.result.redactedContent)
      : validatedOutput;

    if (outputPIIGuard.result?.hasPII) {
      console.log('[PII Guard] Output contained PII, redacted for user:', session.user.id);
    }

    // 13. Render to Markdown
    const renderedMarkdown = agent.render(finalOutput);

    // 14. Deduct tokens
    await deductTokens(session.user.id, aiResponse.usage.totalTokens);

    // 15. Create or update session
    const agentSession = await createOrUpdateSession({
      userId: session.user.id,
      agentId,
      sessionId,
      input: validatedInputs,
      output: finalOutput,
      markdown: renderedMarkdown,
      usage: aiResponse.usage,
    });

    // 16. Log usage for billing
    await logUsage({
      userId: session.user.id,
      agentId,
      sessionId: agentSession.id,
      inputTokens: aiResponse.usage.inputTokens,
      outputTokens: aiResponse.usage.outputTokens,
    });

    // 17. Return response
    const duration = Date.now() - startTime;

    return NextResponse.json({
      sessionId: agentSession.id,
      output: finalOutput,
      markdown: renderedMarkdown,
      usage: aiResponse.usage,
      metadata: {
        agentId,
        model: aiResponse.metadata.model,
        durationMs: duration,
      },
    });
  } catch (error) {
    console.error('Query error:', error);

    // Handle specific error types
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Output Validation Error',
          message: 'AI response did not match expected schema',
          details: error.flatten().fieldErrors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to process query' },
      { status: 500 }
    );
  }
}

/**
 * Check if user has token quota remaining
 */
async function checkQuota(userId: string): Promise<{ hasQuota: boolean; remaining: number }> {
  // Check user's personal quota
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { org: true },
      },
    },
  });

  if (!user) {
    return { hasQuota: false, remaining: 0 };
  }

  // For now, use org quota if user is in an org
  const primaryOrg = user.memberships[0]?.org;
  if (primaryOrg) {
    return {
      hasQuota: primaryOrg.tokensRemaining > 0,
      remaining: primaryOrg.tokensRemaining,
    };
  }

  // Free tier: 1000 tokens per month
  // TODO: Implement personal quota tracking
  return { hasQuota: true, remaining: 1000 };
}

/**
 * Deduct tokens from user/org quota
 */
async function deductTokens(userId: string, tokens: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { org: true },
      },
    },
  });

  const primaryOrg = user?.memberships[0]?.org;
  if (primaryOrg) {
    await prisma.org.update({
      where: { id: primaryOrg.id },
      data: {
        tokensRemaining: {
          decrement: tokens,
        },
      },
    });
  }
}

/**
 * Process uploaded files and generate read URLs
 */
interface ProcessedFiles {
  files: Record<string, { filename: string; url: string }>;
  fileUris: Array<{ mimeType: string; uri: string }>;
}

async function processFiles(
  files: Array<{ fieldName: string; gcsPath: string; filename: string; mimeType?: string }>
): Promise<ProcessedFiles> {
  const result: Record<string, { filename: string; url: string }> = {};
  const fileUris: Array<{ mimeType: string; uri: string }> = [];

  for (const file of files) {
    // Generate signed read URL
    const url = await generateReadUrl(file.gcsPath);

    result[file.fieldName] = {
      filename: file.filename,
      url,
    };

    fileUris.push({
      mimeType: file.mimeType || 'application/octet-stream',
      uri: `gs://${process.env.GCS_BUCKET || 'expert-ai-uploads-dev'}/${file.gcsPath}`,
    });
  }

  return { files: result, fileUris };
}

/**
 * Generate a signed URL for reading a file
 */
async function generateReadUrl(gcsPath: string): Promise<string> {
  const bucketName = process.env.GCS_BUCKET || 'expert-ai-uploads-dev';

  if (process.env.GCS_MOCK === 'true' || process.env.NODE_ENV === 'test') {
    return `https://storage.googleapis.com/${bucketName}/${gcsPath}?mockRead=true`;
  }

  try {
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(gcsPath);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return url;
  } catch (error) {
    console.error('Error generating read URL:', error);
    return `https://storage.googleapis.com/${bucketName}/${gcsPath}`;
  }
}

/**
 * Load organization context for the agent
 */
async function loadOrgContext(userId: string, agentId: string): Promise<string | undefined> {
  // Get user's active org
  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: {
      org: {
        include: {
          contextFiles: {
            where: {
              OR: [
                { agentIds: { isEmpty: true } }, // All agents
                { agentIds: { has: agentId } }, // Specific agent
              ],
            },
          },
        },
      },
    },
  });

  if (!membership?.org?.contextFiles?.length) {
    return undefined;
  }

  // Combine context files into text
  // In production, this would fetch and parse the actual files
  const contextParts = membership.org.contextFiles.map(
    (cf) => `[Context File: ${cf.name}]\nPath: ${cf.gcsPath}`
  );

  return contextParts.join('\n\n');
}

/**
 * Create or update agent session
 */
async function createOrUpdateSession({
  userId,
  agentId,
  sessionId,
  input,
  output,
  markdown,
  usage,
}: {
  userId: string;
  agentId: string;
  sessionId?: string;
  input: unknown;
  output: unknown;
  markdown: string;
  usage: { inputTokens: number; outputTokens: number };
}): Promise<{ id: string }> {
  if (sessionId) {
    // Update existing session
    const existing = await prisma.session.findUnique({
      where: { id: sessionId, userId },
    });

    if (existing) {
      // Add message to session
      await prisma.message.create({
        data: {
          sessionId,
          role: 'AGENT',
          content: markdown,
          jsonData: output as object,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        },
      });

      return { id: sessionId };
    }
  }

  // Create new session
  const newSession = await prisma.session.create({
    data: {
      userId,
      agentId,
      messages: {
        create: [
          {
            role: 'USER',
            content: JSON.stringify(input),
          },
          {
            role: 'AGENT',
            content: markdown,
            jsonData: output as object,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          },
        ],
      },
    },
  });

  return { id: newSession.id };
}

/**
 * Log usage for billing
 */
async function logUsage({
  userId,
  agentId,
  sessionId,
  inputTokens,
  outputTokens,
}: {
  userId: string;
  agentId: string;
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  await prisma.usageRecord.create({
    data: {
      userId,
      agentId,
      sessionId,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  });
}
