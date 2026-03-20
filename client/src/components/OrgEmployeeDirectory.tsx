import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { agentsApi } from "../api/agents";
import { accessApi } from "../api/access";
import { queryKeys } from "../lib/queryKeys";
import { agentUrl } from "../lib/utils";
import { ApiError } from "../api/client";
import type { Agent } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Bot } from "lucide-react";

type Props = {
  companyId: string;
};

async function fetchAgentsWithTerminatedFallback(companyId: string): Promise<Agent[]> {
  try {
    return await agentsApi.list(companyId, { includeTerminated: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      return agentsApi.list(companyId);
    }
    throw e;
  }
}

export function OrgEmployeeDirectory({ companyId }: Props) {
  const queryClient = useQueryClient();

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: queryKeys.agents.list(companyId, { includeTerminated: true }),
    queryFn: () => fetchAgentsWithTerminatedFallback(companyId),
    enabled: !!companyId,
  });

  const {
    data: members,
    isLoading: membersLoading,
    isError: membersError,
    error: membersErr,
  } = useQuery({
    queryKey: queryKeys.access.members(companyId),
    queryFn: () => accessApi.listMembers(companyId),
    enabled: !!companyId,
    retry: false,
  });

  const byId = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents ?? []) m.set(a.id, a);
    return m;
  }, [agents]);

  const restore = useMutation({
    mutationFn: (agentId: string) => agentsApi.update(agentId, { status: "idle" }, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId, { includeTerminated: true }) });
      queryClient.invalidateQueries({ queryKey: queryKeys.org(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.access.members(companyId) });
    },
  });

  const humanMembers = (members ?? []).filter((m) => m.principalType === "user");
  const agentMemberships = (members ?? []).filter((m) => m.principalType === "agent");

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          AI employees (agents)
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Reporting and execution use agent records. Links open the agent profile.
        </p>
        {agentsLoading ? (
          <p className="text-sm text-muted-foreground mt-3">Loading agents…</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground text-xs">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Reports to</th>
                  <th className="py-2 font-medium w-28" />
                </tr>
              </thead>
              <tbody>
                {(agents ?? []).map((a) => {
                  const mgr = a.reportsTo ? byId.get(a.reportsTo) : null;
                  return (
                    <tr key={a.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3">
                        <Link to={agentUrl(a)} className="font-medium text-foreground hover:underline">
                          {a.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{a.role}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="secondary" className="font-normal">
                          {a.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground text-xs">
                        {mgr ? mgr.name : a.reportsTo ? `…${a.reportsTo.slice(0, 8)}` : "—"}
                      </td>
                      <td className="py-2">
                        {a.status === "terminated" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={restore.isPending}
                            onClick={() => {
                              if (
                                !confirm(
                                  `Restore “${a.name}” to active duty? They will return to idle status.`,
                                )
                              ) {
                                return;
                              }
                              restore.mutate(a.id);
                            }}
                          >
                            Restore
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(agents ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">No agents in this company.</p>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          People (human members)
          <Badge variant="outline" className="ml-1 text-[10px] font-normal">
            Coming soon — richer directory
          </Badge>
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Membership rows from the server. Display names and email will appear when the enriched members API
          ships.
        </p>
        {membersLoading ? (
          <p className="text-sm text-muted-foreground mt-3">Loading members…</p>
        ) : membersError ? (
          <p className="text-sm text-muted-foreground mt-3">
            {membersErr instanceof ApiError && membersErr.status === 403
              ? "Member list requires users:manage_permissions (or use an owner / admin account)."
              : "Could not load members."}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground text-xs">
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Principal id</th>
                  <th className="py-2 pr-3 font-medium">Membership</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {humanMembers.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3">
                      <Badge variant="secondary">User</Badge>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.principalId}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.membershipRole ?? "—"}</td>
                    <td className="py-2">{row.status}</td>
                  </tr>
                ))}
                {agentMemberships.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3">
                      <Badge variant="outline">Agent membership</Badge>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.principalId}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.membershipRole ?? "—"}</td>
                    <td className="py-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {humanMembers.length === 0 && agentMemberships.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">No membership rows returned.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
