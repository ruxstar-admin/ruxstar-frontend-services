# Cleanup backlog

Tracking leftover / inconsistent code after the vendor withdrawals + support-ticket refunds redesign.  
Most items touch **backend**, but this list lives in the frontend repo so we can track it from the app side.

Last updated: 2026-07-28

---

## P0 — Dead / superseded code (safe to remove once confirmed unused)

### 1. Legacy admin payout system (`PO-…`)
Replaced by vendor withdrawals (`WD-…`). Still wired into backend boot.

- [ ] Delete `ruxstar-backend-services/models/Payout.js`
- [ ] Delete `ruxstar-backend-services/services/payout.service.js`
- [ ] Remove `payoutService` import + `ensureIndexes()` from `ruxstar-backend-services/index.js`
- [ ] Remove `REF_PREFIX.PAYOUT` (`PO`) from `utils/referenceId.js` if nothing else uses it
- [ ] Decide: drop Mongo `payouts` collection, or keep for historical audit (if any old `PO-` rows exist)

### 2. Payment helpers only used by legacy payouts
- [ ] Remove or rewrite `Payment.listRefundablePayments` (name/meaning is outdated; matured list is `listMaturedPayments`)
- [ ] Keep `Payment.attachPayout` only if still needed by withdrawal settle path — otherwise fold into `settleWithdrawal` and delete

### 3. Frontend naming leftovers (cosmetic, not broken)
- [ ] Rename confusing types/helpers that say “Payout” but mean withdrawal bank details:
  - `PayoutMethod` → `VendorBankDetails` / `WithdrawalMethod`
  - `PayoutMethodInput` → matching name
  - `updateVendorPayoutMethod` → matching name
  - `VendorPayoutPreview` / `previewAdminVendorPayout` / `adminPayoutVendor` → “Pay vendor now” wording
- [ ] Optional: rename route `PATCH /vendor/payout-method` → `/vendor/withdrawal-method` (needs backend + FE together)

---

## P1 — Behaviour consistency

### 4. Admin cancel still auto-refunds
Customer cancel → support ticket only.  
Admin force-cancel (`admin.dashboard.service` booking/print cancel) still calls `issueRefund` immediately.

- [ ] Decide product rule: should admin cancel also go through the ticket flow?
- [ ] If yes: remove auto-refund from `cancelBooking` / `cancelPrintOrder` in `admin.dashboard.service.js`
- [ ] Surface the same “raise / use support ticket” message in admin UI after cancel

### 5. Two different “refund window” concepts
- Payment ledger: **7 days** (`Payment.REFUND_WINDOW_DAYS`)
- Old booking constant: `BOOKING_REFUND_WINDOW_HOURS` (default **24h**) still in env / `constants/payments.js` / Cloud Run env

- [ ] Audit every use of `BOOKING_REFUND_WINDOW_HOURS` / `REFUND_WINDOW_HOURS`
- [ ] Either delete the 24h constant or align it with the 7-day rule
- [ ] Remove stale env from `cloudbuild.yaml` / `.env.example` if unused

### 6. `payoutRef` vs `withdrawalRef` on payments
Settled withdrawals stamp `payoutId` / `payoutRef` with the withdrawal id/ref. Works, but naming is confusing.

- [ ] Document clearly in code comments, **or**
- [ ] Migrate field names to `withdrawalId` / `withdrawalRef` only (keep `payoutRef` as alias during migration)
- [ ] Update admin/vendor UI badges that key off `payoutRef`

---

## P2 — Missing polish / ops

### 7. Cashfree Payouts webhook (code exists, dashboard may not)
Endpoint: `POST /webhooks/cashfree/payouts`

- [ ] Confirm webhook URL is registered in Cashfree **Payouts** dashboard
- [ ] Confirm signature verification works with live/sandbox secret
- [ ] Add a note in backend README / ops checklist

### 8. Secret Manager / pipeline
Already in `cloudbuild.yaml`:

- [ ] Confirm secrets exist: `cashfree-payout-client-id`, `cashfree-payout-secret`
- [ ] Confirm runtime SA has Secret Accessor
- [ ] Flip `_CASHFREE_PAYOUT_ENV` from `sandbox` → `production` when going live

### 9. Notifications gaps
- [ ] Notify vendor when withdrawal is approved / completed / rejected / failed
- [ ] Notify vendor when a payment on their ledger is refunded (earnings removed)
- [ ] Customer already gets refund notification — verify copy is clear

### 10. Event registration refunds
`EventRegistration.markRefunded` was added for ledger sync.

- [ ] Confirm event refunds update customer/vendor UIs (paymentStatus badges)
- [ ] Confirm free/confirmed events without a gateway order fail with a clear message (expected)

---

## P3 — UX / copy cleanup (frontend)

### 11. Wording consistency
- [ ] Prefer “withdrawal” over “payout” in vendor + admin UI copy where it means vendor cash-out
- [ ] Keep “refund” only for customer money-back via support
- [ ] Admin Payments: “Pay a vendor now” vs “Approve withdrawal” — keep both labels distinct

### 12. Admin support refund box
- [ ] After successful refund, refresh ticket status UI without requiring a full remount
- [ ] If linked payment is missing/`relatedId` null (old tickets), keep the full payments list (already works)

### 13. Customer cancel messaging
- [ ] Confirm booking + print cancel notices still point to support tickets
- [ ] Optional: deep-link “Raise refund ticket” that preselects category + payment

---

## Suggested order

1. P0 #1–2 — delete dead payout model/service (biggest clarity win)
2. P1 #5 — kill dual refund-window confusion
3. P1 #4 — decide admin-cancel refund policy
4. P2 #7–8 — ops / Cashfree dashboard
5. P2 #9 — notifications
6. P0 #3 + P3 — naming/copy polish when free

---

## Notes

- Do **not** remove `payoutRef` / withdrawal locking fields from live payments without a migration plan — refunds and withdrawals depend on them.
- Frontend currently has no leftover `listAdminPayouts` / old payout panel — that UI was already replaced.
- Backend still boots legacy `payoutService.ensureIndexes()` even though no routes expose it.
