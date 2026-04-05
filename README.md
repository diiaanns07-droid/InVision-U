# 🚀 InVision U — AI-Powered Candidate Evaluation Platform

> Next-generation system for evaluating candidates using **essay analysis, adaptive interviews, and video intelligence**

---

## 🧠 Overview

**InVision U** is an AI-driven platform designed to evaluate candidates beyond traditional metrics.

Instead of relying on resumes or grades, the system analyzes:

- Written essays
- Real-time interview responses
- Video behavior and communication

The goal is to identify **true leadership potential, initiative, and human depth**.

---

## ⚡ Core Features

### 📝 Essay Evaluation
- Hybrid model (LoRA + LLM audit)
- Detects:
  - leadership
  - initiative
  - growth
  - motivation
  - values
- AI-detection встроен

---

### 🎯 Adaptive Interview System
- Dynamic question selection
- Based on candidate weaknesses & signals
- Uses:
  - rule-based analysis
  - LLM scoring

→ каждый кандидат получает уникальное интервью

---

### 🎥 Video Intelligence
- Speech analysis (Whisper)
- Voice intelligence (confidence, pauses, stress)
- Lip-sync validation
- Anti deepfake checks
- Presence & communication scoring

---

### 🧩 Multi-Modal Scoring
- Combines:
  - Essay
  - Interview
  - Video
- Produces:
  - Final score
  - Recommendation (YES / NO / MAYBE)

---

## 🏗️ Architecture


Frontend (Next.js)
↓
API Layer (FastAPI)
↓
────────────────────────────
AI Systems
────────────────────────────
• Essay Engine (LoRA + LLM)
• Interview Engine (Adaptive logic)
• Answer Analyzer (rule + LLM)
• Video Pipeline (ASR + CV + Voice)
────────────────────────────
↓
Final Evaluation


---

## 🛠️ Tech Stack

### Frontend
- Next.js
- TypeScript
- TailwindCSS

### Backend
- FastAPI
- Python

### AI / ML
- LoRA (Qwen2.5)
- LLaMA (Groq API)
- Whisper (ASR)
- Sentence Transformers
- DeepFace
- XGBoost

### Database
- Prisma (PostgreSQL)

---

## 🚀 Getting Started

### Frontend

```bash
npm install
npm run dev
Backend
pip install -r requirements.txt
uvicorn api:app --reload
Video API
uvicorn main:app --port 8001
🔌 API Endpoints
Interview
POST /interview/start
POST /interview/{id}/answer
GET /interview/{id}/evaluation
Essay
POST /evaluate-essay
Video
POST /evaluate
POST /evaluate-url
🎯 Key Idea

Most systems evaluate what candidates say.

InVision U evaluates:

what they did
how they think
how they communicate
whether they are real
⚠️ Current Status
MVP ready ✅
Multi-modal evaluation working ✅
Admin panel implemented ✅
Needs scaling (DB, queues, infra)
🔮 Future Improvements
Redis session storage
Real-time interview streaming
Better anti-cheat detection
Model fine-tuning with real data
Scoring calibration layer
