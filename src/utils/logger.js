/**
 * Logger Utility
 * Centralized logging with environment-aware output
 * 
 * In production: Only errors and warnings are logged
 * In development: All logs are shown
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Log levels
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

// Current log level based on environment
const currentLogLevel = isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;

/**
 * Format a log message with timestamp and context
 */
function formatMessage(level, context, message) {
  const timestamp = new Date().toISOString();
  const prefix = context ? `[${context}]` : '';
  return `${timestamp} ${level} ${prefix} ${message}`;
}

/**
 * Logger object with standard logging methods
 */
const logger = {
  /**
   * Debug level - detailed development information
   * Only shown in development
   */
  debug: (message, context = '', data = null) => {
    if (currentLogLevel <= LogLevel.DEBUG && !isTest) {
      const formattedMessage = formatMessage('DEBUG', context, message);
      if (data) {
        console.log(formattedMessage, data);
      } else {
        console.log(formattedMessage);
      }
    }
  },

  /**
   * Info level - general operational information
   * Only shown in development
   */
  info: (message, context = '', data = null) => {
    if (currentLogLevel <= LogLevel.INFO && !isTest) {
      const formattedMessage = formatMessage('INFO', context, message);
      if (data) {
        console.info(formattedMessage, data);
      } else {
        console.info(formattedMessage);
      }
    }
  },

  /**
   * Warn level - potential issues that don't break functionality
   * Shown in all environments
   */
  warn: (message, context = '', data = null) => {
    if (currentLogLevel <= LogLevel.WARN && !isTest) {
      const formattedMessage = formatMessage('WARN', context, message);
      if (data) {
        console.warn(formattedMessage, data);
      } else {
        console.warn(formattedMessage);
      }
    }
  },

  /**
   * Error level - errors that affect functionality
   * Shown in all environments
   */
  error: (message, context = '', error = null) => {
    if (currentLogLevel <= LogLevel.ERROR && !isTest) {
      const formattedMessage = formatMessage('ERROR', context, message);
      if (error) {
        console.error(formattedMessage, error);
      } else {
        console.error(formattedMessage);
      }
      
      // In production, you could send errors to a monitoring service here
      // Example: Sentry.captureException(error);
    }
  },

  /**
   * Group related logs together (dev only)
   */
  group: (label) => {
    if (isDevelopment && !isTest) {
      console.group(label);
    }
  },

  /**
   * End a log group
   */
  groupEnd: () => {
    if (isDevelopment && !isTest) {
      console.groupEnd();
    }
  },

  /**
   * Log a table of data (dev only)
   */
  table: (data, context = '') => {
    if (isDevelopment && !isTest) {
      if (context) {
        console.log(`[${context}]`);
      }
      console.table(data);
    }
  },

  /**
   * Time an operation (dev only)
   */
  time: (label) => {
    if (isDevelopment && !isTest) {
      console.time(label);
    }
  },

  /**
   * End timing an operation
   */
  timeEnd: (label) => {
    if (isDevelopment && !isTest) {
      console.timeEnd(label);
    }
  },

  /**
   * Assert a condition (dev only)
   */
  assert: (condition, message, context = '') => {
    if (isDevelopment && !isTest && !condition) {
      const formattedMessage = formatMessage('ASSERT', context, message);
      console.assert(condition, formattedMessage);
    }
  },
};

/**
 * Create a scoped logger with a fixed context
 * 
 * @example
 * const log = createLogger('AuthContext');
 * log.info('User signed in'); // [AuthContext] User signed in
 */
export function createLogger(context) {
  return {
    debug: (message, data = null) => logger.debug(message, context, data),
    info: (message, data = null) => logger.info(message, context, data),
    warn: (message, data = null) => logger.warn(message, context, data),
    error: (message, error = null) => logger.error(message, context, error),
    group: (label) => logger.group(`[${context}] ${label}`),
    groupEnd: () => logger.groupEnd(),
    table: (data) => logger.table(data, context),
    time: (label) => logger.time(`[${context}] ${label}`),
    timeEnd: (label) => logger.timeEnd(`[${context}] ${label}`),
  };
}

/**
 * Utility to safely stringify objects for logging
 */
export function safeStringify(obj, maxLength = 500) {
  try {
    const str = JSON.stringify(obj, null, 2);
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + '...';
    }
    return str;
  } catch {
    return '[Unable to stringify]';
  }
}

/**
 * Wrap a function with error logging
 */
export function withErrorLogging(fn, context = 'Unknown') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(`Error in ${fn.name || 'anonymous function'}`, context, error);
      throw error;
    }
  };
}

export default logger;
