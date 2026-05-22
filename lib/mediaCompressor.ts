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
  const {
    maxBitrate = 1500000, // 1.5 Mbps
    targetWidth = 1280,
    targetHeight = 720
  } = options;

  // Se o vídeo for menor que 3MB, não precisa comprimir
  if (file.size < 3 * 1024 * 1024) {
    if (onProgress) onProgress(100);
    return file;
  }

  // Verificar se as APIs necessárias estão disponíveis
  const hasCaptureStream = typeof HTMLCanvasElement.prototype.captureStream === 'function';
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';

  if (!hasCaptureStream || !hasMediaRecorder) {
    console.warn('Browser não suporta APIs necessárias para compressão de vídeo. Enviando arquivo original.');
    if (onProgress) onProgress(100);
    return file;
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    video.controls = false;

    // Elementos do canvas para redimensionamento de frames
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let animationFrameId: number;
    let intervalId: any;

    video.onloadedmetadata = () => {
      // Determinar resolução de saída mantendo o aspect ratio original
      let w = video.videoWidth;
      let h = video.videoHeight;

      if (w > targetWidth || h > targetHeight) {
        const scale = Math.min(targetWidth / w, targetHeight / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      canvas.width = w;
      canvas.height = h;

      // Iniciar a captura de stream do canvas a 25 FPS
      const stream = canvas.captureStream(25);

      // Tentar capturar e processar o áudio do vídeo para a stream gravada
      let audioCtx: AudioContext | null = null;
      let mediaElementSource: MediaElementAudioSourceNode | null = null;
      let mediaStreamDest: MediaStreamAudioDestinationNode | null = null;

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioContextClass();
        mediaElementSource = audioCtx.createMediaElementSource(video);
        mediaStreamDest = audioCtx.createMediaStreamDestination();
        
        // Conectar o áudio do vídeo à stream de destino do gravador
        mediaElementSource.connect(mediaStreamDest);
        
        // Também conectar à saída física para não dar erros (mesmo com video.muted = true)
        mediaElementSource.connect(audioCtx.destination);

        const audioTrack = mediaStreamDest.stream.getAudioTracks()[0];
        if (audioTrack) {
          stream.addTrack(audioTrack);
        }
      } catch (err) {
        console.warn('Erro ao configurar processamento de áudio do vídeo:', err);
      }

      // Configurar o Gravador
      let optionsMime = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(optionsMime)) {
        optionsMime = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(optionsMime)) {
        optionsMime = ''; // Fallback automático do browser
      }

      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: maxBitrate,
        audioBitsPerSecond: 128000
      };
      if (optionsMime) {
        recorderOptions.mimeType = optionsMime;
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Limpar recursos
        cancelAnimationFrame(animationFrameId);
        clearInterval(intervalId);
        if (audioCtx) {
          audioCtx.close().catch(() => {});
        }
        URL.revokeObjectURL(video.src);

        const blob = new Blob(chunks, { type: optionsMime || 'video/webm' });
        
        // Criar objeto de arquivo
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const extension = optionsMime.includes('mp4') ? 'mp4' : 'webm';
        const compressedFile = new File([blob], `${baseName}_comprimido.${extension}`, {
          type: blob.type,
          lastModified: Date.now()
        });

        // Retorna o arquivo menor
        if (compressedFile.size < file.size && compressedFile.size > 1000) {
          resolve(compressedFile);
        } else {
          resolve(file);
        }
      };

      // Iniciar a gravação
      recorder.start();

      // Função recursiva de desenho dos frames do vídeo no canvas
      const drawFrame = () => {
        if (video.paused || video.ended) return;
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        animationFrameId = requestAnimationFrame(drawFrame);
      };

      // Iniciar a reprodução do vídeo
      video.play().then(() => {
        drawFrame();

        const duration = video.duration || 1;
        // Monitor de progresso baseado no currentTime do vídeo
        intervalId = setInterval(() => {
          const current = video.currentTime;
          const percent = Math.min(Math.round((current / duration) * 95), 98);
          if (onProgress) {
            onProgress(percent);
          }
        }, 100);
      }).catch((playErr) => {
        console.error('Falha ao reproduzir vídeo oculto:', playErr);
        // Fallback imediato ao arquivo original
        cancelAnimationFrame(animationFrameId);
        clearInterval(intervalId);
        if (audioCtx) audioCtx.close().catch(() => {});
        URL.revokeObjectURL(video.src);
        if (onProgress) onProgress(100);
        resolve(file);
      });

      video.onended = () => {
        if (onProgress) onProgress(100);
        recorder.stop();
      };
    };

    video.onerror = (e) => {
      console.error('Erro ao carregar vídeo para compressão:', e);
      if (onProgress) onProgress(100);
      resolve(file);
    };
  });
}
