import { NextRequest, NextResponse } from "next/server";
const pdf = require("pdf-parse");
const mammoth = require("mammoth");

export const runtime = "nodejs";

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\u0000/g, "")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();

    if (
      !fileName.endsWith(".pdf") &&
      !fileName.endsWith(".docx") &&
      !fileName.endsWith(".doc")
    ) {
      return NextResponse.json(
        { error: "Поддерживаются только .pdf, .docx, .doc" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = "";

    if (fileName.endsWith(".pdf")) {
      const parsed = await pdf(buffer);
      extractedText = parsed.text || "";
    } else if (fileName.endsWith(".docx")) {
      const parsed = await mammoth.extractRawText({ buffer });
      extractedText = parsed.value || "";
    } else if (fileName.endsWith(".doc")) {
      return NextResponse.json(
        {
          error:
            "Формат .doc пока не поддерживается. Сохраните файл как .docx или .pdf",
        },
        { status: 400 }
      );
    }

    extractedText = normalizeText(extractedText);

    if (!extractedText) {
      return NextResponse.json(
        { error: "Не удалось извлечь текст из файла" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      text: extractedText,
      wordCount: extractedText.split(/\s+/).filter(Boolean).length,
      charCount: extractedText.length,
      fileName: file.name,
    });
  } catch (error) {
    console.error("essay parse error:", error);
    return NextResponse.json(
      { error: "Ошибка при чтении файла эссе" },
      { status: 500 }
    );
  }
}