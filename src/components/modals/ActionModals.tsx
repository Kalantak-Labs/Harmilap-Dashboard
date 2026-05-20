"use client";

import { useState } from "react";

type SecurityOption = { id: string; isin: string; company: { name: string } };

export default function ActionModals({ securities }: { securities: SecurityOption[] }) {
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setIsLoading(false);
    setShowModal(false);
  };

  return (
    <>
      <button onClick={() => setShowModal(true)} className="btn-primary btn-create btn-with-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Initiate Action
      </button>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-in">
            <h3>Initiate Corporate Action</h3>
            <form onSubmit={handleSubmit} className="flex-col gap-4 mt-4">
              
              <select name="securityId" className="input-field" required>
                <option value="">Select Target Security ISIN...</option>
                {securities.map(s => (
                  <option key={s.id} value={s.id}>{s.company.name} - {s.isin}</option>
                ))}
              </select>

              <div className="flex-col gap-2">
                <label className="text-sub">Allotment Date</label>
                <input type="date" name="allotmentDate" className="input-field" required />
              </div>

              <div className="flex gap-4">
                <input type="number" step="0.01" name="faceValue" className="input-field" placeholder="Face Val" required />
                <input type="number" step="0.01" name="premium" className="input-field" placeholder="Premium" required />
                <input type="number" step="0.01" name="paidUpValue" className="input-field" placeholder="Paid Up" required />
              </div>

              <div className="flex gap-4">
                <input type="number" name="nsdlHolders" className="input-field" placeholder="NSDL Holder Count" required />
                <input type="number" name="cdslHolders" className="input-field" placeholder="CDSL Holder Count" required />
                <input type="number" name="physicalHolders" className="input-field" placeholder="Physical Holder Count" required />
              </div>

              <input type="number" name="totalShares" className="input-field" placeholder="Total Shares Issued" required />
              <input type="number" step="0.01" name="stampDuty" className="input-field" placeholder="Stamp Duty" />

              <div className="flex gap-4">
                <div className="flex-col gap-2 w-full">
                  <label className="text-sub">Execution Date</label>
                  <input type="date" name="executionDate" className="input-field" />
                </div>
                <div className="flex-col gap-2 w-full">
                  <label className="text-sub">Bank Date</label>
                  <input type="date" name="bankDate" className="input-field" />
                </div>
              </div>

              <div className="flex justify-between mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-primary btn-neutral">Cancel</button>
                <button type="submit" disabled={isLoading} className="btn-primary btn-create btn-with-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  {isLoading ? 'Processing...' : 'Execute Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
