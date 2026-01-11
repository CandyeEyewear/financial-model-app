import React, { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { generateModelDataSummary } from "./utils/ModelDataSummary";
import { AITextRendererCompact } from "./components/AITextRenderer";
import { currencyFmtMM } from "./utils/formatters";
import {
  executeToolCall,
  parseToolCalls,
  hasToolCalls,
  cleanMessageContent
} from "./utils/aiToolExecutor";
import {
  Send, Bot, User, AlertCircle, RefreshCw, Trash2,
  Download, Copy, Check, Sparkles, TrendingUp, Wrench
} from "lucide-react";
import {
  loadChatHistory,
  saveMessage,
  clearChatHistory
} from "./services/chatHistoryService";

// Color palette
const COLORS = {
  primary: 'blue-600',
  secondary: 'slate-600',
  success: 'emerald-600',
  warning: 'amber-600',
  danger: 'red-600',
};

// Tool definitions for AI function calling
const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "calculate_optimal_debt",
      description: "Calculate the maximum debt amount that maintains a target DSCR (Debt Service Coverage Ratio). Use when user asks about debt capacity, optimal debt, or max borrowing.",
      parameters: {
        type: "object",
        properties: {
          targetDSCR: {
            type: "number",
            description: "Target DSCR ratio (e.g., 1.3 for 1.3x coverage)"
          }
        },
        required: ["targetDSCR"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_stress_test",
      description: "Run a stress test scenario with custom shocks to revenue, costs, or interest rates. Use when user asks 'what if' questions about adverse scenarios.",
      parameters: {
        type: "object",
        properties: {
          revenueShock: {
            type: "number",
            description: "Revenue decline as decimal (e.g., -0.15 for -15%)"
          },
          growthDelta: {
            type: "number",
            description: "Alternative name for revenue shock (e.g., -0.15 for -15%)"
          },
          costShock: {
            type: "number",
            description: "Cost increase as decimal (e.g., 0.10 for +10%)"
          },
          cogsDelta: {
            type: "number",
            description: "Alternative name for cost shock (e.g., 0.10 for +10%)"
          },
          rateShock: {
            type: "number",
            description: "Interest rate increase as decimal (e.g., 0.02 for +2%)"
          },
          rateDelta: {
            type: "number",
            description: "Alternative name for rate shock (e.g., 0.02 for +2%)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_model_parameter",
      description: "Update a financial model parameter. Use when user asks to change, set, or adjust model inputs.",
      parameters: {
        type: "object",
        properties: {
          param_name: {
            type: "string",
            description: "Parameter to update. Valid options: requestedLoanAmount, openingDebt, existingDebtAmount, interestRate, debtTenorYears, revenueGrowth, growth, ebitdaMargin, taxRate, wacc, terminalGrowth, baseRevenue, cogsPct, opexPct, capexPct"
          },
          new_value: {
            type: "number",
            description: "New value for the parameter (use decimals for percentages, e.g., 0.12 for 12%)"
          },
          reason: {
            type: "string",
            description: "Brief explanation of why this change is recommended"
          }
        },
        required: ["param_name", "new_value"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "navigate_to_tab",
      description: "Navigate to a specific analysis tab. Use when user wants to see a particular view or analysis.",
      parameters: {
        type: "object",
        properties: {
          tab: {
            type: "string",
            enum: ["historical", "capital", "dashboard", "scenarios", "custom", "tables"],
            description: "Tab to navigate to"
          }
        },
        required: ["tab"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_covenant_headroom",
      description: "Analyze how much buffer exists before covenant breaches occur. Use when user asks about covenant risk, headroom, or breach risk.",
      parameters: {
        type: "object",
        properties: {
          covenantType: {
            type: "string",
            enum: ["dscr", "icr", "leverage", "all"],
            description: "Covenant to analyze"
          }
        },
        required: ["covenantType"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "restructure_deal",
      description: "Comprehensive deal restructuring analysis with multiple options, comparison matrix, and credit committee recommendation. Use when user asks 'How would you restructure this deal?', 'What are our restructuring options?', 'How can we fix covenant breaches?', or similar questions about deal restructuring or covenant violations.",
      parameters: {
        type: "object",
        properties: {
          targetMinDSCR: {
            type: "number",
            description: "Target minimum DSCR across all years (default: 1.30)"
          },
          includeEquityOption: {
            type: "boolean",
            description: "Whether to include equity injection option (default: true)"
          },
          maxTenorYears: {
            type: "number",
            description: "Maximum tenor extension to consider in years (default: 10)"
          },
          minAcceptableRate: {
            type: "number",
            description: "Minimum acceptable interest rate as decimal (default: 0.08 for 8%)"
          }
        },
        required: []
      }
    }
  }
];

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

function ChatAssistant({ modelData, dealId, onParamUpdate, onRunStressTest, onNavigateToTab }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { session, getUsageInfo, canMakeAIQuery } = useAuth();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat history when dealId changes
  useEffect(() => {
    async function loadHistory() {
      if (!dealId) {
        setIsLoadingHistory(false);
        return;
      }

      setIsLoadingHistory(true);
      try {
        const history = await loadChatHistory(dealId);
        setMessages(history);
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadHistory();
  }, [dealId]);

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

  // Helper to add and save a message
  const addMessage = async (message) => {
    // Add to local state immediately for responsiveness
    setMessages(prev => [...prev, message]);

    // Save to database in background (only if dealId exists)
    if (dealId) {
      await saveMessage(dealId, message);
    }
  };

  // Handle clearing chat history
  const handleClearHistory = async () => {
    if (!dealId) return;

    const success = await clearChatHistory(dealId);
    if (success) {
      setMessages([]);
      setShowClearConfirm(false);
    } else {
      setError('Failed to clear chat history');
    }
  };

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
    await addMessage(userMessage);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Enhanced system message with tool awareness
      const systemMessage = `You are FinAssist, a friendly and experienced financial analyst who specializes in credit analysis and debt structuring. You're having a casual conversation with a colleague at a lending institution.

CAPABILITIES:
You can both ANALYZE data and TAKE ACTIONS using these tools:

1. **calculate_optimal_debt** - Calculate maximum debt for a target DSCR
   Use when: User asks about debt capacity, optimal debt, max borrowing

2. **run_stress_test** - Run stress scenarios with custom shocks
   Use when: User asks "what if" questions about adverse scenarios

3. **update_model_parameter** - Change model inputs
   Use when: User asks to set, change, or adjust values

4. **navigate_to_tab** - Switch to a specific analysis view
   Use when: User wants to see a particular analysis

5. **analyze_covenant_headroom** - Analyze covenant breach risk
   Use when: User asks about covenant risk or compliance

WHEN TO USE TOOLS:
- "What's the max debt we can take?" → use calculate_optimal_debt
- "Set the interest rate to 12%" → use update_model_parameter
- "What if revenue drops 20%?" → use run_stress_test
- "Show me the valuation" → use navigate_to_tab
- "How close are we to breaching covenants?" → use analyze_covenant_headroom

CRITICAL: TOOL VALUE FORMATTING
When using update_model_parameter:
- For monetary values (debt, revenue, cash): Send full numbers OR shorthand with M/B
  Examples: 100000000 OR "100M" OR "$100M" (all work!)
- For percentages (rates, growth, margins): Send as decimal (0.12 for 12%)
  Examples: 0.12 for 12%, 0.05 for 5%
- The system will parse "$100M", "100m", "100 million" correctly

CRITICAL: ALWAYS FOLLOW THROUGH AFTER TOOL CALLS
When you use a tool to modify the model (update_model_parameter, run_stress_test):
1. Execute the tool
2. IMMEDIATELY AFTER tool execution, provide analysis of the impact
3. Answer the user's original question with specific insights

NEVER just execute a tool and stop. Always follow through with analysis.

Example of CORRECT behavior:
User: "Set debt to $100M, how does this work out?"
You: [Execute update_model_parameter with new_value: 100000000]
You: "I've updated the debt to J$100M. Let me analyze the impact:

Looking at the updated model, this debt level creates some challenges. The Year 1 DSCR drops to 0.85x, which breaches the 1.25x covenant minimum. The company's EBITDA of around J$25M can only support about J$60M in debt at current terms.

I'd recommend either reducing the facility to J$60M or extending the tenor from 5 to 7 years to bring annual debt service down. Want me to run those scenarios?"

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
- If you see DATA WARNINGS, proactively mention them to the user
- Make recommendations that are practical and easy to understand

Remember: You're a trusted advisor who can both analyze AND take action. Keep it natural, helpful, and human.`;

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
          })),
          tools: AI_TOOLS  // Include tools for function calling
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `API error: ${response.status}`);
      }

      // Check if AI wants to call tools
      const toolCalls = data.choices?.[0]?.message?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        // Build context for tool execution
        const context = {
          modelData,
          onParamUpdate,
          onRunStressTest,
          onNavigateToTab,
          currency: modelData?.params?.currency || 'JMD'
        };

        // Execute each tool call
        const toolResults = await Promise.all(
          toolCalls.map(async (call) => {
            try {
              const params = typeof call.function.arguments === 'string'
                ? JSON.parse(call.function.arguments)
                : call.function.arguments;
              const result = await executeToolCall(call.function.name, params, context);
              return { tool: call.function.name, ...result };
            } catch (e) {
              console.error('Tool execution error:', e);
              return {
                tool: call.function.name,
                success: false,
                message: `Error: ${e.message}`,
                data: null
              };
            }
          })
        );

        // Get any text content from AI (before/after tool calls)
        const aiTextContent = data.choices?.[0]?.message?.content || "";

        // Build the final message
        let finalMessage = '';

        if (aiTextContent) {
          finalMessage += aiTextContent + '\n\n';
        }

        // Add tool results
        toolResults.forEach(result => {
          if (result.success) {
            finalMessage += result.message + '\n\n';
          } else {
            finalMessage += `⚠️ ${result.tool} failed: ${result.message}\n\n`;
          }
        });

        await addMessage({
          role: "assistant",
          content: finalMessage.trim(),
          timestamp: new Date().toISOString(),
          usage: data.userUsage,
          toolResults
        });
      } else {
        // Normal response without tool calls
        const aiMessage = data.choices?.[0]?.message?.content || "No response from AI service.";

        await addMessage({
          role: "assistant",
          content: aiMessage,
          timestamp: new Date().toISOString(),
          usage: data.userUsage
        });
      }
    } catch (error) {
      console.error("Chat API Error:", error);
      setError(error.message || "Failed to get response. Please try again.");

      // Add error message to chat
      await addMessage({
        role: "assistant",
        content: "Sorry, I hit a snag trying to process that. Mind trying again?",
        isError: true
      });
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
                  onClick={() => setShowClearConfirm(true)}
                  className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Clear chat history"
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
        {isLoadingHistory ? (
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="text-slate-600">Loading chat history...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-4">
            {!dealId && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-700">
                    Chat history is not being saved. Save this deal to preserve chat across sessions.
                  </div>
                </div>
              </div>
            )}
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
        ) : (
          <>
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
          </>
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

      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Clear Chat History?</h3>
                <p className="text-sm text-slate-600">
                  This will permanently delete all messages for this deal. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                className="px-4 py-2 text-sm bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors font-medium shadow-md"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatAssistant;
