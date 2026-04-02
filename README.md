# InVision-U
# InVision U AI Evaluation System

## Русская версия

### Описание проекта

InVision U AI Evaluation System — это MVP-система для оценки кандидатов с помощью искусственного интеллекта.  
Она объединяет анализ эссе, адаптивное интервью и гибридный скоринг, чтобы оценивать кандидата по нескольким ключевым качествам.

Система подходит для:
- отбора абитуриентов
- оценки участников программ и стажировок
- первичного AI-скрининга кандидатов

---

### Основные метрики оценки

Система оценивает кандидата по 5 критериям:

- **Leadership** — лидерство
- **Initiative** — инициативность
- **Growth** — способность к развитию
- **Motivation** — мотивация
- **Values** — ценности

---

### Архитектура проекта

Проект состоит из нескольких ключевых модулей:

#### 1. Essay Evaluation API
Отвечает за оценку эссе кандидата.

Функции:
- принимает текст эссе
- определяет язык
- при необходимости переводит текст на английский
- запускает гибридную оценку
- возвращает баллы по 5 метрикам
- рассчитывает дополнительные итоговые показатели:
  - **Leader Potential**
  - **Deep Human Potential**
- выполняет базовую AI-detection проверку текста

---

#### 2. Hybrid Evaluator
Гибридный оценщик эссе, который объединяет:

- **локальную LoRA-модель** на базе Qwen 2.5 3B
- **облачную audit-модель** через Groq API

Локальная модель делает основную оценку, а облачная модель используется как дополнительная строгая проверка качества результата.

---

#### 3. Essay Model
Скрипт для обучения и использования essay evaluation модели.

Особенности:
- основан на **Qwen/Qwen2.5-3B-Instruct**
- использует **LoRA / QLoRA**
- обучается на датасете эссе с разметкой по 5 метрикам
- оптимизирован под GPU уровня RTX 4060 8GB

---

#### 4. Adaptive Interview Engine
Основной движок адаптивного интервью.

Функции:
- хранит состояние интервью
- выбирает следующий лучший вопрос
- учитывает слабые стороны кандидата
- повышает глубину вопросов по мере прохождения интервью
- завершает интервью при достижении достаточной уверенности

Фазы интервью:
- **Opening**
- **Exploring**
- **Deepening**
- **Closing**
- **Complete**

---

#### 5. Question Bank
База структурированных вопросов для интервью.

Каждый вопрос содержит:
- метрику, которую он проверяет
- тип вопроса
- глубину
- сигналы, которые ожидается выявить
- условия для follow-up вопросов

Типы вопросов:
- **Probe**
- **Verify**
- **Challenge**
- **Reflect**
- **Dilemma**

---

#### 6. Answer Analyzer
Rule-based модуль анализа ответов кандидата.

Он определяет:
- наличие конкретных действий
- наличие результата
- наличие рефлексии
- степень конкретики
- признаки размытости
- недостаток ownership
- отсутствие результата
- слишком короткие ответы
- возможные противоречия

При необходимости может быть дополнен LLM-скорингом.

---

#### 7. Interview API
FastAPI-сервис для запуска и управления интервью.

Основные endpoints:
- `POST /interview/start` — начать интервью
- `POST /interview/{session_id}/answer` — отправить ответ кандидата
- `GET /interview/{session_id}/status` — получить текущий статус
- `GET /interview/{session_id}/evaluation` — получить итоговую оценку
- `DELETE /interview/{session_id}` — удалить сессию

---

#### 8. Interview LLM Evaluator
Дополнительный строгий LLM-оценщик интервью.

Его задача:
- уменьшать завышение оценок
- требовать реальные доказательства действий
- штрафовать за:
  - отсутствие конкретики
  - отсутствие результата
  - отсутствие внешнего влияния
  - слабые или слишком общие примеры

---

### Как работает система

1. Кандидат отправляет эссе.
2. Essay API оценивает текст и определяет слабые метрики.
3. На основе этого запускается адаптивное интервью.
4. Interview Engine задаёт вопросы в реальном времени.
5. Answer Analyzer анализирует каждый ответ.
6. Система решает, какой вопрос задать следующим.
7. После завершения интервью формируется итоговая оценка кандидата.

---

### Используемые технологии

- Python
- FastAPI
- Pydantic
- Transformers
- PEFT / LoRA
- Unsloth
- Groq API
- PyTorch
- Langdetect
- Deep Translator

---

### Особенности проекта

- гибридная AI-оценка
- адаптивные интервью
- мультиязычная поддержка
- возможность локального запуска
- расширяемая архитектура
- прозрачная логика интервью
- ориентация на реальные действия кандидата, а не на красивые формулировки

---

### Текущий статус

Сейчас проект представляет собой MVP.

Реализовано:
- оценка эссе
- адаптивное интервью
- rule-based анализ ответов
- API для интеграции с фронтендом
- базовый гибридный scoring pipeline

Планируется:
- видео-модель для оценки интервью
- multimodal анализ
- админ-панель
- хранение сессий в Redis/PostgreSQL
- улучшение production-ready инфраструктуры

---

### Запуск проекта

#### 1. Установить зависимости

```bash
pip install -r requirements.txt
2. Запустить interview API
uvicorn api:app --reload
3. Запустить essay API
uvicorn essay_api:app --reload
Структура проекта
.
├── api.py
├── answer_analyzer.py
├── interview_engine.py
├── interview_llm_api.py
├── question_bank.py
├── essay_api.py
├── essey_model.py
├── hybrid_evaluator.py
└── README.md
Примечание

Видео-модель находится в разработке и пока не подключена в основной pipeline.
На текущем этапе система фокусируется на анализе эссе и текстового интервью.

English Version
Project Overview

InVision U AI Evaluation System is an MVP platform for candidate assessment powered by artificial intelligence.
It combines essay evaluation, adaptive interviewing, and hybrid scoring to estimate a candidate across several important dimensions.

The system can be used for:

university admissions
internship and program screening
early-stage candidate evaluation
Core Evaluation Metrics

The system evaluates candidates across 5 key dimensions:

Leadership
Initiative
Growth
Motivation
Values
Project Architecture

The project consists of several core modules:

1. Essay Evaluation API

Responsible for evaluating candidate essays.

Main functions:

receives essay text
detects language
translates text into English if needed
runs hybrid evaluation
returns 5 metric scores
calculates additional summary indicators:
Leader Potential
Deep Human Potential
performs basic AI-text detection
2. Hybrid Evaluator

A hybrid essay scoring module that combines:

a local LoRA model based on Qwen 2.5 3B
a cloud audit model via Groq API

The local model performs the main evaluation, while the cloud model acts as a stricter audit layer.

3. Essay Model

Training and inference script for the essay evaluation model.

Key points:

based on Qwen/Qwen2.5-3B-Instruct
uses LoRA / QLoRA
trained on an essay dataset labeled across 5 dimensions
optimized for RTX 4060 8GB-level hardware
4. Adaptive Interview Engine

The main engine that drives the adaptive interview process.

Responsibilities:

stores interview state
selects the next best question
prioritizes weak candidate areas
increases question depth over time
stops the interview once enough confidence is collected

Interview phases:

Opening
Exploring
Deepening
Closing
Complete
5. Question Bank

A structured repository of interview questions.

Each question includes:

target metric
question type
depth
expected signals
follow-up triggers

Question types:

Probe
Verify
Challenge
Reflect
Dilemma
6. Answer Analyzer

A rule-based answer analysis module.

It detects:

concrete actions
outcomes
reflection
specificity
vagueness
lack of ownership
missing results
very short answers
possible contradictions

It can also be extended with LLM-based scoring.

7. Interview API

A FastAPI service for running and managing interview sessions.

Main endpoints:

POST /interview/start — start interview
POST /interview/{session_id}/answer — submit candidate answer
GET /interview/{session_id}/status — get session status
GET /interview/{session_id}/evaluation — get final evaluation
DELETE /interview/{session_id} — delete session
8. Interview LLM Evaluator

An additional strict LLM-based evaluator for interviews.

Its role:

reduce score inflation
require real behavioral evidence
penalize:
vague answers
missing results
lack of external impact
weak examples
System Workflow
The candidate submits an essay.
The Essay API evaluates the text and identifies weak metrics.
Based on this, the adaptive interview starts.
The Interview Engine asks questions dynamically.
The Answer Analyzer processes each response.
The system selects the next best question.
After the interview ends, a final candidate evaluation is generated.
Tech Stack
Python
FastAPI
Pydantic
Transformers
PEFT / LoRA
Unsloth
Groq API
PyTorch
Langdetect
Deep Translator
Key Features
hybrid AI evaluation
adaptive interviews
multilingual support
local model support
extensible architecture
transparent interview logic
focus on real actions instead of polished wording
Current Status

The project is currently an MVP.

Implemented:

essay evaluation
adaptive interview
rule-based answer analysis
API integration for frontend
basic hybrid scoring pipeline

Planned:

video interview model
multimodal analysis
admin dashboard
Redis/PostgreSQL session storage
stronger production-ready infrastructure
Running the Project
1. Install dependencies
pip install -r requirements.txt
2. Run the interview API
uvicorn api:app --reload
3. Run the essay API
uvicorn essay_api:app --reload
Project Structure
.
├── api.py
├── answer_analyzer.py
├── interview_engine.py
├── interview_llm_api.py
├── question_bank.py
├── essay_api.py
├── essey_model.py
├── hybrid_evaluator.py
└── README.md
Note

The video model is currently under development and is not yet connected to the main pipeline.
At this stage, the system focuses on essay analysis and text-based interviews.
Контакты
TG: @dirember
