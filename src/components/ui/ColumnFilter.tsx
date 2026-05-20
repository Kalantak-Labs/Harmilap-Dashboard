"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import styles from "./ColumnFilter.module.css";

export default function ColumnFilter({ columnKey, options = [] }: { columnKey: string, options: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentValue = searchParams.get(`f_${columnKey}`) || "";

  const [isOpen, setIsOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  const filteredOptions = Array.from(new Set(options))
    .filter(o => typeof o === 'string' && o.toLowerCase().includes(localSearch.toLowerCase()))
    .sort();

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(`f_${columnKey}`, value);
    } else {
      params.delete(`f_${columnKey}`);
    }
    router.push(`?${params.toString()}`, { scroll: false });
    setIsOpen(false);
    setLocalSearch("");
  };

  return (
    <div className={styles.filterWrapper} ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`${styles.trigger} ${currentValue ? styles.triggerActive : ""}`}
        title="Filter Column"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
      </button>

      {isOpen && (
        <div className={styles.popover}>
          <div className={styles.popoverInner}>
            <input 
              type="text" 
              placeholder={`Search...`} 
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className={styles.searchInput}
              autoFocus
            />
            
            <div className={styles.options}>
              <button 
                onClick={() => handleSelect("")}
                className={`${styles.optionBtn} ${styles.clearBtn} ${!currentValue ? styles.optionActive : ""}`}
              >
                Clear Filter
              </button>
              
              {filteredOptions.length === 0 ? (
                <div className={styles.emptyText}>No matches</div>
              ) : (
                filteredOptions.map(opt => (
                  <button 
                    key={opt}
                    onClick={() => handleSelect(opt)}
                    className={`${styles.optionBtn} ${currentValue === opt ? styles.optionActive : ""}`}
                  >
                    {opt}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
