/**
 * Hooks Library Index
 * Central export file for all custom hooks
 */

// Keyboard & Navigation
export {
  useKeyboardShortcut,
  useKeyboardShortcuts,
  useEscapeKey,
  formatShortcut,
  CommonShortcuts,
  ShortcutHint,
} from './useKeyboardShortcuts';

// Data Management
export { default as useDebounce } from './debounce';
export { default as useLocalStorage } from './localStorage';

// Financial Calculations
export { default as useFinancialCalculations } from './financialCalculations';
