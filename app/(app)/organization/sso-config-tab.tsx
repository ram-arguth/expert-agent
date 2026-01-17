/**
 * SSO Config Tab Component
 *
 * Enterprise SSO configuration and domain verification.
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.1
 */

"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Shield, CheckCircle, XCircle, Copy, ExternalLink } from "lucide-react";
import { useWorkspace } from "@/lib/context/workspace-context";

// =============================================================================
// Types
// =============================================================================

interface SSOConfig {
  domain: string | null;
  domainVerified: boolean;
  verificationToken: string | null;
  ssoConfig: {
    provider?: "saml" | "oidc";
    entityId?: string;
    ssoUrl?: string;
    clientId?: string;
    issuerUrl?: string;
  } | null;
  isEnterprise: boolean;
}

const PROVIDER_OPTIONS = [
  { value: "saml", label: "SAML 2.0" },
  { value: "oidc", label: "OpenID Connect" },
];

// =============================================================================
// Component
// =============================================================================

export function SSOConfigTab() {
  const { activeOrg, isLoading: workspaceLoading } = useWorkspace();
  const [config, setConfig] = React.useState<SSOConfig | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Form state
  const [provider, setProvider] = React.useState<string>("saml");
  const [entityId, setEntityId] = React.useState("");
  const [ssoUrl, setSsoUrl] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [issuerUrl, setIssuerUrl] = React.useState("");

  // Fetch config
  React.useEffect(() => {
    async function fetchConfig() {
      if (!activeOrg?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/org/${activeOrg.id}/sso`);
        if (!response.ok) throw new Error("Failed to fetch SSO config");
        const data = await response.json();
        setConfig(data);

        // Populate form
        if (data.ssoConfig) {
          setProvider(data.ssoConfig.provider || "saml");
          setEntityId(data.ssoConfig.entityId || "");
          setSsoUrl(data.ssoConfig.ssoUrl || "");
          setClientId(data.ssoConfig.clientId || "");
          setIssuerUrl(data.ssoConfig.issuerUrl || "");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    fetchConfig();
  }, [activeOrg?.id]);

  // Save config
  const handleSave = async () => {
    if (!activeOrg?.id) return;

    setIsSaving(true);
    try {
      const body =
        provider === "saml"
          ? { provider, entityId, ssoUrl }
          : { provider, clientId, issuerUrl };

      const response = await fetch(`/api/org/${activeOrg.id}/sso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to save SSO config");

      // Refresh config
      const data = await response.json();
      setConfig((prev) =>
        prev ? { ...prev, ssoConfig: data.ssoConfig } : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  // Copy token to clipboard
  const copyToken = () => {
    if (config?.verificationToken) {
      navigator.clipboard.writeText(config.verificationToken);
    }
  };

  // Loading state
  if (workspaceLoading || isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  // No org context
  if (!activeOrg) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Select an organization to configure SSO
          </p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Domain Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Domain Verification
          </CardTitle>
          <CardDescription>
            Verify your domain to enable enterprise features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Domain</p>
              <p className="text-muted-foreground text-sm">
                {config?.domain || "Not configured"}
              </p>
            </div>
            {config?.domainVerified ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" />
                Not Verified
              </Badge>
            )}
          </div>

          {config?.verificationToken && !config.domainVerified && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Verification Token</Label>
                <p className="text-sm text-muted-foreground">
                  Add this TXT record to your DNS to verify domain ownership.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">
                    expert-ai-verify={config.verificationToken}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyToken}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* SSO Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Single Sign-On (SSO)</CardTitle>
          <CardDescription>
            Configure SAML or OIDC authentication for your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>SSO Provider</Label>
            <Select
              value={provider}
              onValueChange={setProvider}
              options={PROVIDER_OPTIONS}
              className="w-[200px]"
            />
          </div>

          {provider === "saml" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="entityId">Entity ID</Label>
                <Input
                  id="entityId"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder="https://idp.example.com/entity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ssoUrl">SSO URL</Label>
                <Input
                  id="ssoUrl"
                  value={ssoUrl}
                  onChange={(e) => setSsoUrl(e.target.value)}
                  placeholder="https://idp.example.com/sso"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="your-client-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuerUrl">Issuer URL</Label>
                <Input
                  id="issuerUrl"
                  value={issuerUrl}
                  onChange={(e) => setIssuerUrl(e.target.value)}
                  placeholder="https://auth.example.com"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" asChild>
              <a
                href="https://docs.expert-ai.io/sso"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Documentation
              </a>
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
