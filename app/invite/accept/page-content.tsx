"use client";

/**
 * Invite Acceptance Content Component
 *
 * Displays invite details and allows the user to accept an organization invitation.
 * Redirects to the organization page on success.
 *
 * @see docs/IMPEMENTATION.md - Phase 1.4 Team Org Creation & Invites
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Building2,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  LogIn,
} from "lucide-react";

interface InviteInfo {
  id: string;
  email: string;
  orgName: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  isExpired: boolean;
}

type InviteState =
  | "loading"
  | "valid"
  | "invalid"
  | "expired"
  | "accepted"
  | "error";

export default function InviteAcceptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const token = searchParams.get("token");

  const [inviteState, setInviteState] = useState<InviteState>("loading");
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  // Fetch invite info
  const fetchInviteInfo = useCallback(async () => {
    if (!token) {
      setInviteState("invalid");
      setError("No invitation token provided");
      return;
    }

    try {
      const response = await fetch(
        `/api/invite/accept?token=${encodeURIComponent(token)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 410) {
          setInviteState("expired");
          setError("This invitation has expired");
        } else if (response.status === 404) {
          setInviteState("invalid");
          setError("Invitation not found or already used");
        } else {
          setInviteState("error");
          setError(data.message || "Failed to load invitation");
        }
        return;
      }

      setInviteInfo(data);
      setInviteState("valid");
    } catch (err) {
      console.error("Error fetching invite:", err);
      setInviteState("error");
      setError("Failed to load invitation. Please try again.");
    }
  }, [token]);

  useEffect(() => {
    fetchInviteInfo();
  }, [fetchInviteInfo]);

  // Accept the invitation
  const handleAccept = async () => {
    if (!token || !session) return;

    setIsAccepting(true);
    setError(null);

    try {
      const response = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setError(
            `This invitation was sent to ${inviteInfo?.email}. Please sign in with that email address.`,
          );
        } else if (response.status === 409) {
          setError("You are already a member of this organization");
          // Redirect anyway after a delay
          setTimeout(() => router.push("/organization"), 2000);
        } else {
          setError(data.message || "Failed to accept invitation");
        }
        return;
      }

      setInviteState("accepted");
      // Redirect to organization page
      setTimeout(() => router.push("/organization"), 2000);
    } catch (err) {
      console.error("Error accepting invite:", err);
      setError("Failed to accept invitation. Please try again.");
    } finally {
      setIsAccepting(false);
    }
  };

  // Format role for display
  const formatRole = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "Administrator";
      case "MEMBER":
        return "Member";
      case "AUDITOR":
        return "Auditor";
      case "BILLING_MANAGER":
        return "Billing Manager";
      default:
        return role;
    }
  };

  // Loading state
  if (inviteState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token
  if (inviteState === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <CardTitle className="mt-4">Invalid Invitation</CardTitle>
            <CardDescription>
              {error || "This invitation link is not valid."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired invitation
  if (inviteState === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
            <CardTitle className="mt-4">Invitation Expired</CardTitle>
            <CardDescription>
              This invitation has expired. Please contact the organization
              administrator for a new invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Accepted state
  if (inviteState === "accepted") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <CardTitle className="mt-4">
              Welcome to {inviteInfo?.orgName}!
            </CardTitle>
            <CardDescription>
              You have successfully joined the organization as{" "}
              {formatRole(inviteInfo?.role || "MEMBER")}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground text-sm">
              Redirecting to your organization...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state (not logged in or other errors)
  if (!session && sessionStatus !== "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <LogIn className="mx-auto h-12 w-12 text-primary" />
            <CardTitle className="mt-4">Sign In Required</CardTitle>
            <CardDescription>
              Please sign in to accept this invitation to join{" "}
              {inviteInfo?.orgName || "an organization"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              onClick={() =>
                router.push(
                  `/login?callbackUrl=${encodeURIComponent(`/invite/accept?token=${token}`)}`,
                )
              }
            >
              Sign In to Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid invitation - show accept form
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="mt-4">You&apos;re Invited!</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join an organization on Expert AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invite Details */}
          <div className="space-y-3 rounded-lg bg-muted p-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-medium">{inviteInfo?.orgName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Your Role</span>
              <span className="font-medium">
                {formatRole(inviteInfo?.role || "")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invited By</span>
              <span className="font-medium">{inviteInfo?.invitedBy}</span>
            </div>
          </div>

          {/* Email mismatch warning */}
          {session?.user?.email &&
            inviteInfo?.email &&
            session.user.email !== inviteInfo.email && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Email Mismatch</AlertTitle>
                <AlertDescription>
                  This invitation was sent to{" "}
                  <strong>{inviteInfo.email}</strong>, but you&apos;re signed in
                  as <strong>{session.user.email}</strong>. Please sign in with
                  the correct email address.
                </AlertDescription>
              </Alert>
            )}

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push("/dashboard")}
            >
              Decline
            </Button>
            <Button
              className="flex-1"
              onClick={handleAccept}
              disabled={
                isAccepting || session?.user?.email !== inviteInfo?.email
              }
            >
              {isAccepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                "Accept Invitation"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
