"use client";

import { useState } from "react";

type RoleOption = { id: string; name: string };
type CompanyOption = { id: string; name: string };

export default function AdminModals({ roles, companies }: { roles: RoleOption[], companies: CompanyOption[] }) {
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState("EMPLOYEE");

  const handleCreateRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setIsLoading(false);
    setShowRoleModal(false);
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setIsLoading(false);
    setShowUserModal(false);
  };

  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => setShowRoleModal(true)} className="btn-primary btn-edit btn-with-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
          Manage Roles
        </button>
        <button onClick={() => setShowUserModal(true)} className="btn-primary btn-create btn-with-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Create User
        </button>
      </div>

      {showRoleModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-in">
            <h3>Create New Role</h3>
            <form onSubmit={handleCreateRole} className="flex-col gap-4 mt-4">
              <input type="text" name="name" className="input-field" placeholder="Role Name (e.g. Data Entry)" required />
              <input type="text" name="description" className="input-field" placeholder="Description" />
              <div className="flex justify-between mt-4">
                <button type="button" onClick={() => setShowRoleModal(false)} className="btn-primary btn-neutral">Cancel</button>
                <button type="submit" disabled={isLoading} className="btn-primary btn-create btn-with-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  {isLoading ? 'Saving...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-in">
            <h3>Create New User Account</h3>
            <form onSubmit={handleCreateUser} className="flex-col gap-4 mt-4">
              <input type="text" name="username" className="input-field" placeholder="Username / ID" required />
              <input type="password" name="password" className="input-field" placeholder="Password" required />
              
              <select name="type" className="input-field" value={userType} onChange={(e) => setUserType(e.target.value)} required>
                <option value="EMPLOYEE">Employee (RTA Staff)</option>
                <option value="ADMIN">Admin</option>
                <option value="COMPANY">Issuer Company</option>
                <option value="SHAREHOLDER">Shareholder</option>
              </select>

              <select name="roleId" className="input-field">
                <option value="">No Custom Role</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>

              {userType === 'COMPANY' && (
                <select name="companyId" className="input-field" required>
                  <option value="">Select Linked Company...</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              <div className="flex justify-between mt-4">
                <button type="button" onClick={() => setShowUserModal(false)} className="btn-primary btn-neutral">Cancel</button>
                <button type="submit" disabled={isLoading} className="btn-primary btn-create btn-with-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  {isLoading ? 'Saving...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
