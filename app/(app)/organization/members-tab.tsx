"use client";

/**
 * Members Tab - Organization Team Management
 *
 * Client component that fetches and displays team members, pending invites,
 * and the invite form. Uses the team management components from components/team/.
 *
 * @see components/team/ for InviteForm, TeamMembersList, PendingInvitesList
 * @see docs/IMPEMENTATION.md - Phase 1.4 Team Org Creation & Invites
 */

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteForm } from "@/components/team/invite-form";
import { TeamMembersList } from "@/components/team/team-members-list";
import { PendingInvitesList } from "@/components/team/pending-invites-list";
import { useWorkspace } from "@/lib/context/workspace-context";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

interface Member {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface Invite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
}

export function MembersTab() {
  const { activeOrgId, activeOrg } = useWorkspace();
  const { data: session } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = session?.user?.id || "";
  const currentUserRole =
    (activeOrg?.role?.toUpperCase() as "OWNER" | "ADMIN" | "MEMBER") ||
    "MEMBER";
  const canInvite = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  // Fetch members from API
  const fetchMembers = useCallback(async () => {
    if (!activeOrgId) return;

    try {
      const response = await fetch(`/api/org/${activeOrgId}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  }, [activeOrgId]);

  // Fetch invites from API
  const fetchInvites = useCallback(async () => {
    if (!activeOrgId) return;

    try {
      const response = await fetch(`/api/org/${activeOrgId}/invite`);
      if (response.ok) {
        const data = await response.json();
        setInvites(data.invites || []);
      }
    } catch (err) {
      console.error("Failed to fetch invites:", err);
    }
  }, [activeOrgId]);

  // Initial data loading
  useEffect(() => {
    const loadData = async () => {
      if (!activeOrgId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        await Promise.all([fetchMembers(), fetchInvites()]);
      } catch (err) {
        setError("Failed to load team data");
        console.error("Failed to load team data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [activeOrgId, fetchMembers, fetchInvites]);

  // Callback when an invite is successfully sent
  const handleInviteSent = useCallback(() => {
    // Refresh invites list
    fetchInvites();
  }, [fetchInvites]);

  // Callback when an invite is revoked
  const handleInviteRevoked = useCallback((inviteId: string) => {
    // Remove invite from local state
    setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
  }, []);

  // Callback when a member is removed
  const handleRemoveMember = useCallback(
    async (membershipId: string) => {
      if (!activeOrgId) return;

      try {
        const response = await fetch(
          `/api/org/${activeOrgId}/members/${membershipId}`,
          {
            method: "DELETE",
          },
        );

        if (response.ok) {
          setMembers((prev) => prev.filter((m) => m.id !== membershipId));
        }
      } catch (err) {
        console.error("Failed to remove member:", err);
      }
    },
    [activeOrgId],
  );

  // Callback when a member's role is updated
  const handleUpdateRole = useCallback(
    async (membershipId: string, newRole: "ADMIN" | "MEMBER") => {
      if (!activeOrgId) return;

      try {
        const response = await fetch(
          `/api/org/${activeOrgId}/members/${membershipId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: newRole }),
          },
        );

        if (response.ok) {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === membershipId ? { ...m, role: newRole } : m,
            ),
          );
        }
      } catch (err) {
        console.error("Failed to update role:", err);
      }
    },
    [activeOrgId],
  );

  // No org selected - show message
  if (!activeOrgId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            Select an organization to manage team members
          </p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite Member Section - Only show for owners/admins */}
      {canInvite && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Team Members</CardTitle>
            <CardDescription>
              Send invitations to add new members to your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm orgId={activeOrgId} onSuccess={handleInviteSent} />
          </CardContent>
        </Card>
      )}

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {members.length} member{members.length !== 1 ? "s" : ""} in your
            organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMembersList
            members={members}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onRemoveMember={handleRemoveMember}
            onUpdateRole={handleUpdateRole}
          />
        </CardContent>
      </Card>

      {/* Pending Invites Section */}
      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              {invites.filter((i) => i.status === "PENDING").length} invitation
              {invites.filter((i) => i.status === "PENDING").length !== 1
                ? "s"
                : ""}{" "}
              waiting for response
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PendingInvitesList
              invites={invites}
              orgId={activeOrgId}
              onRevoke={handleInviteRevoked}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
