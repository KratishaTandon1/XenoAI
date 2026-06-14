"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, CheckCircle2, Sparkles, Loader2, BarChart3, Database, Users, ChevronDown, X } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'agent';
  content: string;
  proposal?: CampaignProposal;
};

type CampaignProposal = {
  sqlQuery: string;
  messageVariants?: string[];
  messageBody?: string;
  channel: string;
  audienceSize: number;
  campaignId?: string;
  status?: 'pending' | 'executing' | 'completed';
  sampleCustomers?: { name: string, email: string }[];
};

export default function ChatCRM() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'agent',
      content: "Hi there! I'm your AI Marketing Agent. Describe the campaign you want to run, and I'll find the right audience and draft the message for you. (e.g. 'Send a 20% discount on WhatsApp to customers who spent over $50 last month')",
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDb, setShowDb] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: userMessage.content })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        const agentMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: `I've prepared a campaign proposal based on your request. I found **${data.audienceSize} customers** that match your criteria.`,
          proposal: {
            sqlQuery: data.sqlQuery,
            messageVariants: data.messageVariants,
            channel: data.channel,
            audienceSize: data.audienceSize,
            sampleCustomers: data.sampleCustomers,
            status: 'pending'
          }
        };
        setMessages(prev => [...prev, agentMessage]);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: `Sorry, I encountered an error: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (messageId: string, proposal: CampaignProposal, selectedVariant: string) => {
    // Optimistically update status
    setMessages(prev => prev.map(m => 
      m.id === messageId && m.proposal ? { ...m, proposal: { ...m.proposal, status: 'executing', messageBody: selectedVariant } } : m
    ));

    try {
      const res = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: messages.find(m => m.id === (parseInt(messageId)-1).toString())?.content,
          sqlQuery: proposal.sqlQuery,
          messageBody: selectedVariant,
          channel: proposal.channel
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessages(prev => prev.map(m => 
          m.id === messageId && m.proposal ? { ...m, proposal: { ...m.proposal, status: 'completed', campaignId: data.campaignId } } : m
        ));
        
        // Add a follow up message
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'agent',
            content: `Awesome! The campaign is now live and messages are being dispatched over ${proposal.channel}. You can view the live performance tracking in the proposal card above.`
          }]);
        }, 1000);
      } else {
        throw new Error(data.error || 'Failed to dispatch campaign');
      }
    } catch (error: any) {
      console.error(error);
      // Revert status on error
      setMessages(prev => prev.map(m => 
        m.id === messageId && m.proposal ? { ...m, proposal: { ...m.proposal, status: 'pending', messageBody: undefined } } : m
      ));
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'agent',
        content: `Error dispatching campaign: ${error.message}`
      }]);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-gray-100 font-sans selection:bg-green-500/30 flex flex-col relative overflow-hidden">
      {/* Animated Glowing Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-lime-500/10 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-emerald-600/10 blur-[150px] mix-blend-screen" />
      </div>
      
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lime-500 via-green-500 to-teal-500 flex items-center justify-center shadow-lg shadow-green-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Xeno AI</h1>
            <p className="text-xs text-green-400 font-medium tracking-wide uppercase">Marketing Agent</p>
          </div>
        </div>
        <button 
          onClick={() => setShowDb(true)}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm text-gray-300 font-medium transition-colors"
        >
          <Database className="w-4 h-4" />
          View Database
        </button>
      </header>

      {/* Database Viewer Modal */}
      <AnimatePresence>
        {showDb && <DatabaseModal onClose={() => setShowDb(true)} close={() => setShowDb(false)} />}
      </AnimatePresence>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' 
                  ? 'bg-gray-800 border border-gray-700' 
                  : 'bg-gradient-to-br from-lime-500/20 to-green-500/20 border border-green-500/30 text-green-400'
              }`}>
                {msg.role === 'user' ? <User className="w-5 h-5 text-gray-300" /> : <Bot className="w-5 h-5" />}
              </div>

              {/* Message Content */}
              <div className={`flex flex-col gap-3 w-full max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-5 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-lime-600 to-green-600 text-white rounded-tr-sm'
                    : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm backdrop-blur-md inline-block'
                }`}>
                  {msg.content}
                </div>

                {/* Campaign Proposal Card */}
                {msg.proposal && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-2xl shadow-2xl mt-2 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lime-500 via-green-500 to-teal-500 opacity-80" />
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-5 h-5 text-lime-400" />
                      <h3 className="font-semibold text-gray-100">Campaign Proposal</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="bg-zinc-950/50 rounded-xl border border-gray-800/50 overflow-hidden">
                        <div className="p-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Target Audience</p>
                            <p className="text-2xl font-bold text-white">{msg.proposal.audienceSize} <span className="text-sm font-normal text-gray-400">customers</span></p>
                          </div>
                          <Users className="w-8 h-8 text-lime-500/20" />
                        </div>
                        {msg.proposal.sampleCustomers && msg.proposal.sampleCustomers.length > 0 && (
                          <div className="bg-gray-900/50 px-4 py-3 border-t border-gray-800/50">
                            <p className="text-xs text-gray-400 mb-2 font-medium">Included in segment:</p>
                            <div className="flex flex-wrap gap-2">
                              {msg.proposal.sampleCustomers.map((c, i) => (
                                <span key={i} className="text-[11px] bg-lime-500/10 text-lime-300 px-2 py-1 rounded-md border border-lime-500/20">
                                  {c.name}
                                </span>
                              ))}
                              {msg.proposal.audienceSize > msg.proposal.sampleCustomers.length && (
                                <span className="text-[11px] text-gray-500 px-2 py-1">+{msg.proposal.audienceSize - msg.proposal.sampleCustomers.length} more...</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {msg.proposal.audienceSize === 0 ? (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm text-center">
                          There are no customers matching this criteria. Try a different request.
                        </div>
                      ) : (
                        <>
                          {msg.proposal.messageVariants && !msg.proposal.messageBody && (
                            <div className="space-y-3">
                              <p className="text-xs text-gray-500 uppercase tracking-wider">Select a Message Variant ({msg.proposal.channel})</p>
                              <div className="grid grid-cols-1 gap-3">
                                {msg.proposal.messageVariants.map((variant, idx) => (
                                  <div key={idx} className="bg-zinc-950/50 p-4 rounded-xl border border-gray-800/50 hover:border-lime-500/50 cursor-pointer transition-colors group" onClick={() => handleApprove(msg.id, msg.proposal!, variant)}>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded">
                                        Variant {idx === 0 ? 'A (Professional)' : 'B (Casual)'}
                                      </span>
                                      <span className="text-[10px] text-gray-500 group-hover:text-lime-400 transition-colors">Click to select & execute &rarr;</span>
                                    </div>
                                    <p className="text-sm text-gray-300 italic">"{variant}"</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {msg.proposal.messageBody && (
                            <div className="bg-zinc-950/50 rounded-xl p-4 border border-gray-800/50">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Selected Message ({msg.proposal.channel})</p>
                              <p className="text-sm text-gray-300 italic">"{msg.proposal.messageBody}"</p>
                            </div>
                          )}
                        </>
                      )}
                      
                      {msg.proposal.status === 'executing' && (
                        <div className="w-full py-3 px-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl font-medium flex items-center justify-center gap-2 mt-4">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Dispatching Messages...
                        </div>
                      )}

                      {msg.proposal.status === 'completed' && msg.proposal.campaignId && (
                        <div className="mt-4 border-t border-gray-800 pt-4">
                          <div className="flex items-center gap-2 mb-3 text-green-400">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-medium">Campaign Live - Real-time Stats</span>
                          </div>
                          <LiveStats 
                            campaignId={msg.proposal.campaignId} 
                            audienceSize={msg.proposal.audienceSize} 
                            messageBody={msg.proposal.messageBody!} 
                            channel={msg.proposal.channel} 
                            onExecuteFollowUp={(prompt) => {
                              setInput(prompt);
                              setTimeout(() => {
                                const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
                                if (inputEl) inputEl.focus();
                              }, 100);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
          
          {isLoading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
               <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime-500/20 to-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
                <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
              </div>
              <div className="px-5 py-4 rounded-2xl bg-white/5 border border-white/10 rounded-tl-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce [animation-delay:0.4s]" />
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </AnimatePresence>
      </main>

      {/* Input Area */}
      <div className="p-4 md:p-8 bg-zinc-950/40 backdrop-blur-2xl border-t border-white/5 relative z-10">
        <div className="max-w-4xl mx-auto relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-lime-500 to-teal-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <div className="relative flex items-center bg-zinc-900/90 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask the AI to segment users and draft a campaign..."
              className="w-full bg-transparent py-4 pl-5 pr-16 text-gray-100 placeholder-gray-500 outline-none transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-2 bottom-2 aspect-square bg-gradient-to-r from-lime-500 to-green-500 hover:from-lime-400 hover:to-green-400 disabled:opacity-50 disabled:hover:from-lime-500 disabled:hover:to-green-500 text-white rounded-xl flex items-center justify-center transition-all shadow-lg"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Flowchart sub-components
const FlowNode = ({ label, count, color }: { label: string, count: number, color: string }) => (
  <div className="flex flex-col items-center group shrink-0">
    <motion.div 
      key={count} 
      animate={{ scale: [1, 1.15, 1], boxShadow: ['0 0 0px transparent', `0 0 20px ${color}`, '0 0 0px transparent'] }} 
      transition={{ duration: 0.4 }}
      className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-lg relative z-10 backdrop-blur-sm transition-colors"
      style={{ borderBottomColor: color, borderBottomWidth: '3px' }}
    >
      <span className="text-lg sm:text-xl font-bold text-white drop-shadow-md">{count}</span>
    </motion.div>
    <span className="mt-3 text-[9px] sm:text-[10px] font-bold text-gray-400 tracking-widest uppercase group-hover:text-white transition-colors">{label}</span>
  </div>
);

const FlowArrow = ({ label, subtext }: { label?: string, subtext?: string }) => (
  <div className="flex-1 flex flex-col items-center justify-start mt-7 sm:mt-8 relative min-w-[20px] sm:min-w-[40px] px-1">
    <div className="flex flex-col items-center absolute -top-6 sm:-top-7 whitespace-nowrap">
      {label && <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-lime-400/80 font-bold">{label}</span>}
      {subtext && <span className="text-[7px] sm:text-[8px] text-gray-600 font-medium hidden sm:block">{subtext}</span>}
    </div>
    <div className="w-full h-[2px] bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 relative rounded-full">
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t-[2px] border-r-[2px] border-gray-600 rotate-45"></div>
    </div>
  </div>
);

// Sub-component for Live Stats
function LiveStats({ campaignId, audienceSize, messageBody, channel, onExecuteFollowUp }: { campaignId: string, audienceSize: number, messageBody: string, channel: string, onExecuteFollowUp?: (prompt: string) => void }) {
  const [stats, setStats] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 1000);
    return () => clearInterval(interval);

    function fetchStats() {
      fetch(`/api/campaigns/${campaignId}/stats`)
        .then(res => res.json())
        .then(data => {
          setStats(data.stats);
          if (data.recentLogs) setRecentLogs(data.recentLogs);
        })
        .catch(console.error);
    }
  }, [campaignId]);

  if (!stats) return <div className="text-sm text-gray-500 animate-pulse">Loading stats...</div>;

  return (
    <div className="space-y-4">
      {/* Premium Simulation Flowchart */}
      <div className="bg-zinc-950/60 border border-gray-800/60 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Background ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-lime-500/5 to-transparent pointer-events-none rounded-2xl"></div>
        
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-8 font-semibold flex items-center gap-2 relative z-10">
          <Bot className="w-4 h-4 text-lime-400" /> 
          Simulation Architecture
        </p>
        
        <div className="flex justify-between items-start w-full relative z-10">
          <FlowNode label="Target" count={audienceSize} color="#bef264" />
          
          <FlowArrow label="Transit" subtext="1-3 sec" />
          
          <div className="flex flex-col items-center gap-4 sm:gap-6 shrink-0 relative">
            <FlowNode label="Delivered" count={stats.DELIVERED || 0} color="#2dd4bf" />
            <div className="flex flex-col items-center -mt-2 sm:-mt-4 relative">
              <div className="w-[2px] h-6 sm:h-8 bg-gradient-to-b from-gray-800 to-gray-700 relative">
                 <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 border-b-[2px] border-r-[2px] border-gray-600 rotate-45"></div>
              </div>
              <span className="text-[7px] sm:text-[8px] text-red-500/70 font-bold uppercase mt-1 mb-1 whitespace-nowrap absolute top-1/2 left-3 -translate-y-1/2">5% Bounce</span>
              <FlowNode label="Failed" count={stats.FAILED || 0} color="#ef4444" />
              
              {/* Smart Fallback Indicator */}
              <div className="absolute top-[80px] left-[70px] flex flex-col items-start opacity-80 whitespace-nowrap">
                 <div className="absolute -left-6 top-[8px] w-6 h-[2px] border-t-[2px] border-dashed border-green-500/50"></div>
                 <div className="absolute -left-2 top-[5px] w-0 h-0 border-t-[4px] border-t-transparent border-l-[5px] border-l-green-500/50 border-b-[4px] border-b-transparent"></div>
                 <span className="text-[8px] text-green-400 font-bold uppercase mb-0.5 tracking-wider bg-green-500/10 px-1.5 py-0.5 rounded">Smart Fallback Loop</span>
                 <span className="text-[7px] text-gray-500 ml-1">Auto-requeues via SMS</span>
              </div>
            </div>
          </div>

          <FlowArrow label="60% Open" />
          <FlowNode label="Opened" count={stats.OPENED || 0} color="#4ade80" />
          
          <FlowArrow label="40% Click" />
          <FlowNode label="Clicked" count={stats.CLICKED || 0} color="#2dd4bf" />
        </div>
      </div>

      {recentLogs.length > 0 && (
        <div className="bg-zinc-950/80 rounded-xl p-3 border border-gray-800/50">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 font-semibold">Live Webhook Feed</p>
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-2 text-xs text-gray-300 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${
                  log.status === 'DELIVERED' ? 'bg-blue-500/20 text-blue-400' :
                  log.status === 'OPENED' ? 'bg-green-500/20 text-green-400' :
                  log.status === 'CLICKED' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {log.status}
                </span>
                <span className="truncate flex-1 flex flex-col">
                  <span>Webhook received for <strong>{log.customer?.name}</strong></span>
                  {log.message && <span className="text-gray-400 text-[10px] mt-0.5 italic truncate">"{log.message}"</span>}
                </span>
                <span className="text-gray-500 font-mono text-[10px]">
                  {new Date(log.updatedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Analyst Button & Insights */}
      <div className="border-t border-gray-800 pt-4 mt-4">
        {!insights ? (
          <button
            onClick={async () => {
              setIsAnalyzing(true);
              try {
                const res = await fetch('/api/ai/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ stats, audienceSize, messageBody, channel })
                });
                const data = await res.json();
                setInsights(data);
              } catch (err) { console.error(err); }
              finally { setIsAnalyzing(false); }
            }}
            disabled={isAnalyzing}
            className="w-full bg-gradient-to-r from-lime-500/20 to-green-500/20 hover:from-lime-500/30 hover:to-green-500/30 border border-lime-500/30 text-lime-300 py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-medium text-sm disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isAnalyzing ? "Analyzing Campaign Data..." : "Generate AI Insights"}
          </button>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-lime-950/30 border border-lime-500/30 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-lime-500 to-green-500"></div>
            <h4 className="text-lime-300 font-semibold mb-2 flex items-center gap-2 text-sm">
              <Bot className="w-4 h-4" /> Post-Campaign Analysis
            </h4>
            <p className="text-gray-300 text-sm leading-relaxed mb-4">{insights.analysis}</p>
            
            <div className="bg-zinc-950/50 rounded-lg p-3 border border-gray-800">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Recommended Next Action</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300 italic">"{insights.recommendedFollowUpPrompt}"</span>
                <button 
                  onClick={() => onExecuteFollowUp && onExecuteFollowUp(insights.recommendedFollowUpPrompt)}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded text-xs transition-colors ml-4 shrink-0"
                >
                  Execute &rarr;
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Sub-component for Database Viewer Modal
function DatabaseModal({ close, onClose }: { close: () => void, onClose: () => void }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => {
        setCustomers(data.customers || []);
        setLoading(false);
      });
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={close}
    >
      <motion.div 
        initial={{ y: 20, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 w-full max-w-4xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-lime-400" />
            <h2 className="font-semibold text-white">Live Database View</h2>
          </div>
          <button onClick={close} className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-lime-500" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300 min-w-[500px]">
                <thead className="text-xs uppercase bg-gray-800/50 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3 rounded-tr-lg">Total Spent ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, i) => {
                    const totalSpent = c.orders?.reduce((sum: number, o: any) => sum + o.amount, 0) || 0;
                    return (
                      <tr key={c.id} className="border-b border-gray-800/50 hover:bg-white/5">
                        <td className="px-4 py-3 font-mono text-[10px] text-gray-500">{c.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-200">{c.name}</td>
                        <td className="px-4 py-3 text-gray-400">{c.email}</td>
                        <td className="px-4 py-3 font-mono text-lime-300">${totalSpent}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
