/**
 * Sistema de Compressão de Mídia Automática (Client-Side)
 * Projetado para otimizar imagens, avatars, PDFs e vídeos antes do upload.
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
 * Formata bytes em formato legível (ex: 350 KB, 14.2 MB)
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Extrai o frame (aos 0.5s ou início) de um arquivo de vídeo para thumbnail
 */
export async function extractVideoThumbnail(file: File): Promise<{ thumbnailUrl: string; duration: number }> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.src = url;

      let resolved = false;
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          URL.revokeObjectURL(url);
          try { video.remove(); } catch {}
        }
      };

      const triggerSeek = () => {
        try {
          const targetTime = Math.max(0.1, Math.min(0.5, (video.duration || 1) / 2));
          if (Math.abs(video.currentTime - targetTime) > 0.05) {
            video.currentTime = targetTime;
          }
        } catch {}
      };

      video.onloadedmetadata = triggerSeek;
      video.onloadeddata = triggerSeek;

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const width = Math.min(video.videoWidth || 640, 640);
          const ratio = (video.videoHeight || 360) / (video.videoWidth || 640);
          const height = Math.round(width * ratio) || 360;
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.75);
            const duration = video.duration || 0;
            cleanup();
            resolve({ thumbnailUrl, duration });
            return;
          }
        } catch (err) {
          console.warn('[Video Thumbnail] Erro no render canvas:', err);
        }
        const duration = video.duration || 0;
        cleanup();
        resolve({ thumbnailUrl: '', duration });
      };

      video.onerror = () => {
        cleanup();
        resolve({ thumbnailUrl: '', duration: 0 });
      };

      setTimeout(() => {
        cleanup();
        resolve({ thumbnailUrl: '', duration: video.duration || 0 });
      }, 3500);
    } catch (e) {
      resolve({ thumbnailUrl: '', duration: 0 });
    }
  });
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

  // Se a imagem já for WebP e for menor que 150KB, não precisa comprimir mais
  if (fileSize < 150 * 1024 && file.type === 'image/webp') {
    return file;
  }

  // Definição de qualidade e dimensões adaptativas
  if (quality === undefined) {
    if (fileSize > 8 * 1024 * 1024) quality = 0.65;
    else if (fileSize > 3 * 1024 * 1024) quality = 0.72;
    else quality = 0.80;
  }
  if (maxWidth === undefined) maxWidth = 1920;
  if (maxHeight === undefined) maxHeight = 1920;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onerror = () => resolve(file); // Fallback suave: mantém original se leitor falhar
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onerror = () => resolve(file); // Fallback suave se decodificação falhar (ex: formato exótico)
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calcular novas dimensões mantendo proporção
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
            return resolve(file);
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Verifica se o navegador suporta exportar WebP
          const targetFormat = format;

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return resolve(file);
              }

              // Se o navegador não suporta WebP e gerou PNG muito grande, tentar JPEG
              if (targetFormat === 'image/webp' && blob.type === 'image/png') {
                canvas.toBlob((jpgBlob) => {
                  if (!jpgBlob || jpgBlob.size >= file.size) {
                    return resolve(file);
                  }
                  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                  const compressedFile = new File([jpgBlob], `${baseName}.jpg`, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                  resolve(compressedFile);
                }, 'image/jpeg', quality);
                return;
              }

              const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
              const extension = blob.type.includes('webp') ? 'webp' : 'jpg';
              const newName = `${baseName}.${extension}`;

              const compressedFile = new File([blob], newName, {
                type: blob.type,
                lastModified: Date.now()
              });

              // Usa o comprimido se for menor
              if (compressedFile.size < file.size) {
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            targetFormat,
            quality
          );
        } catch (e) {
          console.warn('[Image Compressor] Erro ao processar:', e);
        }
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
  obj: any,
  width: number,
  height: number,
  colorSpace: string,
  maxDimension = 1200,
  quality = 0.65,
  decodePDFRawStreamFn?: any
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  return new Promise(async (resolve) => {
    try {
      const decoder = decodePDFRawStreamFn || (await import('pdf-lib')).decodePDFRawStream;
      const rawBytes = decoder(obj).decode();
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

    const { PDFDocument, PDFRawStream, PDFName, PDFNumber, PDFArray, decodePDFRawStream } = await import('pdf-lib');

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
          result = await compressFlateImage(obj, width, height, colorSpace, 1200, 0.65, decodePDFRawStream);
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
 * Comprime e otimiza arquivos de vídeo no cliente antes do upload.
 * - Converte vídeos pesados (4K/1080p ou .MOV de iPhones) para 720p H.264 a ~2.2 Mbps.
 * - Evita o bug de tela preta renderizando os frames via Canvas 2D com visibilidade real para o compositor.
 * - Preserva áudio sincronizado via Web Audio API sem emitir som no alto-falante.
 * - Se o vídeo já for leve (< 20MB) e compatível, mantém o original para economizar tempo.
 */
export async function compressVideo(
  file: File,
  onProgress?: (percent: number) => void,
  options: VideoCompressOptions = {}
): Promise<File | Blob> {
  // Se o vídeo já for menor que 20MB e estiver em formato MP4/WebM padrão web, não precisa recomprimir
  const isWebFormat = /\.(mp4|webm)$/i.test(file.name) || file.type === 'video/mp4' || file.type === 'video/webm';
  if (file.size < 20 * 1024 * 1024 && isWebFormat) {
    if (onProgress) onProgress(100);
    return file;
  }

  // Se o ambiente não suportar MediaRecorder ou Canvas, mantém o original
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    if (onProgress) onProgress(100);
    return file;
  }

  return new Promise((resolve) => {
    let video: HTMLVideoElement | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let recorder: MediaRecorder | null = null;
    let audioCtx: any = null;
    let isRecording = false;
    let animId: number | null = null;
    let vfcId: number | null = null;
    let progressTimer: NodeJS.Timeout | null = null;
    let safetyTimeout: NodeJS.Timeout | null = null;
    let resolved = false;

    const safeResolve = (result: File | Blob) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      if (onProgress) onProgress(100);
      resolve(result);
    };

    const cleanup = () => {
      isRecording = false;
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
        safetyTimeout = null;
      }
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      if (vfcId && video && 'cancelVideoFrameCallback' in video) {
        (video as any).cancelVideoFrameCallback(vfcId);
        vfcId = null;
      }
      if (audioCtx) {
        try {
          if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
        } catch {}
        audioCtx = null;
      }
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch {}
        recorder = null;
      }
      if (video) {
        try { video.pause(); } catch {}
        if (video.parentNode) {
          try { video.parentNode.removeChild(video); } catch {}
        }
        if (video.src) {
          try { URL.revokeObjectURL(video.src); } catch {}
        }
        video = null;
      }
      if (canvas) {
        canvas = null;
      }
    };

    try {
      const videoElement = document.createElement('video');
      video = videoElement;
      videoElement.playsInline = true;
      videoElement.setAttribute('playsinline', '');
      videoElement.setAttribute('webkit-playsinline', '');
      videoElement.preload = 'auto';
      videoElement.crossOrigin = 'anonymous';

      // Importante: visibilidade para o compositor do Chromium/Safari não descartar quadros
      videoElement.style.position = 'fixed';
      videoElement.style.bottom = '0px';
      videoElement.style.right = '0px';
      videoElement.style.width = '160px';
      videoElement.style.height = '90px';
      videoElement.style.opacity = '0.01'; // Força renderização do hardware sem ser perceptível ao usuário
      videoElement.style.pointerEvents = 'none';
      videoElement.style.zIndex = '-9999';

      document.body.appendChild(videoElement);

      const objectUrl = URL.createObjectURL(file);
      videoElement.src = objectUrl;

      videoElement.onloadedmetadata = () => {
        let duration = videoElement.duration;
        if (isNaN(duration) || !isFinite(duration) || duration <= 0) {
          duration = 10;
        }

        // Se o vídeo for excessivamente longo (> 8 minutos), evita travar o aparelho
        if (duration > 480) {
          console.info('[Video Compressor] Vídeo muito longo (>480s), mantendo arquivo original.');
          safeResolve(file);
          return;
        }

        // Resolução alvo: 720p proporcional
        canvas = document.createElement('canvas');
        const origW = videoElement.videoWidth || 1280;
        const origH = videoElement.videoHeight || 720;
        const maxDim = 1280;
        let w = origW;
        let h = origH;

        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        // H.264 exige dimensões pares
        w = Math.max(2, w - (w % 2));
        h = Math.max(2, h - (h % 2));
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          safeResolve(file);
          return;
        }

        // Desenha primeiro frame imediatamente
        try {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        } catch (e) {}

        // Captura stream do Canvas
        let canvasStream: MediaStream;
        try {
          canvasStream = (canvas as any).captureStream(30);
        } catch (err) {
          console.warn('[Video Compressor] captureStream falhou:', err);
          safeResolve(file);
          return;
        }

        const videoTracks = canvasStream.getVideoTracks();
        if (!videoTracks || videoTracks.length === 0) {
          safeResolve(file);
          return;
        }

        const outputStream = new MediaStream([videoTracks[0]]);

        // Captura áudio via Web Audio API (sem sair nas caixas de som do dispositivo)
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') {
              audioCtx.resume().catch(() => {});
            }
            videoElement.muted = false;
            videoElement.volume = 1.0;
            const source = audioCtx.createMediaElementSource(videoElement);
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(dest);
            // NÃO conecta a audioCtx.destination para manter silêncio no aparelho
            const audioTracks = dest.stream.getAudioTracks();
            if (audioTracks && audioTracks.length > 0) {
              outputStream.addTrack(audioTracks[0]);
            }
          }
        } catch (audioErr) {
          console.warn('[Video Compressor] Aviso de captura de áudio:', audioErr);
          videoElement.muted = true;
        }

        // Seleção de codec compatível (MP4 com H.264 prioritário, WebM fallback)
        let mimeType = '';
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
          mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
        } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
          mimeType = 'video/mp4;codecs=avc1';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          mimeType = 'video/webm;codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        }

        const recorderOpts = mimeType ? {
          mimeType,
          videoBitsPerSecond: options.maxBitrate || 2200000 // 2.2 Mbps = ~16MB por minuto
        } : undefined;

        try {
          recorder = recorderOpts ? new MediaRecorder(outputStream, recorderOpts) : new MediaRecorder(outputStream);
        } catch (e) {
          try {
            recorder = new MediaRecorder(outputStream);
          } catch (e2) {
            console.warn('[Video Compressor] MediaRecorder indisponível:', e2);
            safeResolve(file);
            return;
          }
        }

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        const onPlaybackEnd = () => {
          if (!isRecording) return;
          isRecording = false;
          if (progressTimer) clearInterval(progressTimer);
          if (safetyTimeout) clearTimeout(safetyTimeout);
          try {
            if (recorder && recorder.state !== 'inactive') {
              recorder.stop();
            }
          } catch (e) {}
        };

        recorder.onstop = () => {
          const finalMime = recorder?.mimeType || mimeType || 'video/mp4';
          const blob = new Blob(chunks, { type: finalMime });
          const ext = finalMime.includes('mp4') ? '.mp4' : '.webm';
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const newName = `${baseName}_opt${ext}`;

          const compressedFile = new File([blob], newName, {
            type: finalMime,
            lastModified: Date.now()
          });

          // Validação de sanidade:
          // Vídeo de verdade com mais de 2s precisa ter pelo menos 200KB.
          // Se for menor que 200KB (ex: tela preta corrompida de 70KB), rejeita a compressão com falha.
          if (compressedFile.size > 200 * 1024 && compressedFile.size < file.size) {
            console.info(`[Video Compressor] Otimizado: ${formatFileSize(file.size)} -> ${formatFileSize(compressedFile.size)}`);
            safeResolve(compressedFile);
          } else {
            console.warn('[Video Compressor] Compressão não gerou tamanho menor ou arquivo inválido. Mantendo original.');
            safeResolve(file);
          }
        };

        // Loop de renderização ativo
        isRecording = true;
        const renderLoop = () => {
          if (!isRecording || !ctx || !canvas) return;

          try {
            if (videoElement.readyState >= 2) {
              ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            }
          } catch (e) {}

          if (!videoElement.ended && !videoElement.paused) {
            if ('requestVideoFrameCallback' in videoElement) {
              vfcId = (videoElement as any).requestVideoFrameCallback(renderLoop);
            } else {
              animId = requestAnimationFrame(renderLoop);
            }
          }
        };

        videoElement.addEventListener('play', () => renderLoop());
        videoElement.addEventListener('playing', () => renderLoop());
        videoElement.addEventListener('ended', onPlaybackEnd);
        videoElement.addEventListener('seeked', () => {
          try {
            if (ctx && canvas) ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          } catch (e) {}
        });

        // Inicia gravação
        try {
          recorder.start(500);
        } catch {
          recorder.start();
        }

        // Inicia reprodução
        renderLoop();
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[Video Compressor] Play falhou:', err);
            safeResolve(file);
          });
        }

        // Monitoramento de progresso
        progressTimer = setInterval(() => {
          if (!isRecording) return;
          const curr = videoElement.currentTime;
          if (videoElement.ended || curr >= duration - 0.15) {
            onPlaybackEnd();
          } else {
            const percent = Math.min(99, Math.round((curr / duration) * 100));
            if (onProgress) onProgress(percent);
          }
        }, 150);

        // Timeout de segurança
        const maxWaitMs = Math.min(60000, Math.max(6000, Math.round((duration + 4) * 1000)));
        safetyTimeout = setTimeout(() => {
          console.warn('[Video Compressor] Timeout de segurança atingido.');
          onPlaybackEnd();
        }, maxWaitMs);
      };

      videoElement.onerror = (e) => {
        console.warn('[Video Compressor] Erro no carregamento do vídeo:', e);
        safeResolve(file);
      };
    } catch (e) {
      console.warn('[Video Compressor] Exceção geral:', e);
      safeResolve(file);
    }
  });
}

