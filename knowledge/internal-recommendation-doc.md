What participants need: Two things: (a) policy documents (ideally PDFs) with enforceable business rules, and (b) a company database where some records violate those policies — enabling the agent to flag violations with explainable justifications.
Primary Recommendation (Database)

IBM Transactions for Anti-Money Laundering (AML)
🔗 https://www.kaggle.com/datasets/ealtman2019/ibm-transactions-for-anti-money-laundering-aml
📜 License: CDLA-Sharing-1.0 (Community Data License Agreement — permissive, allows sharing and use)

Why this dataset is ideal:

    Synthetic financial transaction data with explicit laundering tags — transactions are pre-labeled as compliant or violating, providing ground truth for the compliance agent.
    Entirely synthetic (generated via multi-agent simulation) — no privacy concerns, no PII issues.
    Multiple transaction types (bank transfers, credit card, checks, purchases) with amounts, timestamps, and account relationships — rich enough to define meaningful compliance policies against.
    Participants can write PDF policy documents like "Flag any single transaction exceeding $10,000" or "Flag accounts with >5 transfers to the same beneficiary within 24 hours" and validate their agent's detection accuracy.
    Published by IBM Research with an academic paper backing its realism.

Secondary Recommendation (Database)

Synthetic Financial Datasets for Fraud Detection (PaySim)
🔗 https://www.kaggle.com/datasets/ealaxi/paysim1
📜 License: CC BY-SA 4.0

Why this is a strong alternative:

    6.3 million synthetic transactions based on real mobile money logs from an African country.
    Contains isFraud and isFlaggedFraud columns — pre-labeled violations.
    Transaction types include CASH_IN, CASH_OUT, DEBIT, PAYMENT, TRANSFER with amounts and balances — easy to write compliance rules against (e.g., "flag transfers where origin balance drops below zero", "flag cash-outs exceeding the daily limit").
    CC BY-SA is permissive for hackathon use.

Tertiary Recommendation (Database)

Employee Policy Compliance Dataset
🔗 https://www.kaggle.com/datasets/laraibnadeem2023/employee-policy-compliance-dataset
📜 License: Check Kaggle page

Why it's useful:

    Directly models HR/employee policy compliance — attendance violations, leave policy breaches, training completion status.
    Smaller and simpler — good for quick demos if participants want to show an HR compliance use case rather than financial.

For Policy Documents (PDFs)

The problem statement requires ingesting free-text PDF policy documents. Since policies are domain-specific, participants should create their own 2–3 page PDF policy documents tailored to whichever database they choose. This is straightforward and actually more realistic. Here are ready-to-use public policy templates:

    GDPR Violations Dataset (for reference policy text): https://www.kaggle.com/datasets/jessemostipak/gdpr-violations — License: CC0. Contains real GDPR enforcement actions with article references and summaries of violations. Participants can use the referenced GDPR articles as their policy PDF source.
    Actual GDPR Text: https://gdpr-info.eu/ — The full regulation text is public law, freely usable. Participants can create PDFs from specific articles (e.g., Article 5 data minimization, Article 17 right to erasure) and test whether their agent can extract enforceable rules from legal language.
    US Bank Secrecy Act / AML regulations: Publicly available government documents that pair naturally with the IBM AML dataset.

