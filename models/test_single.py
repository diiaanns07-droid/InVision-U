import torch
import json
import re
import textwrap
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

# Укажи здесь СВОЙ полный путь к папке
ADAPTER_PATH = r"C:\Users\LEGION\Desktop\InVision U\datasets\models\essay-eval-lora"
MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"

def load_model():
    print(f"🚀 Загружаем модель из: {ADAPTER_PATH}")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
    )
    base_model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID, quantization_config=bnb_config, device_map="auto"
    )
    model = PeftModel.from_pretrained(base_model, ADAPTER_PATH)
    tokenizer = AutoTokenizer.from_pretrained(ADAPTER_PATH)
    
    # ФИКС: Явно задаем токены, чтобы модель не "затыкалась" сразу
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    model.eval()
    return model, tokenizer

def evaluate_single_text(model, tokenizer):
    print("\n" + "="*50)
    print("Вставь текст эссе (Enter ДВАЖДЫ для завершения):")
    
    lines = []
    while True:
        line = input()
        if not line: break
        lines.append(line)
    essay = "\n".join(lines).strip()
    if not essay: return

    print("\n⏳ Модель анализирует (строгий режим 1.0-3.0)...")

    # СИСТЕМНЫЙ ПРОМПТ С ЖЕСТКИМИ РАМКАМИ
    prompt = f"<|im_start|>system\nYou are a professional HR-expert. "
    prompt += f"STRICT RULE: Use ONLY a scale from 1.0 to 3.0. Never output 4.0 or 5.0. "
    prompt += f"Output ONLY valid JSON.<|im_end|>\n"
    
    # ПРИМЕР (One-Shot) — показываем, что обоснование должно быть глубоким
    prompt += f"<|im_start|>user\nEvaluate this essay for leadership:\n[Sample Text About Resilience]<|im_end|>\n"
    prompt += f"<|im_start|>assistant\n{{\"scores\": {{\"leadership\": 2.8, \"initiative\": 3.0, \"growth\": 2.7, \"motivation\": 2.9, \"values\": 2.5}}, \"justification\": \"The candidate demonstrates exceptional resilience by re-evaluating their career path after a major setback. Their initiative in self-teaching new skills shows a high growth mindset, while their final success proves long-term motivation and leadership potential.\"}}<|im_end|>\n"
    
    # РЕАЛЬНЫЙ ЗАПРОС
    prompt += f"<|im_start|>user\nEvaluate this essay for leadership:\n{essay}<|im_end|>\n"
    prompt += f"<|im_start|>assistant\n{{\"scores\":" 

    inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

    with torch.inference_mode():
        output_ids = model.generate(
            input_ids=inputs["input_ids"],
            attention_mask=inputs["attention_mask"],
            max_new_tokens=450,
            do_sample=False,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id
        )

    generated_part = tokenizer.decode(output_ids[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True)
    raw_output = "{\"scores\":" + generated_part
    
    print("\n" + "═"*50)
    try:
        json_match = re.search(r"\{.*\}", raw_output, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            
            print("📊 ОЦЕНКИ:")
            for key, val in data.get("scores", {}).items():
                 # В отрисовке графиков (бары)
                final_score = min(5.0, float(val)) # Теперь до 5.0
                bar = "█" * int(final_score * 2.4) + "░" * (12 - int(final_score * 2.4)) 
                # (2.4 потому что 12 делений / 5 баллов = 2.4 деления на балл)
                
            print("\n💬 ОБОСНОВАНИЕ:")
            # Очищаем текст от возможных повторов баллов
            just = data.get("justification", "").split("Overall values")[0] 
            print("\n".join(textwrap.wrap(just, width=60)))
        else:
            print(f"❌ Ответ не в JSON:\n{raw_output}")
    except Exception as e:
        print(f"❌ Ошибка: {e}\n{raw_output}")
    print("═"*50 + "\n")
    
if __name__ == "__main__":
    m, t = load_model()
    while True:
        evaluate_single_text(m, t)