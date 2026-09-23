# Data retention & deletion policy (MVP)

Authoritative copy of the retention table shown in `/legal/privacy` (`src/content/legal.ts`). Change both together.

| Data | Where | While account active | After account deletion | Mechanism |
|---|---|---|---|---|
| Account (Appwrite user, identities) | Appwrite Auth | kept | removed immediately | `DELETE /v1/me` → `users.delete` |
| Profile, role memberships, student/teacher profile | TablesDB | kept | profile anonymised immediately; role memberships and student/teacher profiles removed immediately | `services/account.deleteAccount` |
| Learning requests / relations / goals / tasks | TablesDB | kept | member id replaced by "Former member" (rows kept for the counterpart) | `personRefs` fallback |
| Messages | TablesDB | kept | deleted ≤ 30 days | scheduled Function `node-learn-purge-deleted` |
| Evidence files | Storage `evidence` | kept | deleted ≤ 30 days | scheduled Function `node-learn-purge-deleted` |
| Avatar | Storage `avatars` | kept | deleted immediately | `deleteAccount` |
| Proof records (aggregates) | TablesDB | kept | anonymised, kept | no personal data inside |
| Reports, audit_events | TablesDB | kept | kept 12 months after resolution | scheduled Function `node-learn-purge-deleted` |
| Notifications | TablesDB | 90 days | deleted immediately | `deleteAccount` + scheduled Function `node-learn-purge-deleted` |
| Upload intents | TablesDB | 24 h after expiry | retained until the deleted-account purge removes related files | scheduled Function `node-learn-purge-deleted` |
| Idempotency keys | TablesDB | 24 h | — | scheduled Function `node-learn-purge-deleted` |
| Function logs | Appwrite | 30 days | — | Appwrite default |

Open items before GA: legal review of the age band (`MIN_AGE_BAND`) and placeholder legal contact domains per launch region.
