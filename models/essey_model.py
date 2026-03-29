"""
Essay Evaluation System
Fine-tuning Qwen2.5-3B-Instruct with Unsloth (QLoRA)

Target hardware : NVIDIA RTX 4060 8 GB VRAM
Strategy        : 4-bit QLoRA + paged AdamW 8-bit + batch=1 + grad-accum

Usage:
    python essay_model.py --mode train   # fine-tune on your CSV
    python essay_model.py --mode infer   # run demo on 3 example essays
    python essay_model.py --mode both    # train then infer

Dependencies:
    pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
    pip install --no-deps trl peft accelerate bitsandbytes
    pip install pandas datasets transformers torch
"""

import os
import json
import re
import textwrap
import argparse

import pandas as pd
import torch


# ==============================================================================
# SETTINGS  -- edit these to match your setup
# ==============================================================================

MODEL_ID       = "Qwen/Qwen2.5-3B-Instruct"
OUTPUT_DIR     = "./essay-eval-lora"
DATA_PATH      = r"C:\Users\LEGION\Desktop\InVision U\datasets\combined_dataset.csv"

MAX_SEQ_LENGTH = 4096
LORA_RANK      = 8
BATCH_SIZE     = 1
GRAD_ACCUM     = 8
# 1. В самом начале файла (SETTINGS)
MAX_STEPS = 250  # Немного увеличим для точности
SCORE_COLS = ["leadership", "initiative", "growth", "motivation", "values"]

# 2. В блоке PROMPT HELPERS
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

# 3. В функции build_target_json (поднимаем пороги уровней)
def build_target_json(row: pd.Series) -> str:
    scores = {col: round(float(row[col]), 2) for col in SCORE_COLS}
    avg = sum(scores.values()) / len(scores)
    level = "strong" if avg >= 4.0 else "moderate" if avg >= 2.5 else "developing"

    justification = (
        f"The candidate demonstrates {level} leadership potential. "
        f"Notable strengths include initiative ({scores['initiative']:.1f}) "
        f"and motivation ({scores['motivation']:.1f}). "
        f"Growth mindset scored {scores['growth']:.1f}, indicating "
        f"{'openness to learning' if scores['growth'] >= 2.0 else 'room for development'}. "
        f"Overall values alignment is {scores['values']:.1f}."
    )

    return json.dumps({"scores": scores, "justification": justification}, ensure_ascii=False)


# ==============================================================================
# TRAINING
# Unsloth is imported INSIDE this function so its monkey-patches to
# generate() / forward() are never applied when running inference-only mode.
# ==============================================================================

def train():
    from unsloth import FastLanguageModel          # local import -- intentional
    from datasets import Dataset
    from transformers import TrainingArguments
    from trl import SFTTrainer

    # Load base model with 4-bit quantisation
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_ID,
        max_seq_length=MAX_SEQ_LENGTH,
        dtype=None,
        load_in_4bit=True,
    )

    # Attach LoRA adapters
    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_RANK,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        lora_alpha=LORA_RANK * 2,
        lora_dropout=0.05,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
        use_rslora=False,
        loftq_config=None,
    )
    print(f"[Train] Model loaded | bf16={USE_BF16} | 4-bit=True | LoRA r={LORA_RANK}")

    # Build dataset
    df = pd.read_csv(DATA_PATH)

    required = ["essay"] + SCORE_COLS
    missing  = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing columns: {missing}")

    df = df.dropna(subset=required).copy()
    df["essay"] = df["essay"].astype(str).str.strip()
    df = df[df["essay"] != ""]

    def token_len(text):
        return len(tokenizer(text, add_special_tokens=False)["input_ids"])

    # === НОВАЯ УМНАЯ ОБРЕЗКА (БЕЗ УДАЛЕНИЯ СТРОК) ===
    before = len(df)
    limit = MAX_SEQ_LENGTH - 150  # Оставляем место под промпт и ответ

    def truncate_text(text):
        tokens = tokenizer.encode(text, add_special_tokens=False)
        if len(tokens) > limit:
            # Если текст слишком длинный, просто отрезаем лишнее с конца
            tokens = tokens[:limit]
            return tokenizer.decode(tokens)
        return text

    df["essay"] = df["essay"].apply(truncate_text)
    print(f"[Train] Загружены все {before} эссе! Ни одна строка не удалена.")
    # ================================================

    if len(df) == 0:
        raise ValueError(
            "No rows left after length filter. "
            "Increase MAX_SEQ_LENGTH or shorten your essays."
        )

    def to_chatml(row):
        messages = [
            {"role": "system",    "content": SYSTEM_PROMPT},
            {"role": "user",      "content": build_user_message(row["essay"])},
            {"role": "assistant", "content": build_target_json(row)},
        ]
        return {"text": tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=False
        )}

    dataset = Dataset.from_list([to_chatml(r) for _, r in df.iterrows()])
    print(f"[Train] {len(dataset)} examples | effective batch = {BATCH_SIZE * GRAD_ACCUM}")

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
        weight_decay=0.01,
        lr_scheduler_type="linear",
        seed=42,
        report_to="none",
        dataloader_pin_memory=False,
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        dataset_num_proc=1,
        packing=False,
        args=args,
    )

    if torch.cuda.is_available():
        print(f"[VRAM] Reserved : {torch.cuda.memory_reserved()  / 1e9:.2f} GB")
        print(f"[VRAM] Allocated: {torch.cuda.memory_allocated() / 1e9:.2f} GB")

    trainer.train()
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"[Train] Done. Adapters saved to '{OUTPUT_DIR}/'")


# ==============================================================================
# INFERENCE
# Uses plain transformers + peft -- NO Unsloth import.
#
# Why: Unsloth patches model.generate() and model.forward() at C-level on
# import. Its fast_forward_inference kernel initialises rotary_seq_len=1,
# which causes a shape crash on every prefill pass:
#     cos [1, 16, 1, 128]  vs  Q [1, 16, N, 128]
# Keeping Unsloth out of this process entirely sidesteps the bug completely.
# ==============================================================================

def load_for_inference(adapter_path: str = OUTPUT_DIR):
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from peft import PeftModel

    compute_dtype = torch.bfloat16 if USE_BF16 else torch.float16

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=compute_dtype,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
    )

    adapter_cfg_file = os.path.join(adapter_path, "adapter_config.json")

    if os.path.isfile(adapter_cfg_file):
        # Fine-tuned adapter found -- load base model then merge adapter in
        with open(adapter_cfg_file) as f:
            base_name = json.load(f).get("base_model_name_or_path", MODEL_ID)

        print(f"[Infer] Adapter found at '{adapter_path}'")
        print(f"[Infer] Base model: {base_name}")

        tokenizer  = AutoTokenizer.from_pretrained(adapter_path)
        base_model = AutoModelForCausalLM.from_pretrained(
            base_name,
            quantization_config=bnb_config,
            device_map="auto",
            torch_dtype=compute_dtype,
        )
        model = PeftModel.from_pretrained(base_model, adapter_path)
        model = model.merge_and_unload()   # fold adapter into weights, drop PEFT wrapper

    else:
        # No adapter yet -- use raw base model (works before first training run)
        print(f"[Infer] No adapter at '{adapter_path}' -- loading base model '{MODEL_ID}'")
        print("[Infer] Tip: run --mode train first to fine-tune.")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        model     = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            quantization_config=bnb_config,
            device_map="auto",
            torch_dtype=compute_dtype,
        )

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model.eval()
    print("[Infer] Model ready (standard transformers backend -- no Unsloth patches).")
    return model, tokenizer


def evaluate_essay(essay_text: str, model, tokenizer, max_new_tokens: int = 300) -> dict:
    """Score one essay and return a dict with 'scores' and 'justification'."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": build_user_message(essay_text)},
    ]

    prompt = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )

    inputs = tokenizer(
        prompt,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_SEQ_LENGTH,
    )

    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.inference_mode():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,       # greedy -- deterministic and faster
            use_cache=True,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )

    n_input = inputs["input_ids"].shape[-1]
    raw     = tokenizer.decode(output_ids[0][n_input:], skip_special_tokens=True).strip()
    return _parse_json(raw)


def _parse_json(raw: str) -> dict:
    """Extract and validate the JSON block from the model's raw output."""
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return {"error": "No JSON found in output", "raw": raw}
    try:
        result = json.loads(match.group())
        if "scores" in result:
            result["scores"] = {
                k: round(max(1.0, min(3.0, float(v))), 2)
                for k, v in result["scores"].items()
            }
        return result
    except json.JSONDecodeError as e:
        return {"error": str(e), "raw": raw}


def print_result(result: dict, label: str = ""):
    """Pretty-print scores and justification to stdout."""
    sep = "-" * 60
    if label:
        print(f"\n{'=' * 60}\n  {label}\n{'=' * 60}")

    if "error" in result:
        print(f"  ERROR : {result['error']}")
        print(f"  Raw   : {result.get('raw', '')[:300]}")
        return

    scores = result.get("scores", {})
    print("\n  SCORES:")
    for dim, score in scores.items():
        bar = "#" * int(score * 4) + "." * (12 - int(score * 4))
        print(f"    {dim:<12}  {score:.2f}  [{bar}]")

    if scores:
        avg = sum(scores.values()) / len(scores)
        print(f"\n    {'AVERAGE':<12}  {avg:.2f}")

    print("\n  JUSTIFICATION:")
    for line in textwrap.wrap(result.get("justification", "N/A"), width=56):
        print(f"    {line}")
    print(sep)


# ==============================================================================
# DEMO ESSAYS
# ==============================================================================

DEMO_ESSAYS = {
    "English":( "I have always been known as a cool , intelligent girl who deals everything without fussing around , but I cried for this heart-breaking incident as my hope for this opportunity was even higher than any wishes that I ever had in my 16 years of living. Life's a Ferris wheel, I heard the words echoing in my head for countless of time. 'Look back at what you had gone through', the Auspicious Girl in me spoke again. Early that year, I was just selected to a national gifted program in my country. It was a dilemma whether I should go or not as I myself came from an elite school but I decided to go for it anyway. Then, it was a selection for the college committee. I was suggested for one of the positions but I had fewer votes. You're just here for a week, nobody knows you well yet, I said to myself. I had to admit that I was a bit disappointed as I was a girl who always gets what I desire. Like the public speaking competition. My first idea of joining the competition was just to give it a try after being a champion in the storytelling competition at the national level in the previous year. But after winning the zone level and made it to the national, I said to myself, you know what, let's finish this with triumph. And so I did. A few weeks after the college committee selection, came the students board selection. My name was suggested, I was interviewed and just as I hoped for, I became the Vice President of the Student Council. So I guess it will always be like this, this life. Sometimes you're at the upper level of the wheel, and there are times when you aren't. Sometimes I just wonder at what level of the wheel am I at, but the truth is, we don't need to know that, just deal with whatever that come into our life. Failure's good because it teaches and corrects us, and triumph: the one thing that we always crave for may jeopardise us if we become too carried away.")
}


def run_demo():
    print("\n" + "=" * 60)
    print("  ESSAY EVALUATION DEMO")
    print("=" * 60)

    model, tokenizer = load_for_inference(OUTPUT_DIR)

    for lang, essay in DEMO_ESSAYS.items():
        result = evaluate_essay(essay, model, tokenizer)
        print_result(result, label=f"Language: {lang}")


# ==============================================================================
# MAIN
# ==============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Essay Evaluation -- QLoRA + Inference")
    parser.add_argument(
        "--mode",
        choices=["train", "infer", "both"],
        default="infer",
        help="train=fine-tune, infer=run demo, both=train then demo",
    )
    args = parser.parse_args()

    if args.mode in ("train", "both"):
        train()

    if args.mode in ("infer", "both"):
        run_demo()