import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Clipboard, 
  Settings, 
  Sparkles, 
  Type, 
  Trash2,
  LayoutGrid,
  ImageIcon,
  ShieldCheck,
  ShieldAlert,
  Pin,
  Smile,
  Type as SymbolIcon,
  X
} from "lucide-react";
import { cn } from "./lib/utils";

const { ipcRenderer } = (window as any).require('electron');

interface ClipboardItem {
  id: number;
  type: "text" | "image" | "code";
  content: string;
  timestamp: string;
  isPinned?: boolean;
}

const PRESETS = [
  { id: "fix", label: "Fix Grammar", prompt: "Fix grammar: " },
  { id: "explain", label: "Explain", prompt: "Explain: " },
  { id: "sinhala", label: "To Sinhala", prompt: "Translate to Sinhala: " },
];

type Tab = "clipboard" | "emoji" | "symbols";

export default function App() {
  const [items, setItems] = useState<ClipboardItem[]>(() => {
    const saved = localStorage.getItem("clipboard-pro-history");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<Tab>("clipboard");
  const [query, setQuery] = useState("");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("groq-api-key") || "");
  const [showSettings, setShowSettings] = useState(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [isAILoading, setIsAILoading] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem("clipboard-pro-history", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem("groq-api-key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    const handleNewItem = (_event: any, data: { type: string, content: string }) => {
      if (isPrivacyMode) return;
      
      setItems(prev => {
        const filtered = prev.filter(i => i.content !== data.content);
        const type: any = data.type === 'text' && (data.content.includes('{') || data.content.includes('function')) ? 'code' : data.type;
        
        return [{
          id: Date.now(),
          type,
          content: data.content,
          timestamp: new Date().toISOString(),
          isPinned: false
        }, ...filtered].slice(0, 50);
      });
    };

    ipcRenderer.on('clipboard-changed', handleNewItem);
    return () => ipcRenderer.removeAllListeners('clipboard-changed');
  }, [isPrivacyMode]);

  const copyItem = (item: ClipboardItem) => {
    ipcRenderer.send('copy-to-clipboard', { type: item.type, content: item.content });
    ipcRenderer.send('smart-paste');
  };

  const deleteItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  const togglePin = (id: number) => {
    setItems(items.map(i => i.id === id ? { ...i, isPinned: !i.isPinned } : i));
  };

  const runAI = async (item: ClipboardItem, preset: typeof PRESETS[0]) => {
    if (!apiKey) { setShowSettings(true); return; }
    setIsAILoading(item.id);
    
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "Direct answers only." },
            { role: "user", content: `${preset.prompt}\n\n${item.content}` }
          ]
        })
      });
      const data = await resp.json();
      const result = data.choices[0].message.content;
      
      ipcRenderer.send('copy-to-clipboard', { type: 'text', content: result });
      ipcRenderer.send('smart-paste');
    } catch (err) {
      console.error(err);
      alert("AI Error. Check key.");
    } finally {
      setIsAILoading(null);
    }
  };

  const filteredItems = items
    .filter(i => i.type !== 'image' ? i.content.toLowerCase().includes(query.toLowerCase()) : true)
    .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

  return (
    <div className="w-[400px] h-[650px] bg-[#1c1c1c]/95 text-zinc-200 flex flex-col font-sans border border-white/10 shadow-2xl overflow-hidden rounded-3xl backdrop-blur-3xl m-4">
      {/* Windows 11 Style Header Tabs */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-white/5">
        <div className="flex gap-1">
          <button 
            onClick={() => setActiveTab("clipboard")}
            className={cn("p-2 rounded-lg relative transition-all", activeTab === "clipboard" ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300")}
          >
            <Clipboard className="w-5 h-5" />
            {activeTab === "clipboard" && <motion.div layoutId="tab" className="absolute -bottom-2 left-0 right-0 h-0.5 bg-blue-400" />}
          </button>
          <button 
            onClick={() => setActiveTab("emoji")}
            className={cn("p-2 rounded-lg relative transition-all", activeTab === "emoji" ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300")}
          >
            <Smile className="w-5 h-5" />
            {activeTab === "emoji" && <motion.div layoutId="tab" className="absolute -bottom-2 left-0 right-0 h-0.5 bg-blue-400" />}
          </button>
          <button 
            onClick={() => setActiveTab("symbols")}
            className={cn("p-2 rounded-lg relative transition-all", activeTab === "symbols" ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300")}
          >
            <SymbolIcon className="w-5 h-5" />
            {activeTab === "symbols" && <motion.div layoutId="tab" className="absolute -bottom-2 left-0 right-0 h-0.5 bg-blue-400" />}
          </button>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setIsPrivacyMode(!isPrivacyMode)} className={cn("p-2 rounded-lg transition-colors", isPrivacyMode ? "text-red-500" : "text-zinc-500 hover:bg-white/5")}>
            {isPrivacyMode ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg transition-colors">
            {showSettings ? <X className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="p-6 bg-zinc-900 border-b border-white/10 overflow-hidden">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Groq Cloud Configuration</h3>
          <input 
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
            placeholder="Enter API Key (gsk_...)"
          />
          <button onClick={() => setShowSettings(false)} className="mt-4 w-full bg-blue-600 py-3 rounded-xl font-bold text-sm">Save & Close</button>
        </motion.div>
      )}

      {/* Main Stream */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
        {activeTab === "clipboard" ? (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input 
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search history..."
                className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:bg-white/10 outline-none transition-all"
              />
            </div>

            <AnimatePresence initial={false}>
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden group hover:bg-white/[0.06] transition-all relative"
                >
                  <div className="p-4" onClick={() => copyItem(item)}>
                    <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                          {item.type === 'image' ? <ImageIcon className="w-3.5 h-3.5 text-blue-400" /> : <Type className="w-3.5 h-3.5 text-zinc-500" />}
                          <span className="text-[10px] text-zinc-500">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       </div>
                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={(e) => { e.stopPropagation(); togglePin(item.id); }} className={cn("p-1.5 rounded-md hover:bg-white/10", item.isPinned && "text-blue-400")}>
                           <Pin className={cn("w-3.5 h-3.5", item.isPinned && "fill-current")} />
                         </button>
                         <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="p-1.5 rounded-md hover:bg-red-500/20 text-red-400">
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                       </div>
                    </div>
                    
                    {item.type === 'image' ? (
                      <img src={item.content} className="max-h-48 w-full object-contain rounded-lg bg-black/20 p-2" />
                    ) : (
                      <p className={cn(
                        "text-sm leading-snug line-clamp-5 break-words cursor-pointer",
                        item.type === 'code' ? "font-mono text-[11px] bg-black/40 p-3 rounded-lg text-zinc-300" : "text-zinc-400"
                      )}>
                        {item.content}
                      </p>
                    )}
                  </div>

                  {/* AI Quick Actions */}
                  {item.type !== 'image' && (
                    <div className="px-4 py-2 bg-black/20 flex gap-2 overflow-x-auto no-scrollbar border-t border-white/5">
                      {PRESETS.map(p => (
                        <button 
                          key={p.id}
                          disabled={isAILoading === item.id}
                          onClick={() => runAI(item, p)}
                          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-blue-600/20 hover:text-blue-400 rounded-lg text-[10px] font-bold text-zinc-500 transition-all active:scale-95"
                        >
                          {isAILoading === item.id ? <div className="w-2 h-2 border border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2 opacity-50">
             <LayoutGrid className="w-12 h-12" />
             <p className="text-sm font-medium">Under Construction</p>
          </div>
        )}
      </div>

      {/* Footer / Info */}
      <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-between text-[10px] font-medium text-zinc-500">
         <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
           <span>Ready to Paste</span>
         </div>
         <div className="flex items-center gap-2 opacity-50">
           <LayoutGrid className="w-3 h-3" />
           <span>{items.length} clips stored</span>
         </div>
      </div>
    </div>
  );
}
