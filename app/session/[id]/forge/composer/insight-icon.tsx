'use client';

/**
 * Emotion → lucide icon for mined human insights (CF's INSIGHT_EMOJI port).
 */

import {
  CloudLightning,
  Crown,
  Eye,
  EyeOff,
  Flower2,
  Gem,
  Ghost,
  HeartPulse,
  Moon,
  type LucideIcon,
} from 'lucide-react';

const INSIGHT_ICONS: Record<string, LucideIcon> = {
  envy: Eye,
  shame: EyeOff,
  fear: CloudLightning,
  grief: Flower2,
  vanity: Gem,
  longing: Moon,
  invisibility: Ghost,
  pride: Crown,
};

export function insightIconFor(emotion?: string): LucideIcon {
  return (emotion && INSIGHT_ICONS[emotion]) || HeartPulse;
}

export function InsightIcon({ emotion, className }: { emotion?: string; className?: string }) {
  const Icon = insightIconFor(emotion);
  return <Icon className={className} aria-hidden />;
}
