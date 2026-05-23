/**
 * Sistema de Compressão de Mídia Automática (Client-Side)
 * Projetado para otimizar imagens, avatars e vídeos antes do upload.
 */

interface ImageCompressOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'image/webp' | 'image/jpeg';
}

interface VideoCompressOptions {
  maxBitrate?: number; // em bits por segundo (ex: 1500000 para 1.5 Mbps)
  targetWidth?: number;
  targetHeight?: number;
}

/**
 * Comprime uma imagem utilizando HTML5 Canvas e converte para WebP (ou JPEG).
 */
export async function compressImage(
  file: File,
  options: ImageCompressOptions = {}
): Promise<File> {
  const {
    quality = 0.80,
    maxWidth = 1600,
    maxHeight = 1600,
    format = 'image/webp'
  } = options;

  // Se a imagem for muito pequena (menos de 100KB), não há necessidade de comprimir
  if (file.size < 100 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onerror = (err) => reject(err);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onerror = (err) => reject(err);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calcular novas dimensões mantendo o aspect ratio
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Não foi possível obter o contexto 2D do Canvas'));
        }

        // Desenhar imagem no Canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Exportar para WebP/JPEG com a qualidade definida
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Erro ao converter Canvas para Blob'));
            }

            // Gerar o novo nome do arquivo com a extensão correta
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const extension = format === 'image/webp' ? 'webp' : 'jpg';
            const newName = `${baseName}.${extension}`;

            const compressedFile = new File([blob], newName, {
              type: format,
              lastModified: Date.now()
            });

            // Se por algum motivo o arquivo comprimido ficou maior que o original, usa o original
            if (compressedFile.size >= file.size) {
              resolve(file);
            } else {
              resolve(compressedFile);
            }
          },
          format,
          quality
        );
      };
    };
  });
}

/**
 * Comprime um vídeo utilizando Canvas para redimensionamento de frames e MediaRecorder
 * com limitação de bitrate de áudio/vídeo.
 */
export async function compressVideo(
  file: File,
  onProgress?: (percent: number) => void,
  options: VideoCompressOptions = {}
): Promise<File | Blob> {
  // A compressão de vídeo client-side (Canvas + MediaRecorder) causa problemas severos:
  // 1. Perda de sincronia de áudio ou áudio mudo.
  // 2. Frames pretos no início do vídeo.
  // 3. Perda de metadados de orientação (vídeos verticais de celular ficam horizontais).
  // Como a aplicação já possui um limite seguro de 50MB no upload, 
  // bypassamos a compressão local para garantir a qualidade e integridade do arquivo original.
  
  if (onProgress) {
    onProgress(100);
  }
  return Promise.resolve(file);
}
