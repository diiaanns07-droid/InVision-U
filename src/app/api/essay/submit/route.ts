import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const userId = String(body.userId || "").trim();
    const essayText = String(body.essayText || "").trim();

    if (!userId || !essayText) {
      return NextResponse.json(
        { error: "userId and essayText are required" },
        { status: 400 }
      );
    }

    const application = await prisma.application.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const existingEssay = await prisma.essaySubmission.findUnique({
      where: {
        applicationId: application.id,
      },
    });

    let essay;

    if (existingEssay) {
      essay = await prisma.essaySubmission.update({
        where: {
          applicationId: application.id,
        },
        data: {
          essayText,
        },
      });
    } else {
      essay = await prisma.essaySubmission.create({
        data: {
          applicationId: application.id,
          essayText,
        },
      });
    }

    return NextResponse.json(
      {
        message: "Essay saved successfully",
        essay,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ESSAY_SUBMIT_ERROR", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}