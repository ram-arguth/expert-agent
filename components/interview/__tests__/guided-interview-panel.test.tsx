/**
 * Guided Interview Panel Tests
 *
 * Tests for the interview UI component:
 * - Rendering states (loading, error, question, complete)
 * - Question input types
 * - Navigation (next, skip)
 * - Progress tracking
 * - Start analysis button
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuidedInterviewPanel } from '../guided-interview-panel';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test data
const mockInitialState = {
  sessionId: 'interview-123',
  currentStep: 1,
  totalSteps: 5,
  progress: 0,
  isComplete: false,
  currentQuestion: {
    id: 'q1',
    question: 'What type of product are you analyzing?',
    description: 'Select the category that best matches your product.',
    type: 'select',
    options: [
      { value: 'web-app', label: 'Web Application' },
      { value: 'mobile-app', label: 'Mobile App' },
    ],
    required: true,
    placeholder: 'Select a product type',
  },
  answers: {},
  canStartAnalysis: false,
  nextAction: 'answer',
};

const mockSecondQuestionState = {
  ...mockInitialState,
  currentStep: 2,
  progress: 20,
  currentQuestion: {
    id: 'q2',
    question: 'Describe your target audience',
    type: 'textarea',
    required: true,
    placeholder: 'E.g., young professionals aged 25-35',
    validation: { minLength: 10 },
  },
  answers: { 'product-type': 'web-app' },
};

const mockOptionalQuestionState = {
  ...mockInitialState,
  currentStep: 4,
  progress: 60,
  currentQuestion: {
    id: 'q4',
    question: 'Any known issues?',
    type: 'text',
    required: false,
    placeholder: 'Optional',
  },
  answers: { 'product-type': 'web-app', 'target-audience': 'developers' },
  canStartAnalysis: true,
};

const mockCompleteState = {
  sessionId: 'interview-123',
  currentStep: 5,
  totalSteps: 5,
  progress: 100,
  isComplete: true,
  currentQuestion: null,
  answers: {
    'product-type': 'web-app',
    'target-audience': 'developers',
    'primary-task': 'build software',
  },
  canStartAnalysis: true,
  nextAction: 'complete',
};

describe('GuidedInterviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading indicator initially', async () => {
      // Never resolve the fetch
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      expect(screen.getByTestId('interview-panel')).toBeInTheDocument();
    });
  });

  describe('Question Display', () => {
    it('shows current question after loading', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInitialState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('What type of product are you analyzing?')).toBeInTheDocument();
      });
    });

    it('shows question description', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInitialState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText('Select the category that best matches your product.')
        ).toBeInTheDocument();
      });
    });

    it('shows required indicator for required questions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInitialState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('*')).toBeInTheDocument();
      });
    });
  });

  describe('Progress Tracking', () => {
    it('displays step counter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInitialState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      });
    });

    it('renders progress bar', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInitialState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
      });
    });
  });

  describe('Input Types', () => {
    it('renders textarea for textarea type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSecondQuestionState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('interview-textarea')).toBeInTheDocument();
      });
    });

    it('renders text input for text type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOptionalQuestionState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('interview-input')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('shows next button', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInitialState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('next-button')).toBeInTheDocument();
      });
    });

    it('shows skip button for optional questions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOptionalQuestionState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('skip-button')).toBeInTheDocument();
      });
    });

    it('hides skip button for required questions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInitialState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('skip-button')).not.toBeInTheDocument();
      });
    });

    it('calls API when next is clicked', async () => {
      const user = userEvent.setup();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOptionalQuestionState),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCompleteState),
        });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('interview-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('interview-input');
      await user.type(input, 'Some answer');

      const nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Early Start Analysis', () => {
    it('shows early start button when canStartAnalysis is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOptionalQuestionState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('early-start-button')).toBeInTheDocument();
      });
    });

    it('calls onStartAnalysis when early start is clicked', async () => {
      const user = userEvent.setup();
      const onStartAnalysis = vi.fn();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOptionalQuestionState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={onStartAnalysis}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('early-start-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('early-start-button'));

      expect(onStartAnalysis).toHaveBeenCalledWith(mockOptionalQuestionState.answers);
    });
  });

  describe('Complete State', () => {
    it('shows completion message when interview is complete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompleteState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Interview Complete')).toBeInTheDocument();
      });
    });

    it('shows start analysis button when complete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompleteState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('complete-button')).toBeInTheDocument();
      });
    });

    it('calls onComplete when complete button is clicked', async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompleteState),
      });

      render(
        <GuidedInterviewPanel
          agentId="ux-analyst"
          agentName="UX Analyst"
          onComplete={onComplete}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('complete-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('complete-button'));

      expect(onComplete).toHaveBeenCalledWith(mockCompleteState.answers);
    });
  });

  describe('Error Handling', () => {
    it('displays error message on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Agent does not support interview' }),
      });

      render(
        <GuidedInterviewPanel
          agentId="unknown-agent"
          agentName="Unknown Agent"
          onComplete={vi.fn()}
          onStartAnalysis={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/does not support interview/)).toBeInTheDocument();
      });
    });
  });
});
