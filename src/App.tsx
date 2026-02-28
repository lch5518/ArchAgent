/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  Maximize2, 
  Send, 
  FileText, 
  Layout, 
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzeDrawing, chatWithAgent } from './services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImage(base64);
        setMimeType(file.type);
        handleAnalyze(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async (imgData: string, type: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeDrawing(imgData, type);
      setAnalysis(result);
      setMessages([{
        role: 'agent',
        content: "도면 분석이 완료되었습니다. 왼쪽 패널에서 상세 분석 내용을 확인하실 수 있습니다. 추가로 궁금한 점이 있으시면 말씀해 주세요.",
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error(error);
      setAnalysis("분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isChatLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsChatLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', content: m.content }));
      const response = await chatWithAgent(input, history, image ? { data: image, mimeType } : undefined);
      
      setMessages(prev => [...prev, {
        role: 'agent',
        content: response || "죄송합니다. 답변을 생성하지 못했습니다.",
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'agent',
        content: "오류가 발생했습니다. 다시 시도해 주세요.",
        timestamp: new Date()
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f1f3f5] overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
            <Building2 className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 leading-tight">ArchAgent</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">AI Architectural Design Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <Upload size={16} />
            도면 업로드
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Drawing & Analysis */}
        <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
          {/* Drawing Viewer */}
          <div className="h-3/5 relative bg-slate-100 data-grid overflow-hidden group">
            {image ? (
              <div className="w-full h-full flex items-center justify-center p-8">
                <motion.div 
                  style={{ scale: zoom, rotate: rotation }}
                  className="relative shadow-2xl bg-white p-2"
                >
                  <img 
                    src={image} 
                    alt="Architectural Drawing" 
                    className="max-w-full max-h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
                
                {/* Viewer Controls */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur border border-slate-200 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setZoom(z => Math.min(z + 0.2, 3))} className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><ZoomIn size={18} /></button>
                  <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><ZoomOut size={18} /></button>
                  <button onClick={() => setRotation(r => r + 90)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><RotateCcw size={18} /></button>
                  <div className="w-px h-4 bg-slate-200 mx-1" />
                  <button onClick={() => {setZoom(1); setRotation(0);}} className="px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900">Reset</button>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center">
                  <Layout size={32} />
                </div>
                <div className="text-center">
                  <p className="font-medium">분석할 도면을 업로드해 주세요</p>
                  <p className="text-sm opacity-70">이미지 파일 (JPG, PNG) 지원</p>
                </div>
              </div>
            )}
          </div>

          {/* Analysis Results */}
          <div className="flex-1 overflow-y-auto p-6 border-t border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                AI Analysis Report
              </h2>
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Loader2 size={14} className="animate-spin" />
                  분석 중...
                </div>
              )}
            </div>
            
            <div className="prose prose-slate prose-sm max-w-none">
              {analysis ? (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <Markdown>{analysis}</Markdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                  <FileText size={24} className="mb-2 opacity-50" />
                  <p className="text-xs font-medium">도면을 업로드하면 AI가 법규 및 설계를 분석합니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Chat Interface */}
        <div className="w-1/2 flex flex-col bg-white">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-slate-900" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Design Consultation</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Agent Online</span>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 opacity-60">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-slate-100">
                  <Building2 size={24} />
                </div>
                <div className="text-center max-w-xs">
                  <p className="text-sm font-medium text-slate-600">ArchAgent와 대화를 시작해 보세요</p>
                  <p className="text-xs mt-1">"휠체어 회전 반경이 충분한가요?", "출입구 너비를 1200mm로 변경하면 어떨까요?" 등 질문이 가능합니다.</p>
                </div>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className={cn(
                  "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                  msg.role === 'user' 
                    ? "bg-slate-900 text-white rounded-tr-none" 
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                )}>
                  <div className="prose prose-sm max-w-none prose-invert">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-400 mt-1.5 px-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            ))}
            {isChatLoading && (
              <div className="flex items-start gap-2">
                <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0">
            <form onSubmit={handleSendMessage} className="relative">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="설계에 대해 질문해 주세요..."
                className="w-full bg-slate-100 border-none rounded-xl py-4 pl-5 pr-14 text-sm focus:ring-2 focus:ring-slate-900 transition-all placeholder:text-slate-400"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isChatLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition-all"
              >
                <Send size={18} />
              </button>
            </form>
            <p className="text-[10px] text-center text-slate-400 mt-3 font-medium uppercase tracking-widest">
              Powered by Gemini 3.1 Pro Preview
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
