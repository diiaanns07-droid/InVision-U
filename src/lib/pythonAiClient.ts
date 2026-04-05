const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://127.0.0.1:8003";

export type PythonQuestion = {
  id: string;
  text: string;
  metric: string;
  type: string;
  depth: number;
};

export type StartInterviewResponse = {
  status: "ongoing" | "complete";
  session_id: string;
  turn?: number | null;
  phase?: string | null;
  question?: PythonQuestion | null;
  strategy?: string | null;
  progress?: Record<string, unknown> | null;
  message?: string | null;
};

export type SubmitAnswerResponse = {
  turn: number;
  metric: string;
  score: number;
  confidence: number;
  flags: string[];
  explanation: string;
  metric_running_score: number;
  next_step: {
    status: "ongoing" | "complete";
    session_id: string;
    turn?: number | null;
    phase?: string | null;
    question?: PythonQuestion | null;
    strategy?: string | null;
    progress?: Record<string, unknown> | null;
    message?: string | null;
  };
};

function buildEssaySummary(text: string): string {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= 1900) return cleaned;
  return cleaned.slice(0, 1900) + "...";
}

export async function startPythonInterview(payload: {
  candidate_id: string;
  essay_text: string;
  essay_weakness_metrics?: string[];
}): Promise<StartInterviewResponse> {
  const res = await fetch(`${PYTHON_AI_URL}/interview/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      candidate_id: payload.candidate_id,
      essay_summary: buildEssaySummary(payload.essay_text),
      essay_weakness_metrics: payload.essay_weakness_metrics ?? [],
    }),
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Python API error:", data);
    throw new Error(
      JSON.stringify(data?.detail || data?.error || data, null, 2)
    );
  }

  return data;
}

export async function submitPythonInterviewAnswer(payload: {
  session_id: string;
  answer: string;
}): Promise<SubmitAnswerResponse> {
  const res = await fetch(
    `${PYTHON_AI_URL}/interview/${payload.session_id}/answer`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        answer: payload.answer,
      }),
      cache: "no-store",
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("Python API error:", data);
    throw new Error(
      JSON.stringify(data?.detail || data?.error || data, null, 2)
    );
  }

  return data;
}

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

export async function evaluateInterviewWithLLM(answers: { q: string; a: string }[]): Promise<InterviewLLMResponse> {
  const res = await fetch("http://127.0.0.1:8002/evaluate-interview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ answers }),
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.detail || data?.error || "Failed to evaluate interview");
  }

  return data;
}