# InVision-U
InVision U: Automated Essay Evaluation System
Проект в рамках Decentrathon 5.0
Система автоматизированного скоринга эссе на базе LLM. Проект предназначен для оценки лидерского потенциала кандидатов по пяти метрикам на основе текстовых данных.

Технические характеристики
Модель: Qwen2.5-3B-Instruct (Fine-tuned via Unsloth/QLoRA)

Архитектура: 4-bit Quantization, LoRA Rank 8

Контекстное окно: 4096 токенов

Формат вывода: JSON (scores + justification)

Языковая поддержка: RU / KZ / EN

Метрики оценки (0.0 - 5.0)
Leadership — способность вести за собой.

Initiative — готовность брать на себя ответственность.

Growth — обучаемость и стремление к развитию.

Motivation — долгосрочная заинтересованность.

Values — соответствие этическим и корпоративным ценностям.

Зависимости:
Требуется Python 3.10+ и CUDA-совместимая видеокарта (рекомендуется 8GB+ VRAM).


pip install -r requirements.txt
Оценка эссе (Inference):
Для запуска модели в режиме предсказания:


python essay_model_v2.py --mode infer
Обучение (Training):
Для повторного обучения на обновленном датасете:


python essay_model_v2.py --mode train
Структура репозитория
essay_model_v2.py — основной модуль (pipeline обучения и инференса).

test_single.py — утилита для тестирования единичных запросов в CLI.

/essay-eval-lora — веса дообученных адаптеров (LoRA weights).

/datasets — набор данных (1400+ размеченных примеров).

requirements.txt — зависимости окружения.

Контакты
TG: @dirember
