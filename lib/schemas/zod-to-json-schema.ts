/**
 * Zod to JSON Schema Export Utility
 *
 * Converts Zod schemas to JSON Schema format for A2A (Agent-to-Agent) protocol
 * compatibility and external integrations.
 *
 * @see https://google.github.io/A2A/ - A2A Protocol
 * @see docs/DESIGN.md - Agent Architecture section
 */

import { z, type ZodSchema } from 'zod';
import { zodToJsonSchema, type JsonSchema7Type } from 'zod-to-json-schema';

// =============================================================================
// Types
// =============================================================================

/**
 * JSON Schema 7 compatible type (subset)
 */
export type JSONSchema7 = JsonSchema7Type & {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  definitions?: Record<string, JSONSchema7>;
  properties?: Record<string, JSONSchema7>;
  required?: string[];
  type?: string | string[];
  items?: JSONSchema7 | JSONSchema7[];
  enum?: (string | number | boolean | null)[];
  format?: string;
};

/**
 * A2A Agent Card format (subset for input/output schemas)
 */
export interface A2AAgentCard {
  name: string;
  description: string;
  version: string;
  inputSchema: JSONSchema7;
  outputSchema: JSONSchema7;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Export options
 */
export interface ExportOptions {
  /**
   * Include $schema property (JSON Schema version)
   * @default true
   */
  includeSchemaVersion?: boolean;

  /**
   * Custom $id for the schema
   */
  schemaId?: string;

  /**
   * Title for the schema
   */
  title?: string;

  /**
   * Description for the schema
   */
  description?: string;

  /**
   * Use definitions/refs for complex types
   * @default true
   */
  useDefinitions?: boolean;

  /**
   * Remove undefined from optional fields
   * @default true
   */
  removeUndefined?: boolean;
}

// =============================================================================
// Core Export Functions
// =============================================================================

/**
 * Convert a Zod schema to JSON Schema 7 format
 */
export function zodSchemaToJsonSchema(
  schema: ZodSchema,
  options: ExportOptions = {}
): JSONSchema7 {
  const {
    includeSchemaVersion = true,
    schemaId,
    title,
    description,
    useDefinitions = true,
  } = options;

  // Use zod-to-json-schema with appropriate options
  const jsonSchema = zodToJsonSchema(schema, {
    $refStrategy: useDefinitions ? 'root' : 'none',
    target: 'jsonSchema7',
  }) as JSONSchema7;

  // Handle $schema property
  if (includeSchemaVersion) {
    if (!jsonSchema.$schema) {
      jsonSchema.$schema = 'http://json-schema.org/draft-07/schema#';
    }
  } else {
    // Remove $schema if it was added by zod-to-json-schema
    delete jsonSchema.$schema;
  }

  if (schemaId) {
    jsonSchema.$id = schemaId;
  }

  if (title) {
    jsonSchema.title = title;
  }

  if (description) {
    jsonSchema.description = description;
  }

  return jsonSchema;
}

/**
 * Generate an A2A-compatible Agent Card from agent schemas
 */
export function generateAgentCard(
  name: string,
  description: string,
  version: string,
  inputSchema: ZodSchema,
  outputSchema: ZodSchema,
  capabilities?: string[],
  metadata?: Record<string, unknown>
): A2AAgentCard {
  return {
    name,
    description,
    version,
    inputSchema: zodSchemaToJsonSchema(inputSchema, {
      title: `${name} Input`,
      description: `Input schema for ${name}`,
      schemaId: `urn:expert-ai:agent:${name.toLowerCase().replace(/\s+/g, '-')}:input`,
    }),
    outputSchema: zodSchemaToJsonSchema(outputSchema, {
      title: `${name} Output`,
      description: `Output schema for ${name}`,
      schemaId: `urn:expert-ai:agent:${name.toLowerCase().replace(/\s+/g, '-')}:output`,
    }),
    capabilities,
    metadata,
  };
}

/**
 * Export a schema to a JSON string (formatted for readability)
 */
export function exportSchemaAsJson(
  schema: ZodSchema,
  options: ExportOptions = {}
): string {
  const jsonSchema = zodSchemaToJsonSchema(schema, options);
  return JSON.stringify(jsonSchema, null, 2);
}

/**
 * Validate that a value matches a JSON Schema (basic validation)
 * Note: For full validation, use a JSON Schema validator like ajv
 */
export function validateAgainstSchema(
  value: unknown,
  schema: JSONSchema7
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // Basic type validation
  if (schema.type === 'object' && typeof value !== 'object') {
    errors.push(`Expected object, got ${typeof value}`);
  }

  if (schema.type === 'string' && typeof value !== 'string') {
    errors.push(`Expected string, got ${typeof value}`);
  }

  if (schema.type === 'number' && typeof value !== 'number') {
    errors.push(`Expected number, got ${typeof value}`);
  }

  if (schema.type === 'boolean' && typeof value !== 'boolean') {
    errors.push(`Expected boolean, got ${typeof value}`);
  }

  if (schema.type === 'array' && !Array.isArray(value)) {
    errors.push(`Expected array, got ${typeof value}`);
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value as string | number | boolean | null)) {
    errors.push(`Value must be one of: ${schema.enum.join(', ')}`);
  }

  // Required properties validation for objects
  if (
    schema.type === 'object' &&
    schema.required &&
    typeof value === 'object' &&
    value !== null
  ) {
    const obj = value as Record<string, unknown>;
    for (const requiredProp of schema.required) {
      if (!(requiredProp in obj)) {
        errors.push(`Missing required property: ${requiredProp}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// =============================================================================
// Agent Card Generation Helpers
// =============================================================================

/**
 * Generate agent cards for all registered agents
 */
export function generateAgentCards(
  agents: Array<{
    id: string;
    name: string;
    description: string;
    version: string;
    inputSchema: ZodSchema;
    outputSchema: ZodSchema;
    capabilities?: string[];
  }>
): Record<string, A2AAgentCard> {
  const cards: Record<string, A2AAgentCard> = {};

  for (const agent of agents) {
    cards[agent.id] = generateAgentCard(
      agent.name,
      agent.description,
      agent.version,
      agent.inputSchema,
      agent.outputSchema,
      agent.capabilities
    );
  }

  return cards;
}

/**
 * Export all agent cards as a single JSON manifest
 */
export function exportAgentCatalogManifest(
  agents: Array<{
    id: string;
    name: string;
    description: string;
    version: string;
    inputSchema: ZodSchema;
    outputSchema: ZodSchema;
    capabilities?: string[];
  }>
): string {
  const manifest = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Expert Agent Platform - Agent Catalog',
    description: 'A2A-compatible agent cards for all available agents',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    agents: generateAgentCards(agents),
  };

  return JSON.stringify(manifest, null, 2);
}

// =============================================================================
// Schema Introspection Helpers
// =============================================================================

/**
 * Extract field descriptions from a Zod schema
 */
export function extractFieldDescriptions(schema: ZodSchema): Record<string, string> {
  const descriptions: Record<string, string> = {};

  // Convert to JSON Schema which preserves descriptions
  const jsonSchema = zodSchemaToJsonSchema(schema, { useDefinitions: false });

  if (typeof jsonSchema === 'object' && 'properties' in jsonSchema && jsonSchema.properties) {
    for (const [key, value] of Object.entries(jsonSchema.properties)) {
      if (typeof value === 'object' && value !== null && 'description' in value) {
        descriptions[key] = value.description as string;
      }
    }
  }

  return descriptions;
}

/**
 * Get required fields from a Zod schema
 */
export function getRequiredFields(schema: ZodSchema): string[] {
  const jsonSchema = zodSchemaToJsonSchema(schema, { useDefinitions: false }) as JSONSchema7;
  return jsonSchema.required || [];
}

/**
 * Check if a Zod schema is compatible with A2A protocol
 * (must be an object schema with defined properties)
 */
export function isA2ACompatible(schema: ZodSchema): boolean {
  try {
    const jsonSchema = zodSchemaToJsonSchema(schema, { useDefinitions: false }) as JSONSchema7;
    return (
      jsonSchema.type === 'object' &&
      typeof jsonSchema.properties === 'object' &&
      Object.keys(jsonSchema.properties).length > 0
    );
  } catch {
    return false;
  }
}
