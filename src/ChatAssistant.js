import React, { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { generateModelDataSummary } from "./utils/ModelDataSummary";
import { AITextRendererCompact } from "./components/AITextRenderer";
import { 
  Send, Bot, User, AlertCircle, RefreshCw, Trash2, 
  Download, Copy, Check, Sparkles, TrendingUp 
} from "lucide-react";

// Color palette
const COLORS = {
  primary: 'blue-600',
  secondary: 'slate-600',
  success: 'emerald-600',
  warning: 'amber-600',
  danger: 'red-600',
};

// Suggested prompts for quick actions
const SUGGESTED_PROMPTS = [
  {
    icon: TrendingUp,
    label: "Analyze Key Risks",
    prompt: "What are the top 3 financial risks in this model and how should I mitigate them?"
  },
  {
    icon: Sparkles,
    label: "Scenario Insights",
    prompt: "Compare the base case vs worst case scenario. What's the impact on returns and covenants?"
  },
  {
    icon: TrendingUp,
    label: "Covenant Analysis",
    prompt: "Are there any covenant breaches? What is the borrower's headroom on key metrics?"
  },
  {
    icon: Sparkles,
    label: "Quick Summary",
    prompt: "Give me a 3-sentence executive summary of this deal's financial viability."
  }
];

function ChatAssistant({ modelData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { session, getUsageInfo, canMakeAIQuery } = useAuth();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Generate comprehensive model summary
  const modelSummary = useMemo(() => {
    if (!modelData) {
      return "No financial model data available yet. Please configure the model in the main application.";
    }
    return generateModelDataSummary(modelData);
  }, [modelData]);

  // Check if model has data
  const hasModelData = useMemo(() => {
    return modelData && modelData.projections && modelData.params;
  }, [modelData]);

  // Handle sending messages
  const handleSend = async (customPrompt = null) => {
    const messageText = customPrompt || input.trim();
    if (!messageText) return;

    // Check authentication
    if (!session?.access_token) {
      setError("You must be logged in to use the AI assistant.");
      return;
    }

    // Check usage limits
    if (!canMakeAIQuery()) {
      const usageInfo = getUsageInfo();
      setError(`Monthly AI query limit reached (${usageInfo?.used}/${usageInfo?.limit}). Upgrade your plan to continue.`);
      return;
    }

    const userMessage = { role: "user", content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const systemMessage = `You are FinAssist, a friendly and experienced financial analyst who specializes in credit analysis and debt structuring. You're having a casual conversation with a colleague at a lending institution, so keep your tone warm, conversational, and natural. Always speak from the lender's perspective and do not describe the situation as if you are the borrower.

FINANCIAL MODEL DATA:
${modelSummary}

HOW TO COMMUNICATE:
- Talk like you're chatting with a colleague over coffee, not writing a formal report
- Use natural, flowing sentences instead of bullet points or lists
- NO hashtags, NO markdown symbols (**, ##, ###), NO excessive formatting
- Write in paragraphs, like you're explaining something to a friend
- Use "I think", "I'd recommend", "In my view" to sound more human
- Feel free to use conversational phrases like "Here's the thing", "What I'm seeing here", "To be honest"
- When citing numbers, weave them naturally into your explanation
- Be direct and honest, but warm in your delivery

WHAT TO FOCUS ON:
- Use the actual numbers and data from the model above
- Give specific, actionable insights based on what you see
- Point out both strengths and concerns in a balanced way
- If you spot risks, explain them clearly but don't be alarmist
- Make recommendations that are practical and easy to understand
- If data is missing, mention it naturally: "I don't see any revenue projections yet, so once you add those..."

Remember: You're a trusted advisor having a conversation, not a bot generating a report. Keep it natural, helpful, and human.`;

      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: messageText,
          systemMessage,
          messages: messages.slice(-6).map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `API error: ${response.status}`);
      }

      const aiMessage = data.choices?.[0]?.message?.content || "No response from AI service.";
      
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: aiMessage,
        timestamp: new Date().toISOString(),
        usage: data.userUsage
      }]);
    } catch (error) {
      console.error("Chat API Error:", error);
      setError(error.message || "Failed to get response. Please try again.");
      
      // Add error message to chat
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I hit a snag trying to process that. Mind trying again?",
        isError: true
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Handle retry for failed messages
  const handleRetry = () => {
    if (messages.length >= 2) {
      const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
      if (lastUserMessage) {
        // Remove last assistant message and retry
        setMessages(prev => prev.slice(0, -1));
        handleSend(lastUserMessage.content);
      }
    }
  };

  // Clear conversation
  const handleClear = () => {
    if (window.confirm("Clear all messages?")) {
      setMessages([]);
      setError(null);
    }
  };

  // Copy message to clipboard
  const handleCopy = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Export conversation
  const handleExport = () => {
    const conversation = messages.map(m => 
      `${m.role.toUpperCase()}: ${m.content}`
    ).join("\n\n");
    
    const blob = new Blob([conversation], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finsight-conversation-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get usage display
  const usageInfo = getUsageInfo();

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-slate-800">FinAssist</div>
              <div className="text-xs text-slate-600">
                {hasModelData ? "Ready to help" : "Awaiting model data"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Usage indicator */}
            {usageInfo && (
              <div className="text-xs text-slate-500 mr-2">
                {usageInfo.used}/{usageInfo.limit === 999999 ? '∞' : usageInfo.limit} queries
              </div>
            )}
            {messages.length > 0 && (
              <>
                <button
                  onClick={handleExport}
                  className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Export conversation"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClear}
                  className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Model data status */}
        {!hasModelData && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-700">
                Configure the financial model to enable AI-powered analysis
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="font-semibold text-slate-800 mb-2">
                Hey! I'm here to help analyze this deal
              </div>
              <div className="text-sm text-slate-600 mb-4">
                Ask me anything about your financial model - I'll give you straight answers in plain English.
              </div>
              {hasModelData && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold border border-emerald-200">
                  <Check className="w-3 h-3" />
                  Model data loaded and ready
                </div>
              )}
            </div>

            {/* Suggested prompts */}
            {hasModelData && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600 px-2">
                  Try asking me:
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(prompt.prompt)}
                      disabled={isLoading}
                      className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2">
                        <prompt.icon className="w-4 h-4 text-blue-600" />
                        <div className="text-xs font-medium text-slate-700 group-hover:text-blue-700">
                          {prompt.label}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {messages.map((m, i) => (
          <div 
            key={i} 
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[85%] ${m.role === "user" ? "" : "group"}`}>
              {m.role === "assistant" && (
                <div className="flex items-center gap-2 mb-1 ml-1">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-600">FinAssist</span>
                </div>
              )}
              
              <div className={`relative px-4 py-3 rounded-2xl ${
                m.role === "user" 
                  ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-none shadow-md" 
                  : m.isError
                    ? "bg-red-50 text-red-800 rounded-bl-none border border-red-200"
                    : "bg-white text-slate-800 rounded-bl-none border border-slate-200 shadow-sm"
              }`}>
                {m.role === "user" ? (
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {m.content}
                  </div>
                ) : (
                  <AITextRendererCompact 
                    content={m.content} 
                    className="text-sm leading-relaxed"
                  />
                )}
                
                {/* Copy button for assistant messages */}
                {m.role === "assistant" && !m.isError && (
                  <button
                    onClick={() => handleCopy(m.content, i)}
                    className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white border border-slate-200 rounded-full shadow-md hover:bg-slate-50"
                    title="Copy message"
                  >
                    {copiedIndex === i ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-600" />
                    )}
                  </button>
                )}
              </div>
              
              {m.role === "user" && (
                <div className="flex items-center gap-2 mt-1 mr-1 justify-end">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">You</span>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%]">
              <div className="flex items-center gap-2 mb-1 ml-1">
                <Bot className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-slate-600">FinAssist</span>
              </div>
              <div className="px-4 py-3 bg-white rounded-2xl rounded-bl-none border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                  <span className="text-xs text-slate-600">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-red-700">{error}</div>
            </div>
            {messages.some(m => m.isError) && (
              <button
                onClick={handleRetry}
                className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Input area */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={hasModelData ? "Ask me anything about the deal..." : "Configure model to start..."}
            disabled={isLoading || !hasModelData}
            className="flex-1 border border-slate-300 rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-slate-100 disabled:cursor-not-allowed transition-all"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading || !hasModelData}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:from-blue-600 hover:to-blue-700 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
            title="Send message"
          >
            {isLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* Helpful hint */}
        {hasModelData && messages.length === 0 && (
          <div className="mt-2 text-xs text-slate-500 text-center">
            Press Enter to send • I'll keep it conversational, no jargon
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatAssistant;
