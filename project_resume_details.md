# 📄 Resume Project Details

---

## Project Title

**AI-Guided Academic Project Progress Tracking Platform with Planning & Mentorship Assistance**

---

## One-Liner (for Resume Header)

> Built a full-stack multi-agent AI platform that converts a 2–3 line project idea into a complete academic project blueprint using a 7-agent LangGraph pipeline, with RAG-powered mentoring, dynamic progress tracking, and a faculty monitoring dashboard.

---

## Duration

**May 2026 – Aug 2026** (~13 weeks / 4 Sprints)

---

## Team Size

Team project (refer to your actual team size)

---

## Tech Stack

| Layer | Technologies |
|:---|:---|
| **Frontend** | React 18.2, Vite, Tailwind CSS, Axios, Lucide React, Mermaid.js |
| **Backend** | Python, FastAPI, Uvicorn, Pydantic |
| **AI & Orchestration** | LangGraph, LangChain, Google Gemini API, Groq LLaMA 3 70B (fallback) |
| **Vector Store & RAG** | Pinecone Serverless, SentenceTransformers (`all-MiniLM-L6-v2`), Pinecone Inference API (`llama-text-embed-v2`) |
| **Database & Auth** | Supabase PostgreSQL, JWT (python-jose), bcrypt password hashing |
| **DevOps** | Docker, Docker Compose, Git & GitHub |
| **Testing** | Pytest, 22 Unit Test Cases |

---

## Problem Statement

Students frequently struggle with selecting, planning, executing, and documenting academic projects — not due to technical difficulty, but because of poor planning, unclear objectives, unrealistic timelines, and limited faculty bandwidth. Faculty members supervising multiple teams simultaneously cannot provide personalized, ongoing guidance to each student group.

---

## Solution / What It Does

An intelligent, agentic AI platform that guides students through the **complete academic project lifecycle**:

1. A student submits a rough project idea in **2–3 lines**.
2. The platform triggers a **7-agent sequential AI pipeline** (via LangGraph) that automatically produces:
   - **Skill Assessment Report** — evaluates student strengths and gaps
   - **Feasibility & Scope Analysis** — determines if the idea is viable for a 12-week semester
   - **Technology Stack Recommendation** — justified tech choices mapped to student skills
   - **Milestone & Timeline Plan** — week-by-week Gantt chart roadmap with Mermaid.js rendering
   - **Risk Assessment & Mitigation Matrix** — identifies blockers, skill gaps, and contingencies
   - **Mentor Advice & Study Recommendations** — actionable guidance to start work
   - **Final Documentation (README Blueprint)** — production-grade project document with SQL schemas, architecture diagrams, and setup instructions
3. Post-planning, students interact with a **RAG-powered conversational AI mentor** for ongoing guidance, progress tracking, and dynamic plan recalibration.
4. On-demand generation of university-standard **Synopsis, Methodology Reports, Progress Reports, and Thesis Outlines**.
5. Faculty access a **dedicated monitoring dashboard** with real-time project health indicators (Green/Amber/Red), auto-generated weekly summaries, and analytics.

---

## Key Modules (8 Total)

1. **Student Profile & Skill Assessment Module** — Registration, profile management, and interactive skill scoring.
2. **Project Idea Submission & Feasibility Analysis Agent** — Split-screen proposal UI and automated feasibility evaluation.
3. **Scope Definition & Tech Stack Recommendation Agent** — MVP boundary definition with trade-off justified technology recommendations.
4. **Milestone & Timeline Planning Agent** — 12-week schedule generation with native Mermaid.js Gantt chart rendering.
5. **Risk Assessment & Mitigation Agent** — Proactive blocker identification, dependency risk scoring, and contingency planning.
6. **Conversational Mentor Interaction Module** — Context-grounded RAG chat workspace integrating uploaded syllabus/rubric PDFs and project state memory.
7. **Documentation & Report Generation Module** — Academic Synopsis, Methodology, and Progress report generator adhering to university thesis guidelines.
8. **Faculty Monitoring Dashboard** — Supervisor dashboard for tracking team velocity, project status badges, health indicators, and weekly executive summaries.

---

## Architecture Highlights

### Multi-Agent AI Pipeline (LangGraph State Machine)
- **7 sequential agents** orchestrated via LangGraph's `StateGraph` with typed state (`TypedDict`):
  `Skill Assessor → Feasibility Evaluator → Scope Definer → Tech Advisor → Milestone Planner → Risk Analyst → Documentation Compiler`
- **Multi-model failover**: Cycles through 5 Gemini model variants; falls back to Groq LLaMA 3 70B on rate limits; provides offline structured fallbacks as a final safety net.
- Separate compiled graphs for: Initialization Pipeline, Chat, Plan Adjustment (chained with Risk + Mentor re-evaluation), Weekly Check-in, and Document Generation.

### RAG (Retrieval-Augmented Generation) System
- PDF documents (syllabi, rubrics) uploaded and ingested via **PyPDF → chunked → embedded via Pinecone Inference API → stored in Pinecone Serverless** vector index.
- Chat queries embed the user question, perform vector similarity search filtered by `project_id`, and inject retrieved context into the AI Mentor's prompt.

### Persistent Memory System
- All agent outputs (skill reports, plans, risk analyses, etc.) persisted in Supabase `agent_output` table.
- Chat history stored in `chat_messages` table with role-based (user/ai) entries.
- Memory is loaded from DB before every agent invocation, ensuring full conversational context continuity.

### Authentication & Security
- JWT-based authentication with bcrypt password hashing via `passlib`.
- Supabase PostgreSQL with normalized tables: `student`, `skill_assessment`, `project_idea`, `agent_output`, `chat_messages`.

---

## REST API Endpoints (12 Total)

| Endpoint | Method | Purpose |
|:---|:---|:---|
| `/auth/register` | POST | Student registration with bcrypt hashing |
| `/auth/login` | POST | JWT token authentication |
| `/onboard` | POST | Profile + skills + project idea submission |
| `/student/{id}` | GET | Fetch student profile, skills, project data |
| `/initialize` | POST | Execute full 7-agent LangGraph pipeline |
| `/upload` | POST | Ingest PDF documents into Pinecone for RAG |
| `/chat` | POST | RAG-powered conversational AI mentor |
| `/progress_update` | POST | Submit updates → dynamic plan recalibration |
| `/check_in` | POST | Weekly mentor evaluation & goal setting |
| `/generate_document` | POST | Generate Synopsis/Methodology/Progress/Thesis documents |
| `/faculty/dashboard` | GET | Aggregate faculty monitoring overview |
| `/faculty/projects/{id}/progress-summary` | POST | AI-generated executive progress summary |

---

## Frontend Pages (23 React Components)

- Landing Page, Login Portal, Auth Gateway
- Dashboard View, Profile View, Settings View
- Project Submission, Skill Assessment, Project Details
- AI Pipeline Demo View, Mentor Chat View
- Reports View (document generation)
- **Faculty Portal**: Dashboard, My Teams, Progress Tracking, Analytics, AI Insights, Mentorship, Reviews, Documents, Notifications, Projects, Coming Soon

---

## My Responsibilities / Key Contributions

> [!IMPORTANT]
> **Edit this section** to reflect YOUR specific contributions. Pick from the list below:

- Designed and implemented the **7-agent LangGraph state machine** with multi-model failover (Gemini → Groq → offline fallback).
- Built the **RAG system** using Pinecone Serverless + Pinecone Inference API for document ingestion, embedding, and context-aware retrieval.
- Developed the **FastAPI backend** with 12 REST endpoints, JWT authentication, and bcrypt password hashing.
- Implemented the **persistent memory system** for storing and loading agent outputs and chat history from Supabase PostgreSQL.
- Built the **React 18 frontend** with 23 page components, Tailwind CSS styling, and Mermaid.js Gantt chart rendering.
- Developed the **Faculty Monitoring Dashboard** with real-time project health indicators and AI-generated progress summaries.
- Designed the **dynamic plan recalibration** system where student progress updates trigger agent re-evaluation.
- Managed Agile artifacts: 20 user stories, 37 sprint tasks, 18 resolved defect tickets, 22 unit test cases.

---

## Resume Bullet Points (Pick 4–6)

- **Engineered a 7-agent AI pipeline** using LangGraph and Google Gemini API that autonomously converts a 2–3 line project idea into a structured academic blueprint (feasibility, scope, tech stack, Gantt timeline, risk matrix, and documentation).
- **Implemented a RAG-based conversational AI mentor** using Pinecone Serverless vector search and PDF document ingestion, providing context-grounded academic guidance with full project state memory.
- **Built a full-stack platform** (React 18 + FastAPI + Supabase PostgreSQL) with 12 REST API endpoints, JWT authentication, and a faculty monitoring dashboard with real-time project health indicators.
- **Designed multi-model failover architecture** cycling through 5 Gemini variants with Groq LLaMA 3 70B fallback and structured offline responses, achieving near-zero downtime for AI operations.
- **Developed dynamic plan recalibration** where student progress updates trigger chained re-evaluation across Plan Adjustment → Risk Analysis → Mentor agents, automatically compressing future milestones to meet fixed deadlines.
- **Automated academic document generation** (Synopsis, Methodology, Progress Reports, Thesis Outlines) adhering to university guidelines with on-demand Markdown output.

---

## Quantifiable Impact & Metrics

- **7 specialized AI agents** orchestrated in a sequential state machine pipeline
- **12 REST API endpoints** for full CRUD, pipeline execution, chat, and faculty analytics
- **23 React page components** + 3 shared components for a comprehensive student + faculty portal
- **5-model failover chain** (Gemini variants) + Groq fallback for resilient AI inference
- **22 automated unit test cases** with defect tracking (18 resolved defects)
- **4 Agile sprints** managed with product backlog, sprint backlog, daily standups, and sprint retrospectives

---

## Links

- **GitHub**: `https://github.com/just000Curious/ai-academic-mento` *(update with your actual repo URL)*
- **Live Demo**: *(add if deployed)*
