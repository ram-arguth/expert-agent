'use client';

import { Button, ButtonProps } from '@/components/ui/button';
import { Url } from 'next/dist/shared/lib/router/router';
import Link from 'next/link';

interface AbCtaButtonProps extends ButtonProps {
  experimentId: string;
  variantId: string;
  agentId: string;
  conversionType?: string;
  href?: string | Url;  // Optional href to make it function as a Link
}

/**
 * A/B Test CTA Button
 * 
 * Tracks a conversion event when clicked.
 * Supports being used as a Link (via asChild pattern + href) or standard button.
 */
export function AbCtaButton({
  experimentId,
  variantId,
  agentId,
  conversionType = 'cta_click',
  href,
  onClick,
  children,
  ...props
}: AbCtaButtonProps) {

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Log conversion
    console.log(`[Experiment Conversion] ${conversionType} for ${experimentId}:${variantId} (Agent: ${agentId})`);
    
    // Call original onClick if provided
    if (onClick) {
      onClick(e);
    }
  };

  // If href is provided, wrap in Link but keep Button styling
  if (href) {
    return (
      <Button asChild {...props} onClick={handleClick}>
        <Link href={href}>
          {children}
        </Link>
      </Button>
    );
  }

  return (
    <Button {...props} onClick={handleClick}>
      {children}
    </Button>
  );
}
