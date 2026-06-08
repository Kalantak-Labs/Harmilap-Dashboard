"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Shield, User } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { User as UserType, Permission } from "@/lib/types";
import { useRouter } from "next/navigation";

const ALL_PERMISSIONS: { key: Permission; label: string }[] = [
  { key: "viewer", label: "Viewer" },
  { key: "editor", label: "Editor" },
  { key: "can_ingest", label: "Can Ingest" },
  { key: "can_download", label: "Can Download" },
];

interface UserModalProps {
  user?: UserType;
  onClose: () => void;
  onSaved: () => void;
}

function UserModal({ user, onClose, onSaved }: UserModalProps) {
  const { push } = useToast();
  const { user: me } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    role: user?.role ?? "user",
    permissions: user?.permissions ?? [] as Permission[],
    is_active: user?.is_active ?? true,
  });

  const togglePerm = (p: Permission) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p)
        ? f.permissions.filter((x) => x !== p)
        : [...f.permissions, p],
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = { name: form.name, email: form.email, role: form.role, permissions: form.permissions, is_active: form.is_active };
      if (!user && form.password) body.password = form.password;
      if (!user && !form.password) { push("error", "Password is required"); setLoading(false); return; }

      if (user) {
        await api.users.update(user.id, body);
        push("success", "User updated");
      } else {
        await api.users.create({ ...body, password: form.password });
        push("success", "User created");
      }
      onSaved();
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{user ? "Edit User" : "Create User"}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label required">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label required">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            {!user && (
              <div className="form-group">
                <label className="form-label required">Password</label>
                <input className="input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "admin" | "user" }))}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {form.role === "user" && (
              <div className="form-group">
                <label className="form-label">Permissions</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p.key} className="checkbox-row" style={{ padding: "5px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", userSelect: "none", background: form.permissions.includes(p.key) ? "var(--bg)" : "transparent" }}>
                      <input type="checkbox" checked={form.permissions.includes(p.key)} onChange={() => togglePerm(p.key)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {user && user.id !== me?.id && (
              <div className="form-group">
                <label className="checkbox-row">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                  <span className="form-label" style={{ margin: 0 }}>Active</span>
                </label>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : user ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { isAdmin, user: me } = useAuth();
  const { push } = useToast();
  const router = useRouter();

  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserType | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserType | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isAdmin) { router.push("/dashboard"); return; }
    load();
  }, [isAdmin]);

  const load = async () => {
    try {
      const list = await api.users.list();
      setUsers(list);
    } catch { push("error", "Failed to load users"); }
    finally { setLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await api.users.delete(deleteUser.id);
      push("success", "User deleted");
      setDeleteUser(null);
      load();
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Users</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> Add User
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="spinner-center"><span className="spinner" /></div></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><User size={28} /><div>No users yet</div></div></td></tr>
              ) : users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>
                    {u.name}
                    {u.id === me?.id && <span className="badge badge-blue" style={{ marginLeft: 6, fontSize: 11 }}>You</span>}
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{u.email}</td>
                  <td>
                    {u.role === "admin"
                      ? <span className="badge badge-yellow"><Shield size={11} /> Admin</span>
                      : <span className="badge badge-gray"><User size={11} /> User</span>}
                  </td>
                  <td>
                    {u.role === "admin"
                      ? <span style={{ color: "var(--text-muted)", fontSize: 12 }}>All</span>
                      : u.permissions.length === 0
                        ? <span style={{ color: "var(--text-muted)", fontSize: 12 }}>None</span>
                        : u.permissions.map((p) => (
                          <span key={p} className="badge badge-gray" style={{ marginRight: 4, fontSize: 11 }}>{p}</span>
                        ))}
                  </td>
                  <td>{u.is_active ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString("en-IN")}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditUser(u)}><Edit2 size={14} /></button>
                      {u.id !== me?.id && (
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "var(--danger)" }} onClick={() => setDeleteUser(u)}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <UserModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {editUser && <UserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); load(); }} />}
      {deleteUser && (
        <ConfirmModal
          title="Delete User"
          message={`Delete "${deleteUser.name}" (${deleteUser.email})? They will lose all access.`}
          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={confirmDelete}
          onClose={() => setDeleteUser(null)}
        />
      )}
    </div>
  );
}
