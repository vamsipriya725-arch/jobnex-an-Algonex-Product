import React, { useState, useRef, useEffect } from "react";
import { Link } from "@/lib/nav";
import { useJobNex } from "@/frontend/context/JobNexContext";
import { Bot, Send, User, ArrowRight } from "lucide-react";

export function AIAssistantView() {
  const { chatMessages, sendChatMessage, isChatLoading } = useJobNex();
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isChatLoading]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isChatLoading) return;
    sendChatMessage(inputMessage.trim());
    setInputMessage("");
  };

  const handleChipClick = (chip: string) => {
    sendChatMessage(chip);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[78vh]">
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white flex items-center justify-between border-b border-brand-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white shadow-md ">
              <Bot className="w-6 h-6 animate-pulse-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-base tracking-tight">JobNex AI Assistant</h2>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <p className="text-[11px] text-slate-300">
                I&apos;m here to help you with jobs, courses, interview prep and more!
              </p>
            </div>
          </div>

          <div className="text-[10px] bg-brand-500/20 border border-brand-400/30 px-2.5 py-1 rounded-full text-brand-300 font-bold uppercase tracking-wider hidden sm:block">
            Gemini 3.8 Flash • Online
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {chatMessages.map((msg) => {
            const isUser = msg.sender === "USER";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-lg space-y-3`}>
                  <div
                    className={`p-4 rounded-lg text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? "bg-brand-600 text-white rounded-tr-none shadow-md"
                        : "bg-white text-slate-800 rounded-tl-none border border-slate-200/80 shadow-xs"
                    }`}
                  >
                    <div className="whitespace-pre-line font-normal">{msg.content}</div>

                    {msg.actionLinks && msg.actionLinks.length > 0 && (
                      <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap gap-2">
                        {msg.actionLinks.map((link, idx) => (
                          <Link
                            key={idx}
                            href={link.url}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs border border-brand-200 transition-colors"
                          >
                            <span>{link.title}</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isUser && msg.suggestedChips && msg.suggestedChips.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">
                        Suggested Follow-ups:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedChips.map((chip, i) => (
                          <button
                            key={i}
                            onClick={() => handleChipClick(chip)}
                            className="text-[11px] font-semibold px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-brand-400 hover:text-brand-600 text-slate-700 shadow-2xs transition-all hover:scale-[1.02]"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isChatLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-600 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-brand-600 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-brand-600 animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask anything (e.g. Best skills for Data Science? Top companies hiring?)..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 text-xs sm:text-sm bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white px-4 py-3 rounded-lg outline-none transition-all font-medium"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isChatLoading}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white p-3 rounded-lg shadow-md  transition-all flex items-center justify-center active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
