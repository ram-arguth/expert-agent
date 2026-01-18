/**
 * Memory Summarization Service
 *
 * Summarizes old sessions to reduce storage and improve performance.
 * Sessions older than 14 days are archived with AI-generated summaries.
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.5
 */

import { prisma } from "@/lib/db";
import { Storage } from "@google-cloud/storage";

// Lazy initialization of GCS client
let storageInstance: Storage | null = null;

function getStorage(): Storage {
  if (!storageInstance) {
    storageInstance = new Storage();
  }
  return storageInstance;
}

const ARCHIVE_AGE_DAYS = 14;
const BUCKET_NAME = process.env.GCS_SUMMARIES_BUCKET || "expert-ai-summaries";

export interface SummarizationResult {
  sessionId: string;
  success: boolean;
  summaryUrl?: string;
  error?: string;
}

export interface SummarizationBatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: SummarizationResult[];
}

/**
 * Find sessions eligible for summarization
 * - Updated more than 14 days ago
 * - Not yet archived
 */
export async function findSessionsToSummarize(
  limit = 100,
): Promise<{ id: string; userId: string; agentId: string; createdAt: Date }[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AGE_DAYS);

  return prisma.session.findMany({
    where: {
      updatedAt: { lt: cutoffDate },
      archived: false,
    },
    select: {
      id: true,
      userId: true,
      agentId: true,
      createdAt: true,
    },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });
}

/**
 * Generate summary for a session using AI
 */
export async function generateSessionSummary(
  sessionId: string,
): Promise<string> {
  // Get session messages
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 50, // Limit messages for context window
      },
    },
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Build conversation for summarization
  const conversation = session.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  // Use Vertex AI to generate summary
  // Note: In production, this would call the Gemini API
  // For now, we generate a structured summary
  const summary = await generateAISummary(session.agentId, conversation);

  return summary;
}

/**
 * Generate AI summary (placeholder - integrate with Vertex AI)
 */
async function generateAISummary(
  agentId: string,
  conversation: string,
): Promise<string> {
  // In production, call Gemini API with summarization prompt
  // For now, return a structured summary format

  const messageCount = conversation.split("\n\n").length;
  const wordCount = conversation.split(/\s+/).length;

  return JSON.stringify({
    agentId,
    messageCount,
    approximateWordCount: wordCount,
    summary: `This session contained ${messageCount} messages with approximately ${wordCount} words. Full conversation archived.`,
    archivedAt: new Date().toISOString(),
    version: "1.0",
  });
}

/**
 * Save summary to GCS and update session
 */
export async function archiveSession(
  sessionId: string,
  summary: string,
): Promise<string> {
  const storage = getStorage();
  const bucket = storage.bucket(BUCKET_NAME);
  const fileName = `summaries/${sessionId}.json`;
  const file = bucket.file(fileName);

  // Upload summary to GCS
  await file.save(summary, {
    contentType: "application/json",
    metadata: {
      sessionId,
      archivedAt: new Date().toISOString(),
    },
  });

  const summaryUrl = `gs://${BUCKET_NAME}/${fileName}`;

  // Update session
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      archived: true,
      summaryUrl,
    },
  });

  return summaryUrl;
}

/**
 * Process a batch of sessions for summarization
 */
export async function summarizeBatch(
  limit = 50,
): Promise<SummarizationBatchResult> {
  const sessions = await findSessionsToSummarize(limit);

  const results: SummarizationResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const session of sessions) {
    try {
      const summary = await generateSessionSummary(session.id);
      const summaryUrl = await archiveSession(session.id, summary);

      results.push({
        sessionId: session.id,
        success: true,
        summaryUrl,
      });
      succeeded++;
    } catch (error) {
      results.push({
        sessionId: session.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      failed++;
    }
  }

  return {
    processed: sessions.length,
    succeeded,
    failed,
    results,
  };
}

/**
 * Load summary for an archived session
 */
export async function loadSessionSummary(
  sessionId: string,
): Promise<string | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { summaryUrl: true, archived: true },
  });

  if (!session?.archived || !session.summaryUrl) {
    return null;
  }

  // Parse GCS URL
  const match = session.summaryUrl.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    return null;
  }

  const [, bucketName, fileName] = match;
  const storage = getStorage();
  const [contents] = await storage.bucket(bucketName).file(fileName).download();

  return contents.toString("utf-8");
}
