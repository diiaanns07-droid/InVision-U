import os
import re
import json
import math
import argparse
from typing import Dict, Any, List, Tuple

import numpy as np
import pandas as pd
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

SCORE_COLS = ["leadership", "initiative", "growth", "motivation", "values"]
MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"
DEFAULT_ADAPTER_PATH = r"C:\Users\LEGION\Desktop\InVision U\essay-eval-lora"
DEFAULT_DATASET_PATH = r"C:\Users\LEGION\Desktop\InVision U\datasets\combined_dataset.csv"

SYSTEM_PROMPT = """You are an expert evaluator of leadership potential.
Given a candidate's essay, output ONLY a valid JSON object with two keys:
  \"scores\"        - float values 0.0-5.0 for each dimension
  \"justification\" - 2-4 sentence explanation of the candidate's strengths
Do NOT output anything outside the JSON object.
"""


def build_user_message(essay_text: str) -> str:
    return (
        "Evaluate the following candidate's essay for leadership potential. "
        "Provide scores (0.0 to 5.0) for leadership, initiative, growth, "
        "motivation, and values. Respond STRICTLY in JSON format.\n\n"
        f"Essay:\n{str(essay_text).strip()}"
    )


def parse_json_scores(raw: str) -> Dict[str, float]:
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return {k: 0.0 for k in SCORE_COLS}

    try:
        data = json.loads(match.group(0))
    except Exception:
        return {k: 0.0 for k in SCORE_COLS}

    scores = data.get("scores", {}) if isinstance(data, dict) else {}
    parsed = {}
    for col in SCORE_COLS:
        try:
            parsed[col] = round(max(0.0, min(5.0, float(scores.get(col, 0.0)))), 2)
        except Exception:
            parsed[col] = 0.0
    return parsed


def pearson_corr(x: np.ndarray, y: np.ndarray) -> float:
    if len(x) < 2:
        return float("nan")
    if np.std(x) == 0 or np.std(y) == 0:
        return float("nan")
    return float(np.corrcoef(x, y)[0, 1])


def rankdata(a: np.ndarray) -> np.ndarray:
    order = np.argsort(a, kind="mergesort")
    ranks = np.empty(len(a), dtype=float)
    i = 0
    while i < len(a):
        j = i
        while j + 1 < len(a) and a[order[j + 1]] == a[order[i]]:
            j += 1
        avg_rank = (i + j) / 2.0 + 1.0
        ranks[order[i:j + 1]] = avg_rank
        i = j + 1
    return ranks


def spearman_corr(x: np.ndarray, y: np.ndarray) -> float:
    if len(x) < 2:
        return float("nan")
    rx = rankdata(x)
    ry = rankdata(y)
    return pearson_corr(rx, ry)


class LocalEssayEvaluator:
    def __init__(self, adapter_path: str, max_new_tokens: int = 300):
        self.adapter_path = adapter_path
        self.max_new_tokens = max_new_tokens

        use_bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
        compute_dtype = torch.bfloat16 if use_bf16 else torch.float16

        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=compute_dtype,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
        )

        print(f"[Load] Base model: {MODEL_ID}")
        print(f"[Load] Adapter    : {adapter_path}")

        self.tokenizer = AutoTokenizer.from_pretrained(adapter_path)
        base_model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            quantization_config=bnb_config,
            device_map="auto",
        )
        self.model = PeftModel.from_pretrained(base_model, adapter_path)
        self.model.eval()

    @torch.inference_mode()
    def predict_scores(self, essay: str) -> Dict[str, float]:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_message(essay)},
        ]
        prompt = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)
        outputs = self.model.generate(
            **inputs,
            max_new_tokens=self.max_new_tokens,
            do_sample=False,
            pad_token_id=self.tokenizer.pad_token_id,
            eos_token_id=self.tokenizer.eos_token_id,
        )
        raw = self.tokenizer.decode(outputs[0][inputs.input_ids.shape[-1]:], skip_special_tokens=True)
        return parse_json_scores(raw)


def validate_dataframe(
    df: pd.DataFrame,
    evaluator: LocalEssayEvaluator,
    essay_col: str = "essay",
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, float]]:
    rows: List[Dict[str, Any]] = []

    for idx, row in df.iterrows():
        essay = str(row[essay_col])
        pred = evaluator.predict_scores(essay)

        item = {"row_id": int(idx)}
        for col in SCORE_COLS:
            gold = float(row[col])
            pred_val = float(pred[col])
            item[f"gold_{col}"] = gold
            item[f"pred_{col}"] = pred_val
            item[f"abs_err_{col}"] = round(abs(gold - pred_val), 4)
            item[f"sq_err_{col}"] = round((gold - pred_val) ** 2, 4)
        rows.append(item)
        print(f"[Done] {len(rows)}/{len(df)}")

    pred_df = pd.DataFrame(rows)

    metrics_rows: List[Dict[str, Any]] = []
    overall_abs_errors = []
    overall_sq_errors = []
    overall_gold = []
    overall_pred = []

    for col in SCORE_COLS:
        gold = pred_df[f"gold_{col}"].to_numpy(dtype=float)
        pred = pred_df[f"pred_{col}"].to_numpy(dtype=float)
        abs_err = np.abs(gold - pred)
        sq_err = (gold - pred) ** 2

        mae = float(np.mean(abs_err))
        rmse = float(np.sqrt(np.mean(sq_err)))
        pear = pearson_corr(gold, pred)
        spear = spearman_corr(gold, pred)

        overall_abs_errors.extend(abs_err.tolist())
        overall_sq_errors.extend(sq_err.tolist())
        overall_gold.extend(gold.tolist())
        overall_pred.extend(pred.tolist())

        metrics_rows.append({
            "metric": col,
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "pearson": round(pear, 4) if not math.isnan(pear) else np.nan,
            "spearman": round(spear, 4) if not math.isnan(spear) else np.nan,
        })

    overall = {
        "mae": round(float(np.mean(overall_abs_errors)), 4),
        "rmse": round(float(np.sqrt(np.mean(overall_sq_errors))), 4),
        "pearson": round(pearson_corr(np.array(overall_gold), np.array(overall_pred)), 4),
        "spearman": round(spearman_corr(np.array(overall_gold), np.array(overall_pred)), 4),
    }

    metrics_rows.append({"metric": "OVERALL", **overall})
    metrics_df = pd.DataFrame(metrics_rows)
    return pred_df, metrics_df, overall


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate essay LoRA model on labeled dataset")
    parser.add_argument("--dataset", default=DEFAULT_DATASET_PATH, help="Path to combined_dataset.csv")
    parser.add_argument("--adapter", default=DEFAULT_ADAPTER_PATH, help="Path to essay-eval-lora adapter")
    parser.add_argument("--sample", type=int, default=50, help="How many rows to evaluate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for sampling")
    parser.add_argument("--essay-col", default="essay", help="Essay text column")
    parser.add_argument("--outdir", default="validation_results", help="Folder to save outputs")
    parser.add_argument("--max-new-tokens", type=int, default=300)
    parser.add_argument("--no-shuffle", action="store_true", help="Take first N rows instead of random sample")
    args = parser.parse_args()

    if not os.path.exists(args.dataset):
        raise FileNotFoundError(f"Dataset not found: {args.dataset}")
    if not os.path.exists(args.adapter):
        raise FileNotFoundError(f"Adapter folder not found: {args.adapter}")

    os.makedirs(args.outdir, exist_ok=True)

    df = pd.read_csv(args.dataset)
    required_cols = [args.essay_col] + SCORE_COLS
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns in dataset: {missing}")

    df = df.dropna(subset=required_cols).reset_index(drop=True)
    if args.sample and args.sample < len(df):
        if args.no_shuffle:
            df = df.iloc[:args.sample].copy()
        else:
            df = df.sample(args.sample, random_state=args.seed).reset_index(drop=True)

    print(f"[Data] Rows for validation: {len(df)}")
    evaluator = LocalEssayEvaluator(args.adapter, max_new_tokens=args.max_new_tokens)
    predictions_df, metrics_df, overall = validate_dataframe(df, evaluator, essay_col=args.essay_col)

    pred_path = os.path.join(args.outdir, "validation_predictions.csv")
    metrics_path = os.path.join(args.outdir, "validation_metrics.csv")
    summary_path = os.path.join(args.outdir, "validation_summary.txt")

    predictions_df.to_csv(pred_path, index=False, encoding="utf-8-sig")
    metrics_df.to_csv(metrics_path, index=False, encoding="utf-8-sig")

    with open(summary_path, "w", encoding="utf-8") as f:
        f.write("Validation summary\n")
        f.write("==================\n")
        f.write(f"Rows evaluated: {len(df)}\n")
        f.write(f"Dataset: {args.dataset}\n")
        f.write(f"Adapter: {args.adapter}\n\n")
        for _, row in metrics_df.iterrows():
            f.write(
                f"{row['metric']}: MAE={row['mae']}, RMSE={row['rmse']}, "
                f"Pearson={row['pearson']}, Spearman={row['spearman']}\n"
            )

    print("\n=== FINAL METRICS ===")
    print(metrics_df.to_string(index=False))
    print("\nSaved:")
    print(f"- {pred_path}")
    print(f"- {metrics_path}")
    print(f"- {summary_path}")

    overall_json_path = os.path.join(args.outdir, "validation_overall.json")
    with open(overall_json_path, "w", encoding="utf-8") as f:
        json.dump(overall, f, ensure_ascii=False, indent=2)
    print(f"- {overall_json_path}")


if __name__ == "__main__":
    main()
