import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const application = await prisma.application.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        essaySubmission: true,
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    if (!application.essaySubmission) {
      return NextResponse.json(
        { error: "Essay submission not found" },
        { status: 404 }
      );
    }

    const mlResponse = await fetch(`${process.env.PYTHON_ESSAY_API_URL}/evaluate/essay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        essay_text: application.essaySubmission.essayText,
      }),
    });

    if (!mlResponse.ok) {
      const text = await mlResponse.text();
      return NextResponse.json(
        { error: "ML service failed", details: text },
        { status: 502 }
      );
    }

    const result = await mlResponse.json();

    const savedScore = await prisma.modelScore.create({
      data: {
        applicationId: application.id,
        sourceType: "essay",
        leadership: result.leadership,
        initiative: result.initiative,
        growth: result.growth,
        motivation: result.motivation,
        values: result.values,
        confidence: result.confidence,
        explanation: {
          justification: result.justification,
          raw_metrics: result.raw_metrics,
          ai_suspicion_score: result.ai_suspicion_score,
        },
      },
    });

    await prisma.essaySubmission.update({
      where: {
        applicationId: application.id,
      },
      data: {
        aiSuspicionScore: result.ai_suspicion_score,
        justification: result.justification,
      },
    });

    return NextResponse.json({
      message: "Essay evaluated successfully",
      score: savedScore,
      result,
    });
  } catch (error) {
    console.error("ESSAY_EVALUATE_ERROR", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}