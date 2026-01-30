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
  Trash2,
  X,
  Copy,
  LayoutGrid,
  ImageIcon,
  ShieldCheck,
  ShieldAlert
} from "lucide-react";
import { cn } from "./lib/utils";

const { ipcRenderer } = (window as any).require('electron');

interface ClipboardItem {
  id: number;
  type: "text" | "image" | "code";
  content: string;
  timestamp: string;
}

const PRESETS = [
  { id: "fix", label: "Fix Grammar", prompt: "Fix grammar: " },
  { id: "explain", label: "Explain", prompt: "Explain: " },
  { id: "sinhala", label: "To Sinhala", prompt: "Translate to Sinhala: " },
];

export default function App() {
  const [items, setItems] = useState<ClipboardItem[]>(() => {
    const saved = localStorage.getItem("clipboard-pro-history");
    return saved ? JSON.parse(saved) : [];
  });
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
          timestamp: new Date().toISOString()
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
    } catch (e) {
      alert("AI Error. Check key.");
    } finally {
      setIsAILoading(null);
    }
  };

  const filteredItems = items.filter(i => 
    i.type !== 'image' ? i.content.toLowerCase().includes(query.toLowerCase()) : true
  );

  return (
    <div className="w-[400px] h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans border-l border-white/10 shadow-2xl overflow-hidden rounded-l-3xl">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/40 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-2">
           <div className="p-1.5 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/30">
              <Clipboard className="w-4 h-4 text-white" />
           </div>
           <h1 className="font-black text-xs uppercase tracking-widest text-zinc-300">Clipboard Pro</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsPrivacyMode(!isPrivacyMode)} className={cn("p-2 rounded-lg transition-colors", isPrivacyMode ? "bg-red-500/20 text-red-500" : "text-zinc-500 hover:bg-white/5")}>
            {isPrivacyMode ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      {!showSettings && (
        <div className="p-4 bg-zinc-900/20 border-b border-white/5 sticky top-[65px] z-10 backdrop-blur-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input 
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search clipboard..."
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:border-blue-500/50 outline-none transition-all"
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {showSettings ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-4">
             <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Groq API Key</label>
                <input 
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                  placeholder="gsk_..."
                />
             </div>
             <button onClick={() => setShowSettings(false)} className="w-full bg-blue-600 py-3 rounded-xl font-bold text-sm hover:bg-blue-500 transition-colors">
                Save & Close
             </button>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-zinc-900/60 border border-white/5 rounded-2xl overflow-hidden group hover:border-blue-500/40 transition-all shadow-sm"
              >
                {/* Content Render */}
                <div onClick={() => copyItem(item)} className="p-4 cursor-pointer active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-2 mb-2">
                    {item.type === 'text' && <Type className="w-3.5 h-3.5 text-zinc-600" />}
                    {item.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-blue-400" />}
                    {item.type === 'code' && <Code className="w-3.5 h-3.5 text-green-400" />}
                    <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-tighter">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {item.type === 'image' ? (
                    <img src={item.content} className="w-full rounded-lg bg-zinc-800 border border-white/5 hover:opacity-90 transition-opacity" />
                  ) : (
                    <p className={cn(
                      "text-sm font-medium leading-relaxed break-words line-clamp-4",
                      item.type === 'code' ? "font-mono text-xs text-zinc-300 bg-black/40 p-3 rounded-xl border border-white/5" : "text-zinc-400"
                    )}>
                      {item.content}
                    </p>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="px-4 py-2 bg-black/20 border-t border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-1">
                    {item.type !== 'image' && PRESETS.map(p => (
                      <button 
                        key={p.id}
                        disabled={isAILoading === item.id}
                        onClick={() => runAI(item, p)}
                        className="p-1.5 hover:bg-blue-600/20 hover:text-blue-400 rounded-lg transition-colors text-[10px] font-bold text-zinc-500 flex items-center gap-1"
                      >
                         <Sparkles className="w-3 h-3" /> {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => deleteItem(item.id)} className="p-1.5 hover:bg-red-500/20 text-zinc-600 hover:text-red-500 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-white/5 bg-black/40 flex items-center justify-between">
         <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
            <LayoutGrid className="w-3 h-3" />
            <span>{items.length} Items Shared</span>
         </div>
         <div className="flex gap-1.5 opacity-40">
            <kbd className="px-1.5 py-0.5 border border-white/10 rounded bg-zinc-900 text-[10px]">Alt</kbd>
            <kbd className="px-1.5 py-0.5 border border-white/10 rounded bg-zinc-900 text-[10px]">Space</kbd>
         </div>
      </div>
    </div>
  );
}
