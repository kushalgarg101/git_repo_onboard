import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, Sparkles, Loader2 } from "lucide-react";
import { useAppState } from "../state/useAppState";

export default function AgentPanel() {
  const { sessionId, aiModel, withAi } = useAppState();
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your AI CodeGraph Assistant. Ask me anything about the repository structure, architecture, or specific files in this map.",
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || !withAi) return;

    const userMessage = { id: Date.now().toString(), role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      // 🚀 Here we would normally call the backend RAG endpoint:
      // const res = await fetch(`http://localhost:8000/api/chat`, { method: "POST", body: ... })

      // For now, we simulate a response since the backend endpoint might not be fully wired for chat yet.
      // E.g., The blueprint asks to connect it to the graph-aware queries.
      setTimeout(() => {
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I am connected to the graph context! To enable true RAG LLM streaming, we must ensure the `main.py` fastAPI backend explicitly exposes a `/chat` or `/query` endpoint that reads the current `graph.json` or ChromaDB indices."
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsTyping(false);
      }, 1500);

    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "Error connecting to AI backend. Make sure your local server is running and AI features are enabled."
      }]);
      setIsTyping(false);
    }
  };

  if (!withAi) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center text-zinc-500">
        <Bot className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-lg font-medium text-zinc-300 mb-2">AI Assistant Disabled</h3>
        <p className="text-sm">Enable AI Summarization in the Control Panel to use the RAG Chat interface.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#09090b]">
      {/* Header */}
      <div className="p-4 border-b border-white/5 shrink-0 bg-zinc-950/80 backdrop-blur-md flex items-center gap-3">
        <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
          <Sparkles className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Project Assistant</h3>
          <p className="text-xs text-zinc-500 font-mono">{aiModel || "Local LLM"}</p>
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>

            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${msg.role === "user"
                ? "bg-zinc-800 border-zinc-700 text-zinc-300"
                : "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
              }`}>
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                ? "bg-zinc-800 text-zinc-200"
                : "bg-zinc-900/60 border border-white/5 text-zinc-300"
              }`}>
              {msg.content}
            </div>

          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 flex-row">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-indigo-500/20 border-indigo-500/30 text-indigo-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="p-4 border-t border-white/5 bg-zinc-950 shrink-0">
        <div className="relative flex items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about the codebase..."
            className="pr-12 bg-zinc-900/80 border-white/10 text-zinc-200 rounded-xl focus-visible:ring-indigo-500 focus-visible:ring-offset-0 focus-visible:border-indigo-500/50"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="absolute right-1 w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50 disabled:bg-indigo-600"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-2 text-center">
          <p className="text-[10px] text-zinc-600 font-medium tracking-wide">
            Powered by RAG Context • Press Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}
