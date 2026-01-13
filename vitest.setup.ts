import '@testing-library/jest-dom/vitest';

// Mock ResizeObserver for JSDOM environment
// Required by Radix UI components like ScrollArea
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
