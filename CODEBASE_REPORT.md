# Codebase Report

Date: 2026-05-19

## Update After Baseline Cleanup

- `npm run lint` now passes.
- `npm run build` now passes in a normal networked environment.
- The base SQL schema now includes the current `conditions` table and the array-based report media fields.
- A dedicated migration now adds and backfills `media_new` and `media_type_new`.
- `.env.local.example` now exists in the repo.
- Home-page PDF export now uses the installed `jspdf` packages via dynamic import instead of CDN-injected globals.

The detailed findings below were written from the original codebase state before this cleanup pass. Use the section above as the current status snapshot.

## Snapshot

- App: garden monitoring and reporting tool for plants, gardens, conditions, media uploads, WhatsApp sharing, and PDF export.
- Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase JS, Cloudinary, jsPDF, Lucide.
- Package entry points: `dev`, `build`, `start`, `lint` in `package.json`.
- Current route files are large, client-heavy screens:
  - `app/page.tsx`: 1181 lines
  - `app/dashboard/page.tsx`: 917 lines
  - `app/plants/page.tsx`: 491 lines
  - `app/conditions/page.tsx`: 413 lines
  - `lib/supabase.ts`: 689 lines

## What The App Does

### `/`

`app/page.tsx` is the main operator workflow. It starts on an in-page garden dashboard, then switches to a per-garden report feed without changing routes.

Main behaviors:

- Loads gardens, plants, and active conditions on mount.
- Lets the user enter a garden-specific feed.
- Creates and edits reports with:
  - plant type
  - plant selection
  - free-text description
  - optional multiple conditions
  - optional photo/video upload
- Supports browser speech recognition in Indonesian locale (`id-ID`).
- Supports selection mode for bulk WhatsApp share and PDF export.
- Shows a detail modal with media carousel.

Important implementation notes:

- The page is fully client-side (`'use client'`).
- jsPDF is not imported from the installed package. It is injected from CDN scripts at runtime in `app/page.tsx`.
- Report logic, media handling, and editing logic are embedded directly in the page component.

### `/dashboard`

`app/dashboard/page.tsx` is a cross-garden admin view.

Main behaviors:

- Loads all gardens, plants, reports, and active conditions.
- Filters reports by garden, plant, and condition.
- Paginates results.
- Opens a detail modal and an edit modal.
- Supports WhatsApp share for a single report.

Important implementation notes:

- It duplicates a large amount of logic already present in `app/page.tsx`:
  - media upload preparation
  - condition toggling
  - edit form
  - report detail modal
  - media carousel
- `sortField` and `sortOrder` state exist, but there is no UI to change them, so sorting is effectively fixed.

### `/plants`

`app/plants/page.tsx` manages reference data for gardens, plant types, and plants.

Main behaviors:

- Lists all plants.
- Creates gardens inline.
- Creates plant types inline.
- Creates, edits, and deletes plants.

Important implementation notes:

- This page is the source of truth for plant reference records.
- Reports do not store a plant foreign key, so plant edits do not fully normalize report history.

### `/conditions`

`app/conditions/page.tsx` manages condition labels used in reports.

Main behaviors:

- Lists conditions.
- Shows or hides inactive conditions.
- Creates, edits, enables/disables, and deletes conditions.

Important implementation notes:

- Conditions are configurable reference data with color, icon, slug, order, and active state.
- Report forms currently fetch only active conditions.

## Data Model

The app uses five main entities:

1. `gardens`
2. `plant_types`
3. `plants`
4. `updates`
5. `conditions`

### Actual app-level model

From `lib/supabase.ts`, the effective frontend model is:

- `Garden`
- `PlantType`
- `Plant`
- `GardenUpdate`
- `Condition`

### Relationships

- `plants.garden_id -> gardens.id`
- `plants.plant_type_id -> plant_types.id`
- `updates` does not reference `plants.id`
- `updates` stores denormalized strings:
  - `garden`
  - `type`
  - `plant_id` mapped to `plantId`
- `updates.condition_ids` is treated as an array of condition IDs

### Consequences of the current model

- Editing a plant name can break the reverse lookup used when editing a report, because report edit flows search by `plantName`, not by a stable plant foreign key.
- Garden and plant type names are copied into each report. That preserves historical labels, but also introduces duplication and possible drift.
- Report dates are stored as locale-formatted strings, not canonical timestamps.

## Persistence Layer

`lib/supabase.ts` is the single shared data-access module. It contains:

- Supabase client initialization
- Type declarations
- CRUD for updates
- CRUD for gardens
- CRUD for plant types
- CRUD for plants
- CRUD for conditions
- Cloudinary upload helpers

Important details:

- All CRUD runs from the browser with the public Supabase anon key.
- Cloudinary uploads are unsigned and happen directly from the browser.
- There are several legacy or unused pieces in this file:
  - `PLANT_COUNT`
  - `generateIds`
  - `GARDEN_DATA`
  - `uploadMedia` appears unused by the current pages

## Schema And Migration Status

### Base schema in repo

`supabase/schema.sql` creates:

- `updates`
- `gardens`
- `plant_types`
- `plants`

It also seeds default gardens and plant types.

### Migrations in repo

- `20250212_add_conditions_table.sql`
  - creates `conditions`
  - adds legacy `updates.condition_id`
- `20250212_update_to_multiple_conditions.sql`
  - drops `condition_id`
  - adds `updates.condition_ids` JSONB

### Schema drift

The current code expects columns that are not created anywhere in the repo SQL:

- `updates.media_new`
- `updates.media_type_new`

The app reads and writes those columns in `lib/supabase.ts`, but no checked-in migration creates them. That means the repo is not a complete source of truth for database setup.

There is also setup drift between docs and schema:

- `README.md` describes `.env.local.example`, but that file is not in the repo.
- `README.md` still describes older example gardens and plant types.
- `README.md` mentions an older single-media shape for `updates`, while the code expects array-based media support.

## UI And Styling

- Tailwind CSS v4 is enabled through `postcss.config.mjs`.
- Most styling is inline utility classes in route files.
- There is almost no shared component layer.
- `app/layout.tsx` imports `Geist` and `Geist Mono` through `next/font/google`.
- `app/globals.css` then sets `body { font-family: Arial, Helvetica, sans-serif; }`.

Practical result:

- The build depends on downloading Google fonts.
- The body font is still hardcoded to Arial, so the imported Geist fonts are not clearly buying much.

## Runtime Dependencies And External Services

### Supabase

Used for all CRUD and list fetching.

Environment variables required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Cloudinary

Used for media upload.

Environment variables required:

- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

### Browser-only features

- Speech recognition via `window.SpeechRecognition` or `window.webkitSpeechRecognition`
- WhatsApp deep link via `https://wa.me/?text=...`
- PDF generation through global `window.jspdf`

## Current Health Check

### Build

- `npm run build` passes in a normal networked environment.
- Inside the sandbox it initially failed because `next/font/google` could not fetch `Geist` and `Geist Mono`.
- Build output warns that Next inferred the workspace root from a parent lockfile. `next.config.ts` does not currently set `turbopack.root`.

### Lint

`npm run lint` fails with 19 errors and 28 warnings.

Main error categories:

1. Hook/compiler errors from using functions before declaration:
   - `app/plants/page.tsx`
   - `app/conditions/page.tsx`
2. `no-explicit-any` issues in `app/page.tsx` and `lib/supabase.ts`
3. `react/no-unescaped-entities` in `app/conditions/page.tsx`

Main warning categories:

- unused imports and state
- `react-hooks/exhaustive-deps`
- `@next/next/no-img-element`

This means the app builds, but the codebase is not lint-clean and will fight us during iterative work until we decide whether to clean that baseline first or work around it.

### Tests

- There is no test script in `package.json`.
- I did not find a test directory or automated test suite in the repo.

## Change Hotspots

These are the files and regions I would go to first for future work:

- `app/page.tsx`
  - lines ~16-122: root state, initial loading, garden/feed switching
  - lines ~212-285: create/update report flow
  - lines ~287-381: report edit/delete/share flow
  - lines ~393-447: PDF export
  - lines ~524-1178: UI, modals, media carousel, CDN script injection
- `app/dashboard/page.tsx`
  - lines ~13-138: filters, sorting, pagination
  - lines ~152-275: edit/update/delete flow
  - lines ~328-406: media carousel
  - lines ~408-917: table, detail modal, edit modal
- `app/plants/page.tsx`
  - lines ~44-59: initial data load lint blocker
  - lines ~110-181: create garden, create plant type, create/update plant
- `app/conditions/page.tsx`
  - lines ~28-38: initial data load lint blocker
  - lines ~76-138: create/update/delete/toggle condition
- `lib/supabase.ts`
  - lines ~97-206: report CRUD and column mapping
  - lines ~220-266: Cloudinary upload helpers
  - lines ~273-499: gardens, plant types, plants CRUD
  - lines ~506-689: conditions CRUD
- `supabase/schema.sql`
  - lines ~8-25: base `updates` table
  - lines ~94-187: gardens, plant types, plants, and seed data
- `supabase/migrations/20250212_add_conditions_table.sql`
  - creates `conditions`
  - adds legacy single-condition support
- `supabase/migrations/20250212_update_to_multiple_conditions.sql`
  - switches reports to `condition_ids`

## Key Risks

### 1. Database schema is not fully represented in repo

Severity: high

Reason:

- App code depends on `media_new` and `media_type_new`.
- Repo SQL does not create them.

Impact:

- Fresh environments set up from repo SQL alone are likely broken for report creation and editing.

### 2. Reports are not normalized to plant IDs

Severity: high

Reason:

- Reports persist `plantId` as a plant name string.
- Edit flows then search for the current plant by name.

Impact:

- Renaming a plant can make old reports harder to edit safely.
- Data integrity is dependent on display labels.

### 3. Two large routes duplicate report-management logic

Severity: medium-high

Reason:

- `app/page.tsx` and `app/dashboard/page.tsx` both implement similar create/edit/media/detail behavior.

Impact:

- Fixes or features will often require edits in two places.
- Behavior can diverge without noticing.

### 4. Public write/delete access is intentionally open

Severity: high for production, low if this is an internal tool

Reason:

- `supabase/schema.sql` enables broad public RLS policies on all main tables.

Impact:

- Anyone with the public client credentials can read, insert, update, and in many cases delete data.

### 5. Date storage is locale-string based

Severity: medium

Reason:

- Reports save `date` using `new Date().toLocaleString()`.

Impact:

- Sorting and parsing are locale-sensitive.
- Reporting consistency is weaker than storing ISO strings or database timestamps.

### 6. PDF export uses CDN globals even though packages are installed

Severity: medium

Reason:

- `jspdf` and `jspdf-autotable` are in `package.json`.
- Home page still injects CDN scripts and reads `window.jspdf`.

Impact:

- Adds runtime network dependency and CSP sensitivity.
- Avoids type-safe imports and bundler integration.

### 7. Documentation is stale

Severity: medium

Reason:

- README does not match current schema, current seed data, or current file set.

Impact:

- New setup is harder than it should be.
- Fresh environment issues are easy to misdiagnose.

## Recommended Starting Order

If we want a stable base before feature work, this is the order I would use:

1. Align the database source of truth.
   - Add missing migration(s) for `media_new` and `media_type_new`.
   - Decide whether `updates` should keep denormalized strings only, or also store `plant_id` as a real foreign key.

2. Make lint pass for the current baseline.
   - Fix function-before-declaration issues.
   - Remove dead imports/state.
   - Replace obvious `any` where low-risk.

3. Extract shared report logic.
   - Move shared report form/media/detail logic out of `app/page.tsx` and `app/dashboard/page.tsx`.

4. Decide the primary user flow.
   - Keep `/` as the operator workflow and `/dashboard` as admin overview, or consolidate them.

5. Clean up external dependencies.
   - Import jsPDF normally or intentionally document the CDN approach.
   - Decide whether Geist should stay if the body font remains Arial.

6. Refresh the README after the code/schema are aligned.

## What I Can Safely Change Next

I now have enough context to work safely in:

- report creation/editing flows
- garden/plant reference management
- condition management
- Supabase CRUD helpers
- schema/migration fixes
- lint cleanup and refactors around the current routing structure

The main thing to be careful about is schema drift and duplicated report logic, because those are the two places where a small code change can have a bigger blast radius than it first appears.
