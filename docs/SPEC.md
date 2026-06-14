# Call Center AI Assistant — Project Specification

> Master specification and source of truth for the system. The scaffold in this
> repo implements it. See the root `README.md` for build/run instructions and the
> per-phase implementation status.

## 1. Overview
A chat-based internal tool where call center agents ask an AI assistant questions
about company brands, and the AI answers strictly from an approved knowledge base.
The AI never invents answers. When data is missing, it raises a request for a Team
Leader to review and approve before it enters the database.

**Key principle:** The AI is a *retriever and proposer*, never an autonomous editor.
All knowledge-base changes require human approval.

## 2. Scope & Constraints
| Item | Value |
|------|-------|
| Brands | 10 |
| Languages | Arabic + English (bilingual) |
| Users | ~50 agents |
| Load | ~1,000 questions/day |
| Data type | Text only (incl. pricing tables, branch details, working hours) |
| Hosting | Railway (cloud) |

## 3. Tech Stack
Railway · Node.js + Express · PostgreSQL + pgvector · Google Gemini API ·
Gemini `text-embedding-004` (768 dims) · Next.js (React) · Microsoft Graph API ·
JWT + RBAC.

## 4. User Roles
- **Agent** — chats with the AI; raises gap requests.
- **Team Leader** — reviews/approves info requests; resolves gaps with standard answers.
- **Admin** — manages users, brands, knowledge, and structured data; views dashboards.

## 5. Core Features
1. **AI Chat (RAG)** — vector + SQL retrieval, server-side confidence gate, strict
   Gemini prompt, same-language reply, refuses below threshold.
2. **Knowledge Base** — unstructured text as embedded chunks (`pgvector`);
   structured data (pricing, branches, hours) in SQL tables, queried directly.
3. **Gap Loop** — "no data" → ticket → Team Leader standard answer → write back to KB.
4. **New Information Requests (Outlook)** — MS Graph polls a CC'd mailbox, AI
   extracts candidate Q/A, Team Leader approves/edits/rejects. No automatic writes.
5. **Dashboard & Analytics** — repeated questions, gaps per brand, request queues,
   usage per agent/brand, response stats.

## 7. RAG Prompt (strict)
```
You are an assistant for call center agents. Answer ONLY using the CONTEXT below.
If the answer is not in the CONTEXT, reply exactly: "No data available" (in the
user's language). Never use your own knowledge. Never guess. Reply in the same
language as the QUESTION.
CONTEXT: {retrieved_chunks_and_structured_data}
QUESTION: {agent_question}
```
**Confidence gate (server-side):** if top similarity < THRESHOLD (default 0.75) →
skip Gemini, return "No data available", open a gap ticket.

## 8. API Endpoints (implemented)
```
POST   /auth/login
POST   /auth/register         (admin)
GET    /auth/me
GET    /auth/users            (admin)

POST   /chat                  (agent asks; answer or "no data")
GET    /chat/history/:agentId

GET    /brands
POST   /brands                (admin)
PATCH  /brands/:id            (admin)
DELETE /brands/:id            (admin)

GET    /knowledge/:brandId
POST   /knowledge             (admin)
DELETE /knowledge/chunk/:id   (admin)

GET    /branches/:brandId
POST   /branches              (admin)
DELETE /branches/:id          (admin)
GET    /pricing/:brandId
POST   /pricing               (admin)
DELETE /pricing/:id           (admin)

POST   /gaps                  (raise gap)
GET    /gaps                  (team leader queue)
PATCH  /gaps/:id              (resolve / reject)

GET    /info-requests         (review queue)
POST   /info-requests
PATCH  /info-requests/:id     (approve / edit-approve / reject)

GET    /analytics/repeated-questions
GET    /analytics/gaps
GET    /analytics/requests
GET    /analytics/usage

POST   /jobs/poll-outlook     (internal; X-Jobs-Secret header)
GET    /health
```

## 9. Build Plan (phased)
1. Foundation — DB+pgvector, Express, JWT, RBAC, CRUD. ✅
2. AI Chat (RAG) — embeddings, retrieval, gate, Gemini. ✅
3. Gap Loop — tickets, resolution, write-back. ✅
4. Outlook — MS Graph OAuth, polling, extraction, review requests. 🟡 scaffolded
5. Dashboard & Analytics. ✅

## 10. Risk Notes
- MS Graph OAuth is the trickiest integration (app registration + admin consent).
- Hallucination prevention depends on a well-tuned similarity threshold — test with
  real bilingual questions.
- Verify Arabic retrieval quality early.
- Keep all KB writes human-approved; log every conversation.

## 11. Out of Scope (v1)
- AI does NOT edit the database directly.
- AI does NOT answer from outside the knowledge base.
- No file/image/voice handling (text only).
