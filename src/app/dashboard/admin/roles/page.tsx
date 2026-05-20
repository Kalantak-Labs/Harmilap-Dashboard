import styles from "../../tables.module.css";
import AdminModals from "@/components/modals/AdminModals";
import DeleteButton from "@/components/modals/DeleteButton";
import DataTableFilter from "@/components/ui/DataTableFilter";
import ColumnFilter from "@/components/ui/ColumnFilter";
import { companies, filterUsers, roles, users } from "@/lib/mock-data";

type SearchParams = Record<string, string | undefined>;

export default async function AdminRolesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, filter, f_username, f_type, f_company } = await searchParams;
  const filtered = filterUsers({ q, filter, f_username, f_type, f_company });
  const roleFilterOpts = roles.map((r) => ({ label: `Role: ${r.name}`, value: r.id }));
  const uniqUsernames = Array.from(new Set(users.map((u) => u.username)));
  const uniqTypes = Array.from(new Set(users.map((u) => u.type)));
  const uniqLinkComps = Array.from(new Set(users.map((u) => u.company?.name).filter(Boolean))) as string[];

  return (
    <div className="flex-col gap-6">
      <header className="flex justify-between items-center mb-4">
        <div><h2>RBAC & Users Management</h2><p className="text-sub">Roles and user accounts (demo data).</p></div>
        <div className="flex gap-4">
          <DataTableFilter searchPlaceholder="Search Usernames..." filterOptions={roleFilterOpts} />
          <AdminModals roles={roles} companies={companies} />
        </div>
      </header>
      <div className={`${styles.tableWrapper} glass-panel animate-in`}>
        <table className={styles.dataTable}>
          <thead><tr>
            <th>Username <ColumnFilter columnKey="username" options={uniqUsernames} /></th>
            <th>Type <ColumnFilter columnKey="type" options={uniqTypes} /></th>
            <th>Role</th>
            <th>Company <ColumnFilter columnKey="company" options={uniqLinkComps} /></th>
            <th>Created</th><th>Action</th>
          </tr></thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td className={styles.monoCell}>{u.username}</td>
                <td>{u.type}</td>
                <td>{u.role?.name || "-"}</td>
                <td>{u.company?.name || "N/A"}</td>
                <td>{u.createdAt.toLocaleDateString()}</td>
                <td className={styles.actionCell}><DeleteButton id={u.id} type="USER" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
