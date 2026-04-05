- 🧩 Local fine-tuned model (LoRA)
- ☁️ Cloud audit (LLaMA via Groq)
- 🔍 AI-generated text detection

---

## ⚡ Key Features

✨ Hybrid AI evaluation  
🎯 Multi-metric scoring system  
🌍 Multi-language support (RU / KZ / EN)  
🛡️ Prompt injection protection  
🤖 AI detection module  
📊 Detailed explanations  

---

## 🏗️ Architecture

<p align="center">


User → FastAPI → HybridEvaluator
├── Local LoRA Model
├── Cloud Auditor (Groq)
└── AI Detector


</p>

---

## 📊 Scoring System

| Metric       | Description                          |
|-------------|--------------------------------------|
| Leadership  | Impact on people & coordination      |
| Initiative  | Self-driven actions                  |
| Growth      | Personal development depth           |
| Motivation  | Internal drive & persistence         |
| Values      | Ethics, empathy, responsibility      |

---

## 🔌 API

### Evaluate Essay

```bash
POST /evaluate-essay
{
  "essay_text": "I led a team of students..."
}
Example Response
{
  "leaderPotential": 3.9,
  "deepHumanPotential": 4.0,
  "confidence": 0.82
}
🛠️ Installation
git clone https://github.com/your-repo/essay-evaluator.git
cd essay-evaluator

python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

pip install -r requirements.txt
▶️ Run
uvicorn essay_api:app --reload
🧠 Tech Stack
FastAPI — backend API
Qwen 2.5 (LoRA) — local model
Groq (LLaMA) — cloud audit
Transformers / PEFT / Unsloth
📁 Structure
.
├── essay_api.py
├── hybrid_evaluator.py
├── essey_model.py
├── datasets/
└── essay-eval-lora/
🚀 Roadmap
 Video interview analysis
 Frontend dashboard
 PDF essay upload
 Model improvements
🤝 Contributing

Pull requests are welcome.

📜 License

MIT Licensу
