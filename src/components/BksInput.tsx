import React, { useMemo, useRef, useState } from 'react';
import { normalizeBks } from '../types/fleet';

export interface BksVehicleOption {
  id: string;
  bks: string;
  label: string;
}

interface BksInputProps {
  id?: string;
  value: string;
  vehicles: BksVehicleOption[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  valid?: boolean;
  required?: boolean;
  placeholder?: string;
}

export function BksInput({
  id = 'bks-input',
  value,
  vehicles,
  onChange,
  onBlur,
  invalid = false,
  valid = false,
  required = true,
  placeholder = 'Nhập BKS (ví dụ: 29KT01765 hoặc 01765)',
}: BksInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimerRef = useRef<number | null>(null);

  const suggestions = useMemo<BksVehicleOption[]>(() => {
    const query = normalizeBks(value);
    if (!query) {
      return vehicles.slice(0, 15);
    }

    const prefixMatches: BksVehicleOption[] = [];
    const containsMatches: BksVehicleOption[] = [];

    for (const v of vehicles) {
      const normalized = normalizeBks(v.bks);
      if (normalized.startsWith(query)) {
        prefixMatches.push(v);
      } else if (normalized.includes(query)) {
        containsMatches.push(v);
      }
    }

    return [...prefixMatches, ...containsMatches].slice(0, 15);
  }, [value, vehicles]);

  const handleSelect = (item: BksVehicleOption) => {
    onChange(normalizeBks(item.bks));
    setOpen(false);
    onBlur?.();
  };

  const handleFocus = () => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setActiveIndex(0);
    setOpen(true);
  };

  const handleBlur = () => {
    blurTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      onBlur?.();
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      const chosen = suggestions[activeIndex];
      if (chosen) {
        e.preventDefault();
        handleSelect(chosen);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        name="manual_bks_plate"
        type="text"
        value={value}
        onChange={(e) => {
          onChange(normalizeBks(e.target.value));
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="new-password"
        spellCheck={false}
        required={required}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        aria-invalid={invalid}
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border bg-white font-mono text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 ${
          invalid
            ? 'border-red-400 focus:ring-red-600 focus:border-red-600'
            : valid
            ? 'border-emerald-400 focus:ring-sky-600 focus:border-sky-600'
            : 'border-slate-300 focus:ring-sky-600 focus:border-sky-600'
        }`}
      />

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100"
        >
          {suggestions.map((item, idx) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
                className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 text-sm transition-colors cursor-pointer ${
                  idx === activeIndex ? 'bg-sky-50 text-sky-950' : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <span className="font-mono font-bold text-slate-900">{item.bks}</span>
                {item.label && (
                  <span className="text-xs font-medium text-slate-500 shrink-0">{item.label}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
