/**
 * Sistema de Compressão de Mídia Automática (Client-Side)
 * Projetado para otimizar imagens, avatars, PDFs e vídeos antes do upload.
 */

import { PDFDocument, PDFRawStream, PDFName, PDFNumber, PDFArray, decodePDFRawStream } from 'pdf-lib';

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
 * Adapta a resolução e a qualidade dinamicamente com base no tamanho do arquivo.
 */
export async function compressImage(
  file: File,
  options: ImageCompressOptions = {}
): Promise<File> {
  const fileSize = file.size;
  let quality = options.quality;
  let maxWidth = options.maxWidth;
  let maxHeight = options.maxHeight;
  const format = options.format || 'image/webp';

  // Se a imagem for WebP e for menor que 100KB, não precisa comprimir mais
  if (fileSize < 100 * 1024 && file.type === 'image/webp') {
    return file;
  }

  // Definição de qualidade e dimensões baseadas nas regras do usuário
  if (quality === undefined || maxWidth === undefined || maxHeight === undefined) {
    if (fileSize > 5 * 1024 * 1024) { // > 5MB
      if (quality === undefined) quality = 0.50;
      if (maxWidth === undefined) maxWidth = 1600;
      if (maxHeight === undefined) maxHeight = 1600;
    } else if (fileSize > 1 * 1024 * 1024) { // 1MB - 5MB
      if (quality === undefined) quality = 0.60;
      if (maxWidth === undefined) maxWidth = 1920;
      if (maxHeight === undefined) maxHeight = 1920;
    } else { // < 1MB
      if (quality === undefined) quality = 0.80;
      if (maxWidth === undefined) maxWidth = 2048;
      if (maxHeight === undefined) maxHeight = 2048;
    }
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
        if (width > maxWidth! || height > maxHeight!) {
          if (width > height) {
            height = Math.round((height * maxWidth!) / width);
            width = maxWidth!;
          } else {
            width = Math.round((width * maxHeight!) / height);
            height = maxHeight!;
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
 * Comprime bytes de imagens JPEG incorporados dentro de arquivos PDF.
 */
async function compressJpegBytes(
  jpegBytes: Uint8Array,
  originalWidth: number,
  originalHeight: number,
  maxDimension = 1200,
  quality = 0.65
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([jpegBytes as any], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        let width = originalWidth || img.width;
        let height = originalHeight || img.height;

        // Redimensiona mantendo proporções se exceder a dimensão máxima
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            try {
              const arr = await blob.arrayBuffer();
              resolve({
                bytes: new Uint8Array(arr),
                width,
                height
              });
            } catch {
              resolve(null);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
    } catch (e) {
      resolve(null);
    }
  });
}

function drawRawPixelsToCanvas(
  rawBytes: Uint8Array,
  width: number,
  height: number,
  colorSpace: string
): HTMLCanvasElement | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imgData = ctx.createImageData(width, height);
    
    if (colorSpace === 'DeviceRGB' || colorSpace === '/DeviceRGB') {
      if (rawBytes.length >= width * height * 3) {
        for (let j = 0, k = 0; k < imgData.data.length; j += 3, k += 4) {
          imgData.data[k] = rawBytes[j];     // R
          imgData.data[k+1] = rawBytes[j+1]; // G
          imgData.data[k+2] = rawBytes[j+2]; // B
          imgData.data[k+3] = 255;            // A (Opaque)
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas;
      }
    } else if (colorSpace === 'DeviceGray' || colorSpace === '/DeviceGray') {
      if (rawBytes.length >= width * height) {
        for (let j = 0, k = 0; k < imgData.data.length; j++, k += 4) {
          const val = rawBytes[j];
          imgData.data[k] = val;   // R
          imgData.data[k+1] = val; // G
          imgData.data[k+2] = val; // B
          imgData.data[k+3] = 255; // A
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas;
      }
    }
  } catch (e) {
    console.warn('Failed to draw raw pixels to canvas:', e);
  }
  return null;
}

function resizeCanvas(
  sourceCanvas: HTMLCanvasElement,
  maxDimension = 1200
): HTMLCanvasElement {
  let width = sourceCanvas.width;
  let height = sourceCanvas.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const destCanvas = document.createElement('canvas');
  destCanvas.width = width;
  destCanvas.height = height;
  const ctx = destCanvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  }
  return destCanvas;
}

async function compressFlateImage(
  obj: PDFRawStream,
  width: number,
  height: number,
  colorSpace: string,
  maxDimension = 1200,
  quality = 0.65
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  return new Promise((resolve) => {
    try {
      const rawBytes = decodePDFRawStream(obj).decode();
      const sourceCanvas = drawRawPixelsToCanvas(rawBytes, width, height, colorSpace);
      if (!sourceCanvas) {
        resolve(null);
        return;
      }

      const finalCanvas = resizeCanvas(sourceCanvas, maxDimension);
      
      finalCanvas.toBlob(
        async (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          try {
            const arr = await blob.arrayBuffer();
            resolve({
              bytes: new Uint8Array(arr),
              width: finalCanvas.width,
              height: finalCanvas.height
            });
          } catch {
            resolve(null);
          }
        },
        'image/jpeg',
        quality
      );
    } catch (e) {
      console.warn('Error compressing Flate image:', e);
      resolve(null);
    }
  });
}

/**
 * Otimiza e comprime um arquivo PDF client-side.
 * Reduz a resolução de imagens embutidas (JPEG e FlateDecode) e comprime a estrutura (lossless).
 */
export async function compressPDF(
  file: File,
  onProgress?: (percent: number) => void
): Promise<File> {
  try {
    if (onProgress) onProgress(5);

    // Se for menor que 300KB, não há necessidade de otimizar
    if (file.size < 300 * 1024) {
      if (onProgress) onProgress(100);
      return file;
    }

    const arrayBuffer = await file.arrayBuffer();
    if (onProgress) onProgress(15);

    const pdfDoc = await PDFDocument.load(arrayBuffer);
    if (onProgress) onProgress(35);

    const indirectObjects = pdfDoc.context.enumerateIndirectObjects();
    const imagesToCompress: Array<{ ref: any; obj: any; width: number; height: number; isFlate: boolean; colorSpace: string }> = [];

    // Localiza todas as imagens embutidas do tipo DCTDecode (JPEG) ou FlateDecode (PNG/Bitmap)
    for (const [ref, obj] of indirectObjects) {
      if (obj instanceof PDFRawStream) {
        const dict = obj.dict;
        if (
          dict.get(PDFName.of('Type')) === PDFName.of('XObject') &&
          dict.get(PDFName.of('Subtype')) === PDFName.of('Image')
        ) {
          const filter = dict.get(PDFName.of('Filter'));
          
          let isDCT = false;
          let isFlate = false;

          // Verifica o filtro
          if (filter === PDFName.of('DCTDecode')) {
            isDCT = true;
          } else if (filter === PDFName.of('FlateDecode')) {
            isFlate = true;
          } else if (filter instanceof PDFArray) {
            for (let i = 0; i < filter.size(); i++) {
              const f = filter.get(i);
              if (f === PDFName.of('DCTDecode')) {
                isDCT = true;
              } else if (f === PDFName.of('FlateDecode')) {
                isFlate = true;
              }
            }
          }

          // Para FlateDecode, filtramos apenas ColorSpaces e BPC suportados
          let colorSpaceStr = '';
          if (isFlate) {
            const cs = dict.get(PDFName.of('ColorSpace'));
            if (cs === PDFName.of('DeviceRGB')) {
              colorSpaceStr = 'DeviceRGB';
            } else if (cs === PDFName.of('DeviceGray')) {
              colorSpaceStr = 'DeviceGray';
            } else {
              isFlate = false; // Desconsidera se for outro color space (ex: Indexed, CMYK)
            }

            const bpcObj = dict.get(PDFName.of('BitsPerComponent'));
            let bpc = 0;
            if (bpcObj instanceof PDFNumber) bpc = bpcObj.asNumber();
            if (bpc !== 8) {
              isFlate = false; // Apenas imagens de 8 bits
            }
          }

          if (isDCT || isFlate) {
            const widthObj = dict.get(PDFName.of('Width'));
            const heightObj = dict.get(PDFName.of('Height'));
            let width = 0;
            let height = 0;
            if (widthObj instanceof PDFNumber) width = widthObj.asNumber();
            if (heightObj instanceof PDFNumber) height = heightObj.asNumber();

            if (width > 0 && height > 0) {
              imagesToCompress.push({ ref, obj, width, height, isFlate, colorSpace: colorSpaceStr });
            }
          }
        }
      }
    }

    if (onProgress) onProgress(50);

    // Limitamos o número de imagens processadas para evitar OOM no navegador
    const maxPdfImages = 15;
    const imagesToProcess = imagesToCompress.slice(0, maxPdfImages);

    // Otimiza as imagens sequencialmente
    for (let i = 0; i < imagesToProcess.length; i++) {
      const { ref, obj, width, height, isFlate, colorSpace } = imagesToProcess[i];
      try {
        let result: { bytes: Uint8Array; width: number; height: number } | null = null;
        
        if (isFlate) {
          result = await compressFlateImage(obj, width, height, colorSpace, 1200, 0.65);
        } else {
          const originalBytes = decodePDFRawStream(obj).decode();
          result = await compressJpegBytes(originalBytes, width, height, 1200, 0.65);
        }

        if (result && result.bytes.length < obj.contents.length) {
          // Atualiza as dimensões e o tamanho no dicionário original
          obj.dict.set(PDFName.of('Width'), pdfDoc.context.obj(result.width));
          obj.dict.set(PDFName.of('Height'), pdfDoc.context.obj(result.height));
          obj.dict.set(PDFName.of('Length'), pdfDoc.context.obj(result.bytes.length));
          
          // Se for Flate, mudamos o filtro para DCTDecode e o color space para DeviceRGB (saída do JPEG)
          if (isFlate) {
            obj.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
            obj.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
          } else {
            obj.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
          }
          
          // Substitui o stream original pelo novo stream comprimido
          const newStream = PDFRawStream.of(obj.dict, result.bytes);
          pdfDoc.context.assign(ref, newStream);
        }
      } catch (e) {
        console.warn('Erro ao otimizar imagem embutida no PDF index ' + i, e);
      }

      if (onProgress) {
        const subPercent = 50 + Math.round(((i + 1) / imagesToProcess.length) * 40);
        onProgress(subPercent);
      }
    }

    if (onProgress) onProgress(90);

    // Salva o PDF utilizando object streams comprimidos (lossless estrutural)
    const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
    
    const compressedFile = new File([compressedBytes as any], file.name, {
      type: 'application/pdf',
      lastModified: Date.now()
    });

    if (onProgress) onProgress(100);

    if (compressedFile.size < file.size) {
      console.log(`[PDF Optimizer] PDF reduzido de ${file.size} para ${compressedFile.size} bytes`);
      return compressedFile;
    }
    return file;
  } catch (error) {
    console.warn('[PDF Optimizer] Erro na otimização de PDF, usando original:', error);
    if (onProgress) onProgress(100);
    return file;
  }
}

/**
 * Comprime um vídeo utilizando a MediaStream Capture API e o MediaRecorder nativo.
 * Transcodifica o vídeo em tempo real acelerado (1.5x) limitando a taxa de bits.
 */
export async function compressVideo(
  file: File,
  onProgress?: (percent: number) => void,
  options: VideoCompressOptions = {}
): Promise<File | Blob> {
  // Reduzido o limite para 100KB para comprimir qualquer vídeo
  if (file.size < 100 * 1024) {
    if (onProgress) onProgress(100);
    return file;
  }

  return new Promise((resolve) => {
    let video: HTMLVideoElement | null = null;
    let progressInterval: NodeJS.Timeout | null = null;
    let recorder: MediaRecorder | null = null;

    const cleanup = () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      if (video) {
        try {
          video.pause();
        } catch {}
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
        URL.revokeObjectURL(video.src);
      }
    };

    try {
      const videoElement = document.createElement('video');
      video = videoElement; // Atribui para acesso no cleanup se necessário
      
      videoElement.style.position = 'fixed';
      videoElement.style.top = '-10000px';
      videoElement.style.left = '-10000px';
      videoElement.style.width = '100px';
      videoElement.style.height = '100px';
      videoElement.style.opacity = '0';
      videoElement.style.pointerEvents = 'none';
      
      document.body.appendChild(videoElement); // Inserido no DOM para forçar decodificação em segundo plano

      videoElement.src = URL.createObjectURL(file);
      videoElement.muted = true;
      videoElement.playsInline = true;

      videoElement.onloadedmetadata = () => {
        let duration = videoElement.duration;
        
        // Se a duração for inválida ou infinita, tentamos estimar ou usar um valor seguro
        if (isNaN(duration) || !isFinite(duration)) {
          duration = 10; // Fallback
        }

        // Se o vídeo for maior que 600 segundos (10 minutos), cancelamos a compressão para evitar esperas longas
        if (duration > 600) {
          console.log('[Video Compressor] Vídeo longo (>60s). Ignorando compressão por performance.');
          cleanup();
          if (onProgress) onProgress(100);
          resolve(file);
          return;
        }

        const stream = (videoElement as any).captureStream ? (videoElement as any).captureStream() : (videoElement as any).mozCaptureStream ? (videoElement as any).mozCaptureStream() : null;
        if (!stream) {
          console.log('[Video Compressor] O navegador não suporta captureStream. Mantendo original.');
          cleanup();
          if (onProgress) onProgress(100);
          resolve(file);
          return;
        }

        // Seleção inteligente do codec suportado
        let mimeType = '';
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
          mimeType = 'video/mp4;codecs=avc1';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          mimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          mimeType = 'video/webm;codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        }

        const recorderOptions = {
          mimeType,
          videoBitsPerSecond: options.maxBitrate || 1000000 // 1.0 Mbps
        };

        try {
          recorder = new MediaRecorder(stream, recorderOptions);
        } catch (e) {
          console.warn('[Video Compressor] Erro ao criar MediaRecorder com opções, tentando padrão:', e);
          try {
            recorder = new MediaRecorder(stream);
          } catch (err2) {
            cleanup();
            if (onProgress) onProgress(100);
            resolve(file);
            return;
          }
        }

        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          const finalMime = recorder?.mimeType || mimeType || 'video/webm';
          const compressedBlob = new Blob(chunks, { type: finalMime });
          
          const ext = finalMime.includes('mp4') ? '.mp4' : '.webm';
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const newName = `${baseName}_comprimido${ext}`;

          const compressedFile = new File([compressedBlob as any], newName, {
            type: finalMime,
            lastModified: Date.now()
          });

          cleanup();

          if (compressedFile.size < file.size && compressedFile.size > 1024) {
            console.log(`[Video Compressor] Vídeo reduzido de ${file.size} para ${compressedFile.size} bytes`);
            resolve(compressedFile);
          } else {
            console.log(`[Video Compressor] Arquivo comprimido (${compressedFile.size}) não é menor que original (${file.size}). Mantendo original.`);
            resolve(file);
          }
        };

        recorder.start();
        videoElement.playbackRate = 1.5; // Aceleração segura para transcodificação de frame rate estável
        
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[Video Compressor] Falha ao iniciar play do vídeo:', err);
            cleanup();
            if (onProgress) onProgress(100);
            resolve(file);
          });
        }

        progressInterval = setInterval(() => {
          if (videoElement.ended || videoElement.currentTime >= duration) {
            clearInterval(progressInterval!);
            try { recorder?.stop(); } catch {}
            if (onProgress) onProgress(100);
          } else {
            const percent = Math.min(99, Math.round((videoElement.currentTime / duration) * 100));
            if (onProgress) onProgress(percent);
          }
        }, 250);

        videoElement.onerror = () => {
          cleanup();
          resolve(file);
        };
      };

      videoElement.onerror = () => {
        cleanup();
        resolve(file);
      };

    } catch (e) {
      console.warn('[Video Compressor] Erro geral no fluxo do vídeo:', e);
      cleanup();
      resolve(file);
    }
  });
}
