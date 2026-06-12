import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/17-HI_4j8FWLM0XH6GwyT0sU2OQ_-F8vb?usp=drive_link";

function getCandidateDirectories() {
  const cwd = process.cwd();
  const projectRoot = path.resolve(cwd);
  const parentRoot = path.resolve(projectRoot, "..");

  return [
    path.join(projectRoot, "crypto_analysis_output"),
    path.join(parentRoot, "crypto_analysis_output"),
    path.join(projectRoot, "..", "crypto_analysis_output"),
  ];
}

function extractFolderId(input: string) {
  const normalized = input.trim();
  if (!normalized) return null;

  const folderMatch = normalized.match(/\/folders\/([^/?]+)/);
  if (folderMatch?.[1]) return decodeURIComponent(folderMatch[1]);

  const idMatch = normalized.match(/[?&]id=([^&]+)/);
  if (idMatch?.[1]) return decodeURIComponent(idMatch[1]);

  return null;
}

async function discoverDriveFiles(folderUrl: string) {
  const folderId = extractFolderId(folderUrl);
  if (!folderId) {
    return { files: [], message: "No se pudo extraer el ID de la carpeta." };
  }

  const pageUrl = `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;

  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      return { files: [], message: "La carpeta de Google Drive no respondió correctamente." };
    }

    const html = await response.text();
    const matches = Array.from(new Set(html.matchAll(/\/file\/d\/([^/]+)/g)));

    const files = matches
      .map((match) => match[1])
      .filter(Boolean)
      .map((fileId) => ({
        name: `Archivo ${fileId.slice(0, 8)}`,
        path: `https://drive.google.com/uc?export=download&id=${fileId}`,
      }))
      .slice(0, 50);

    if (files.length > 0) {
      return { files, message: null };
    }

    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (apiKey) {
      const apiUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&fields=files(id,name,mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${apiKey}`;
      const apiResponse = await fetch(apiUrl);
      if (apiResponse.ok) {
        const apiPayload = (await apiResponse.json()) as { files?: Array<{ id: string; name: string }> };
        const apiFiles = (apiPayload.files ?? [])
          .filter((file) => file.id)
          .map((file) => ({
            name: file.name,
            path: `https://drive.google.com/uc?export=download&id=${file.id}`,
          }));

        if (apiFiles.length > 0) {
          return { files: apiFiles, message: null };
        }
      }
    }

    return {
      files: [],
      message: "La carpeta es pública, pero Google Drive no devolvió la lista de archivos en este entorno. Puedes pegar enlaces directos de archivos CSV para cargarlos.",
    };
  } catch {
    return {
      files: [],
      message: "No se pudo leer la carpeta desde Google Drive en este momento.",
    };
  }
}

export async function GET(request: NextRequest) {
  const requestedUrl = request.nextUrl.searchParams.get("url") ?? DEFAULT_DRIVE_FOLDER_URL;

  const { files: driveFiles, message } = await discoverDriveFiles(requestedUrl);
  if (driveFiles.length > 0) {
    return NextResponse.json({
      directory: requestedUrl,
      files: driveFiles,
      count: driveFiles.length,
      source: "google-drive-folder",
      message,
    });
  }

  const candidates = getCandidateDirectories();

  for (const directory of candidates) {
    try {
      const stats = await fs.stat(directory);
      if (!stats.isDirectory()) {
        continue;
      }

      const entries = await fs.readdir(directory, { withFileTypes: true });
      const csvFiles = entries
        .filter((entry) => entry.isFile() && /\.csv$/i.test(entry.name))
        .map((entry) => ({
          name: entry.name,
          path: path.join(directory, entry.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return NextResponse.json({
        directory,
        files: csvFiles,
        count: csvFiles.length,
        source: "local-folder",
        message: message ?? null,
      });
    } catch {
      // Continue searching other candidate paths.
    }
  }

  return NextResponse.json({
    directory: null,
    files: [],
    count: 0,
    source: "none",
    message: message ?? "No se encontraron archivos CSV.",
  });
}
