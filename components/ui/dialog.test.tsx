import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';

describe('Dialog', () => {
  const TestDialog = ({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) => (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test Title</DialogTitle>
          <DialogDescription>Test description text</DialogDescription>
        </DialogHeader>
        <div>Dialog body content</div>
        <DialogFooter>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  it('opens when trigger is clicked', async () => {
    render(<TestDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Dialog' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders title and description', async () => {
    render(<TestDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Dialog' }));
    expect(await screen.findByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test description text')).toBeInTheDocument();
  });

  it('closes when close button is clicked', async () => {
    const onOpenChange = vi.fn();
    render(<TestDialog onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Dialog' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders footer with buttons', async () => {
    render(<TestDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Dialog' }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
