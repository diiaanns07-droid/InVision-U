"use client";

import { useEffect, useRef, useState } from "react";

type StatusType = "review" | "rejected" | "accepted";

type QAItem = {
  q: string;
  a: string;
};

type FormCerts = {
  ent: File | null;
  ielts: File | null;
  sat: File | null;
  extra: File | null;
};

type UploadedCerts = {
  ent: string | null;
  ielts: string | null;
  sat: string | null;
  extra: string | null;
};

type ApplicationItem = {
  id: string;
  submittedAt: string;
  status: StatusType;
  essay: string;
  answers: QAItem[];
  video: string;
  certs: UploadedCerts;
};

type EssayData = {
  text: string;
  file: File | null;
};

type QuestionnaireData = {
  fullName: string;
  birthDate: string;
  telegram: string;
  city: string;
  phone: string;
  aiAnswers: QAItem[];
};

type VideoData = {
  link: string;
  videoFile: File | null;
};

type FormDataType = {
  essay: EssayData;
  questionnaire: QuestionnaireData;
  video: VideoData;
  certs: FormCerts;
};

const TABS: string[] = ["Эссе", "Анкета", "Видео", "Сертификаты"];




function StatusBadge({ status }: { status: StatusType }) {
  const map: Record<StatusType, { label: string; cls: string }> = {
    review: {
      label: "На рассмотрении",
      cls: "bg-gray-100 text-gray-600 border border-gray-200",
    },
    rejected: {
      label: "Отказ",
      cls: "bg-red-50 text-red-600 border border-red-200",
    },
    accepted: {
      label: "Принят",
      cls: "bg-[#CDFF00] text-black border border-[#b8e600]",
    },
  };

  const { label, cls } = map[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cls}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "accepted"
            ? "bg-black"
            : status === "rejected"
            ? "bg-red-500"
            : "bg-gray-400"
        }`}
      />
      {label}
    </span>
  );
}

function FileUpload({
  label,
  value,
  onChange,
  accept = "*",
  disabled = false,
}: {
  label: string;
  value: File | null;
  onChange?: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  return (
    <div
      onClick={() => !disabled && ref.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-5 flex items-center gap-4 transition-all
        ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:border-[#CDFF00] hover:bg-[#fafff0]"
        }
        ${value ? "border-[#CDFF00] bg-[#fafff0]" : "border-gray-200"}`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
        ${value ? "bg-[#CDFF00]" : "bg-gray-100"}`}
      >
        {value ? "✓" : "↑"}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-black">{label}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">
          {value ? value.name : "Нажмите для загрузки файла"}
        </p>
      </div>

      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.files?.[0] || null)}
      />
    </div>
  );
}

function EssaySection({
  data,
  onChange,
  onFileChange,
  readOnly,
  parsing,
}: {
  data: EssayData;
  onChange: (data: EssayData) => void;
  onFileChange: (file: File | null) => void;
  readOnly: boolean;
  parsing: boolean;
}) {
  const [mode, setMode] = useState<"write" | "upload">("write");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-black mb-1">Сдать эссе</h3>
        <p className="text-gray-500 text-sm">
          Напишите эссе вручную или загрузите файл
        </p>
      </div>

      {!readOnly && (
        <div className="flex bg-gray-100 rounded-2xl p-1 w-fit gap-1">
          {(["write", "upload"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all
                ${
                  mode === m
                    ? "bg-white text-black shadow-sm"
                    : "text-gray-500 hover:text-black"
                }`}
            >
              {m === "write" ? "Написать" : "Загрузить файл"}
            </button>
          ))}
        </div>
      )}

      {(mode === "write" || readOnly) && (
        <div>
          <textarea
            readOnly={readOnly}
            value={data.text}
            onChange={(e) => onChange({ ...data, text: e.target.value })}
            placeholder="Начните писать ваше эссе здесь..."
            rows={12}
            className={`w-full rounded-2xl border border-gray-200 p-5 text-gray-800 text-sm leading-relaxed resize-none outline-none transition-all
              ${
                readOnly
                  ? "bg-gray-50 cursor-default"
                  : "bg-white focus:border-black focus:ring-0"
              }`}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-400">
              {data.text?.length || 0} символов
            </span>
            <span className="text-xs text-gray-400">
              Рекомендуется 500–1000 слов
            </span>
          </div>
        </div>
      )}

  {mode === "upload" && !readOnly && (
  <div className="space-y-3">
    <FileUpload
      label="Файл с эссе"
      value={data.file}
      onChange={onFileChange}
      accept=".pdf,.doc,.docx"
      disabled={readOnly || parsing}
    />

    {parsing && (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        Читаем файл и извлекаем текст эссе...
      </div>
    )}

    {!!data.text.trim() && !parsing && (
      <div className="rounded-xl border border-[#CDFF00] bg-[#fafff0] px-4 py-3 text-sm text-black">
        Текст из файла успешно загружен в поле эссе.
      </div>
    )}
  </div>
)}
    </div>
  );
}

function QuestionnaireSection({
  data,
  onChange,
  readOnly,
  essayText,
  essayParsing,
  interviewStarted,
  interviewCompleted,
  currentQuestion,
  interviewLoading,
  onStartInterview,
  onSubmitInterviewAnswer,
}: {
  data: QuestionnaireData;
  onChange: (data: QuestionnaireData) => void;
  readOnly: boolean;
  essayText: string;
  essayParsing: boolean;
  interviewStarted: boolean;
  interviewCompleted: boolean;
  currentQuestion: string;
  interviewLoading: boolean;
  onStartInterview: () => void;
  onSubmitInterviewAnswer: (answer: string) => Promise<void>;
}) {
  const [input, setInput] = useState<string>("");

  const handleAnswer = async () => {
    if (!input.trim()) return;
    const answer = input.trim();
    setInput("");
    await onSubmitInterviewAnswer(answer);
  };

  const baseFields: Array<{
    key: keyof Omit<QuestionnaireData, "aiAnswers">;
    label: string;
    placeholder: string;
    type: string;
  }> = [
    {
      key: "fullName",
      label: "ФИО",
      placeholder: "Иванов Иван Иванович",
      type: "text",
    },
    { key: "birthDate", label: "Дата рождения", placeholder: "", type: "date" },
    {
      key: "telegram",
      label: "Telegram username",
      placeholder: "@username",
      type: "text",
    },
    {
      key: "city",
      label: "Город проживания",
      placeholder: "Алматы",
      type: "text",
    },
    {
      key: "phone",
      label: "Контактный номер",
      placeholder: "+7 700 000 00 00",
      type: "tel",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-black mb-1">Базовая анкета</h3>
        <p className="text-gray-500 text-sm mb-6">
          Обязательные личные данные
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {baseFields.map((f) => (
            <div
              key={f.key}
              className={f.key === "fullName" ? "md:col-span-2" : ""}
            >
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                {f.label}
              </label>
              <input
                type={f.type}
                readOnly={readOnly}
                value={data[f.key] || ""}
                onChange={(e) => {
                  onChange({ ...data, [f.key]: e.target.value });
                }}
                placeholder={f.placeholder}
                className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-black outline-none transition-all ${
                  readOnly
                    ? "bg-gray-50 cursor-default"
                    : "bg-white focus:border-black"
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border border-gray-100 rounded-3xl overflow-hidden">
        <div className="bg-black px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#CDFF00] flex items-center justify-center">
            <svg
              className="w-4 h-4 text-black"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.745A7 7 0 0112 21a7 7 0 01-4.929-2.036l-.346-.745z"
              />
            </svg>
          </div>
          <div>
            <p className="text-white text-sm font-bold">AI-интервью</p>
            <p className="text-gray-400 text-xs">
              Вопросы для оценки личных качеств
            </p>
          </div>
          <div className="ml-auto flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-600" />
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4 min-h-[300px] bg-gray-50">
          {(data.aiAnswers || []).map((item, i) => (
            <div key={i} className="space-y-2">
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-[#CDFF00] flex-shrink-0 flex items-center justify-center">
                  <span className="text-[10px] font-black text-black">AI</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-700 max-w-[80%] shadow-sm">
                  {item.q}
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="bg-black rounded-2xl rounded-tr-none px-4 py-3 text-sm text-white max-w-[80%]">
                  {item.a}
                </div>
                <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-gray-500">Вы</span>
                </div>
              </div>
            </div>
          ))}

          {!readOnly && !interviewStarted && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[#CDFF00] flex-shrink-0 flex items-center justify-center">
                <span className="text-[10px] font-black text-black">AI</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-700 max-w-[80%] shadow-sm">
                AI-интервью ещё не началось. Нажмите кнопку ниже, чтобы начать.
              </div>
            </div>
          )}

          {!readOnly &&
            interviewStarted &&
            !interviewCompleted &&
            currentQuestion && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-[#CDFF00] flex-shrink-0 flex items-center justify-center">
                  <span className="text-[10px] font-black text-black">AI</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-700 max-w-[80%] shadow-sm">
                  {currentQuestion}
                </div>
              </div>
            )}

          {!readOnly && interviewCompleted && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[#CDFF00] flex-shrink-0 flex items-center justify-center">
                <span className="text-[10px] font-black text-black">AI</span>
              </div>
              <div className="bg-[#CDFF00] rounded-2xl rounded-tl-none px-4 py-3 text-sm text-black font-semibold max-w-[80%]">
                Отлично! Интервью завершено. Можно переходить к следующему
                разделу.
              </div>
            </div>
          )}
        </div>

        {!readOnly && !interviewStarted && (
          <div className="px-6 py-4 bg-white border-t border-gray-100 flex justify-end">
            <button
              onClick={onStartInterview}
              disabled={interviewLoading || essayParsing || !essayText.trim()}
              className="bg-black text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              {essayParsing ? "Чтение эссе..." : interviewLoading ? "Запуск..." : "Начать AI-интервью"}
            </button>
          </div>
        )}

        {!readOnly && interviewStarted && !interviewCompleted && (
          <div className="px-6 py-4 bg-white border-t border-gray-100 flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleAnswer();
                }
              }}
              placeholder="Ваш ответ..."
              rows={2}
              disabled={interviewLoading}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm text-black outline-none resize-none focus:border-black transition-all disabled:opacity-50"
            />
            <button
              onClick={() => void handleAnswer()}
              disabled={interviewLoading || !input.trim()}
              className="bg-black text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-all flex-shrink-0 self-end disabled:opacity-50"
            >
              {interviewLoading ? "..." : "Ответить"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



function VideoSection({
  data,
  onChange,
  readOnly,
}: {
  data: VideoData;
  onChange: (data: VideoData) => void;
  readOnly: boolean;
}) {
  const [mode, setMode] = useState<"link" | "file">("link");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-black mb-1">Видео-презентация</h3>
        <p className="text-gray-500 text-sm">
          Запишите короткую видео-презентацию о себе (1–3 минуты)
        </p>
      </div>

      {!readOnly && (
        <div className="flex bg-gray-100 rounded-2xl p-1 w-fit gap-1">
          {(["link", "file"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all
                ${
                  mode === m
                    ? "bg-white text-black shadow-sm"
                    : "text-gray-500 hover:text-black"
                }`}
            >
              {m === "link" ? "Ссылка на видео" : "Загрузить файл"}
            </button>
          ))}
        </div>
      )}

      {(mode === "link" || readOnly) && (
        <div className="rounded-2xl border border-gray-200 p-6 bg-white">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
            Ссылка на видео
          </label>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex-1">
              <svg
                className="w-4 h-4 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              <input
                readOnly={readOnly}
                value={data.link || ""}
                onChange={(e) => onChange({ ...data, link: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 bg-transparent text-sm text-black outline-none"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            YouTube, Vimeo или любой публичный видеохостинг
          </p>

          {data.link && (
            <div className="mt-4 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00] px-4 py-3 flex items-center gap-2">
              <svg
                className="w-4 h-4 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm font-semibold text-black truncate">
                {data.link}
              </span>
            </div>
          )}
        </div>
      )}

      {mode === "file" && !readOnly && (
        <div
          className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center bg-white hover:border-[#CDFF00] hover:bg-[#fafff0] transition-all cursor-pointer"
          onClick={() => document.getElementById("videoInput")?.click()}
        >
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          {data.videoFile ? (
              <p className="text-black font-semibold text-sm">{data.videoFile.name}</p>
            ) : (
              <>
                <p className="text-black font-semibold mb-1">
                  Перетащите файл сюда или нажмите для выбора
                </p>
                <p className="text-gray-400 text-xs">MP4, MOV до 500 МБ</p>
              </>
            )}
          <input
            id="videoInput"
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) =>
              onChange({
                ...data,
                videoFile: e.target.files?.[0] || null,
              })
            }
          />
        </div>
      )}
    </div>
  );
}

function CertificatesSection({
  data,
  onChange,
  readOnly,
}: {
  data: FormCerts;
  onChange: (data: FormCerts) => void;
  readOnly: boolean;
})  {
  const certs: Array<{
    key: keyof FormCerts;
    label: string;
    desc: string;
  }> = [
    {
      key: "ent",
      label: "ЕНТ",
      desc: "Результаты единого национального тестирования",
    },
    {
      key: "ielts",
      label: "IELTS",
      desc: "Международный экзамен по английскому языку",
    },
    {
      key: "sat",
      label: "SAT",
      desc: "Scholastic Assessment Test",
    },
    {
      key: "extra",
      label: "Дополнительный сертификат",
      desc: "Олимпиады, достижения, другие сертификаты",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-black mb-1">Сертификаты</h3>
        <p className="text-gray-500 text-sm">
          Загрузите имеющиеся документы (необязательно все)
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {certs.map((c) => (
          <div
            key={c.key}
            className="rounded-2xl border border-gray-100 bg-white p-5"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-black">{c.label}</p>
              {data[c.key] && (
                <span className="text-[10px] font-bold text-[#CDFF00] bg-black rounded-full px-2 py-0.5">
                  ✓ Загружено
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">{c.desc}</p>
            <FileUpload
              label={data[c.key]?.name || "Выберите файл"}
              value={data[c.key]}
              onChange={(file) => onChange({ ...data, [c.key]: file })}
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={readOnly}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ApplicationCard({
  app,
  onOpen,
}: {
  app: ApplicationItem;
  onOpen: (app: ApplicationItem) => void;
}) {
  const date = new Date(app.submittedAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className="text-xs font-mono text-gray-400">{app.id}</span>
          <h4 className="text-base font-bold text-black mt-1">
            Заявка на бакалавриат
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">{date}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>
      <p className="text-sm text-gray-500 line-clamp-2 mb-5 leading-relaxed">
        {app.essay || "Эссе загружено файлом"}
      </p>
      <button
        onClick={() => onOpen(app)}
        className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-black
          hover:bg-black hover:text-white hover:border-black transition-all flex items-center justify-center gap-2"
      >
        Открыть
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
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}

function ApplicationViewer({
  app,
  onClose,
}: {
  app: ApplicationItem | null;
  onClose: () => void;
}) {
  if (!app) return null;

  const date = new Date(app.submittedAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl my-8 overflow-hidden shadow-2xl">
        <div className="bg-black px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs font-mono">{app.id}</p>
            <h3 className="text-white font-bold text-lg mt-0.5">
              Просмотр заявки
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={app.status} />
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span className="text-xs text-gray-500 font-semibold">
              Заявка заблокирована для редактирования • Отправлено {date}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Эссе
            </p>
            <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-700 leading-relaxed">
              {app.essay}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Ответы на вопросы
            </p>
            <div className="space-y-3">
              {app.answers.map((a, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gray-500 mb-1">{a.q}</p>
                  <p className="text-sm text-black">{a.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Видео
            </p>
            <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#CDFF00] flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 text-black"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <a
                href={app.video}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-black font-medium hover:underline truncate"
              >
                {app.video}
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Сертификаты
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(app.certs) as [keyof UploadedCerts, string | null][])
                .map(([key, val]) => (
                  <div
                    key={key}
                    className={`rounded-2xl p-3 flex items-center gap-2 ${
                      val
                        ? "bg-[#CDFF00]/10 border border-[#CDFF00]"
                        : "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    <span className="text-xs font-bold text-black uppercase">
                      {key === "extra" ? "Доп." : key}
                    </span>
                    <span className="text-xs text-gray-500 truncate">
                    {val ? (
                      <a href={val} target="_blank" className="underline text-blue-600">
                        Открыть
                      </a>
                    ) : (
                      "Не загружен"
                    )}
                  </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: fd,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : { applications: [] };
    console.log("POST /api/upload response:", data);

    if (!res.ok) {
      throw new Error(data.error || "Ошибка отправки");
    }

  return data.fileKey;
}

async function parseEssayFile(file: File): Promise<{
  text: string;
  wordCount?: number;
  charCount?: number;
}> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/essay/parse", {
    method: "POST",
    body: fd,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Не удалось прочитать файл эссе");
  }

  return data;
}

export default function ApplicationPage() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [viewApp, setViewApp] = useState<ApplicationItem | null>(null);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [userName, setUserName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [interviewSessionId, setInterviewSessionId] = useState<string | null>(null);
  const [currentInterviewQuestion, setCurrentInterviewQuestion] =
    useState<string>("");
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);

  const [essayParsing, setEssayParsing] = useState(false);

  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const essayRef = useRef<HTMLDivElement | null>(null);
  const fullNameRef = useRef<HTMLInputElement | null>(null);
  const birthDateRef = useRef<HTMLInputElement | null>(null);
  const telegramRef = useRef<HTMLInputElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const interviewRef = useRef<HTMLDivElement | null>(null);
  const videoLinkRef = useRef<HTMLInputElement | null>(null);
  const videoFileRef = useRef<HTMLInputElement | null>(null);

  const validateForm = () => {
      const nextErrors: Record<string, boolean> = {};

      const hasEssay = formData.essay.text.trim().length > 0;

      const hasVideo =
        formData.video.link.trim().length > 0 || formData.video.videoFile !== null;

      const hasInterviewAnswers = formData.questionnaire.aiAnswers.length > 0;

      if (!hasEssay) nextErrors.essay = true;
      if (!formData.questionnaire.fullName.trim()) nextErrors.fullName = true;
      if (!formData.questionnaire.birthDate.trim()) nextErrors.birthDate = true;
      if (!formData.questionnaire.telegram.trim()) nextErrors.telegram = true;
      if (!formData.questionnaire.city.trim()) nextErrors.city = true;
      if (!formData.questionnaire.phone.trim()) nextErrors.phone = true;
      if (!hasInterviewAnswers) nextErrors.aiAnswers = true;
      if (!hasVideo) nextErrors.video = true;

      setErrors(nextErrors);

      if (Object.keys(nextErrors).length === 0) return true;

      if (nextErrors.essay) {
        setActiveTab(0);
        setTimeout(() => {
          essayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
        return false;
      }

      if (
        nextErrors.fullName ||
        nextErrors.birthDate ||
        nextErrors.telegram ||
        nextErrors.city ||
        nextErrors.phone ||
        nextErrors.aiAnswers
      ) {
        setActiveTab(1);
        setTimeout(() => {
          if (nextErrors.fullName) fullNameRef.current?.focus();
          else if (nextErrors.birthDate) birthDateRef.current?.focus();
          else if (nextErrors.telegram) telegramRef.current?.focus();
          else if (nextErrors.city) cityRef.current?.focus();
          else if (nextErrors.phone) phoneRef.current?.focus();
          else interviewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
        return false;
      }

      if (nextErrors.video) {
        setActiveTab(2);
        setTimeout(() => {
          videoLinkRef.current?.focus();
          videoFileRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
        return false;
      }

      return false;
    };

  const [formData, setFormData] = useState<FormDataType>({
      essay: { text: "", file: null },
      questionnaire: {
        fullName: "",
        birthDate: "",
        telegram: "",
        city: "",
        phone: "",
        aiAnswers: [],
      },
      video: { link: "", videoFile: null },
      certs: { ent: null, ielts: null, sat: null, extra: null },
    });
    
    const handleEssayFileChange = async (file: File | null) => {
  if (!file) {
    setFormData((prev) => ({
      ...prev,
      essay: {
        ...prev.essay,
        file: null,
        text: "",
      },
    }));
    return;
  }

  try {
    setEssayParsing(true);

    setFormData((prev) => ({
      ...prev,
      essay: {
        ...prev.essay,
        file,
      },
    }));

    const parsed = await parseEssayFile(file);

    setFormData((prev) => ({
      ...prev,
      essay: {
        ...prev.essay,
        file,
        text: parsed.text || "",
      },
    }));

    setErrors((prev) => {
      const next = { ...prev };
      delete next.essay;
      return next;
    });
  } catch (error: any) {
    console.error("essay parse error:", error);
    alert(error?.message || "Не удалось прочитать файл эссе");

    setFormData((prev) => ({
      ...prev,
      essay: {
        ...prev.essay,
        file: null,
        text: "",
      },
    }));
  } finally {
    setEssayParsing(false);
  }
};

    const loadApplications = async () => {
    try {
      const res = await fetch("/api/applications/me", {
        credentials: "include",
      });

      const data = await res.json();

      const mapped = (data.applications || []).map((app: any) => {
        const certMap: UploadedCerts = {
          ent: null,
          ielts: null,
          sat: null,
          extra: null,
        };

        for (const cert of app.certificates || []) {
          if (cert.certType === "ENT") certMap.ent = cert.fileKey;
          if (cert.certType === "IELTS") certMap.ielts = cert.fileKey;
          if (cert.certType === "SAT") certMap.sat = cert.fileKey;
          if (cert.certType === "EXTRA") certMap.extra = cert.fileKey;
        }

        return {
          id: app.id,
          submittedAt: app.submittedAt || app.createdAt,
          status:
            app.status === "ACCEPTED"
              ? "accepted"
              : app.status === "REJECTED"
              ? "rejected"
              : "review",
          essay: app.essaySubmission?.essayText || "",
          answers: (app.answers || []).map((a: any) => ({
            q: a.questionText,
            a: a.answerText,
          })),
          video:
            app.videoSubmission?.videoUrl ||
            app.videoSubmission?.fileKey ||
            "",
          certs: certMap,
        };
      });

      setApplications(mapped);
    } catch (error) {
      console.error("applications load error:", error);
    }
  };

  const startInterview = async () => {
    try {
      if (!formData.essay.text.trim()) {
        alert("Сначала заполните эссе");
        return;
      }

      setInterviewLoading(true);
      setInterviewStarted(false);
      setInterviewCompleted(false);

      const userId = localStorage.getItem("userId") || "anonymous";

      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidate_id: userId,
          essay: formData.essay.text,
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(data.error || "Ошибка отправки");
      }

      if (!res.ok) {
        throw new Error(data.error || "Не удалось начать интервью");
      }

      setInterviewSessionId(data.session_id);
      setCurrentInterviewQuestion(
        data.next_question?.text ?? "Расскажите подробнее о себе."
      );
      setInterviewStarted(true);
      setInterviewCompleted(data.status === "complete");
    } catch (error) {
      console.error("startInterview error:", error);
      alert("Ошибка при запуске AI-интервью");
    } finally {
      setInterviewLoading(false);
    }
  };

  const submitInterviewAnswer = async (answerText: string) => {
  try {
    if (!interviewSessionId) {
      alert("Сессия интервью не найдена");
      return;
    }

    setInterviewLoading(true);

    const questionText = currentInterviewQuestion;

    const res = await fetch("/api/interview/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: interviewSessionId,
        answer: answerText,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Не удалось отправить ответ");
    }

    setFormData((prev) => ({
      ...prev,
      questionnaire: {
        ...prev.questionnaire,
        aiAnswers: [
          ...prev.questionnaire.aiAnswers,
          { q: questionText, a: answerText },
        ],
      },
    }));

    if (data.status === "complete") {
      setInterviewCompleted(true);
      setCurrentInterviewQuestion("");
      return;
    }

    setCurrentInterviewQuestion(data.next_question?.text || "");
  } catch (error) {
    console.error("submitInterviewAnswer error:", error);
    alert("Ошибка при отправке ответа");
  } finally {
    setInterviewLoading(false);
  }
};

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setUserName(
          data.user?.fullName || data.user?.email?.split("@")[0] || "User"
        );
      })
      .catch((error) => {
        console.error("me error:", error);
        setUserName("User");
      });
  }, []);

  const lastSubmit = applications[0]?.submittedAt
    ? new Date(applications[0].submittedAt)
    : null;

  const canSubmitNew = true;
    // !lastSubmit ||
    // Date.now() - lastSubmit.getTime() > 2 * 24 * 60 * 60 * 1000;

  const nextAllowedDate = lastSubmit
    ? new Date(lastSubmit.getTime() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString(
        "ru-RU",
        { day: "numeric", month: "long" }
      )
    : null;

       const handleSubmit = async () => {
        if (isSubmitting || submitted) return;

        try {
          setIsSubmitting(true);

          if (!validateForm()) {
            return;
          }

          let essayFileKey: string | null = null;
          let videoFileKey: string | null = null;
          let entKey: string | null = null;
          let ieltsKey: string | null = null;
          let satKey: string | null = null;
          let extraKey: string | null = null;

          if (formData.essay.file) {
            essayFileKey = await uploadFile(formData.essay.file);
          }

          if (formData.video.videoFile) {
            videoFileKey = await uploadFile(formData.video.videoFile);
          }

          if (formData.certs.ent) {
            entKey = await uploadFile(formData.certs.ent);
          }

          if (formData.certs.ielts) {
            ieltsKey = await uploadFile(formData.certs.ielts);
          }

          if (formData.certs.sat) {
            satKey = await uploadFile(formData.certs.sat);
          }

          if (formData.certs.extra) {
            extraKey = await uploadFile(formData.certs.extra);
          }

          const payload = {
            essay: {
              text: formData.essay.text,
              file: essayFileKey,
            },
            questionnaire: formData.questionnaire,
            video: {
              link: formData.video.link,
              videoFile: videoFileKey,
            },
            certs: {
              ent: entKey,
              ielts: ieltsKey,
              sat: satKey,
              extra: extraKey,
            },
          };

          const res = await fetch("/api/applications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(payload),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || "Ошибка отправки");
          }

          await loadApplications();
          setSubmitted(true);
        } catch (error: any) {
          console.error("submit error:", error);
          alert(error?.message || "Ошибка при отправке заявки");
        } finally {
          setIsSubmitting(false);
        }
      };


  return (
    <div className="min-h-screen bg-white font-sans">
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-black">inVision</span>
            <span className="text-xl font-bold text-[#CDFF00]">U</span>
            <span className="text-[10px] text-gray-400 ml-1 leading-tight hidden sm:block">
              Initiative of Arsen Tomsky
              <br />
              powered by inDrive
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-4 py-2">
              <div className="w-6 h-6 rounded-full bg-[#CDFF00] flex items-center justify-center">
                <span className="text-[10px] font-black text-black">А</span>
              </div>
              <span className="text-sm font-semibold text-black">
                {userName}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-20 px-4 md:px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl md:text-5xl font-black text-black mb-2 leading-tight">
              Мои заявки
            </h1>
            <p className="text-gray-500 text-lg">
              Заполни заявку на поступление и отслеживай её статус
            </p>
          </div>

          <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
            <div>
              {!canSubmitNew && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3 mb-6">
                  <svg
                    className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-amber-800">
                      Новую заявку можно подать с {nextAllowedDate}
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Между заявками должно пройти не менее 2 дней
                    </p>
                  </div>
                </div>
              )}

              <div
                  className={`rounded-3xl border border-gray-100 bg-white overflow-hidden shadow-sm ${
                    !canSubmitNew || submitted || isSubmitting
                      ? "opacity-70 pointer-events-none select-none"
                      : ""
                  }`}
                >
                <div className="border-b border-gray-100 px-6 pt-6">
                  <div className="flex gap-0 overflow-x-auto">
                    {TABS.map((tab, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveTab(i)}
                        className={`relative px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all
                          ${
                            activeTab === i
                              ? "text-black"
                              : "text-gray-400 hover:text-gray-700"
                          }`}
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center flex-shrink-0
                            ${
                              activeTab === i
                                ? "bg-[#CDFF00] text-black"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {i + 1}
                          </span>
                          {tab}
                        </span>
                        {activeTab === i && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 md:p-8">
                  {activeTab === 0 && (
                   <EssaySection
                      data={formData.essay}
                      onChange={(d) =>
                        setFormData((f) => ({ ...f, essay: d }))
                      }
                      onFileChange={handleEssayFileChange}
                      readOnly={submitted || !canSubmitNew}
                      parsing={essayParsing}
                    />
                  )}

                  {activeTab === 1 && (
                    <QuestionnaireSection
                      data={formData.questionnaire}
                      onChange={(d) =>
                        setFormData((f) => ({ ...f, questionnaire: d }))
                      }
                      readOnly={submitted || !canSubmitNew}
                      essayText={formData.essay.text}
                      essayParsing={essayParsing}
                      interviewStarted={interviewStarted}
                      interviewCompleted={interviewCompleted}
                      currentQuestion={currentInterviewQuestion}
                      interviewLoading={interviewLoading}
                      onStartInterview={startInterview}
                      onSubmitInterviewAnswer={submitInterviewAnswer}
                    />
                  )}

                  {activeTab === 2 && (
                    <VideoSection
                      data={formData.video}
                      onChange={(d) =>
                        setFormData((f) => ({ ...f, video: d }))
                      }
                      readOnly={submitted || !canSubmitNew}
                    />
                  )}

                  {activeTab === 3 && (
                    <CertificatesSection
                      data={formData.certs}
                      onChange={(d) =>
                        setFormData((f) => ({ ...f, certs: d }))
                      }
                      readOnly={submitted || !canSubmitNew}
                    />
                  )}
                </div>

                <div className="px-6 md:px-8 py-5 border-t border-gray-100 flex items-center justify-between gap-4">
                  <div className="flex gap-2">
                    {activeTab > 0 && (
                      <button
                        onClick={() => setActiveTab((t) => t - 1)}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-black hover:bg-gray-50 transition-all"
                      >
                        ← Назад
                      </button>
                    )}
                    {activeTab < TABS.length - 1 && (
                      <button
                        onClick={() => setActiveTab((t) => t + 1)}
                        className="px-4 py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-black hover:bg-gray-200 transition-all"
                      >
                        Далее →
                      </button>
                    )}
                  </div>

                 {activeTab === TABS.length - 1 && !submitted && canSubmitNew && (
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || essayParsing || interviewLoading}
                      className="bg-black text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {isSubmitting ? "Отправка..." : "Сдать заявку"}

                      {!isSubmitting && (
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  )}

                  {submitted && (
                    <div className="flex items-center gap-2 bg-[#CDFF00] rounded-xl px-4 py-2.5">
                      <svg
                        className="w-4 h-4 text-black"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm font-bold text-black">
                        Заявка отправлена
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-black">
                  Отправленные заявки
                </h2>
                <span className="text-xs text-gray-400 font-semibold bg-gray-100 rounded-full px-3 py-1">
                  {applications.length}
                </span>
              </div>

              {applications.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-gray-200 p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-7 h-7 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-black font-bold mb-1">Заявок пока нет</p>
                  <p className="text-gray-400 text-sm">
                    Заполните форму слева и отправьте первую заявку
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      onOpen={setViewApp}
                    />
                  ))}
                </div>
              )}

              <div className="mt-6 rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Статусы
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status="review" />
                    <span className="text-xs text-gray-500">
                      Заявка на проверке у команды
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status="accepted" />
                    <span className="text-xs text-gray-500">
                      Поздравляем! Вы приняты
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status="rejected" />
                    <span className="text-xs text-gray-500">
                      Заявка не прошла отбор
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {viewApp && (
        <ApplicationViewer app={viewApp} onClose={() => setViewApp(null)} />
      )}
    </div>
  );
}