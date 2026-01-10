// src/components/AITextRenderer.jsx
// Renders AI-generated markdown text with proper formatting

import React from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * AITextRenderer - Renders AI-generated markdown text with proper formatting
 * Use this component anywhere AI-generated text needs to be displayed
 */
export function AITextRenderer({ content, className = '' }) {
  if (!content) return null;
  
  return (
    <div className={`ai-text-renderer prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          // Custom styling for different elements
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-slate-900 mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-slate-800 mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-bold text-slate-800 mt-2 mb-1">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-slate-700 mb-3 leading-relaxed">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-slate-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-700">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-3 text-slate-700">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-3 text-slate-700">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-slate-700">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 italic text-slate-600 my-3">
              {children}
            </blockquote>
          ),
          code: ({ inline, children }) => (
            inline 
              ? <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-slate-800">{children}</code>
              : <pre className="bg-slate-100 p-3 rounded text-sm font-mono overflow-x-auto">{children}</pre>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * AITextRendererCompact - More compact version for inline/smaller displays
 */
export function AITextRendererCompact({ content, className = '' }) {
  if (!content) return null;
  
  return (
    <div className={`ai-text-renderer-compact ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-slate-900 mt-2 mb-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-slate-800 mt-2 mb-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-slate-800 mt-1 mb-1">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-sm text-slate-700 mb-2 leading-relaxed">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-0.5 mb-2 text-sm text-slate-700">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-0.5 mb-2 text-sm text-slate-700">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-slate-700">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-blue-400 pl-2 italic text-slate-600 my-2 text-sm">
              {children}
            </blockquote>
          ),
          code: ({ inline, children }) => (
            inline 
              ? <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
              : <pre className="bg-slate-100 p-2 rounded text-xs font-mono overflow-x-auto">{children}</pre>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-blue-600 hover:underline text-sm" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Lightweight alternative without react-markdown dependency
 * Use this if you don't want to add another package
 */
export function AITextRendererLite({ content, className = '' }) {
  if (!content) return null;
  
  // Format inline elements (bold, italic, code)
  const formatInline = (text) => {
    if (!text || typeof text !== 'string') return text;
    
    // Process the text in segments
    const parts = [];
    let remaining = text;
    let key = 0;
    
    while (remaining.length > 0) {
      // Bold: **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Inline code: `text`
      const codeMatch = remaining.match(/`(.+?)`/);
      
      // Find the earliest match
      const matches = [
        boldMatch && { type: 'bold', match: boldMatch, index: boldMatch.index },
        codeMatch && { type: 'code', match: codeMatch, index: codeMatch.index },
      ].filter(Boolean).sort((a, b) => a.index - b.index);
      
      if (matches.length === 0) {
        // No more matches, add remaining text
        parts.push(remaining);
        break;
      }
      
      const earliest = matches[0];
      
      // Add text before the match
      if (earliest.index > 0) {
        parts.push(remaining.slice(0, earliest.index));
      }
      
      // Add the formatted element
      const matchContent = earliest.match[1] || earliest.match[2];
      switch (earliest.type) {
        case 'bold':
          parts.push(<strong key={key++} className="font-bold text-slate-900">{matchContent}</strong>);
          break;
        case 'code':
          parts.push(<code key={key++} className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono">{matchContent}</code>);
          break;
        default:
          parts.push(matchContent);
      }
      
      // Continue with remaining text
      remaining = remaining.slice(earliest.index + earliest.match[0].length);
    }
    
    return parts;
  };
  
  // Convert markdown to HTML-safe JSX
  const formatText = (text) => {
    if (!text) return null;
    
    // Split into lines for processing
    const lines = text.split('\n');
    const elements = [];
    let currentList = [];
    let listType = null;
    
    const flushList = () => {
      if (currentList.length > 0) {
        const ListTag = listType === 'ordered' ? 'ol' : 'ul';
        const listClass = listType === 'ordered' ? 'list-decimal' : 'list-disc';
        elements.push(
          <ListTag key={elements.length} className={`${listClass} list-inside space-y-1 mb-3 text-slate-700`}>
            {currentList.map((item, i) => (
              <li key={i}>{formatInline(item)}</li>
            ))}
          </ListTag>
        );
        currentList = [];
        listType = null;
      }
    };
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        flushList();
        return;
      }
      
      // Headers
      if (trimmedLine.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={index} className="text-base font-bold text-slate-800 mt-2 mb-1">
            {formatInline(trimmedLine.slice(4))}
          </h3>
        );
        return;
      }
      if (trimmedLine.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={index} className="text-lg font-bold text-slate-800 mt-3 mb-2">
            {formatInline(trimmedLine.slice(3))}
          </h2>
        );
        return;
      }
      if (trimmedLine.startsWith('# ')) {
        flushList();
        elements.push(
          <h1 key={index} className="text-xl font-bold text-slate-900 mt-4 mb-2">
            {formatInline(trimmedLine.slice(2))}
          </h1>
        );
        return;
      }
      
      // Unordered list items
      if (trimmedLine.match(/^[\*\-]\s+/)) {
        if (listType !== 'unordered') {
          flushList();
          listType = 'unordered';
        }
        currentList.push(trimmedLine.replace(/^[\*\-]\s+/, ''));
        return;
      }
      
      // Ordered list items
      if (trimmedLine.match(/^\d+\.\s+/)) {
        if (listType !== 'ordered') {
          flushList();
          listType = 'ordered';
        }
        currentList.push(trimmedLine.replace(/^\d+\.\s+/, ''));
        return;
      }
      
      // Regular paragraph
      flushList();
      elements.push(
        <p key={index} className="text-slate-700 mb-3 leading-relaxed">
          {formatInline(trimmedLine)}
        </p>
      );
    });
    
    flushList();
    return elements;
  };
  
  return (
    <div className={`ai-text-renderer ${className}`}>
      {formatText(content)}
    </div>
  );
}

export default AITextRenderer;
