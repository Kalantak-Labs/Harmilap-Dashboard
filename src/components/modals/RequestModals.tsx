"use client";

import { useState } from "react";

type CompanyOption = { id: string; name: string };

export default function RequestModals({ companies }: { companies: CompanyOption[] }) {
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
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
        Create Request
      </button>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-in">
            <h3>New Online Request</h3>
            <form onSubmit={handleSubmit} className="flex-col gap-4 mt-4">
              <select name="companyId" className="input-field" required>
                <option value="">Select Company</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select name="type" className="input-field" required>
                <option value="RTA_PROPOSAL">RTA Proposal</option>
                <option value="NEW_COMPANY_DRAFT">New Company Draft</option>
                <option value="CHANGE_BILLING_GST">Change Billing Address / GST</option>
                <option value="CHANGE_EMAIL_CONTACT">Change Email / Contact</option>
                <option value="CHANGE_AUTH_SIGNATORY">Change Authorized Signatory</option>
                <option value="NSDL_INVOICE_REQUEST">NSDL Invoice Request</option>
                <option value="ISIN_ACTIVATION">ISIN Activation</option>
                <option value="RIGHT_ISSUE">Right Issue</option>
                <option value="BUYBACK">Buyback</option>
                <option value="DEBENTURE_ADMISSION">Debenture Admission</option>
              </select>
              <input name="title" className="input-field" placeholder="Request title" required />
              <textarea name="details" className="input-field" rows={4} placeholder="Request details" />
              <input name="requestedBy" className="input-field" placeholder="Requested by" required />
              <select name="preferredFormat" className="input-field">
                <option value="">Preferred Download Format</option>
                <option value="PDF">PDF</option>
                <option value="EXCEL">Excel</option>
                <option value="WORD">Word</option>
              </select>
              <div className="flex justify-between mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-primary btn-neutral">Cancel</button>
                <button type="submit" disabled={isLoading} className="btn-primary btn-create">{isLoading ? "Submitting..." : "Submit Request"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
