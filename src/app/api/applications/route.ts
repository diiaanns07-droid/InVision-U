import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ApplicationStatus,
  CertificateType,
  ModelSourceType,
} from "@prisma/client";
import { evaluateHybrid } from "@/lib/hybridEvaluator";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { essay, questionnaire = {}, video = {}, certs = {} } = body;

      if (!essay?.text?.trim() && !essay?.file) {
        return NextResponse.json(
          { error: "Нужно либо написать эссе, либо загрузить файл" },
          { status: 400 }
        );
      }

      if (!video?.link && !video?.videoFile) {
        return NextResponse.json(
          { error: "Добавьте ссылку на видео или загрузите видеофайл" },
          { status: 400 }
        );
      }

    const application = await prisma.application.create({
      data: {
        userId,
        status: ApplicationStatus.IN_REVIEW,
        submittedAt: new Date(),

        essaySubmission: {
          create: {
            essayText: essay?.text || "",
            fileKey: essay?.file || null,
          },
        },

        videoSubmission:
          video?.link || video?.videoFile
            ? {
                create: {
                  videoUrl: video?.link || null,
                  fileKey: video?.videoFile || null,
                },
              }
            : undefined,

        answers: {
          create: (questionnaire?.aiAnswers || []).map(
            (item: { q: string; a: string }, index: number) => ({
              questionKey: `ai_q_${index + 1}`,
              questionText: item.q,
              answerText: item.a,
              orderIndex: index,
            })
          ),
        },

        certificates: {
          create: [
            certs?.ent && {
              certType: CertificateType.ENT,
              fileKey: certs.ent,
            },
            certs?.ielts && {
              certType: CertificateType.IELTS,
              fileKey: certs.ielts,
            },
            certs?.sat && {
              certType: CertificateType.SAT,
              fileKey: certs.sat,
            },
            certs?.extra && {
              certType: CertificateType.EXTRA,
              fileKey: certs.extra,
            },
          ].filter(Boolean) as any[],
        },
      },
      include: {
        essaySubmission: true,
        answers: true,
      },
    });

function parseBirthDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}




   await prisma.profile.upsert({
    where: { userId },
    update: {
      birthDate: parseBirthDate(questionnaire?.birthDate),
      city: questionnaire?.city || null,
      telegram: questionnaire?.telegram || null,
      phone: questionnaire?.phone || null,
    },
    create: {
      userId,
      fullName: questionnaire?.fullName || null,
      birthDate: parseBirthDate(questionnaire?.birthDate),
      city: questionnaire?.city || null,
      telegram: questionnaire?.telegram || null,
      phone: questionnaire?.phone || null,
    },
  });

    const essayText = essay?.text || "";
    const aiAnswers = questionnaire?.aiAnswers || [];

    const result = await evaluateHybrid({
      essayText,
      answers: aiAnswers,
    });
    let videoMetrics = {
      confidence: 0,
      communication: 0,
      presence: 0,
      authenticity: 0,
      summary: "",
      transcriptText: "",
    };

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

      const videoUrl =
        video?.link ||
        (video?.videoFile
          ? `${baseUrl}${video.videoFile}`
          : "");

      if (videoUrl) {
        const videoRes = await fetch(`${baseUrl}/api/ai/video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ videoUrl }),
        });

        const videoData = await videoRes.json();

        console.log(
          "VIDEO DATA FROM /api/ai/video:",
          JSON.stringify(videoData, null, 2)
        );

        console.log("VIDEO DATA FROM /api/ai/video:", videoData);

        if (!videoRes.ok) {
          console.error("Video evaluation failed:", videoData);
        } else {
          videoMetrics = {
          confidence: Number(videoData?.confidence ?? 0),
          communication: Number(videoData?.communication ?? 0),
          presence: Number(videoData?.presence ?? 0),
          authenticity: Number(videoData?.authenticity ?? 0),
          summary: String(videoData?.summary || ""),
          transcriptText: String(
            videoData?.transcriptText ||
            videoData?.raw?.transcript_text ||
            videoData?.raw?.transcript ||
            ""
          ),
        };
        }
      }
    } catch (videoError) {
      console.error("Video evaluation error:", videoError);
    }

    

    console.log("ESSAY TEXT LENGTH:", essayText.length);
    console.log("AI ANSWERS COUNT:", aiAnswers.length);
    console.log("AI ANSWERS:", aiAnswers);
    console.log("FINAL HYBRID RESULT:", JSON.stringify(result, null, 2));

        console.log(
      "VIDEO METRICS TO SAVE:",
      JSON.stringify(videoMetrics, null, 2)
    );

      await prisma.modelScore.create({
      data: {
        applicationId: application.id,
        sourceType: ModelSourceType.INTERVIEW,

        ...result,

        confidence: videoMetrics.confidence,
        videoCommunication: videoMetrics.communication,
        videoPresence: videoMetrics.presence,
        videoAuthenticity: videoMetrics.authenticity,

        explanation: {
          ...result.explanation,
          video: {
            summary: videoMetrics.summary,
            transcriptText: videoMetrics.transcriptText || "",
            raw_scores: {
              confidence: videoMetrics.confidence,
              communication: videoMetrics.communication,
              presence: videoMetrics.presence,
              authenticity: videoMetrics.authenticity,
            },
          },
        },
      },
    });

    return NextResponse.json({ application });
  } catch (error: any) {
      console.error("POST /api/applications error:", error);
      return NextResponse.json(
        { error: error?.message || "Failed" },
        { status: 500 }
      );
    }
}