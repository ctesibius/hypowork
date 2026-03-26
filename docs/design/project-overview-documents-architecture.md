---
title: Project overview — documents list (standalone + issue-linked)
summary: How the project Overview “Project documents” section is populated, including issue documents created by agents, and how it ties to chat RAG.
date: 2026-03-25
status: living document
---

# Project overview — documents architecture

## Purpose

On **Projects → &lt;project&gt; → Overview**, the **Project documents** list shows every workspace document that should appear in that project’s library context. It is **not** only “notes created with `projectId` on the document row.” It also includes **issue-linked documents** for issues that belong to the same project.

That wiring exists so work product created on tasks (e.g. agents writing `plan`, `report`, or custom keys via `PUT /api/issues/:issueId/documents/:key`) **surfaces on the project** without duplicating rows or manually re-tagging `documents.project_id`.

The UI copy (“Notes created here are tagged to this project…”) refers to **user-created** notes from the overview actions; those are the **standalone** path. The list itself is the **union** of standalone + issue-linked (see below).

## Source of truth

| Concept | Table / relation | Role |
|--------|------------------|------|
| Document body | `documents` | Revisioned content, `title`, `latest_body`, etc. |
| Issue attachment | `issue_documents` | Links `document_id` ↔ `issue_id` with a `key` (e.g. `plan`) |
| Project membership for issues | `issues.project_id` | Determines which issue-linked docs belong to which project |
| Standalone project tagging | `documents.project_id` | For notes created directly under the project (no issue) |

**Important:** For issue-linked rows, **visibility in the project list follows `issues.project_id`, not `documents.project_id`.** The document row may have `project_id` null or stale; the list query still picks them up via the issue.

## Backend behavior

Implementation: `listCompanyDocumentsForProject` in `server/src/services/documents.ts`.

### Query A — Standalone project notes

- Rows in `documents` where:
  - `company_id` matches the workspace
  - **No** row in `issue_documents` for that document (`issue_documents` is null for join)
  - `documents.project_id` equals the project UUID

These are “create note / import / canvas” flows that set `projectId` on create.

### Query B — Issue-linked documents in this project

- `documents`
- **Inner join** `issue_documents` on `document_id`
- **Inner join** `issues` on `issue_documents.issue_id`
- Where `issues.project_id` equals the project UUID (and company matches)

Any document an agent or user attached to an issue in this project (including first-class issue documents) appears here.

### Merge

- `mergeProjectScopedDocumentRows` concatenates A + B, **dedupes by document `id`**, sorts by `updatedAt` descending (newest first).
- If the same document id appeared in both (unusual), it appears once.

### API surface

- `GET /api/companies/:companyId/documents?projectId=:projectUuid`
- Client path alias: `GET /api/workspaces/:companyId/documents?projectId=...` (rewritten to `/api/companies/...` in `server-nest/src/main.ts`).

When `projectId` is **omitted**, the list endpoint returns **standalone** documents only (`listStandaloneCompanyDocuments`), not the merged project view.

## Frontend

- **Overview list:** `ProjectOverviewDocumentsSection` in `client/src/pages/ProjectDetail.tsx` calls `documentsApi.list(companyId, { projectId })` with the resolved `project.id` (UUID).
- **Chat document picker / RAG scope:** `CompanyChatWorkspace` uses the same `documentsApi.list(companyId, { projectId: projectIdFilter })` when a project filter is active, so the same merged set drives project-scoped chat RAG context.

## Agent workflow (how issue docs appear on the overview)

1. Agent works on an issue that has `projectId` set (task belongs to the project).
2. Agent creates or updates an issue document: `PUT /api/issues/:issueId/documents/:key` with `title`, `body`, etc.
3. That upserts a row in `documents` and links it in `issue_documents` for that `issue_id` + `key`.
4. Because `issues.project_id` matches the project, **Query B** includes that document.
5. The project Overview list refreshes and shows the **title** and link to the document like any other row.

No separate “copy to project” step is required for this path.

## Related documentation

- Issue documents product plan: `docs/plans/2026-03-13-issue-documents-plan.md`
- Collections / placement vocabulary: `docs/design/documents-collections.md`
- Agent guidance (issue docs, **project library list**, Obsidian `[[wikilinks]]` / `@uuid`): `skills/paperclip/SKILL.md` — sections *Planning* and *Project library documents & Obsidian-style links*

## Maintenance notes

- If you add new filters (e.g. archived issues), apply them consistently in `issueLinkedRows` query.
- Graph endpoints (`/documents/graph`) may still be **standalone-only**; do not assume parity with the merged project list without checking `documentService` methods.
