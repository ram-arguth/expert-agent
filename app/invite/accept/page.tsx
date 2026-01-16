import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import InviteAcceptContent from "./page-content";

export const metadata = {
  title: "Accept Invitation - Expert AI",
  description: "Accept your organization invitation",
};

// Loading component
function LoadingState() {
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

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <InviteAcceptContent />
    </Suspense>
  );
}
