import { useState, useEffect } from "react";
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
  CheckCircle2
} from "lucide-react";
import { cn } from "./lib/utils";

// Electron IPC (nodeIntegration is enabled)
const { ipcRenderer } = (window as any).require('electron');

interface Action {
  id: string;
  label: string;
  icon: any;
  prompt: string;
  category: "all" | "code" | "text" | "data";
}

const PRESETS: Action[] = [
  { id: "fix-grammar", label: "Fix Grammar", icon: Type, prompt: "Fix the grammar and spelling: ", category: "text" },
  { id: "translate-sinhala", label: "Translate to Sinhala", icon: Globe, prompt: "Translate this to Sinhala: ", category: "text" },
  { id: "convert-camel", label: "Convert to CamelCase", icon: Zap, prompt: "Convert this text to camelCase: ", category: "text" },
  { id: "explain-code", label: "Explain Code", icon: Code, prompt: "Explain what this code does simply: ", category: "code" },
  { id: "refactor-code", label: "Refactor Code", icon: Code, prompt: "Refactor this code for better readability and performance: ", category: "code" },
  { id: "summarize", label: "Summarize", icon: Search, prompt: "Summarize this text in 3 bullet points: ", category: "text" },
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

  useEffect(() => {
    // Sync API Key
    localStorage.setItem("groq-api-key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    // Sync History
    localStorage.setItem("clipboard-history", JSON.stringify(historyItems));
  }, [historyItems]);

  useEffect(() => {
    // Listen for clipboard changes from Electron main process
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
      return [{ id: Date.now(), content, timestamp: new Date().toISOString() }, ...filtered].slice(0, 50);
    });
  };

  const detectActions = (text: string) => {
    const isCode = text.includes("{") || text.includes("function") || text.includes("const ") || text.includes("import ") || text.includes("</div>");
    const filtered = PRESETS.filter(p => p.category === "all" || (isCode ? p.category === "code" : p.category === "text"));
    
    if (query) {
      const fuzzy = filtered.filter(a => a.label.toLowerCase().includes(query.toLowerCase()));
      setActions(fuzzy);
    } else {
      setActions(filtered);
    }
  };

  useEffect(() => {
    detectActions(clipboardText);
  }, [query, clipboardText]);

  const runAI = async (action: Action) => {
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    setIsLoading(true);
    setResult("");
    
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
            { role: "system", content: "You are a smart clipboard assistant. provide direct, concise outputs without conversational filler." },
            { role: "user", content: `${action.prompt}\n\n${clipboardText}` }
          ],
          temperature: 0.2
        })
      });

      const data = await response.json();
      if (!data.choices) throw new Error("Invalid API Key or Rate Limit");
      
      const output = data.choices[0].message.content;
      setResult(output);
      
      // Copy back to clipboard
      const { clipboard } = (window as any).require('electron');
      clipboard.writeText(output);
      
      // Auto-Paste
      ipcRenderer.send('smart-paste');
      
      // Hide window after a short delay
      setTimeout(() => ipcRenderer.send('hide-window'), 1500);
      
    } catch (err: any) {
      setResult(`Error: ${err.message || 'Check your internet or API key'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      const list = view === "actions" ? actions : historyItems;
      setSelectedIndex(prev => (prev + 1) % Math.max(list.length, 1));
    } else if (e.key === "ArrowUp") {
      const list = view === "actions" ? actions : historyItems;
      setSelectedIndex(prev => (prev - 1 + list.length) % Math.max(list.length, 1));
    } else if (e.key === "Enter") {
      if (view === "actions" && actions[selectedIndex]) runAI(actions[selectedIndex]);
      else if (view === "history" && historyItems[selectedIndex]) {
        const { clipboard } = (window as any).require('electron');
        clipboard.writeText(historyItems[selectedIndex].content);
        setView("actions");
      }
    } else if (e.key === "Escape") {
      if (showSettings) setShowSettings(false);
      else ipcRenderer.send('hide-window');
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-transparent select-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="command-palette w-[600px] border border-white/10"
        onKeyDown={handleKeyDown}
      >
        <div className="p-5 border-b border-white/5 flex items-center gap-4 bg-zinc-900/40">
          <Search className="w-6 h-6 text-zinc-500" />
          <input 
            autoFocus
            className="bg-transparent border-none outline-none flex-1 text-xl placeholder:text-zinc-600 text-zinc-100"
            placeholder={view === "actions" ? "Describe action or search presets..." : "Search history..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPrivacyMode(!isPrivacyMode)}
              className={cn("p-2 rounded-xl transition-all", isPrivacyMode ? "bg-red-500/20 text-red-400" : "text-zinc-500 hover:bg-white/5")}
              title="Privacy Mode"
            >
              <Zap className={cn("w-5 h-5", isPrivacyMode && "fill-current")} />
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={cn("p-2 rounded-xl transition-all", showSettings ? "bg-primary/20 text-primary" : "text-zinc-500 hover:bg-white/5")}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-3 max-h-[320px] overflow-y-auto no-scrollbar min-h-[200px]">
          {showSettings ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-zinc-200">System Preferences</h2>
              </div>
              <div className="space-y-3">
                <label className="text-xs text-zinc-500 uppercase font-black tracking-widest">Groq Cloud API Key</label>
                <input 
                  type="password"
                  className="bg-black/40 border border-white/10 rounded-xl p-3 w-full text-sm outline-none focus:border-primary/50 transition-all font-mono"
                  placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-[11px] text-zinc-500">Responses are ultra-fast (~500ms). Get your key at console.groq.com</p>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="w-full bg-primary hover:bg-primary/90 py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all"
              >
                Apply Changes
              </button>
            </motion.div>
          ) : view === "history" ? (
            <div className="space-y-1">
              <div className="px-3 py-2 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] flex justify-between items-center">
                <span>Recent History</span>
                <span className="text-primary cursor-pointer hover:underline" onClick={() => setView("actions")}>Back to Toolbox</span>
              </div>
              {historyItems.length > 0 ? historyItems.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => { 
                    const { clipboard } = (window as any).require('electron');
                    clipboard.writeText(item.content); 
                    setView("actions"); 
                  }}
                  className={cn(
                    "w-full text-left p-4 rounded-xl transition-all border border-transparent",
                    selectedIndex === idx ? "bg-white/5 border-white/5 text-zinc-100" : "text-zinc-500 hover:bg-white/5 opacity-60 hover:opacity-100"
                  )}
                >
                  <p className="text-sm truncate font-mono">{item.content}</p>
                </button>
              )) : (
                <div className="p-12 text-center text-zinc-700 font-medium italic">Your history is as clean as a whistle...</div>
              )}
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] flex justify-between items-center">
                <span>Clipboard Buffer</span>
                {isPrivacyMode && <span className="text-red-500/80 animate-pulse">Stealth Mode Active</span>}
              </div>
              <div className="flex items-center gap-4 p-4 mx-2 my-2 rounded-2xl bg-zinc-900/60 border border-white/5 text-sm shadow-inner group relative">
                <Clipboard className="w-5 h-5 text-primary shrink-0" />
                <span className="text-zinc-400 italic truncate pr-8">{clipboardText || "No active data..."}</span>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary/20 group-hover:bg-primary transition-all duration-500" />
              </div>

              <div className="px-3 py-2 mt-4 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                Smart Neural Actions
              </div>
              <div className="grid gap-1 mt-1 px-1">
                {actions.length > 0 ? actions.map((action, idx) => (
                  <button
                    key={action.id}
                    onClick={() => runAI(action)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl transition-all group border border-transparent",
                      selectedIndex === idx ? "bg-primary text-white shadow-2xl shadow-primary/40 scale-[1.01] border-white/10" : "hover:bg-white/5 text-zinc-400"
                    )}
                  >
                    <div className={cn("p-2 rounded-lg", selectedIndex === idx ? "bg-white/20" : "bg-black/40 group-hover:bg-zinc-800")}>
                      <action.icon className={cn("w-4 h-4", selectedIndex === idx ? "text-white" : "text-zinc-500 group-hover:text-primary transition-colors")} />
                    </div>
                    <span className="font-bold text-sm tracking-tight">{action.label}</span>
                    {selectedIndex === idx && (
                      <motion.div layoutId="kbd" className="ml-auto flex items-center gap-2">
                        {isLoading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : (
                           <div className="flex items-center gap-1 text-[10px] bg-white/20 px-2 py-1 rounded-md font-black italic">
                             <CheckCircle2 className="w-3 h-3" /> AUTO-PASTE
                           </div>
                        )}
                      </motion.div>
                    )}
                  </button>
                )) : (
                  <div className="p-12 text-center text-zinc-700 font-medium">No actions found for this type of content.</div>
                )}
              </div>
            </>
          )}
        </div>

        <AnimatePresence>
          {result && !showSettings && view === "actions" && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-primary/20 bg-primary/5 p-5 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-[10px] font-black text-primary tracking-[0.2em] uppercase">Intelligence Applied</span>
                </div>
                <div className="text-[9px] text-zinc-600 font-mono flex gap-3">
                  <span>AES-256</span>
                  <span>ENCRYPTED_STREAM</span>
                </div>
              </div>
              <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto pr-4 font-medium italic">
                {result}
              </div>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mb-16 pointer-events-none" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-3 border-t border-white/5 flex items-center justify-between text-[9px] font-black text-zinc-600 bg-black/40 backdrop-blur-3xl uppercase tracking-widest">
          <div className="flex gap-6 px-4">
            <button onClick={() => setView(view === "actions" ? "history" : "actions")} className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer group">
              <HistoryIcon className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" /> {view === "actions" ? "Access History" : "Switch to Toolbox"}
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
              <Settings className="w-3 h-3" /> Configuration
            </button>
          </div>
          <div className="flex gap-2 px-4 items-center">
            <div className="flex gap-1.5 font-mono">
              <kbd className="px-2 py-0.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-500 shadow-sm">Alt</kbd>
              <kbd className="px-2 py-0.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-500 shadow-sm">Space</kbd>
            </div>
            <span className="opacity-30">To Toggle</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
