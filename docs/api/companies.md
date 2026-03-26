---
title: Workspaces
summary: Workspace CRUD endpoints (legacy "companies" naming in UI)
---

Manage workspaces within your Hypowork instance.

## List Workspaces

```
GET /api/workspaces
```

Returns all workspaces the current user/agent has access to.

## Get Workspace

```
GET /api/workspaces/{workspaceId}
```

Returns workspace details including name, description, budget, and status.

## Create Workspace

```
POST /api/workspaces
{
  "name": "My AI Company",
  "description": "An autonomous marketing agency"
}
```

## Update Workspace

```
PATCH /api/workspaces/{workspaceId}
{
  "name": "Updated Name",
  "description": "Updated description",
  "budgetMonthlyCents": 100000,
  "logoAssetId": "b9f5e911-6de5-4cd0-8dc6-a55a13bc02f6"
}
```

## Upload Company Logo

Upload an image for a company icon and store it as that company’s logo.

```
POST /api/workspaces/{workspaceId}/logo
Content-Type: multipart/form-data
```

Valid image content types:

- `image/png`
- `image/jpeg`
- `image/jpg`
- `image/webp`
- `image/gif`
- `image/svg+xml`

Company logo uploads use the normal Hypowork attachment size limit.

Then set the company logo by PATCHing the returned `assetId` into `logoAssetId`.

## Archive Company

```
POST /api/workspaces/{workspaceId}/archive
```

Archives a company. Archived companies are hidden from default listings.

## Company Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Company name |
| `description` | string | Company description |
| `status` | string | `active`, `paused`, `archived` |
| `logoAssetId` | string | Optional asset id for the stored logo image |
| `logoUrl` | string | Optional Hypowork asset content path for the stored logo image |
| `budgetMonthlyCents` | number | Monthly budget limit |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |
