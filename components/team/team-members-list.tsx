"use client";

/**
 * Team Members List Component
 *
 * Displays a list of team members with role badges and actions.
 *
 * @see docs/IMPEMENTATION.md - Phase 1.4 Team Org Creation & Invites
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Shield,
  UserMinus,
  Users,
  Crown,
  Loader2,
} from "lucide-react";

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

interface TeamMembersListProps {
  members: Member[];
  currentUserId: string;
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER";
  onRemoveMember?: (memberId: string) => void;
  onUpdateRole?: (memberId: string, newRole: "ADMIN" | "MEMBER") => void;
  isLoading?: boolean;
}

export function TeamMembersList({
  members,
  currentUserId,
  currentUserRole,
  onRemoveMember,
  onUpdateRole,
  isLoading,
}: TeamMembersListProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getRoleBadgeVariant = (
    role: string,
  ): "default" | "secondary" | "outline" => {
    switch (role) {
      case "OWNER":
        return "default";
      case "ADMIN":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "OWNER":
        return <Crown className="mr-1 h-3 w-3" />;
      case "ADMIN":
        return <Shield className="mr-1 h-3 w-3" />;
      default:
        return <Users className="mr-1 h-3 w-3" />;
    }
  };

  const canManageMember = (member: Member) => {
    // Only owners and admins can manage members
    if (currentUserRole === "MEMBER") return false;
    // Can't manage yourself
    if (member.userId === currentUserId) return false;
    // Owners can manage anyone except other owners
    if (currentUserRole === "OWNER") return member.role !== "OWNER";
    // Admins can only manage regular members
    if (currentUserRole === "ADMIN") return member.role === "MEMBER";
    return false;
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No team members</p>
      </div>
    );
  }

  // Sort members: owners first, then admins, then members
  const sortedMembers = [...members].sort((a, b) => {
    const roleOrder = { OWNER: 0, ADMIN: 1, MEMBER: 2 };
    return roleOrder[a.role] - roleOrder[b.role];
  });

  return (
    <div className="space-y-4">
      {sortedMembers.map((member) => {
        const isActionLoading = actionLoading === member.id;
        const showActions = canManageMember(member);
        const isCurrentUser = member.userId === currentUserId;

        return (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-3">
              <Avatar>
                {member.user.image && <AvatarImage src={member.user.image} />}
                <AvatarFallback>
                  {getInitials(member.user.name, member.user.email)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">
                    {member.user.name || member.user.email}
                  </p>
                  {isCurrentUser && (
                    <span className="text-muted-foreground text-xs">(you)</span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {member.user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant={getRoleBadgeVariant(member.role)}>
                {getRoleIcon(member.role)}
                {member.role}
              </Badge>

              {showActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isActionLoading}
                    >
                      {isActionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreVertical className="h-4 w-4" />
                      )}
                      <span className="sr-only">Member actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onUpdateRole && member.role !== "OWNER" && (
                      <>
                        {member.role === "MEMBER" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setActionLoading(member.id);
                              onUpdateRole(member.id, "ADMIN");
                              setActionLoading(null);
                            }}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Promote to Admin
                          </DropdownMenuItem>
                        )}
                        {member.role === "ADMIN" &&
                          currentUserRole === "OWNER" && (
                            <DropdownMenuItem
                              onClick={() => {
                                setActionLoading(member.id);
                                onUpdateRole(member.id, "MEMBER");
                                setActionLoading(null);
                              }}
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Demote to Member
                            </DropdownMenuItem>
                          )}
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {onRemoveMember && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setActionLoading(member.id);
                          onRemoveMember(member.id);
                          setActionLoading(null);
                        }}
                      >
                        <UserMinus className="mr-2 h-4 w-4" />
                        Remove from Team
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
