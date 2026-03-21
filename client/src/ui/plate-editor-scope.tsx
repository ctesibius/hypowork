'use client';

import * as React from 'react';
import { useEditorRef, useEditorSelector } from 'platejs/react';

/** When UI renders as siblings of `PlateContent`, `useEditorRef()` must use the same scope as `Plate` (`scope={editor.id}`). */
const PlateEditorIdContext = React.createContext<string | undefined>(undefined);

export function PlateEditorIdProvider({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return <PlateEditorIdContext.Provider value={id}>{children}</PlateEditorIdContext.Provider>;
}

export function usePlateEditorScopeId(): string | undefined {
  return React.useContext(PlateEditorIdContext);
}

/** Prefer this over bare `useEditorRef()` anywhere under `Plate` when toolbars/nodes are not only inside `PlateContent`. */
export function useScopedEditorRef() {
  const id = usePlateEditorScopeId();
  return useEditorRef(id);
}

export function useScopedEditorSelector<T>(
  selector: (editor: any) => T,
  deps: React.DependencyList
) {
  const id = usePlateEditorScopeId();
  return useEditorSelector(selector, deps, { id });
}
