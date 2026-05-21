import { useEffect, useRef, useState } from 'react';

const safeJsonParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const safeStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage failures.
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage failures.
    }
  }
};

const getBounds = (boundsMap, columnKey, minWidth) => {
  const bounds = boundsMap?.[columnKey] || {};
  const min = Number.isFinite(Number(bounds.min)) ? Number(bounds.min) : minWidth;
  const max = Number.isFinite(Number(bounds.max)) ? Number(bounds.max) : Infinity;
  return { min: Math.max(24, min), max: Math.max(Math.max(24, min), max) };
};

const clampWidth = (value, bounds, fallback) => {
  const width = Number(value);
  if (!Number.isFinite(width) || width <= 0) return fallback;
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(width)));
};

const buildNormalizedWidths = ({ columns = [], defaultColumnWidths = {}, boundsMap = {}, minWidth = 80, rawWidths = {} }) => {
  const next = {};
  columns.forEach((column) => {
    const key = typeof column === 'string' ? column : column?.key;
    if (!key) return;
    const fallback = Number.isFinite(Number(defaultColumnWidths[key])) && Number(defaultColumnWidths[key]) > 0
      ? Number(defaultColumnWidths[key])
      : null;
    const bounds = getBounds(boundsMap, key, minWidth);
    const rawValue = rawWidths?.[key];
    const normalized = clampWidth(rawValue, bounds, fallback);
    if (normalized !== null && normalized !== undefined) {
      next[key] = normalized;
    }
  });
  return next;
};

export function useColumnResize({
  storageKey,
  columns = [],
  defaultColumnWidths = {},
  columnBounds = {},
  minWidth = 80,
  enabled = true
} = {}) {
  const resizeStateRef = useRef(null);
  const [resizingColumn, setResizingColumn] = useState('');
  const [columnWidths, setColumnWidths] = useState(() => {
    if (!storageKey) {
      return buildNormalizedWidths({ columns, defaultColumnWidths, boundsMap: columnBounds, minWidth });
    }
    const saved = safeStorage.getItem(storageKey);
    if (!saved) {
      return buildNormalizedWidths({ columns, defaultColumnWidths, boundsMap: columnBounds, minWidth });
    }
    const parsed = safeJsonParse(saved, {});
    return buildNormalizedWidths({ columns, defaultColumnWidths, boundsMap: columnBounds, minWidth, rawWidths: parsed });
  });

  useEffect(() => {
    if (!storageKey) return;
    safeStorage.setItem(storageKey, JSON.stringify(buildNormalizedWidths({
      columns,
      defaultColumnWidths,
      boundsMap: columnBounds,
      minWidth,
      rawWidths: columnWidths
    })));
  }, [columnBounds, columnWidths, columns, defaultColumnWidths, minWidth, storageKey]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const session = resizeStateRef.current;
      if (!session) return;
      event.preventDefault();
      const bounds = getBounds(columnBounds, session.columnKey, minWidth);
      const delta = event.clientX - session.startX;
      const nextWidth = clampWidth(session.startWidth + delta, bounds, session.startWidth);
      setColumnWidths((prev) => ({ ...prev, [session.columnKey]: nextWidth }));
    };

    const handlePointerEnd = () => {
      if (!resizeStateRef.current) return;
      resizeStateRef.current = null;
      setResizingColumn('');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [columnBounds, minWidth]);

  useEffect(() => {
    if (!storageKey) return;
    const next = buildNormalizedWidths({
      columns,
      defaultColumnWidths,
      boundsMap: columnBounds,
      minWidth,
      rawWidths: columnWidths
    });
    setColumnWidths((prev) => {
      const serializedPrev = JSON.stringify(prev);
      const serializedNext = JSON.stringify(next);
      return serializedPrev === serializedNext ? prev : next;
    });
  }, [columnBounds, columns, defaultColumnWidths, minWidth, storageKey]);

  const getColumnWidth = (columnKey) => {
    const stored = Number(columnWidths?.[columnKey]);
    if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
    const fallback = Number(defaultColumnWidths?.[columnKey]);
    if (Number.isFinite(fallback) && fallback > 0) return Math.round(fallback);
    return null;
  };

  const getColumnStyle = (columnKey, options = {}) => {
    const align = options.align || 'left';
    const width = getColumnWidth(columnKey);
    const style = {
      textAlign: align
    };
    if (Number.isFinite(width) && width > 0) {
      style.width = `${width}px`;
      style.minWidth = `${width}px`;
      style.maxWidth = `${width}px`;
    }
    return style;
  };

  const startResize = (columnKey, event) => {
    if (!enabled) return;
    const target = event.currentTarget?.closest('th');
    const width = target?.getBoundingClientRect?.().width || getColumnWidth(columnKey) || defaultColumnWidths[columnKey] || minWidth;
    resizeStateRef.current = {
      columnKey,
      startX: event.clientX,
      startWidth: Number(width) || minWidth
    };
    setResizingColumn(columnKey);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    event.preventDefault();
    event.stopPropagation();
  };

  const resetColumns = () => {
    const next = buildNormalizedWidths({ columns, defaultColumnWidths, boundsMap: columnBounds, minWidth });
    setColumnWidths(next);
    if (storageKey) {
      safeStorage.removeItem(storageKey);
    }
    resizeStateRef.current = null;
    setResizingColumn('');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  return {
    columnWidths,
    getColumnStyle,
    getColumnWidth,
    resetColumns,
    resizingColumn,
    startResize
  };
}

export default useColumnResize;
