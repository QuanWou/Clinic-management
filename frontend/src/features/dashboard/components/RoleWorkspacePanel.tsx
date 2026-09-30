import { getWorkspaceCopy } from '../../../utils/roles';

type RoleWorkspacePanelProps = {
  primaryRole: string;
};

export default function RoleWorkspacePanel({ primaryRole }: RoleWorkspacePanelProps) {
  return (
    <article className="panel">
      <h3>Role workspace</h3>
      <p>{getWorkspaceCopy(primaryRole)}</p>
    </article>
  );
}
