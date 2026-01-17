import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Users,
  Settings,
  Shield,
  FileText,
  CreditCard,
  BarChart3,
  ClipboardList,
} from "lucide-react";
import { MembersTab } from "./members-tab";
import { ContextFilesTab } from "./context-files-tab";
import { BillingTab } from "./billing-tab";
import { UsageAnalyticsTab } from "./usage-analytics-tab";
import { AuditLogsTab } from "./audit-logs-tab";
import { SSOConfigTab } from "./sso-config-tab";

// Force dynamic rendering since this page requires auth context
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Organization - Expert AI",
  description: "Manage your organization settings and team members",
};

export default function OrganizationPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organization</h1>
          <p className="text-muted-foreground">
            Manage your team and organization settings
          </p>
        </div>
        <Badge variant="secondary">Team Plan</Badge>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="context" className="gap-2">
            <FileText className="h-4 w-4" />
            Context Files
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="usage" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* Members Tab - Uses Client Component for data fetching */}
        <TabsContent value="members">
          <MembersTab />
        </TabsContent>

        {/* Context Files Tab - Admin can upload/manage context files */}
        <TabsContent value="context">
          <ContextFilesTab />
        </TabsContent>

        {/* Billing Tab - Subscription and usage management */}
        <TabsContent value="billing">
          <BillingTab />
        </TabsContent>

        {/* Usage Analytics Tab - Per-user and per-agent consumption */}
        <TabsContent value="usage">
          <UsageAnalyticsTab />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>
                Update your organization&apos;s information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-lg">
                  <Building2 className="text-primary h-8 w-8" />
                </div>
                <Button variant="outline">Change Logo</Button>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input id="orgName" placeholder="Acme Inc." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgSlug">Organization URL</Label>
                  <Input id="orgSlug" placeholder="acme" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgDomain">Email Domain</Label>
                <Input id="orgDomain" placeholder="acme.com" />
                <p className="text-muted-foreground text-xs">
                  Users with this email domain can automatically join your
                  organization
                </p>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab - SSO Configuration */}
        <TabsContent value="security">
          <SSOConfigTab />
        </TabsContent>

        {/* Audit Logs Tab - Enterprise compliance tracking */}
        <TabsContent value="audit">
          <AuditLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
