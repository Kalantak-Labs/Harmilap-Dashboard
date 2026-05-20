"use client";

import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph } from "docx";

export default function TemplateDownloads() {
  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.text("RTA Request Template", 14, 20);
    doc.text("Use this template for issuer communication requests.", 14, 30);
    doc.save("rta_request_template.pdf");
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      { requestType: "ISIN_ACTIVATION", title: "", details: "", requestedBy: "" },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Requests");
    XLSX.writeFile(workbook, "rta_request_template.xlsx");
  };

  const downloadWord = async () => {
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph("RTA Request Template"),
          new Paragraph("Request Type: "),
          new Paragraph("Title: "),
          new Paragraph("Details: "),
          new Paragraph("Requested By: "),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "rta_request_template.docx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex gap-2">
      <button className="btn-primary btn-neutral" onClick={downloadPdf}>Template PDF</button>
      <button className="btn-primary btn-neutral" onClick={downloadExcel}>Template Excel</button>
      <button className="btn-primary btn-neutral" onClick={downloadWord}>Template Word</button>
    </div>
  );
}
