import { NextRequest, NextResponse } from "next/server";

function buildVideoSummary(input: {
  confidence: number;
  communication: number;
  presence: number;
  authenticity: number;
  clarity?: number;
  riskLevel?: string;
}) {
  const { confidence, communication, presence, authenticity, clarity, riskLevel } =
    input;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (communication >= 3.8) strengths.push("коммуникация сильная");
  else if (communication < 3.0) weaknesses.push("коммуникация слабая");

  if (confidence >= 3.8) strengths.push("заметная уверенность");
  else if (confidence < 3.0) weaknesses.push("уверенность ниже желаемой");

  if (presence >= 3.5) strengths.push("хорошее присутствие в кадре");
  else if (presence < 3.0) weaknesses.push("присутствие в кадре слабое");

  if (authenticity >= 3.8) strengths.push("хорошие сигналы аутентичности");
  else if (authenticity < 3.2) weaknesses.push("есть вопросы к аутентичности");

  if (clarity != null) {
    if (clarity >= 3.8) strengths.push("речь достаточно ясная");
    else if (clarity < 3.0) weaknesses.push("ясность речи ограничена");
  }

  const riskText =
    riskLevel === "HIGH"
      ? "Риск высокий."
      : riskLevel === "MEDIUM"
      ? "Риск средний."
      : "Риск низкий.";

  const strengthsText = strengths.length
    ? `Сильные стороны: ${strengths.join(", ")}.`
    : "";

  const weaknessesText = weaknesses.length
    ? `Зоны риска: ${weaknesses.join(", ")}.`
    : "";

  return `${riskText} ${strengthsText} ${weaknessesText}`.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoUrl } = body;

    if (!videoUrl) {
      return NextResponse.json({ error: "No video URL" }, { status: 400 });
    }

    const pythonVideoUrl =
      process.env.PYTHON_VIDEO_API_URL || "http://127.0.0.1:8004";

    const fd = new FormData();
    fd.append("candidate_id", "local-candidate");
    fd.append("video_url", videoUrl);
    fd.append("whisper_model", "medium");

    const res = await fetch(`${pythonVideoUrl}/evaluate-url`, {
      method: "POST",
      body: fd,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Python video API error:", data);
      return NextResponse.json(
        { error: data?.detail || data?.error || "Video AI error" },
        { status: 500 }
      );
    }

    const confidence = Number(data?.confidence_score ?? 0);
    const communication = Number(data?.communication_score ?? 0);
    const presence = Number(data?.presence_score ?? 0);
    const authenticity = Number(data?.authenticity_score ?? 0);
    const clarity = Number(data?.transcript_quality_score ?? data?.clarity_score ?? 0);
    const riskLevel = String(data?.confidence_level || data?.risk_level || "");

    const smartSummary = buildVideoSummary({
      confidence,
      communication,
      presence,
      authenticity,
      clarity,
      riskLevel,
    });

    return NextResponse.json({
      confidence,
      communication,
      presence,
      authenticity,
      summary: smartSummary,
      transcriptText: String(data?.transcript_text || data?.transcript || ""),
      raw: data,
    });
  } catch (error: any) {
    console.error("video ai error:", error);
    return NextResponse.json(
      { error: error?.message || "Video AI failed" },
      { status: 500 }
    );
  }
}