"use client";

import { useState } from "react";
import { generateReconciliationData, generateReconciliationSummary, generateReconciliationComparison, generateBeneficiaryData } from "@/lib/reports";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } from "docx";

export default function ReportsClient() {
  const [loadingRecon, setLoadingRecon] = useState(false);
  const [loadingBenpos, setLoadingBenpos] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().slice(0, 10));
  const [compareDate, setCompareDate] = useState(new Date().toISOString().slice(0, 10));
  const [format, setFormat] = useState<"CSV" | "EXCEL" | "WORD" | "PDF">("CSV");

  type ReportRow = Record<string, string | number | null | undefined>;

  const downloadCSV = (data: ReportRow[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadExcel = (data: ReportRow[], filename: string) => {
    if (data.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const downloadPdf = (data: ReportRow[], filename: string, title: string) => {
    if (data.length === 0) return;
    const doc = new jsPDF({ orientation: "landscape" });
    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((h) => String(row[h] ?? "")));
    doc.setFontSize(12);
    doc.text(title, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [headers],
      body: rows,
      styles: { fontSize: 8 },
    });
    doc.save(`${filename}.pdf`);
  };

  const downloadWord = async (data: ReportRow[], filename: string, title: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      new TableRow({
        children: headers.map((h) =>
          new TableCell({ children: [new Paragraph(String(row[h] ?? ""))] })
        ),
      })
    );
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: title, bold: true })] }),
          new Paragraph(" "),
          new Table({
            rows: [
              new TableRow({
                children: headers.map((h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })),
              }),
              ...rows,
            ],
          }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportData = async (data: ReportRow[], filename: string, title: string) => {
    if (format === "CSV") downloadCSV(data, filename);
    if (format === "EXCEL") downloadExcel(data, filename);
    if (format === "PDF") downloadPdf(data, filename, title);
    if (format === "WORD") await downloadWord(data, filename, title);
  };

  const handleRecon = async () => {
    setLoadingRecon(true);
    const [detail, summary] = await Promise.all([
      generateReconciliationData(asOnDate),
      generateReconciliationSummary(asOnDate),
    ]);
    await exportData(detail, `Reconciliation_Detailed_${asOnDate}`, "Reconciliation Detailed Report");
    await exportData(summary, `Reconciliation_Summary_${asOnDate}`, "Reconciliation Summary Report");
    setLoadingRecon(false);
  };

  const handleBenpos = async () => {
    setLoadingBenpos(true);
    const data = await generateBeneficiaryData(asOnDate);
    await exportData(data, `Beneficiary_Position_${asOnDate}`, "Beneficiary Position Statement");
    setLoadingBenpos(false);
  };

  const handleComparison = async () => {
    setLoadingCompare(true);
    const data = await generateReconciliationComparison(asOnDate, compareDate);
    await exportData(data, `Reconciliation_Compare_${asOnDate}_${compareDate}`, "Reconciliation Multi-Date Comparison");
    setLoadingCompare(false);
  };

  return (
    <div className="grid grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <div className="glass-panel p-6 animate-in" style={{ gridColumn: "span 2" }}>
        <h3>Report Controls</h3>
        <div className="flex gap-4 mt-4">
          <div className="flex-col gap-2 w-full">
            <label className="text-sub">As on Date</label>
            <input type="date" className="input-field" value={asOnDate} onChange={(e) => setAsOnDate(e.target.value)} />
          </div>
          <div className="flex-col gap-2 w-full">
            <label className="text-sub">Compare Date</label>
            <input type="date" className="input-field" value={compareDate} onChange={(e) => setCompareDate(e.target.value)} />
          </div>
          <div className="flex-col gap-2 w-full">
            <label className="text-sub">Download Format</label>
            <select className="input-field" value={format} onChange={(e) => setFormat(e.target.value as "CSV" | "EXCEL" | "WORD" | "PDF")}>
              <option value="CSV">CSV</option>
              <option value="EXCEL">Excel</option>
              <option value="WORD">Word</option>
              <option value="PDF">PDF</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 animate-in">
        <h3>Reconciliation Report</h3>
        <p className="text-sub mt-2 mb-4">Reconciles exact share counts across NSDL, CDSL, and Physical records against master Paid Up Capital.</p>
        <button onClick={handleRecon} disabled={loadingRecon} className="btn-primary">
          {loadingRecon ? 'Generating...' : `Generate Reconciliation (${format})`}
        </button>
      </div>

      <div className="glass-panel p-6 animate-in" style={{ animationDelay: '0.1s' }}>
        <h3>Beneficiary Position Statement</h3>
        <p className="text-sub mt-2 mb-4">Download the full list of shareholders for a specific requested date.</p>
        <button onClick={handleBenpos} disabled={loadingBenpos} className="btn-primary w-full">
          {loadingBenpos ? 'Generating...' : `Export Beneficiaries (${format})`}
        </button>
      </div>

      <div className="glass-panel p-6 animate-in" style={{ animationDelay: '0.2s', gridColumn: 'span 2' }}>
        <h3>Reconciliation Multi-Date Comparison</h3>
        <p className="text-sub mt-2 mb-4">Compare reconciliation outcomes between two as-on dates.</p>
        <div className="flex gap-4">
          <button onClick={handleComparison} disabled={loadingCompare} className="btn-primary">
            {loadingCompare ? "Generating..." : `Download Comparison (${format})`}
          </button>
        </div>
      </div>
    </div>
  );
}
