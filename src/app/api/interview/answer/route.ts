import { NextRequest, NextResponse } from "next/server";
import { submitPythonInterviewAnswer } from "@/lib/pythonAiClient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const data = await submitPythonInterviewAnswer({
      session_id: body.session_id,
      answer: body.answer,
    });

    return NextResponse.json({
      status: data.next_step.status,
      next_question: data.next_step.question ?? null,
      phase: data.next_step.phase ?? null,
      strategy: data.next_step.strategy ?? null,
      progress: data.next_step.progress ?? null,
      message: data.next_step.message ?? null,
      feedback: {
        turn: data.turn,
        metric: data.metric,
        score: data.score,
        confidence: data.confidence,
        flags: data.flags,
        explanation: data.explanation,
        metric_running_score: data.metric_running_score,
      },
    });
  } catch (error: any) {
    console.error("POST /api/interview/answer error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to submit answer" },
      { status: 500 }
    );
  }
}