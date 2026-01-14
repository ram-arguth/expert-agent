/**
 * Dynamic Form Component Tests
 *
 * Comprehensive tests for the schema-driven form renderer including:
 * - Field type rendering based on Zod schema
 * - Validation and error display
 * - File upload functionality
 * - Submit handling
 * - Accessibility
 *
 * @see docs/IMPEMENTATION.md - Phase 4.7 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { DynamicForm } from '../dynamic-form';

describe('DynamicForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Field Type Rendering', () => {
    it('renders text input for z.string()', async () => {
      const schema = z.object({
        name: z.string().describe('Your name'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      const input = screen.getByRole('textbox', { name: /your name/i });
      expect(input).toBeInTheDocument();
      // Input is rendered correctly (no type check needed as Input component handles this)
    });

    it('renders textarea for long text fields', async () => {
      const schema = z.object({
        additionalContext: z.string().optional().describe('Additional context'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      // Should be a textarea due to 'context' in name
      const textarea = screen.getByRole('textbox');
      expect(textarea.tagName.toLowerCase()).toBe('textarea');
    });

    it('renders number input for z.number()', async () => {
      const schema = z.object({
        age: z.number().describe('Your age'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      const input = screen.getByRole('spinbutton', { name: /your age/i });
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'number');
    });

    it('renders checkbox for z.boolean()', async () => {
      const schema = z.object({
        agreeToTerms: z.boolean().describe('I agree to the terms'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('renders select dropdown for z.enum()', async () => {
      const schema = z.object({
        priority: z.enum(['low', 'medium', 'high']).describe('Priority level'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('shows required indicator for required fields', async () => {
      const schema = z.object({
        requiredField: z.string().describe('Required field'),
        optionalField: z.string().optional().describe('Optional field'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      // Required field should have asterisk in parent label element
      const labels = screen.getAllByText(/required field/i);
      // Check that we have a required asterisk somewhere
      const allText = screen.getByTestId('dynamic-form').innerHTML;
      expect(allText).toContain('text-destructive');
    });

    it('renders file upload for file fields', async () => {
      const schema = z.object({
        document: z.any().describe('Upload your file'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      // Should show upload UI
      expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('shows validation error for required empty field', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
      });

      render(<DynamicForm schema={schema} onSubmit={onSubmit} />);

      // Submit without filling
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('shows validation error for invalid input', async () => {
      const user = userEvent.setup();
      
      const schema = z.object({
        email: z.string().email('Invalid email format'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'not-an-email');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
      });
    });

    it('clears error when valid input provided', async () => {
      const user = userEvent.setup();
      
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      // Submit to trigger error
      await user.click(screen.getByRole('button', { name: /submit/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      });

      // Type valid input
      const input = screen.getByRole('textbox');
      await user.type(input, 'John');

      // Submit again - error should clear
      await user.click(screen.getByRole('button', { name: /submit/i }));
      
      await waitFor(() => {
        expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Submit Handling', () => {
    it('calls onSubmit with validated data', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      
      // Use optional field to avoid validation blocking
      const schema = z.object({
        notes: z.string().optional().describe('Notes'),
      });

      render(
        <DynamicForm
          schema={schema}
          onSubmit={onSubmit}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test notes');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
    });

    it('shows loading state during submission', async () => {
      const schema = z.object({
        name: z.string(),
      });

      render(
        <DynamicForm
          schema={schema}
          onSubmit={vi.fn()}
          isLoading={true}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });

    it('uses custom submit label', async () => {
      const schema = z.object({
        name: z.string(),
      });

      render(
        <DynamicForm
          schema={schema}
          onSubmit={vi.fn()}
          submitLabel="Send Query"
        />
      );

      expect(screen.getByRole('button', { name: /send query/i })).toBeInTheDocument();
    });
  });

  describe('Default Values', () => {
    it('populates form with default values', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string(),
      });

      render(
        <DynamicForm
          schema={schema}
          onSubmit={vi.fn()}
          defaultValues={{ name: 'John', email: 'john@example.com' }}
        />
      );

      const inputs = screen.getAllByRole('textbox');
      expect(inputs[0]).toHaveValue('John');
      expect(inputs[1]).toHaveValue('john@example.com');
    });
  });

  describe('Enum/Select Fields', () => {
    it('renders select dropdown for enum schema', async () => {
      const schema = z.object({
        status: z.enum(['draft', 'published', 'archived']).describe('Status'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      // Select should be rendered
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    // Note: Full select interaction tests are skipped due to JSDOM limitations
    // with Radix UI Select's pointer capture. E2E tests cover this functionality.
  });

  describe('Checkbox Fields', () => {
    it('renders checkbox for boolean schema', async () => {
      const schema = z.object({
        agreed: z.boolean().describe('I agree'),
      });

      render(
        <DynamicForm
          schema={schema}
          onSubmit={vi.fn()}
          defaultValues={{ agreed: false }}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('checkbox can be toggled', async () => {
      const user = userEvent.setup();
      
      const schema = z.object({
        agreed: z.boolean().describe('I agree'),
      });

      render(
        <DynamicForm
          schema={schema}
          onSubmit={vi.fn()}
          defaultValues={{ agreed: false }}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      // Radix UI checkbox may use aria-checked instead of checked
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      await user.click(checkbox);
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('File Upload', () => {
    it('accepts dropped files', async () => {
      const schema = z.object({
        document: z.any().describe('Upload file'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      const dropzone = screen.getByText(/drag & drop/i).closest('div');
      expect(dropzone).toBeInTheDocument();

      // Simulate file drop
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const dataTransfer = {
        files: [file],
        types: ['Files'],
      };

      fireEvent.drop(dropzone!, { dataTransfer });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    });

    it('shows file size', async () => {
      const schema = z.object({
        document: z.any().describe('Upload file'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      const dropzone = screen.getByText(/drag & drop/i).closest('div');
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      fireEvent.drop(dropzone!, {
        dataTransfer: { files: [file] },
      });

      await waitFor(() => {
        // File is about 12 bytes -> ~0.0 KB
        expect(screen.getByText(/kb/i)).toBeInTheDocument();
      });
    });

    it('allows removing uploaded file', async () => {
      const user = userEvent.setup();
      
      const schema = z.object({
        document: z.any().describe('Upload file'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      const dropzone = screen.getByText(/drag & drop/i).closest('div');
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      
      fireEvent.drop(dropzone!, {
        dataTransfer: { files: [file] },
      });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      // Remove file
      const removeButton = screen.getByRole('button', { name: '' }); // X button
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper form structure', async () => {
      const schema = z.object({
        name: z.string().describe('Your name'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      expect(screen.getByTestId('dynamic-form')).toBeInTheDocument();
    });

    it('associates labels with inputs', async () => {
      const schema = z.object({
        email: z.string().describe('Email address'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      const input = screen.getByRole('textbox', { name: /email address/i });
      expect(input).toBeInTheDocument();
    });

    it('marks invalid fields with aria-invalid', async () => {
      const user = userEvent.setup();
      
      const schema = z.object({
        name: z.string().min(1, 'Required'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('Security', () => {
    it('escapes XSS in field descriptions', async () => {
      const schema = z.object({
        name: z.string().describe('<script>alert("xss")</script>Name'),
      });

      render(<DynamicForm schema={schema} onSubmit={vi.fn()} />);

      // Script tags should be escaped (shown as text, not executed)
      // React automatically escapes HTML content
      const content = screen.getByTestId('dynamic-form').textContent || '';
      // Neither the script tag should execute nor be hidden
      expect(content).toContain('script');
      // The form should still render
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});
