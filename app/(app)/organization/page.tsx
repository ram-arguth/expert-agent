import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Building2, Users, Settings, Shield, Mail, Plus, MoreVertical } from 'lucide-react';

export const metadata = {
  title: 'Organization - Expert AI',
  description: 'Manage your organization settings and team members',
};

// Mock team data
const teamMembers = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'Admin', avatar: null },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'Member', avatar: null },
  { id: '3', name: 'Bob Johnson', email: 'bob@example.com', role: 'Member', avatar: null },
];

const pendingInvites = [
  { email: 'alice@example.com', role: 'Member', sentAt: '2 days ago' },
];

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
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-6">
          {/* Invite Member */}
          <Card>
            <CardHeader>
              <CardTitle>Invite Team Members</CardTitle>
              <CardDescription>
                Send invitations to add new members to your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input placeholder="Email address" type="email" />
                </div>
                <Button>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invite
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    {teamMembers.length} members in your organization
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        {member.avatar && <AvatarImage src={member.avatar} />}
                        <AvatarFallback>
                          {member.name.split(' ').map((n) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-muted-foreground text-sm">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.role === 'Admin' ? 'default' : 'secondary'}>
                        {member.role}
                      </Badge>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>
                  {pendingInvites.length} invitation{pendingInvites.length > 1 ? 's' : ''} waiting for response
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingInvites.map((invite) => (
                    <div key={invite.email} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <p className="text-muted-foreground text-sm">
                          Invited {invite.sentAt} • {invite.role}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          Resend
                        </Button>
                        <Button variant="ghost" size="sm">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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
                  Users with this email domain can automatically join your organization
                </p>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure security options for your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Single Sign-On (SSO)</p>
                  <p className="text-muted-foreground text-sm">
                    Configure SAML or OIDC authentication
                  </p>
                </div>
                <Button variant="outline">Configure</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Require Two-Factor Authentication</p>
                  <p className="text-muted-foreground text-sm">
                    Enforce 2FA for all organization members
                  </p>
                </div>
                <Button variant="outline">Enable</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Allowed Authentication Methods</p>
                  <p className="text-muted-foreground text-sm">
                    Control which sign-in methods are available
                  </p>
                </div>
                <Button variant="outline">Manage</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
