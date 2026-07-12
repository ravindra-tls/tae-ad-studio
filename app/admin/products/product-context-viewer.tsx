'use client';

import { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Pencil, X, Check, Plus, Trash2, Loader2, Info, Camera, ImageOff, BookOpen, RefreshCw } from 'lucide-react';
import type { Product, ProductContext, Ingredient, Claim, ColorEntry } from '@/types';
import { updateProduct, deleteProduct, uploadProductThumbnail, seedProductThumbnails, createProduct } from './actions';
import type { ProductUpdatePayload, ProductCreatePayload } from './actions';
import ProductSynthesizeModal from '@/components/ProductSynthesizeModal';
import { ForgeDeckPanel } from './forge-deck-panel';
import type { ProductDeckRow } from './forge-deck-panel';
import type { ResearchRow } from './page';
import type { PositioningResearch } from '@/lib/research/types';

// ─────────────────────────────────────────────────────────────────────────────
// Colour conversion helpers
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full  = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return isNaN(n) ? { r: 0, g: 0, b: 0 } : { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

function hsbToRgb(h: number, s: number, b: number): { r: number; g: number; b: number } {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return b - b * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255) };
}

function rgbToHsb(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: h * 60, s: max === 0 ? 0 : d / max, b: max };
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft type
// ─────────────────────────────────────────────────────────────────────────────

type Draft = {
  name: string;
  sub_brand: string;
  prompt_modifier: string;
  compliance_rules: string[];
  ingredients: Ingredient[];
  claims: Claim[];
  color_palette: ColorEntry[];
  context: ProductContext;
  thumbnail_url: string;
};

const EMPTY_CONTEXT: ProductContext = {
  primary_color:    { name: '', hex: '#000000' },
  accent_color:     { name: '', hex: '#000000' },
  contrast_color:   { name: '', hex: '#000000' },
  tint_color:       { name: '', hex: '#000000' },
  dark_color:       { name: '', hex: '#000000' },
  background_color: { name: '', hex: '#ffffff' },
  tagline: '', product_description: '', product_category: '',
  price: '', website: '', target_audience: '', market_flag: '',
  benefits: [], stats: [], review_count: '', social_proof: '',
  before_state: '', after_state: '', timeframe: '',
  surface: '', setting: '', mood: '',
  cta: '', short_headline: '', hero_headline: '', educational_hook: '',
  testimonials: [],
};

// Returns true when a stored color is an empty/default placeholder (name='', hex='#000000').
// We treat these as "not set" and fall back to color_palette values.
function isEmptyColor(c: { name: string; hex: string } | undefined | null): boolean {
  if (!c) return true;
  return c.hex === '#000000' && c.name === '';
}

// Resolve a context color, falling back to the palette entry when the context
// value is absent or is an uninitialised EMPTY_CONTEXT placeholder.
function resolveCtxColor(
  ctxColor: { name: string; hex: string } | undefined | null,
  paletteEntry: { name: string; hex: string } | undefined,
  fallback: { name: string; hex: string },
): { name: string; hex: string } {
  if (!isEmptyColor(ctxColor)) return ctxColor!;
  if (paletteEntry && !isEmptyColor(paletteEntry)) return { name: paletteEntry.name, hex: paletteEntry.hex };
  return fallback;
}

function toDraft(p: Product): Draft {
  const ctx = (p.context ?? {}) as Partial<ProductContext>;
  const cp  = p.color_palette ?? [];

  return {
    name:             p.name,
    sub_brand:        p.sub_brand ?? '',
    prompt_modifier:  p.prompt_modifier ?? '',
    compliance_rules: p.compliance_rules ?? [],
    ingredients:      p.ingredients ?? [],
    claims:           p.claims ?? [],
    color_palette:    cp,
    context: {
      ...EMPTY_CONTEXT,
      ...ctx,
      // Use resolveCtxColor so stored '#000000'/blank placeholders fall back to color_palette
      primary_color:    resolveCtxColor(ctx.primary_color,    cp[0], EMPTY_CONTEXT.primary_color!),
      accent_color:     resolveCtxColor(ctx.accent_color,     cp[1], EMPTY_CONTEXT.accent_color!),
      contrast_color:   resolveCtxColor(ctx.contrast_color,   cp[2], EMPTY_CONTEXT.contrast_color!),
      tint_color:       resolveCtxColor(ctx.tint_color,       cp[3], EMPTY_CONTEXT.tint_color!),
      dark_color:       resolveCtxColor(ctx.dark_color,       cp[4], EMPTY_CONTEXT.dark_color!),
      background_color: resolveCtxColor(ctx.background_color, cp[5], EMPTY_CONTEXT.background_color!),
    } as ProductContext,
    thumbnail_url:    p.thumbnail_url ?? '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Input primitives
// ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  'w-full text-xs text-brand-navy bg-brand-cream/60 border border-brand-sage/30 rounded px-2 py-1.5 focus:outline-none focus:border-brand-forest/50 focus:bg-white transition-colors';
const textareaCls = inputCls + ' resize-none leading-relaxed';

function EInput({
  value, onChange, placeholder, className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      className={cn(inputCls, className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? '—'}
    />
  );
}

function ETextarea({
  value, onChange, rows = 3, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      className={textareaCls}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? '—'}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section (collapsible)
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title, badge, children, defaultOpen = true,
}: {
  title: string;
  badge?: string | number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-brand-sage/20 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 border-b border-brand-sage/20 hover:bg-brand-cream/40 transition-colors duration-100"
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown  className="h-3.5 w-3.5 text-brand-slate/50" />
            : <ChevronRight className="h-3.5 w-3.5 text-brand-slate/50" />}
          <span className="text-xs font-semibold text-brand-forest tracking-wide uppercase">{title}</span>
        </div>
        {badge !== undefined && (
          <span className="text-[10px] font-medium text-brand-slate bg-brand-cream px-1.5 py-0.5 rounded">{badge}</span>
        )}
      </button>
      {open && <div className="divide-y divide-brand-sage/10">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InfoTip — hover tooltip for field usage hints
// ─────────────────────────────────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={() => setRect(btnRef.current?.getBoundingClientRect() ?? null)}
        onMouseLeave={() => setRect(null)}
        className="inline-flex items-center shrink-0 outline-none"
      >
        <Info className="h-3 w-3 text-brand-slate/25 hover:text-brand-forest/50 cursor-help transition-colors" />
      </button>

      {/* Portal — renders at document.body, bypasses overflow:hidden */}
      {rect && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] w-56 rounded-lg bg-brand-forest text-white text-[10px] leading-relaxed px-3 py-2 shadow-xl whitespace-normal pointer-events-none"
          style={{
            top:  rect.top - 8,
            left: rect.left + rect.width / 2,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-brand-forest" />
        </div>,
        document.body,
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row — view OR edit
// ─────────────────────────────────────────────────────────────────────────────

function Row({
  label, value, empty, mono, editMode, onEdit, multiline, info,
}: {
  label: string;
  value?: string | null;
  empty?: string;
  mono?: boolean;
  editMode?: boolean;
  onEdit?: (v: string) => void;
  multiline?: boolean;
  info?: string;
}) {
  const isEmpty = !value;
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <div className="w-36 shrink-0 flex items-center gap-1 pt-0.5">
        <span className="text-[11px] font-medium text-brand-slate/60 leading-tight">{label}</span>
        {info && <InfoTip text={info} />}
      </div>
      {editMode && onEdit ? (
        multiline
          ? <ETextarea value={value ?? ''} onChange={onEdit} rows={2} />
          : <EInput value={value ?? ''} onChange={onEdit} />
      ) : (
        <span className={cn('text-xs leading-relaxed flex-1', isEmpty ? 'text-brand-sage/60 italic' : 'text-brand-navy', mono && 'font-mono')}>
          {isEmpty ? (empty ?? '—') : value}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom colour picker popover (no native <input type="color">)
// ─────────────────────────────────────────────────────────────────────────────

function ColorPickerPopover({
  hex,
  anchor,
  onChange,
  onClose,
}: {
  hex: string;
  anchor: DOMRect;
  onChange: (hex: string) => void;
  onClose: () => void;
}) {
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#7b1e1e';
  const init    = (() => { const { r, g, b } = hexToRgb(safeHex); return rgbToHsb(r, g, b); })();

  const [hue,  setHue]  = useState(init.h);
  const [sat,  setSat]  = useState(init.s);
  const [bri,  setBri]  = useState(init.b);
  const [drag, setDrag] = useState(false);

  // Sync picker position when hex is changed from outside (typing in the hex/RGB inputs)
  useEffect(() => {
    if (drag) return; // don't override while the user is actively dragging
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const { r, g, b } = hexToRgb(hex);
    const hsb = rgbToHsb(r, g, b);
    setHue(hsb.h);
    setSat(hsb.s);
    setBri(hsb.b);
  }, [hex]); // eslint-disable-line react-hooks/exhaustive-deps

  const boxRef  = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const emit = useCallback((h: number, s: number, b: number) => {
    const rgb = hsbToRgb(h, s, b);
    onChange(rgbToHex(rgb.r, rgb.g, rgb.b));
  }, [onChange]);

  // Close on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [onClose]);

  const pickFromBox = (e: React.PointerEvent) => {
    if (!boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const b = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    setSat(s); setBri(b); emit(hue, s, b);
  };

  const hueHex = `hsl(${hue}, 100%, 50%)`;

  // Flip upward if not enough space below
  const spaceBelow = window.innerHeight - anchor.bottom;
  const pickerH    = 260; // approximate height
  const top  = spaceBelow > pickerH ? anchor.bottom + 6 : anchor.top - pickerH - 6;
  const left = Math.min(anchor.left, window.innerWidth - 232); // keep within viewport

  return createPortal(
    <div
      ref={rootRef}
      className="fixed z-[9998] w-56 rounded-xl border border-brand-sage/20 bg-white shadow-2xl p-3 space-y-3"
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Saturation / Brightness 2-D field */}
      <div
        ref={boxRef}
        className="relative h-36 w-full rounded-lg cursor-crosshair select-none"
        style={{
          background: `linear-gradient(to top, #000, transparent),
                       linear-gradient(to right, #fff, transparent),
                       ${hueHex}`,
        }}
        onPointerDown={(e) => {
          setDrag(true);
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          pickFromBox(e);
        }}
        onPointerMove={(e) => { if (drag) pickFromBox(e); }}
        onPointerUp={() => setDrag(false)}
      >
        {/* Cursor ring */}
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{
            left: `${sat * 100}%`,
            top:  `${(1 - bri) * 100}%`,
            backgroundColor: hex,
          }}
        />
      </div>

      {/* Hue strip */}
      <div className="relative h-3 rounded-full select-none" style={{
        background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
      }}>
        {/* Invisible range for keyboard / scroll */}
        <input
          type="range" min={0} max={360} step={1} value={Math.round(hue)}
          onChange={(e) => { const h = Number(e.target.value); setHue(h); emit(h, sat, bri); }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        {/* Visible thumb */}
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${(hue / 360) * 100}%`, backgroundColor: hueHex }}
        />
      </div>

      {/* Current preview */}
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-md border border-brand-sage/20 shrink-0" style={{ backgroundColor: hex }} />
        <span className="text-[11px] font-mono text-brand-navy tracking-wide">{hex.toUpperCase()}</span>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Color row — single line: [swatch] [code] [name] [HEX|RGB]
// ─────────────────────────────────────────────────────────────────────────────

function ColorRow({
  label, color, editMode, onEdit, info,
}: {
  label: string;
  color?: { name: string; hex: string } | null;
  editMode?: boolean;
  onEdit?: (c: { name: string; hex: string }) => void;
  info?: string;
}) {
  const [mode,        setMode]        = useState<'hex' | 'rgb'>('hex');
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [swatchRect,  setSwatchRect]  = useState<DOMRect | null>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);

  const openPicker = () => {
    setSwatchRect(swatchRef.current?.getBoundingClientRect() ?? null);
    setPickerOpen(true);
  };

  if (editMode && onEdit) {
    const c       = color ?? { name: '', hex: '#000000' };
    const safeHex = /^#[0-9a-fA-F]{3,6}$/.test(c.hex) ? c.hex : '#000000';
    const rgb     = hexToRgb(safeHex);

    const handleRgb = (ch: 'r' | 'g' | 'b', val: string) => {
      const n = Math.min(255, Math.max(0, parseInt(val) || 0));
      onEdit({ ...c, hex: rgbToHex(ch === 'r' ? n : rgb.r, ch === 'g' ? n : rgb.g, ch === 'b' ? n : rgb.b) });
    };

    return (
      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* Label */}
        <div className="w-28 shrink-0 flex items-center gap-1">
          <span className="text-[11px] font-medium text-brand-slate/60">{label}</span>
          {info && <InfoTip text={info} />}
        </div>

        {/* Colour swatch — opens custom picker */}
        <button
          ref={swatchRef}
          type="button"
          onClick={() => pickerOpen ? setPickerOpen(false) : openPicker()}
          className="h-7 w-7 shrink-0 rounded-md border-2 border-brand-sage/30 hover:border-brand-forest/40 transition-colors shadow-sm"
          style={{ backgroundColor: safeHex }}
          title="Open colour picker"
        />

        {/* Custom picker popover — portal, bypasses overflow:hidden */}
        {pickerOpen && swatchRect && (
          <ColorPickerPopover
            hex={safeHex}
            anchor={swatchRect}
            onChange={(hex) => onEdit({ ...c, hex })}
            onClose={() => setPickerOpen(false)}
          />
        )}

        {/* Code input — HEX or RGB */}
        {mode === 'hex' ? (
          <input
            value={c.hex}
            onChange={(e) => {
              const v = e.target.value;
              onEdit({ ...c, hex: v.startsWith('#') ? v : '#' + v });
            }}
            placeholder="#rrggbb"
            className={cn(inputCls, 'w-28 font-mono shrink-0')}
          />
        ) : (
          <div className="flex gap-1 shrink-0">
            {(['r', 'g', 'b'] as const).map((ch) => (
              <input
                key={ch}
                type="number" min={0} max={255}
                value={rgb[ch]}
                onChange={(e) => handleRgb(ch, e.target.value)}
                className={cn(inputCls, 'w-14 font-mono text-center')}
                title={ch.toUpperCase()}
              />
            ))}
          </div>
        )}

        {/* Name input */}
        <EInput
          value={c.name}
          onChange={(v) => onEdit({ ...c, name: v })}
          placeholder="Colour name"
          className="flex-1 min-w-0"
        />

        {/* HEX / RGB toggle */}
        <div className="flex shrink-0 rounded border border-brand-sage/30 overflow-hidden text-[10px] font-bold">
          {(['hex', 'rgb'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'px-2 py-1 uppercase tracking-wide transition-colors',
                mode === m ? 'bg-brand-forest text-white' : 'bg-white text-brand-slate/50 hover:bg-brand-cream',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!color) return <Row label={label} info={info} />;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="w-36 shrink-0 flex items-center gap-1">
        <span className="text-[11px] font-medium text-brand-slate/60">{label}</span>
        {info && <InfoTip text={info} />}
      </div>
      <div className="flex items-center gap-2 flex-1">
        <div className="h-5 w-5 rounded border border-black/10 shrink-0" style={{ backgroundColor: color.hex }} />
        <span className="text-[11px] font-mono text-brand-slate/60">{color.hex}</span>
        <span className="text-xs text-brand-navy">{color.name}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// String array editor (benefits, compliance rules)
// ─────────────────────────────────────────────────────────────────────────────

function StringArrayEditor({
  items, onChange, placeholder, itemLabel,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  itemLabel?: string;
}) {
  const update = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <div className="px-4 py-3 space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] text-brand-slate/50 w-5 shrink-0 text-right">{i + 1}</span>
          <EInput
            value={item}
            onChange={(v) => update(i, v)}
            placeholder={placeholder ?? 'Enter value…'}
          />
          <button onClick={() => remove(i)} className="shrink-0 text-brand-slate/40 hover:text-brand-wine transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1.5 text-[11px] text-brand-forest/60 hover:text-brand-forest transition-colors mt-1"
      >
        <Plus className="h-3 w-3" />
        Add {itemLabel ?? 'item'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Testimonial card (view)
// ─────────────────────────────────────────────────────────────────────────────

function TestimonialCard({ t }: { t: NonNullable<ProductContext['testimonials']>[0] }) {
  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-brand-forest">
          {t.flag} {t.name}
          {t.age && <span className="font-normal text-brand-slate/60">, {t.age}</span>}
        </span>
        {t.verified && (
          <span className="text-[10px] text-brand-green bg-brand-lime/20 px-1.5 py-0.5 rounded font-medium">Verified</span>
        )}
      </div>
      {t.headline   && <p className="text-[11px] font-semibold text-brand-navy">"{t.headline}"</p>}
      {t.pull_quote && <p className="text-[11px] text-brand-forest bg-brand-forest/5 px-2 py-1 rounded italic">Pull: "{t.pull_quote}"</p>}
      <p className="text-[11px] text-brand-slate leading-relaxed">{t.quote}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Testimonial editor
// ─────────────────────────────────────────────────────────────────────────────

type Testimonial = NonNullable<ProductContext['testimonials']>[0];

function TestimonialEditor({
  testimonials, onChange,
}: {
  testimonials: Testimonial[];
  onChange: (t: Testimonial[]) => void;
}) {
  const update = (i: number, patch: Partial<Testimonial>) => {
    const next = [...testimonials];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(testimonials.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([...testimonials, { name: '', quote: '', headline: '', pull_quote: '', flag: '🏳️', age: '', verified: false }]);

  return (
    <div className="divide-y divide-brand-sage/10">
      {testimonials.map((t, i) => (
        <div key={i} className="px-4 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-brand-forest">Testimonial {i + 1}</span>
            <button onClick={() => remove(i)} className="text-brand-slate/40 hover:text-brand-wine transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-brand-slate/50 mb-0.5">Name</label>
              <EInput value={t.name} onChange={(v) => update(i, { name: v })} placeholder="Full name" />
            </div>
            <div>
              <label className="block text-[10px] text-brand-slate/50 mb-0.5">Age</label>
              <EInput value={String(t.age ?? '')} onChange={(v) => update(i, { age: v })} placeholder="e.g. 52" />
            </div>
            <div>
              <label className="block text-[10px] text-brand-slate/50 mb-0.5">Flag emoji</label>
              <EInput value={t.flag ?? ''} onChange={(v) => update(i, { flag: v })} placeholder="🇸🇬" />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-brand-slate/60 pb-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={t.verified ?? false}
                  onChange={(e) => update(i, { verified: e.target.checked })}
                  className="rounded border-brand-sage/40 accent-brand-forest"
                />
                Verified
              </label>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-brand-slate/50 mb-0.5">Headline</label>
            <EInput value={t.headline ?? ''} onChange={(v) => update(i, { headline: v })} placeholder="Short review headline" />
          </div>
          <div>
            <label className="block text-[10px] text-brand-slate/50 mb-0.5">Pull quote (4–8 words)</label>
            <EInput value={t.pull_quote ?? ''} onChange={(v) => update(i, { pull_quote: v })} placeholder="Emotional short phrase" />
          </div>
          <div>
            <label className="block text-[10px] text-brand-slate/50 mb-0.5">Full quote</label>
            <ETextarea value={t.quote} onChange={(v) => update(i, { quote: v })} rows={3} placeholder="Full review text…" />
          </div>
        </div>
      ))}
      <div className="px-4 py-3">
        <button
          onClick={add}
          className="flex items-center gap-1.5 text-[11px] text-brand-forest/60 hover:text-brand-forest transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add testimonial
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats editor
// ─────────────────────────────────────────────────────────────────────────────

type Stat = { value: string; label: string; context?: string };

function StatsEditor({ stats, onChange }: { stats: Stat[]; onChange: (s: Stat[]) => void }) {
  const update = (i: number, patch: Partial<Stat>) => {
    const next = [...stats]; next[i] = { ...next[i], ...patch }; onChange(next);
  };
  const remove = (i: number) => onChange(stats.filter((_, idx) => idx !== i));
  const add    = () => onChange([...stats, { value: '', label: '', context: '' }]);

  return (
    <div className="divide-y divide-brand-sage/10">
      {stats.map((s, i) => (
        <div key={i} className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-brand-forest">Stat {i + 1}</span>
            <button onClick={() => remove(i)} className="text-brand-slate/40 hover:text-brand-wine transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-brand-slate/50 mb-0.5">Value</label>
              <EInput value={s.value} onChange={(v) => update(i, { value: v })} placeholder="e.g. 94%" />
            </div>
            <div>
              <label className="block text-[10px] text-brand-slate/50 mb-0.5">Label</label>
              <EInput value={s.label} onChange={(v) => update(i, { label: v })} placeholder="e.g. saw firmer skin" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-brand-slate/50 mb-0.5">Context (optional)</label>
            <EInput value={s.context ?? ''} onChange={(v) => update(i, { context: v })} placeholder="e.g. in 8-week clinical study" />
          </div>
        </div>
      ))}
      <div className="px-4 py-3">
        <button onClick={add} className="flex items-center gap-1.5 text-[11px] text-brand-forest/60 hover:text-brand-forest transition-colors">
          <Plus className="h-3 w-3" /> Add stat
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Claims editor
// ─────────────────────────────────────────────────────────────────────────────

function ClaimsEditor({ claims, onChange }: { claims: Claim[]; onChange: (c: Claim[]) => void }) {
  const update = (i: number, patch: Partial<Claim>) => {
    const next = [...claims]; next[i] = { ...next[i], ...patch }; onChange(next);
  };
  const remove = (i: number) => onChange(claims.filter((_, idx) => idx !== i));
  const add    = () => onChange([...claims, { text: '', stat: '', source: '' }]);

  return (
    <div className="divide-y divide-brand-sage/10">
      {claims.map((c, i) => (
        <div key={i} className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-brand-forest">Claim {i + 1}</span>
            <button onClick={() => remove(i)} className="text-brand-slate/40 hover:text-brand-wine transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div>
            <label className="block text-[10px] text-brand-slate/50 mb-0.5">Claim text</label>
            <ETextarea value={c.text} onChange={(v) => update(i, { text: v })} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-brand-slate/50 mb-0.5">Stat (optional)</label>
              <EInput value={c.stat ?? ''} onChange={(v) => update(i, { stat: v })} placeholder="e.g. 94% saw results" />
            </div>
            <div>
              <label className="block text-[10px] text-brand-slate/50 mb-0.5">Source (optional)</label>
              <EInput value={c.source ?? ''} onChange={(v) => update(i, { source: v })} placeholder="e.g. Clinical study 2024" />
            </div>
          </div>
        </div>
      ))}
      <div className="px-4 py-3">
        <button onClick={add} className="flex items-center gap-1.5 text-[11px] text-brand-forest/60 hover:text-brand-forest transition-colors">
          <Plus className="h-3 w-3" /> Add claim
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingredients editor
// ─────────────────────────────────────────────────────────────────────────────

function IngredientsEditor({
  ingredients, onChange,
}: {
  ingredients: Ingredient[];
  onChange: (ing: Ingredient[]) => void;
}) {
  const update = (i: number, patch: Partial<Ingredient>) => {
    const next = [...ingredients]; next[i] = { ...next[i], ...patch }; onChange(next);
  };
  const remove = (i: number) => onChange(ingredients.filter((_, idx) => idx !== i));
  const add    = () => onChange([...ingredients, { name: '', key: false, description: '' }]);

  return (
    <div className="divide-y divide-brand-sage/10">
      {ingredients.map((ing, i) => (
        <div key={i} className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-brand-forest">Ingredient {i + 1}</span>
              <label className="flex items-center gap-1 text-[10px] text-brand-slate/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ing.key}
                  onChange={(e) => update(i, { key: e.target.checked })}
                  className="rounded border-brand-sage/40 accent-brand-forest"
                />
                Key ingredient
              </label>
            </div>
            <button onClick={() => remove(i)} className="text-brand-slate/40 hover:text-brand-wine transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <EInput value={ing.name} onChange={(v) => update(i, { name: v })} placeholder="Ingredient name" />
          <ETextarea value={ing.description ?? ''} onChange={(v) => update(i, { description: v })} rows={2} placeholder="Brief description…" />
        </div>
      ))}
      <div className="px-4 py-3">
        <button onClick={add} className="flex items-center gap-1.5 text-[11px] text-brand-forest/60 hover:text-brand-forest transition-colors">
          <Plus className="h-3 w-3" /> Add ingredient
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Research section
// ─────────────────────────────────────────────────────────────────────────────

function ResearchSection({
  research,
  generating,
  onRegenerate,
}: {
  research: ResearchRow | null;
  generating: boolean;
  onRegenerate: () => void;
}) {
  if (generating) {
    return (
      <div className="px-4 py-5 flex flex-col items-center gap-2 text-center">
        <Loader2 className="h-5 w-5 text-brand-forest/40 animate-spin" />
        <p className="text-xs text-brand-slate/60">Generating audience research…</p>
        <p className="text-[11px] text-brand-slate/40">Claude is searching Reddit, reviews & forums. Takes ~60s.</p>
      </div>
    );
  }

  if (!research) {
    return (
      <div className="px-4 py-5 text-center">
        <p className="text-xs text-brand-slate/50">No research generated yet.</p>
        <p className="text-[11px] text-brand-slate/40 mt-1">
          Research is auto-generated when a product is created.
        </p>
        <button
          onClick={onRegenerate}
          className="mt-3 flex items-center gap-1.5 mx-auto text-[11px] text-brand-forest/60 hover:text-brand-forest transition-colors"
        >
          <RefreshCw className="h-3 w-3" /> Generate now
        </button>
      </div>
    );
  }

  const r = research.research;

  return (
    <div className="divide-y divide-brand-sage/10">
      {/* Meta row */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-brand-slate/60">
            {research.market} · {research.segment}
          </span>
          <span className="text-[10px] bg-brand-lime/20 text-brand-forest px-1.5 py-0.5 rounded font-medium">
            {research.research_type.replace('_', ' ')}
          </span>
        </div>
        <button
          onClick={onRegenerate}
          className="flex items-center gap-1 text-[11px] text-brand-slate/50 hover:text-brand-forest transition-colors"
          title="Regenerate research"
        >
          <RefreshCw className="h-3 w-3" /> Regenerate
        </button>
      </div>

      {/* Executive summary */}
      <div className="px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-brand-slate/40 mb-1.5">Summary</p>
        <p className="text-xs text-brand-navy leading-relaxed line-clamp-4">
          {r.executive_summary}
        </p>
      </div>

      {/* Personas */}
      {r.personas?.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-brand-slate/40 mb-2">
            {r.personas.length} Personas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {r.personas.map((p) => (
              <span
                key={p.archetype_name}
                className="text-[11px] bg-brand-cream px-2 py-0.5 rounded-full text-brand-forest/70 border border-brand-sage/20"
              >
                {p.archetype_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Language guide — top words */}
      {r.language_guide?.words_she_uses?.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-brand-slate/40 mb-1.5">Her Language</p>
          <p className="text-xs text-brand-slate/70 leading-relaxed">
            {r.language_guide.words_she_uses.slice(0, 12).join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main viewer
// ─────────────────────────────────────────────────────────────────────────────

export function ProductContextViewer({ products, researchByProduct, decksByProduct = {} }: { products: Product[]; researchByProduct: Record<string, ResearchRow>; decksByProduct?: Record<string, ProductDeckRow> }) {
  const [activeId,        setActiveId]        = useState<string>(products[0]?.id ?? '');
  const [editMode,        setEditMode]        = useState(false);
  const [draft,           setDraft]           = useState<Draft | null>(null);
  const [error,           setError]           = useState<string | null>(null);
  const [isPending,       startTransition]    = useTransition();
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [uploadingImg,    setUploadingImg]    = useState(false);
  const [uploadError,     setUploadError]     = useState<string | null>(null);
  const [seedingImages,   setSeedingImages]   = useState(false);
  const [synthModalOpen,  setSynthModalOpen]  = useState(false);
  const [synthTarget,     setSynthTarget]     = useState<Product | null>(null);
  const [researchGenerating, setResearchGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const product = products.find((p) => p.id === activeId) ?? products[0];
  const ctx: ProductContext | null  = (product as any)?.context ?? null;

  if (!product) return <p className="text-sm text-brand-slate">No products found.</p>;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const enterEdit = () => {
    setDraft(toDraft(product));
    setEditMode(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setDraft(null);
    setError(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const url = await uploadProductThumbnail(product.id, formData);
      // update draft so the preview reflects the new image immediately
      if (editMode) {
        setDraft((prev) => prev ? { ...prev, thumbnail_url: url } : prev);
      }
    } catch (e: any) {
      setUploadError(e.message ?? 'Upload failed');
    } finally {
      setUploadingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveEdit = () => {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      try {
        const payload: ProductUpdatePayload = {
          name:             draft.name,
          sub_brand:        draft.sub_brand || null,
          prompt_modifier:  draft.prompt_modifier || null,
          compliance_rules: draft.compliance_rules,
          ingredients:      draft.ingredients,
          claims:           draft.claims,
          color_palette:    draft.color_palette,
          context:          draft.context,
          thumbnail_url:    draft.thumbnail_url || null,
        };
        await updateProduct(product.id, payload);
        setEditMode(false);
        setDraft(null);
      } catch (e: any) {
        setError(e.message ?? 'Save failed');
      }
    });
  };

  // ── Draft helpers ─────────────────────────────────────────────────────────

  const setCtx = (patch: Partial<ProductContext>) =>
    setDraft((d) => d ? { ...d, context: { ...d.context, ...patch } } : d);

  const setColor = (field: keyof ProductContext, c: { name: string; hex: string }) =>
    setCtx({ [field]: c });

  // ── Synthesize modal save ───────────────────────────────────────────────
  const handleSynthSave = async (data: any) => {
    if (synthTarget) {
      // Enriching existing product
      const payload: ProductUpdatePayload = {
        name:             data.name,
        sub_brand:        data.sub_brand || null,
        prompt_modifier:  data.prompt_modifier || null,
        compliance_rules: data.compliance_rules || [],
        ingredients:      data.ingredients || [],
        claims:           data.claims || [],
        color_palette:    data.color_palette || [],
        context:          data.context || null,
        thumbnail_url:    synthTarget.thumbnail_url,
      };
      await updateProduct(synthTarget.id, payload);
    } else {
      // Creating new product
      const payload: ProductCreatePayload = {
        name:             data.name,
        brand:            data.brand,
        sub_brand:        data.sub_brand || null,
        description:      data.description || null,
        ingredients:      data.ingredients || [],
        claims:           data.claims || [],
        color_palette:    data.color_palette || [],
        prompt_modifier:  data.prompt_modifier || null,
        compliance_rules: data.compliance_rules || [],
        context:          data.context || null,
      };
      const newProduct = await createProduct(payload);
      // Fire-and-forget research generation for the new product
      if (newProduct?.id) {
        fetch('/api/admin/research/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: newProduct.id }),
        }).catch(console.error);
      }
    }
  };

  const handleTriggerResearch = async (productId: string) => {
    setResearchGenerating(true);
    try {
      const res = await fetch('/api/admin/research/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Server error ${res.status}`);
      }
      // Success — reload so the new research section populates
      window.location.reload();
    } catch (err) {
      console.error('Research trigger failed:', err);
      setResearchGenerating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const d = draft;
  const c = d?.context ?? ctx;

  // In view mode, ctx colors may be stored as EMPTY_CONTEXT placeholders (#000000/blank).
  // Compute display-safe colors that fall back to color_palette when that happens.
  const cp = product.color_palette ?? [];
  const displayColor = (field: keyof ProductContext, paletteIdx: number) =>
    resolveCtxColor(c?.[field] as any, cp[paletteIdx], EMPTY_CONTEXT[field] as any);

  return (
    <div className="flex gap-5 items-start">

      {/* ── Product list sidebar ───────────────────────────────────────────── */}
      <div className="w-56 shrink-0 sticky top-6">
        <div className="rounded-lg border border-brand-sage/20 bg-white overflow-hidden">
          <div className="px-3 py-2.5 border-b border-brand-sage/20">
            <span className="text-[11px] font-semibold text-brand-forest tracking-wide uppercase">Products</span>
          </div>
          {products.map((p, i) => {
            const isActive   = p.id === activeId;
            const hasCtx     = !!(p as any).context;
            const isDeleting = deletingId === p.id;
            const isConfirm  = confirmDeleteId === p.id;
            return (
              <div
                key={p.id}
                className={cn(
                  'group relative flex items-center gap-2.5 px-3 py-2.5 transition-colors duration-100',
                  i < products.length - 1 && 'border-b border-brand-sage/10',
                  isActive ? 'bg-brand-forest/5' : 'hover:bg-brand-cream/60',
                  editMode && !isActive && 'opacity-40 pointer-events-none',
                )}
              >
                {/* Selectable area */}
                <button
                  type="button"
                  onClick={() => { if (!editMode) { setActiveId(p.id); setConfirmDeleteId(null); } }}
                  className="flex flex-1 min-w-0 items-center gap-2.5 text-left"
                >
                  {/* Thumbnail or colour dot */}
                  {p.thumbnail_url ? (
                    <img
                      src={p.thumbnail_url}
                      alt={p.name}
                      className="h-9 w-9 shrink-0 rounded-md object-cover border border-brand-sage/20"
                    />
                  ) : (
                    <div
                      className="h-9 w-9 shrink-0 rounded-md border border-brand-sage/20 bg-brand-cream/80 flex items-center justify-center"
                      style={{ backgroundColor: ((p as any).context?.background_color?.hex ?? p.color_palette?.[3]?.hex ?? undefined) }}
                    >
                      <div
                        className="h-3 w-3 rounded-full border border-black/10"
                        style={{ backgroundColor: (p as any).context?.primary_color?.hex ?? p.color_palette?.[0]?.hex ?? '#ccc' }}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-xs font-medium truncate', isActive ? 'text-brand-forest' : 'text-brand-slate')}>{p.name}</p>
                    <p className="text-[10px] text-brand-slate/60 truncate">{p.sub_brand ?? p.brand}</p>
                  </div>
                  <div
                    className={cn('h-1.5 w-1.5 shrink-0 rounded-full', hasCtx ? 'bg-brand-green' : 'bg-brand-sage/40')}
                    title={hasCtx ? 'Context set' : 'No context'}
                  />
                </button>

                {/* Delete — confirm flow */}
                {!isConfirm && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-brand-slate/30 hover:text-brand-wine transition-all duration-150"
                    title="Delete product"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {isConfirm && (
                  <div className="absolute inset-0 flex items-center justify-between gap-1 bg-white/95 px-3 z-10 border border-brand-wine/20 rounded-sm">
                    <span className="text-[10px] text-brand-wine font-medium">Delete?</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[10px] px-2 py-0.5 rounded border border-brand-sage/30 text-brand-slate hover:bg-brand-cream"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={async () => {
                          setDeletingId(p.id);
                          try {
                            await deleteProduct(p.id);
                            if (isActive) setActiveId(products.find(x => x.id !== p.id)?.id ?? '');
                          } finally {
                            setDeletingId(null);
                            setConfirmDeleteId(null);
                          }
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-brand-wine text-white hover:bg-brand-wine/90 disabled:opacity-60 flex items-center gap-1"
                      >
                        {isDeleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Product button */}
        <button
          type="button"
          onClick={() => { setSynthTarget(null); setSynthModalOpen(true); }}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-white bg-brand-forest hover:bg-brand-forest/90 rounded-lg px-3 py-2.5 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Product
        </button>

        {/* Seed local images button — shows only when any product lacks a thumbnail */}
        {products.some((p) => !p.thumbnail_url) && (
          <button
            type="button"
            disabled={seedingImages}
            onClick={async () => {
              setSeedingImages(true);
              try {
                await seedProductThumbnails();
              } finally {
                setSeedingImages(false);
              }
            }}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] text-brand-forest/70 hover:text-brand-forest bg-brand-cream/60 hover:bg-brand-cream border border-brand-sage/20 rounded-lg px-3 py-2 transition-all disabled:opacity-50"
          >
            {seedingImages ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            {seedingImages ? 'Seeding…' : 'Seed Product Images'}
          </button>
        )}
      </div>

      {/* ── Context detail ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-3 pb-8">

        {/* Hidden file input for thumbnail upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        {/* Product header + edit controls */}
        <div className="flex items-center justify-between mb-1 gap-4">
          {/* Left: thumbnail + name */}
          <div className="flex items-center gap-4 min-w-0">
            {/* Thumbnail */}
            <div className="relative shrink-0 group/thumb">
              {(editMode ? d?.thumbnail_url : product.thumbnail_url) ? (
                <img
                  src={editMode ? d!.thumbnail_url : product.thumbnail_url!}
                  alt={product.name}
                  className="h-20 w-20 rounded-xl object-cover border border-brand-sage/20 shadow-sm"
                />
              ) : (
                <div className="h-20 w-20 rounded-xl border border-brand-sage/20 bg-brand-cream/60 flex items-center justify-center shadow-sm">
                  <ImageOff className="h-6 w-6 text-brand-sage/40" />
                </div>
              )}
              {/* Upload overlay — always visible on hover */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImg}
                className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-1 bg-brand-forest/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-150 text-white"
                title="Upload product image"
              >
                {uploadingImg
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <Camera className="h-5 w-5" />}
                <span className="text-[10px] font-medium">
                  {uploadingImg ? 'Uploading…' : 'Change'}
                </span>
              </button>
            </div>

            {/* Name + brand */}
            <div className="min-w-0">
              {editMode && d ? (
                <div className="space-y-1">
                  <EInput value={d.name} onChange={(v) => setDraft((prev) => prev ? { ...prev, name: v } : prev)} className="text-sm font-semibold" />
                  <EInput value={d.sub_brand} onChange={(v) => setDraft((prev) => prev ? { ...prev, sub_brand: v } : prev)} className="text-xs" placeholder="Sub-brand" />
                  {/* URL field as alternative to file upload */}
                  <EInput
                    value={d.thumbnail_url}
                    onChange={(v) => setDraft((prev) => prev ? { ...prev, thumbnail_url: v } : prev)}
                    placeholder="or paste image URL…"
                    className="text-[10px] text-brand-slate/60"
                  />
                  {uploadError && <p className="text-[10px] text-brand-wine">{uploadError}</p>}
                </div>
              ) : (
                <>
                  <h2 className="text-base font-semibold text-brand-forest">{product.name}</h2>
                  <p className="text-xs text-brand-slate">{product.sub_brand ?? product.brand}</p>
                  {uploadError && <p className="text-[10px] text-brand-wine mt-1">{uploadError}</p>}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!editMode && (
              <>
                <div className="flex items-center gap-1">
                  {product.color_palette?.map((clr, i) => (
                    <div key={i} className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: clr.hex }} title={`${clr.name} ${clr.hex}`} />
                  ))}
                </div>
                <button
                  onClick={() => { setSynthTarget(product); setSynthModalOpen(true); }}
                  className="flex items-center gap-1.5 text-xs text-brand-teal hover:text-brand-forest bg-brand-cream/60 border border-brand-teal/20 hover:border-brand-forest/30 rounded-md px-3 py-1.5 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Enrich with AI
                </button>
                <button
                  onClick={enterEdit}
                  className="flex items-center gap-1.5 text-xs text-brand-slate/70 hover:text-brand-forest bg-white border border-brand-sage/30 hover:border-brand-forest/30 rounded-md px-3 py-1.5 transition-all"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </>
            )}
            {editMode && (
              <div className="flex items-center gap-2">
                {error && <p className="text-xs text-brand-wine">{error}</p>}
                <button
                  onClick={cancelEdit}
                  disabled={isPending}
                  className="flex items-center gap-1.5 text-xs text-brand-slate/70 hover:text-brand-wine bg-white border border-brand-sage/30 rounded-md px-3 py-1.5 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={isPending}
                  className="flex items-center gap-1.5 text-xs text-white bg-brand-forest hover:bg-brand-forest/90 rounded-md px-3 py-1.5 transition-all disabled:opacity-60"
                >
                  {isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Check className="h-3.5 w-3.5" />}
                  {isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Identity ── */}
        <Section title="Identity" defaultOpen>
          <Row label="Product name"    value={product.name} info="The display name used across all ad copy templates and session headers." />
          <Row label="Brand"           value={product.sub_brand ?? product.brand} info="The brand or sub-brand label shown in session context and product attribution copy." />
          <Row label="Category"        value={c?.product_category}  editMode={editMode} onEdit={(v) => setCtx({ product_category: v })} info="Populates [PRODUCT CATEGORY] in prompts. Tells the AI what type of product this is for accurate scene generation." />
          <Row label="Tagline"         value={c?.tagline}           editMode={editMode} onEdit={(v) => setCtx({ tagline: v })}           info="Used as [TAGLINE] in ad copy templates. Appears in hero headlines and brand positioning sections." />
          <Row label="Price"           value={c?.price}             editMode={editMode} onEdit={(v) => setCtx({ price: v })}             info="Inserted as [PRICE] in copy templates. Used in value-proposition and CTA sections." />
          <Row label="Website"         value={c?.website}           editMode={editMode} onEdit={(v) => setCtx({ website: v })}           info="Populates [WEBSITE] in copy. Appears in footer lines and CTA link text." />
          <Row label="Target audience" value={c?.target_audience}   editMode={editMode} onEdit={(v) => setCtx({ target_audience: v })}   info="Populates [TARGET AUDIENCE]. Guides AI tone, imagery, and demographic references in all generated content." />
          <Row label="Market flag"     value={c?.market_flag}       editMode={editMode} onEdit={(v) => setCtx({ market_flag: v })}       info="Used as [MARKET FLAG] emoji in copy. Sets the regional context for localisation (e.g. 🇸🇬 for Singapore)." />
        </Section>

        {/* ── Brand Colors ── */}
        <Section title="Brand Colors" badge={c ? 6 : product.color_palette?.length}>
          <ColorRow label="Primary"    color={editMode ? c?.primary_color    : displayColor('primary_color',    0)} editMode={editMode} onEdit={(v) => setColor('primary_color', v)}    info="Used as [BRAND COLOR] in every image prompt. Sets the dominant visual tone of all generated creatives." />
          <ColorRow label="Accent"     color={editMode ? c?.accent_color     : displayColor('accent_color',     1)} editMode={editMode} onEdit={(v) => setColor('accent_color', v)}     info="Used as [ACCENT COLOR] in image prompts. Applied to highlights, buttons, and secondary design elements." />
          <ColorRow label="Contrast"   color={editMode ? c?.contrast_color   : displayColor('contrast_color',   2)} editMode={editMode} onEdit={(v) => setColor('contrast_color', v)}   info="Used as [CONTRAST COLOR]. Applied to text overlays and elements that need visual separation from the background." />
          <ColorRow label="Tint"       color={editMode ? c?.tint_color       : displayColor('tint_color',       3)} editMode={editMode} onEdit={(v) => setColor('tint_color', v)}       info="A lighter tint of the primary used for soft backgrounds, overlays, and skin-tone-safe gradient elements." />
          <ColorRow label="Dark"       color={editMode ? c?.dark_color       : displayColor('dark_color',       4)} editMode={editMode} onEdit={(v) => setColor('dark_color', v)}       info="Used for dark backgrounds, deep shadows, and rich contrast areas in generated product images." />
          <ColorRow label="Background" color={editMode ? c?.background_color : displayColor('background_color', 5)} editMode={editMode} onEdit={(v) => setColor('background_color', v)} info="Sets the background tone in image prompts and scene descriptions. Keeps the visual palette consistent." />
        </Section>

        {/* ── Benefits ── */}
        <Section title="Benefits" badge={c?.benefits?.length ?? 0}>
          {editMode && d ? (
            <StringArrayEditor
              items={d.context.benefits ?? []}
              onChange={(v) => setCtx({ benefits: v })}
              placeholder="e.g. Reduces dark circles in 4 weeks"
              itemLabel="benefit"
            />
          ) : c?.benefits?.length ? (
            c.benefits.map((b, i) => <Row key={i} label={`Benefit ${i + 1}`} value={b} />)
          ) : (
            <Row label="—" empty="No benefits set" />
          )}
        </Section>

        {/* ── Proof Stats ── */}
        <Section title="Proof Stats" badge={c?.stats?.length ?? 0}>
          {editMode && d ? (
            <StatsEditor stats={d.context.stats ?? []} onChange={(v) => setCtx({ stats: v })} />
          ) : c?.stats?.length ? (
            c.stats.map((s, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                <span className="w-36 shrink-0 text-[11px] font-medium text-brand-slate/60 pt-0.5">Stat {i + 1}</span>
                <div className="flex-1">
                  <span className="text-sm font-bold text-brand-forest">{s.value}</span>
                  <span className="text-xs text-brand-navy ml-1.5">{s.label}</span>
                  {s.context && <p className="text-[10px] text-brand-slate/60 mt-0.5">{s.context}</p>}
                </div>
              </div>
            ))
          ) : (
            <Row label="—" empty="No stats set" />
          )}
        </Section>

        {/* ── Claims ── */}
        <Section title="Claims" badge={product.claims?.length ?? 0} defaultOpen={false}>
          {editMode && d ? (
            <ClaimsEditor claims={d.claims} onChange={(v) => setDraft((prev) => prev ? { ...prev, claims: v } : prev)} />
          ) : product.claims?.length ? (
            product.claims.map((cl, i) => (
              <div key={i} className="px-4 py-2.5">
                <p className="text-xs text-brand-navy">{cl.text}</p>
                {cl.stat && <p className="text-[11px] font-medium text-brand-forest mt-0.5">{cl.stat}</p>}
              </div>
            ))
          ) : (
            <Row label="—" empty="No claims set" />
          )}
        </Section>

        {/* ── Transformation ── */}
        <Section title="Transformation">
          <Row label="Before state"  value={c?.before_state}  editMode={editMode} onEdit={(v) => setCtx({ before_state: v })}  multiline info="Used as [BEFORE STATE] in PAS-framework copy. Describes the pain point or problem the product solves." />
          <Row label="After state"   value={c?.after_state}   editMode={editMode} onEdit={(v) => setCtx({ after_state: v })}   multiline info="Used as [AFTER STATE] in ad copy. Describes the desired outcome — the emotional and visual transformation." />
          <Row label="Timeframe"     value={c?.timeframe}     editMode={editMode} onEdit={(v) => setCtx({ timeframe: v })}           info="Used as [TIMEFRAME] in copy. Adds specificity to transformation claims (e.g. 'visible results in 8 weeks')." />
          <Row label="Social proof"  value={c?.social_proof}  editMode={editMode} onEdit={(v) => setCtx({ social_proof: v })}        info="Used as [SOCIAL PROOF]. A credibility line (e.g. '110 women tested') placed near CTAs and proof sections." />
          <Row label="Review count"  value={c?.review_count}  editMode={editMode} onEdit={(v) => setCtx({ review_count: v })}        info="Used as [REVIEW COUNT] in ad copy. Shown near CTAs and star-rating elements to build purchase confidence." />
        </Section>

        {/* ── Scene & Visual ── */}
        <Section title="Scene & Visual">
          <Row label="Surface"             value={c?.surface}             editMode={editMode} onEdit={(v) => setCtx({ surface: v })}             info="Used as [SURFACE] in image prompts. Defines what the product rests on in the scene (e.g. 'marble countertop')." />
          <Row label="Setting"             value={c?.setting}             editMode={editMode} onEdit={(v) => setCtx({ setting: v })}             info="Used as [SETTING] in image prompts. Sets the room or environment for the product shot (e.g. 'bright vanity bathroom')." />
          <Row label="Mood"                value={c?.mood}                editMode={editMode} onEdit={(v) => setCtx({ mood: v })}                info="Used as [MOOD] in image prompts. Guides lighting, color grading, and overall atmosphere of generated images." />
          <Row label="Product description" value={c?.product_description} editMode={editMode} onEdit={(v) => setCtx({ product_description: v })} multiline info="Used as [PRODUCT DESCRIPTION] in image prompts. Tells the AI exactly what the product looks like for accurate generation." />
        </Section>

        {/* ── Copy & CTAs ── */}
        <Section title="Copy & CTAs">
          <Row label="CTA"              value={c?.cta}              editMode={editMode} onEdit={(v) => setCtx({ cta: v })}              info="Used as [CTA TEXT] in ad copy templates. The primary call-to-action line (e.g. 'Shop Now — Free Shipping')." />
          <Row label="Short headline"   value={c?.short_headline}   editMode={editMode} onEdit={(v) => setCtx({ short_headline: v })}   info="Used as [SHORT HEADLINE] in image overlay templates. A 4–6 word punchy line for banners and static ads." />
          <Row label="Hero headline"    value={c?.hero_headline}    editMode={editMode} onEdit={(v) => setCtx({ hero_headline: v })}    info="Used as [HERO HEADLINE] in landing page and video ad copy. The main brand statement for this product." />
          <Row label="Tagline"          value={c?.tagline}          editMode={editMode} onEdit={(v) => setCtx({ tagline: v })}          info="Used as [TAGLINE] in both image prompts and copy templates. The signature one-liner for this product." />
          <Row label="Educational hook" value={c?.educational_hook} editMode={editMode} onEdit={(v) => setCtx({ educational_hook: v })} multiline info="Used as [EDUCATIONAL HOOK] in educational-style ad formats. Opens with a surprising fact or question to earn attention." />
        </Section>

        {/* ── Ingredients ── */}
        <Section title="Ingredients" badge={product.ingredients?.length ?? 0} defaultOpen={false}>
          {editMode && d ? (
            <IngredientsEditor ingredients={d.ingredients} onChange={(v) => setDraft((prev) => prev ? { ...prev, ingredients: v } : prev)} />
          ) : product.ingredients?.length ? (
            product.ingredients.map((ing, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                <span className="w-36 shrink-0 text-[11px] font-medium text-brand-slate/60 pt-0.5">
                  {ing.key ? <span className="text-brand-green">★ Key</span> : 'Supporting'}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-brand-navy">{ing.name}</p>
                  {ing.description && <p className="text-[11px] text-brand-slate/70 mt-0.5">{ing.description}</p>}
                </div>
              </div>
            ))
          ) : (
            <Row label="—" empty="No ingredients set" />
          )}
        </Section>

        {/* ── Compliance Rules ── */}
        <Section title="Compliance Rules" badge={product.compliance_rules?.length ?? 0} defaultOpen={false}>
          {editMode && d ? (
            <StringArrayEditor
              items={d.compliance_rules}
              onChange={(v) => setDraft((prev) => prev ? { ...prev, compliance_rules: v } : prev)}
              placeholder="e.g. Never say 'treats' or 'cures'"
              itemLabel="rule"
            />
          ) : product.compliance_rules?.length ? (
            product.compliance_rules.map((r, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-2">
                <span className="text-brand-wine text-xs">⛔</span>
                <span className="text-xs text-brand-navy">{r}</span>
              </div>
            ))
          ) : (
            <Row label="—" empty="No rules set" />
          )}
        </Section>

        {/* ── Testimonials ── */}
        <Section title="Testimonials" badge={c?.testimonials?.length ?? 0} defaultOpen={false}>
          {editMode && d ? (
            <TestimonialEditor
              testimonials={d.context.testimonials ?? []}
              onChange={(v) => setCtx({ testimonials: v })}
            />
          ) : c?.testimonials?.length ? (
            c.testimonials.map((t, i) => (
              <div key={i} className={cn(i < (c.testimonials?.length ?? 0) - 1 && 'border-b border-brand-sage/10')}>
                <TestimonialCard t={t} />
              </div>
            ))
          ) : (
            <Row label="—" empty="No testimonials set" />
          )}
        </Section>

        {/* ── Prompt Modifier ── */}
        <Section title="Prompt Modifier (AI DNA)" defaultOpen={false}>
          {editMode && d ? (
            <div className="px-4 py-3">
              <ETextarea
                value={d.prompt_modifier}
                onChange={(v) => setDraft((prev) => prev ? { ...prev, prompt_modifier: v } : prev)}
                rows={6}
                placeholder="Describe the visual DNA of this product for image generation…"
              />
            </div>
          ) : (
            <div className="px-4 py-3">
              <p className="text-[11px] font-mono text-brand-slate leading-relaxed whitespace-pre-wrap">
                {product.prompt_modifier ?? '—'}
              </p>
            </div>
          )}
        </Section>

        {/* ── Audience Research ── */}
        {(() => {
          const research = researchByProduct[product.name.toLowerCase()] ?? null;
          return (
            <Section title="Audience Research" badge={research ? `${research.research?.personas?.length ?? 0} personas` : researchGenerating ? '…' : 'none'} defaultOpen={false}>
              <ResearchSection
                research={research}
                generating={researchGenerating}
                onRegenerate={() => handleTriggerResearch(product.id)}
              />
            </Section>
          );
        })()}

        {/* ── Concept Forge deck: Audience & Personas ── */}
        <ForgeDeckPanel
          key={product.id}
          product={product}
          deckRow={decksByProduct[product.id] ?? null}
        />

      </div>

      {/* ── Synthesize Modal ─────────────────────────────────────────────── */}
      <ProductSynthesizeModal
        open={synthModalOpen}
        onClose={() => { setSynthModalOpen(false); setSynthTarget(null); }}
        onSave={handleSynthSave}
        existingProduct={synthTarget}
      />
    </div>
  );
}
