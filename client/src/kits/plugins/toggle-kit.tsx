'use client';

import { TogglePlugin } from '@platejs/toggle/react';

import { IndentKit } from '@/kits/plugins/indent-kit';
import { ToggleElement } from '@/ui/toggle-node';

export const ToggleKit = [
  ...IndentKit,
  TogglePlugin.withComponent(ToggleElement),
];
