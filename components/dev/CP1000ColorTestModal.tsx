"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  createCP1000ColorTest,
  CP1000_COLOR_PRESETS,
  type CP1000ColorTestResult,
} from '@/services/calibration/cp1000-color-test.service';
import { generateProductionPipelineTest } from '@/services/calibration/production-print-pipeline-test.service';
import { HOI_AN_SAMPLE_PHOTOS } from '@/components/momentai-guest-flow/data/hoianSamplePhotos';

interface CP1000ColorTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional initial image (e.g. from current session shot) */
  initialPhotoUrl?: string | null;
}

export function CP1000ColorTestModal({
  isOpen,
  onClose,
  initialPhotoUrl,
}: CP1000ColorTestModalProps) {
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(initialPhotoUrl || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<CP1000ColorTestResult | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-load initial photo or default sample photo on open
  useEffect(() => {
    if (!isOpen) {
      setTestResult(null);
      setPreviewDataUrl(null);
      setPrintFeedback(null);
      return;
    }

    if (initialPhotoUrl) {
      setSourceImageUrl(initialPhotoUrl);
      void generateTestSheet(initialPhotoUrl);
    } else {
      // Default to sample photo
      const sample = HOI_AN_SAMPLE_PHOTOS[0];
      setSourceImageUrl(sample);
      void generateTestSheet(sample);
    }
  }, [isOpen, initialPhotoUrl]);

  const generateTestSheet = async (imgSource: string | Blob) => {
    setIsGenerating(true);
    setPrintFeedback(null);
    try {
      const res = await createCP1000ColorTest({
        sourceImage: imgSource,
        targetWidth: 1800,
        targetHeight: 2700,
      });
      setTestResult(res);
      setPreviewDataUrl(res.toDataURL('image/jpeg', 1.0));
    } catch (err) {
      console.error('[CP1000CalibrationV2] Failed to generate test sheet:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSourceImageUrl(url);
      void generateTestSheet(file);
    }
  };

  const handleDownloadJpg = () => {
    if (testResult) {
      testResult.download('CP1000-magenta-calibration-v2.jpg', 'image/jpeg');
    }
  };

  const handleDownloadPng = () => {
    if (testResult) {
      testResult.download('CP1000-magenta-calibration-v2.png', 'image/png');
    }
  };

  const handleDownloadProdPipelineTest = async () => {
    if (!sourceImageUrl) return;
    setIsGenerating(true);
    try {
      const prodTest = await generateProductionPipelineTest(sourceImageUrl);
      prodTest.download('CP1000-production-pipeline-test.jpg');
      setPrintFeedback('✅ Đã tải file CP1000-production-pipeline-test.jpg (chuẩn 100% production print pipeline)!');
    } catch (err) {
      setPrintFeedback(`⚠️ Lỗi khi tạo test production: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintProdPipelineTest = async () => {
    if (!sourceImageUrl) return;
    setIsPrinting(true);
    setPrintFeedback('Đang chuẩn bị gửi file test production sang máy in Canon CP1000...');

    try {
      const prodTest = await generateProductionPipelineTest(sourceImageUrl);
      const testDataUrl = prodTest.dataUrl;

      const momentaiApi = typeof window !== 'undefined'
        ? (window as unknown as { momentai?: { guest?: { storage?: { createSession?: (sid: string) => Promise<unknown>; saveOutput?: (sid: string, type: string, file: unknown) => Promise<unknown> }; session?: { requestPrint?: (sid: string, copies: number) => Promise<{ ok?: boolean; error?: { message?: string; guestMessage?: string } }> } } } }).momentai?.guest
        : undefined;

      if (momentaiApi?.storage?.saveOutput && momentaiApi?.session?.requestPrint) {
        const testSessionId = `prod_test_${Date.now()}`;
        if (momentaiApi.storage.createSession) {
          try {
            await momentaiApi.storage.createSession(testSessionId);
          } catch {}
        }
        await momentaiApi.storage.saveOutput(testSessionId, 'print', {
          dataUrl: testDataUrl,
          mimeType: 'image/jpeg',
        });
        const res = await momentaiApi.session.requestPrint(testSessionId, 1);
        if (res && typeof res === 'object' && 'ok' in res && !res.ok) {
          throw new Error(res.error?.guestMessage || res.error?.message || 'Lỗi khi gửi lệnh in');
        }
        setPrintFeedback('✅ Đã nạp thành công CP1000-production-pipeline-test.jpg vào Spooler Windows!');
      } else {
        prodTest.download('CP1000-production-pipeline-test.jpg');
        setPrintFeedback('ℹ️ Đã tải file CP1000-production-pipeline-test.jpg về máy để in thủ công.');
      }
    } catch (err) {
      setPrintFeedback(`⚠️ Lỗi khi in: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDirectPrint = async () => {
    if (!testResult) return;
    setIsPrinting(true);
    setPrintFeedback('Đang chuẩn bị gửi file test sang máy in Canon CP1000...');

    try {
      const testDataUrl = testResult.toDataURL('image/jpeg', 1.0);

      // If in Electron desktop environment, use direct storage/print channel
      const momentaiApi = typeof window !== 'undefined'
        ? (window as unknown as { momentai?: { guest?: { storage?: { createSession?: (sid: string) => Promise<unknown>; saveOutput?: (sid: string, type: string, file: unknown) => Promise<unknown> }; session?: { requestPrint?: (sid: string, copies: number) => Promise<{ ok?: boolean; error?: { message?: string; guestMessage?: string } }> } } } }).momentai?.guest
        : undefined;

      if (momentaiApi?.storage?.saveOutput && momentaiApi?.session?.requestPrint) {
        const testSessionId = `calibration_test_${Date.now()}`;
        if (momentaiApi.storage.createSession) {
          try {
            await momentaiApi.storage.createSession(testSessionId);
          } catch {}
        }
        await momentaiApi.storage.saveOutput(testSessionId, 'print', {
          dataUrl: testDataUrl,
          mimeType: 'image/jpeg',
        });
        const res = await momentaiApi.session.requestPrint(testSessionId, 1);
        if (res && typeof res === 'object' && 'ok' in res && !res.ok) {
          throw new Error(res.error?.guestMessage || res.error?.message || 'Lỗi khi gửi lệnh in');
        }
        setPrintFeedback('✅ Đã nạp thành công vào Spooler Windows: Máy in Canon CP1000 đang tiến hành in 1 tờ test 10x15!');
      } else {
        testResult.download('CP1000-magenta-calibration-v2.jpg', 'image/jpeg');
        setPrintFeedback('ℹ️ Đã tải file CP1000-magenta-calibration-v2.jpg về máy để in thủ công.');
      }
    } catch (err) {
      setPrintFeedback(`⚠️ Lỗi khi in: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPrinting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none font-sans text-neutral-900">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-900 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#F6C453] text-black font-black text-xs">
              V2
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold tracking-wide flex items-center gap-2">
                Canon SELPHY CP1000 — Calibration V2 (Magenta Test)
                <span className="text-[10px] font-mono bg-amber-500/30 text-[#F6C453] border border-amber-500/40 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                  Dev Isolated
                </span>
              </h2>
              <p className="text-xs text-neutral-400 font-mono">
                1 tờ test 10×15 cm (1800×2700 px) gồm 4 ô từ CÙNG 1 ảnh gốc: ORIGINAL, M1, M2, M3
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto">
          
          {/* Left Column: 1800x2700 Live Sheet Preview (7/12) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-neutral-100 p-4 rounded-xl border border-neutral-300 min-h-[420px]">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-3 text-neutral-500 animate-pulse">
                <div className="w-10 h-10 border-4 border-[#F6C453] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono font-bold tracking-wider">Đang render 4 profile V2 từ ảnh gốc...</span>
              </div>
            ) : previewDataUrl ? (
              <div className="relative shadow-xl border border-neutral-400/60 rounded-md overflow-hidden bg-white max-h-[55vh] aspect-[2/3]">
                <img
                  src={previewDataUrl}
                  alt="CP1000 Calibration V2 Test Sheet Preview"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 right-2 bg-black/80 text-white text-[9px] font-mono font-bold px-2 py-1 rounded backdrop-blur">
                  1800 × 2700 px • 10×15 cm
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono text-neutral-400">Chưa có ảnh nguồn</div>
            )}

            {printFeedback && (
              <div className="mt-3 text-xs font-mono font-bold text-center px-4 py-2 rounded-lg bg-neutral-900 text-[#F6C453] border border-neutral-700 shadow-md">
                {printFeedback}
              </div>
            )}
          </div>

          {/* Right Column: Controls & Presets Explanation (5/12) */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            
            {/* Presets List */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono font-black uppercase tracking-wider text-neutral-500">
                4 Profile Magenta Test V2:
              </span>

              <div className="flex flex-col gap-2 text-xs">
                {CP1000_COLOR_PRESETS.map((preset, idx) => (
                  <div
                    key={preset.id}
                    className="p-2.5 rounded-lg border border-neutral-200 bg-white hover:border-neutral-400 transition"
                  >
                    <div className="flex items-center justify-between font-mono font-bold text-neutral-900">
                      <span className="text-sm font-black">{preset.name}</span>
                      <span className="text-[11px] font-mono font-semibold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded">
                        {preset.formula}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {idx === 0 ? 'Top-Left' : idx === 1 ? 'Top-Right' : idx === 2 ? 'Bottom-Left' : 'Bottom-Right'}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                      {preset.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Image Selection Actions */}
            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
              <span className="text-xs font-mono font-black uppercase tracking-wider text-neutral-500">
                Chọn ảnh nguồn Canon 6D:
              </span>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-50 active:scale-95 transition"
                >
                  📁 Tải ảnh từ máy
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const sample = HOI_AN_SAMPLE_PHOTOS[0];
                    setSourceImageUrl(sample);
                    void generateTestSheet(sample);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-50 active:scale-95 transition"
                >
                  🖼️ Dùng ảnh mẫu
                </button>
              </div>
            </div>

            {/* Real Production Print Pipeline Verification */}
            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-amber-900 flex items-center justify-between">
                <span>🎯 Test Production Pipeline Thật</span>
                <span className="text-[9px] bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded font-bold">M2 Real</span>
              </span>
              <p className="text-[10px] text-amber-800 leading-tight">
                Chạy qua đúng 100% pipeline production: Ảnh Canon gốc → Crop 1 lần → M2 (R1.03/G0.96/B1.01) → Frame/Deco → Print Master 1800×2700.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleDownloadProdPipelineTest}
                  disabled={!sourceImageUrl || isGenerating}
                  className="flex items-center justify-center gap-1 rounded-lg border border-amber-300 bg-white py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 active:scale-95 disabled:opacity-50 transition shadow-sm"
                >
                  📥 Tải Test Prod (.jpg)
                </button>
                <button
                  type="button"
                  onClick={handlePrintProdPipelineTest}
                  disabled={!sourceImageUrl || isGenerating || isPrinting}
                  className="flex items-center justify-center gap-1 rounded-lg bg-amber-600 py-2 text-xs font-bold text-white hover:bg-amber-700 active:scale-95 disabled:opacity-50 transition shadow-sm"
                >
                  🖨️ In Test Prod
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadJpg}
                  disabled={!testResult || isGenerating}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white py-2.5 text-xs font-black uppercase tracking-wider text-neutral-900 hover:bg-neutral-100 active:scale-95 disabled:opacity-50 transition shadow-sm"
                >
                  📥 Tải file (.jpg)
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={!testResult || isGenerating}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white py-2.5 text-xs font-black uppercase tracking-wider text-neutral-900 hover:bg-neutral-100 active:scale-95 disabled:opacity-50 transition shadow-sm"
                >
                  📥 Tải file (.png)
                </button>
              </div>

              <button
                type="button"
                onClick={handleDirectPrint}
                disabled={!testResult || isGenerating || isPrinting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 text-xs font-black uppercase tracking-wider text-[#F6C453] hover:bg-neutral-800 active:scale-95 disabled:opacity-50 transition shadow-md"
              >
                {isPrinting ? '⏳ Đang in...' : '🖨️ In thử ra CP1000'}
              </button>

              <p className="text-[10px] font-mono text-neutral-400 text-center">
                * Calibration V2: Chỉ dùng để đánh giá trực quan trên giấy in, không thay đổi bất kỳ ảnh production nào.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
