#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/run-all-research.sh
#
# Generates AI audience research for all remaining products that don't yet have
# seed files. Runs them sequentially so the Anthropic API isn't overwhelmed.
#
# Prerequisite: ANTHROPIC_API_KEY must be in .env.local or your shell.
#               NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for DB seed.
#
# Usage:
#   bash scripts/run-all-research.sh
#
# Each product takes ~3-6 minutes. Total: ~15-20 minutes.
# Progress is printed to stdout. Failures exit 1 with the product that failed.
#
# ── Products already seeded (skip these) ─────────────────────────────────────
#   ✅  Shilajit / UK/EU  / Menopausal Women 45-65+  (shilajit-menopausal-eu.ts)
#   ✅  Flex & Fine / US  / Active Adults 50+          (flex-fine-us-adults.ts)
#   ✅  iYURA / ME        / Women 18-50                (iyura-me-women.ts)
#   ✅  iYURA / IL        / Women 25-65+               (iyura-il-women.ts)
#
# ── Products this script will generate ───────────────────────────────────────
#   🔄  Shilajit / US              / Women 40-60 with Fatigue
#   🔄  AshwaResin / UK/EU         / Women 30-50 Managing Stress
#   🔄  AshwaResin / US            / Women 30-55 Managing Stress
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Exit immediately on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "📊 TAE Ad Studio — Batch Research Generator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Each product takes 3–6 minutes. Total: ~15–20 min."
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. Shilajit / US / Women 40-60 with Fatigue & Energy Issues
# ─────────────────────────────────────────────────────────────────────────────
echo "▶ [1/3] Shilajit — US — Women 40-60 with Fatigue"
echo "   Starting at $(date '+%H:%M:%S')"

npx tsx "$SCRIPT_DIR/generate-research.ts" \
  --product "Shilajit" \
  --brand "HERBIUS" \
  --market "US" \
  --segment "Women 40-60 with Fatigue and Energy Issues" \
  --context "HERBIUS Shilajit is a premium all-natural Himalayan mineral resin supplement targeting women with low energy, fatigue, and brain fog. Key benefits: sustained energy, mental clarity, hormonal balance, adaptogenic support. Positioned as a clean-label, all-natural alternative to synthetic energy supplements. No caffeine. US market context: more direct/urgency-driven messaging is acceptable vs EU."

echo ""
echo "✅ [1/3] Done. File saved: lib/research/seed-data/shilajit-us-women.ts"
echo ""
sleep 5  # Brief pause between API calls

# ─────────────────────────────────────────────────────────────────────────────
# 2. AshwaResin / UK/EU / Women 30-50 Managing Stress and Burnout
# ─────────────────────────────────────────────────────────────────────────────
echo "▶ [2/3] AshwaResin — UK/EU — Women 30-50 Managing Stress"
echo "   Starting at $(date '+%H:%M:%S')"

npx tsx "$SCRIPT_DIR/generate-research.ts" \
  --product "AshwaResin" \
  --brand "A.Modernica" \
  --market "UK/EU" \
  --segment "Women 30-50 Managing Stress and Burnout" \
  --context "AshwaResin by A.Modernica is an ashwagandha resin supplement for stress, cortisol management, sleep quality, and energy resilience. Target: professional women 30-50 experiencing burnout, anxiety, and chronic stress. IMPORTANT compliance rule: NEVER claim '100% natural' for this product (A.Modernica formulation). EU markets: UK, FR, DE, IT, NL, ES. Softer urgency than US. Evidence-based credibility is important for EU audiences."

echo ""
echo "✅ [2/3] Done. File saved: lib/research/seed-data/ashwaresin-eu-women.ts"
echo ""
sleep 5

# ─────────────────────────────────────────────────────────────────────────────
# 3. AshwaResin / US / Women 30-55 Managing Chronic Stress
# ─────────────────────────────────────────────────────────────────────────────
echo "▶ [3/3] AshwaResin — US — Women 30-55 Managing Chronic Stress"
echo "   Starting at $(date '+%H:%M:%S')"

npx tsx "$SCRIPT_DIR/generate-research.ts" \
  --product "AshwaResin" \
  --brand "A.Modernica" \
  --market "US" \
  --segment "Women 30-55 Managing Chronic Stress" \
  --context "AshwaResin by A.Modernica is an ashwagandha resin supplement targeting US women with chronic stress, cortisol issues, burnout, and anxiety. IMPORTANT: NEVER claim '100% natural' for this product. US market: more direct urgency-driven messaging is acceptable. Emphasise clinical evidence, cortisol science, and quick results. Compete with gummies, powders, and other ashwagandha supplements."

echo ""
echo "✅ [3/3] Done. File saved: lib/research/seed-data/ashwaresin-us-women.ts"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Seed everything to DB
# ─────────────────────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📤 All research generated. Now add the new imports to scripts/seed-research.ts"
echo "   then run: npx tsx scripts/seed-research.ts"
echo ""
echo "   New imports to add:"
echo "   import { shilajitUsWomen }    from '../lib/research/seed-data/shilajit-us-women';"
echo "   import { ashwaresinEuWomen }  from '../lib/research/seed-data/ashwaresin-eu-women';"
echo "   import { ashwaresinUsWomen }  from '../lib/research/seed-data/ashwaresin-us-women';"
echo ""
echo "🎉 Batch complete at $(date '+%H:%M:%S')"
echo ""
