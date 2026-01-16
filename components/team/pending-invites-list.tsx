"use client";

/**
 * Pending Invites List Component
 *
 * Displays a list of pending team invitations with actions to resend or revoke.
 *
 * @see docs/IMPEMENTATION.md - Phase 1.4 Team Org Creation & Invites
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, XCircle, Clock } from "lucide-react";

interface Invite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
}

interface PendingInvitesListProps {
  invites: Invite[];
  orgId: string;
  onRevoke?: (inviteId: string) => void;
  onResend?: (inviteId: string) => void;
  isLoading?: boolean;
}

export function PendingInvitesList({
  invites,
  orgId,
  onRevoke,
  onResend,
  isLoading,
}: PendingInvitesListProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleRevoke = async (inviteId: string) => {
    setActionLoading(inviteId);
    try {
      const response = await fetch(
        `/api/org/${orgId}/invite?inviteId=${inviteId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to revoke invitation");
      }

      onRevoke?.(inviteId);
    } catch (error) {
      console.error("Failed to revoke invite:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const getExpiryStatus = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return { expired: true, text: "Expired" };
    if (diffDays === 1) return { expired: false, text: "Expires tomorrow" };
    if (diffDays <= 3)
      return { expired: false, text: `Expires in ${diffDays} days` };
    return { expired: false, text: `${diffDays} days left` };
  };

  const pendingInvites = invites.filter(
    (invite) => invite.status === "PENDING",
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (pendingInvites.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <Mail className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No pending invitations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingInvites.map((invite) => {
        const expiry = getExpiryStatus(invite.expiresAt);
        const isActionLoading = actionLoading === invite.id;

        return (
          <div
            key={invite.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-3">
              <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{invite.email}</p>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <span>Invited {formatTimeAgo(invite.createdAt)}</span>
                  <span>•</span>
                  <Badge
                    variant={invite.role === "ADMIN" ? "default" : "secondary"}
                  >
                    {invite.role}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-sm">
                <Clock className="h-3.5 w-3.5" />
                <span
                  className={
                    expiry.expired
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  {expiry.text}
                </span>
              </div>

              <div className="flex gap-2">
                {onResend && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isActionLoading}
                    onClick={() => onResend(invite.id)}
                  >
                    Resend
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isActionLoading}
                  onClick={() => handleRevoke(invite.id)}
                >
                  {isActionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span className="sr-only">Revoke invitation</span>
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
