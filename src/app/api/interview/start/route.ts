import { NextRequest, NextResponse } from "next/server";
import { startPythonInterview } from "@/lib/pythonAiClient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const data = await startPythonInterview({
      candidate_id: body.candidate_id,
      essay_text: body.essay,
      essay_weakness_metrics: [],
    });

    return NextResponse.json({
      session_id: data.session_id,
      status: data.status,
      phase: data.phase ?? null,
      strategy: data.strategy ?? null,
      next_question: data.question ?? null,
      progress: data.progress ?? null,
      message: data.message ?? null,
    });
  } catch (error: any) {
    console.error("POST /api/interview/start error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to start interview" },
      { status: 500 }
    );
  }
}