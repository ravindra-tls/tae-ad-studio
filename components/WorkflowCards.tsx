'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { compressImageToDataUrl } from '@/lib/client/compress';
import { X, ImagePlus, ChevronRight, Loader2, Check, AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { Product } from '@/types';

// Only the fields needed for the product picker inside the Copy-Ad modal
type PickedProduct = Pick<Product, 'id' | 'name' | 'brand' | 'sub_brand' | 'thumbnail_url'>;

interface WorkflowCardsProps {
  products: PickedProduct[];
}

// ─── SVG Illustrations ────────────────────────────────────────────────────────

function BriefIllustration() {
  return (
    <svg viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Document shadow */}
      <rect x="34" y="18" width="88" height="110" rx="5" fill="#C8BC9F" opacity="0.5"
            transform="rotate(-8 78 73)" />
      {/* Main document */}
      <rect x="30" y="14" width="88" height="110" rx="5" fill="#FAF6ED"
            transform="rotate(-8 74 69)" />
      {/* Document header area */}
      <rect x="30" y="14" width="88" height="24" rx="5" fill="#E8E0D0"
            transform="rotate(-8 74 69)" />
      <rect x="30" y="32" width="88" height="6" fill="#E8E0D0"
            transform="rotate(-8 74 69)" />
      {/* Clipboard tab */}
      <rect x="55" y="16" width="30" height="9" rx="4.5" fill="#3A5340"
            transform="rotate(-8 70 20)" />
      {/* Text lines */}
      <rect x="40" y="46" width="55" height="4" rx="2" fill="#D4C9B0"
            transform="rotate(-8 67 48)" />
      <rect x="40" y="55" width="42" height="4" rx="2" fill="#D4C9B0"
            transform="rotate(-8 61 57)" />
      <rect x="40" y="64" width="50" height="4" rx="2" fill="#D4C9B0"
            transform="rotate(-8 65 66)" />
      <rect x="40" y="73" width="35" height="4" rx="2" fill="#D4C9B0"
            transform="rotate(-8 57 75)" />
      <rect x="40" y="82" width="48" height="4" rx="2" fill="#D4C9B0"
            transform="rotate(-8 64 84)" />
      <rect x="40" y="91" width="28" height="4" rx="2" fill="#D4C9B0"
            transform="rotate(-8 54 93)" />

      {/*
        Fountain pen — drawn vertically in local space, then rotated 45° clockwise.
        rotate(45) on (0, y): x'= y·sin45 = y·0.707, y'= y·cos45 = y·0.707
        Cap top (0,-32)  → (+22.6,-22.6) → absolute (140, 65)  = upper-right ✓
        Nib tip (0, 38)  → (-26.9,+26.9) → absolute  (91,115)  = lower-left  ✓
      */}
      <g transform="translate(118, 88) rotate(45)">
        {/* Dark cap (rounded end) */}
        <rect x="-4.5" y="-33" width="9" height="17" rx="4.5" fill="#1C2E22" />
        {/* Gold band — cap/barrel junction */}
        <rect x="-5" y="-17" width="10" height="3.5" rx="1.75" fill="#C4963F" />
        {/* Main barrel */}
        <rect x="-4" y="-13.5" width="8" height="36" rx="4" fill="#3A5340" />
        {/* Grip section (slightly darker near nib) */}
        <rect x="-4" y="19.5" width="8" height="7" rx="2" fill="#253C2C" />
        {/* Nib body — tapered pentagon */}
        <path d="M -3.5 26.5 L 3.5 26.5 L 1.5 35.5 L 0 38.5 L -1.5 35.5 Z" fill="#3A5340" />
        {/* Nib center slit */}
        <line x1="0" y1="28.5" x2="0" y2="36" stroke="#1C2E22" strokeWidth="0.9" />
        {/* Gold nib tip ball */}
        <ellipse cx="0" cy="38.5" rx="1.9" ry="1.4" fill="#C4963F" />
        {/* Clip — thin strip on barrel edge */}
        <rect x="3.5" y="-31" width="2.2" height="31" rx="1.1" fill="#1C2E22" opacity="0.6" />
        {/* Clip head (rounded) */}
        <circle cx="4.6" cy="-31.5" r="2.4" fill="#1C2E22" opacity="0.6" />
      </g>
    </svg>
  );
}

function CopyAdIllustration() {
  return (
    <svg viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Back phone shadow */}
      <rect x="90" y="22" width="60" height="96" rx="10" fill="#B8A882" opacity="0.4"
            transform="rotate(10 120 70)" />
      {/* Back phone */}
      <rect x="86" y="18" width="60" height="96" rx="10" fill="#FAF6ED"
            transform="rotate(10 116 66)" />
      {/* Back phone screen */}
      <rect x="92" y="30" width="48" height="72" rx="6" fill="#E8EFC8"
            transform="rotate(10 116 66)" />
      {/* Plant in back phone — simple leaf shapes */}
      <ellipse cx="122" cy="65" rx="12" ry="18" fill="#7A9E6B" opacity="0.7"
               transform="rotate(15 122 65)" />
      <ellipse cx="130" cy="72" rx="9" ry="14" fill="#8FB575" opacity="0.6"
               transform="rotate(-20 130 72)" />
      <ellipse cx="115" cy="75" rx="8" ry="12" fill="#6A8E5B" opacity="0.5"
               transform="rotate(5 115 75)" />

      {/* Front phone shadow */}
      <rect x="22" y="28" width="62" height="100" rx="10" fill="#B8A882" opacity="0.35"
            transform="rotate(-8 53 78)" />
      {/* Front phone */}
      <rect x="18" y="24" width="62" height="100" rx="10" fill="#FAF6ED"
            transform="rotate(-8 49 74)" />
      {/* Front phone screen */}
      <rect x="24" y="36" width="50" height="76" rx="6" fill="#EFF5D8"
            transform="rotate(-8 49 74)" />
      {/* Plant in front phone — flower/bloom */}
      <circle cx="50" cy="75" r="14" fill="#C4963F" opacity="0.25" />
      <circle cx="50" cy="66" r="7" fill="#C4963F" opacity="0.6" />
      <circle cx="44" cy="74" r="6" fill="#E8B84B" opacity="0.55" />
      <circle cx="57" cy="73" r="6" fill="#D4A83A" opacity="0.55" />
      <circle cx="50" cy="81" r="6" fill="#C49530" opacity="0.55" />
      <circle cx="50" cy="74" r="5" fill="#FAF6ED" />
      {/* Stem */}
      <rect x="49" y="82" width="2" height="18" rx="1" fill="#3A5340" opacity="0.6"
            transform="rotate(-8 50 91)" />
      {/* Leaves on stem */}
      <ellipse cx="44" cy="90" rx="7" ry="4" fill="#5A7A4A" opacity="0.6"
               transform="rotate(-30 44 90)" />
      <ellipse cx="56" cy="95" rx="7" ry="4" fill="#4A6A3A" opacity="0.5"
               transform="rotate(30 56 95)" />

      {/* Phone camera dots */}
      <circle cx="49" cy="30" r="2" fill="#D4C9B0" transform="rotate(-8 49 30)" />
      <circle cx="112" cy="22" r="2" fill="#D4C9B0" transform="rotate(10 112 22)" />
    </svg>
  );
}

function TemplateIllustration() {
  return (
    <svg viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Grid of 4 template cards */}
      {/* Top-left — selected/highlighted */}
      <rect x="22" y="20" width="66" height="44" rx="5" fill="#3A5340" />
      <rect x="28" y="27" width="36" height="24" rx="3" fill="#5A7A5A" opacity="0.6" />
      <rect x="28" y="35" width="28" height="3" rx="1.5" fill="#C8E0A8" opacity="0.7" />
      <rect x="28" y="41" width="20" height="3" rx="1.5" fill="#C8E0A8" opacity="0.5" />
      {/* Checkmark circle */}
      <circle cx="72" cy="24" r="8" fill="#C4963F" />
      <polyline points="68,24 71,27 77,21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Top-right */}
      <rect x="94" y="20" width="66" height="44" rx="5" fill="#FAF6ED" stroke="#D4C9B0" strokeWidth="1.5" />
      <rect x="100" y="27" width="36" height="24" rx="3" fill="#E8E0D0" />
      <rect x="100" y="35" width="28" height="3" rx="1.5" fill="#C8BC9F" />
      <rect x="100" y="41" width="20" height="3" rx="1.5" fill="#C8BC9F" opacity="0.7" />

      {/* Bottom-left */}
      <rect x="22" y="72" width="66" height="44" rx="5" fill="#FAF6ED" stroke="#D4C9B0" strokeWidth="1.5" />
      <rect x="28" y="79" width="36" height="24" rx="3" fill="#E8E0D0" />
      <rect x="28" y="87" width="28" height="3" rx="1.5" fill="#C8BC9F" />
      <rect x="28" y="93" width="20" height="3" rx="1.5" fill="#C8BC9F" opacity="0.7" />

      {/* Bottom-right */}
      <rect x="94" y="72" width="66" height="44" rx="5" fill="#FAF6ED" stroke="#D4C9B0" strokeWidth="1.5" />
      <rect x="100" y="79" width="36" height="24" rx="3" fill="#E8E0D0" />
      <rect x="100" y="87" width="28" height="3" rx="1.5" fill="#C8BC9F" />
      <rect x="100" y="93" width="20" height="3" rx="1.5" fill="#C8BC9F" opacity="0.7" />

      {/* Sparkle accent */}
      <path d="M160 18 L162 14 L164 18 L168 20 L164 22 L162 26 L160 22 L156 20 Z" fill="#C4963F" opacity="0.7" />
      <path d="M16 115 L17 112 L18 115 L21 116 L18 117 L17 120 L16 117 L13 116 Z" fill="#C4963F" opacity="0.5" />
    </svg>
  );
}

// ─── Card definition ──────────────────────────────────────────────────────────

interface CardDef {
  id: 'brief' | 'copy-ad' | 'templates';
  eyebrow: string;
  title: string;
  subtitle: string;
  illustration: React.ReactNode;
  action: 'link' | 'modal';
  href?: string;
}

const CARDS: CardDef[] = [
  {
    id:           'brief',
    eyebrow:      'From concept to creative',
    title:        'Start with\na Brief',
    subtitle:     'Tell us your creative direction and let AI handle the rest',
    illustration: <BriefIllustration />,
    action:       'link',
    href:         '/session/new?flow=brief',
  },
  {
    id:           'copy-ad',
    eyebrow:      'Adapt any reference',
    title:        'Copy from\nAnother Ad',
    subtitle:     'Upload a reference ad and remix it instantly for your products',
    illustration: <CopyAdIllustration />,
    action:       'modal',
  },
  {
    id:           'templates',
    eyebrow:      'Quick & consistent',
    title:        'Use a\nTemplate',
    subtitle:     'Pick from curated ad templates and generate in seconds',
    illustration: <TemplateIllustration />,
    action:       'link',
    href:         '/session/new',
  },
];

// ─── Loading messages ─────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Analysing reference ad…',
  'Extracting creative blueprint…',
  'Mapping the visual composition…',
  'Adapting template for your products…',
  'Generating images…',
  'Uploading results…',
  'Almost there…',
];

// ─── Copy-Ad Modal ────────────────────────────────────────────────────────────

type ModalStep = 'upload' | 'select' | 'loading' | 'error';

interface CopyAdModalProps {
  products: PickedProduct[];
  onClose: () => void;
}

interface RefImage { dataUrl: string; mime: string; name: string; }

const MAX_REFS = 5;

function CopyAdModal({ products, onClose }: CopyAdModalProps) {
  const router = useRouter();

  const [step, setStep]             = useState<ModalStep>('upload');
  const [refImages, setRefImages]   = useState<RefImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch]         = useState('');
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [errorMsg, setErrorMsg]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cycle loading messages
  useEffect(() => {
    if (step !== 'loading') return;
    let idx = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    loadingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[idx]);
    }, 3200);
    return () => { if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current); };
  }, [step]);

  // Image compression — shared util (1280px long edge, JPEG 0.85)
  const compressToDataUrl = (file: File): Promise<string> =>
    compressImageToDataUrl(file, { maxEdgePx: 1280, quality: 0.85 });

  const handleFilesAdd = async (files: File[]) => {
    const remaining = MAX_REFS - refImages.length;
    const toAdd = files.slice(0, remaining);
    if (!toAdd.length) return;
    try {
      const compressed = await Promise.all(
        toAdd.map(async (file) => ({
          dataUrl: await compressToDataUrl(file),
          mime:    'image/jpeg' as string,
          name:    file.name,
        }))
      );
      setRefImages(prev => [...prev, ...compressed].slice(0, MAX_REFS));
    } catch {
      setErrorMsg('Could not process image. Try a different file.');
      setStep('error');
    }
  };

  const removeRef = (idx: number) => setRefImages(prev => prev.filter((_, i) => i !== idx));

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const totalAds = refImages.length * selectedIds.size;

  const handleGenerate = useCallback(async () => {
    if (!refImages.length || selectedIds.size === 0) return;
    setStep('loading');

    try {
      const res = await fetch('/api/copy-ad', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          references:  refImages.map(r => ({ imageBase64: r.dataUrl, mimeType: r.mime })),
          productIds:  Array.from(selectedIds),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Generation failed. Please try again.');
        setStep('error');
        return;
      }

      if (data.groupId) {
        try {
          sessionStorage.setItem(
            `copy_ad_proposal_${data.groupId}`,
            JSON.stringify({
              templateText:      data.templateText,
              templateName:      data.templateName,
              templateCategory:  data.templateCategory,
              referenceImageUrl: data.referenceImageUrl,
            }),
          );
        } catch { /* quota — non-critical */ }
      }

      router.push(`/copy-ad/results?group=${data.groupId}`);
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setStep('error');
    }
  }, [refImages, selectedIds, router]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal
      open
      onClose={onClose}
      disableClose={step === 'loading'}
      maxWidth="max-w-lg"
      className="overflow-hidden"
    >
        {/* ── Close button ── */}
        {step !== 'loading' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-brand-slate/60 hover:text-brand-forest hover:bg-brand-cream transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* ── STEP: Upload ── */}
        {step === 'upload' && (
          <div className="p-7 flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold text-brand-forest mb-1">Upload Reference Ads</h2>
              <p className="text-sm text-brand-slate">
                Add up to {MAX_REFS} reference ads. Each will be analysed separately and adapted for your selected products.
              </p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFilesAdd(Array.from(e.target.files))}
            />

            {/* Drop zone — shrinks once images are added */}
            {refImages.length < MAX_REFS && (
              <button
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFilesAdd(Array.from(e.dataTransfer.files));
                }}
                className={cn(
                  'w-full border-2 border-dashed border-brand-forest/20 rounded-xl',
                  'flex flex-col items-center gap-3 cursor-pointer',
                  refImages.length === 0 ? 'p-10' : 'p-5',
                  'hover:border-brand-forest/40 hover:bg-brand-cream/30 transition-all duration-200',
                )}
              >
                <div className="h-11 w-11 rounded-full bg-brand-forest/10 flex items-center justify-center">
                  <ImagePlus className="h-5 w-5 text-brand-forest" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-brand-forest">
                    {refImages.length === 0
                      ? 'Click to upload or drag & drop'
                      : `Add more (${MAX_REFS - refImages.length} slot${MAX_REFS - refImages.length !== 1 ? 's' : ''} left)`}
                  </p>
                  {refImages.length === 0 && (
                    <p className="text-xs text-brand-slate mt-0.5">PNG, JPG, WEBP · up to {MAX_REFS} images</p>
                  )}
                </div>
              </button>
            )}

            {/* Thumbnail grid */}
            {refImages.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {refImages.map((ref, i) => (
                  <div key={i} className="relative group">
                    <div className="relative aspect-square rounded-lg overflow-hidden border border-brand-forest/10 bg-brand-cream/30">
                      <img src={ref.dataUrl} alt={ref.name} className="h-full w-full object-cover" />
                      {/* Overlay label */}
                      <div className="absolute bottom-0 inset-x-0 bg-brand-forest/60 text-white text-[9px] text-center py-0.5 truncate px-1">
                        {i + 1}
                      </div>
                    </div>
                    <button
                      onClick={() => removeRef(i)}
                      className="absolute -top-1.5 -right-1.5 h-[18px] w-[18px] rounded-full bg-brand-wine text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {refImages.length > 0 && (
              <Button className="w-full" onClick={() => setStep('select')}>
                Continue with {refImages.length} reference{refImages.length !== 1 ? 's' : ''}
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* ── STEP: Select Products ── */}
        {step === 'select' && (
          <>
            <div className="p-5 border-b border-brand-forest/10">
              <h2 className="text-lg font-bold text-brand-forest mb-0.5">Select Products</h2>
              <p className="text-xs text-brand-slate">
                Choose the products to generate ads for.{' '}
                {selectedIds.size > 0 && (
                  <span className="font-medium text-brand-forest">{selectedIds.size} selected</span>
                )}
              </p>

              {/* Reference images strip */}
              <div className="mt-3 flex items-center gap-2">
                <div className="flex gap-1.5 flex-1 overflow-x-auto pb-0.5">
                  {refImages.map((ref, i) => (
                    <div
                      key={i}
                      className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-brand-forest/10"
                      title={ref.name}
                    >
                      <img src={ref.dataUrl} alt={ref.name} className="h-full w-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 bg-brand-forest/60 text-white text-[9px] text-center py-px">
                        {i + 1}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setStep('upload')}
                  className="text-[11px] text-brand-wine hover:underline shrink-0"
                >
                  Edit
                </button>
              </div>

              {/* Search */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {/* Product list */}
            <div className="overflow-y-auto flex-1 p-3 flex flex-col gap-1.5">
              {filteredProducts.map((product) => {
                const isSelected = selectedIds.has(product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => toggleProduct(product.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all duration-150',
                      isSelected
                        ? 'border-brand-forest bg-brand-forest/5'
                        : 'border-transparent hover:border-brand-forest/20 hover:bg-brand-cream/30',
                    )}
                  >
                    {product.thumbnail_url ? (
                      <div className="relative h-10 w-10 shrink-0 rounded-md overflow-hidden border border-brand-forest/10">
                        <Image src={product.thumbnail_url} alt={product.name} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-md bg-brand-cream flex items-center justify-center text-brand-forest font-bold text-sm">
                        {product.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-brand-forest truncate">{product.name}</p>
                      <p className="text-[11px] text-brand-slate truncate">{product.sub_brand || product.brand}</p>
                    </div>
                    {/* Checkbox */}
                    <div className={cn(
                      'h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-all',
                      isSelected ? 'border-brand-forest bg-brand-forest' : 'border-brand-slate/30',
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-4 border-t border-brand-forest/10">
              <Button
                className="w-full"
                disabled={selectedIds.size === 0}
                onClick={handleGenerate}
              >
                Generate {totalAds > 0 ? `${totalAds} ` : ''}Ad{totalAds !== 1 ? 's' : ''}
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
              <p className="text-[11px] text-brand-slate text-center mt-2">
                {refImages.length} ref{refImages.length !== 1 ? 's' : ''} × {selectedIds.size || '?'} product{selectedIds.size !== 1 ? 's' : ''} = {totalAds || '?'} credit{totalAds !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}

        {/* ── STEP: Loading ── */}
        {step === 'loading' && (
          <div className="p-10 flex flex-col items-center text-center gap-6">
            <div className="relative h-20 w-20">
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ background: 'linear-gradient(135deg, #3A5340, #D0DD61)' }}
              />
              <div
                className="relative h-20 w-20 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #3A5340, #C4963F)' }}
              >
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-brand-forest mb-1">Creating your ads</h2>
              <p className="text-sm text-brand-slate transition-all duration-500">{loadingMsg}</p>
            </div>

            <p className="text-xs text-brand-slate/60">
              This takes about {refImages.length > 1 ? '2–5' : '1–2'} minutes. Please don't close this window.
            </p>
          </div>
        )}

        {/* ── STEP: Error ── */}
        {step === 'error' && (
          <div className="p-8 flex flex-col items-center text-center gap-5">
            <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-brand-wine" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-brand-forest mb-1">Something went wrong</h2>
              <p className="text-sm text-brand-slate">{errorMsg}</p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1" onClick={() => setStep('upload')}>Try Again</Button>
            </div>
          </div>
        )}
    </Modal>
  );
}

// ─── Main WorkflowCards ───────────────────────────────────────────────────────

export function WorkflowCards({ products }: WorkflowCardsProps) {
  const [showCopyAdModal, setShowCopyAdModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {CARDS.map((card) => {
          const isModal = card.action === 'modal';

          const inner = (
            <div
              className={cn(
                'group relative flex flex-col justify-between overflow-hidden rounded-2xl p-6',
                'cursor-pointer select-none',
                'transition-all duration-300',
                'hover:shadow-lg hover:-translate-y-0.5',
              )}
              style={{
                background: 'linear-gradient(135deg, #E0CEAB 0%, #D0DD61 100%)',
                minHeight: 200,
              }}
            >
              {/* Text content */}
              <div className="relative z-10 flex-1">
                <p
                  className="text-[11px] font-semibold uppercase tracking-widest mb-2 opacity-60"
                  style={{ color: '#4D4D4D' }}
                >
                  {card.eyebrow}
                </p>
                <h3
                  className="font-serif text-2xl leading-tight mb-2 whitespace-pre-line"
                  style={{ color: '#2A3E2A', fontWeight: 400 }}
                >
                  {card.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: '#5A5A5A', maxWidth: '140px' }}>
                  {card.subtitle}
                </p>
              </div>

              {/* Arrow */}
              <div
                className="relative z-10 mt-4 flex items-center gap-1 text-xs font-semibold transition-all duration-200 group-hover:gap-2"
                style={{ color: '#3A5340' }}
              >
                Get started
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>

              {/* Illustration */}
              <div
                className="absolute bottom-0 right-0 w-36 h-28 opacity-90 transition-transform duration-300 group-hover:scale-105 group-hover:opacity-100"
                style={{ transformOrigin: 'bottom right' }}
              >
                {card.illustration}
              </div>

              {/* Subtle inner glow on hover */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.35)' }}
              />
            </div>
          );

          if (isModal) {
            return (
              <div key={card.id} onClick={() => setShowCopyAdModal(true)}>
                {inner}
              </div>
            );
          }

          return (
            <Link key={card.id} href={card.href!}>
              {inner}
            </Link>
          );
        })}
      </div>

      {mounted && showCopyAdModal && (
        <CopyAdModal
          products={products}
          onClose={() => setShowCopyAdModal(false)}
        />
      )}
    </>
  );
}
