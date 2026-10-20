import { useEffect } from "react";

export default function Pagination({ total, page, pageSize, onPageChange, onPageSizeChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, total);

  useEffect(() => {
    if (page > pageCount) onPageChange(pageCount);
  }, [page, pageCount, onPageChange]);

  if (!total) return null;

  return (
    <div className="mt-4 flex flex-nowrap items-center justify-between gap-3 overflow-x-auto whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
      <p className="m-0 shrink-0">Showing {firstItem}–{lastItem} of {total}</p>
      <div className="flex shrink-0 flex-nowrap items-center gap-2" style={{ display: "inline-flex", flexWrap: "nowrap", alignItems: "center" }}>
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium" style={{ display: "inline-flex", flexDirection: "row", flexWrap: "nowrap", alignItems: "center", gap: 8, whiteSpace: "nowrap", width: "max-content" }}>
          <span style={{ whiteSpace: "nowrap" }}>Rows per page</span>
          <select
            value={pageSize}
            onChange={(event) => { onPageSizeChange(Number(event.target.value)); onPageChange(1); }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            aria-label="Rows per page"
          >
            {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        {pageCount > 1 && <>
          <span className="shrink-0 px-1 text-xs">Page {currentPage} of {pageCount}</span>
          <button type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} aria-label="Previous page" title="Previous page" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="m12.5 4.5-5 5.5 5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))} disabled={currentPage >= pageCount} aria-label="Next page" title="Next page" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="m7.5 4.5 5 5.5-5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>}
      </div>
    </div>
  );
}
