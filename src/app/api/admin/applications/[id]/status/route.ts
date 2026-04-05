import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const applications = await prisma.application.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        essaySubmission: true,
        videoSubmission: true,
        certificates: true,
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

    console.log("APPLICATIONS FROM DB:", applications);

    return NextResponse.json({ applications });
  } catch (error) {
    console.error("GET /api/admin/applications error:", error);
    return NextResponse.json(
      { error: "Failed to load applications" },
      { status: 500 }
    );
  }
}