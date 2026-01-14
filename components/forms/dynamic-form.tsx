/**
 * Dynamic Form Component
 *
 * Schema-driven form renderer that builds forms from Zod schemas.
 * Used for agent input forms that vary by agent type.
 *
 * Features:
 * - Renders fields based on Zod schema types
 * - File upload support with drag-drop
 * - Validation with error messages
 * - Submit handling with loading state
 *
 * @see docs/IMPEMENTATION.md - Phase 4.2
 * @see docs/DESIGN.md - Agent Input Schemas
 */

'use client';

import * as React from 'react';
import { useForm, Controller, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z, ZodObject, ZodRawShape, ZodTypeAny } from 'zod';
import { Loader2, Upload, X, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';

/**
 * Field metadata extracted from Zod schema
 */
interface FieldMeta {
  name: string;
  type: 'string' | 'text' | 'number' | 'boolean' | 'enum' | 'file' | 'files';
  label: string;
  description?: string;
  required: boolean;
  options?: string[]; // For enum types
  accept?: string; // For file types
  multiple?: boolean; // For file arrays
  placeholder?: string;
  min?: number;
  max?: number;
}

/**
 * Extract field metadata from a Zod schema
 */
function extractFieldMeta(
  name: string,
  zodType: ZodTypeAny
): FieldMeta | null {
  // Handle optional wrapper
  let innerType = zodType;
  let required = true;
  
  // Unwrap ZodOptional
  if (zodType._def.typeName === 'ZodOptional') {
    innerType = zodType._def.innerType;
    required = false;
  }
  
  // Unwrap ZodNullable
  if (innerType._def.typeName === 'ZodNullable') {
    innerType = innerType._def.innerType;
    required = false;
  }
  
  // Unwrap ZodDefault (has a default value, so technically not required)
  if (innerType._def.typeName === 'ZodDefault') {
    innerType = innerType._def.innerType;
    required = false;
  }

  const description = innerType._def.description || zodType._def.description;
  const label = description || formatLabel(name);

  // Handle different Zod types
  switch (innerType._def.typeName) {
    case 'ZodString': {
      // Check if it's a long text field based on description
      const isLongText = description?.toLowerCase().includes('context') ||
                          description?.toLowerCase().includes('description') ||
                          name.toLowerCase().includes('context') ||
                          name.toLowerCase().includes('notes');
      return {
        name,
        type: isLongText ? 'text' : 'string',
        label,
        description,
        required,
        placeholder: `Enter ${label.toLowerCase()}`,
      };
    }

    case 'ZodNumber':
      return {
        name,
        type: 'number',
        label,
        description,
        required,
        min: innerType._def.checks?.find((c: { kind: string }) => c.kind === 'min')?.value,
        max: innerType._def.checks?.find((c: { kind: string }) => c.kind === 'max')?.value,
      };

    case 'ZodBoolean':
      return {
        name,
        type: 'boolean',
        label,
        description,
        required,
      };

    case 'ZodEnum':
      return {
        name,
        type: 'enum',
        label,
        description,
        required,
        options: innerType._def.values,
      };

    case 'ZodNativeEnum':
      return {
        name,
        type: 'enum',
        label,
        description,
        required,
        options: Object.values(innerType._def.values) as string[],
      };

    // File handling via custom check
    case 'ZodAny':
    case 'ZodUnknown':
      // Check description for file hints
      if (description?.toLowerCase().includes('file') ||
          description?.toLowerCase().includes('upload') ||
          description?.toLowerCase().includes('document')) {
        return {
          name,
          type: 'file',
          label,
          description,
          required,
          accept: '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg',
        };
      }
      return null;

    case 'ZodArray': {
      // Handle file arrays
      const elementType = innerType._def.type;
      if (elementType._def.description?.toLowerCase().includes('file') ||
          name.toLowerCase().includes('file')) {
        return {
          name,
          type: 'files',
          label,
          description,
          required,
          accept: '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg',
          multiple: true,
        };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Format a camelCase field name to a readable label
 */
function formatLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * File preview component
 */
function FilePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm truncate flex-1">{file.name}</span>
      <span className="text-xs text-muted-foreground">
        {(file.size / 1024).toFixed(1)} KB
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

/**
 * File drop zone component
 */
function FileDropZone({
  accept,
  multiple = false,
  value,
  onChange,
  error,
}: {
  accept?: string;
  multiple?: boolean;
  value: File | File[] | null;
  onChange: (files: File | File[] | null) => void;
  error?: string;
}) {
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      
      if (multiple) {
        const currentFiles = Array.isArray(value) ? value : [];
        onChange([...currentFiles, ...files]);
      } else {
        onChange(files[0]);
      }
    },
    [multiple, value, onChange]
  );

  const handleFileSelect = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      
      if (multiple) {
        const currentFiles = Array.isArray(value) ? value : [];
        onChange([...currentFiles, ...files]);
      } else {
        onChange(files[0]);
      }
      
      // Reset input for re-selection
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [multiple, value, onChange]
  );

  const handleRemove = React.useCallback(
    (index: number) => {
      if (multiple && Array.isArray(value)) {
        const newFiles = value.filter((_, i) => i !== index);
        onChange(newFiles.length > 0 ? newFiles : null);
      } else {
        onChange(null);
      }
    },
    [multiple, value, onChange]
  );

  const files = Array.isArray(value) ? value : value ? [value] : [];

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          isDragging && 'border-primary bg-primary/5',
          error && 'border-destructive',
          !isDragging && !error && 'border-muted-foreground/25 hover:border-primary/50'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handleFileSelect}
        />
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Drag & drop files here, or click to browse
        </p>
        {accept && (
          <p className="text-xs text-muted-foreground mt-1">
            Accepted: {accept.replace(/\./g, '').replace(/,/g, ', ')}
          </p>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <FilePreview
              key={`${file.name}-${index}`}
              file={file}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Dynamic Form Props
 */
export interface DynamicFormProps<T extends ZodRawShape> {
  /** Zod schema for form validation */
  schema: ZodObject<T>;
  /** Submit handler */
  onSubmit: (data: z.infer<ZodObject<T>>) => Promise<void>;
  /** Initial values */
  defaultValues?: Partial<z.infer<ZodObject<T>>>;
  /** Submit button text */
  submitLabel?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Dynamic Form Component
 *
 * Renders a form based on a Zod schema with automatic field type detection.
 */
export function DynamicForm<T extends ZodRawShape>({
  schema,
  onSubmit,
  defaultValues,
  submitLabel = 'Submit',
  isLoading = false,
  className,
}: DynamicFormProps<T>) {
  // Extract field metadata from schema
  const fields = React.useMemo(() => {
    const shape = schema.shape;
    return Object.entries(shape)
      .map(([name, type]) => extractFieldMeta(name, type as ZodTypeAny))
      .filter((field): field is FieldMeta => field !== null);
  }, [schema]);

  // Set up form
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as z.infer<typeof schema>,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = form;

  // Get error for a field
  const getError = (name: string): string | undefined => {
    const error = (errors as FieldErrors)[name];
    return error?.message as string | undefined;
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn('space-y-6', className)}
      data-testid="dynamic-form"
    >
      {fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name} className="flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </Label>

          {/* String input */}
          {field.type === 'string' && (
            <Input
              id={field.name}
              placeholder={field.placeholder}
              {...register(field.name)}
              aria-invalid={!!getError(field.name)}
            />
          )}

          {/* Text area */}
          {field.type === 'text' && (
            <Textarea
              id={field.name}
              placeholder={field.placeholder}
              rows={4}
              {...register(field.name)}
              aria-invalid={!!getError(field.name)}
            />
          )}

          {/* Number input */}
          {field.type === 'number' && (
            <Input
              id={field.name}
              type="number"
              min={field.min}
              max={field.max}
              {...register(field.name, { valueAsNumber: true })}
              aria-invalid={!!getError(field.name)}
            />
          )}

          {/* Boolean checkbox */}
          {field.type === 'boolean' && (
            <Controller
              name={field.name}
              control={control}
              render={({ field: controllerField }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={field.name}
                    checked={controllerField.value}
                    onCheckedChange={controllerField.onChange}
                  />
                  {field.description && (
                    <span className="text-sm text-muted-foreground">
                      {field.description}
                    </span>
                  )}
                </div>
              )}
            />
          )}

          {/* Enum select */}
          {field.type === 'enum' && field.options && (
            <Controller
              name={field.name as any}
              control={control}
              render={({ field: controllerField }) => (
                <Select
                  id={field.name}
                  value={controllerField.value}
                  onValueChange={controllerField.onChange}
                  placeholder={`Select ${field.label.toLowerCase()}`}
                  options={field.options!.map((option) => ({
                    value: option,
                    label: formatLabel(option),
                  }))}
                />
              )}
            />
          )}

          {/* File upload */}
          {(field.type === 'file' || field.type === 'files') && (
            <Controller
              name={field.name}
              control={control}
              render={({ field: controllerField }) => (
                <FileDropZone
                  accept={field.accept}
                  multiple={field.type === 'files'}
                  value={controllerField.value}
                  onChange={controllerField.onChange}
                  error={getError(field.name)}
                />
              )}
            />
          )}

          {/* Error message */}
          {field.type !== 'file' && field.type !== 'files' && getError(field.name) && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {getError(field.name)}
            </p>
          )}

          {/* Description (if not shown with boolean) */}
          {field.type !== 'boolean' && field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
      ))}

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
