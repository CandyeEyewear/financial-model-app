/**
 * Keyboard Shortcuts Hook
 * Centralized keyboard shortcut management for power users
 */
import { useEffect, useCallback, useRef } from 'react';

/**
 * useKeyboardShortcut - Listen for a specific keyboard shortcut
 * 
 * @param {Object} shortcut - Shortcut configuration
 * @param {string} shortcut.key - Key to listen for (e.g., 's', 'Escape', 'Enter')
 * @param {boolean} shortcut.ctrl - Require Ctrl/Cmd key
 * @param {boolean} shortcut.shift - Require Shift key
 * @param {boolean} shortcut.alt - Require Alt key
 * @param {Function} callback - Function to call when shortcut is triggered
 * @param {Object} options - Additional options
 * @param {boolean} options.enabled - Whether shortcut is enabled
 * @param {boolean} options.preventDefault - Whether to prevent default behavior
 * 
 * @example
 * useKeyboardShortcut({ key: 's', ctrl: true }, () => handleSave());
 */
export function useKeyboardShortcut(shortcut, callback, options = {}) {
  const { enabled = true, preventDefault = true } = options;
  const callbackRef = useRef(callback);
  
  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (event) => {
      // Check modifier keys
      const ctrlMatch = shortcut.ctrl 
        ? (event.ctrlKey || event.metaKey) // Cmd on Mac
        : !(event.ctrlKey || event.metaKey);
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      
      // Check key
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      
      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        if (preventDefault) {
          event.preventDefault();
        }
        callbackRef.current(event);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, enabled, preventDefault]);
}

/**
 * useKeyboardShortcuts - Listen for multiple keyboard shortcuts
 * 
 * @param {Array} shortcuts - Array of shortcut configurations
 * @param {Object} options - Additional options
 * 
 * @example
 * useKeyboardShortcuts([
 *   { shortcut: { key: 's', ctrl: true }, handler: handleSave, description: 'Save' },
 *   { shortcut: { key: 'Escape' }, handler: handleClose, description: 'Close' },
 * ]);
 */
export function useKeyboardShortcuts(shortcuts, options = {}) {
  const { enabled = true } = options;
  const handlersRef = useRef(new Map());
  
  // Update handlers when shortcuts change
  useEffect(() => {
    handlersRef.current.clear();
    shortcuts.forEach(({ shortcut, handler }) => {
      const key = getShortcutKey(shortcut);
      handlersRef.current.set(key, handler);
    });
  }, [shortcuts]);
  
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (event) => {
      // Skip if user is typing in an input
      if (isInputElement(event.target)) {
        // Only allow certain shortcuts while typing
        const isEscape = event.key === 'Escape';
        const hasModifier = event.ctrlKey || event.metaKey;
        
        if (!isEscape && !hasModifier) {
          return;
        }
      }
      
      shortcuts.forEach(({ shortcut, handler, preventDefault = true }) => {
        const ctrlMatch = shortcut.ctrl 
          ? (event.ctrlKey || event.metaKey)
          : !(event.ctrlKey || event.metaKey);
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        
        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          if (preventDefault) {
            event.preventDefault();
          }
          handler(event);
        }
      });
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

/**
 * Generate a unique key for a shortcut
 */
function getShortcutKey(shortcut) {
  const parts = [];
  if (shortcut.ctrl) parts.push('ctrl');
  if (shortcut.shift) parts.push('shift');
  if (shortcut.alt) parts.push('alt');
  parts.push(shortcut.key.toLowerCase());
  return parts.join('+');
}

/**
 * Check if element is an input element
 */
function isInputElement(element) {
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable
  );
}

/**
 * Format shortcut for display
 * 
 * @param {Object} shortcut - Shortcut configuration
 * @returns {string} - Formatted shortcut string
 * 
 * @example
 * formatShortcut({ key: 's', ctrl: true }) // Returns "⌘S" on Mac, "Ctrl+S" on Windows
 */
export function formatShortcut(shortcut) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts = [];
  
  if (shortcut.ctrl) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  
  // Format key
  const key = shortcut.key.toUpperCase();
  const specialKeys = {
    'ESCAPE': isMac ? 'Esc' : 'Esc',
    'ENTER': isMac ? '↵' : 'Enter',
    'BACKSPACE': isMac ? '⌫' : 'Backspace',
    'DELETE': isMac ? '⌦' : 'Del',
    'TAB': isMac ? '⇥' : 'Tab',
    'ARROWUP': '↑',
    'ARROWDOWN': '↓',
    'ARROWLEFT': '←',
    'ARROWRIGHT': '→',
  };
  
  parts.push(specialKeys[key] || key);
  
  return isMac ? parts.join('') : parts.join('+');
}

/**
 * Predefined common shortcuts
 */
export const CommonShortcuts = {
  SAVE: { key: 's', ctrl: true },
  UNDO: { key: 'z', ctrl: true },
  REDO: { key: 'z', ctrl: true, shift: true },
  COPY: { key: 'c', ctrl: true },
  PASTE: { key: 'v', ctrl: true },
  CUT: { key: 'x', ctrl: true },
  SELECT_ALL: { key: 'a', ctrl: true },
  FIND: { key: 'f', ctrl: true },
  NEW: { key: 'n', ctrl: true },
  OPEN: { key: 'o', ctrl: true },
  PRINT: { key: 'p', ctrl: true },
  CLOSE: { key: 'Escape' },
  HELP: { key: '?' },
};

/**
 * useEscapeKey - Convenience hook for escape key
 */
export function useEscapeKey(callback, enabled = true) {
  useKeyboardShortcut({ key: 'Escape' }, callback, { enabled, preventDefault: false });
}

/**
 * ShortcutHint component - Display keyboard shortcut
 */
export function ShortcutHint({ shortcut, className = '' }) {
  const formatted = formatShortcut(shortcut);
  
  return (
    <kbd className={`
      inline-flex items-center gap-0.5
      px-1.5 py-0.5
      text-xs font-mono
      bg-neutral-100 dark:bg-neutral-700
      text-neutral-500 dark:text-neutral-400
      border border-neutral-200 dark:border-neutral-600
      rounded
      ${className}
    `}>
      {formatted}
    </kbd>
  );
}

export default {
  useKeyboardShortcut,
  useKeyboardShortcuts,
  useEscapeKey,
  formatShortcut,
  CommonShortcuts,
  ShortcutHint,
};
