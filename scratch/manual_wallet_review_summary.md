# Manual Wallet Review Summary

**Date:** 2026-07-18T07:06:58.790Z

| Metric | Count |
|---|---|
| Total wallets | 23 |
| Clean | 9 |
| Flagged for review | 14 |

## Flagged Wallets

| # | Wallet ID | User | Category | Available | Pending | Withdrawn | Expected Avail | Evidence |
|---|---|---|---|---|---|---|---|---|
| 1 | e562f625 | state@gmail.com | B_OPENING_BALANCE_MIGRATION | 225 | -225 | 0 | 225 | 3 records |
| 2 | 919ec32f | company-wallet@apexbee.com | A_DETERMINISTIC | 349.6 | 0 | 0 | 349.5999999999999 | 63 records |
| 3 | 919ec331 | wishlink-wallet@apexbee.com | B_OPENING_BALANCE_MIGRATION | 134.5 | -112.5 | 0 | 134.5 | 6 records |
| 4 | e567c4de | dist@gmail.com | B_OPENING_BALANCE_MIGRATION | 225 | -225 | 0 | 225 | 3 records |
| 5 | e567f38d | system@apexbee.com | B_OPENING_BALANCE_MIGRATION | 18026 | 0 | 0 | 26 | 12 records |
| 6 | e5680392 | mandal@gmail.com | B_OPENING_BALANCE_MIGRATION | 225 | -225 | 0 | 225 | 3 records |
| 7 | e568b55b | vendor@gmail.com | A_DETERMINISTIC | 8.55 | 0 | 0 | 8.55 | 3 records |
| 8 | e56b6967 | user1@gmail.com | C_MISSING_RECORD | 118.5 | -127.5 | 0 | 118.5 | 2 records |
| 9 | e56b88a7 | user2@gmail.com | B_OPENING_BALANCE_MIGRATION | 137.5 | -137.5 | 0 | 137.5 | 2 records |
| 10 | e56ba75a | user3@gmail.com | B_OPENING_BALANCE_MIGRATION | 387.5 | -387.5 | 0 | 387.5 | 3 records |
| 11 | e56cce98 | delivery@gmail.com | B_OPENING_BALANCE_MIGRATION | 0 | 150 | 0 | 0 | 3 records |
| 12 | e5b9e795 | gsk@apexbee.in | C_MISSING_RECORD | 1849.9899999999998 | 1000 | 0 | 349.99 | 10 records |
| 13 | e51662c8 | gm@apexbee.in | B_OPENING_BALANCE_MIGRATION | 5174 | 0 | 0 | 174 | 8 records |
| 14 | 4116163e | vendor_a@apexbee.in | B_OPENING_BALANCE_MIGRATION | 0 | 0 | 0 | 0 | 2 records |

## Category Distribution

- **B_OPENING_BALANCE_MIGRATION**: 10
- **A_DETERMINISTIC**: 2
- **C_MISSING_RECORD**: 2

## Detailed Wallet Reports

### 1. Wallet `e562f625` — state@gmail.com

- **Category:** B_OPENING_BALANCE_MIGRATION
- **Reason:** Wallet has no transaction history but has 3 source records. Opening balance migration required.
- **Stored:** avail=225, pending=-225, withdrawn=0
- **Replayed:** avail=0, pending=0, withdrawn=0
- **Expected (verified):** avail=225, pending=450, withdrawn=0
- **Transactions:** 0 | Orders: 0 | Payments: 0
- **Released commissions:** ₹225 | Referrals: ₹0 | Refunds: ₹0
- **Legacy ledger entries:** 1
- **Evidence sources:** 3
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | CommissionSettlement | ₹225 | credit | completed |
  | CommissionSettlement | ₹225 | credit | pending |
  | CommissionSettlement | ₹225 | credit | pending |

### 2. Wallet `919ec32f` — company-wallet@apexbee.com

- **Category:** A_DETERMINISTIC
- **Reason:** Replay from WalletTransaction produces a non-negative balance that differs from stored. Deterministically repairable.
- **Stored:** avail=349.6, pending=0, withdrawn=0
- **Replayed:** avail=349.6, pending=0, withdrawn=0
- **Expected (verified):** avail=349.5999999999999, pending=3182.57, withdrawn=0
- **Transactions:** 38 | Orders: 0 | Payments: 0
- **Released commissions:** ₹1495.14 | Referrals: ₹0 | Refunds: ₹0
- **Legacy ledger entries:** 75
- **Evidence sources:** 63
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | CommissionSettlement | ₹10 | credit | pending |
  | CommissionSettlement | ₹9.2 | credit | pending |
  | CommissionSettlement | ₹1248.5 | credit | completed |
  | CommissionSettlement | ₹224.765503578 | credit | completed |
  | CommissionSettlement | ₹21.875017500000002 | credit | completed |
  | CommissionSettlement | ₹10 | credit | pending |
  | CommissionSettlement | ₹9.2 | credit | pending |
  | CommissionSettlement | ₹1248.5 | credit | pending |
  | CommissionSettlement | ₹1248.5 | credit | pending |
  | CommissionSettlement | ₹224.765503578 | credit | pending |
  | CommissionSettlement | ₹10 | credit | pending |
  | CommissionSettlement | ₹9.2 | credit | pending |
  | CommissionSettlement | ₹10 | credit | pending |
  | CommissionSettlement | ₹9.2 | credit | pending |
  | CommissionSettlement | ₹10 | credit | pending |
  | CommissionSettlement | ₹9.2 | credit | pending |
  | CommissionSettlement | ₹10 | credit | pending |
  | CommissionSettlement | ₹9.2 | credit | pending |
  | CommissionSettlement | ₹10 | credit | pending |
  | CommissionSettlement | ₹9.2 | credit | pending |

### 3. Wallet `919ec331` — wishlink-wallet@apexbee.com

- **Category:** B_OPENING_BALANCE_MIGRATION
- **Reason:** Wallet has no transaction history but has 6 source records. Opening balance migration required.
- **Stored:** avail=134.5, pending=-112.5, withdrawn=0
- **Replayed:** avail=0, pending=0, withdrawn=0
- **Expected (verified):** avail=134.5, pending=245, withdrawn=0
- **Transactions:** 0 | Orders: 0 | Payments: 0
- **Released commissions:** ₹134.5 | Referrals: ₹0 | Refunds: ₹0
- **Legacy ledger entries:** 3
- **Evidence sources:** 6
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | CommissionSettlement | ₹112.5 | credit | completed |
  | CommissionSettlement | ₹20.000031050999997 | credit | completed |
  | CommissionSettlement | ₹1.999998 | credit | completed |
  | CommissionSettlement | ₹112.5 | credit | pending |
  | CommissionSettlement | ₹112.5 | credit | pending |
  | CommissionSettlement | ₹20.000031050999997 | credit | pending |

### 4. Wallet `e567c4de` — dist@gmail.com

- **Category:** B_OPENING_BALANCE_MIGRATION
- **Reason:** Wallet has no transaction history but has 3 source records. Opening balance migration required.
- **Stored:** avail=225, pending=-225, withdrawn=0
- **Replayed:** avail=0, pending=0, withdrawn=0
- **Expected (verified):** avail=225, pending=450, withdrawn=0
- **Transactions:** 0 | Orders: 0 | Payments: 0
- **Released commissions:** ₹225 | Referrals: ₹0 | Refunds: ₹0
- **Legacy ledger entries:** 1
- **Evidence sources:** 3
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | CommissionSettlement | ₹225 | credit | completed |
  | CommissionSettlement | ₹225 | credit | pending |
  | CommissionSettlement | ₹225 | credit | pending |

### 5. Wallet `e567f38d` — system@apexbee.com

- **Category:** B_OPENING_BALANCE_MIGRATION
- **Reason:** Wallet has no transaction history but has 12 source records. Opening balance migration required.
- **Stored:** avail=18026, pending=0, withdrawn=0
- **Replayed:** avail=0, pending=0, withdrawn=0
- **Expected (verified):** avail=26, pending=622.5, withdrawn=0
- **Transactions:** 0 | Orders: 0 | Payments: 0
- **Released commissions:** ₹0 | Referrals: ₹26 | Refunds: ₹0
- **Legacy ledger entries:** 7
- **Evidence sources:** 12
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | ReferralTransaction | ₹15 | credit | completed |
  | ReferralTransaction | ₹9.99989452 | credit | completed |
  | ReferralTransaction | ₹0.999999 | credit | completed |
  | ReferralTransaction | ₹50 | credit | pending |
  | ReferralTransaction | ₹112.5 | credit | pending |
  | ReferralTransaction | ₹225 | credit | pending |
  | ReferralTransaction | ₹225 | credit | pending |
  | ReferralTransaction | ₹9.99989452 | credit | pending |
  | LegacyLedgerEntry | ₹5000 | credit | completed |
  | LegacyLedgerEntry | ₹2500 | credit | completed |
  | LegacyLedgerEntry | ₹500 | credit | completed |
  | LegacyLedgerEntry | ₹10000 | credit | completed |

### 6. Wallet `e5680392` — mandal@gmail.com

- **Category:** B_OPENING_BALANCE_MIGRATION
- **Reason:** Wallet has no transaction history but has 3 source records. Opening balance migration required.
- **Stored:** avail=225, pending=-225, withdrawn=0
- **Replayed:** avail=0, pending=0, withdrawn=0
- **Expected (verified):** avail=225, pending=450, withdrawn=0
- **Transactions:** 0 | Orders: 0 | Payments: 0
- **Released commissions:** ₹225 | Referrals: ₹0 | Refunds: ₹0
- **Legacy ledger entries:** 1
- **Evidence sources:** 3
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | CommissionSettlement | ₹225 | credit | completed |
  | CommissionSettlement | ₹225 | credit | pending |
  | CommissionSettlement | ₹225 | credit | pending |

### 7. Wallet `e568b55b` — vendor@gmail.com

- **Category:** A_DETERMINISTIC
- **Reason:** Replay from WalletTransaction produces a non-negative balance that differs from stored. Deterministically repairable.
- **Stored:** avail=8.55, pending=0, withdrawn=0
- **Replayed:** avail=8.55, pending=0, withdrawn=0
- **Expected (verified):** avail=8.55, pending=4500, withdrawn=0
- **Transactions:** 1 | Orders: 0 | Payments: 0
- **Released commissions:** ₹2250 | Referrals: ₹0 | Refunds: ₹0
- **Legacy ledger entries:** 2
- **Evidence sources:** 3
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | CommissionSettlement | ₹2250 | credit | completed |
  | CommissionSettlement | ₹2250 | credit | pending |
  | CommissionSettlement | ₹2250 | credit | pending |

### 8. Wallet `e56b6967` — user1@gmail.com

- **Category:** C_MISSING_RECORD
- **Reason:** Transaction replay produces negative intermediate balance. Missing credit or duplicate debit suspected.
- **Stored:** avail=118.5, pending=-127.5, withdrawn=0
- **Replayed:** avail=-9, pending=0, withdrawn=0
- **Expected (verified):** avail=118.5, pending=0, withdrawn=9
- **Transactions:** 1 | Orders: 4 | Payments: 0
- **Released commissions:** ₹0 | Referrals: ₹127.5 | Refunds: ₹0
- **Legacy ledger entries:** 3
- **Evidence sources:** 2
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | ReferralTransaction | ₹15 | credit | completed |
  | ReferralTransaction | ₹112.5 | credit | completed |

### 9. Wallet `e56b88a7` — user2@gmail.com

- **Category:** B_OPENING_BALANCE_MIGRATION
- **Reason:** Wallet has no transaction history but has 2 source records. Opening balance migration required.
- **Stored:** avail=137.5, pending=-137.5, withdrawn=0
- **Replayed:** avail=0, pending=0, withdrawn=0
- **Expected (verified):** avail=137.5, pending=0, withdrawn=0
- **Transactions:** 0 | Orders: 0 | Payments: 0
- **Released commissions:** ₹0 | Referrals: ₹137.5 | Refunds: ₹0
- **Legacy ledger entries:** 2
- **Evidence sources:** 2
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | ReferralTransaction | ₹25 | credit | completed |
  | ReferralTransaction | ₹112.5 | credit | completed |

### 10. Wallet `e56ba75a` — user3@gmail.com

- **Category:** B_OPENING_BALANCE_MIGRATION
- **Reason:** Wallet has no transaction history but has 3 source records. Opening balance migration required.
- **Stored:** avail=387.5, pending=-387.5, withdrawn=0
- **Replayed:** avail=0, pending=0, withdrawn=0
- **Expected (verified):** avail=387.5, pending=0, withdrawn=0
- **Transactions:** 0 | Orders: 0 | Payments: 0
- **Released commissions:** ₹0 | Referrals: ₹387.5 | Refunds: ₹0
- **Legacy ledger entries:** 3
- **Evidence sources:** 3
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | ReferralTransaction | ₹50 | credit | completed |
  | ReferralTransaction | ₹112.5 | credit | completed |
  | ReferralTransaction | ₹225 | credit | completed |

### 11. Wallet `e56cce98` — delivery@gmail.com

- **Category:** B_OPENING_BALANCE_MIGRATION
- **Reason:** Wallet has no transaction history but has 3 source records. Opening balance migration required.
- **Stored:** avail=0, pending=150, withdrawn=0
- **Replayed:** avail=0, pending=0, withdrawn=0
- **Expected (verified):** avail=0, pending=0, withdrawn=0
- **Transactions:** 0 | Orders: 0 | Payments: 0
- **Released commissions:** ₹0 | Referrals: ₹0 | Refunds: ₹0
- **Legacy ledger entries:** 3
- **Evidence sources:** 3
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | LegacyLedgerEntry | ₹50 | credit | pending |
  | LegacyLedgerEntry | ₹50 | credit | pending |
  | LegacyLedgerEntry | ₹50 | credit | pending |

### 12. Wallet `e5b9e795` — gsk@apexbee.in

- **Category:** C_MISSING_RECORD
- **Reason:** Transaction replay produces negative intermediate balance. Missing credit or duplicate debit suspected.
- **Stored:** avail=1849.9899999999998, pending=1000, withdrawn=0
- **Replayed:** avail=-1000, pending=1000, withdrawn=0
- **Expected (verified):** avail=349.99, pending=1000, withdrawn=0
- **Transactions:** 1 | Orders: 0 | Payments: 0
- **Released commissions:** ₹302.99 | Referrals: ₹47 | Refunds: ₹0
- **Legacy ledger entries:** 8
- **Evidence sources:** 10
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | CommissionSettlement | ₹296.98900000000003 | credit | completed |
  | CommissionSettlement | ₹4.99994726 | credit | completed |
  | CommissionSettlement | ₹0.999999 | credit | completed |
  | CommissionSettlement | ₹296.98900000000003 | credit | pending |
  | CommissionSettlement | ₹4.99994726 | credit | pending |
  | ReferralTransaction | ₹25 | credit | completed |
  | ReferralTransaction | ₹20.000031050999997 | credit | completed |
  | ReferralTransaction | ₹1.999998 | credit | completed |
  | ReferralTransaction | ₹20.000031050999997 | credit | pending |
  | LegacyLedgerEntry | ₹2500 | credit | completed |

### 13. Wallet `e51662c8` — gm@apexbee.in

- **Category:** B_OPENING_BALANCE_MIGRATION
- **Reason:** Wallet has no transaction history but has 8 source records. Opening balance migration required.
- **Stored:** avail=5174, pending=0, withdrawn=0
- **Replayed:** avail=0, pending=0, withdrawn=0
- **Expected (verified):** avail=174, pending=40, withdrawn=0
- **Transactions:** 0 | Orders: 0 | Payments: 0
- **Released commissions:** ₹66 | Referrals: ₹108 | Refunds: ₹0
- **Legacy ledger entries:** 7
- **Evidence sources:** 8
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | CommissionSettlement | ₹63 | credit | completed |
  | CommissionSettlement | ₹2.999997 | credit | completed |
  | ReferralTransaction | ₹50 | credit | completed |
  | ReferralTransaction | ₹15.000083791 | credit | completed |
  | ReferralTransaction | ₹40.000062101999994 | credit | completed |
  | ReferralTransaction | ₹2.999997 | credit | completed |
  | ReferralTransaction | ₹40.000062101999994 | credit | pending |
  | LegacyLedgerEntry | ₹5000 | credit | completed |

### 14. Wallet `4116163e` — vendor_a@apexbee.in

- **Category:** B_OPENING_BALANCE_MIGRATION
- **Reason:** Wallet has no transaction history but has 2 source records. Opening balance migration required.
- **Stored:** avail=0, pending=0, withdrawn=0
- **Replayed:** avail=0, pending=0, withdrawn=0
- **Expected (verified):** avail=0, pending=1298, withdrawn=0
- **Transactions:** 0 | Orders: 0 | Payments: 0
- **Released commissions:** ₹0 | Referrals: ₹0 | Refunds: ₹0
- **Legacy ledger entries:** 0
- **Evidence sources:** 2
  | Type | Amount | Direction | Status |
  |---|---|---|---|
  | CommissionSettlement | ₹599 | credit | pending |
  | CommissionSettlement | ₹699 | credit | pending |

