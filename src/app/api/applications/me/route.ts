import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ applications: [] }, { status: 401 });
    }

    const latestApplication = await prisma.application.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        lastViewedAt: true,
      },
    });

    if (latestApplication) {
      const now = new Date();
      const lastViewedAt = latestApplication.lastViewedAt
        ? new Date(latestApplication.lastViewedAt)
        : null;

      const shouldCountView =
        !lastViewedAt || now.getTime() - lastViewedAt.getTime() > 10 * 60 * 1000;

      if (shouldCountView) {
        await prisma.application.update({
          where: { id: latestApplication.id },
          data: {
            viewCount: { increment: 1 },
            lastViewedAt: now,
          },
        });
      }
    }

    const applications = await prisma.application.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        essaySubmission: true,
        videoSubmission: true,
        certificates: true,
        answers: true,
      },
    });

    return NextResponse.json({ applications });
  } catch (error) {
    console.error("GET /api/applications/me error:", error);
    return NextResponse.json({ applications: [] }, { status: 500 });
  }
}