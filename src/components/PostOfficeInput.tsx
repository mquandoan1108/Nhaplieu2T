import React, { useMemo, useRef, useState } from 'react';
import { POST_OFFICES, PostOfficeItem } from '../data/postOffices';

interface PostOfficeInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function PostOfficeInput({
  id = 'post-office-input',
  value,
  onChange,
  required = false,
  placeholder = 'Nhập mã hoặc tên bưu cục (vd: APD, XTT, HCM68)',
  className = '',
}: PostOfficeInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimerRef = useRef<number | null>(null);

  const suggestions = useMemo<PostOfficeItem[]>(() => {
    const query = value.trim();
    if (!query) {
      return POST_OFFICES.slice(0, 12);
    }
    const qUpper = query.toUpperCase();
    const qNorm = removeAccents(query);

    const exactOrPrefixCode: PostOfficeItem[] = [];
    const containsCode: PostOfficeItem[] = [];
    const nameMatch: PostOfficeItem[] = [];

    for (const item of POST_OFFICES) {
      const codeUp = item.code.toUpperCase();
      if (codeUp.startsWith(qUpper)) {
        exactOrPrefixCode.push(item);
      } else if (codeUp.includes(qUpper)) {
        containsCode.push(item);
      } else if (removeAccents(item.name).includes(qNorm)) {
        nameMatch.push(item);
      }
    }

    return [...exactOrPrefixCode, ...containsCode, ...nameMatch].slice(0, 20);
  }, [value]);

  const matchedOffice = useMemo(() => {
    const upper = value.trim().toUpperCase();
    if (!upper) return null;
    return POST_OFFICES.find((p) => p.code.toUpperCase() === upper) || null;
  }, [value]);

  const handleSelect = (item: PostOfficeItem) => {
    onChange(item.code.toUpperCase());
    setOpen(false);
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
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        required={required}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        className={
          className ||
          'w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-sky-300 bg-white font-mono text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600'
        }
      />

      {matchedOffice && (
        <p className="mt-1 text-xs text-sky-900 font-medium">
          {matchedOffice.name}
        </p>
      )}

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100"
        >
          {suggestions.map((item, idx) => (
            <li key={item.code}>
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
                <span className="font-mono font-bold text-sky-800 shrink-0">{item.code}</span>
                <span className="text-xs text-slate-600 truncate">{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
