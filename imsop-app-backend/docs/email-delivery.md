# Transactional mail transition and recovery

Migration `007_immutable_mail.sql` adds `mail_requests`. It stores encrypted
wire requests, their SHA-256, keyed recipient/configuration bindings, first
attempt time and provider receipt. It never stores provider credentials.
Keep `RESET_DELIVERY_KEY` stable and in the encrypted recovery configuration;
changing it prevents decryption and binding verification. The existing JWT-key
fallback is retained for compatibility, but a separate deployment key is preferred.

Resend sends the original persisted JSON bytes and delivery UUID as its
idempotency key. Its [documented retention is 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys).
This worker stops retries at 23 hours, the request's earlier expiry, or five
attempts. SMTP stores the compiled MIME bytes and envelope before I/O. An SMTP
timeout, lost acknowledgement or process crash after starting I/O is `unknown`;
it is never automatically resent. A successful provider acknowledgement is
acceptance, not evidence of mailbox delivery or authenticated received headers.

The dispatcher rechecks account/recipient eligibility before each attempt.
Changing the provider, sender, credential or recipient blocks a frozen attempt.
Changing business text does not rewrite it. Database triggers prevent rewriting
the request, bindings, expiry or original first-attempt timestamp. No credentials,
message bodies or reset tokens belong in operational logs.

## Deploy or change a sender

1. Back up the database and private recovery configuration, including the
   delivery key. Verify restoration separately.
2. Stop every old mail-producing/dispatching process before applying migration
   007. Do not run legacy and new dispatchers concurrently. Inventory queue
   counts and retained provider receipts privately.
3. The migration holds legacy attempted pending/sending deliveries as `unknown`:
   their original request bytes and credential binding were never retained.
   Reconcile them against provider evidence. Do not re-render them with a new
   From, change their IDs, or turn them back into pending work.
4. Configure the intended sender and matching credential for new, unattempted
   deliveries. Preserve a failed reset's original 15-minute cooldown. A reset
   request after expiry gets a fresh delivery ID and token; it is not a retry of
   the old request.
5. Start the new worker, exercise a controlled account, and inspect both its
   queue and `mail_requests` receipt. Verify actual mailbox delivery and sender
   authentication independently. Keep staging operational notifications disabled.

Read-only queue inventory (counts only):

```sql
SELECT state,count(*) FROM reset_deliveries GROUP BY state;
SELECT state,count(*) FROM notification_deliveries GROUP BY state;
SELECT provider,state,count(*) FROM mail_requests GROUP BY provider,state;
```

`pending_v2`/`sending_v2` identify this dispatch protocol. Old binaries ignore
these states, so they cannot reconstruct an already attempted new request on
rollback. Keep the additive table and migration ledger during binary rollback;
never restore an older database over newer writes. Old binaries still lack the
new guarantees for newly queued mail: quiesce their mail ingress/dispatch during
the rollback rehearsal and restore this qualified worker before resuming mail.
Application rollback acceptance must explicitly test this boundary.

`unknown` and `blocked` require operator reconciliation against original
provider evidence; they are not failed deliveries or permission to send again.
Retain the original ID, request hash, credential binding and any receipt. If
evidence is unavailable, leave the attempt held. Do not claim delivery, assign
a fabricated receipt, or mutate the request to make a retry pass.

## Verification

`system/mail-durability.test.ts` uses a separate disposable PostgreSQL database
and real local SMTP/HTTP fault servers. It checks lost acknowledgements,
immutable bytes, recipient/credential changes, concurrent workers, retry expiry,
crash recovery and reset cooldown/account validity. It supplements the existing
gateway, browser and controlled provider acceptance; it is not a substitute for
live Resend delivery qualification. The restore drill discovers every
application table, including this ledger and edge observations.
