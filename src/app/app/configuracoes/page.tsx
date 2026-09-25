import { requireWorkspace } from "@/server/session";
import { PageHeader, Button } from "@/components/ui";
import { switchWorkspace } from "@/features/organizations/actions";
import { LogoutButton } from "@/features/auth/logout-button";
export default async function Page() {
  const { membership, memberships, user } = await requireWorkspace();
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Seu perfil e seus espaços de trabalho."
      />
      <div className="form-card">
        <h2>Organização ativa</h2>
        <form action={switchWorkspace} className="workspace-form">
          <label className="field">
            Organização
            <select
              name="organizationId"
              defaultValue={membership.organizationId}
            >
              {memberships.map((item) => (
                <option value={item.organizationId} key={item.organizationId}>
                  {item.organization.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Usar organização</Button>
        </form>
        <h2 style={{ marginTop: 40 }}>Sua conta</h2>
        <p>
          {user.name}
          <br />
          {user.email}
        </p>
        <LogoutButton />
      </div>
    </>
  );
}
