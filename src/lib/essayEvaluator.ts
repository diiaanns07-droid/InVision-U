export type EssayEvaluationResult = {
  leadership: number;
  initiative: number;
  growth: number;
  motivation: number;
  values: number;
  leaderPotential: number;
  deepHumanPotential: number;
  confidence: number;
  explanation: any;
};

function fallbackEssayEvaluation(essayText: string): EssayEvaluationResult {
  const lengthScore =
    essayText.length > 1200 ? 4.5 :
    essayText.length > 800 ? 4.0 :
    essayText.length > 500 ? 3.5 :
    2.8;

  return {
    leadership: lengthScore,
    initiative: Math.max(2.5, lengthScore - 0.2),
    growth: Math.max(2.5, lengthScore),
    motivation: Math.max(2.5, lengthScore - 0.1),
    values: Math.max(2.5, lengthScore - 0.3),
    leaderPotential: Math.max(2.5, lengthScore - 0.1),
    deepHumanPotential: Math.max(2.5, lengthScore),
    confidence: 0.5,
    explanation: {
      summary: "Python API недоступен, использован fallback.",
    },
  };
}

export async function evaluateEssay(
  essayText: string
): Promise<EssayEvaluationResult> {
  try {
    const res = await fetch("http://127.0.0.1:8001/evaluate-essay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        essay_text: essayText,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Python essay API failed");
    }

    const data = await res.json();
    console.log("ESSAY API RAW RESPONSE:", JSON.stringify(data, null, 2));

    return {
      leadership: Number(data.leadership ?? 0),
      initiative: Number(data.initiative ?? 0),
      growth: Number(data.growth ?? 0),
      motivation: Number(data.motivation ?? 0),
      values: Number(data.values ?? 0),
      leaderPotential: Number(data.leaderPotential ?? 0),
      deepHumanPotential: Number(data.deepHumanPotential ?? 0),
      confidence: Number(data.confidence ?? 0),
      explanation: data.explanation ?? {},
    };
  } catch (error) {
    console.error("Essay API error, fallback used:", error);
    console.error("Essay API error:", error);
    return fallbackEssayEvaluation(essayText);
  }
}