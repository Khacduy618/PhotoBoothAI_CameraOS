import React, { useState, useRef, useEffect } from 'react';
import { FrameTemplate, SessionData } from '../../types';
import { HOI_AN_SAMPLE_PHOTOS } from '../../data/hoianSamplePhotos';
import { Edit3, Type, RotateCcw, Check, Eraser, Undo, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface CustomizeScreenProps {
  session: SessionData;
  template: FrameTemplate;
  onConfirmCustomization: (customText: string, drawDataUrl: string) => void;
  onBackToTemplate: () => void;
}

export const CustomizeScreen: React.FC<CustomizeScreenProps> = ({
  session,
  template,
  onConfirmCustomization,
  onBackToTemplate,
}) => {
  const [typedText, setTypedText] = useState<string>(session.customText || '');
  const [activeTab, setActiveTab] = useState<'text' | 'draw'>('draw');

  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState<string>('#1A1A1A');
  const [brushSize, setBrushSize] = useState<number>(6);
  const [drawHistory, setDrawHistory] = useState<ImageData[]>([]);

  const pastelColors = [
    { name: 'Charcoal', hex: '#1A1A1A' },
    { name: 'Soft Rose', hex: '#E0A39A' },
    { name: 'Sage Green', hex: '#8DAA91' },
    { name: 'Cream Yellow', hex: '#D6C085' },
    { name: 'Lavender', hex: '#A899C4' },
    { name: 'Soft Blue', hex: '#8A9FB4' },
    { name: 'Pure White', hex: '#FFFFFF' },
  ];

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save history state
    const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setDrawHistory((prev) => [...prev, currentImageData]);

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTab !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || drawHistory.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const previousState = drawHistory[drawHistory.length - 1];
    ctx.putImageData(previousState, 0, 0);
    setDrawHistory((prev) => prev.slice(0, -1));
  };

  const handleClearDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawHistory([]);
  };

  const handleResetAll = () => {
    setTypedText('');
    handleClearDrawing();
  };

  const handleDone = () => {
    const canvas = canvasRef.current;
    const drawDataUrl = canvas ? canvas.toDataURL('image/png') : '';
    onConfirmCustomization(typedText, drawDataUrl);
  };

  // Virtual Keyboard Keys for Touch Kiosk
  const keyboardKeys = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  return (
    <div className="w-full h-[calc(100vh-68px)] flex flex-col justify-between p-6 sm:p-8 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
      {/* Top Header */}
      <div className="w-full max-w-6xl mx-auto flex flex-col items-center text-center">
        <h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]">
          THÊM CHỮ & NÉT VẼ
        </h2>
        <p className="text-xs sm:text-sm opacity-70 mt-1 font-sans">
          Trang trí thêm câu chúc hoặc nét vẽ cá nhân lên khung ảnh của bạn.
        </p>
      </div>

      {/* Main Split Content */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto py-4 items-center">
        {/* Left Tool Panel */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex border-b border-[#1A1A1A]/15 pb-2 gap-2">
            {template.allowTyping && (
              <button
                onClick={() => setActiveTab('text')}
                className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-colors border cursor-pointer ${
                  activeTab === 'text'
                    ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A]'
                    : 'bg-[#F4F2EE] text-[#1A1A1A] border-[#1A1A1A]/15'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>GÕ CHỮ</span>
              </button>
            )}

            {template.allowDraw && (
              <button
                onClick={() => setActiveTab('draw')}
                className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-colors border cursor-pointer ${
                  activeTab === 'draw'
                    ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A]'
                    : 'bg-[#F4F2EE] text-[#1A1A1A] border-[#1A1A1A]/15'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>VẼ TAY</span>
              </button>
            )}
          </div>

          {/* Text Tab Editor */}
          {activeTab === 'text' && template.allowTyping && (
            <div className="bg-[#F4F2EE] border border-[#1A1A1A]/15 p-5 flex flex-col gap-4">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
                NHẬP LỜI CHÚC / CÂU TẶNG:
              </label>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={template.textPlaceholder || 'Gõ câu chúc ngắn ở đây...'}
                maxLength={40}
                className="w-full px-4 py-3 bg-[#FDFCFB] border border-[#1A1A1A]/20 text-sm font-sans focus:outline-none focus:border-[#1A1A1A]"
              />

              {/* Touchscreen On-Screen Virtual Keyboard */}
              <div className="flex flex-col gap-1.5 pt-2">
                <span className="text-[9px] font-mono opacity-50 uppercase tracking-widest">BÀN PHÍM ẢO CẢM ỨNG:</span>
                {keyboardKeys.map((row, rIdx) => (
                  <div key={rIdx} className="flex justify-center gap-1">
                    {row.map((char) => (
                      <button
                        key={char}
                        onClick={() => setTypedText((prev) => (prev.length < 40 ? prev + char : prev))}
                        className="w-8 h-9 sm:w-10 sm:h-10 bg-[#FDFCFB] border border-[#1A1A1A]/20 text-xs font-bold hover:bg-[#1A1A1A] hover:text-[#FDFCFB] transition-colors cursor-pointer"
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="flex justify-center gap-2 mt-1">
                  <button
                    onClick={() => setTypedText((prev) => prev + ' ')}
                    className="px-6 py-2 bg-[#FDFCFB] border border-[#1A1A1A]/20 text-xs font-bold uppercase tracking-wider hover:bg-[#1A1A1A] hover:text-[#FDFCFB] transition-colors cursor-pointer"
                  >
                    SPACE
                  </button>
                  <button
                    onClick={() => setTypedText((prev) => prev.slice(0, -1))}
                    className="px-4 py-2 bg-[#FDFCFB] border border-[#1A1A1A]/20 text-xs font-bold uppercase tracking-wider hover:bg-[#1A1A1A] hover:text-[#FDFCFB] transition-colors cursor-pointer"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Draw Tab Editor */}
          {activeTab === 'draw' && template.allowDraw && (
            <div className="bg-[#F4F2EE] border border-[#1A1A1A]/15 p-5 flex flex-col gap-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
                BẢNG MÀU TÔNG PASTEL:
              </span>
              <div className="flex gap-2.5 flex-wrap">
                {pastelColors.map((col) => (
                  <button
                    key={col.hex}
                    onClick={() => setBrushColor(col.hex)}
                    style={{ backgroundColor: col.hex }}
                    className={`w-8 h-8 rounded-full border border-[#1A1A1A]/20 cursor-pointer transition-transform ${
                      brushColor === col.hex ? 'scale-125 ring-2 ring-[#1A1A1A]' : 'hover:scale-110'
                    }`}
                  />
                ))}
              </div>

              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mt-2">
                KÍCH THƯỚC NÉT VẼ:
              </span>
              <div className="flex items-center gap-4">
                {[2, 4, 8, 12].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setBrushSize(sz)}
                    className={`px-3 py-1.5 text-[10px] font-bold border cursor-pointer ${
                      brushSize === sz
                        ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A]'
                        : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/20'
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>

              <div className="flex gap-3 mt-3 pt-3 border-t border-[#1A1A1A]/10">
                <button
                  onClick={handleUndo}
                  className="px-4 py-2 border border-[#1A1A1A]/20 bg-[#FDFCFB] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:border-[#1A1A1A] cursor-pointer"
                >
                  <Undo className="w-3.5 h-3.5" />
                  <span>HOÀN TÁC</span>
                </button>
                <button
                  onClick={handleClearDrawing}
                  className="px-4 py-2 border border-[#1A1A1A]/20 bg-[#FDFCFB] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:border-[#1A1A1A] cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>XÓA VẼ</span>
                </button>
              </div>
            </div>
          )}

          {/* Reset All Customization Button */}
          <button
            onClick={handleResetAll}
            className="self-start text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/60 hover:text-[#1A1A1A] flex items-center gap-1.5 cursor-pointer mt-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>ĐẶT LẠI MẶC ĐỊNH</span>
          </button>
        </div>

        {/* Right Interactive Canvas / Live Preview Box */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-md bg-[#F4F2EE] border border-[#1A1A1A]/20 p-5 shadow-xl flex flex-col items-center relative rounded-xs">
            <div
              className={`w-full ${
                template.layout.type === '1x4' || template.preferredPaper === '2x6-double'
                  ? 'aspect-[1/2] max-w-[280px]'
                  : template.layout.type === '1x1'
                  ? 'aspect-[1/1] max-w-[340px]'
                  : 'aspect-[2/3] max-w-[340px]'
              } relative border border-[#1A1A1A]/30 shadow-md overflow-hidden my-1`}
              style={{ backgroundColor: template.assets.background || '#FDFCFB' }}
            >
              {/* Photo Slots mapped directly from template definition */}
              {template.slots.map((slot, i) => {
                const assignedPhoto = session.slotAssignments?.[i] || session.photos[i];
                const photoUrl = assignedPhoto ? assignedPhoto.dataUrl : HOI_AN_SAMPLE_PHOTOS[i % HOI_AN_SAMPLE_PHOTOS.length];

                return (
                  <div
                    key={slot.id || i}
                    className="absolute overflow-hidden border border-[#1A1A1A]/10 bg-[#E8E6E1] flex items-center justify-center pointer-events-none"
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      width: `${slot.width}%`,
                      height: `${slot.height}%`,
                      borderRadius: slot.borderRadius ? `${slot.borderRadius}px` : undefined,
                    }}
                  >
                    <img
                      src={photoUrl}
                      alt={`Slot ${i + 1}`}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                );
              })}

              {/* Branding + Typed Text Overlay positioned at bottom matching compositionEngine */}
              <div className="absolute inset-x-0 bottom-3 text-center py-1 z-10 pointer-events-none px-2">
                <span
                  className="block font-serif italic text-base font-bold"
                  style={{ color: template.assets.textColor || '#1A1A1A' }}
                >
                  {template.eventBranding?.text || ''}
                </span>
                {typedText ? (
                  <span
                    className="block text-xs font-bold mt-0.5 tracking-wide"
                    style={{ color: template.assets.textColor || '#1A1A1A' }}
                  >
                    &ldquo;{typedText}&rdquo;
                  </span>
                ) : (
                  <span
                    className="block text-[9px] font-mono opacity-75 font-medium"
                    style={{ color: template.assets.textColor || '#1A1A1A' }}
                  >
                    {template.eventBranding?.subtext || 'Kí Ức Di Sản'}
                  </span>
                )}
              </div>

              {/* Drawing Layer Canvas - 2:3 aspect matching 1800x2700 canvas */}
              {template.allowDraw && (
                <canvas
                  ref={canvasRef}
                  width={360}
                  height={540}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className={`absolute inset-0 w-full h-full z-20 cursor-crosshair touch-none ${
                    activeTab === 'draw' ? 'pointer-events-auto' : 'pointer-events-none'
                  }`}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="w-full max-w-6xl mx-auto border-t border-[#1A1A1A]/10 pt-5 flex justify-between items-center">
        <button
          onClick={onBackToTemplate}
          className="px-6 py-3.5 border border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-xs font-bold tracking-[0.2em] uppercase flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>QUAY LẠI MẪU</span>
        </button>

        <button
          onClick={handleDone}
          className="px-10 py-4 bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#333333] text-xs font-bold tracking-[0.25em] uppercase flex items-center gap-3 transition-colors shadow-md cursor-pointer rounded-xs"
        >
          <span>HOÀN TẤT (XEM THÀNH PHẨM)</span>
          <Check className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
