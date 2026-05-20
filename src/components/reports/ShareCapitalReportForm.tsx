"use client";

import { useCallback, useState } from "react";
import { saveAs } from "file-saver";
import {
  formatLetterDate,
  parseShareCapitalExcel,
  type ShareCapitalExcelRow,
} from "@/lib/share-capital-excel";
import {
  generateBulkShareCapitalReportsZip,
  type BulkProgress,
} from "@/lib/share-capital-report";
import styles from "./ShareCapitalReportForm.module.css";

const TEMPLATE_PATH = "/sample/share-capital-reports-bulk.xlsx";

export default function ShareCapitalReportForm() {
  const [reportAsOn, setReportAsOn] = useState("31st March 2026");
  const [referenceNoPrefix, setReferenceNoPrefix] = useState("2026-27/NSDL/MAR26/");
  const [letterDate, setLetterDate] = useState(() => formatLetterDate(new Date()));
  const [file, setFile] = useState<File | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<BulkProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setFile(selected ?? null);
    setRowCount(null);
    setError(null);
    if (!selected) return;

    try {
      const buffer = await selected.arrayBuffer();
      const rows = parseShareCapitalExcel(buffer);
      setRowCount(rows.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid Excel file");
      setRowCount(null);
    }
  }, []);

  const handleGenerate = async () => {
    if (!file) {
      setError("Please upload an Excel file.");
      return;
    }
    if (!reportAsOn.trim()) {
      setError("Report as on date is required.");
      return;
    }
    if (!referenceNoPrefix.trim()) {
      setError("Reference number prefix is required.");
      return;
    }

    setProcessing(true);
    setError(null);
    setProgress({ phase: "parsing", current: 0, total: 0 });

    try {
      const buffer = await file.arrayBuffer();
      const rows: ShareCapitalExcelRow[] = parseShareCapitalExcel(buffer);
      setRowCount(rows.length);

      const zipBlob = await generateBulkShareCapitalReportsZip(
        rows,
        {
          reportAsOn: reportAsOn.trim(),
          referenceNoPrefix: referenceNoPrefix.trim(),
          letterDate: letterDate.trim() || formatLetterDate(new Date()),
        },
        setProgress
      );

      const stamp = formatLetterDate(new Date()).replace(/\./g, "-");
      saveAs(zipBlob, `Share_Capital_Reports_${stamp}.zip`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate reports");
      setProgress({ phase: "error", current: 0, total: rowCount ?? 0 });
    } finally {
      setProcessing(false);
    }
  };

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className={styles.wrapper}>
      <p className="text-sub mb-4">
        Upload an Excel file with one row per company. Each row becomes a Share Capital
        Reconciliation PDF. Reports are bundled into a single ZIP download. Header/footer contact
        details are fixed (Harmilap template).
      </p>

      <section className={`${styles.section} glass-panel`}>
        <h3>Report settings (all reports)</h3>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>Report as on date</span>
            <input
              className="input-field"
              value={reportAsOn}
              onChange={(e) => setReportAsOn(e.target.value)}
              placeholder="31st March 2026"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Letter date</span>
            <input
              className="input-field"
              type="date"
              value={letterDateToInput(letterDate)}
              onChange={(e) => setLetterDate(inputToLetterDate(e.target.value))}
            />
          </label>
          <label className={styles.fieldWide}>
            <span className={styles.label}>
              Reference number prefix (RTA code appended per row)
            </span>
            <input
              className="input-field"
              value={referenceNoPrefix}
              onChange={(e) => setReferenceNoPrefix(e.target.value)}
              placeholder="2026-27/NSDL/MAR26/"
            />
            <span className={styles.hint}>
              Example: prefix <code>2026-27/NSDL/MAR26/</code> + RTA code <code>RTAN3176</code> →{" "}
              <code>2026-27/NSDL/MAR26/RTAN3176</code>
            </span>
          </label>
        </div>
      </section>

      <section className={`${styles.section} glass-panel`}>
        <h3>Excel upload</h3>
        <p className={`text-sub ${styles.mb}`}>
          Required columns: RTA Code, ISIN, Company Name, Address lines, State, Security Type,
          NSDL/CDSL/Physical/Total Shares, Demat request columns, Email.
        </p>
        <div className={styles.uploadRow}>
          <input
            type="file"
            accept=".xlsx,.xls"
            className={styles.fileInput}
            disabled={processing}
            onChange={handleFileChange}
          />
          <a href={TEMPLATE_PATH} download className="btn-primary btn-neutral">
            Download sample Excel
          </a>
        </div>
        {file && (
          <p className={styles.fileMeta}>
            <strong>{file.name}</strong>
            {rowCount != null && ` — ${rowCount} report(s) ready`}
          </p>
        )}
      </section>

      {processing && progress && (
        <section className={`${styles.section} glass-panel ${styles.progressBox}`}>
          <h3>Processing</h3>
          <p className={styles.progressLabel}>
            {progress.phase === "generating" &&
              `Generating PDF ${progress.current} of ${progress.total}…`}
            {progress.phase === "zipping" && "Creating ZIP archive…"}
            {progress.phase === "parsing" && "Reading Excel…"}
            {progress.phase === "done" && `Completed ${progress.total} report(s).`}
          </p>
          {progress.total > 0 && progress.phase === "generating" && (
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
          )}
        </section>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className="btn-primary"
          disabled={processing || !file}
          onClick={handleGenerate}
        >
          {processing ? "Processing…" : "Generate & download ZIP"}
        </button>
      </div>
    </div>
  );
}

function letterDateToInput(letterDate: string): string {
  const parts = letterDate.split(".");
  if (parts.length !== 3) return "";
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm}-${dd}`;
}

function inputToLetterDate(isoDate: string): string {
  if (!isoDate) return formatLetterDate(new Date());
  const [yyyy, mm, dd] = isoDate.split("-");
  return `${dd}.${mm}.${yyyy}`;
}
