# Research Report: User-in-the-loop Feedback Mechanism for Yggdrasil

This document outlines the technical strategy for implementing a feedback loop in the Yggdrasil audit engine to reduce false positives and improve scoring accuracy over time.

---

## 1. Online Learning: Incremental Scoring Updates

To avoid full retraining of the scoring model, Yggdrasil will utilize an **Online Learning** approach using Stochastic Gradient Descent (SGD).

### Mechanism
- **Feature Vector ($x$):** For every violation, we extract a feature vector including:
  - `raw_confidence` (from Gemini)
  - `severity_weight` (0.5 to 1.0)
  - `z_score` of the transaction amount
  - `rule_type_id` (one-hot encoded)
- **Feedback ($y$):** Binary label where $1$ = Valid Violation, $0$ = False Positive.
- **Update Logic:** 
  The global weights $W$ are updated incrementally using the cross-entropy loss gradient:
  $$W_{t+1} = W_t - \eta \cdot (\hat{y} - y) \cdot x$$
  where $\eta$ is the learning rate (e.g., 0.01).

### Implementation in Yggdrasil
- Store weights in a persistent `scoring_config` table.
- When a user clicks "Dismiss as False Positive", the `ReviewViolation` API triggers a weight update in the background.

---

## 2. Bayesian Rule Weighting

This approach adjusts the confidence of specific rules based on their historical performance (Precision).

### Mathematical Formula
We model the precision of each rule $R$ using a Beta distribution $Beta(\alpha, \beta)$.

- **Initial State (Prior):** $\alpha=1, \beta=1$ (Uniform distribution).
- **Update Step:**
  - If Approved: $\alpha \leftarrow \alpha + 1$
  - If Dismissed: $\beta \leftarrow \beta + 1$
- **Confidence Adjustment Factor ($C_R$):**
  $$C_R = \frac{\alpha}{\alpha + \beta}$$
  *Note: To be more conservative, use the Lower Bound of the 95% Confidence Interval.*

### Application
The final violation confidence score becomes:
$$Confidence_{final} = Confidence_{Gemini} \times C_R$$

---

## 3. Embedding-based Similarity & Clustering

The system will use vector embeddings to identify "islands of noise"—groups of similar records that are consistently flagged as false positives.

### Proposed Architecture
1.  **Textualization:** Convert violation records into a canonical text format:
    `"Rule: {rule_id}. Reason: {justification}. Data: {row_values}"`
2.  **Vectorization:** Generate embeddings using Gemini's `text-embedding-004`.
3.  **Clustering:** Perform DBSCAN clustering on the embeddings of all violations in a scan.
4.  **Auto-Dismissal:** If a user dismisses 3 violations in a cluster of 10, the remaining 7 are automatically flagged as "High Probability False Positive" and their scores are suppressed.

---

## 4. Prompt Refinement (Negative Examples)

To improve future rule extraction, the system will feed "False Positive" samples back into the Gemini prompt.

### Strategy: Few-Shot Negative Learning
When Gemini is asked to "Generate compliance rules for this dataset," the system prompt will include a "What to Avoid" section:

> **Avoid patterns similar to these previous False Positives:**
> - Rule: "High Velocity Transfer" - Flagged regular payroll batches.
> - Rule: "Round Number Detection" - Flagged standard $1,000 internal transfers.

This "Negative Buffer" is dynamically populated from the most frequently dismissed rules.

---

## 5. Generalized Anomaly Detection

To provide a domain-agnostic risk layer, we will implement an Isolation Forest model.

### Algorithm
Isolation Forests isolate observations by randomly selecting a feature and then randomly selecting a split value between the maximum and minimum values of the selected feature.

- **Anomaly Score $s(x, n)$:**
  $$s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$
  - $h(x)$: path length of observation $x$
  - $E(h(x))$: average path length over a collection of trees
  - $c(n)$: average path length of unsuccessful search in Binary Search Tree

### Integration
Records with an anomaly score $> 0.7$ will receive a "Statistical Outlier" badge in Yggdrasil, providing an independent validation signal alongside LLM-extracted rules.

---

## Implementation Roadmap

| Phase | Task | Duration |
| :--- | :--- | :--- |
| **Phase 1** | **Feedback Logging:** Capture 'Approved' vs 'Dismissed' events in DB. | 1 Week |
| **Phase 2** | **Bayesian Layer:** Implement rule-specific confidence weighting. | 1 Week |
| **Phase 3** | **Embedding Service:** Cluster violations and highlight similar cases. | 2 Weeks |
| **Phase 4** | **Prompt Loop:** Include negative examples in rule extraction prompts. | 1 Week |
| **Phase 5** | **Anomaly Engine:** Integrate Isolation Forest for domain-agnostic scoring. | 2 Weeks |
