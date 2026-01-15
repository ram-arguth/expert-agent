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

// Set test environment variables needed by some modules at load time
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_secret';
