"use client";

import { useState } from "react";

type CompanyOption = { id: string; name: string };

export default function SecurityModals({ companies, defaultType }: { companies: CompanyOption[], defaultType: string }) {
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [depository, setDepository] = useState("NSDL");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setShowModal(false);
    setIsLoading(false);
  };

  return (
    <>
      <button onClick={() => setShowModal(true)} className="btn-primary btn-create btn-with-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Add Entry
      </button>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-in" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Add Beneficiary Position</h3>
            <form onSubmit={handleSubmit} className="flex-col gap-4 mt-4">
              
              <input type="hidden" name="securityType" value={defaultType} />

              <div className="flex gap-4">
                <select name="companyId" className="input-field" required>
                  <option value="">Select Company</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="text" name="isin" className="input-field" placeholder="ISIN" required />
              </div>

              <div className="flex gap-4 mt-2">
                <input type="text" name="securityClass" className="input-field" placeholder="Class (e.g. Equity A)" required />
                <input type="number" step="0.01" name="faceValue" className="input-field" placeholder="Face Value ₹" required />
                <select name="isFullyPaid" className="input-field">
                  <option value="true">Fully Paid Up</option>
                  <option value="false">Partly Paid Up</option>
                </select>
              </div>

              <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '0.5rem 0' }} />

              <div className="flex gap-4">
                <input type="text" name="holderPan" className="input-field" placeholder="Shareholder PAN" required />
                <input type="text" name="holderName" className="input-field" placeholder="Primary Holder Name" required />
              </div>
              <div className="flex gap-4">
                <input type="text" name="jointPan" className="input-field" placeholder="Joint Holder PAN (optional)" />
                <input type="text" name="jointName" className="input-field" placeholder="Joint Holder Name (optional)" />
              </div>

              <div className="flex gap-4 mt-2">
                <select name="depository" className="input-field" value={depository} onChange={(e) => setDepository(e.target.value)}>
                  <option value="NSDL">NSDL (Demat)</option>
                  <option value="CDSL">CDSL (Demat)</option>
                  <option value="PHYSICAL">Physical Certificate</option>
                </select>
                <input type="number" name="sharesCount" className="input-field" placeholder="Quantity (Shares)" required />
              </div>

              {depository === 'PHYSICAL' ? (
                <input type="text" name="folio" className="input-field mt-2" placeholder="Folio Number" required />
              ) : (
                <div className="flex gap-4 mt-2">
                  <input type="text" name="dpId" className="input-field" placeholder="DP ID" required />
                  <input type="text" name="clientId" className="input-field" placeholder="Client ID" required />
                </div>
              )}

              <div className="flex justify-between mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-primary btn-neutral">Cancel</button>
                <button type="submit" disabled={isLoading} className="btn-primary btn-create btn-with-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  {isLoading ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
