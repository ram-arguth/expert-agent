/**
 * Guided Interview Panel Component
 *
 * Shows one question at a time with:
 * - Progress indicator
 * - Question display with appropriate input type
 * - Skip button for optional questions
 * - Start Analysis button when complete
 *
 * @see docs/IMPLEMENTATION.md - Phase 2.8 UI Integration
 */

'use client';

import * as React from 'react';
import { Loader2, ArrowRight, SkipForward, CheckCircle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// =============================================================================
// Types
// =============================================================================

export interface InterviewQuestion {
  id: string;
  question: string;
  description?: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'file' | 'boolean';
  options?: Array<{ value: string; label: string }>;
  required: boolean;
  placeholder?: string;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

export interface InterviewState {
  sessionId: string;
  currentStep: number;
  totalSteps: number;
  progress: number;
  isComplete: boolean;
  currentQuestion: InterviewQuestion | null;
  answers: Record<string, string | boolean>;
  canStartAnalysis: boolean;
  nextAction: 'answer' | 'start_analysis' | 'complete';
}

export interface GuidedInterviewPanelProps {
  agentId: string;
  agentName: string;
  onComplete: (answers: Record<string, string | boolean>) => void;
  onStartAnalysis: (answers: Record<string, string | boolean>) => void;
  className?: string;
}

// =============================================================================
// Interview Hook
// =============================================================================

function useInterview(agentId: string) {
  const [state, setState] = React.useState<InterviewState | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Start or resume interview
  const startInterview = React.useCallback(async (sessionId?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agents/${agentId}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionId ? { sessionId } : {}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start interview');
      }

      const data = await response.json();
      setState(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start interview');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  // Submit answer
  const submitAnswer = React.useCallback(async (answer: string | boolean) => {
    if (!state?.sessionId) return null;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agents/${agentId}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          answer: String(answer),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit answer');
      }

      const data = await response.json();
      setState(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [agentId, state?.sessionId]);

  // Skip question
  const skipQuestion = React.useCallback(async () => {
    if (!state?.sessionId) return null;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agents/${agentId}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          skipQuestion: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Cannot skip this question');
      }

      const data = await response.json();
      setState(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot skip this question');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [agentId, state?.sessionId]);

  // Initialize interview on mount
  React.useEffect(() => {
    startInterview();
  }, [startInterview]);

  return { state, isLoading, error, submitAnswer, skipQuestion, startInterview };
}

// =============================================================================
// Question Input Component
// =============================================================================

interface QuestionInputProps {
  question: InterviewQuestion;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  disabled?: boolean;
}

function QuestionInput({ question, value, onChange, disabled }: QuestionInputProps) {
  switch (question.type) {
    case 'textarea':
      return (
        <Textarea
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          disabled={disabled}
          className="min-h-[100px]"
          data-testid="interview-textarea"
        />
      );

    case 'select':
      return (
        <Select
          value={value as string}
          onValueChange={onChange}
          placeholder={question.placeholder || 'Select an option...'}
          options={question.options?.map(opt => ({ value: opt.value, label: opt.label })) || []}
          disabled={disabled}
          data-testid="interview-select"
        />
      );

    case 'boolean':
      return (
        <div className="flex items-center space-x-2">
          <Switch
            id="interview-switch"
            checked={value === true || value === 'true'}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled}
            data-testid="interview-switch"
          />
          <Label htmlFor="interview-switch">
            {value === true || value === 'true' ? 'Yes' : 'No'}
          </Label>
        </div>
      );

    case 'text':
    default:
      return (
        <Input
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          disabled={disabled}
          data-testid="interview-input"
        />
      );
  }
}

// =============================================================================
// Guided Interview Panel Component
// =============================================================================

export function GuidedInterviewPanel({
  agentId,
  agentName,
  onComplete,
  onStartAnalysis,
  className,
}: GuidedInterviewPanelProps) {
  const { state, isLoading, error, submitAnswer, skipQuestion } = useInterview(agentId);
  const [currentAnswer, setCurrentAnswer] = React.useState<string | boolean>('');

  // Reset answer when question changes
  React.useEffect(() => {
    if (state?.currentQuestion) {
      setCurrentAnswer(state.currentQuestion.type === 'boolean' ? false : '');
    }
  }, [state?.currentQuestion?.id]);

  // Handle submit
  const handleSubmit = async () => {
    const result = await submitAnswer(currentAnswer);
    if (result) {
      setCurrentAnswer('');
    }
  };

  // Handle skip
  const handleSkip = async () => {
    await skipQuestion();
    setCurrentAnswer('');
  };

  // Handle start analysis
  const handleStartAnalysis = () => {
    if (state?.answers) {
      onStartAnalysis(state.answers);
    }
  };

  // Handle complete
  const handleComplete = () => {
    if (state?.answers) {
      onComplete(state.answers);
    }
  };

  // Loading state
  if (isLoading && !state) {
    return (
      <Card className={cn('w-full max-w-2xl', className)} data-testid="interview-panel">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error && !state) {
    return (
      <Card className={cn('w-full max-w-2xl', className)} data-testid="interview-panel">
        <CardContent className="py-8 text-center">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // No state
  if (!state) {
    return null;
  }

  // Complete state
  if (state.isComplete) {
    return (
      <Card className={cn('w-full max-w-2xl', className)} data-testid="interview-panel">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <CardTitle>Interview Complete</CardTitle>
          </div>
          <CardDescription>
            All questions answered. Ready to start your {agentName} analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Progress value={100} className="h-2" />
          </div>
          <div className="text-sm text-muted-foreground">
            {Object.keys(state.answers).length} answers collected
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleComplete} data-testid="complete-button">
            <Play className="h-4 w-4 mr-2" />
            Start Analysis
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Active question state
  const question = state.currentQuestion;
  if (!question) {
    return null;
  }

  const canSubmit = question.required
    ? (question.type === 'boolean' || String(currentAnswer).length > 0)
    : true;

  return (
    <Card className={cn('w-full max-w-2xl', className)} data-testid="interview-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{agentName} Setup</CardTitle>
          <span className="text-sm text-muted-foreground">
            Step {state.currentStep} of {state.totalSteps}
          </span>
        </div>
        <Progress value={state.progress} className="h-2" data-testid="progress-bar" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-base font-medium">
            {question.question}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {question.description && (
            <p className="text-sm text-muted-foreground mt-1">{question.description}</p>
          )}
        </div>

        <QuestionInput
          question={question}
          value={currentAnswer}
          onChange={setCurrentAnswer}
          disabled={isLoading}
        />

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div>
          {!question.required && (
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={isLoading}
              data-testid="skip-button"
            >
              <SkipForward className="h-4 w-4 mr-2" />
              Skip
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {state.canStartAnalysis && (
            <Button
              variant="outline"
              onClick={handleStartAnalysis}
              disabled={isLoading}
              data-testid="early-start-button"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Now
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
            data-testid="next-button"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default GuidedInterviewPanel;
