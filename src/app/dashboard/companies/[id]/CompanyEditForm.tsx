"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/types";

export default function CompanyEditForm({ company }: { company: Company }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    router.push("/dashboard/companies");
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-4">
      <div className="flex gap-4">
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">CIN</label>
          <input type="text" name="cin" defaultValue={company.cin} className="input-field" required />
        </div>
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Company Name</label>
          <input type="text" name="name" defaultValue={company.name} className="input-field" required />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Date of Incorporation</label>
          <input type="date" name="dateOfIncorporation" defaultValue={company.dateOfIncorporation.toISOString().slice(0, 10)} className="input-field" required />
        </div>
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">RTA Code</label>
          <input type="text" name="rtaCode" defaultValue={company.rtaCode || ""} className="input-field" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Primary Depository</label>
          <select name="primaryDepository" defaultValue={company.primaryDepository} className="input-field">
            <option value="BOTH">NSDL + CDSL</option>
            <option value="NSDL">NSDL</option>
            <option value="CDSL">CDSL</option>
          </select>
        </div>
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">PAN Number</label>
          <input type="text" name="pan" defaultValue={company.pan || ''} className="input-field" />
        </div>
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">TAN Number</label>
          <input type="text" name="tan" defaultValue={company.tan || ''} className="input-field" />
        </div>
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">GST Number</label>
          <input type="text" name="gst" defaultValue={company.gst || ''} className="input-field" />
        </div>
      </div>

      <div className="flex-col gap-2 w-full">
        <label className="text-sub">Registered Address</label>
        <input type="text" name="regAddress" defaultValue={company.regAddress || ''} className="input-field" />
      </div>

      <div className="flex-col gap-2 w-full">
        <label className="text-sub">Correspondence / Billing Address</label>
        <input type="text" name="billingAddress" defaultValue={company.billingAddress || ''} className="input-field" />
      </div>

      <div className="flex gap-4">
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Authorised Person</label>
          <input type="text" name="authPersonName" defaultValue={company.authPersonName || ''} className="input-field" />
        </div>
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Authorised Person Contact</label>
          <input type="text" name="authPersonContact" defaultValue={company.authPersonContact || ''} className="input-field" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Accounts In-charge</label>
          <input type="text" name="accountsPersonName" defaultValue={company.accountsPersonName || ''} className="input-field" />
        </div>
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Accounts Contact</label>
          <input type="text" name="accountsContact" defaultValue={company.accountsContact || ''} className="input-field" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Company Secretary</label>
          <input type="text" name="companySecretary" defaultValue={company.companySecretary || ''} className="input-field" />
        </div>
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Company Secretary Contact</label>
          <input type="text" name="csContact" defaultValue={company.csContact || ''} className="input-field" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Contact Number 1</label>
          <input type="text" name="contactNumber1" defaultValue={company.contactNumber1 || ''} className="input-field" />
        </div>
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Contact Number 2</label>
          <input type="text" name="contactNumber2" defaultValue={company.contactNumber2 || ''} className="input-field" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Email ID 1</label>
          <input type="email" name="emailId1" defaultValue={company.emailId1 || ''} className="input-field" />
        </div>
        <div className="flex-col gap-2 w-full">
          <label className="text-sub">Email ID 2</label>
          <input type="email" name="emailId2" defaultValue={company.emailId2 || ''} className="input-field" />
        </div>
      </div>

      <div className="flex justify-end mt-6 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <button type="submit" disabled={isLoading} className="btn-primary btn-edit btn-with-icon" style={{ padding: '0.75rem 1.2rem' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
          {isLoading ? 'Saving Changes...' : 'Save Profile Updates'}
        </button>
      </div>
    </form>
  );
}
