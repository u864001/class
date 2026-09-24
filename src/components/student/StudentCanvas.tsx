import React, { useRef, useState, useEffect } from 'react';
import { Undo2, Trash2, Camera, Palette, Check } from 'lucide-react';

interface StudentCanvasProps {
  bgImageUrl?: string | null;
  disabled?: boolean;
  onSaveCanvas: (canvas: HTMLCanvasElement) => void;
}

export const StudentCanvas: React.FC<StudentCanvasProps> = ({
  bgImageUrl,
  disabled = false,
  onSaveCanvas,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState('#4f46e5'); // Modern Indigo
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState<ImageData[]>([]);
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);

  // Initialize Canvas with Retina Display (devicePixelRatio) scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 360;
    const height = rect.height || 360;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Default white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // If background image provided, draw it centered
    if (bgImageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        saveState();
      };
      img.src = bgImageUrl;
    } else {
      saveState();
    }
  }, [bgImageUrl]);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-15), imgData]);
    onSaveCanvas(canvas);
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nextHistory = [...history];
    nextHistory.pop(); // Pop current
    const previous = nextHistory[nextHistory.length - 1];
    ctx.putImageData(previous, 0, 0);
    setHistory(nextHistory);
    onSaveCanvas(canvas);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    saveState();
  };

  // Get position relative to canvas display size
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pos = getPos(e);
    pointsRef.current = [pos];
  };

  // Draw with smooth quadratic Bezier curves
  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e);
    pointsRef.current.push(pos);

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (pointsRef.current.length >= 3) {
      const len = pointsRef.current.length;
      const p1 = pointsRef.current[len - 3];
      const p2 = pointsRef.current[len - 2];
      const p3 = pointsRef.current[len - 1];

      ctx.beginPath();
      ctx.moveTo((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
      ctx.quadraticCurveTo(p2.x, p2.y, (p2.x + p3.x) / 2, (p2.y + p3.y) / 2);
      ctx.stroke();
    }
  };

  const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    pointsRef.current = [];
    saveState();
  };

  const colors = [
    { label: '靛藍', hex: '#4f46e5' },
    { label: '深灰', hex: '#1e293b' },
    { label: '珊瑚紅', hex: '#ef4444' },
    { label: '翠綠', hex: '#10b981' },
    { label: '琥珀', hex: '#f59e0b' },
  ];

  return (
    <div className="flex flex-col items-center w-full space-y-3">
      {/* Canvas Frame */}
      <div className="relative w-full aspect-square max-w-[420px] rounded-3xl overflow-hidden border-2 border-slate-200/80 bg-white shadow-soft touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          className="w-full h-full cursor-crosshair"
        />
        {disabled && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-xs flex items-center justify-center font-bold text-slate-500 text-sm">
            作答已鎖定
          </div>
        )}
      </div>

      {/* Modern Palette & Stroke Toolbar */}
      <div className="flex items-center justify-between w-full max-w-[420px] px-3 py-2.5 rounded-2xl glass-panel shadow-xs border border-white/60">
        {/* Color Dots */}
        <div className="flex items-center space-x-2">
          {colors.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setColor(c.hex)}
              className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center shadow-xs ${
                color === c.hex ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c.hex }}
            >
              {color === c.hex && <Check className="w-3.5 h-3.5 text-white" />}
            </button>
          ))}
        </div>

        {/* Action Buttons: Undo & Clear */}
        <div className="flex items-center space-x-1.5 border-l border-slate-200 pl-3">
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length <= 1 || disabled}
            title="復原上一步"
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            title="清空畫布"
            className="p-2 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-30 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
