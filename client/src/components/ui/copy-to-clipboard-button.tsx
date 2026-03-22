'use client';

import * as React from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CopyToClipboardButton({
  text,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'onClick' | 'children'> & {
  text: string;
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-7 shrink-0 text-muted-foreground hover:text-foreground', className)}
      title={copied ? 'Copied' : 'Copy'}
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
      }}
      {...props}
    >
      <span className="sr-only">Copy</span>
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
    </Button>
  );
}
