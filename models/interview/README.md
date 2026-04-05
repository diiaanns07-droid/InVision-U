- evaluates answers in real-time  
- builds a structured candidate profile  

Unlike static interviews, this system **thinks during the interview**.

---

## ⚡ Key Features

🎯 Adaptive questioning (not scripted)  
🧠 Real-time scoring per answer  
📊 Multi-metric evaluation  
🔍 Weakness detection & follow-ups  
📈 Confidence-based stopping  
🤖 LLM + rule-based hybrid scoring  

---

## 🏗️ Architecture



User → API → Interview Engine
├── Question Bank
├── Answer Analyzer
├── Adaptive Logic
└── LLM Scorer (Groq)



---

## 🧩 Core Components

### 🧠 Interview Engine
- Controls full interview flow  
- Chooses next best question  
- Decides when to stop  
- Generates final evaluation  

---

### 📚 Question Bank
- Structured & tagged questions  
- Depth levels (probe → verify → challenge)  
- Smart follow-up triggers  

---

### 🔍 Answer Analyzer
- Extracts signals:
  - ownership  
  - results  
  - reflection  
  - action  
- Detects:
  - vagueness  
  - contradictions  
  - lack of ownership  

---

### 🤖 LLM Scoring
- Uses Groq (LLaMA 3.3)
- Strict anti-inflation scoring
- Blended with rule-based system

---

## 📊 Evaluation Metrics

| Metric       | Description                          |
|-------------|--------------------------------------|
| Leadership  | Leading others & impact              |
| Initiative  | Self-driven execution                |
| Growth      | Learning & transformation            |
| Motivation  | Drive & persistence                  |
| Values      | Ethics & decision-making             |

---

## 🔌 API Endpoints

### 🚀 Start Interview

```bash
POST /interview/start
{
  "candidate_id": "123",
  "essay_summary": "Strong motivation but weak leadership",
  "essay_weakness_metrics": ["leadership"]
}
💬 Submit Answer
POST /interview/{session_id}/answer
{
  "answer": "I led a small team..."
}
📊 Get Status
GET /interview/{session_id}/status
🧠 Final Evaluation
GET /interview/{session_id}/evaluation
⚙️ How It Works
Start session
System asks first question
User answers
AI analyzes answer
Engine selects next question
Repeat until confident
Generate final evaluation
🧠 Smart Logic

The system dynamically:

focuses on weakest metrics
escalates question depth
triggers follow-ups on vague answers
avoids repetitive questions
stops when confidence is high
🛠️ Installation
git clone https://github.com/your-repo/interview-ai.git
cd interview-ai

python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
▶️ Run
uvicorn api:app --reload
📁 Project Structure
.
├── api.py                  # FastAPI routes
├── interview_engine.py     # Core logic
├── answer_analyzer.py      # Signal extraction
├── question_bank.py        # Questions
├── interview_llm_api.py    # LLM scoring
🚀 Roadmap
 Voice interview support
 Video analysis
 Frontend dashboard
 Candidate ranking system
