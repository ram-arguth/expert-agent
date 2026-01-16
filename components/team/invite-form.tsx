"use client";

/**
 * Invite Form Component
 *
 * Form for inviting new team members to an organization.
 * Validates email format and role selection before sending invite.
 *
 * @see docs/IMPEMENTATION.md - Phase 1.4 Team Org Creation & Invites
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Mail, Loader2, CheckCircle } from "lucide-react";

// Validation schema for invite form
const inviteFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["MEMBER", "ADMIN"], {
    required_error: "Please select a role",
  }),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;

interface InviteFormProps {
  orgId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

// Role options for the select
const roleOptions = [
  { value: "MEMBER", label: "Member" },
  { value: "ADMIN", label: "Admin" },
];

export function InviteForm({
  orgId,
  onSuccess,
  onError,
  disabled,
}: InviteFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      role: "MEMBER",
    },
  });

  const selectedRole = watch("role");

  const onSubmit = async (data: InviteFormValues) => {
    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/org/${orgId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send invitation");
      }

      setSuccessMessage(`Invitation sent to ${data.email}`);
      reset();
      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send invitation";
      onError?.(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="invite-email">Email Address</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="colleague@example.com"
            disabled={disabled || isSubmitting}
            {...register("email")}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="text-destructive text-sm">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="w-full space-y-2 sm:w-40">
          <Label htmlFor="invite-role">Role</Label>
          <Select
            id="invite-role"
            value={selectedRole}
            onValueChange={(value) =>
              setValue("role", value as "MEMBER" | "ADMIN")
            }
            disabled={disabled || isSubmitting}
            options={roleOptions}
            placeholder="Select role"
            error={errors.role?.message}
          />
        </div>

        <Button type="submit" disabled={disabled || isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Send Invite
            </>
          )}
        </Button>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          {successMessage}
        </div>
      )}
    </form>
  );
}
