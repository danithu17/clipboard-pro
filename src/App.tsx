import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Clipboard, 
  History as HistoryIcon, 
  Settings, 
  Sparkles, 
  Code, 
  Type, 
  Globe, 
  Zap,
  CheckCircle2,
  Trash2,
  X,
  Keyboard,
  ArrowRight,
  ShieldCheck,
  ShieldAlert
} from "lucide-react";
import { cn } from "./lib/utils";

// Electron IPC
const { ipcRenderer, clipboard: electronClipboard } = (window as any).require('electron');

interface Action {
  id: string;
  label: string;
  icon: any;
  prompt: string;
  category: "all" | "code" | "text" | "data";
}

const PRESETS: Action[] = [
  { id: "fix-grammar", label: "Fix Grammar & Style", icon: Type, prompt: "Reword this to be grammatically correct, professional, and clear: ", category: "text" },
  { id: "translate-sinhala", label: "Translate to Sinhala", icon: Globe, prompt: "Translate this text accurately to Sinhala: ", category: "text" },
  { id: "convert-camel", label: "CamelCase Converter", icon: Zap, prompt: "Convert the following text or variable names to camelCase: ", category: "text" },
  { id: "explain-code", label: "Explain Code Logic", icon: Code, prompt: "Explain how this code works in simple terms: ", category: "code" },
  { id: "refactor-code", label: "Optimize & Refactor", icon: Code, prompt: "Refactor this code for better performance, clean code principles, and readability: ", category: "code" },
  { id: "summarize", label: "Smart Summary", icon: Search, prompt: "Summarize the key points of this text in concise bullet points: ", category: "text" },
  { id: "bug-finder", label: "Find Potential Bugs", icon: ShieldAlert, prompt: "Review this code and identify any potential bugs, security risks, or edge cases: ", category: "code" },
];

const MODEL = "llama-3.3-70b-versatile";

export default function App() {
  const [clipboardText, setClipboardText] = useState("");
  const [query, setQuery] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("groq-api-key") || "");
  const [showSettings, setShowSettings] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>(() => {
    const saved = localStorage.getItem("clipboard-history");
    return saved ? JSON.parse(saved) : [];
  });
  const [view, setView] = useState<"actions" | "history">("actions");
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("groq-api-key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem("clipboard-history", JSON.stringify(historyItems));
  }, [historyItems]);

  useEffect(() => {
    const handleClipboard = (_event: any, text: string) => {
      if (!isPrivacyMode && text && text !== clipboardText) {
        setClipboardText(text);
        saveToHistory(text);
      }
    };

    ipcRenderer.on('clipboard-changed', handleClipboard);
    return () => {
      ipcRenderer.removeListener('clipboard-changed', handleClipboard);
    };
  }, [isPrivacyMode, clipboardText]);

  const saveToHistory = (content: string) => {
    setHistoryItems(prev => {
      const filtered = prev.filter(i => i.content !== content);
      return [{ id: Date.now(), content, timestamp: new Date().toISOString() }, ...filtered].slice(0, 30);
    });
  };

  const deleteHistoryItem = (id: number) => {
    setHistoryItems(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    if (confirm("Clear all clipboard history?")) {
      setHistoryItems([]);
    }
  };

  const detectActions = () => {
    const text = clipboardText.toLowerCase();
    const isCode = text.includes("{") || text.includes("function") || text.includes("const ") || 
                   text.includes("import ") || text.includes("</div>") || text.includes("public class") || 
                   text.includes("def ") || text.includes("=>");
    
    let filtered = PRESETS.filter(p => p.category === "all" || (isCode ? p.category === "code" : p.category === "text"));
    
    if (query) {
      filtered = filtered.filter(a => a.label.toLowerCase().includes(query.toLowerCase()));
    }
    
    setActions(filtered);
    setSelectedIndex(0);
  };

  useEffect(() => {
    detectActions();
  }, [query, clipboardText]);

  const runAI = async (action: Action | string) => {
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    setIsLoading(true);
    setResult("");
    
    const promptPrefix = typeof action === "string" ? action + ": " : action.prompt;
    
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: "You are an elite AI clipboard assistant. provide direct, high-quality, concise outputs. No conversational filler, no 'Here is your text'." },
            { role: "user", content: `${promptPrefix}\n\n${clipboardText}` }
          ],
          temperature: 0.1
        })
      });

      const data = await response.json();
      if (!data.choices) throw new Error(data.error?.message || "Invalid API Key or Rate Limit");
      
      const output = data.choices[0].message.content.trim();
      setResult(output);
      
      // Copy to clipboard
      electronClipboard.writeText(output);
      
      // Auto-Paste via IPC
      ipcRenderer.send('smart-paste');
      
    } catch (err: any) {
      setResult(`Error: ${err.message || 'Check your internet or API key'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const list = view === "actions" ? actions : historyItems;
      setSelectedIndex(prev => (prev + 1) % Math.max(list.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const list = view === "actions" ? actions : historyItems;
      setSelectedIndex(prev => (prev - 1 + list.length) % Math.max(list.length, 1));
    } else if (e.key === "Enter") {
      if (view === "actions") {
        if (actions.length > 0) runAI(actions[selectedIndex]);
        else if (query.length > 2) runAI(query); // Run custom prompt
      } else if (view === "history" && historyItems[selectedIndex]) {
        electronClipboard.writeText(historyItems[selectedIndex].content);
        setView("actions");
        setResult("Snippet restored to clipboard!");
      }
    } else if (e.key === "Escape") {
      if (showSettings) setShowSettings(false);
      else if (result) setResult("");
      else if (view === "history") setView("actions");
      else ipcRenderer.send('hide-window');
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-transparent select-none font-sans antialiased text-zinc-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="command-palette w-[620px] bg-zinc-950/90 border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header / Search */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            {isLoading ? (
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              >
                <Sparkles className="w-5 h-5 text-blue-400" />
              </motion.div>
            ) : (
              <Search className="w-5 h-5 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
            )}
          </div>
          <input 
            autoFocus
            className="w-full bg-white/5 border-none outline-none py-6 pl-14 pr-32 text-lg placeholder:text-zinc-600 focus:bg-white/[0.08] transition-all"
            placeholder={view === "actions" ? "Type to search or enter a custom prompt..." : "Search through history..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="absolute inset-y-0 right-6 flex items-center gap-2">
            <button 
              onClick={() => setIsPrivacyMode(!isPrivacyMode)}
              className={cn(
                "p-2 rounded-xl transition-all border border-transparent",
                isPrivacyMode ? "bg-red-500/10 text-red-500 border-red-500/20" : "text-zinc-500 hover:bg-white/5"
              )}
              title={isPrivacyMode ? "Privacy Mode On" : "Privacy Mode Off"}
            >
              {isPrivacyMode ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-2 rounded-xl transition-all border border-transparent",
                showSettings ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "text-zinc-500 hover:bg-white/5"
              )}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="max-h-[350px] overflow-y-auto no-scrollbar p-2 min-h-[120px]">
          {showSettings ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Global Settings</h3>
                <button onClick={() => setShowSettings(false)} className="text-zinc-600 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="bg-white/5 rounded-2xl p-5 border border-white/5 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">Groq Cloud API Key</label>
                  <input 
                    type="password"
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-blue-500/50 transition-all outline-none"
                    placeholder="gsk_..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-[10px] text-zinc-500">Your key is stored locally in this machine only.</p>
                </div>
                <div className="pt-2">
                   <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
                  >
                    Save Configuration
                  </button>
                </div>
              </div>
            </motion.div>
          ) : view === "history" ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-4 py-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Clipboard Archive</h3>
                <div className="flex gap-4">
                  <button onClick={clearHistory} className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors uppercase font-bold">Clear All</button>
                  <button onClick={() => setView("actions")} className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors uppercase font-bold">Back</button>
                </div>
              </div>
              {historyItems.length > 0 ? historyItems.map((item, idx) => (
                <div key={item.id} className="group relative">
                  <button
                    onClick={() => { electronClipboard.writeText(item.content); setView("actions"); }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl transition-all border border-transparent flex items-center justify-between",
                      selectedIndex === idx ? "bg-white/10 border-white/10 text-white shadow-xl" : "text-zinc-500 opacity-60 hover:opacity-100"
                    )}
                  >
                    <span className="truncate font-mono text-sm max-w-[450px]">{item.content}</span>
                    <span className="text-[9px] opacity-40 invisible group-hover:visible">{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )) : (
                <div className="p-12 text-center text-zinc-700 italic">No history preserved yet.</div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Clipboard Preview */}
              <div className="px-2">
                <div className="flex items-center justify-between px-2 mb-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Current Clipboard</h3>
                </div>
                <div className="group relative overflow-hidden bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4 transition-all hover:border-blue-500/40">
                  <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
                    <Clipboard className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-300 truncate italic">
                      {clipboardText || "Waiting for data..."}
                    </p>
                  </div>
                  <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-zinc-950 to-transparent flex items-center justify-end pr-4 opacity-0 group-hover:opacity-100 transition-all">
                    <Zap className="w-4 h-4 text-blue-400 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Action List */}
              <div className="px-2 pb-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 px-2 mb-2">Smart Actions</h3>
                <div className="grid gap-1.5">
                  {actions.length > 0 ? actions.map((action, idx) => (
                    <button
                      key={action.id}
                      onClick={() => runAI(action)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl transition-all group relative border border-transparent",
                        selectedIndex === idx 
                          ? "bg-blue-600 text-white shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] scale-[1.01] z-10" 
                          : "hover:bg-white/5 text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-xl transition-colors", 
                        selectedIndex === idx ? "bg-white/20" : "bg-black/40 group-hover:bg-zinc-800"
                      )}>
                        <action.icon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm tracking-tight">{action.label}</p>
                      </div>
                      <div className="ml-auto opacity-0 group-hover:opacity-100 transition-all flex items-center gap-2">
                        {selectedIndex === idx && (
                          <motion.div initial={{ x: -10 }} animate={{ x: 0 }} className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest italic opacity-70">Execute</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </motion.div>
                        )}
                      </div>
                    </button>
                  )) : query.length > 2 ? (
                    <button
                      onClick={() => runAI(query)}
                      className="w-full flex items-center gap-4 p-5 rounded-2xl bg-blue-600 text-white shadow-xl scale-[1.01]"
                    >
                      <div className="p-2 rounded-xl bg-white/20">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="text-left font-bold">
                        <p className="text-sm uppercase tracking-widest opacity-70 mb-0.5">Custom Command</p>
                        <p className="text-lg">"{query}"</p>
                      </div>
                      <ArrowRight className="ml-auto w-5 h-5" />
                    </button>
                  ) : (
                    <div className="p-12 text-center text-zinc-700 font-medium">No actions found. Try typing a custom prompt.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Result Container */}
        <AnimatePresence>
          {result && !showSettings && view === "actions" && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-blue-500/20 bg-blue-500/[0.03] p-6 relative"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="relative">
                     <Sparkles className="w-5 h-5 text-blue-400" />
                     <motion.div 
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 bg-blue-400 rounded-full blur-md"
                     />
                  </div>
                  <span className="text-[10px] font-black text-blue-400 tracking-[0.2em] uppercase">Intelligence Matrix</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setResult("")} className="text-zinc-600 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="text-sm text-blue-50/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto pr-4 font-medium italic custom-scrollbar">
                {result}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-blue-400/60 uppercase">
                 <CheckCircle2 className="w-3 h-3" />
                 <span>Auto-Applied & Ready to Paste</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Bar */}
        <div className="p-3 border-t border-white/5 flex items-center justify-between text-[9px] font-black text-zinc-600 bg-black/40 backdrop-blur-3xl uppercase tracking-widest">
          <div className="flex gap-6 px-4">
            <button onClick={() => setView(view === "actions" ? "history" : "actions")} className="flex items-center gap-2 hover:text-blue-400 transition-colors cursor-pointer group">
              <HistoryIcon className={cn("w-3 h-3 transition-transform", view === "history" && "rotate-[-45deg]")} /> 
              {view === "actions" ? "Archive" : "Toolbox"}
            </button>
            <div className="flex items-center gap-2 opacity-30">
               <Keyboard className="w-3 h-3" />
               <span>Shortcuts</span>
            </div>
          </div>
          <div className="flex gap-3 px-4 items-center">
            <div className="flex gap-1.5 opacity-60">
              <kbd className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-zinc-400">Alt</kbd>
              <kbd className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-zinc-400">Space</kbd>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
