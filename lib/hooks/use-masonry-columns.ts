'use client';

/**
 * useMasonryColumns — responsive left-to-right masonry distribution.
 *
 * Shared by Gallery and ImageGallery (previously duplicated in both):
 * 3 columns at ≥1024px, 2 below, items dealt round-robin (i % numCols)
 * so order reads left-to-right, top-to-bottom.
 */

import { useEffect, useMemo, useState } from 'react';

export interface UseMasonryColumnsOptions {
  /** Viewport width (px) at/above which `colsWide` applies. */
  breakpoint?: number;
  /** Column count at/above the breakpoint. */
  colsWide?:   number;
  /** Column count below the breakpoint. */
  colsNarrow?: number;
}

export interface UseMasonryColumnsResult<T> {
  numCols: number;
  columns: T[][];
}

export function useMasonryColumns<T>(
  items: T[],
  { breakpoint = 1024, colsWide = 3, colsNarrow = 2 }: UseMasonryColumnsOptions = {},
): UseMasonryColumnsResult<T> {
  const [numCols, setNumCols] = useState(colsWide);

  useEffect(() => {
    const update = () => setNumCols(window.innerWidth >= breakpoint ? colsWide : colsNarrow);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [breakpoint, colsWide, colsNarrow]);

  const columns = useMemo(() => {
    const cols: T[][] = Array.from({ length: numCols }, () => []);
    items.forEach((item, i) => cols[i % numCols].push(item));
    return cols;
  }, [items, numCols]);

  return { numCols, columns };
}
