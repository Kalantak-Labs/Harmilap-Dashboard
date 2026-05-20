"use client";

import { useState } from "react";

export default function CompanyModals() {
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
        Add New Client
      </button>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-in">
            <h3>Add New Client Company</h3>
            <form onSubmit={handleSubmit} className="flex-col gap-4 mt-4">
              <div className="flex gap-4">
                <input type="text" name="cin" className="input-field" placeholder="CIN (Mandatory)" required />
                <input type="text" name="name" className="input-field" placeholder="Company Name (Mandatory)" required />
              </div>
              
              <div className="flex-col gap-2">
                <label className="text-sub">Date of Incorporation</label>
                <input type="date" name="dateOfIncorporation" className="input-field" required />
              </div>

              <div className="flex gap-4">
                <input type="text" name="rtaCode" className="input-field" placeholder="RTA Code" />
                <select name="primaryDepository" className="input-field">
                  <option value="BOTH">Depository: NSDL + CDSL</option>
                  <option value="NSDL">Depository: NSDL</option>
                  <option value="CDSL">Depository: CDSL</option>
                </select>
              </div>

              <div className="flex gap-4">
                <input type="text" name="pan" className="input-field" placeholder="PAN" />
                <input type="text" name="tan" className="input-field" placeholder="TAN" />
                <input type="text" name="gst" className="input-field" placeholder="GST Number" />
              </div>

              <input type="text" name="regAddress" className="input-field" placeholder="Registered Office Address" />
              <input type="text" name="billingAddress" className="input-field" placeholder="Correspondence / Billing Address" />

              <div className="flex gap-4">
                <input type="text" name="contactNumber1" className="input-field" placeholder="Contact Number 1" />
                <input type="text" name="contactNumber2" className="input-field" placeholder="Contact Number 2" />
              </div>

              <div className="flex gap-4">
                <input type="email" name="emailId1" className="input-field" placeholder="Email ID 1" />
                <input type="email" name="emailId2" className="input-field" placeholder="Email ID 2" />
              </div>

              <div className="flex gap-4">
                <input type="text" name="authPersonName" className="input-field" placeholder="Authorised Person Name" />
                <input type="text" name="authPersonContact" className="input-field" placeholder="Authorised Person Contact" />
              </div>

              <div className="flex gap-4">
                <input type="text" name="accountsPersonName" className="input-field" placeholder="Accounts In-charge" />
                <input type="text" name="accountsContact" className="input-field" placeholder="Accounts Contact" />
              </div>

              <div className="flex gap-4">
                <input type="text" name="companySecretary" className="input-field" placeholder="Company Secretary" />
                <input type="text" name="csContact" className="input-field" placeholder="Company Secretary Contact" />
              </div>

              <div className="flex justify-between mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-primary btn-neutral">Cancel</button>
                <button type="submit" disabled={isLoading} className="btn-primary btn-create btn-with-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  {isLoading ? 'Saving...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
