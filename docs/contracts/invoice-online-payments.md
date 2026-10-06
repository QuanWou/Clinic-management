# Invoice payment imported from Lunar — 03/10/2026

The Product Owner requested reuse of `C:/xampp/htdocs/lunar-ecommerce` payment functionality and explicitly authorized the same merchant configuration/beneficiary for this academic project. This supersedes the earlier disabled-online decision **for issued post-consultation invoices only**. Booking remains no-deposit; signature/release, automatic refunds, tax invoices and production acceptance remain outside this change.

## Adaptation

Lunar's `CheckoutPaymentMethods`, `PayosGateway`, `PayosPaymentController`, `VnpayPaymentController` and QR/countdown/status UI inform the integration. PHP/Laravel code is adapted into the existing Java Billing service and React application. Shopping carts, inventory reservations, delivery/COD and coupons do not enter the clinical workflow. The implemented VND methods are payOS, VNPAY, manual bank QR and existing onsite payment. PayPal requires a separate currency/conversion decision and is not enabled.

## API and data

Patient routes: `/api/me/clinics/{c}/branches/{b}/bills/{bill}` followed by `/payment-methods`, `/bank-transfer`, `/payment-intents` (GET/POST), or `/payment-intents/{id}?reconcile=true`. Every read/write revalidates current patient ownership; FORCE RLS applies clinic and branch. Staff read `/api/clinics/{c}/branches/{b}/bills/{bill}/online-payments` under the existing BILLING permission. UI starts from Public → Account → History and fees → issued invoice → choose payment method.

Create takes only provider and expected bill version; the server freezes the outstanding whole-VND amount. A durable intent and idempotency receipt commit before contacting payOS. Unknown create results retry the same intent/order code. Provider calls occur outside database transactions. Browser return parameters cannot confirm money. payOS uses verified API reconciliation/signed webhook; VNPAY uses a signed server IPN. Returned/polled PAID updates invoice and receipt from the server source. POST `/payment-intents/{id}/cancel` cancels a payOS link only after verified provider proof; a paid invoice cannot be undone by cancellation. VNPAY links rely on provider failure/IPN or expiry.

An active online intent blocks cashier collection/reduction on the locked bill. Signed confirmation locks the same bill, checks provider order/link/reference, exact amount and VND, then atomically writes one immutable receipt, balance/version, balanced journal, history, audit outbox and notification delivery. Duplicate callbacks cannot double-credit. An incoming bank reference cannot be counted through both payOS and manual BANK_TRANSFER, including different invoices. payOS credits BANK; VNPAY credits GATEWAY_CLEARING (gross gateway receivable, **not proof of bank settlement or fees**). Online receipts have no cashier/shift and are reported separately from cash-drawer totals. Historical VNPAY sandbox URLs identify test receipts, and their amounts are reported separately from actual incoming money. Late/incorrect payments are retained as REVIEW_REQUIRED, block further collection and require source reconciliation; no automatic refund is inferred.

Manual VietQR is an instruction only. It requires the actual named beneficiary and never claims automatic receipt of money. Reception verifies an incoming bank reference using the existing BANK_TRANSFER collection.

## Runtime configuration

`scripts/import-lunar-payments.ps1` reads only payment keys into ignored `.runtime/main/config.json`; `start-main.ps1` passes them only to Billing. Keys never enter frontend, committed files or evidence. Set `-BankAccountName 'ACTUAL BANK BENEFICIARY'` to complete manual QR configuration. Payment configuration is bound to one clinic. VNPAY is currently Lunar's **sandbox**; the patient UI states that explicitly.

Callback endpoints (prepend the publicly reachable Billing/proxy origin):

- POST `/api/public/payments/clinics/{c}/branches/{b}/payos/webhook`
- GET `/api/public/payments/clinics/{c}/branches/{b}/vnpay/ipn`

The localhost runtime cannot receive external provider callbacks directly. Before end-to-end provider tests, configure an HTTPS callback origin with the provider and set `CLINIC_PAYMENTS_PUBLIC_URL` to the web origin used for return links. No tunnel or external publication is created by this change, and an existing Lunar webhook registration is not overwritten. payOS manual server reconciliation remains usable locally after a real transfer. A successful sandbox transaction is a test result, not production payment acceptance.

Protocol references: [payOS API](https://payos.vn/docs/api/), [VNPAY 2.1.0 HMAC/IPN](https://sandbox.vnpayment.vn/apis/docs/chuyen-doi-thuat-toan/changeTypeHash.html), [VietQR Quick Link](https://www.vietqr.io/intro/).
