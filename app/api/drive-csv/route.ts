import { NextRequest, NextResponse } from "next/server";

function extractDriveFileId(input: string): string | null {
  const normalized = input.trim();

  if (!normalized) {
    return null;
  }

  const idMatch = normalized.match(/[?&]id=([^&]+)/);
  if (idMatch?.[1]) {
    return decodeURIComponent(idMatch[1]);
  }

  const pathMatch = normalized.match(/\/d\/([^/?]+)/);
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]);
  }

  return null;
}

function buildDownloadUrl(input: string): string | null {
  const fileId = extractDriveFileId(input);

  if (!fileId) {
    return null;
  }

  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  const idParam = request.nextUrl.searchParams.get("id");
  const input = urlParam ?? idParam ?? "";

  if (!input) {
    return NextResponse.json(
      { error: "Se requiere un enlace compartido o el ID del archivo de Google Drive." },
      { status: 400 },
    );
  }

  const downloadUrl = buildDownloadUrl(input);

  if (!downloadUrl) {
    return NextResponse.json(
      { error: "No se pudo detectar el ID del archivo desde el enlace proporcionado." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(downloadUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "No fue posible descargar el archivo desde Google Drive." },
        { status: 502 },
      );
    }

    const text = await response.text();

    return NextResponse.json({
      source: downloadUrl,
      data: text,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Ocurrió un error al intentar leer el archivo desde Google Drive.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}