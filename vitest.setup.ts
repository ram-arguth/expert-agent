import '@testing-library/jest-dom/vitest';

// Mock ResizeObserver for JSDOM environment
// Required by Radix UI components like ScrollArea
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock pointer capture methods for JSDOM environment
// Required by Radix UI Select and other pointer-based components
Element.prototype.hasPointerCapture = function () {
  return false;
};
Element.prototype.setPointerCapture = function () {};
Element.prototype.releasePointerCapture = function () {};

// Mock scrollIntoView for JSDOM environment
// Required by auto-scroll behaviors
Element.prototype.scrollIntoView = function () {};

