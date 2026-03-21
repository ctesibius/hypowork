'use client';

import * as React from 'react';

export type CompanyDocPickerEntry = {
  id: string;
  title: string | null;
};

export type DocumentLinkPickerValue = {
  documents: CompanyDocPickerEntry[];
  /** Omit links to the note being edited. */
  currentDocumentId: string;
};

const DocumentLinkPickerContext = React.createContext<DocumentLinkPickerValue | null>(null);

export function DocumentLinkPickerProvider({
  value,
  children,
}: {
  value: DocumentLinkPickerValue | null;
  children: React.ReactNode;
}) {
  return (
    <DocumentLinkPickerContext.Provider value={value}>{children}</DocumentLinkPickerContext.Provider>
  );
}

export function useDocumentLinkPicker(): DocumentLinkPickerValue | null {
  return React.useContext(DocumentLinkPickerContext);
}
