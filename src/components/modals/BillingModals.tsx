"use client";

import { useState } from "react";

type CompanyOption = { id: string; name: string; cin: string };

export default function BillingModals({ companies }: { companies: CompanyOption[] }) {
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
        Generate Invoice
      </button>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-in">
            <h3>Generate Issuer Invoice</h3>
            <form onSubmit={handleSubmit} className="flex-col gap-4 mt-4">
              
              <select name="companyId" className="input-field" required>
                <option value="">Select Issuer Company...</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name} - {c.cin}</option>
                ))}
              </select>

              <div className="flex gap-4">
                <div className="flex-col gap-2 w-full">
                  <label className="text-sub">Invoice Date</label>
                  <input type="date" name="date" className="input-field" required />
                </div>
                <div className="flex-col gap-2 w-full">
                  <label className="text-sub">Due Date</label>
                  <input type="date" name="dueDate" className="input-field" />
                </div>
              </div>

              <div className="flex gap-4">
                <input type="number" step="0.01" name="joiningFees" className="input-field" placeholder="Joining Fees" />
                <input type="number" step="0.01" name="annualMaintenance" className="input-field" placeholder="Annual Maintenance" />
              </div>
              <div className="flex gap-4">
                <input type="number" step="0.01" name="corporateActionFees" className="input-field" placeholder="Corporate Action Fees" />
                <input type="number" step="0.01" name="documentationFees" className="input-field" placeholder="Documentation Fees" />
              </div>
              <div className="flex gap-4">
                <input type="number" step="0.01" name="professionalFees" className="input-field" placeholder="Professional Fees" />
                <input type="number" step="0.01" name="outstanding" className="input-field" placeholder="Outstanding" />
              </div>
              <div className="flex gap-4">
                <input type="number" step="0.01" name="depositoryCharges" className="input-field" placeholder="Depository Charges" />
                <input type="number" step="0.01" name="stampCharges" className="input-field" placeholder="Stamp Charges" />
              </div>
              <input type="number" step="0.01" name="gstRate" defaultValue={18} className="input-field" placeholder="GST Rate (%)" />
              
              <div className="flex justify-between mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-primary btn-neutral">Cancel</button>
                <button type="submit" disabled={isLoading} className="btn-primary btn-create btn-with-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  {isLoading ? 'Saving...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
