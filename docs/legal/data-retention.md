# Data retention & deletion policy (MVP)

Authoritative copy of the retention table shown in `/legal/privacy` (`src/content/legal.ts`). Change both together.

| Data | Where | While account active | After account deletion | Mechanism |
|---|---|---|---|---|
| Account (Appwrite user, identities) | Appwrite Auth | kept | removed immediately | `DELETE /v1/me` → `users.delete` |
| Profile, role memberships, student/teacher profile | TablesDB | kept | removed immediately | `services/account.deleteAccount` |
| Learning requests / relations / goals / tasks | TablesDB | kept | member id replaced by "Former member" (rows kept for the counterpart) | `personRefs` fallback |
| Messages | TablesDB | kept | deleted ≤ 30 days | scheduled purge (TODO: Function cron `purge-deleted`) |
| Evidence files | Storage `evidence` | kept | deleted ≤ 30 days | same purge job |
| Avatar | Storage `avatars` | kept | deleted immediately | `deleteAccount` |
| Proof records (aggregates) | TablesDB | kept | anonymised, kept | no personal data inside |
| Reports, audit_events | TablesDB | kept | kept 12 months after resolution | manual purge / cron |
| Notifications | TablesDB | 90 days | deleted immediately | `deleteAccount` + cron |
| Upload intents | TablesDB | 24 h after expiry | — | cron |
| Idempotency keys | TablesDB | 24 h | — | cron |
| Function logs | Appwrite | 30 days | — | Appwrite default |

Open items before GA: implement the `purge-deleted` cron Function; legal review of the age band (`MIN_AGE_BAND`) per launch region.
