import {
  evaluateEssay,
  type EssayEvaluationResult,
} from "@/lib/essayEvaluator";
import { evaluateInterviewWithLLM } from "@/lib/pythonAiClient";

export type QAItem = {
  q: string;
  a: string;
};

export type HybridEvaluationResult = {
  leadership: number;
  initiative: number;
  growth: number;
  motivation: number;
  values: number;
  leaderPotential: number;
  deepHumanPotential: number;
  confidence: number;
  explanation: {
    summary: string;
    essay: EssayEvaluationResult["explanation"];
    interview: {
      answerCount: number;
      contradictions: Array<{
        type: string;
        severity: "low" | "medium" | "high";
        description: string;
      }>;
      perAnswerSignals: Array<{
        question: string;
        preview: string;
        evidenceQuality: {
          specificity: number;
          ownership: number;
          impact: number;
          reflection: number;
          consistency: number;
          overall: number;
        };
        metricSignals: {
          leadership: number;
          initiative: number;
          growth: number;
          motivation: number;
          values: number;
        };
      }>;
      summary?: string;
      strengths?: string[];
      risks?: string[];
      raw_scores?: {
        leadership: number;
        initiative: number;
        growth: number;
        motivation: number;
        values: number;
      };
      metric_justifications?: {
        leadership: string;
        initiative: string;
        growth: string;
        motivation: string;
        values: string;
      };
    };
    blend: {
      essayScale: string;
      interviewScale: string;
      finalScale: string;
      essayWeight: number;
      interviewWeight: number;
    };
  };
};

export type InterviewLLMResponse = {
  leadership: number;
  initiative: number;
  growth: number;
  motivation: number;
  values: number;
  confidence: number;
  summary: string;
  strengths: string[];
  risks: string[];
  metric_justifications: {
    leadership: string;
    initiative: string;
    growth: string;
    motivation: string;
    values: string;
  };
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const round2 = (n: number) => Math.round(n * 100) / 100;

function blendMetric(essay: number, interview: number, hasInterview: boolean) {
  if (!hasInterview) return round2(essay * 2);
  return round2(essay * 1.2 + interview * 0.8);
}

export async function evaluateHybrid(input: {
  essayText: string;
  answers: QAItem[];
}): Promise<HybridEvaluationResult> {
  const essayText = input.essayText || "";
  const answers = input.answers || [];
  const hasInterview = answers.length > 0;

  const essayEval = essayText.trim()
    ? await evaluateEssay(essayText)
    : {
        leadership: 0,
        initiative: 0,
        growth: 0,
        motivation: 0,
        values: 0,
        leaderPotential: 0,
        deepHumanPotential: 0,
        confidence: 0,
        explanation: { summary: "Эссе отсутствует." },
      };

  const interviewEval: InterviewLLMResponse = hasInterview
    ? await evaluateInterviewWithLLM(answers)
    : {
        leadership: 0,
        initiative: 0,
        growth: 0,
        motivation: 0,
        values: 0,
        confidence: 0,
        summary: "No interview answers.",
        strengths: [],
        risks: [],
        metric_justifications: {
          leadership: "",
          initiative: "",
          growth: "",
          motivation: "",
          values: "",
        },
      };

  console.log("ESSAY EVAL:", JSON.stringify(essayEval, null, 2));
  console.log("INTERVIEW EVAL:", JSON.stringify(interviewEval, null, 2));

  const leadership = clamp(
    blendMetric(essayEval.leadership, interviewEval.leadership, hasInterview),
    0,
    10
  );
  const initiative = clamp(
    blendMetric(essayEval.initiative, interviewEval.initiative, hasInterview),
    0,
    10
  );
  const growth = clamp(
    blendMetric(essayEval.growth, interviewEval.growth, hasInterview),
    0,
    10
  );
  const motivation = clamp(
    blendMetric(essayEval.motivation, interviewEval.motivation, hasInterview),
    0,
    10
  );
  const values = clamp(
    blendMetric(essayEval.values, interviewEval.values, hasInterview),
    0,
    10
  );

  const leaderPotential = clamp(
    round2(leadership * 0.4 + initiative * 0.35 + motivation * 0.25),
    0,
    10
  );

  const deepHumanPotential = clamp(
    round2(growth * 0.35 + values * 0.35 + motivation * 0.3),
    0,
    10
  );

  const confidence = clamp(
    round2(
      hasInterview
        ? essayEval.confidence * 0.6 + interviewEval.confidence * 0.4
        : essayEval.confidence
    ),
    0,
    1
  );

  const summaryParts: string[] = [];

  if (leadership >= 7.5) summaryParts.push("сильное лидерство");
  if (initiative >= 7.5) summaryParts.push("высокая инициативность");
  if (growth >= 7.5) summaryParts.push("хорошая способность к росту");
  if (motivation >= 7.5) summaryParts.push("сильная мотивация");
  if (values >= 7.5) summaryParts.push("зрелые ценности");

  if (!summaryParts.length) {
    summaryParts.push("потенциал заметен, но сигналы пока неоднородны");
  }

  if (hasInterview && interviewEval.summary) {
    summaryParts.push(`interview: ${interviewEval.summary}`);
  }

  console.log("HYBRID FINAL METRICS:", {
    leadership,
    initiative,
    growth,
    motivation,
    values,
    leaderPotential,
    deepHumanPotential,
    confidence,
  });

  return {
    leadership,
    initiative,
    growth,
    motivation,
    values,
    leaderPotential,
    deepHumanPotential,
    confidence,
    explanation: {
      summary: `Hybrid evaluation: ${summaryParts.join(", ")}.`,
      essay: essayEval.explanation,
      interview: {
        answerCount: answers.length,
        contradictions: [],
        perAnswerSignals: [],
        summary: interviewEval.summary,
        strengths: interviewEval.strengths ?? [],
        risks: interviewEval.risks ?? [],
        raw_scores: {
          leadership: interviewEval.leadership,
          initiative: interviewEval.initiative,
          growth: interviewEval.growth,
          motivation: interviewEval.motivation,
          values: interviewEval.values,
        },
        metric_justifications: interviewEval.metric_justifications ?? {
          leadership: "",
          initiative: "",
          growth: "",
          motivation: "",
          values: "",
        },
      },
      blend: {
        essayScale: "0-5",
        interviewScale: hasInterview ? "0-5" : "not_used",
        finalScale: "0-10",
        essayWeight: hasInterview ? 0.6 : 1,
        interviewWeight: hasInterview ? 0.4 : 0,
      },
    },
  };
}