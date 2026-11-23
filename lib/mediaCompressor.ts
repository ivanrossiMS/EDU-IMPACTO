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
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      const isFile = typeof source !== 'string' && source instanceof File;
      if (!isFile) {
        video.crossOrigin = 'anonymous';
      }

      const url = isFile ? URL.createObjectURL(source) : source;
      video.src = url;

      let resolved = false;
      let seekTriggered = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const finish = (result: { thumbnailUrl: string; duration: number }) => {
        if (resolved) return;
        resolved = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        video.onloadedmetadata = null;
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
        if (isFile) {
          try { URL.revokeObjectURL(url); } catch {}
        }
        try {
          video.removeAttribute('src');
          video.load();
          video.remove();
        } catch {}
        resolve(result);
      };

      const triggerSeek = () => {
        if (resolved || seekTriggered) return;
        if (!video.videoWidth || !video.videoHeight) return;
        seekTriggered = true;
        try {
          const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
          const seekTime = Math.max(0.05, Math.min(targetSecond, dur / 2));
          if (Math.abs(video.currentTime - seekTime) > 0.05) {
            video.currentTime = seekTime;
          } else {
            captureFrame();
          }
        } catch {
          captureFrame();
        }
      };

      const captureFrame = () => {
        try {
          if (!video.videoWidth || !video.videoHeight) {
            finish({ thumbnailUrl: '', duration: Number.isFinite(video.duration) ? video.duration : 0 });
            return;
          }
          const canvas = document.createElement('canvas');
          const width = Math.min(video.videoWidth, 640);
          const ratio = video.videoHeight / video.videoWidth;
          const height = Math.max(2, Math.round(width * ratio));
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d', { alpha: false });
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            finish({ thumbnailUrl, duration });
            return;
          }
        } catch (err) {
          console.warn('[Video Thumbnail] Erro no render canvas:', err);
        }
        finish({ thumbnailUrl: '', duration: Number.isFinite(video.duration) ? video.duration : 0 });
      };

      video.onloadedmetadata = triggerSeek;
      video.onloadeddata = triggerSeek;
      video.onseeked = captureFrame;
      video.onerror = () => {
        finish({ thumbnailUrl: '', duration: 0 });
      };

      timeoutId = setTimeout(() => {
        finish({ thumbnailUrl: '', duration: Number.isFinite(video.duration) ? video.duration : 0 });
      }, isFile ? 5000 : 8000);
    } catch {
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

let aacEncoderRegistered = false;

async function ensureMediabunnyAacEncoder(canEncodeAudio: (codec: 'aac') => Promise<boolean>): Promise<void> {
  if (aacEncoderRegistered) return;
  try {
    if (!(await canEncodeAudio('aac'))) {
      const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
      registerAacEncoder();
    }
    aacEncoderRegistered = true;
  } catch (err) {
    console.warn('[Video Compressor] Falha ao registrar @mediabunny/aac-encoder:', err);
  }
}

function buildOptimizedMp4File(buffer: ArrayBuffer, originalName: string): File {
  const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
  const cleanName = `${baseName.replace(/_opt$/i, '')}_opt.mp4`;
  return new File([buffer], cleanName, {
    type: 'video/mp4',
    lastModified: Date.now()
  });
}

async function compressVideoWithMediabunny(
  file: File,
  onProgress?: (percent: number) => void,
  options: VideoCompressOptions = {}
): Promise<File | null> {
  if (typeof window === 'undefined' || !('VideoEncoder' in window) || !('VideoDecoder' in window)) {
    return null;
  }

  let input: any = null;
  try {
    const mb = await import('mediabunny');
    const {
      Input,
      ALL_FORMATS,
      BlobSource,
      Output,
      BufferTarget,
      Mp4OutputFormat,
      Conversion,
      canEncodeAudio,
      canEncodeVideo
    } = mb;

    input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS
    });

    const [format, videoTrack, audioTrack, rawDuration] = await Promise.all([
      input.getFormat().catch(() => null),
      input.getPrimaryVideoTrack().catch(() => null),
      input.getPrimaryAudioTrack().catch(() => null),
      input.computeDuration().catch(() => 0)
    ]);

    if (!videoTrack) {
      return null;
    }

    const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 30;
    const [videoCodec, audioCodec, displayWidth, displayHeight, frameRateMetrics, packetStats] = await Promise.all([
      videoTrack.getCodec().catch(() => null),
      audioTrack ? audioTrack.getCodec().catch(() => null) : Promise.resolve(null),
      videoTrack.getDisplayWidth().catch(() => videoTrack.displayWidth || 1280),
      videoTrack.getDisplayHeight().catch(() => videoTrack.displayHeight || 720),
      videoTrack.computeFrameRateMetrics({ targetPacketCount: 120 }).catch(() => ({
        bestGuessFrameRate: 30,
        frameRateIsConstant: false
      })),
      videoTrack.computePacketStats(120).catch(() => ({
        averageBitrate: 0,
        averagePacketRate: 30
      }))
    ]);

    const maxSide = Math.max(displayWidth || 0, displayHeight || 0);
    const estFps = frameRateMetrics?.bestGuessFrameRate || packetStats?.averagePacketRate || 30;
    const isCfr = Boolean(frameRateMetrics?.frameRateIsConstant);
    const isMp4Container =
      (format?.mimeType || '').includes('mp4') ||
      /\.(mp4|m4v)$/i.test(file.name) ||
      file.type === 'video/mp4';

    const isAlreadyWebReady =
      isMp4Container &&
      videoCodec === 'avc' &&
      (!audioTrack || audioCodec === 'aac') &&
      maxSide > 0 &&
      maxSide <= 1280 &&
      estFps <= 31 &&
      isCfr &&
      file.size <= 15 * 1024 * 1024 &&
      (packetStats?.averageBitrate || (file.size * 8) / duration) <= 2_200_000;

    // Se já é MP4 H.264/AAC <= 720p CFR e pequeno:
    // - <= 4MB: mantém intacto instantaneamente
    // - 4MB..15MB: tenta remux sem perda com fastStart ('moov' no início) para streaming imediato
    if (isAlreadyWebReady) {
      if (file.size <= 4 * 1024 * 1024) {
        if (onProgress) onProgress(100);
        return file;
      }

      try {
        const remuxTarget = new BufferTarget();
        const remuxOutput = new Output({
          format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
          target: remuxTarget
        });
        const remuxConv = await Conversion.init({
          input,
          output: remuxOutput,
          tracks: 'primary',
          showWarnings: false,
          copy: { mode: 'forced' }
        });
        const audioDropped = Boolean(
          audioTrack &&
            remuxConv.discardedTracks.some(
              (d: any) => d.track?.type === 'audio' && d.reason !== 'discarded_by_user'
            )
        );
        if (remuxConv.isValid && !audioDropped) {
          remuxConv.onProgress = (p: number) => {
            if (onProgress) onProgress(Math.min(99, Math.round(p * 100)));
          };
          await remuxConv.execute();
          if (remuxTarget.buffer && remuxTarget.buffer.byteLength > 50 * 1024) {
            const remuxed = buildOptimizedMp4File(remuxTarget.buffer, file.name);
            if (remuxed.size <= 48.5 * 1024 * 1024) {
              console.info(
                `[Video Compressor] FastStart remux sem perdas: ${formatFileSize(file.size)} -> ${formatFileSize(remuxed.size)}`
              );
              if (onProgress) onProgress(100);
              return remuxed;
            }
          }
        }
      } catch (remuxErr) {
        console.warn('[Video Compressor] FastStart remux falhou, seguindo para transcodificação:', remuxErr);
      }
    }

    // Configuração ideal para feed móvel/web sem travamentos e sem dessincronia:
    // MP4 (H.264 AVC + AAC), 720p (1280px max), 30fps CFR, keyframe a cada 2s, moov no início (fastStart)
    const AUDIO_BITRATE = 128_000;
    const SOFT_TARGET_BYTES = 25 * 1024 * 1024;
    const HARD_MAX_BYTES = 38 * 1024 * 1024;
    const targetCapBytes = duration <= 110 ? SOFT_TARGET_BYTES : HARD_MAX_BYTES;
    const maxVideoBpsForCap = Math.floor((targetCapBytes * 8) / Math.max(1, duration) - (audioTrack ? AUDIO_BITRATE : 0));

    const idealVideoBps = options.maxBitrate || 1_800_000;
    const videoBitrate = Math.max(550_000, Math.min(idealVideoBps, maxVideoBpsForCap));

    let maxDim = options.targetWidth || 1280;
    if (!options.targetWidth) {
      if (videoBitrate < 750_000) maxDim = 854;
      else if (videoBitrate < 1_100_000) maxDim = 960;
    }

    const shouldResize = maxSide > maxDim;
    const isLandscape = (displayWidth || 1280) >= (displayHeight || 720);

    // Dimensões estimadas para checar suporte do hardware encoder H.264
    const estOutW = shouldResize
      ? isLandscape
        ? maxDim
        : Math.max(2, Math.round((displayWidth * maxDim) / Math.max(1, displayHeight)) & ~1)
      : Math.max(2, (displayWidth || 1280) & ~1);
    const estOutH = shouldResize
      ? isLandscape
        ? Math.max(2, Math.round((displayHeight * maxDim) / Math.max(1, displayWidth)) & ~1)
        : maxDim
      : Math.max(2, (displayHeight || 720) & ~1);

    const avcSupported = await canEncodeVideo('avc', {
      width: estOutW,
      height: estOutH,
      bitrate: videoBitrate
    }).catch(() => false);

    if (!avcSupported) {
      console.warn('[Video Compressor] WebCodecs H.264 indisponível para estas dimensões; usando fallback.');
      return null;
    }

    if (audioTrack) {
      await ensureMediabunnyAacEncoder(canEncodeAudio);
    }

    const needsCfrNormalize = !isCfr || estFps > 31;
    const videoOptions: any = {
      codec: 'avc',
      bitrate: videoBitrate,
      keyFrameInterval: 2,
      allowTransformationMetadata: false,
      forceTranscode: true,
      ...(needsCfrNormalize ? { frameRate: 30 } : {}),
      ...(shouldResize ? (isLandscape ? { width: maxDim } : { height: maxDim }) : {})
    };

    const srcChannels = audioTrack ? await audioTrack.getNumberOfChannels().catch(() => 2) : 0;
    const audioOptions: any = audioTrack
      ? {
          codec: 'aac',
          bitrate: AUDIO_BITRATE,
          numberOfChannels: Math.max(1, Math.min(2, srcChannels || 2)),
          forceTranscode: true
        }
      : { discard: true };

    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target
    });

    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      showWarnings: false,
      video: videoOptions,
      audio: audioOptions
    });

    const audioUnexpectedlyDropped = Boolean(
      audioTrack &&
        conversion.discardedTracks.some(
          (d: any) => d.track?.type === 'audio' && d.reason !== 'discarded_by_user'
        )
    );

    if (!conversion.isValid || audioUnexpectedlyDropped) {
      console.warn(
        '[Video Compressor] Mediabunny Conversion inválida ou áudio descartado:',
        conversion.discardedTracks
      );
      return null;
    }

    conversion.onProgress = (progress: number) => {
      if (onProgress) {
        onProgress(Math.min(99, Math.max(1, Math.round(progress * 100))));
      }
    };

    await conversion.execute();

    if (!target.buffer || target.buffer.byteLength <= 50 * 1024) {
      return null;
    }

    const optimizedFile = buildOptimizedMp4File(target.buffer, file.name);
    if (optimizedFile.size > 48.5 * 1024 * 1024) {
      console.warn('[Video Compressor] Saída ainda acima de 48.5MB; mantendo validação final.');
    }

    console.info(
      `[Video Compressor / Mediabunny] ${formatFileSize(file.size)} -> ${formatFileSize(optimizedFile.size)} (${estOutW}x${estOutH}, ${Math.round(videoBitrate / 1000)} kbps, FastStart H.264/AAC)`
    );
    if (onProgress) onProgress(100);
    return optimizedFile;
  } catch (err) {
    console.warn('[Video Compressor / Mediabunny] Erro na transcodificação, tentando fallback:', err);
    return null;
  } finally {
    if (input) {
      try {
        input.dispose();
      } catch {}
    }
  }
}

/**
 * Fallback com Canvas + MediaRecorder para navegadores legados sem WebCodecs.
 * Sincroniza áudio via MediaElementAudioSourceNode (mesmo relógio do elemento <video>)
 * e utiliza perfil 720p @ 1.8 Mbps para evitar travamentos e dessincronia.
 */
async function compressVideoWithMediaRecorderFallback(
  file: File,
  onProgress?: (percent: number) => void,
  options: VideoCompressOptions = {}
): Promise<File> {
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
    let mediaElementSource: MediaElementAudioSourceNode | null = null;
    let isRecording = false;
    let hasStartedEncoding = false;
    let loopRunning = false;
    let animId: number | null = null;
    let vfcId: number | null = null;
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    let safetyTimeout: ReturnType<typeof setTimeout> | null = null;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

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
      if (mediaElementSource) {
        try { mediaElementSource.disconnect(); } catch {}
        mediaElementSource = null;
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

    const safeResolve = (result: File) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      if (onProgress) onProgress(100);
      resolve(result);
    };

    try {
      const videoElement = document.createElement('video');
      video = videoElement;
      videoElement.playsInline = true;
      videoElement.setAttribute('playsinline', '');
      videoElement.setAttribute('webkit-playsinline', '');
      videoElement.preload = 'auto';
      videoElement.muted = false;

      videoElement.style.position = 'fixed';
      videoElement.style.top = '0px';
      videoElement.style.left = '0px';
      videoElement.style.width = '320px';
      videoElement.style.height = '240px';
      videoElement.style.opacity = '0.01';
      videoElement.style.pointerEvents = 'none';
      videoElement.style.zIndex = '-10';

      document.body.appendChild(videoElement);

      const objectUrl = URL.createObjectURL(file);
      videoElement.src = objectUrl;

      watchdogTimer = setTimeout(() => {
        console.warn('[Video Compressor Fallback] Timeout no carregamento inicial (15s). Usando original.');
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

        if (duration > 600) {
          safeResolve(file);
          return;
        }

        const origW = videoElement.videoWidth || 1280;
        const origH = videoElement.videoHeight || 720;
        const maxDim = options.targetWidth || 1280;

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
        w = Math.max(2, w - (w % 2));
        h = Math.max(2, h - (h % 2));

        canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        if (!ctx) {
          safeResolve(file);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (videoElement.readyState >= 2) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        }

        let videoTrack: MediaStreamTrack | null = null;
        try {
          const canvasStream: MediaStream = (canvas as any).captureStream(30);
          videoTrack = canvasStream?.getVideoTracks?.()[0] || null;
        } catch {
          safeResolve(file);
          return;
        }
        if (!videoTrack) {
          safeResolve(file);
          return;
        }

        const outputStream = new MediaStream([videoTrack]);
        let audioCaptured = false;
        let useDecodedBufferFallback = false;

        // Prioridade 1: Roteia áudio do <video> via Web Audio API sem saída para alto-falante (sincronia 1:1 com frames)
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') {
              await audioCtx.resume().catch(() => {});
            }
            const dest = audioCtx.createMediaStreamDestination();
            const srcNode = audioCtx.createMediaElementSource(videoElement);
            mediaElementSource = srcNode;
            srcNode.connect(dest);
            const tracks = dest.stream.getAudioTracks();
            if (tracks.length > 0) {
              outputStream.addTrack(tracks[0]);
              audioCaptured = true;
            }
          }
        } catch {
          useDecodedBufferFallback = true;
        }

        // Prioriza MP4 H.264/AAC (compatível com iOS/Android/Web) e VP8 leve (evita VP9 pesado na CPU no fallback)
        const mimeCandidates = [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=avc1',
          'video/mp4',
          'video/webm;codecs=vp8,opus',
          'video/webm'
        ];
        let mimeType = '';
        for (const candidate of mimeCandidates) {
          if (MediaRecorder.isTypeSupported(candidate)) {
            mimeType = candidate;
            break;
          }
        }

        const maxTargetBytes = 25 * 1024 * 1024;
        const audioBitsPerSecond = audioCaptured ? 128000 : 0;
        const maxTotalBps = Math.floor((maxTargetBytes * 8) / Math.max(1, duration));
        const idealVideoBps = options.maxBitrate || 1800000;
        const videoBitsPerSecond = Math.max(550000, Math.min(idealVideoBps, maxTotalBps - audioBitsPerSecond));

        try {
          recorder = new MediaRecorder(outputStream, {
            ...(mimeType ? { mimeType } : {}),
            videoBitsPerSecond,
            ...(audioCaptured ? { audioBitsPerSecond } : {})
          });
        } catch {
          try {
            recorder = new MediaRecorder(outputStream);
          } catch {
            safeResolve(file);
            return;
          }
        }

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
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
          const compressedFile = new File([blob], `${baseName}_opt${ext}`, {
            type: cleanMimeType,
            lastModified: Date.now()
          });

          if (compressedFile.size > 100 * 1024 && (compressedFile.size < file.size || isMp4)) {
            safeResolve(compressedFile);
          } else {
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
        videoElement.playbackRate = 1.0;

        const beginRecorder = () => {
          if (!recorder || recorder.state !== 'inactive') return;
          try {
            recorder.start(500);
          } catch {
            try { recorder.start(); } catch {}
          }
          if (audioSourceNode && useDecodedBufferFallback) {
            try { audioSourceNode.start(0, videoElement.currentTime || 0); } catch {}
          }
          startRenderLoop();
        };

        try {
          await videoElement.play();
          beginRecorder();
        } catch {
          // Se o navegador bloqueou autoplay sem mudo, muta elemento e usa decodeAudioData sincronizado no evento 'playing'
          videoElement.muted = true;
          videoElement.setAttribute('muted', '');
          try {
            if (audioCtx && file.size <= 60 * 1024 * 1024) {
              if (mediaElementSource) {
                try { mediaElementSource.disconnect(); } catch {}
                mediaElementSource = null;
              }
              const arrayBuffer = await file.arrayBuffer();
              const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
              if (audioBuffer && audioBuffer.numberOfChannels > 0) {
                const dest = audioCtx.createMediaStreamDestination();
                const srcNode = audioCtx.createBufferSource();
                srcNode.buffer = audioBuffer;
                srcNode.connect(dest);
                audioSourceNode = srcNode;
                useDecodedBufferFallback = true;
                for (const t of outputStream.getAudioTracks()) outputStream.removeTrack(t);
                const tracks = dest.stream.getAudioTracks();
                if (tracks.length > 0) outputStream.addTrack(tracks[0]);
              }
            }
          } catch {}

          videoElement.play().then(() => beginRecorder()).catch(() => safeResolve(file));
        }

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

        const maxWaitMs = Math.min(620000, Math.max(15000, Math.round((duration + 15) * 1000)));
        safetyTimeout = setTimeout(() => {
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
      videoElement.onerror = () => {
        safeResolve(file);
      };
    } catch {
      safeResolve(file);
    }
  });
}

/**
 * Comprime e normaliza arquivos de vídeo no cliente antes do upload.
 * - Padrão universal para reprodução fluida sem travamentos ou dessincronia:
 *   MP4 (H.264 / AVC + AAC 128kbps), até 720p (1280px), 30fps constantes (CFR), fastStart (moov no início).
 * - Usa transcodificação acelerada via WebCodecs (Mediabunny) sem bloqueio de thread nem perda de sincronia A/V,
 *   com fallback automático para MediaRecorder se o dispositivo não suportar WebCodecs.
 * - Pula ou apenas faz remux rápido sem perdas quando o vídeo já é MP4 H.264/AAC <= 720p CFR e leve.
 */
export async function compressVideo(
  file: File,
  onProgress?: (percent: number) => void,
  options: VideoCompressOptions = {}
): Promise<File> {
  if (typeof window === 'undefined') {
    if (onProgress) onProgress(100);
    return file;
  }

  // Tentativa primária: Mediabunny (WebCodecs acelerado por hardware, MP4 H.264+AAC FastStart, sincronia perfeita)
  const mediabunnyResult = await compressVideoWithMediabunny(file, onProgress, options);
  if (mediabunnyResult) {
    return mediabunnyResult;
  }

  // Fallback para navegadores antigos sem WebCodecs: apenas comprime se > 20MB ou formato não-MP4
  const isMp4 = /\.mp4$/i.test(file.name) || file.type === 'video/mp4';
  if (isMp4 && file.size <= 20 * 1024 * 1024) {
    if (onProgress) onProgress(100);
    return file;
  }

  return compressVideoWithMediaRecorderFallback(file, onProgress, options);
}

