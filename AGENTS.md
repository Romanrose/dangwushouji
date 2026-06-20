# AGENTS.md

## Project

This project is a WeChat Mini Program for party-affairs material circulation. It manages material creation, QR/scan entry links, receive registration, return registration, status matching, statistics, and audit records.

## Core Rule

Every material must have one stable `material_id`. Receive and return operations must match by `material_id`, not by fuzzy name, person name, branch name, or date.

## Current MVP

- Native WeChat Mini Program.
- WeChat Cloud Development for database and cloud functions.
- Admin pages live inside the Mini Program.
- No Enterprise WeChat directory integration in v1.
- No approval workflow in v1.
- QR code generation is represented by a scannable Mini Program page path first: `/pages/scan/scan?material_id=...`.

## Collections

- `materials`: material ledger and current status.
- `circulation_records`: receive/return operation log.
- `batches`: optional batch metadata.
- `users`: optional person directory.
- `admins`: authorized administrators.

## Status Flow

Use these exact status values in v1:

- `pending_receive`
- `received`
- `returned`

Future status values may include `partial_returned`, `exception`, and `overdue`, but do not introduce them until the UI and cloud functions support them end to end.

## Development Guidelines

- Keep data flow simple and explicit.
- Prefer cloud functions for mutating operations.
- Do not trust client-side role checks for protected actions.
- Keep pages mobile-friendly and information-dense.
- Avoid unnecessary sensitive personal information.
- Log every receive and return operation to `circulation_records`.
- Preserve compatibility with WeChat Developer Tools.

## Acceptance Baseline

The app is minimally acceptable when an admin can create a material, copy or scan its entry path, register receive, register return, and see dashboard counts update automatically.
