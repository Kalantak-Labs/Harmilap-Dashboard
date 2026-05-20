import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import type { ShareCapitalExcelRow } from "./share-capital-excel";
import { buildReferenceNo } from "./share-capital-excel";

export type ShareCapitalReportData = {
  reportAsOn: string;
  referenceNo: string;
  letterDate: string;
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  cityPin: string;
  securityType: string;
  isin: string;
  nsdlShares: number;
  cdslShares: number;
  physicalShares: number;
  dematConfirmedRequests: string;
  dematConfirmedShares: string;
  dematPendingRequests: string;
  dematPendingShares: string;
  contactPhone: string;
  contactEmail: string;
  footerContactLine: string;
};

export const HARMILAP_CONTACT = {
  contactPhone: "9205234407",
  contactEmail: "harmilaprta@gmail.com",
  footerContactLine: "+91-8929835991 / 9310931755 / 9205234407",
} as const;

export type BulkReportConfig = {
  reportAsOn: string;
  referenceNoPrefix: string;
  letterDate: string;
};

export function rowToReportData(row: ShareCapitalExcelRow, config: BulkReportConfig): ShareCapitalReportData {
  return {
    reportAsOn: config.reportAsOn,
    referenceNo: buildReferenceNo(config.referenceNoPrefix, row.rtaCode),
    letterDate: config.letterDate,
    companyName: row.companyName,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    addressLine3: row.addressLine3,
    cityPin: row.state,
    securityType: row.securityType,
    isin: row.isin,
    nsdlShares: row.nsdlShares,
    cdslShares: row.cdslShares,
    physicalShares: row.physicalShares,
    dematConfirmedRequests: row.dematConfirmedRequests,
    dematConfirmedShares: row.dematConfirmedShares,
    dematPendingRequests: row.dematPendingRequests,
    dematPendingShares: row.dematPendingShares,
    ...HARMILAP_CONTACT,
  };
}

function pct(part: number, total: number): string {
  if (total <= 0) return "0";
  return ((part / total) * 100).toFixed(2).replace(/\.00$/, "");
}

type ReportImages = {
  headerBanner: string;
  footerStrip: string;
  signatureImage: string;
};

let imageCache: ReportImages | null = null;

async function loadImageDataUrl(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load image: ${path}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function getReportImages(): Promise<ReportImages> {
  if (!imageCache) {
    const [headerBanner, footerStrip, signatureImage] = await Promise.all([
      loadImageDataUrl("/report/image2.png"),
      loadImageDataUrl("/report/image3.png"),
      loadImageDataUrl("/report/image1.png"),
    ]);
    imageCache = { headerBanner, footerStrip, signatureImage };
  }
  return imageCache;
}

const IMPORTANT_NOTES = [
  "This report is prepared based on the Beneficiary reports shared by the Depository and helps the company to update records with other authorities. However, the company must consider the physical holding / further issuance of securities (if any) and match the same with internal company records when filing details with any authority.",
  "Beneficiary Position is attached with report only in case of Demat / Electronic Holdings",
  "This report should be checked and verified by the Company Secretary before filing with any authority.",
  '"Harmilap Share Transfer Agents" shall not be held responsible, directly or indirectly, for any false, misleading, or misrepresented information submitted by the company to any authority without verifying the same with the company\'s internal records.',
];

/** Layout tuned to sample Report.docx / reference PNG */
const LAYOUT = {
  marginL: 15,
  marginR: 15,
  headerTop: 8,
  headerBannerH: 24,
  titleBarFont: 8,
  titleBarPadY: 0.8,
  bodyFont: 9.5,
  smallFont: 9,
  lineMm: 4.2,
  sectionGap: 3,
  afterTable: 4,
} as const;

const RED: [number, number, number] = [192, 0, 0];
const BLACK: [number, number, number] = [0, 0, 0];
const GREY_HEAD: [number, number, number] = [217, 217, 217];
const BLUE_LINK: [number, number, number] = [0, 0, 200];

type TextSegment = { text: string; bold?: boolean; color?: [number, number, number] };

function pdfFilename(data: ShareCapitalReportData): string {
  const safeRta = data.referenceNo.replace(/[^\w\-]+/g, "_").slice(-20);
  const safeName = data.companyName.replace(/[^\w\-]+/g, "_").slice(0, 30);
  return `Share_Capital_${safeRta}_${safeName}.pdf`;
}

function drawRedTitleBar(
  doc: jsPDF,
  yTop: number,
  x: number,
  w: number,
  lines: string[]
): number {
  const fs = LAYOUT.titleBarFont;
  const lh = fs * 0.36;
  const barH = Math.max(5, lines.length * lh + LAYOUT.titleBarPadY * 2);
  doc.setFillColor(RED[0], RED[1], RED[2]);
  doc.rect(x, yTop, w, barH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fs);
  let ty = yTop + LAYOUT.titleBarPadY + lh * 0.85;
  for (const line of lines) {
    doc.text(line, x + w / 2, ty, { align: "center", maxWidth: w - 4 });
    ty += lh;
  }
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  return yTop + barH + 2;
}

/** Wrap paragraph with per-segment style (segments kept intact, not split mid-phrase). */
function drawStyledParagraph(
  doc: jsPDF,
  x: number,
  yStart: number,
  maxW: number,
  segments: TextSegment[],
  fontSize: number
): number {
  type Piece = { text: string; bold: boolean; color: [number, number, number] };
  const pieces: Piece[] = segments.map((s) => ({
    text: s.text,
    bold: s.bold ?? false,
    color: s.color ?? (s.bold ? RED : BLACK),
  }));

  const lineH = fontSize * 0.45;
  let y = yStart;

  const measurePiece = (p: Piece) => {
    doc.setFont("helvetica", p.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    return doc.getTextWidth(p.text);
  };

  let linePieces: Piece[] = [];
  let lineW = 0;

  const flush = () => {
    if (linePieces.length === 0) return;
    let cx = x;
    for (const p of linePieces) {
      doc.setFont("helvetica", p.bold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(p.color[0], p.color[1], p.color[2]);
      doc.text(p.text, cx, y);
      cx += measurePiece(p);
    }
    y += lineH;
    linePieces = [];
    lineW = 0;
  };

  for (const piece of pieces) {
    const words = piece.text.includes(" ") ? piece.text.split(/(\s+)/).filter((w) => w.length > 0) : [piece.text];
    for (const w of words) {
      const chunk: Piece = { text: w, bold: piece.bold, color: piece.color };
      const wWidth = measurePiece(chunk);
      const spaceW = linePieces.length > 0 ? measurePiece({ text: " ", bold: false, color: BLACK }) : 0;
      if (lineW + spaceW + wWidth > maxW && linePieces.length > 0) {
        flush();
      }
      if (linePieces.length > 0) lineW += spaceW;
      linePieces.push(chunk);
      lineW += wWidth;
    }
  }
  flush();
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  return y + 1;
}

function drawSectionHeading(doc: jsPDF, x: number, y: number, text: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(LAYOUT.bodyFont);
  doc.setTextColor(RED[0], RED[1], RED[2]);
  doc.text(text, x, y);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  return y + LAYOUT.lineMm;
}

export async function generateShareCapitalReportPdfBlob(
  data: ShareCapitalReportData,
  images: ReportImages
): Promise<{ blob: Blob; filename: string }> {
  const { headerBanner, footerStrip, signatureImage } = images;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const { marginL, marginR } = LAYOUT;
  const contentW = pageW - marginL - marginR;
  const contentRight = pageW - marginR;

  const footerImgW = pageW - 12;
  const footerImgH = footerImgW * (35 / 1000);
  const footerImgX = (pageW - footerImgW) / 2;
  const footerReserve = footerImgH + 14;

  const signatureW = 28;
  const signatureH = signatureW * (53 / 72);
  const totalShares = data.nsdlShares + data.cdslShares + data.physicalShares;

  const drawPageChrome = () => {
    doc.addImage(
      headerBanner,
      "PNG",
      marginL,
      LAYOUT.headerTop,
      contentW,
      LAYOUT.headerBannerH
    );
    const footerY = pageH - footerReserve + 4;
    doc.addImage(footerStrip, "PNG", footerImgX, footerY, footerImgW, footerImgH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.text(
      `Email Id: ${data.contactEmail} | Contact No: ${data.footerContactLine}`,
      pageW / 2,
      pageH - 4,
      { align: "center" }
    );
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    return LAYOUT.headerTop + LAYOUT.headerBannerH + 1;
  };

  let y = drawPageChrome();

  const ensureSpace = (need: number) => {
    if (y + need > pageH - footerReserve) {
      doc.addPage();
      y = drawPageChrome();
    }
  };

  const title = `Report on Share Capital Reconciliation Report as on ${data.reportAsOn}`;
  const titleLines = doc.splitTextToSize(title, contentW - 4);
  y = drawRedTitleBar(doc, y, marginL, contentW, titleLines);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(LAYOUT.bodyFont);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text(`Reference No: ${data.referenceNo}`, marginL, y);
  doc.text(`Date: ${data.letterDate}`, contentRight, y, { align: "right" });
  y += LAYOUT.lineMm + 1;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(LAYOUT.bodyFont);
  doc.text("To,", marginL, y);
  y += LAYOUT.lineMm;

  const formatAddressLine = (line: string) => line.toUpperCase();
  const addrParts = [
    data.companyName,
    [data.addressLine1, data.addressLine2, data.addressLine3].filter(Boolean).join(", "),
    data.cityPin,
  ].filter(Boolean);

  for (const line of addrParts) {
    const formatted = formatAddressLine(line);
    const wrapped = doc.splitTextToSize(formatted, contentW);
    for (const wl of wrapped) {
      doc.text(wl, marginL, y);
      y += LAYOUT.lineMm;
    }
  }
  y += LAYOUT.sectionGap;

  doc.text("Dear Sir / Madam,", marginL, y);
  y += LAYOUT.lineMm + 1;

  ensureSpace(20);
  const bodySegments: TextSegment[] = [
    { text: "The following are the reconciliation details " },
    { text: data.securityType, bold: true, color: RED },
    { text: " paid-up share capital of " },
    { text: data.companyName, bold: true, color: RED },
    { text: " (ISIN: " },
    { text: data.isin, bold: true, color: RED },
    { text: `) as on ${data.reportAsOn}.` },
  ];
  y = drawStyledParagraph(doc, marginL, y, contentW, bodySegments, LAYOUT.bodyFont);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR },
    tableWidth: contentW,
    head: [["Category", "No. of Shares", "Percentage (%)"]],
    body: [
      ["Shares in Demat Mode with NSDL", String(data.nsdlShares), pct(data.nsdlShares, totalShares)],
      ["Shares in Demat Mode with CDSL", String(data.cdslShares), pct(data.cdslShares, totalShares)],
      ["Shares in Physical Mode", String(data.physicalShares), pct(data.physicalShares, totalShares)],
      ["Total", String(totalShares), totalShares > 0 ? "100" : "0"],
    ],
    styles: {
      fontSize: LAYOUT.smallFont,
      cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      textColor: BLACK,
      valign: "middle",
    },
    headStyles: {
      fillColor: GREY_HEAD,
      textColor: BLACK,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: contentW * 0.55 },
      1: { halign: "right", cellWidth: contentW * 0.22 },
      2: { halign: "right", cellWidth: contentW * 0.23 },
    },
    bodyStyles: { halign: "left" },
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.row.index === 3) {
        hook.cell.styles.fontStyle = "bold";
      }
      if (hook.section === "body" && hook.column.index > 0) {
        hook.cell.styles.halign = "right";
      }
    },
    theme: "grid",
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y += LAYOUT.afterTable;

  ensureSpace(12);
  const confirmSegments: TextSegment[] = [
    { text: "We hereby confirm that the " },
    { text: "Register of Members", bold: true, color: BLACK },
    {
      text: " is being maintained in electronic form only & the same is updated as on the above-mentioned date.",
    },
  ];
  y = drawStyledParagraph(doc, marginL, y, contentW, confirmSegments, LAYOUT.bodyFont);
  y += LAYOUT.sectionGap;

  ensureSpace(30);
  y = drawSectionHeading(doc, marginL, y, "Dematerialisation Requests");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(LAYOUT.bodyFont);
  const dematIntro =
    "Details of demat requests, if any, confirmed after 21 days and requests pending beyond 21 days are as under:";
  const dematLines = doc.splitTextToSize(dematIntro, contentW);
  for (const dl of dematLines) {
    doc.text(dl, marginL, y);
    y += LAYOUT.lineMm;
  }
  y += 1;

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR },
    tableWidth: contentW,
    head: [
      [
        "",
        "Total No. of Demat Requests",
        "No. of Requests",
        "No. of Shares",
        "Reason for Delay",
      ],
    ],
    body: [
      [
        "Confirmed after 21 days",
        data.dematConfirmedRequests,
        data.dematConfirmedRequests,
        data.dematConfirmedShares,
        "Not Applicable",
      ],
      [
        "Pending more than 21 days",
        data.dematPendingRequests,
        data.dematPendingRequests,
        data.dematPendingShares,
        "Not Applicable",
      ],
    ],
    styles: {
      fontSize: 8,
      cellPadding: { top: 1.2, right: 1.5, bottom: 1.2, left: 1.5 },
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      textColor: BLACK,
      valign: "middle",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: BLACK,
      fontStyle: "bold",
      fontSize: 7.5,
    },
    columnStyles: {
      0: { halign: "left", cellWidth: contentW * 0.28 },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
    },
    theme: "grid",
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y += LAYOUT.afterTable;

  ensureSpace(20);
  y = drawSectionHeading(doc, marginL, y, "Important Notes: -");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(LAYOUT.smallFont);
  for (const note of IMPORTANT_NOTES) {
    const lines = doc.splitTextToSize(`• ${note}`, contentW);
    ensureSpace(lines.length * LAYOUT.lineMm + 2);
    for (const line of lines) {
      doc.text(line, marginL, y);
      y += LAYOUT.lineMm;
    }
    y += 0.5;
  }
  y += 1;

  ensureSpace(25);
  const discPrefix = "In case of any discrepancy in the above report, kindly contact us immediately at Ph: ";
  const discMid = " or email ";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(LAYOUT.smallFont);
  const discParts: TextSegment[] = [
    { text: discPrefix },
    { text: data.contactPhone, bold: true, color: BLACK },
    { text: discMid },
    { text: data.contactEmail, bold: true, color: BLUE_LINK },
  ];
  y = drawStyledParagraph(doc, marginL, y, contentW, discParts, LAYOUT.smallFont);
  y += LAYOUT.sectionGap + 2;

  ensureSpace(signatureH + 22);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(LAYOUT.bodyFont);
  doc.text("Thanking You", marginL, y);
  y += LAYOUT.lineMm;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text("For HARMILAP SHARE TRANSFER AGENTS", marginL, y);
  y += LAYOUT.lineMm + 2;
  doc.addImage(signatureImage, "PNG", marginL, y, signatureW, signatureH);
  y += signatureH + 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(LAYOUT.bodyFont);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text("Authorised Signatory", marginL, y);

  const filename = pdfFilename(data);
  return { blob: doc.output("blob"), filename };
}

export type BulkProgress = {
  phase: "parsing" | "generating" | "zipping" | "done" | "error";
  current: number;
  total: number;
  message?: string;
};

export async function generateBulkShareCapitalReportsZip(
  rows: ShareCapitalExcelRow[],
  config: BulkReportConfig,
  onProgress?: (progress: BulkProgress) => void
): Promise<Blob> {
  const images = await getReportImages();
  const zip = new JSZip();
  const total = rows.length;

  onProgress?.({ phase: "generating", current: 0, total });

  for (let i = 0; i < rows.length; i++) {
    const reportData = rowToReportData(rows[i], config);
    const { blob, filename } = await generateShareCapitalReportPdfBlob(reportData, images);
    zip.file(filename, await blob.arrayBuffer());
    onProgress?.({ phase: "generating", current: i + 1, total });
  }

  onProgress?.({ phase: "zipping", current: total, total });
  const zipBlob = await zip.generateAsync({ type: "blob" });
  onProgress?.({ phase: "done", current: total, total });
  return zipBlob;
}
