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
  Building2,
  Sun,
  Thermometer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzeDrawing, chatWithAgent, checkWheelchairAccessibility, checkThermalEfficiency, type WheelchairAnalysis, type ThermalAnalysis } from './services/gemini';
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
  const [wheelchairData, setWheelchairData] = useState<WheelchairAnalysis | null>(null);
  const [thermalData, setThermalData] = useState<ThermalAnalysis | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [activeTab, setActiveTab] = useState<'general' | 'wheelchair' | 'thermal'>('general');

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
        setAnalysis(null);
        setWheelchairData(null);
        handleAnalyze(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async (imgData: string, type: string) => {
    setIsAnalyzing(true);
    try {
      let dataToAnalyze = imgData;
      // If it's a URL, we need to fetch it and convert to base64 for Gemini
      if (imgData.startsWith('http')) {
        try {
          const res = await fetch(imgData);
          const blob = await res.blob();
          dataToAnalyze = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error("Fetch failed, attempting to use image directly", e);
          throw new Error("이미지를 가져오는데 실패했습니다. CORS 정책 때문일 수 있습니다. 직접 업로드해 주세요.");
        }
      }

      const result = await analyzeDrawing(dataToAnalyze, type);
      setAnalysis(result);
      setMessages([{
        role: 'agent',
        content: "도면 분석이 완료되었습니다. 왼쪽 패널에서 상세 분석 내용을 확인하실 수 있습니다. '휠체어 접근성 체크' 버튼을 눌러 상세 데이터를 추출할 수도 있습니다.",
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error(error);
      setAnalysis("분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleWheelchairCheck = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    setActiveTab('wheelchair');
    try {
      let dataToAnalyze = image;
      if (image.startsWith('http')) {
        try {
          const res = await fetch(image);
          const blob = await res.blob();
          dataToAnalyze = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          throw new Error("이미지를 가져오는데 실패했습니다. 직접 업로드한 도면으로 시도해 주세요.");
        }
      }
      const data = await checkWheelchairAccessibility(dataToAnalyze, mimeType);
      setWheelchairData(data);
      setMessages(prev => [...prev, {
        role: 'agent',
        content: "휠체어 접근성 데이터 추출이 완료되었습니다. 상세 표를 확인해 주세요.",
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'agent',
        content: "휠체어 접근성 데이터 추출 중 오류가 발생했습니다.",
        timestamp: new Date()
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleThermalCheck = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    setActiveTab('thermal');
    try {
      let dataToAnalyze = image;
      if (image.startsWith('http')) {
        const res = await fetch(image);
        const blob = await res.blob();
        dataToAnalyze = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      const data = await checkThermalEfficiency(dataToAnalyze, mimeType);
      setThermalData(data);
      setMessages(prev => [...prev, {
        role: 'agent',
        content: "일조량 및 열효율 분석이 완료되었습니다. 상세 데이터를 확인해 주세요.",
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'agent',
        content: "열효율 분석 중 오류가 발생했습니다.",
        timestamp: new Date()
      }]);
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
            onClick={() => {
              // Using the user-provided sample floor plan
              const sampleUrl = "https://storage.googleapis.com/archagent/sample_img/sample.PNG";
              setImage(sampleUrl);
              setMimeType("image/png");
              setAnalysis(null);
              setWheelchairData(null);
              handleAnalyze(sampleUrl, "image/png");
            }}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <Layout size={16} />
            샘플 도면
          </button>
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
          <div className="h-2/5 relative bg-slate-100 data-grid overflow-hidden group">
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
                  <button onClick={() => { setZoom(1); setRotation(0); }} className="px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900">Reset</button>
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

          {/* Analysis Results Tabs */}
          <div className="flex-1 flex flex-col overflow-hidden border-t border-slate-200">
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => setActiveTab('general')}
                className={cn(
                  "px-6 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2",
                  activeTab === 'general' ? "border-slate-900 text-slate-900 bg-white" : "border-transparent text-slate-400 hover:text-slate-600"
                )}
              >
                일반 분석
              </button>
              <button
                onClick={() => setActiveTab('wheelchair')}
                className={cn(
                  "px-6 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2",
                  activeTab === 'wheelchair' ? "border-emerald-600 text-emerald-600 bg-white" : "border-transparent text-slate-400 hover:text-slate-600"
                )}
              >
                휠체어 접근성
              </button>
              <button
                onClick={() => setActiveTab('thermal')}
                className={cn(
                  "px-6 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2",
                  activeTab === 'thermal' ? "border-amber-600 text-amber-600 bg-white" : "border-transparent text-slate-400 hover:text-slate-600"
                )}
              >
                일조/열효율
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {activeTab === 'general' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                      <FileText size={16} className="text-slate-400" />
                      AI 분석 리포트
                    </h2>
                    {isAnalyzing && activeTab === 'general' && <Loader2 size={14} className="animate-spin text-slate-400" />}
                  </div>

                  {analysis ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm prose prose-slate prose-sm max-w-none">
                      <Markdown>{analysis}</Markdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                      <FileText size={24} className="mb-2 opacity-50" />
                      <p className="text-xs font-medium">도면을 업로드하면 AI가 법규 및 설계를 분석합니다.</p>
                    </div>
                  )}
                </div>
              ) : activeTab === 'wheelchair' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      휠체어 접근성 준수 데이터
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleWheelchairCheck}
                        disabled={!image || isAnalyzing}
                        className="flex items-center gap-2 px-3 py-1 bg-emerald-600 text-white rounded-md text-[10px] font-bold uppercase hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 size={12} />
                        체크 실행
                      </button>
                      {isAnalyzing && activeTab === 'wheelchair' && <Loader2 size={14} className="animate-spin text-emerald-600" />}
                    </div>
                  </div>

                  {wheelchairData ? (
                    <div className="space-y-6">
                      {wheelchairData.floor_analysis.map((floor, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-slate-900 px-4 py-2 flex items-center justify-between">
                            <span className="text-white font-bold text-sm">{floor.floor} 분석 결과</span>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              floor.compliance_level === 'High' ? "bg-emerald-500 text-white" :
                                floor.compliance_level === 'Medium' ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                            )}>
                              {floor.compliance_level === 'High' ? '높음' : floor.compliance_level === 'Medium' ? '보통' : '낮음'} 준수
                            </span>
                          </div>
                          <div className="p-4 grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-1">출입구 접근성</h4>
                                <p className="text-xs font-medium text-slate-900">{floor.entry_access.location}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">{floor.entry_access.description}</p>
                                <div className="mt-1 flex items-center gap-1">
                                  {floor.entry_access.elevator_exists ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-rose-500" />}
                                  <span className="text-[10px] font-bold text-slate-600">엘리베이터: {floor.entry_access.elevator_exists ? '있음' : '없음'}</span>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-1">경로 치수</h4>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1">
                                    {floor.path_dimensions.door_width_ok ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-rose-500" />}
                                    <span className="text-[10px] font-bold text-slate-600">문 너비 (900mm+)</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {floor.path_dimensions.turning_space_ok ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-rose-500" />}
                                    <span className="text-[10px] font-bold text-slate-600">회전 공간 (1.5m+)</span>
                                  </div>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">{floor.path_dimensions.details}</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-1">경사 및 단차</h4>
                                <div className="flex items-center gap-1 mb-1">
                                  {floor.slope_and_steps.ramp_found ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-rose-500" />}
                                  <span className="text-[10px] font-bold text-slate-600">경사로: {floor.slope_and_steps.ramp_found ? '확인됨' : '미확인'}</span>
                                </div>
                                <p className="text-[11px] text-slate-500">{floor.slope_and_steps.steps_identified}</p>
                              </div>
                              <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-1">장애인 시설</h4>
                                <div className="flex items-center gap-1 mb-1">
                                  {floor.disabled_facilities.accessible_toilet ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-rose-500" />}
                                  <span className="text-[10px] font-bold text-slate-600">장애인 화장실: {floor.disabled_facilities.accessible_toilet ? '있음' : '없음'}</span>
                                </div>
                                <p className="text-[11px] text-slate-500">{floor.disabled_facilities.details}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                        <h4 className="text-[10px] font-bold text-emerald-700 uppercase mb-2">종합 권장 사항</h4>
                        <p className="text-xs text-emerald-900 leading-relaxed">{wheelchairData.summary_recommendation}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                      <CheckCircle2 size={24} className="mb-2 opacity-50" />
                      <p className="text-xs font-medium">상단의 '휠체어 접근성 체크' 버튼을 눌러 데이터를 추출하세요.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-amber-600 flex items-center gap-2">
                      <Sun size={16} />
                      일조량 및 열효율 분석
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleThermalCheck}
                        disabled={!image || isAnalyzing}
                        className="flex items-center gap-2 px-3 py-1 bg-amber-600 text-white rounded-md text-[10px] font-bold uppercase hover:bg-amber-700 transition-colors disabled:opacity-50"
                      >
                        <Sun size={12} />
                        체크 실행
                      </button>
                      {isAnalyzing && activeTab === 'thermal' && <Loader2 size={14} className="animate-spin text-amber-600" />}
                    </div>
                  </div>

                  {thermalData ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                            <Sun size={12} className="text-amber-500" />
                            Sunlight Exposure
                          </h4>
                          <div className="space-y-2">
                            <div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase">Morning</span>
                              <p className="text-xs text-slate-900">{thermalData.sunlight_exposure.morning}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase">Afternoon</span>
                              <p className="text-xs text-slate-900">{thermalData.sunlight_exposure.afternoon}</p>
                            </div>
                            <div className="pt-2 border-t border-slate-100">
                              <span className="text-[10px] text-slate-500 font-bold uppercase">Overall Rating</span>
                              <p className="text-sm font-bold text-amber-600">{thermalData.sunlight_exposure.overall_rating}</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                            <Thermometer size={12} className="text-rose-500" />
                            Thermal Efficiency
                          </h4>
                          <div className="space-y-2">
                            <div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase">Summer Heat Gain</span>
                              <p className="text-xs text-slate-900">{thermalData.thermal_efficiency.summer_heat_gain}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase">Winter Heat Loss</span>
                              <p className="text-xs text-slate-900">{thermalData.thermal_efficiency.winter_heat_loss}</p>
                            </div>
                            <div className="pt-2 border-t border-slate-100">
                              <p className="text-[11px] text-slate-500 italic">{thermalData.thermal_efficiency.details}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-slate-900 px-4 py-2">
                          <span className="text-white font-bold text-sm">Window Analysis</span>
                        </div>
                        <div className="p-0">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">Location</th>
                                <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">Size</th>
                                <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">Orientation</th>
                                <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">Impact</th>
                              </tr>
                            </thead>
                            <tbody>
                              {thermalData.window_analysis.map((win, idx) => (
                                <tr key={idx} className="border-b border-slate-100 last:border-0">
                                  <td className="px-4 py-2 text-xs font-medium text-slate-900">{win.location}</td>
                                  <td className="px-4 py-2 text-xs text-slate-600">{win.size_estimate}</td>
                                  <td className="px-4 py-2 text-xs text-slate-600">{win.orientation}</td>
                                  <td className="px-4 py-2 text-xs text-slate-600">{win.impact}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                          <h4 className="text-[10px] font-bold text-rose-700 uppercase mb-1">Summer Cooling Impact</h4>
                          <p className="text-xs font-bold text-rose-900">{thermalData.estimated_cost_impact.summer_cooling}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                          <h4 className="text-[10px] font-bold text-blue-700 uppercase mb-1">Winter Heating Impact</h4>
                          <p className="text-xs font-bold text-blue-900">{thermalData.estimated_cost_impact.winter_heating}</p>
                        </div>
                      </div>

                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <h4 className="text-[10px] font-bold text-amber-700 uppercase mb-2">Design Recommendations</h4>
                        <ul className="space-y-1">
                          {thermalData.recommendations.map((rec, idx) => (
                            <li key={idx} className="text-xs text-amber-900 flex items-start gap-2">
                              <span className="mt-1 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                      <Sun size={24} className="mb-2 opacity-50" />
                      <p className="text-xs font-medium">우측의 '체크 실행' 버튼을 눌러 분석을 시작하세요.</p>
                    </div>
                  )}
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
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">설계 상담</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">에이전트 온라인</span>
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
