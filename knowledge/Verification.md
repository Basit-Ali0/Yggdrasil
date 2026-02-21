# Verification Strategy: The Golden CSV

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [../../gist.md](../../gist.md).

## 🛡️ Objective
To provide a deterministic "Ground Truth" for testing the Yggdrasil rule engine during the 24-hour sprint. These test cases ensure that the mathematical logic is correct before we run larger datasets like IBM AML or PaySim.

---

## 1. Golden Test Case: Clean (Baseline)
**Purpose:** Verify 0 false positives.
**File:** `test_clean.csv`
**Contents:**
- 10 rows for 10 different accounts.
- All amounts < $1,000.
- All transaction types = 'TRANSFER'.
- All steps sequential.
**Expected Result:** 0 violations, 100% Compliance Score.

---

## 2. Golden Test Case: Threshold (CTR)
**Purpose:** Verify simple numeric threshold logic (`amount >= 10000`).
**File:** `test_threshold.csv`
**Contents:**
- Row 1: Amount $12,000 (Expected: CTR_THRESHOLD violation).
- Row 2: Amount $9,999 (Expected: No violation).
- Row 3: Amount $10,000 (Expected: CTR_THRESHOLD violation).
**Expected Result:** 2 violations.

---

## 3. Golden Test Case: Structuring Pattern
**Purpose:** Verify temporal window and count logic.
**File:** `test_structuring.csv`
**Contents:**
- Account A: 4 transactions of $9,500 within 5 hours (Expected: STRUCTURING_PATTERN).
- Account B: 2 transactions of $9,500 within 5 hours (Expected: No violation).
- Account C: 4 transactions of $9,500 spread over 48 hours (Expected: No violation - out of window).
**Expected Result:** 1 violation (Account A).

---

## 4. Golden Test Case: Round Amount
**Purpose:** Verify the modulo fix (`amount % 1000 === 0`).
**File:** `test_round.csv`
**Contents:**
- Row 1: Amount $5,000 (Round).
- Row 2: Amount $5,001 (Not Round).
- Row 3: Amount $10,000 (Round).
- Row 4: Amount $15,000 (Round).
**Expected Result:** 1 ROUND_AMOUNT_PATTERN violation (for the account with 3 round transactions).

---

## 5. Verification Workflow
1. **Scrub:** Run the Clean-Pipe utility to normalize the CSV.
2. **Execute:** Run the Rule Engine via Web Worker.
3. **Compare:** Verify the `violation_count` and `rule_id` match the expected values above.
