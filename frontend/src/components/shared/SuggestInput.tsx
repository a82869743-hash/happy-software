import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/axios';

export interface LinkedSuggestionData {
  reg_no?: string;
  car_name?: string;
  client_name?: string;
  customer_name?: string;
  owner_name?: string;
  mobile_no?: string;
  alt_mobile?: string;
  email?: string;
  address_line?: string;
  colony_street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  company_name?: string;
  gstin?: string;
  insurance_company?: string;
  [key: string]: any;
}

export interface SuggestInputProps {
  type: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string, linkedData?: LinkedSuggestionData) => void;
  onLinkedFill?: (linkedData: LinkedSuggestionData) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

// In-memory cache for fast sub-50ms keystroke responses
const suggestionsCache = new Map<string, string[]>();

export default function SuggestInput({
  type,
  value,
  onChange,
  onSelect,
  onLinkedFill,
  placeholder,
  className,
  id,
  name,
  disabled = false,
  required = false,
  autoFocus = false,
  maxLength,
  onBlur,
  onFocus,
  onKeyDown,
  inputRef
}: SuggestInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const resolvedRef = inputRef || internalInputRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Fetch suggestions with 150ms debounce
  const fetchSuggestions = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q || q.length < 1) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      const cacheKey = `${type}:${q.toLowerCase()}`;
      if (suggestionsCache.has(cacheKey)) {
        const cached = suggestionsCache.get(cacheKey) || [];
        setSuggestions(cached);
        setIsOpen(cached.length > 0);
        return;
      }

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const res = await api.get(`/suggestions?type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}&limit=10`);
          const list = Array.isArray(res.data?.data) ? res.data.data : [];
          suggestionsCache.set(cacheKey, list);
          setSuggestions(list);
          setIsOpen(list.length > 0);
        } catch {
          setSuggestions([]);
          setIsOpen(false);
        }
      }, 150);
    },
    [type]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    onChange(nextVal);
    setActiveIndex(-1);
    fetchSuggestions(nextVal);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (value && value.trim().length >= 1) {
      fetchSuggestions(value);
    }
    if (onFocus) onFocus(e);
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Delay closing slightly so onMouseDown on dropdown can execute
    setTimeout(() => {
      setIsOpen(false);
      setActiveIndex(-1);
    }, 180);
    if (onBlur) onBlur(e);
  };

  const selectSuggestion = async (item: string) => {
    onChange(item);
    setIsOpen(false);
    setActiveIndex(-1);

    // Linked autofill lookup if reg_no or mobile_no
    let linkedData: LinkedSuggestionData | undefined;
    if (type === 'reg_no' || type === 'vehicle_no' || type === 'mobile_no' || type === 'alt_mobile') {
      try {
        const linkedRes = await api.get(`/suggestions/linked?type=${encodeURIComponent(type)}&value=${encodeURIComponent(item)}`);
        if (linkedRes.data?.found && linkedRes.data?.data) {
          linkedData = linkedRes.data.data;
        }
      } catch {}
    }

    if (linkedData && onLinkedFill) {
      onLinkedFill(linkedData);
    }

    if (onSelect) {
      onSelect(item, linkedData);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        return;
      }
      if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          e.preventDefault();
          selectSuggestion(suggestions[activeIndex]);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        return;
      }
    }

    if (onKeyDown) onKeyDown(e);
  };

  // Render text with bold highlight on matching search term
  const renderHighlighted = (item: string) => {
    const q = (value || '').trim();
    if (!q) return <span>{item}</span>;

    const lowerItem = item.toLowerCase();
    const lowerQ = q.toLowerCase();
    const matchIdx = lowerItem.indexOf(lowerQ);

    if (matchIdx === -1) {
      return <span>{item}</span>;
    }

    const before = item.slice(0, matchIdx);
    const match = item.slice(matchIdx, matchIdx + q.length);
    const after = item.slice(matchIdx + q.length);

    return (
      <span>
        {before}
        <span className="font-extrabold text-amber-600 underline decoration-amber-400 underline-offset-2">
          {match}
        </span>
        {after}
      </span>
    );
  };

  const defaultClasses =
    'w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium transition-colors';

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={resolvedRef}
        type="text"
        id={id}
        name={name}
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        className={className || defaultClasses}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        maxLength={maxLength}
        autoComplete="off"
      />

      {isOpen && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-stone-100 animate-in fade-in zoom-in-95 duration-100"
          onMouseDown={(e) => e.preventDefault()} // Prevents blur before click executes
        >
          {suggestions.map((item, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <div
                key={`${item}-${idx}`}
                onClick={() => selectSuggestion(item)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                  isSelected ? 'bg-amber-50 text-amber-950 font-bold' : 'text-stone-800 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="material-symbols-outlined text-xs text-stone-400">history</span>
                  <span className="truncate">{renderHighlighted(item)}</span>
                </div>
                {isSelected && (
                  <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider ml-2 shrink-0">
                    ↵ Pick
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Record field suggestions on save (fire-and-forget).
 * Does not throw, does not block form completion.
 */
export async function recordFieldSuggestions(
  fields:
    | Record<string, string | number | null | undefined>
    | Array<{ type: string; text?: string | number | null | undefined }>
) {
  try {
    const items: Array<{ type: string; text: string }> = [];

    if (Array.isArray(fields)) {
      for (const f of fields) {
        if (!f.type || f.text === null || f.text === undefined) continue;
        const s = String(f.text).trim();
        if (s.length >= 1) items.push({ type: f.type, text: s });
      }
    } else if (fields && typeof fields === 'object') {
      for (const [type, val] of Object.entries(fields)) {
        if (val === null || val === undefined) continue;
        const s = String(val).trim();
        if (s.length >= 1) items.push({ type, text: s });
      }
    }

    if (items.length === 0) return;

    // Fire and forget POST to /suggestions/record
    api.post('/suggestions/record', { items }).catch(() => {});
  } catch {}
}
