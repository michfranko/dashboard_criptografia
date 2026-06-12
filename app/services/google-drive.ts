export function buildGoogleDriveDownloadUrl(input: string): string | null {
  const normalized = input.trim();

  if (!normalized) {
    return null;
  }

  const idMatch = normalized.match(/[?&]id=([^&]+)/);
  if (idMatch?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${decodeURIComponent(idMatch[1])}`;
  }

  const pathMatch = normalized.match(/\/d\/([^/?]+)/);
  if (pathMatch?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${decodeURIComponent(pathMatch[1])}`;
  }

  return null;
}

export async function fetchGoogleDriveCsv(input: string) {
  const downloadUrl = buildGoogleDriveDownloadUrl(input);

  if (!downloadUrl) {
    throw new Error("No se pudo detectar el ID del archivo desde el enlace compartido.");
  }

  const response = await fetch(`/api/drive-csv?url=${encodeURIComponent(input)}`);

  if (!response.ok) {
    throw new Error("No fue posible cargar el archivo desde Google Drive.");
  }

  const payload = await response.json();

  return payload;
}
