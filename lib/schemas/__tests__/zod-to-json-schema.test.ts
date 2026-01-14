/**
 * Zod to JSON Schema Export Tests
 *
 * Tests for the JSON Schema export utility.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  zodSchemaToJsonSchema,
  generateAgentCard,
  exportSchemaAsJson,
  validateAgainstSchema,
  extractFieldDescriptions,
  getRequiredFields,
  isA2ACompatible,
  generateAgentCards,
  exportAgentCatalogManifest,
  type JSONSchema7,
} from '../zod-to-json-schema';

// =============================================================================
// Test Schemas
// =============================================================================

const SimpleSchema = z.object({
  name: z.string().describe('The user name'),
  age: z.number().int().min(0).max(150).describe('Age in years'),
  email: z.string().email().optional().describe('Email address'),
});

const EnumSchema = z.object({
  status: z.enum(['pending', 'active', 'completed', 'cancelled']).describe('Current status'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

const ArraySchema = z.object({
  tags: z.array(z.string()).describe('List of tags'),
  items: z.array(
    z.object({
      id: z.string(),
      value: z.number(),
    })
  ),
});

const NestedSchema = z.object({
  user: z.object({
    name: z.string(),
    profile: z.object({
      bio: z.string().optional(),
      avatar: z.string().url().optional(),
    }),
  }),
  settings: z.record(z.string()),
});

const ComplexAgentInput = z.object({
  query: z.string().min(10).max(5000).describe('The main query or request'),
  options: z
    .object({
      format: z.enum(['json', 'markdown', 'html']).default('markdown'),
      includeMetadata: z.boolean().default(true),
    })
    .optional(),
  files: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        mimeType: z.string(),
      })
    )
    .max(5)
    .optional(),
});

// =============================================================================
// Core Export Tests
// =============================================================================

describe('Zod to JSON Schema Export', () => {
  describe('zodSchemaToJsonSchema', () => {
    it('exports valid JSON Schema from simple Zod schema', () => {
      const jsonSchema = zodSchemaToJsonSchema(SimpleSchema);

      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toBeDefined();
      expect(jsonSchema.properties?.name).toBeDefined();
      expect(jsonSchema.properties?.age).toBeDefined();
    });

    it('includes $schema version by default', () => {
      const jsonSchema = zodSchemaToJsonSchema(SimpleSchema);
      expect(jsonSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    });

    it('can exclude $schema version', () => {
      const jsonSchema = zodSchemaToJsonSchema(SimpleSchema, {
        includeSchemaVersion: false,
      });
      expect(jsonSchema.$schema).toBeUndefined();
    });

    it('adds custom $id when provided', () => {
      const jsonSchema = zodSchemaToJsonSchema(SimpleSchema, {
        schemaId: 'urn:example:user',
      });
      expect(jsonSchema.$id).toBe('urn:example:user');
    });

    it('adds title and description when provided', () => {
      const jsonSchema = zodSchemaToJsonSchema(SimpleSchema, {
        title: 'User Schema',
        description: 'A user object',
      });
      expect(jsonSchema.title).toBe('User Schema');
      expect(jsonSchema.description).toBe('A user object');
    });

    it('preserves .describe() as descriptions', () => {
      const jsonSchema = zodSchemaToJsonSchema(SimpleSchema);
      const props = jsonSchema.properties as Record<string, JSONSchema7>;

      expect(props.name?.description).toBe('The user name');
      expect(props.age?.description).toBe('Age in years');
      expect(props.email?.description).toBe('Email address');
    });

    it('handles enum types correctly', () => {
      const jsonSchema = zodSchemaToJsonSchema(EnumSchema);
      const props = jsonSchema.properties as Record<string, JSONSchema7>;

      expect(props.status?.enum).toContain('pending');
      expect(props.status?.enum).toContain('active');
      expect(props.status?.enum).toContain('completed');
      expect(props.status?.enum).toContain('cancelled');
    });

    it('handles array types correctly', () => {
      const jsonSchema = zodSchemaToJsonSchema(ArraySchema);
      const props = jsonSchema.properties as Record<string, JSONSchema7>;

      expect(props.tags?.type).toBe('array');
      expect(props.items?.type).toBe('array');
    });

    it('handles nested objects', () => {
      const jsonSchema = zodSchemaToJsonSchema(NestedSchema);
      const props = jsonSchema.properties as Record<string, JSONSchema7>;

      expect(props.user?.type).toBe('object');
      expect(props.settings?.type).toBe('object');
    });

    it('marks required fields correctly', () => {
      const jsonSchema = zodSchemaToJsonSchema(SimpleSchema);

      expect(jsonSchema.required).toContain('name');
      expect(jsonSchema.required).toContain('age');
      expect(jsonSchema.required).not.toContain('email'); // Optional
    });

    it('handles complex agent input schema', () => {
      const jsonSchema = zodSchemaToJsonSchema(ComplexAgentInput);
      const props = jsonSchema.properties as Record<string, JSONSchema7>;

      expect(props.query?.description).toBe('The main query or request');
      expect(props.options?.type).toBe('object');
      expect(props.files?.type).toBe('array');
    });
  });

  describe('exportSchemaAsJson', () => {
    it('exports schema as formatted JSON string', () => {
      const json = exportSchemaAsJson(SimpleSchema);

      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.type).toBe('object');
    });

    it('produces valid JSON', () => {
      const json = exportSchemaAsJson(ComplexAgentInput);

      expect(() => JSON.parse(json)).not.toThrow();
    });
  });
});

// =============================================================================
// Agent Card Tests
// =============================================================================

describe('Agent Card Generation', () => {
  const MockInputSchema = z.object({
    query: z.string().describe('User query'),
    context: z.string().optional(),
  });

  const MockOutputSchema = z.object({
    result: z.string().describe('Analysis result'),
    confidence: z.number().min(0).max(100),
  });

  describe('generateAgentCard', () => {
    it('generates valid A2A agent card', () => {
      const card = generateAgentCard(
        'Test Agent',
        'A test agent for testing',
        '1.0.0',
        MockInputSchema,
        MockOutputSchema,
        ['analyze', 'summarize']
      );

      expect(card.name).toBe('Test Agent');
      expect(card.description).toBe('A test agent for testing');
      expect(card.version).toBe('1.0.0');
      expect(card.capabilities).toContain('analyze');
    });

    it('includes input and output schemas', () => {
      const card = generateAgentCard(
        'Test Agent',
        'Description',
        '1.0.0',
        MockInputSchema,
        MockOutputSchema
      );

      expect(card.inputSchema).toBeDefined();
      expect(card.inputSchema.type).toBe('object');
      expect(card.outputSchema).toBeDefined();
      expect(card.outputSchema.type).toBe('object');
    });

    it('generates proper $id for schemas', () => {
      const card = generateAgentCard(
        'UX Analyst',
        'Description',
        '1.0.0',
        MockInputSchema,
        MockOutputSchema
      );

      expect(card.inputSchema.$id).toBe('urn:expert-ai:agent:ux-analyst:input');
      expect(card.outputSchema.$id).toBe('urn:expert-ai:agent:ux-analyst:output');
    });

    it('includes metadata when provided', () => {
      const card = generateAgentCard(
        'Test Agent',
        'Description',
        '1.0.0',
        MockInputSchema,
        MockOutputSchema,
        [],
        { tier: 'pro', tokensPerQuery: 1000 }
      );

      expect(card.metadata?.tier).toBe('pro');
      expect(card.metadata?.tokensPerQuery).toBe(1000);
    });
  });

  describe('generateAgentCards', () => {
    it('generates cards for multiple agents', () => {
      const agents = [
        {
          id: 'agent-1',
          name: 'Agent 1',
          description: 'First agent',
          version: '1.0.0',
          inputSchema: MockInputSchema,
          outputSchema: MockOutputSchema,
        },
        {
          id: 'agent-2',
          name: 'Agent 2',
          description: 'Second agent',
          version: '2.0.0',
          inputSchema: MockInputSchema,
          outputSchema: MockOutputSchema,
        },
      ];

      const cards = generateAgentCards(agents);

      expect(Object.keys(cards)).toHaveLength(2);
      expect(cards['agent-1'].name).toBe('Agent 1');
      expect(cards['agent-2'].name).toBe('Agent 2');
    });
  });

  describe('exportAgentCatalogManifest', () => {
    it('exports catalog as JSON manifest', () => {
      const agents = [
        {
          id: 'test-agent',
          name: 'Test Agent',
          description: 'A test agent',
          version: '1.0.0',
          inputSchema: MockInputSchema,
          outputSchema: MockOutputSchema,
        },
      ];

      const manifest = exportAgentCatalogManifest(agents);
      const parsed = JSON.parse(manifest);

      expect(parsed.title).toContain('Expert Agent Platform');
      expect(parsed.agents['test-agent']).toBeDefined();
      expect(parsed.generatedAt).toBeDefined();
    });
  });
});

// =============================================================================
// Validation Tests
// =============================================================================

describe('Schema Validation', () => {
  describe('validateAgainstSchema', () => {
    it('validates object type correctly', () => {
      const schema: JSONSchema7 = { type: 'object', properties: {} };

      expect(validateAgainstSchema({}, schema).valid).toBe(true);
      expect(validateAgainstSchema('string', schema).valid).toBe(false);
    });

    it('validates string type correctly', () => {
      const schema: JSONSchema7 = { type: 'string' };

      expect(validateAgainstSchema('hello', schema).valid).toBe(true);
      expect(validateAgainstSchema(123, schema).valid).toBe(false);
    });

    it('validates number type correctly', () => {
      const schema: JSONSchema7 = { type: 'number' };

      expect(validateAgainstSchema(42, schema).valid).toBe(true);
      expect(validateAgainstSchema('42', schema).valid).toBe(false);
    });

    it('validates boolean type correctly', () => {
      const schema: JSONSchema7 = { type: 'boolean' };

      expect(validateAgainstSchema(true, schema).valid).toBe(true);
      expect(validateAgainstSchema('true', schema).valid).toBe(false);
    });

    it('validates array type correctly', () => {
      const schema: JSONSchema7 = { type: 'array' };

      expect(validateAgainstSchema([1, 2, 3], schema).valid).toBe(true);
      expect(validateAgainstSchema({ length: 3 }, schema).valid).toBe(false);
    });

    it('validates enum values', () => {
      const schema: JSONSchema7 = { enum: ['a', 'b', 'c'] };

      expect(validateAgainstSchema('a', schema).valid).toBe(true);
      expect(validateAgainstSchema('d', schema).valid).toBe(false);
    });

    it('validates required properties', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      expect(validateAgainstSchema({ name: 'John', age: 30 }, schema).valid).toBe(true);
      expect(validateAgainstSchema({ name: 'John' }, schema).valid).toBe(false);

      const result = validateAgainstSchema({ name: 'John' }, schema);
      expect(result.errors).toContain('Missing required property: age');
    });
  });
});

// =============================================================================
// Introspection Tests
// =============================================================================

describe('Schema Introspection', () => {
  describe('extractFieldDescriptions', () => {
    it('extracts descriptions from schema', () => {
      const descriptions = extractFieldDescriptions(SimpleSchema);

      expect(descriptions.name).toBe('The user name');
      expect(descriptions.age).toBe('Age in years');
      expect(descriptions.email).toBe('Email address');
    });

    it('returns empty object for schema without descriptions', () => {
      const schema = z.object({
        x: z.number(),
        y: z.number(),
      });

      const descriptions = extractFieldDescriptions(schema);
      expect(Object.keys(descriptions)).toHaveLength(0);
    });
  });

  describe('getRequiredFields', () => {
    it('returns required field names', () => {
      const required = getRequiredFields(SimpleSchema);

      expect(required).toContain('name');
      expect(required).toContain('age');
      expect(required).not.toContain('email');
    });

    it('returns empty array for all-optional schema', () => {
      const schema = z.object({
        a: z.string().optional(),
        b: z.number().optional(),
      });

      const required = getRequiredFields(schema);
      expect(required).toHaveLength(0);
    });
  });

  describe('isA2ACompatible', () => {
    it('returns true for object schemas with properties', () => {
      expect(isA2ACompatible(SimpleSchema)).toBe(true);
      expect(isA2ACompatible(ComplexAgentInput)).toBe(true);
    });

    it('returns false for non-object schemas', () => {
      expect(isA2ACompatible(z.string())).toBe(false);
      expect(isA2ACompatible(z.number())).toBe(false);
      expect(isA2ACompatible(z.array(z.string()))).toBe(false);
    });

    it('returns false for empty object schema', () => {
      expect(isA2ACompatible(z.object({}))).toBe(false);
    });
  });
});
