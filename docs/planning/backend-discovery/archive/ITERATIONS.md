# Iteration Summaries: backend-server

*Summary of discovery iterations for context and retrospective.*

---

[Iteration summaries will be added at natural breakpoints (typically phase transitions)]

## ITR-001: 2026-02-11 — Story Development (Phase 3)

**Phase**: Story Development (Phase 3)

**Goals**:
Graduate Story 8 (ChromaDB Memory Integration)

**Activities**:
Researched chromadb npm SDK v3.3.0; resolved collection design, embedding strategy, scope boundary, document structure, graceful degradation, connection lifecycle, public API surface

**Key Outcomes**:
Story 8 graduated to SPEC.md v0.6 with 9 decisions (D34-D42), 11 acceptance scenarios, 8 edge cases (EC-46-EC-53), 12 FRs (FR-096-FR-107), 8 SCs (SC-046-SC-053)

**Questions Added**: [Questions not specified]

**Decisions Made**: D34-D42

**Research Conducted**: [Research not specified]

**Next Steps**:
Deep-dive Story 9 (Coaching Pipeline)

---

## ITR-002: 2026-02-11 — Story Development (Phase 3)

**Phase**: Story Development (Phase 3)

**Goals**:
Graduate Story 9 (Coaching Pipeline)

**Activities**:
Mapped all 10 brainstorm API calls to stories. Scoped Story 9 to cover 5 API call types (Coach Agent, Memory Retrieval Filtering, Knowledge Gap Extraction, Dreyfus Assessment, Memory Summarisation) across 2 orchestration flows (pipeline entry, session wrap-up). Defined 5 Zod response schemas, 2 new MCP tools, 2 new WebSocket message types. Logged additive revisions to Stories 5 and 6.

**Key Outcomes**:
Story 9 graduated to SPEC.md v0.7 with 11 decisions (D43-D53), 13 acceptance scenarios, 11 edge cases (EC-54-EC-64), 21 FRs (FR-108-FR-128), 8 SCs (SC-054-SC-061). Logged REV-001 (Story 5) and REV-002 (Story 6).

**Questions Added**: [Questions not specified]

**Decisions Made**: D43-D53

**Research Conducted**: [Research not specified]

**Next Steps**:
Deep-dive Story 10 (Observer System)

---

## ITR-003: 2026-02-11 — Story Development (Phase 3)

**Phase**: Story Development (Phase 3)

**Goals**:
Deep-dive and graduate Story 10 (Observer System)

**Activities**:
Resolved 11 design questions, logged decisions D54-D64, wrote 16 acceptance scenarios, 9 edge cases, 22 functional requirements, 10 success criteria

**Key Outcomes**:
Story 10 graduated to SPEC.md at 100% confidence

**Questions Added**: [Questions not specified]

**Decisions Made**: D54-D64

**Research Conducted**: [Research not specified]

**Next Steps**:
Deep-dive on Story 11 (UI-Driven API Calls)

---

## ITR-004: 2026-02-11 — Story Development (Phase 3)

**Phase**: Story Development (Phase 3)

**Goals**:
Graduate Story 11: UI-Driven API Calls

**Activities**:
Deep-dive questioning on Explain This and Practice Review flows, WebSocket message shapes, kata data model, retry behaviour, error UX, action logging

**Key Outcomes**:
Story 11 graduated with 10 scenarios, 8 edge cases, 17 FRs, 10 SCs. Story 5 stubs upgraded. Story 4 gains 2 action types.

**Questions Added**: [Questions not specified]

**Decisions Made**: D65-D76

**Research Conducted**: [Research not specified]

**Next Steps**:
Story 12: Dashboard Data Assembly

---

## ITR-005: 2026-02-11 — Story Development (Phase 3)

**Phase**: Story Development (Phase 3)

**Goals**:
Graduate Story 12: Dashboard Data Assembly

**Activities**:
Deep-dive on dashboard progressive loading, gh CLI integration, issue assessment with ChromaDB, learning materials with web search, stats period filtering, error handling

**Key Outcomes**:
Story 12 graduated with 11 scenarios, 10 edge cases, 19 FRs, 10 SCs. All 12 stories now graduated. Story 5 stubs upgraded. Story 7 gains tools parameter. Spec at v1.0.

**Questions Added**: [Questions not specified]

**Decisions Made**: D77-D89

**Research Conducted**: [Research not specified]

**Next Steps**:
Final spec validation and user review

---
