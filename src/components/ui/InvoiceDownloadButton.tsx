"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type InvoiceLineItem = {
  code: string;
  description: string;
  amount: number;
};

type InvoiceDownloadButtonProps = {
  invoiceNo: string;
  companyName: string;
  date: string;
  dueDate: string;
  totalAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmountInclGst: number;
  lineItems: InvoiceLineItem[];
};

export default function InvoiceDownloadButton(props: InvoiceDownloadButtonProps) {
  const download = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Invoice ${props.invoiceNo}`, 14, 14);
    doc.setFontSize(10);
    doc.text(`Company: ${props.companyName}`, 14, 22);
    doc.text(`Date: ${props.date}`, 14, 28);
    doc.text(`Due Date: ${props.dueDate}`, 14, 34);

    autoTable(doc, {
      startY: 42,
      head: [["Code", "Description", "Amount"]],
      body: props.lineItems.map((line) => [line.code, line.description, `₹${line.amount.toLocaleString()}`]),
      styles: { fontSize: 9 },
    });

    const endY = 50 + props.lineItems.length * 8;
    doc.text(`Amount (Excl GST): ₹${props.totalAmount.toLocaleString()}`, 14, endY + 10);
    doc.text(`GST @ ${props.gstRate}%: ₹${props.gstAmount.toLocaleString()}`, 14, endY + 16);
    doc.text(`Amount (Incl GST): ₹${props.totalAmountInclGst.toLocaleString()}`, 14, endY + 22);
    doc.save(`${props.invoiceNo}.pdf`);
  };

  return (
    <button onClick={download} className="btn-primary btn-neutral">
      PDF
    </button>
  );
}
