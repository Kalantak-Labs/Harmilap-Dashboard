import * as XLSX from "xlsx";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/sample");

const headers = [
  "RTA Code",
  "ISIN",
  "Company Name",
  "Address Line 1",
  "Address Line 2",
  "Address Line 3",
  "State",
  "Security Type",
  "NSDL Shares",
  "CDSL Shares",
  "Physical Shares",
  "Total Shares",
  "Demat Confirmed Requests",
  "Demat Confirmed Shares",
  "Demat Pending Requests",
  "Demat Pending Shares",
  "Email",
];

const rows = [
  {
    "RTA Code": "RTAN3176",
    ISIN: "INE1K4M03018",
    "Company Name": "CLUB OFFLINE TECHNOLOGIES PRIVATE LIMITED-PREFERENCE",
    "Address Line 1": "E-1/12, VASANT VIHAR",
    "Address Line 2": "",
    "Address Line 3": "",
    State: "NEW DELHI, 110057, DELHI",
    "Security Type": "PREFERENCE",
    "NSDL Shares": 2079,
    "CDSL Shares": 0,
    "Physical Shares": 0,
    "Total Shares": 2079,
    "Demat Confirmed Requests": "Zero",
    "Demat Confirmed Shares": "Zero",
    "Demat Pending Requests": "Zero",
    "Demat Pending Shares": "Zero",
    Email: "client1@example.com",
  },
  {
    "RTA Code": "RTAN4201",
    ISIN: "INE000A01010",
    "Company Name": "DUMMY RTA CLIENT LTD",
    "Address Line 1": "123 Dummy Street",
    "Address Line 2": "Indra Nagar",
    "Address Line 3": "Near Azadpur Mandi",
    State: "NEW DELHI, 110033, DELHI",
    "Security Type": "EQUITY",
    "NSDL Shares": 6000,
    "CDSL Shares": 4000,
    "Physical Shares": 0,
    "Total Shares": 10000,
    "Demat Confirmed Requests": "Zero",
    "Demat Confirmed Shares": "Zero",
    "Demat Pending Requests": "Zero",
    "Demat Pending Shares": "Zero",
    Email: "client2@example.com",
  },
];

mkdirSync(outDir, { recursive: true });
const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Reports");
const outPath = join(outDir, "share-capital-reports-bulk.xlsx");
XLSX.writeFile(wb, outPath);
console.log("Wrote", outPath);
