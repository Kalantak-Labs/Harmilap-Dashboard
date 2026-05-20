"use client";

import { useState } from "react";

type CompanyOption = { id: string; name: string };

export default function CapitalStructureModals({ companies }: { companies: CompanyOption[] }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setIsLoading(false);
    setShowAddModal(false);
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setIsLoading(false);
    setShowUploadModal(false);
  };

  const downloadTemplate = () => {
    const template = [
      "securityType,className,faceValue,numberOfShares,distinctiveNumberFrom,distinctiveNumberTo",
      "EQUITY,Class A,10,1000,1,1000",
    ].join("\n");
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(template)}`;
    link.download = "capital_structure_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => setShowAddModal(true)} className="btn-primary btn-create btn-with-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
          Add Capital Class
        </button>
        <button onClick={() => setShowUploadModal(true)} className="btn-primary btn-neutral">
          Bulk Upload
        </button>
        <button onClick={downloadTemplate} className="btn-primary btn-neutral">
          Download Template
        </button>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-in">
            <h3>Add Capital Structure Line</h3>
            <form onSubmit={handleAdd} className="flex-col gap-4 mt-4">
              <select name="companyId" className="input-field" required>
                <option value="">Select Company</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select name="securityType" className="input-field" required>
                <option value="EQUITY">Equity</option>
                <option value="PREFERENCE">Preference</option>
                <option value="DEBT">Debenture/Debt</option>
              </select>
              <div className="flex gap-4">
                <input name="className" className="input-field" placeholder="Class (A/B/etc.)" required />
                <input name="faceValue" type="number" step="0.01" className="input-field" placeholder="Face Value" required />
              </div>
              <div className="flex gap-4">
                <input name="numberOfShares" type="number" className="input-field" placeholder="No. of Shares" required />
                <input name="distinctiveNumberFrom" type="number" className="input-field" placeholder="Distinctive From" required />
                <input name="distinctiveNumberTo" type="number" className="input-field" placeholder="Distinctive To" required />
              </div>
              <div className="flex justify-between mt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-primary btn-neutral">Cancel</button>
                <button type="submit" disabled={isLoading} className="btn-primary btn-create">{isLoading ? "Saving..." : "Save Class"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-in">
            <h3>Upload Capital Structure CSV</h3>
            <p className="text-sub mt-2">Header: securityType,className,faceValue,numberOfShares,distinctiveNumberFrom,distinctiveNumberTo</p>
            <form onSubmit={handleUpload} className="flex-col gap-4 mt-4">
              <select name="companyId" className="input-field" required>
                <option value="">Select Company</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea name="csvData" className="input-field" rows={8} placeholder="Paste CSV content here..." required />
              <div className="flex justify-between mt-4">
                <button type="button" onClick={() => setShowUploadModal(false)} className="btn-primary btn-neutral">Cancel</button>
                <button type="submit" disabled={isLoading} className="btn-primary btn-create">{isLoading ? "Uploading..." : "Upload CSV"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
