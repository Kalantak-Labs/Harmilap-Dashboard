"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import styles from "./DataTableFilter.module.css";

interface FilterOption {
  label: string;
  value: string;
}

export default function DataTableFilter({ filterOptions = [], searchPlaceholder = "Search..." }: { filterOptions?: FilterOption[], searchPlaceholder?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentQuery = searchParams.get("q") || "";
  const currentFilter = searchParams.get("filter") || "";

  const [query, setQuery] = useState(currentQuery);

  const debounceParams = useCallback((newQuery: string, newFilter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newQuery) {
      params.set("q", newQuery);
    } else {
      params.delete("q");
    }

    if (newFilter) {
      params.set("filter", newFilter);
    } else {
      params.delete("filter");
    }

    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    // basic debounce
    setTimeout(() => debounceParams(e.target.value, currentFilter), 300);
  };

  const handleFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    debounceParams(query, e.target.value);
  };

  return (
    <div className={styles.toolbar}>
      <input 
        type="text" 
        value={query} 
        onChange={handleSearch} 
        className={`input-field ${styles.searchInput}`}
        placeholder={searchPlaceholder} 
      />
      {filterOptions.length > 0 && (
        <select 
          value={currentFilter} 
          onChange={handleFilter} 
          className={`input-field ${styles.selectInput}`}
        >
          <option value="">All Filter Groups</option>
          {filterOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}
