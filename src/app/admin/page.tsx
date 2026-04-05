"use client";

import { useEffect, useMemo, useState } from "react";

type CandidateStatus = "pending" | "rejected" | "accepted";
type IndicatorType = "green" | "yellow";

type MetricKey =
  | "leadership"
  | "initiative"
  | "growth"
  | "motivation"
  | "values";

type VideoMetricKey =
  | "confidence"
  | "communication"
  | "authenticity"
  | "presence";

type EssayTextPart = {
  text: string;
  highlight: boolean;
};

type ChatItem = {
  q: string;
  a: string;
};

type CertItem = {
  label: string;
  fileUrl: string | null;
  verified: boolean;
};

type MetricJustifications = {
  leadership: string;
  initiative: string;
  growth: string;
  motivation: string;
  values: string;
};

type ScoreExplanation = {
  summary?: string;
  essay?: {
    problem_scale?: string;
    justification?: string;
    ai_detection?: {
      ai_probability?: number;
      reason?: string;
    };
    raw_scores?: Partial<Record<MetricKey, number>>;
  };
  interview?: {
    answerCount?: number;
    summary?: string;
    strengths?: string[];
    risks?: string[];
    raw_scores?: Partial<Record<MetricKey, number>>;
    metric_justifications?: Partial<MetricJustifications>;
  };
  blend?: {
    essayScale?: string;
    interviewScale?: string;
    finalScale?: string;
    essayWeight?: number;
    interviewWeight?: number;
  };
};

type Candidate = {
  id: string;
  name: string;
  avatar: string;
  submittedAt: string;
  status: CandidateStatus;
  aiScore: number;
  adminScore: number | null;
  indicator: IndicatorType;
  tags: string[];

  finalMetrics: Record<MetricKey, number>; // 0..10
  essayOnlyMetrics: Record<MetricKey, number>; // 0..5
  interviewOnlyMetrics: Record<MetricKey, number>; // 0..5

  essay: {
    explanation: string;
    aiDetectionText: string;
    textParts: EssayTextPart[];
  };

  questionnaire: {
    fullName: string;
    birthDate: string;
    city: string;
    telegram: string;
    score: number; // 0..5
    explanation: string;
    chat: ChatItem[];
  };

  video: {
    metrics: Record<VideoMetricKey, number>;
    summary: string;
    transcript: string;
    url: string | null;
  };

  certs: Record<string, CertItem>;

  summary: {
    strengths: string[];
    weaknesses: string[];
    potential: string;
    human: string;
    metricJustifications: MetricJustifications;
    overallSummary: string;
    interviewSummary: string;
    essaySummary: string;
  };

  activity: {
    visits: number;
    lastSeen: string;
    isFavorite: boolean;
  };
};

type AdminApplicationApiItem = {
  id: string;
  status:
    | "DRAFT"
    | "IN_REVIEW"
    | "SCORED"
    | "ACCEPTED"
    | "REJECTED"
    | "FINALIZED";
  createdAt: string;
  submittedAt: string | null;
  viewCount?: number;
  lastViewedAt?: string | null;
  adminScore?: number | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
  user: {
    id: string;
    email: string;
    profile: {
      fullName: string | null;
      city: string | null;
      telegram: string | null;
      birthDate: string | null;
    };
  };
  essaySubmission?: {
    essayText: string;
    justification: string | null;
  } | null;
  videoSubmission?: {
    fileKey: string | null;
    videoUrl: string | null;
  } | null;
  certificates: Array<{
    certType: string;
    scoreText: string | null;
    verifiedStatus: string | null;
    fileKey: string | null;
  }>;
  answers: Array<{
    questionText: string;
    answerText: string;
  }>;
  scores: Array<{
    sourceType: "ESSAY" | "INTERVIEW" | "VIDEO";
    leadership: number | null;
    initiative: number | null;
    growth: number | null;
    motivation: number | null;
    values: number | null;
    leaderPotential: number | null;
    deepHumanPotential: number | null;
    confidence: number | null;
    videoCommunication: number | null;
    videoPresence: number | null;
    videoAuthenticity: number | null;
    explanation?: ScoreExplanation | null;
  }>;
};

const METRIC_LABELS: Record<MetricKey, string> = {
  leadership: "Leadership",
  initiative: "Initiative",
  growth: "Growth",
  motivation: "Motivation",
  values: "Values",
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number) {
  return Number(n.toFixed(1));
}

function mapAdminStatus(
  status:
    | "DRAFT"
    | "IN_REVIEW"
    | "SCORED"
    | "ACCEPTED"
    | "REJECTED"
    | "FINALIZED"
): CandidateStatus {
  if (status === "REJECTED") return "rejected";
  if (status === "ACCEPTED" || status === "FINALIZED") return "accepted";
  return "pending";
}

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function averageMetrics(metrics: Record<MetricKey, number>) {
  const values = Object.values(metrics);
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

function StatusBadge({ status }: { status: CandidateStatus }) {
  const map: Record<
    CandidateStatus,
    { label: string; cls: string; dot: string }
  > = {
    pending: {
      label: "На рассмотрении",
      cls: "bg-gray-100 text-gray-600 border border-gray-200",
      dot: "bg-gray-400",
    },
    rejected: {
      label: "Отказ",
      cls: "bg-red-50 text-red-600 border border-red-200",
      dot: "bg-red-500",
    },
    accepted: {
      label: "Принят",
      cls: "bg-[#CDFF00]/20 text-black border border-[#CDFF00]",
      dot: "bg-black",
    },
  };

  const { label, cls, dot } = map[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function MetricBar({
  label,
  value,
  max = 10,
  colorClass = "bg-[#CDFF00]",
}: {
  label: string;
  value: number;
  max?: number;
  colorClass?: string;
}) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-semibold">
        <span className="text-gray-500 uppercase tracking-wide">{label}</span>
        <span className="text-black">
          {value}/{max}
        </span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-1000`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function RadialScore({
  score,
  max = 10,
  size = 100,
  strokeWidth = 8,
}: {
  score: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.max(0, Math.min(1, score / max));
  const offset = circumference - progress * circumference;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg className="transform -rotate-90 w-full h-full">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-[#CDFF00] transition-all duration-1000 ease-out"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-black leading-none">
          {score}
        </span>
        <span className="text-[10px] text-gray-500 mt-1">/ {max}</span>
      </div>
    </div>
  );
}

function ScoreCard({
  title,
  score,
  metrics,
  max = 10,
  theme = "lime",
}: {
  title: string;
  score: number;
  metrics: Record<MetricKey, number>;
  max?: number;
  theme?: "lime" | "black" | "blue";
}) {
  const colorClass =
    theme === "black"
      ? "bg-black"
      : theme === "blue"
      ? "bg-blue-500"
      : "bg-[#CDFF00]";

  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 leading-5">
            {title}
          </p>
          <p className="text-sm text-gray-500 mt-1 leading-6">
            Отдельный блок оценки
          </p>
        </div>
        <div className="flex-shrink-0">
          <RadialScore score={score} max={max} size={64} strokeWidth={6} />
        </div>
      </div>

      <div className="space-y-4">
        <MetricBar
          label="Leadership"
          value={metrics.leadership}
          max={max}
          colorClass={colorClass}
        />
        <MetricBar
          label="Initiative"
          value={metrics.initiative}
          max={max}
          colorClass={colorClass}
        />
        <MetricBar
          label="Growth"
          value={metrics.growth}
          max={max}
          colorClass={colorClass}
        />
        <MetricBar
          label="Motivation"
          value={metrics.motivation}
          max={max}
          colorClass={colorClass}
        />
        <MetricBar
          label="Values"
          value={metrics.values}
          max={max}
          colorClass={colorClass}
        />
      </div>
    </div>
  );
}

function getBestExplanation(
  scores: AdminApplicationApiItem["scores"]
): ScoreExplanation | null {
  const withExplanation = scores.find(
    (s) => s.explanation && typeof s.explanation === "object"
  );
  return withExplanation?.explanation || null;
}

function getFinalMetrics(
  scores: AdminApplicationApiItem["scores"]
): Record<MetricKey, number> {
  const source =
    scores.find(
      (s) =>
        s.sourceType === "ESSAY" &&
        s.leadership != null &&
        s.initiative != null &&
        s.growth != null &&
        s.motivation != null &&
        s.values != null
    ) ||
    scores.find(
      (s) =>
        s.leadership != null &&
        s.initiative != null &&
        s.growth != null &&
        s.motivation != null &&
        s.values != null
    );

  return {
    leadership: round1(Number(source?.leadership ?? 0)),
    initiative: round1(Number(source?.initiative ?? 0)),
    growth: round1(Number(source?.growth ?? 0)),
    motivation: round1(Number(source?.motivation ?? 0)),
    values: round1(Number(source?.values ?? 0)),
  };
}

function getEssayOnlyMetrics(
  explanation: ScoreExplanation | null
): Record<MetricKey, number> {
  const raw = explanation?.essay?.raw_scores || {};
  return {
    leadership: round1(raw.leadership ?? 0),
    initiative: round1(raw.initiative ?? 0),
    growth: round1(raw.growth ?? 0),
    motivation: round1(raw.motivation ?? 0),
    values: round1(raw.values ?? 0),
  };
}

function getInterviewOnlyMetrics(
  explanation: ScoreExplanation | null
): Record<MetricKey, number> {
  const raw = explanation?.interview?.raw_scores || {};
  return {
    leadership: round1(raw.leadership ?? 0),
    initiative: round1(raw.initiative ?? 0),
    growth: round1(raw.growth ?? 0),
    motivation: round1(raw.motivation ?? 0),
    values: round1(raw.values ?? 0),
  };
}

function deriveWeaknessesFromMetrics(
  metrics: Record<MetricKey, number>,
  justifications: Partial<MetricJustifications> | undefined,
  maxLabel: 5 | 10
) {
  const sorted = Object.entries(metrics)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2);

  return sorted.map(([key, value]) => {
    const metricKey = key as MetricKey;
    const reason =
      justifications?.[metricKey] ||
      `${METRIC_LABELS[metricKey]} currently has the lowest score in the profile.`;
    return `${METRIC_LABELS[metricKey]} — ${value}/${maxLabel}. ${reason}`;
  });
}

function mapCandidateFromApi(item: AdminApplicationApiItem): Candidate {
  const fullName =
    item.user.profile?.fullName || item.user.email?.split("@")[0] || "User";

  const certs: Record<string, CertItem> = {};
  item.certificates.forEach((cert, index) => {
    const key = cert.certType?.toLowerCase() || `cert_${index}`;
    certs[key] = {
      label: cert.certType || "CERT",
      fileUrl: cert.fileKey || null,
      verified:
        cert.verifiedStatus === "VERIFIED" || cert.verifiedStatus === "verified",
    };
  });

  const explanation = getBestExplanation(item.scores);
  const finalMetrics = getFinalMetrics(item.scores); // 0..10
  const essayOnlyMetrics = getEssayOnlyMetrics(explanation); // 0..5
  const interviewOnlyMetrics = getInterviewOnlyMetrics(explanation); // 0..5

  const avgTotal = averageMetrics(finalMetrics);
  const interviewOnlyAverage = averageMetrics(interviewOnlyMetrics);

  const mainScore = item.scores.find(
    (s) =>
      s.sourceType === "ESSAY" &&
      s.leaderPotential != null &&
      s.deepHumanPotential != null
  );

  const leaderPotentialTotal = round1(Number(mainScore?.leaderPotential ?? 0));
  const deepHumanPotentialTotal = round1(
    Number(mainScore?.deepHumanPotential ?? 0)
  );

  const videoScore =
  item.scores.find((s) => s.sourceType === "VIDEO") ||
  item.scores.find(
    (s) =>
      s.confidence != null ||
      s.videoCommunication != null ||
      s.videoPresence != null ||
      s.videoAuthenticity != null ||
      (s.explanation as any)?.video
  ) ||
  item.scores[0];

  const birthDate = item.user.profile?.birthDate
    ? new Date(item.user.profile.birthDate).toLocaleDateString("ru-RU")
    : "-";

  const strengths =
    explanation?.interview?.strengths?.length
      ? explanation.interview.strengths
      : [
          `Leadership: ${finalMetrics.leadership}/10`,
          `Initiative: ${finalMetrics.initiative}/10`,
          `Motivation: ${finalMetrics.motivation}/10`,
        ];

  const weaknesses =
    explanation?.interview?.risks?.length
      ? explanation.interview.risks
      : deriveWeaknessesFromMetrics(
          interviewOnlyMetrics,
          explanation?.interview?.metric_justifications,
          5
        );

  const metricJustifications: MetricJustifications = {
    leadership:
      explanation?.interview?.metric_justifications?.leadership ||
      "Обоснование по leadership пока отсутствует.",
    initiative:
      explanation?.interview?.metric_justifications?.initiative ||
      "Обоснование по initiative пока отсутствует.",
    growth:
      explanation?.interview?.metric_justifications?.growth ||
      "Обоснование по growth пока отсутствует.",
    motivation:
      explanation?.interview?.metric_justifications?.motivation ||
      "Обоснование по motivation пока отсутствует.",
    values:
      explanation?.interview?.metric_justifications?.values ||
      "Обоснование по values пока отсутствует.",
  };

  const aiProbability =
    explanation?.essay?.ai_detection?.ai_probability != null
      ? `${Math.round(explanation.essay.ai_detection.ai_probability * 100)}%`
      : "—";

  const aiDetectionText =
    explanation?.essay?.ai_detection?.reason
      ? `Вероятность ИИ: ${aiProbability}. ${explanation.essay.ai_detection.reason}`
      : "Детекция ИИ пока отсутствует.";

  return {
    id: item.id,
    name: fullName,
    avatar: initials(fullName),
    submittedAt: item.submittedAt || item.createdAt,
    status: mapAdminStatus(item.status),
    aiScore: avgTotal,
    adminScore:
      item.adminScore != null ? round1(Number(item.adminScore)) : null,
    indicator: avgTotal >= 8 ? "green" : "yellow",
    tags: [],
    finalMetrics,
    essayOnlyMetrics,
    interviewOnlyMetrics,
    essay: {
      explanation:
        explanation?.essay?.justification ||
        item.essaySubmission?.justification ||
        "AI-анализ эссе пока отсутствует.",
      aiDetectionText,
      textParts: [
        {
          text: item.essaySubmission?.essayText || "Эссе отсутствует",
          highlight: false,
        },
      ],
    },
    questionnaire: {
      fullName,
      birthDate,
      city: item.user.profile?.city || "-",
      telegram: item.user.profile?.telegram || "-",
      score: interviewOnlyAverage,
      explanation:
        explanation?.interview?.summary || "Ответы интервью загружены из БД.",
      chat: item.answers.map((a) => ({
        q: a.questionText,
        a: a.answerText,
      })),
    },
    video: {
     metrics: {
          confidence: round1(
            Number(
              videoScore?.confidence ??
                (videoScore?.explanation as any)?.video?.raw_scores?.confidence ??
                0
            )
          ),
          communication: round1(
            Number(
              videoScore?.videoCommunication ??
                (videoScore?.explanation as any)?.video?.raw_scores?.communication ??
                0
            )
          ),
          authenticity: round1(
            Number(
              videoScore?.videoAuthenticity ??
                (videoScore?.explanation as any)?.video?.raw_scores?.authenticity ??
                0
            )
          ),
          presence: round1(
            Number(
              videoScore?.videoPresence ??
                (videoScore?.explanation as any)?.video?.raw_scores?.presence ??
                0
            )
          ),
        },
        summary:
          (videoScore?.explanation as any)?.video?.summary ||
          (item.videoSubmission?.fileKey || item.videoSubmission?.videoUrl
            ? "Видео загружено."
            : "Видео отсутствует."),
        transcript:
          (videoScore?.explanation as any)?.video?.transcriptText || "",
        url: item.videoSubmission?.videoUrl || item.videoSubmission?.fileKey || null,
      },
    certs,
    summary: {
      strengths,
      weaknesses,
      potential: `Лидерский потенциал: ${leaderPotentialTotal}/10`,
      human: `Потенциал глубины личности: ${deepHumanPotentialTotal}/10`,
      metricJustifications,
      overallSummary:
        explanation?.summary || "Общий AI summary пока отсутствует.",
      interviewSummary:
        explanation?.interview?.summary ||
        "Подробный summary интервью отсутствует.",
      essaySummary:
        explanation?.essay?.justification ||
        "Подробный summary эссе отсутствует.",
    },
    activity: {
    visits: Number(item.viewCount ?? 0),
    lastSeen: item.lastViewedAt
      ? new Date(item.lastViewedAt).toLocaleString("ru-RU")
      : "—",
    isFavorite: false,
  },
  };
}

function CandidateProfile({
  candidate,
  onBack,
  onCandidateUpdated,
}: {
  candidate: Candidate | null;
  onBack: () => void;
  onCandidateUpdated: (updated: Candidate) => void;
}) {
  const [adminScore, setAdminScore] = useState<number>(candidate?.adminScore ?? candidate?.aiScore ?? 0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAdminScore(candidate?.adminScore ?? candidate?.aiScore ?? 0);
  }, [candidate]);

  if (!candidate) return null;

  const handleReview = async (
    nextStatus: "IN_REVIEW" | "ACCEPTED" | "REJECTED"
  ) => {
    try {
      setIsSaving(true);

      const res = await fetch(`/api/admin/applications/${candidate.id}/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          status: nextStatus,
          adminScore,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Не удалось сохранить решение");
      }

      const updatedCandidate = mapCandidateFromApi(data.application);
      onCandidateUpdated(updatedCandidate);
    } catch (error) {
      console.error("review save error:", error);
      alert(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pb-32 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-black transition-colors mb-4"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Назад к списку
      </button>

      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-black text-[#CDFF00] flex items-center justify-center text-3xl font-black shadow-md">
            {candidate.avatar}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-black text-black">
                {candidate.name}
              </h1>
              <StatusBadge status={candidate.status} />
            </div>
            <p className="text-sm text-gray-500 font-medium">
              Итог 0–10, эссе 0–5, интервью 0–5
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 bg-gray-50 p-4 rounded-2xl border border-gray-100">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-right mb-1">
              Итоговая оценка модели
            </p>
            <p className="text-xs text-gray-500 text-right">
              Финальный гибридный результат
            </p>
          </div>
          <RadialScore
            score={candidate.aiScore}
            max={10}
            size={64}
            strokeWidth={6}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ScoreCard
              title="Итоговая оценка"
              score={candidate.aiScore}
              metrics={candidate.finalMetrics}
              max={10}
              theme="lime"
            />
            <ScoreCard
              title="Только эссе"
              score={averageMetrics(candidate.essayOnlyMetrics)}
              metrics={candidate.essayOnlyMetrics}
              max={5}
              theme="black"
            />
            <ScoreCard
              title="Только интервью"
              score={averageMetrics(candidate.interviewOnlyMetrics)}
              metrics={candidate.interviewOnlyMetrics}
              max={5}
              theme="blue"
            />
          </section>

          <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <h2 className="text-xl font-bold text-black mb-6">
              Подробное обоснование модели
            </h2>

            <div className="space-y-6">
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">
                  Общий вывод
                </p>
                <p className="text-sm text-gray-700 leading-7">
                  {candidate.summary.overallSummary}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">
                    Обоснование по эссе
                  </p>
                  <p className="text-sm text-gray-700 leading-7">
                    {candidate.summary.essaySummary}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">
                    Обоснование по интервью
                  </p>
                  <p className="text-sm text-gray-700 leading-7">
                    {candidate.summary.interviewSummary}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase mb-4">
                  Обоснование по каждой метрике
                </p>

                <div className="space-y-5">
                  {(Object.keys(candidate.summary.metricJustifications) as MetricKey[]).map(
                    (key) => (
                      <div key={key}>
                        <p className="text-sm font-bold text-black mb-1">
                          {METRIC_LABELS[key]}
                        </p>
                        <p className="text-sm text-gray-700 leading-7">
                          {candidate.summary.metricJustifications[key]}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <h2 className="text-xl font-bold text-black mb-6">Анализ Эссе</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8">
              <div className="space-y-4">
                <MetricBar
                  label="Leadership"
                  value={candidate.essayOnlyMetrics.leadership}
                  max={5}
                />
                <MetricBar
                  label="Initiative"
                  value={candidate.essayOnlyMetrics.initiative}
                  max={5}
                />
                <MetricBar
                  label="Growth"
                  value={candidate.essayOnlyMetrics.growth}
                  max={5}
                />
              </div>
              <div className="space-y-4">
                <MetricBar
                  label="Motivation"
                  value={candidate.essayOnlyMetrics.motivation}
                  max={5}
                />
                <MetricBar
                  label="Values"
                  value={candidate.essayOnlyMetrics.values}
                  max={5}
                />
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">
                    AI / Human detector
                  </p>
                  <p className="text-sm text-gray-700 leading-6">
                    {candidate.essay.aiDetectionText}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 mb-6">
              <p className="text-sm text-gray-700 leading-7">
                {candidate.essay.explanation}
              </p>
            </div>

            <div className="p-5 border border-gray-100 rounded-2xl text-sm leading-relaxed text-gray-700 bg-white">
              {candidate.essay.textParts.map((part, i) => (
                <span
                  key={i}
                  className={
                    part.highlight
                      ? "bg-[#D6FF00]/40 font-semibold px-1 rounded"
                      : ""
                  }
                >
                  {part.text}
                </span>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-black">
                Анкета и Интервью
              </h2>
              <div className="bg-[#CDFF00]/20 px-3 py-1.5 rounded-xl border border-[#CDFF00]">
                <span className="text-xs font-bold text-black">
                  Только интервью: {averageMetrics(candidate.interviewOnlyMetrics)}
                  /5
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { l: "ФИО", v: candidate.questionnaire.fullName },
                { l: "Дата рождения", v: candidate.questionnaire.birthDate },
                { l: "Город", v: candidate.questionnaire.city },
                { l: "Telegram", v: candidate.questionnaire.telegram },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-gray-50 p-3 rounded-xl border border-gray-100"
                >
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                    {item.l}
                  </p>
                  <p className="text-sm font-semibold text-black truncate">
                    {item.v}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <MetricBar
                  label="Leadership"
                  value={candidate.interviewOnlyMetrics.leadership}
                  max={5}
                  colorClass="bg-blue-500"
                />
                <MetricBar
                  label="Initiative"
                  value={candidate.interviewOnlyMetrics.initiative}
                  max={5}
                  colorClass="bg-blue-500"
                />
                <MetricBar
                  label="Growth"
                  value={candidate.interviewOnlyMetrics.growth}
                  max={5}
                  colorClass="bg-blue-500"
                />
              </div>
              <div className="space-y-4">
                <MetricBar
                  label="Motivation"
                  value={candidate.interviewOnlyMetrics.motivation}
                  max={5}
                  colorClass="bg-blue-500"
                />
                <MetricBar
                  label="Values"
                  value={candidate.interviewOnlyMetrics.values}
                  max={5}
                  colorClass="bg-blue-500"
                />
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">
                    Вывод по интервью
                  </p>
                  <p className="text-sm text-gray-700 leading-6">
                    {candidate.questionnaire.explanation}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 max-h-[650px] overflow-y-auto">
              {candidate.questionnaire.chat.map((msg, i) => (
                <div key={i} className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#CDFF00] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-[9px] font-black text-black">
                        Model:
                      </span>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-700 shadow-sm">
                      {msg.q}
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-black rounded-2xl rounded-tr-none px-4 py-3 text-sm text-white">
                      {msg.a}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-[9px] font-black text-gray-500">
                        К
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-black rounded-3xl p-8 shadow-xl text-white">
            <h2 className="text-xl font-bold mb-6 text-[#CDFF00]">
              Candidate Profile
            </h2>

            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Сильные стороны
                </p>
                <ul className="space-y-2">
                  {candidate.summary.strengths.map((s, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-[#CDFF00] mt-0.5">✓</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Зоны риска
                </p>
                <ul className="space-y-2">
                  {candidate.summary.weaknesses.map((w, i) => (
                    <li
                      key={i}
                      className="text-sm flex items-start gap-2 text-gray-300"
                    >
                      <span className="text-red-400 mt-0.5">!</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
           <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-black mb-4">Активность кандидата</h2>

          <div className="space-y-3">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">
                Проверял статус
              </p>
              <p className="text-2xl font-black text-black">
                {candidate.activity.visits}
              </p>
              <p className="text-xs text-gray-500 mt-1">раз(а)</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">
                Последний визит
              </p>
              <p className="text-sm font-semibold text-black">
                {candidate.activity.lastSeen}
              </p>
            </div>
          </div>
        </section> 

          <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-black mb-4">Сертификаты</h2>
            <div className="space-y-3">
              {(Object.entries(candidate.certs) as [string, CertItem][]).map(
                ([key, cert]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-xs font-black text-black">
                        {cert.label.substring(0, 3)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-black uppercase">
                          {cert.label}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {cert.verified ? "Оригинал проверен" : "Не проверено"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {cert.fileUrl ? (
                        <a
                          href={cert.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-black underline hover:text-gray-600"
                        >
                          Открыть PDF
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-gray-400">
                          Файл не загружен
                        </span>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-bold text-black mb-4">Видео</h2>
              <div className="space-y-4">
                <MetricBar
                  label="Уверенность"
                  value={candidate.video.metrics.confidence}
                  max={5}
                  colorClass="bg-black"
                />
                <MetricBar
                  label="Коммуникация"
                  value={candidate.video.metrics.communication}
                  max={5}
                  colorClass="bg-black"
                />
                <MetricBar
                  label="Присутствие"
                  value={candidate.video.metrics.presence}
                  max={5}
                  colorClass="bg-black"
                />
                <MetricBar
                  label="Аутентичность"
                  value={candidate.video.metrics.authenticity}
                  max={5}
                  colorClass="bg-black"
                />

                <div className="text-xs text-gray-500 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2">
                  <p>
                    <strong className="text-black">AI:</strong> {candidate.video.summary}
                  </p>

                  {candidate.video.transcript && (
                      <div className="mt-3">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">
                          Транскрипт видео
                        </p>
                        <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 leading-6">
                          {candidate.video.transcript}
                        </div>
                      </div>
                    )}

                  {candidate.video.url ? (
                    <a
                      href={candidate.video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-sm font-bold text-black underline hover:text-gray-600"
                    >
                      Открыть видео
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400">Видео не загружено</p>
                  )}
                </div>
              </div>
            </section>
        </div>
      </div>

      <div className="fixed bottom-9 left-1/2 transform -translate-x-1/2 w-[90%] max-w-4xl bg-white/90 backdrop-blur-md border border-gray-200 p-4 rounded-3xl shadow-2xl flex items-center justify-between z-50">
        <div className="flex items-center gap-6 w-1/2 pl-4">
          <div className="flex-1">
            <div className="flex justify-between mb-2 text-sm font-bold">
              <span>Валюация Admin</span>
              <span>{adminScore} / 10</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={adminScore}
              onChange={(e) => setAdminScore(Number(e.target.value))}
              className="w-full accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pr-2">
          <button
            onClick={() => handleReview("IN_REVIEW")}
            disabled={isSaving}
            className="px-5 py-3 rounded-2xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            ⏳ {isSaving ? "..." : "В резерв"}
          </button>

          <button
            onClick={() => handleReview("REJECTED")}
            disabled={isSaving}
            className="px-5 py-3 rounded-2xl font-bold text-sm bg-red-50 text-red-600 hover:bg-red-100"
          >
            ❌ {isSaving ? "..." : "Отказать"}
          </button>

          <button
            onClick={() => handleReview("ACCEPTED")}
            disabled={isSaving}
            className="px-6 py-3 rounded-2xl font-bold text-sm bg-[#CDFF00] text-black"
          >
            ✅ {isSaving ? "..." : "Принять"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null
  );
  const [activeMenu, setActiveMenu] = useState<string>("Applications");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [adminName, setAdminName] = useState<string>("User");
  const [statusFilter, setStatusFilter] = useState<"all" | CandidateStatus>("all");

  const menuItems: Array<{ id: string; icon: string }> = [
    {
      id: "Dashboard",
      icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
    },
    {
      id: "Applications",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
    {
      id: "Favorites",
      icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
    },
    {
      id: "Analytics",
      icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z",
    },
    {
      id: "Settings",
      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    },
  ];

  useEffect(() => {
    const loadCandidates = async () => {
      try {
        setIsLoading(true);

        const res = await fetch("/api/admin/applications", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Не удалось загрузить кандидатов");
        }

        const data: { applications: AdminApplicationApiItem[] } =
          await res.json();

        setCandidates((data.applications || []).map(mapCandidateFromApi));
      } catch (error) {
        console.error("loadCandidates error:", error);
        setCandidates([]);
      } finally {
        setIsLoading(false);
      }
    };

    const loadAdmin = async () => {
      try {
        const res = await fetch("/api/me", {
          credentials: "include",
        });

        const data = await res.json();

        setAdminName(
          data.user?.profile?.fullName ||
            data.user?.email?.split("@")[0] ||
            "User"
        );
      } catch (error) {
        console.error("admin me error:", error);
        setAdminName("User");
      }
    };

    loadCandidates();
    loadAdmin();
  }, []);

  const visibleCandidates = useMemo(() => {
  if (statusFilter === "all") return candidates;
  return candidates.filter((c) => c.status === statusFilter);
}, [candidates, statusFilter]);

  return (
    <div className="flex h-screen bg-gray-50/50 font-sans overflow-hidden text-black selection:bg-[#CDFF00] selection:text-black">
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col z-20 shadow-sm relative">
        <div className="p-6 flex items-center gap-2">
          <span className="text-2xl font-black tracking-tight">inVision</span>
          <span className="text-2xl font-black text-[#CDFF00]">U</span>
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-1">
            ADMIN
          </span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveMenu(item.id);
                setSelectedCandidate(null);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                activeMenu === item.id
                  ? "bg-black text-white shadow-lg shadow-black/10"
                  : "text-gray-500 hover:bg-gray-50 hover:text-black"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={item.icon}
                />
              </svg>
              {item.id}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-gray-100">
          <div className="bg-[#CDFF00]/10 border border-[#CDFF00]/50 rounded-2xl p-4">
            <p className="text-xs font-bold text-black mb-1">
              AI Pipeline Status
            </p>
            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              All systems operational
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-8 z-10 sticky top-0">
          <div className="flex-1 max-w-md relative">
            <svg
              className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Поиск кандидата..."
              className="w-full bg-gray-50 border border-gray-200 rounded-full pl-12 pr-4 py-2.5 text-sm outline-none focus:border-black transition-colors focus:bg-white focus:shadow-sm"
            />
          </div>

          <div className="flex items-center gap-6 pl-6">
            <div className="h-8 w-px bg-gray-200" />
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-gray-400 font-semibold uppercase">
                  Senior Reviewer
                </p>
                <p className="text-sm font-bold text-black group-hover:text-gray-700 transition-colors">
                  {adminName}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold shadow-md">
                {adminName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
          <div className="max-w-[1500px] mx-auto">
            {selectedCandidate ? (
              <CandidateProfile
                candidate={selectedCandidate}
                onBack={() => setSelectedCandidate(null)}
                onCandidateUpdated={(updated) => {
                  setSelectedCandidate(updated);

                  setCandidates((prev) =>
                    prev.map((c) => (c.id === updated.id ? updated : c))
                  );
                }}
              />
            ) : (
              <div className="animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h1 className="text-3xl font-black text-black">
                      Applications Review
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 font-medium">
                      Отдельно видно эссе, интервью и итог
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {[
                    { label: "Все", value: "all" },
                    { label: "На рассмотрении", value: "pending" },
                    { label: "Принятые", value: "accepted" },
                    { label: "Отказанные", value: "rejected" },
                  ].map((btn) => (
                    <button
                      key={btn.value}
                      onClick={() => setStatusFilter(btn.value as "all" | CandidateStatus)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${
                        statusFilter === btn.value
                          ? "bg-black text-white border-black"
                          : "bg-white text-gray-500 border-gray-200 hover:text-black hover:border-black"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <th className="p-5 font-semibold">Кандидат</th>
                        <th className="p-5 font-semibold">Дата подачи</th>
                        <th className="p-5 font-semibold">Статус</th>
                        <th className="p-5 font-semibold">AI Оценка</th>
                        <th className="p-5 font-semibold">Admin</th>
                        <th className="p-5 font-semibold text-right">
                          Действие
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {isLoading ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-8 text-center text-sm text-gray-500"
                          >
                            Загрузка...
                          </td>
                        </tr>
                      ) : visibleCandidates.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-8 text-center text-sm text-gray-500"
                          >
                            Нет заявок
                          </td>
                        </tr>
                      ) : (
                        visibleCandidates.map((cand) => (
                          <tr
                            key={cand.id}
                            onClick={() => setSelectedCandidate(cand)}
                            className="hover:bg-gray-50 cursor-pointer transition-colors group"
                          >
                            <td className="p-5">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-sm font-black text-black border border-gray-200">
                                  {cand.avatar}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-black group-hover:text-[#9fc000] transition-colors">
                                    {cand.name}
                                  </p>
                                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                                    {cand.id}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-5 text-sm text-gray-500 font-medium">
                              {new Date(cand.submittedAt).toLocaleDateString(
                                "ru-RU",
                                {
                                  day: "numeric",
                                  month: "short",
                                }
                              )}
                            </td>
                            <td className="p-5">
                              <StatusBadge status={cand.status} />
                            </td>
                            <td className="p-5">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    cand.indicator === "green"
                                      ? "bg-[#CDFF00]"
                                      : "bg-yellow-400"
                                  }`}
                                />
                                <span className="text-sm font-black text-black">
                                  {cand.aiScore}
                                </span>
                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden md:block">
                                  <div
                                    className={`h-full ${
                                      cand.indicator === "green"
                                        ? "bg-[#CDFF00]"
                                        : "bg-yellow-400"
                                    }`}
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        (cand.aiScore / 10) * 100
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="p-5">
                              <div className="flex items-center gap-2">
                                {cand.adminScore !== null ? (
                                  <>
                                    <span className="text-sm font-bold text-black">
                                      {cand.adminScore}
                                    </span>
                                    <span className="text-xs text-gray-400">/10</span>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </div>
                            </td>
                            <td className="p-5 text-right">
                              <button className="p-2 rounded-xl text-gray-400 hover:text-black hover:bg-white border border-transparent hover:border-gray-200 transition-all shadow-sm opacity-0 group-hover:opacity-100">
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}