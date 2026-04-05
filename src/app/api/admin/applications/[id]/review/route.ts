import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ReviewStatus = "IN_REVIEW" | "ACCEPTED" | "REJECTED";

function isValidStatus(status: string): status is ReviewStatus {
  return ["IN_REVIEW", "ACCEPTED", "REJECTED"].includes(status);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: applicationId } = await context.params;
    const body = await req.json();


    const adminScore = Number(body.adminScore);
    const status = String(body.status || "");
    const reviewComment =
      typeof body.reviewComment === "string" ? body.reviewComment : null;

    if (!applicationId) {
      return NextResponse.json(
        { error: "Application id is required" },
        { status: 400 }
      );
    }

    if (!isValidStatus(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    if (Number.isNaN(adminScore) || adminScore < 0 || adminScore > 10) {
      return NextResponse.json(
        { error: "adminScore must be between 0 and 10" },
        { status: 400 }
      );
    }

    const existing = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        status,
        adminScore,
        reviewComment,
        reviewedAt: new Date(),
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        essaySubmission: true,
        videoSubmission: true,
        certificates: {
          select: {
            certType: true,
            scoreText: true,
            verifiedStatus: true,
            fileKey: true,
          },
        },
        answers: {
          orderBy: {
            orderIndex: "asc",
          },
        },
        scores: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      application: updated,
    });
  } catch (error) {
    console.error("PATCH /api/admin/applications/[id]/review error:", error);
    return NextResponse.json(
      { error: "Failed to update review" },
      { status: 500 }
    );
  }
}