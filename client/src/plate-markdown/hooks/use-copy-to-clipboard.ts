'use client';

import * as React from 'react';

type ExternalToast = Record<string, unknown>;

export const useCopyToClipboard = ({
  timeout = 2000,
}: {
  timeout?: number;
} = {}) => {
  const [isCopied, setIsCopied] = React.useState(false);

  const copyToClipboard = (
    value: string,
    _opts?: { data?: ExternalToast; tooltip?: string }
  ) => {
    if (typeof window === 'undefined' || !navigator.clipboard?.writeText)
      return;
    if (!value) return;
    void navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), timeout);
    });
  };

  return { copyToClipboard, isCopied };
};
