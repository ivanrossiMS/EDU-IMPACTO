/**
 * Utilitário puro e isomórfico (compatível tanto com Server Components/Route Handlers quanto Client Components).
 * Não deve conter diretiva 'use client' para que possa ser importado com segurança no ambiente servidor do Next.js / React 19.
 */
export function resolveMimeType(fileName: string, currentType?: string): string {
  if (currentType && currentType !== 'application/octet-stream' && currentType.trim() !== '') {
    return currentType
  }

  const ext = fileName.toLowerCase().split('.').pop() || ''
  const mimeMap: Record<string, string> = {
    // Imagens
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    heic: 'image/heic',
    heif: 'image/heif',
    ico: 'image/x-icon',
    tiff: 'image/tiff',
    tif: 'image/tiff',

    // Vídeos
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    m4v: 'video/x-m4v',
    '3gp': 'video/3gpp',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    ogv: 'video/ogg',

    // Áudio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',

    // Documentos e Planilhas
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed'
  }

  return mimeMap[ext] || 'application/octet-stream'
}
