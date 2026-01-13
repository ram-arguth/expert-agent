import Link from 'next/link';
import { Bot } from 'lucide-react';

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          {/* Logo and Copyright */}
          <div className="flex items-center gap-2">
            <Bot className="text-primary h-5 w-5" />
            <span className="text-muted-foreground text-sm">
              © {currentYear} Expert AI. All rights reserved.
            </span>
          </div>

          {/* Links */}
          <nav className="flex gap-6" aria-label="Footer navigation">
            <Link
              href="/terms"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/help"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Support
            </Link>
            <Link
              href="/docs"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Docs
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
