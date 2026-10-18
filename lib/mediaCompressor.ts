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
 * Extrai o frame (aos 0.5s ou início) de um arquivo de vídeo ou URL remota para thumbnail
 */
export async function extractVideoThumbnail(
  source: File | string,
  targetSecond = 0.5
): Promise<{ thumbnailUrl: string; duration: number }> {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined') {
        resolve({ thumbnailUrl: '', duration: 0 });
        return;
      }
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      const isFile = typeof source !== 'string' && source instanceof File;
      const url = isFile ? URL.createObjectURL(source) : source;
      video.src = url;

      let resolved = false;
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          if (isFile) {
            try { URL.revokeObjectURL(url); } catch {}
          }
          try { video.remove(); } catch {}
        }
      };

      const triggerSeek = () => {
        try {
          const seekTime = Math.max(0.1, Math.min(targetSecond, (video.duration || 1) / 2));
          if (Math.abs(video.currentTime - seekTime) > 0.05) {
            video.currentTime = seekTime;
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
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
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
      }, 4000);
    } catch (e) {
      resolve({ thumbnailUrl: '', duration: 0 });
    }
  });
}

/**
 * Converte dataURL de thumbnail (JPEG) para File pronto para upload
 */
export async function thumbnailDataUrlToFile(dataUrl: string, baseName = 'thumb'): Promise<File | null> {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], `${baseName}_${Date.now()}.jpg`, { type: 'image/jpeg' });
  } catch {
    return null;
  }
}

/**
 * Comprime uma imagem utilizando HTML5 Canvas e converte para WebP (ou JPEG).
 * Suporta arquivos padrão (PNG, JPG) e arquivos HEIC/HEIF de iPhones.
 * Adapta a resolução e a qualidade dinamicamente com base no tamanho do arquivo.
 */
export async function compressImage(
  file: File,
  options: ImageCompressOptions = {}
): Promise<File> {
  const isHeic = 
    file.type.toLowerCase().includes('heic') || 
    file.type.toLowerCase().includes('heif') || 
    /\.(heic|heif)$/i.test(file.name);

  let sourceFile = file;

  // Se for imagem no formato HEIC/HEIF (padrão iPhone/iPad), converte previamente para JPEG compatível
  if (isHeic && typeof window !== 'undefined') {
    try {
      const heic2anyModule = await import('heic2any');
      const heic2any = (heic2anyModule as any).default || heic2anyModule;
      const convertedBlobOrBlobs = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85
      });
      const convertedBlob: Blob = Array.isArray(convertedBlobOrBlobs) ? convertedBlobOrBlobs[0] : convertedBlobOrBlobs;
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      sourceFile = new File([convertedBlob], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      console.info(`[Image Compressor] Arquivo HEIC "${file.name}" convertido para JPEG com sucesso.`);
    } catch (heicErr) {
      console.warn('[Image Compressor] Falha na conversão com heic2any, tentando fallback direto:', heicErr);
    }
  }

  const fileSize = sourceFile.size;
  let quality = options.quality;
  let maxWidth = options.maxWidth;
  let maxHeight = options.maxHeight;
  const format = options.format || 'image/webp';

  // Se a imagem já for WebP e for razoavelmente compactada (< 2.5MB), não precisa recomprimir
  if (!isHeic && fileSize < 2.5 * 1024 * 1024 && sourceFile.type === 'image/webp') {
    return sourceFile;
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
    reader.readAsDataURL(sourceFile);
    reader.onerror = () => resolve(sourceFile);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onerror = () => resolve(sourceFile);
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
            return resolve(sourceFile);
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Verifica se o navegador suporta exportar WebP
          const targetFormat = format;

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return resolve(sourceFile);
              }

              // Se o navegador não suporta WebP e gerou PNG muito grande, tentar JPEG
              if (targetFormat === 'image/webp' && blob.type === 'image/png') {
                canvas.toBlob((jpgBlob) => {
                  if (!jpgBlob || (!isHeic && jpgBlob.size >= fileSize)) {
                    return resolve(sourceFile);
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

              // Usa o comprimido se for menor ou se o original era HEIC (que não abre nos navegadores)
              if (isHeic || compressedFile.size < fileSize) {
                console.info(`[Image Compressor] Otimizado: ${file.name} (${(file.size / 1024).toFixed(0)}KB) -> ${compressedFile.name} (${(compressedFile.size / 1024).toFixed(0)}KB)`);
                resolve(compressedFile);
              } else {
                resolve(sourceFile);
              }
            },
            targetFormat,
            quality
          );
        } catch (e) {
          console.warn('[Image Compressor] Erro ao processar:', e);
          resolve(sourceFile);
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
 * - Mantém vídeos <= 48.5MB 100% nativos (máxima qualidade de câmera e áudio original, respeitando o teto de 50MB do Supabase Storage).
 * - Otimiza vídeos > 48.5MB (até 100MB) para caber de forma segura abaixo de 45MB em Full HD (1080p).
 * - Preserva 100% do áudio original através de decodificação direta via Web Audio API (sem problemas de política de Autoplay ou silenciamento).
 * - Utiliza captura de stream direta com aceleração de hardware nativa (sem sobrecarga de Canvas quando a resolução é compatível)
 *   ou Canvas sincronizado com requestVideoFrameCallback para evitar quedas de FPS, travamentos ou vídeos acelerados/lentos.
 */
export async function compressVideo(
  file: File,
  onProgress?: (percent: number) => void,
  options: VideoCompressOptions = {}
): Promise<File | Blob> {
  // Vídeos <= 48.5MB em formato padrão são mantidos nativos para envio imediato, sem perda de nitidez ou som
  const COMPRESS_THRESHOLD_BYTES = 48.5 * 1024 * 1024;
  const isVideoFormat = /\.(mp4|webm|mov|m4v|3gp|mkv|avi)$/i.test(file.name) || file.type.startsWith('video/') || file.type.includes('video');
  if (file.size <= COMPRESS_THRESHOLD_BYTES && isVideoFormat) {
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
    let audioSourceNode: AudioBufferSourceNode | null = null;
    let isRecording = false;
    let hasStartedEncoding = false;
    let loopRunning = false;
    let animId: number | null = null;
    let vfcId: number | null = null;
    let progressTimer: NodeJS.Timeout | null = null;
    let safetyTimeout: NodeJS.Timeout | null = null;
    let watchdogTimer: NodeJS.Timeout | null = null;
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
      loopRunning = false;
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
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
        try { (video as any).cancelVideoFrameCallback(vfcId); } catch {}
        vfcId = null;
      }
      if (audioSourceNode) {
        try { audioSourceNode.stop(); } catch {}
        try { audioSourceNode.disconnect(); } catch {}
        audioSourceNode = null;
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
      // Mudo ativado no elemento evita que o navegador bloqueie o play() por políticas de autoplay
      videoElement.muted = true;
      videoElement.setAttribute('muted', '');

      // Mantém o elemento ativo para o decodificador com 100% de opacidade para não desbotar cores nem sofrer throttling,
      // posicionado discretamente no viewport do navegador
      videoElement.style.position = 'fixed';
      videoElement.style.top = '0px';
      videoElement.style.left = '0px';
      videoElement.style.width = '320px';
      videoElement.style.height = '240px';
      videoElement.style.opacity = '1';
      videoElement.style.pointerEvents = 'none';
      videoElement.style.zIndex = '-10';

      document.body.appendChild(videoElement);

      const objectUrl = URL.createObjectURL(file);
      videoElement.src = objectUrl;

      // Watchdog de segurança no carregamento inicial do arquivo
      watchdogTimer = setTimeout(() => {
        console.warn('[Video Compressor] Timeout no carregamento inicial do vídeo (15s). Usando original.');
        safeResolve(file);
      }, 15000);

      const startEncodingPipeline = async () => {
        if (hasStartedEncoding || resolved) return;
        hasStartedEncoding = true;

        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = null;
        }

        let duration = videoElement.duration;
        if (isNaN(duration) || !isFinite(duration) || duration <= 0) {
          duration = 30;
        }

        // Se o vídeo for excessivamente longo (> 10 minutos), evita travar o aparelho
        if (duration > 600) {
          console.info('[Video Compressor] Vídeo muito longo (>600s), mantendo arquivo original.');
          safeResolve(file);
          return;
        }

        // Resolução alvo: 1080p Full HD (1920px no maior lado) para nitidez excepcional sem perda de detalhes
        const origW = videoElement.videoWidth || 1920;
        const origH = videoElement.videoHeight || 1080;
        const maxDim = options.targetWidth || 1920;

        let videoTrack: MediaStreamTrack | null = null;
        let canvasStream: MediaStream | null = null;
        let ctx: CanvasRenderingContext2D | null = null;

        canvas = document.createElement('canvas');
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

        // Dimensões estritamente pares para compatibilidade total com codecs de vídeo
        w = Math.max(2, w - (w % 2));
        h = Math.max(2, h - (h % 2));
        canvas.width = w;
        canvas.height = h;

        // alpha: false garante cores 100% sólidas (RGB 24-bit), pretos profundos e contraste total,
        // eliminando o efeito de imagem desbotada ("sem cor") de canvas translúcidos
        ctx = canvas.getContext('2d', {
          alpha: false,
          desynchronized: true
        });
        if (!ctx) {
          safeResolve(file);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Renderiza o primeiro quadro sólido imediatamente
        if (videoElement.readyState >= 2) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        }

        try {
          canvasStream = (canvas as any).captureStream(30);
          videoTrack = canvasStream?.getVideoTracks?.()[0] || null;
        } catch (err) {
          console.warn('[Video Compressor] Canvas captureStream falhou:', err);
          safeResolve(file);
          return;
        }

        if (!videoTrack) {
          safeResolve(file);
          return;
        }

        const outputStream = new MediaStream([videoTrack]);

        // Captura fiel de áudio via Web Audio API com decodificação direta de dados:
        // Isso garante 100% de preservação do som, mesmo se o elemento de vídeo estiver mudo
        // para contornar o bloqueio de Autoplay Policy dos navegadores.
        let audioCaptured = false;
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') {
              await audioCtx.resume().catch(() => {});
            }

            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            if (audioBuffer && audioBuffer.numberOfChannels > 0) {
              const dest = audioCtx.createMediaStreamDestination();
              const sourceNode = audioCtx.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(dest);
              audioSourceNode = sourceNode;

              const audioTracks = dest.stream.getAudioTracks();
              if (audioTracks && audioTracks.length > 0) {
                outputStream.addTrack(audioTracks[0]);
                audioCaptured = true;
              }
            }
          }
        } catch (audioErr) {
          console.warn('[Video Compressor] decodeAudioData indisponível para este arquivo, tentando fallback:', audioErr);
        }

        if (!audioCaptured) {
          try {
            if (typeof (videoElement as any).captureStream === 'function') {
              const elemStream: MediaStream = (videoElement as any).captureStream();
              const elemAudioTracks = elemStream?.getAudioTracks?.() || [];
              if (elemAudioTracks.length > 0) {
                outputStream.addTrack(elemAudioTracks[0]);
                audioCaptured = true;
              }
            }
          } catch {}
        }

        // Seleção de codec compatível:
        // No Chrome/Firefox/Edge: 'video/webm;codecs=vp9,opus' respeita estritamente o bitrate configurado,
        // garantindo que o vídeo não fique excessivamente comprimido nem perca cores.
        // No Safari/WebKit: 'video/mp4;codecs=avc1' utiliza o VideoToolbox nativo da Apple.
        const mimeCandidates = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=avc1',
          'video/mp4'
        ];
        let mimeType = '';
        for (const candidate of mimeCandidates) {
          if (MediaRecorder.isTypeSupported(candidate)) {
            mimeType = candidate;
            break;
          }
        }

        // Cálculo inteligente de bitrate:
        // - Mantém altíssima fidelidade Full HD (até 8.0 Mbps) sem ultrapassar o teto seguro de ~44MB do Supabase Storage
        // - Garante que o arquivo NÃO seja comprimido em excesso (ex: de 79MB para 9MB), preservando os detalhes
        const maxTargetBytes = 44 * 1024 * 1024; // 44MB
        const audioBitsPerSecond = audioCaptured ? 160000 : 0;
        const maxTotalBpsForBucket = Math.floor((maxTargetBytes * 8) / Math.max(1, duration));
        const idealVideoBps = options.maxBitrate || 8000000;
        const minVideoBps = 2000000;
        const videoBitsPerSecond = Math.max(minVideoBps, Math.min(idealVideoBps, maxTotalBpsForBucket - audioBitsPerSecond));

        const recorderOpts: MediaRecorderOptions = {
          ...(mimeType ? { mimeType } : {}),
          videoBitsPerSecond,
          ...(audioCaptured ? { audioBitsPerSecond } : {})
        };

        try {
          recorder = new MediaRecorder(outputStream, recorderOpts);
        } catch (e) {
          try {
            recorder = new MediaRecorder(outputStream, {
              videoBitsPerSecond,
              ...(audioCaptured ? { audioBitsPerSecond } : {})
            });
          } catch (e2) {
            try {
              recorder = new MediaRecorder(outputStream);
            } catch (e3) {
              console.warn('[Video Compressor] MediaRecorder indisponível:', e3);
              safeResolve(file);
              return;
            }
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
          loopRunning = false;
          if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
          }
          if (safetyTimeout) {
            clearTimeout(safetyTimeout);
            safetyTimeout = null;
          }
          if (audioSourceNode) {
            try { audioSourceNode.stop(); } catch {}
            try { audioSourceNode.disconnect(); } catch {}
            audioSourceNode = null;
          }
          try {
            if (recorder && recorder.state !== 'inactive') {
              recorder.stop();
            }
          } catch {}
        };

        recorder.onstop = () => {
          const rawMime = (recorder?.mimeType || mimeType || 'video/webm').toLowerCase();
          const isMp4 = rawMime.includes('mp4');
          const cleanMimeType = isMp4 ? 'video/mp4' : 'video/webm';
          const ext = isMp4 ? '.mp4' : '.webm';

          const blob = new Blob(chunks, { type: cleanMimeType });
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const newName = `${baseName}_opt${ext}`;

          const compressedFile = new File([blob], newName, {
            type: cleanMimeType,
            lastModified: Date.now()
          });

          // Validação de sanidade (> 200KB e menor que o original)
          if (compressedFile.size > 200 * 1024 && compressedFile.size < file.size) {
            console.info(`[Video Compressor] Otimizado com sucesso: ${formatFileSize(file.size)} -> ${formatFileSize(compressedFile.size)} (${Math.round(videoBitsPerSecond / 1000)} kbps, áudio: ${audioCaptured ? 'OK' : 'Nenhum'})`);
            safeResolve(compressedFile);
          } else {
            console.warn('[Video Compressor] Compressão não gerou tamanho menor ou arquivo inválido. Mantendo original.');
            safeResolve(file);
          }
        };

        isRecording = true;
        const startRenderLoop = () => {
          if (loopRunning || !isRecording) return;
          loopRunning = true;

          const tick = () => {
            if (!isRecording || !ctx || !canvas || !videoElement) {
              loopRunning = false;
              return;
            }

            if (videoElement.readyState >= 2) {
              ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            }

            if (!videoElement.ended && !videoElement.paused) {
              if ('requestVideoFrameCallback' in videoElement) {
                vfcId = (videoElement as any).requestVideoFrameCallback(tick);
              } else {
                animId = requestAnimationFrame(tick);
              }
            } else {
              loopRunning = false;
            }
          };

          tick();
        };

        videoElement.addEventListener('play', startRenderLoop);
        videoElement.addEventListener('playing', startRenderLoop);
        videoElement.addEventListener('ended', onPlaybackEnd);

        // Inicia reprodução e gravação sincronizada
        videoElement.playbackRate = 1.0;
        const beginRecorder = () => {
          if (!recorder || recorder.state !== 'inactive') return;
          try {
            recorder.start(500);
          } catch {
            try { recorder.start(); } catch {}
          }
          if (audioSourceNode) {
            try { audioSourceNode.start(0); } catch {}
          }
          startRenderLoop();
        };

        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => beginRecorder())
            .catch((err) => {
              console.warn('[Video Compressor] Play falhou:', err);
              safeResolve(file);
            });
        } else {
          beginRecorder();
        }

        // Monitoramento de progresso
        progressTimer = setInterval(() => {
          if (!isRecording) return;
          const curr = videoElement.currentTime;
          if (videoElement.ended || curr >= duration - 0.12) {
            onPlaybackEnd();
          } else {
            const percent = Math.min(99, Math.round((curr / duration) * 100));
            if (onProgress) onProgress(percent);
          }
        }, 150);

        // Timeout de segurança proporcional à duração real
        const maxWaitMs = Math.min(620000, Math.max(15000, Math.round((duration + 15) * 1000)));
        safetyTimeout = setTimeout(() => {
          console.warn('[Video Compressor] Timeout de segurança atingido.');
          onPlaybackEnd();
        }, maxWaitMs);
      };

      videoElement.onloadeddata = () => {
        startEncodingPipeline();
      };
      videoElement.onloadedmetadata = () => {
        setTimeout(() => {
          if (!hasStartedEncoding && !resolved && videoElement.readyState >= 1) {
            startEncodingPipeline();
          }
        }, 600);
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

