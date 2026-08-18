import React, { useEffect, useRef, useState } from 'react';
import type { FrameTemplate, SessionData } from '../../types';
import { HOI_AN_SAMPLE_PHOTOS } from '../../data/hoianSamplePhotos';
import {
  Edit3,
  Eraser,
  RotateCcw,
  Type,
  Undo,
  Redo,
  Trash2,
  Smile,
  Move,
  ZoomIn,
  ZoomOut,
  PlusCircle,
  Keyboard,
  X,
  Delete,
} from 'lucide-react';
import { isStripTemplate } from '../UI/frame-previews/FramePreviewCard';
import { GuestBottomNavigation } from '../UI/GuestBottomNavigation';

interface DrawScreenProps {
  session: SessionData;
  template: FrameTemplate;
  onConfirmDraw: (drawDataUrl: string) => void;
  onBackToTemplate: () => void;
}

interface CustomTextItem {
  id: string;
  text: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  fontFamily: string;
  fontLabel: string;
  color: string;
  fontSize: number; // 24, 32, 42, 56, 72
  scale: number; // 0.5 to 2.5
}

interface StampItem {
  id: string;
  emoji: string;
  label: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  size: number;
  scale: number; // 0.5 to 2.5
}

const FONT_OPTIONS = [
  { id: 'serif', label: 'Serif Cổ Điển', value: 'italic 36px "Playfair Display", serif' },
  { id: 'sans', label: 'Modern Hiện Đại', value: 'bold 32px "Plus Jakarta Sans", sans-serif' },
  { id: 'mono', label: 'Vintage Mono', value: 'bold 28px "Courier New", monospace' },
  { id: 'cursive', label: 'Bút Ký Nghệ Thuật', value: 'bold 42px "Caveat", "Dancing Script", cursive' },
  { id: 'handwriting', label: 'Nét Vẽ Tay', value: 'bold 36px "Pacifico", cursive' },
];

const PASTEL_COLORS = [
  { name: 'Charcoal', hex: '#1A1A1A' },
  { name: 'Soft Rose', hex: '#E0A39A' },
  { name: 'Sage Green', hex: '#8DAA91' },
  { name: 'Cream Yellow', hex: '#D6C085' },
  { name: 'Lavender', hex: '#A899C4' },
  { name: 'Soft Blue', hex: '#8A9FB4' },
  { name: 'Pure White', hex: '#FFFFFF' },
];

const HERITAGE_STAMPS = [
  { id: 'lantern', emoji: '🏮', label: 'Đèn Lồng' },
  { id: 'blossom', emoji: '🌸', label: 'Hoa Mai' },
  { id: 'postcard', emoji: '✉️', label: 'Bưu Thiếp' },
  { id: 'camera', emoji: '📷', label: 'Vintage Camera' },
  { id: 'heart', emoji: '❤️', label: 'Tim Kỷ Niệm' },
  { id: 'heritage', emoji: '🏰', label: 'Hội An 2026' },
  { id: 'sparkles', emoji: '✨', label: 'Lấp Lánh' },
  { id: 'star', emoji: '⭐', label: 'Ngôi Sao' },
];

const FONT_SIZES = [
  { label: 'S (24px)', size: 24 },
  { label: 'M (32px)', size: 32 },
  { label: 'L (42px)', size: 42 },
  { label: 'XL (56px)', size: 56 },
  { label: 'XXL (72px)', size: 72 },
];

// Clean QWERTY Letters (ABC Mode)
const QWERTY_LETTER_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

// Numbers & Symbols (123 Mode)
const NUMBERS_SYMBOLS_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '$', '%', '&', '-', '+', '(', ')', '/'],
  ['*', '"', "'", ':', ';', '!', '?', ',', '.'],
];

// Vietnamese Modern Telex Accent Diacritic Map
const TELEX_ACCENT_MAP: Record<string, Record<string, string>> = {
  s: {
    a: 'á', ă: 'ắ', â: 'ấ', e: 'é', ê: 'ế', i: 'í', o: 'ó', ô: 'ố', ơ: 'ớ', u: 'ú', ư: 'ứ', y: 'ý',
    A: 'Á', Ă: 'Ắ', Â: 'Ấ', E: 'É', Ê: 'Ế', I: 'Í', O: 'Ó', Ô: 'Ố', Ơ: 'Ớ', U: 'Ú', Ư: 'Ứ', Y: 'Ý',
  },
  f: {
    a: 'à', ă: 'ằ', â: 'ầ', e: 'è', ê: 'ề', i: 'ì', o: 'ò', ô: 'ồ', ơ: 'ờ', u: 'ù', ư: 'ừ', y: 'ỳ',
    A: 'À', Ă: 'Ằ', Â: 'Ầ', E: 'È', Ê: 'Ề', I: 'Ì', O: 'Ò', Ô: 'Ồ', Ơ: 'Ờ', U: 'Ù', Ư: 'Ừ', Y: 'Ỳ',
  },
  r: {
    a: 'ả', ă: 'ẳ', â: 'ẩ', e: 'ẻ', ê: 'ể', i: 'ỉ', o: 'ỏ', ô: 'ổ', ơ: 'ở', u: 'ủ', ư: 'ử', y: 'ỷ',
    A: 'Ả', Ă: 'Ẳ', Â: 'Ẩ', E: 'Ẻ', Ê: 'Ể', I: 'Ỉ', O: 'Ỏ', Ô: 'Ổ', Ơ: 'Ở', U: 'Ủ', Ư: 'Ử', Y: 'Ỷ',
  },
  x: {
    a: 'ã', ă: 'ẵ', â: 'ẫ', e: 'ẽ', ê: 'ễ', i: 'ĩ', o: 'õ', ô: 'ỗ', ơ: 'ỡ', u: 'ũ', ư: 'ữ', y: 'ỹ',
    A: 'Ã', Ă: 'Ẵ', Â: 'Ẫ', E: 'Ẽ', Ê: 'Ễ', I: 'Ĩ', O: 'Õ', Ô: 'Ỗ', Ơ: 'Ỡ', U: 'Ũ', Ư: 'Ữ', Y: 'Ỹ',
  },
  j: {
    a: 'ạ', ă: 'ặ', â: 'ậ', e: 'ẹ', ê: 'ệ', i: 'ị', o: 'ọ', ô: 'ộ', ơ: 'ợ', u: 'ụ', ư: 'ự', y: 'ỵ',
    A: 'Ạ', Ă: 'Ặ', Â: 'Ậ', E: 'Ẹ', Ê: 'Ệ', I: 'Ị', O: 'Ọ', Ô: 'Ộ', Ơ: 'Ợ', U: 'Ụ', Ư: 'Ự', Y: 'Ỵ',
  },
};

const UNACCENT_MAP: Record<string, string> = {
  á: 'a', ắ: 'ă', ấ: 'â', é: 'e', ế: 'ê', í: 'i', ó: 'o', ố: 'ô', ớ: 'ơ', ú: 'u', ứ: 'ư', ý: 'y',
  à: 'a', ằ: 'ă', ầ: 'â', è: 'e', ề: 'ê', ì: 'i', ò: 'o', ồ: 'ô', ờ: 'ơ', ù: 'u', ừ: 'ư', ỳ: 'y',
  ả: 'a', ẳ: 'ă', ẩ: 'â', ẻ: 'e', ể: 'ê', ỉ: 'i', ỏ: 'o', ổ: 'ô', ở: 'ơ', ủ: 'u', ử: 'ư', ỷ: 'y',
  ã: 'a', ẵ: 'ă', ẫ: 'â', ẽ: 'e', ễ: 'ê', ĩ: 'i', õ: 'o', ỗ: 'ô', ỡ: 'ơ', ũ: 'u', ữ: 'ư', ỹ: 'y',
  ạ: 'a', ặ: 'ă', ậ: 'â', ẹ: 'e', ệ: 'ê', ị: 'i', ọ: 'o', ộ: 'ô', ợ: 'ơ', ụ: 'u', ự: 'ư', ỵ: 'y',
  Á: 'A', Ắ: 'Ă', Ấ: 'Â', É: 'E', Ế: 'Ê', Í: 'I', Ó: 'O', Ố: 'Ô', Ớ: 'Ơ', Ú: 'U', Ứ: 'Ư', Ý: 'Y',
  À: 'A', Ằ: 'Ă', Ầ: 'Â', È: 'E', Ề: 'Ê', Ì: 'I', Ò: 'O', Ồ: 'Ô', Ờ: 'Ơ', Ù: 'U', Ừ: 'Ư', Ỳ: 'Y',
  Ả: 'A', Ẳ: 'Ă', Ẩ: 'Â', Ẻ: 'E', Ể: 'Ê', Ỉ: 'I', Ỏ: 'O', Ổ: 'Ô', Ở: 'Ơ', Ủ: 'U', Ử: 'Ư', Ỷ: 'Y',
  Ã: 'A', Ẵ: 'Ă', Ẫ: 'Â', Ẽ: 'E', Ễ: 'Ê', Ĩ: 'I', Õ: 'O', Ỗ: 'Ô', Ỡ: 'Ơ', Ũ: 'U', Ữ: 'Ư', Ỹ: 'Y',
  Ạ: 'A', Ặ: 'Ă', Ậ: 'Â', Ẹ: 'E', Ệ: 'Ê', Ị: 'I', Ọ: 'O', Ộ: 'Ô', Ợ: 'Ơ', Ụ: 'U', Ự: 'Ư', Ỵ: 'Y',
};

export const DrawScreen: React.FC<DrawScreenProps> = ({ session, template, onConfirmDraw, onBackToTemplate }) => {
  const [activeMode, setActiveMode] = useState<'draw' | 'text' | 'stamp'>('draw');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState<string>('#1A1A1A');
  const [brushSize, setBrushSize] = useState<number>(6);
  const [drawHistory, setDrawHistory] = useState<ImageData[]>([]);
  const [redoHistory, setRedoHistory] = useState<ImageData[]>([]);

  // Configured Pending Text Settings
  const [pendingText, setPendingText] = useState<string>('Kỷ Niệm Hội An');
  const [pendingFont, setPendingFont] = useState<string>(FONT_OPTIONS[0].value);
  const [pendingColor, setPendingColor] = useState<string>('#1A1A1A');
  const [pendingSize, setPendingSize] = useState<number>(32);

  // Custom Text Items (STRICT MAX 5 items, MAX 20 chars per item)
  const [textItems, setTextItems] = useState<CustomTextItem[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const lastTextTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  // Touchscreen White Virtual Keyboard State (ABC / 123 Modes)
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState<boolean>(true);
  const [keyboardMode, setKeyboardMode] = useState<'ABC' | '123'>('ABC');
  const [isUpperCase, setIsUpperCase] = useState<boolean>(true);

  // Heritage Stamp / Sticker Items (Max 5 items)
  const [stampItems, setStampItems] = useState<StampItem[]>([]);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);

  // Dragging State for Touch & Mouse repositioning
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'text' | 'stamp' | null>(null);

  const isLandscape = template.orientation === 'landscape';
  const isStrip = isStripTemplate(template);

  const aspectClass = isLandscape
    ? 'aspect-[3/2] h-[48vh] xl:h-[52vh] w-auto'
    : isStrip
    ? 'aspect-[1/3] h-[64vh] xl:h-[70vh] w-auto'
    : 'aspect-[2/3] h-[64vh] xl:h-[70vh] w-auto';

  const canvasWidth = isLandscape ? 2700 : isStrip ? 900 : 1800;
  const canvasHeight = isLandscape ? 1800 : 2700;

  // Check if point (x, y) falls inside any photo slot to PREVENT drawing over photos
  const isInsidePhotoSlot = (canvasX: number, canvasY: number, cW: number, cH: number) => {
    return template.slots.some((slot) => {
      const sx = (slot.x / 100) * cW;
      const sy = (slot.y / 100) * cH;
      const sw = (slot.width / 100) * cW;
      const sh = (slot.height / 100) * cH;
      return canvasX >= sx && canvasX <= sx + sw && canvasY >= sy && canvasY <= sy + sh;
    });
  };

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

  // Double-tap/click to edit text item & open virtual keyboard on touchscreen
  const handleEditItemText = (item: CustomTextItem) => {
    setSelectedTextId(item.id);
    setActiveMode('text');
    setShowVirtualKeyboard(true);
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
        textInputRef.current.select();
      }
    }, 50);
  };

  const handleTouchStartTextItem = (item: CustomTextItem, e: React.TouchEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const timeDiff = now - lastTextTapRef.current.time;
    const isSameItem = lastTextTapRef.current.id === item.id;

    if (isSameItem && timeDiff > 30 && timeDiff < 480) {
      // Double tap detected on touchscreen!
      lastTextTapRef.current = { id: '', time: 0 };
      setDraggingId(null);
      setDragType(null);
      handleEditItemText(item);
      return;
    }

    // First tap: set ref and initiate selection + drag
    lastTextTapRef.current = { id: item.id, time: now };
    setSelectedTextId(item.id);
    setDraggingId(item.id);
    setDragType('text');
  };

  // Dedicated function to add text line ONLY when clicking "+ THÊM DÒNG CHỮ" button
  const handleAddTextLine = () => {
    if (textItems.length >= 5) {
      alert('Đã đạt tối đa 5 ô chữ!');
      return;
    }

    const sanitized = (pendingText || 'Kỷ Niệm Hội An').slice(0, 20);
    const newId = `text_${Date.now()}`;
    const offsetY = Math.max(15, 82 - textItems.length * 7);

    const newItem: CustomTextItem = {
      id: newId,
      text: sanitized,
      x: 50,
      y: offsetY,
      fontFamily: pendingFont,
      fontLabel: FONT_OPTIONS.find((f) => f.value === pendingFont)?.label || 'Serif',
      color: pendingColor,
      fontSize: pendingSize,
      scale: 1.0,
    };

    setTextItems((prev) => [...prev, newItem]);
    setSelectedTextId(newId);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (activeMode !== 'draw') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    if (isInsidePhotoSlot(x, y, canvas.width, canvas.height)) {
      return;
    }

    // Save history state before drawing stroke & clear redo history
    const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setDrawHistory((prev) => [...prev, currentImageData]);
    setRedoHistory([]);

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = brushColor;
    const strokeScale = rect.width ? canvas.width / rect.width : canvas.width / 900;
    ctx.lineWidth = brushSize * strokeScale;
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeMode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    if (isInsidePhotoSlot(x, y, canvas.width, canvas.height)) {
      setIsDrawing(false);
      return;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Dragging Text / Stamps Handler
  const handleContainerPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!draggingId || !cardContainerRef.current) return;
    const rect = cardContainerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const pctX = Math.min(92, Math.max(8, ((clientX - rect.left) / rect.width) * 100));
    const pctY = Math.min(95, Math.max(5, ((clientY - rect.top) / rect.height) * 100));

    if (dragType === 'text') {
      setTextItems((prev) => prev.map((item) => (item.id === draggingId ? { ...item, x: pctX, y: pctY } : item)));
    } else if (dragType === 'stamp') {
      setStampItems((prev) => prev.map((item) => (item.id === draggingId ? { ...item, x: pctX, y: pctY } : item)));
    }
  };

  const handleStopDrag = () => {
    setDraggingId(null);
    setDragType(null);
  };

  const handleAddStamp = (stamp: (typeof HERITAGE_STAMPS)[0]) => {
    if (stampItems.length >= 5) {
      alert('Tối đa 5 Sticker trên khung ảnh!');
      return;
    }
    const newId = `stamp_${Date.now()}`;
    const newStamp: StampItem = {
      id: newId,
      emoji: stamp.emoji,
      label: stamp.label,
      x: 50 + (stampItems.length * 6 - 12),
      y: isLandscape ? 85 : 90,
      size: 44,
      scale: 1.0,
    };
    setStampItems((prev) => [...prev, newStamp]);
    setSelectedStampId(newId);
    setActiveMode('stamp');
  };

  const handleUpdateStampScale = (id: string, scaleDelta: number) => {
    setStampItems((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const newScale = Math.min(2.5, Math.max(0.5, (s.scale || 1.0) + scaleDelta));
        return { ...s, scale: newScale };
      })
    );
  };

  const handleDeleteStamp = (id: string) => {
    setStampItems((prev) => prev.filter((s) => s.id !== id));
    if (selectedStampId === id) setSelectedStampId(null);
  };

  const handleClearAllStickers = () => {
    setStampItems([]);
    setSelectedStampId(null);
  };

  // Freehand Draw Undo
  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || drawHistory.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setRedoHistory((prev) => [...prev, currentState]);

    const previousState = drawHistory[drawHistory.length - 1];
    ctx.putImageData(previousState, 0, 0);
    setDrawHistory((prev) => prev.slice(0, -1));
  };

  // Freehand Draw Redo
  const handleRedo = () => {
    const canvas = canvasRef.current;
    if (!canvas || redoHistory.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setDrawHistory((prev) => [...prev, currentState]);

    const nextState = redoHistory[redoHistory.length - 1];
    ctx.putImageData(nextState, 0, 0);
    setRedoHistory((prev) => prev.slice(0, -1));
  };

  // Clear Draw Only
  const handleClearDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawHistory([]);
    setRedoHistory([]);
  };

  // Clear All Text Only
  const handleClearAllText = () => {
    setTextItems([]);
    setSelectedTextId(null);
  };

  // Reset Everything
  const handleResetAll = () => {
    handleClearDrawing();
    handleClearAllText();
    handleClearAllStickers();
  };

  const handleUpdateText = (
    id: string,
    newText?: string,
    newFont?: string,
    newColor?: string,
    newSize?: number,
    scaleDelta?: number
  ) => {
    setTextItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const textVal = newText !== undefined ? newText.slice(0, 20) : item.text;
        const newScale = scaleDelta ? Math.min(2.5, Math.max(0.5, item.scale + scaleDelta)) : item.scale;
        return {
          ...item,
          text: textVal,
          fontFamily: newFont || item.fontFamily,
          color: newColor || item.color,
          fontSize: newSize || item.fontSize,
          scale: newScale,
        };
      })
    );
  };

  const handleDeleteText = (id: string) => {
    setTextItems((prev) => prev.filter((item) => item.id !== id));
    if (selectedTextId === id) {
      setSelectedTextId(null);
    }
  };

  // Standard Vietnamese Modern Telex Typing Engine
  const applyModernTelex = (text: string, keyChar: string): string => {
    if (keyChar === 'BACKSPACE') return text.slice(0, -1);
    if (keyChar === 'CLEAR') return '';
    if (keyChar === 'SPACE') return text.length < 20 ? text + ' ' : text;

    const k = keyChar.toLowerCase();

    // 1. Check double keys (aa -> â, ee -> ê, oo -> ô, dd -> đ, aw/ow/uw -> ă/ơ/ư)
    if (['a', 'e', 'o', 'd', 'w'].includes(k)) {
      const lastChar = text.slice(-1);
      if (k === 'a' && (lastChar === 'a' || lastChar === 'A')) {
        return text.slice(0, -1) + (lastChar === 'A' ? 'Â' : 'â');
      }
      if (k === 'e' && (lastChar === 'e' || lastChar === 'E')) {
        return text.slice(0, -1) + (lastChar === 'E' ? 'Ê' : 'ê');
      }
      if (k === 'o' && (lastChar === 'o' || lastChar === 'O')) {
        return text.slice(0, -1) + (lastChar === 'O' ? 'Ô' : 'ô');
      }
      if (k === 'd' && (lastChar === 'd' || lastChar === 'D')) {
        return text.slice(0, -1) + (lastChar === 'D' ? 'Đ' : 'đ');
      }
      if (k === 'w') {
        if (lastChar === 'a' || lastChar === 'A') return text.slice(0, -1) + (lastChar === 'A' ? 'Ă' : 'ă');
        if (lastChar === 'o' || lastChar === 'O') return text.slice(0, -1) + (lastChar === 'O' ? 'Ơ' : 'ơ');
        if (lastChar === 'u' || lastChar === 'U') return text.slice(0, -1) + (lastChar === 'U' ? 'Ư' : 'ư');
      }
    }

    // 2. Check Telex accents (s, f, r, x, j)
    if (['s', 'f', 'r', 'x', 'j'].includes(k)) {
      const words = text.split(' ');
      const lastWord = words[words.length - 1];
      if (lastWord) {
        for (let i = lastWord.length - 1; i >= 0; i--) {
          const ch = lastWord[i];
          if (TELEX_ACCENT_MAP[k]?.[ch]) {
            const newCh = TELEX_ACCENT_MAP[k][ch];
            words[words.length - 1] = lastWord.slice(0, i) + newCh + lastWord.slice(i + 1);
            return words.join(' ');
          }
        }
      }
    }

    // 3. Remove accent if 'z' is pressed
    if (k === 'z') {
      const words = text.split(' ');
      const lastWord = words[words.length - 1];
      if (lastWord) {
        for (let i = lastWord.length - 1; i >= 0; i--) {
          const ch = lastWord[i];
          if (UNACCENT_MAP[ch]) {
            words[words.length - 1] = lastWord.slice(0, i) + UNACCENT_MAP[ch] + lastWord.slice(i + 1);
            return words.join(' ');
          }
        }
      }
    }

    // 4. Default: append character
    if (text.length >= 20) return text;
    const finalChar = keyboardMode === 'ABC' && !isUpperCase ? keyChar.toLowerCase() : keyChar;
    return (text + finalChar).slice(0, 20);
  };

  // Virtual Keyboard Key Press Handler
  const handleVirtualKeyPress = (key: string) => {
    const selectedTextObj = textItems.find((item) => item.id === selectedTextId);
    const currentVal = selectedTextObj ? selectedTextObj.text : pendingText;

    const nextVal = applyModernTelex(currentVal, key);

    if (selectedTextObj) {
      handleUpdateText(selectedTextObj.id, nextVal);
    } else {
      setPendingText(nextVal);
    }
  };

  const handleDone = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      onConfirmDraw('');
      return;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Helper function to format valid Canvas 2D CSS font shorthand
      const formatCanvasFont = (fontSpec: string, targetPx: number): string => {
        const isItalic = fontSpec.includes('italic');
        const isBold = fontSpec.includes('bold');
        const stylePrefix = [isItalic ? 'italic' : '', isBold ? 'bold' : ''].filter(Boolean).join(' ');

        // Extract family name: strip out italic/bold/normal and any "36px" size specification
        const cleanFamily = fontSpec
          .replace(/italic|bold|normal/g, '')
          .replace(/\d+px/g, '')
          .trim() || '"Plus Jakarta Sans", sans-serif';

        const prefix = stylePrefix ? `${stylePrefix} ` : '';
        return `${prefix}${targetPx}px ${cleanFamily}`;
      };

      const cardRect = cardContainerRef.current?.getBoundingClientRect();
      const cardWidth = cardRect?.width || 800;
      const scaleFactor = canvas.width / cardWidth;

      // Bake stickers onto canvas before exporting toDataURL
      stampItems.forEach((stamp) => {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const effectiveSize = Math.round((stamp.size || 44) * (stamp.scale || 1.0) * scaleFactor);
        ctx.font = `${effectiveSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        const sx = (stamp.x / 100) * canvas.width;
        const sy = (stamp.y / 100) * canvas.height;
        ctx.fillText(stamp.emoji, sx, sy);
        ctx.restore();
      });

      // Bake custom text items onto canvas before exporting toDataURL
      textItems.forEach((item) => {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = item.color;
        const effectiveSize = Math.round((item.fontSize || 32) * (item.scale || 1.0) * scaleFactor);
        ctx.font = formatCanvasFont(item.fontFamily || 'sans-serif', effectiveSize);
        const tx = (item.x / 100) * canvas.width;
        const ty = (item.y / 100) * canvas.height;
        ctx.fillText(item.text, tx, ty);
        ctx.restore();
      });
    }

    const drawDataUrl = canvas.toDataURL('image/png');
    onConfirmDraw(drawDataUrl);
  };

  const selectedTextObj = textItems.find((item) => item.id === selectedTextId);
  const selectedStampObj = stampItems.find((item) => item.id === selectedStampId);

  return (
    <div
      onMouseMove={handleContainerPointerMove}
      onMouseUp={handleStopDrag}
      onTouchMove={handleContainerPointerMove}
      onTouchEnd={handleStopDrag}
      className="w-full h-screen flex flex-col justify-between px-4 py-3 sm:px-8 sm:py-5 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-hidden relative"
    >
      {/* Top Header */}
      <div className="w-full max-w-[98%] mx-auto flex flex-col items-center text-center mb-1">
        <h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]">TRANG TRÍ KHUNG ẢNH</h2>
        <p className="text-xs sm:text-sm opacity-75 mt-0.5 font-sans">
          Vẽ nét cá nhân, chạm 2 lần vào chữ để sửa, dán Sticker và gõ tiếng Việt bằng bàn phím cảm ứng.
        </p>
      </div>

      {/* Main Grid: 40% Left Draw Tools / Controls & White Virtual Keyboard, 60% Right Scaled Template Preview Card */}
      <div className="w-full max-w-[98%] mx-auto flex-1 grid grid-cols-1 lg:grid-cols-10 gap-6 xl:gap-8 my-auto py-1 items-center overflow-hidden">
        {/* Left Column: Drawing, Text & Stamp Tools + White Virtual Keyboard (4/10 = 40%) */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3 justify-center">
          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-[#1A1A1A]/15 pb-2.5 gap-2">
            <button
              type="button"
              onClick={() => setActiveMode('draw')}
              className={`px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 transition-colors border cursor-pointer rounded-xs min-h-[44px] ${
                activeMode === 'draw'
                  ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A] shadow-sm'
                  : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/20 hover:border-[#1A1A1A]'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>VẼ TAY</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('text')}
              className={`px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 transition-colors border cursor-pointer rounded-xs min-h-[44px] ${
                activeMode === 'text'
                  ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A] shadow-sm'
                  : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/20 hover:border-[#1A1A1A]'
              }`}
            >
              <Type className="w-4 h-4" />
              <span>CHỮ ({textItems.length}/5)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('stamp')}
              className={`px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 transition-colors border cursor-pointer rounded-xs min-h-[44px] ${
                activeMode === 'stamp'
                  ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A] shadow-sm'
                  : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/20 hover:border-[#1A1A1A]'
              }`}
            >
              <Smile className="w-4 h-4" />
              <span>STICKER ({stampItems.length}/5)</span>
            </button>
          </div>

          {/* Draw Tools Panel */}
          {activeMode === 'draw' && (
            <div className="bg-[#F4F2EE] border border-[#1A1A1A]/15 p-4 flex flex-col gap-3 rounded-md shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1A1A1A]">
                BẢNG MÀU TÔNG PASTEL:
              </span>
              <div className="flex gap-2.5 flex-wrap">
                {PASTEL_COLORS.map((col) => (
                  <button
                    key={col.hex}
                    type="button"
                    onClick={() => setBrushColor(col.hex)}
                    style={{ backgroundColor: col.hex }}
                    title={col.name}
                    className={`w-9 h-9 rounded-full border border-[#1A1A1A]/20 cursor-pointer transition-transform shadow-xs ${
                      brushColor === col.hex ? 'scale-115 ring-4 ring-[#1A1A1A]/30 border-[#1A1A1A]' : 'hover:scale-105'
                    }`}
                  />
                ))}
              </div>

              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1A1A1A] mt-1">
                KÍCH THƯỚC NÉT VẼ:
              </span>
              <div className="flex items-center gap-2">
                {[2, 4, 8, 12].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setBrushSize(sz)}
                    className={`px-3.5 py-2 text-[11px] font-bold border cursor-pointer rounded-xs transition-colors min-h-[40px] ${
                      brushSize === sz
                        ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A] shadow-xs'
                        : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/20 hover:border-[#1A1A1A]'
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>

              {/* Freehand Draw Undo, Redo & Clear Buttons */}
              <div className="flex gap-2 mt-1 pt-2 border-t border-[#1A1A1A]/10">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={drawHistory.length === 0}
                  className={`px-3 py-2 border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 rounded-xs transition-colors min-h-[40px] ${
                    drawHistory.length > 0
                      ? 'border-[#1A1A1A]/30 bg-[#FDFCFB] text-[#1A1A1A] hover:border-[#1A1A1A] cursor-pointer'
                      : 'border-[#1A1A1A]/10 bg-gray-100 text-[#1A1A1A]/40 cursor-not-allowed'
                  }`}
                >
                  <Undo className="w-3.5 h-3.5" />
                  <span>HOÀN TÁC</span>
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoHistory.length === 0}
                  className={`px-3 py-2 border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 rounded-xs transition-colors min-h-[40px] ${
                    redoHistory.length > 0
                      ? 'border-[#1A1A1A]/30 bg-[#FDFCFB] text-[#1A1A1A] hover:border-[#1A1A1A] cursor-pointer'
                      : 'border-[#1A1A1A]/10 bg-gray-100 text-[#1A1A1A]/40 cursor-not-allowed'
                  }`}
                >
                  <Redo className="w-3.5 h-3.5" />
                  <span>LÀM LẠI</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearDrawing}
                  className="px-3 py-2 border border-[#1A1A1A]/25 bg-[#FDFCFB] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:border-[#1A1A1A] cursor-pointer rounded-xs transition-colors min-h-[40px]"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>XÓA NÉT VẼ</span>
                </button>
              </div>
            </div>
          )}

          {/* Text Tools Panel - CONFIG & CREATE TEXT LINE */}
          {activeMode === 'text' && (
            <div className="bg-[#F4F2EE] border border-[#1A1A1A]/15 p-3 flex flex-col gap-2 rounded-md shadow-xs max-h-[74vh] overflow-y-auto">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1A1A1A]">
                1. CHỌN PHÔNG CHỮ:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {FONT_OPTIONS.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => {
                      setPendingFont(font.value);
                      if (selectedTextId) handleUpdateText(selectedTextId, undefined, font.value);
                    }}
                    className={`p-1.5 text-[10px] font-bold border text-center transition-all cursor-pointer rounded-xs min-h-[34px] ${
                      (selectedTextObj ? selectedTextObj.fontFamily === font.value : pendingFont === font.value)
                        ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A] shadow-xs'
                        : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/20 hover:border-[#1A1A1A]'
                    }`}
                  >
                    {font.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1A1A1A]">
                  2. NỘI DUNG CHỮ (TỐI ĐA 20 KÝ TỰ):
                </span>
                <span className="text-[10px] font-mono font-bold text-[#1A1A1A]/70">
                  {(selectedTextObj ? selectedTextObj.text : pendingText).length}/20
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={textInputRef}
                  type="text"
                  maxLength={20}
                  onFocus={() => setShowVirtualKeyboard(true)}
                  value={selectedTextObj ? selectedTextObj.text : pendingText}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 20);
                    if (selectedTextObj) {
                      handleUpdateText(selectedTextObj.id, val);
                    } else {
                      setPendingText(val);
                    }
                  }}
                  placeholder="Nhập chữ kỷ niệm..."
                  className="flex-1 px-3 py-1.5 bg-white border border-[#1A1A1A]/30 font-serif text-xs font-bold rounded-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
                />
                {selectedTextObj && (
                  <button
                    type="button"
                    onClick={() => handleDeleteText(selectedTextObj.id)}
                    title="Xóa ô chữ này"
                    className="p-1.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-xs hover:bg-rose-200 cursor-pointer min-h-[34px]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Font Size & Color Configuration */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/70">CỠ:</span>
                  {FONT_SIZES.map((fs) => (
                    <button
                      key={fs.size}
                      type="button"
                      onClick={() => {
                        setPendingSize(fs.size);
                        if (selectedTextId) handleUpdateText(selectedTextId, undefined, undefined, undefined, fs.size);
                      }}
                      className={`px-1.5 py-0.5 text-[9px] font-bold border rounded-xs ${
                        (selectedTextObj ? selectedTextObj.fontSize === fs.size : pendingSize === fs.size)
                          ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A]'
                          : 'bg-white text-[#1A1A1A] border-[#1A1A1A]/20'
                      }`}
                    >
                      {fs.label}
                    </button>
                  ))}
                </div>

                {selectedTextObj && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleUpdateText(selectedTextObj.id, undefined, undefined, undefined, undefined, -0.15)}
                      title="Thu nhỏ chữ"
                      className="p-1 bg-white border border-[#1A1A1A]/20 rounded-xs hover:border-[#1A1A1A] cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateText(selectedTextObj.id, undefined, undefined, undefined, undefined, 0.15)}
                      title="Phóng to chữ"
                      className="p-1 bg-white border border-[#1A1A1A]/20 rounded-xs hover:border-[#1A1A1A] cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Color Picker */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/70">MÀU:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {PASTEL_COLORS.map((col) => (
                    <button
                      key={col.hex}
                      type="button"
                      onClick={() => {
                        setPendingColor(col.hex);
                        if (selectedTextId) handleUpdateText(selectedTextId, undefined, undefined, col.hex);
                      }}
                      style={{ backgroundColor: col.hex }}
                      title={col.name}
                      className={`w-5 h-5 rounded-full border border-[#1A1A1A]/20 cursor-pointer transition-transform ${
                        (selectedTextObj ? selectedTextObj.color === col.hex : pendingColor === col.hex)
                          ? 'scale-125 ring-2 ring-[#1A1A1A]'
                          : 'hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* EXPANDED FULL-WIDTH VIRTUAL KEYBOARD WITH MODE TOGGLE (?123 / ABC) */}
              {showVirtualKeyboard && (
                <div className="bg-white border border-[#1A1A1A]/20 p-2.5 rounded-md shadow-sm flex flex-col gap-1.5 mt-0.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-[#1A1A1A]/10 pb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A1A1A]/80 flex items-center gap-1.5">
                      <Keyboard className="w-4 h-4 text-[#10b981]" />
                      BÀN PHÍM CẢM ỨNG
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleVirtualKeyPress('CLEAR')}
                        className="px-2 py-1 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xs hover:bg-rose-100 cursor-pointer"
                      >
                        XÓA HẾT
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowVirtualKeyboard(false)}
                        className="p-1 text-gray-500 hover:text-black cursor-pointer"
                        title="Ẩn bàn phím"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 100% Full Width Keyboard Grid */}
                  <div className="flex flex-col gap-1.5 w-full mt-1">
                    {(keyboardMode === 'ABC' ? QWERTY_LETTER_ROWS : NUMBERS_SYMBOLS_ROWS).map((row, rIdx) => (
                      <div key={rIdx} className="flex justify-center gap-1">
                        {row.map((char) => (
                          <button
                            key={char}
                            type="button"
                            onClick={() => handleVirtualKeyPress(char)}
                            className="flex-1 min-w-[32px] h-10 sm:h-11 bg-[#F8F7F4] hover:bg-[#EBE8E1] active:scale-95 text-[#1A1A1A] font-bold text-sm sm:text-base rounded-xs border border-[#1A1A1A]/15 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                          >
                            {keyboardMode === 'ABC' && !isUpperCase ? char.toLowerCase() : char}
                          </button>
                        ))}
                      </div>
                    ))}

                    {/* Bottom Control Row */}
                    <div className="flex gap-1.5 mt-1">
                      {/* Mode Toggle Button */}
                      <button
                        type="button"
                        onClick={() => setKeyboardMode(keyboardMode === 'ABC' ? '123' : 'ABC')}
                        className="px-3 h-10 sm:h-11 bg-[#E8E6E1] hover:bg-[#DCD8CF] text-[#1A1A1A] font-extrabold text-xs rounded-xs border border-[#1A1A1A]/25 transition-all cursor-pointer shadow-2xs"
                      >
                        {keyboardMode === 'ABC' ? '?123' : 'ABC'}
                      </button>

                      {keyboardMode === 'ABC' && (
                        <button
                          type="button"
                          onClick={() => setIsUpperCase(!isUpperCase)}
                          className={`px-3 h-10 sm:h-11 text-[10px] font-bold uppercase rounded-xs border transition-all cursor-pointer shadow-2xs ${
                            isUpperCase
                              ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                              : 'bg-[#F8F7F4] text-[#1A1A1A] border-[#1A1A1A]/20'
                          }`}
                        >
                          SHIFT ⇧
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleVirtualKeyPress('SPACE')}
                        className="flex-1 h-10 sm:h-11 bg-[#F8F7F4] hover:bg-[#EBE8E1] text-[#1A1A1A] font-bold text-xs uppercase tracking-wider rounded-xs border border-[#1A1A1A]/20 flex items-center justify-center active:scale-98 transition-all cursor-pointer shadow-2xs"
                      >
                        DẤU CÁCH (SPACE)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleVirtualKeyPress('BACKSPACE')}
                        className="px-3 sm:px-4 h-10 sm:h-11 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs uppercase rounded-xs border border-rose-300 flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Delete className="w-4 h-4" />
                        <span>XÓA ⌫</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Text Line Button */}
              <button
                type="button"
                onClick={handleAddTextLine}
                disabled={textItems.length >= 5}
                className={`w-full py-2.5 px-4 mt-1 font-bold text-xs uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  textItems.length < 5
                    ? 'bg-[#10b981] text-white border-[#10b981] shadow-sm hover:bg-[#059669]'
                    : 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>
                  {textItems.length < 5 ? '+ THÊM DÒNG CHỮ NÀY VÀO KHUNG' : 'ĐÃ ĐẠT TỐI ĐA 5/5 Ô CHỮ'}
                </span>
              </button>

              {textItems.length > 0 && (
                <div className="pt-1.5 border-t border-[#1A1A1A]/10 flex justify-end">
                  <button
                    type="button"
                    onClick={handleClearAllText}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 rounded-xs hover:bg-rose-100 cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>XÓA TẤT CẢ CHỮ ({textItems.length}/5)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Heritage Stamps / Sticker Panel */}
          {activeMode === 'stamp' && (
            <div className="bg-[#F4F2EE] border border-[#1A1A1A]/15 p-4 flex flex-col gap-3 rounded-md shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1A1A1A]">
                BỘ STICKER DI SẢN HỘI AN:
              </span>
              <div className="grid grid-cols-4 gap-2">
                {HERITAGE_STAMPS.map((stamp) => (
                  <button
                    key={stamp.id}
                    type="button"
                    onClick={() => handleAddStamp(stamp)}
                    className="p-2 bg-white border border-[#1A1A1A]/15 rounded-xs flex flex-col items-center hover:border-[#1A1A1A] transition-transform hover:scale-105 cursor-pointer shadow-xs min-h-[50px]"
                  >
                    <span className="text-2xl">{stamp.emoji}</span>
                    <span className="text-[9px] font-bold truncate max-w-full mt-1 text-[#1A1A1A]/80">{stamp.label}</span>
                  </button>
                ))}
              </div>

              {/* Selected Sticker Controls: Zoom In, Zoom Out, Delete */}
              {selectedStampObj ? (
                <div className="flex items-center justify-between pt-2.5 border-t border-[#1A1A1A]/10 flex-wrap gap-2 animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase">KÍCH THƯỚC:</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateStampScale(selectedStampObj.id, -0.15)}
                      title="Thu nhỏ Sticker"
                      className="p-1.5 bg-white border border-[#1A1A1A]/20 rounded-xs hover:border-[#1A1A1A] cursor-pointer"
                    >
                      <ZoomOut className="w-4 h-4 text-[#1A1A1A]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStampScale(selectedStampObj.id, 0.15)}
                      title="Phóng to Sticker"
                      className="p-1.5 bg-white border border-[#1A1A1A]/20 rounded-xs hover:border-[#1A1A1A] cursor-pointer"
                    >
                      <ZoomIn className="w-4 h-4 text-[#1A1A1A]" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteStamp(selectedStampObj.id)}
                    className="px-2.5 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xs hover:bg-rose-100 cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>XÓA STICKER</span>
                  </button>
                </div>
              ) : (
                <p className="text-[10px] italic text-[#1A1A1A]/60 pt-1">
                  💡 Mẹo: Chạm vào bất kỳ Sticker nào trên ảnh để chỉnh kích thước hoặc xóa.
                </p>
              )}

              {stampItems.length > 0 && (
                <div className="pt-2 border-t border-[#1A1A1A]/10 flex justify-end">
                  <button
                    type="button"
                    onClick={handleClearAllStickers}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 rounded-xs hover:bg-rose-100 cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>XÓA TẤT CẢ STICKER ({stampItems.length}/5)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleResetAll}
            className="self-start text-[10px] font-bold uppercase tracking-[0.18em] text-[#1A1A1A]/60 hover:text-[#1A1A1A] flex items-center gap-1.5 cursor-pointer mt-0.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ĐẶT LẠI TẤT CẢ (VẼ, CHỮ, STICKER)</span>
          </button>
        </div>

        {/* Right Column: Synchronized Frame Template Card (6/10 = 60%) */}
        {(() => {
          const normalizePercent = (val: number): number => (val <= 1 && val > 0 ? val * 100 : val);
          const frameOverlay = template.assets?.overlay || (template as any).assetUrl;
          const isDark = template.assets?.background === '#1A1A1A' || template.assets?.background === '#000000';

          return (
            <div className="lg:col-span-6 xl:col-span-6 flex flex-col items-center justify-center h-full p-1">
              <div className="w-full h-full flex flex-col items-center justify-center relative">
                <div
                  ref={cardContainerRef}
                  onClick={() => {
                    setSelectedTextId(null);
                    setSelectedStampId(null);
                  }}
                  className={`${aspectClass} mx-auto relative border border-[#1A1A1A]/15 shadow-2xl overflow-hidden rounded-sm transition-all duration-300`}
                  style={{ backgroundColor: template.assets?.background || '#FDFCFB' }}
                >
                  {/* Photo Slots */}
                  {template.slots.map((slot, i) => {
                    const assignedPhoto = session.slotAssignments?.[i] || session.photos?.[i];
                    const photoUrl = assignedPhoto ? assignedPhoto.dataUrl : HOI_AN_SAMPLE_PHOTOS[i % HOI_AN_SAMPLE_PHOTOS.length];

                    return (
                      <div
                        key={slot.id || i}
                        className="absolute z-0 overflow-hidden bg-[#E8E6E1] flex items-center justify-center pointer-events-none transition-all duration-300 shadow-2xs"
                        style={{
                          left: `${normalizePercent(slot.x)}%`,
                          top: `${normalizePercent(slot.y)}%`,
                          width: `${normalizePercent(slot.width)}%`,
                          height: `${normalizePercent(slot.height)}%`,
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

                  {/* Synchronized Frame Overlay Image */}
                  {frameOverlay && (
                    <img
                      src={frameOverlay}
                      alt="Khung mẫu overlay"
                      className="absolute inset-0 z-10 h-full w-full object-contain pointer-events-none"
                    />
                  )}

                  {/* Default Branding Text if no Overlay */}
                  {!frameOverlay && (
                    <div className="absolute inset-x-0 bottom-3 text-center py-1 z-10 pointer-events-none px-2">
                      <span
                        className={`block font-serif italic text-sm sm:text-base font-bold ${
                          isDark ? 'text-[#FDFCFB]' : 'text-[#1A1A1A]'
                        }`}
                      >
                        {template.eventBranding?.text || 'PHỐ CỔ HỘI AN'}
                      </span>
                      <span
                        className={`block text-[9px] font-mono uppercase tracking-widest opacity-70 mt-0.5 ${
                          isDark ? 'text-[#FDFCFB]' : 'text-[#1A1A1A]'
                        }`}
                      >
                        {template.eventBranding?.subtext || 'Tiệm Ảnh Di Sản • 2026'}
                      </span>
                    </div>
                  )}

                  {/* Drawing Layer Canvas - Z Index 20 (Underneath Stamps & Text) */}
                  <canvas
                    ref={canvasRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className={`absolute inset-0 w-full h-full z-20 touch-none ${
                      activeMode === 'draw' ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
                    }`}
                  />

                  {/* Heritage Sticker Overlay Items - Z Index 30 (Supports Scaling & Dragging) */}
                  {stampItems.map((stamp) => (
                    <div
                      key={stamp.id}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingId(stamp.id);
                        setDragType('stamp');
                        setSelectedStampId(stamp.id);
                        setActiveMode('stamp');
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStampId(stamp.id);
                        setActiveMode('stamp');
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        setDraggingId(stamp.id);
                        setDragType('stamp');
                        setSelectedStampId(stamp.id);
                        setActiveMode('stamp');
                      }}
                      style={{
                        left: `${stamp.x}%`,
                        top: `${stamp.y}%`,
                        transform: `translate(-50%, -50%) scale(${stamp.scale || 1.0})`,
                        fontSize: `${stamp.size || 44}px`,
                        lineHeight: 1,
                      }}
                      className={`absolute z-30 cursor-grab active:cursor-grabbing select-none p-1 transition-transform ${
                        stamp.id === selectedStampId ? 'ring-2 ring-[#f59e0b] bg-white/90 rounded-md shadow-md scale-110' : 'hover:scale-105'
                      }`}
                    >
                      {stamp.emoji}
                    </div>
                  ))}

                  {/* Custom Text Overlay Items - Z Index 40 (Top Layer - 100% Transparent Background) */}
                  {textItems.map((item) => {
                    const isItalic = item.fontFamily?.includes('italic');
                    const isBold = item.fontFamily?.includes('bold');
                    const cleanFamily = item.fontFamily
                      ?.replace(/italic|bold|normal/g, '')
                      .replace(/\d+px/g, '')
                      .trim() || '"Plus Jakarta Sans", sans-serif';

                    return (
                      <div
                        key={item.id}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDraggingId(item.id);
                          setDragType('text');
                          setSelectedTextId(item.id);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTextId(item.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleEditItemText(item);
                        }}
                        onTouchStart={(e) => handleTouchStartTextItem(item, e)}
                        style={{
                          left: `${item.x}%`,
                          top: `${item.y}%`,
                          transform: `translate(-50%, -50%) scale(${item.scale || 1.0})`,
                          color: item.color,
                        }}
                        className={`absolute z-40 cursor-grab active:cursor-grabbing font-bold select-none px-1 py-0.5 transition-all flex items-center gap-1 bg-transparent ${
                          item.id === selectedTextId
                            ? 'ring-1 ring-[#10b981] ring-offset-1 rounded-xs scale-[1.02]'
                            : 'hover:scale-105'
                        }`}
                      >
                        {item.id === selectedTextId && <Move className="w-3 h-3 opacity-50 text-[#10b981]" />}
                        <span
                          className="block whitespace-nowrap"
                          style={{
                            fontFamily: cleanFamily,
                            fontStyle: isItalic ? 'italic' : 'normal',
                            fontWeight: isBold ? 'bold' : 'normal',
                            fontSize: `${item.fontSize || 32}px`,
                            lineHeight: 1,
                          }}
                        >
                          {item.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Shared Bottom Action Bar */}
      <GuestBottomNavigation
        onBack={onBackToTemplate}
        backText="QUAY LẠI MẪU"
        onNext={handleDone}
        nextText="HOÀN TẤT (XEM THÀNH PHẨM)"
        nextIcon="check"
      />
    </div>
  );
};
