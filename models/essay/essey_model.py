"""
Final Essay Evaluation System (v2.0)
Fine-tuning Qwen2.5-3B-Instruct with Unsloth (QLoRA)
Scale: 0.0 - 5.0

Target hardware : NVIDIA RTX 4060 8 GB VRAM
"""

import os
import json
import re
import textwrap
import argparse
import pandas as pd
import torch

# ==============================================================================
# 1. SETTINGS
# ==============================================================================
MODEL_ID       = "Qwen/Qwen2.5-3B-Instruct"

# Умный путь: берем папку, где лежит скрипт, и выходим на уровень выше
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "essay-eval-lora") # Сохранит в InVision U/essay-eval-lora

# Путь к датасету тоже лучше сделать через BASE_DIR
DATA_PATH = os.path.join(BASE_DIR, "datasets", "combined_dataset.csv")

MAX_SEQ_LENGTH = 4096
LORA_RANK      = 8
BATCH_SIZE     = 1
GRAD_ACCUM     = 8
MAX_STEPS      = 300   
LEARNING_RATE  = 2e-4
WARMUP_STEPS   = 10
SCORE_COLS     = ["leadership", "initiative", "growth", "motivation", "values"]

USE_BF16 = torch.cuda.is_bf16_supported()
USE_FP16 = not USE_BF16

# ==============================================================================
# 2. PROMPT HELPERS
# ==============================================================================
SYSTEM_PROMPT = textwrap.dedent("""\
    You are an expert evaluator of leadership potential.
    Given a candidate's essay, output ONLY a valid JSON object with two keys:
      "scores"        - float values 0.0-5.0 for each dimension
      "justification" - 2-4 sentence explanation of the candidate's strengths
    Do NOT output anything outside the JSON object.
""")

def build_user_message(essay_text: str) -> str:
    return (
        "Evaluate the following candidate's essay for leadership potential. "
        "Provide scores (0.0 to 5.0) for leadership, initiative, growth, "
        "motivation, and values. Respond STRICTLY in JSON format.\n\n"
        f"Essay:\n{essay_text.strip()}"
    )

def build_target_json(row: pd.Series) -> str:
    scores = {col: round(float(row[col]), 2) for col in SCORE_COLS}
    avg = sum(scores.values()) / len(scores)
    # Пороги для 5-балльной шкалы
    level = "strong" if avg >= 4.0 else "moderate" if avg >= 2.5 else "developing"

    justification = (
        f"The candidate demonstrates {level} leadership potential. "
        f"Notable strengths include initiative ({scores['initiative']:.1f}) "
        f"and motivation ({scores['motivation']:.1f}). "
        f"Growth mindset scored {scores['growth']:.1f}, indicating "
        f"{'openness to learning' if scores['growth'] >= 3.0 else 'room for development'}. "
        f"Overall values alignment is {scores['values']:.1f}."
    )
    return json.dumps({"scores": scores, "justification": justification}, ensure_ascii=False)

# ==============================================================================
# 3. TRAINING (UNSLOTH)
# ==============================================================================
def train():
    from unsloth import FastLanguageModel
    from datasets import Dataset
    from transformers import TrainingArguments
    from trl import SFTTrainer

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_ID,
        max_seq_length=MAX_SEQ_LENGTH,
        dtype=None,
        load_in_4bit=True,
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_RANK,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=LORA_RANK * 2,
        lora_dropout=0.05,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
    )

    # Загрузка и умная обрезка данных
    df = pd.read_csv(DATA_PATH)
    df = df.dropna(subset=["essay"] + SCORE_COLS).copy()
    
    before = len(df)
    limit = MAX_SEQ_LENGTH - 200 # запас на промпт

    def truncate_text(text):
        tokens = tokenizer.encode(str(text), add_special_tokens=False)
        return tokenizer.decode(tokens[:limit]) if len(tokens) > limit else text

    df["essay"] = df["essay"].apply(truncate_text)
    print(f"[Train] Загружено {len(df)} эссе. Ни одно не удалено, длинные обрезаны.")

    def to_chatml(row):
        messages = [
            {"role": "system",    "content": SYSTEM_PROMPT},
            {"role": "user",       "content": build_user_message(row["essay"])},
            {"role": "assistant", "content": build_target_json(row)},
        ]
        return {"text": tokenizer.apply_chat_template(messages, tokenize=False)}

    dataset = Dataset.from_list([to_chatml(r) for _, r in df.iterrows()])

    args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        warmup_steps=WARMUP_STEPS,
        max_steps=MAX_STEPS,
        learning_rate=LEARNING_RATE,
        fp16=USE_FP16,
        bf16=USE_BF16,
        logging_steps=10,
        save_steps=50,
        optim="paged_adamw_8bit",
        seed=42,
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model, tokenizer=tokenizer, train_dataset=dataset,
        dataset_text_field="text", max_seq_length=MAX_SEQ_LENGTH, args=args,
    )

    trainer.train()
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"[Train] Готово! Модель сохранена в {OUTPUT_DIR}")

# ==============================================================================
# 4. INFERENCE (PURE TRANSFORMERS)
# ==============================================================================
def load_for_inference():
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from peft import PeftModel

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.bfloat16 if USE_BF16 else torch.float16,
    )

    print(f"🚀 Загружаем модель для теста из {OUTPUT_DIR}...")
    base_model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID, quantization_config=bnb_config, device_map="auto"
    )
    model = PeftModel.from_pretrained(base_model, OUTPUT_DIR)
    tokenizer = AutoTokenizer.from_pretrained(OUTPUT_DIR)
    model.eval()
    return model, tokenizer

def _parse_json(raw: str) -> dict:
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match: return {"error": "JSON не найден"}
    try:
        res = json.loads(match.group())
        if "scores" in res:
            # Масштабируем до 5.0
            res["scores"] = {k: round(max(0.0, min(5.0, float(v))), 2) for k, v in res["scores"].items()}
        return res
    except: return {"error": "Ошибка парсинга"}

def run_demo():
    model, tokenizer = load_for_inference()
    essay = "I have always sought leadership roles... (тестовое эссе)"
    
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_user_message(essay)}
    ]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

    with torch.inference_mode():
        outputs = model.generate(**inputs, max_new_tokens=400, do_sample=False)
    
    raw = tokenizer.decode(outputs[0][inputs.input_ids.shape[-1]:], skip_special_tokens=True)
    result = _parse_json(raw)
    
    print("\n🎯 РЕЗУЛЬТАТ:")
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["train", "infer"], default="infer")
    args = parser.parse_args()

    if args.mode == "train": train()
    else: run_demo()