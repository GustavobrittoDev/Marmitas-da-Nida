import { isSupabaseConfigured, supabase } from './supabase';
import { slugify } from '../utils/format';

const SITE_IMAGES_BUCKET = 'site-images';

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Formato de imagem invalido.'));
    };

    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Nao foi possivel carregar a imagem.'));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error('Nao foi possivel gerar a imagem otimizada.'));
      },
      type,
      quality,
    );
  });
}

async function optimizeImageAsset(file: File) {
  if (file.type === 'image/svg+xml') {
    return {
      inlineUrl: await readFileAsDataUrl(file),
      uploadFile: file,
      extension: 'svg',
    };
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImageElement(source);
  const maxDimension = 960;
  const ratio = Math.min(maxDimension / image.width, maxDimension / image.height, 1);
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Nao foi possivel preparar a imagem.');
  }

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const uploadBlob = await canvasToBlob(canvas, 'image/jpeg', 0.72);
  const inlineUrl = canvas.toDataURL('image/jpeg', 0.72);
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagem';
  const uploadFile = new File([uploadBlob], `${slugify(baseName) || 'imagem'}.jpg`, {
    type: 'image/jpeg',
  });

  return {
    inlineUrl,
    uploadFile,
    extension: 'jpg',
  };
}

export async function prepareSiteImage(file: File) {
  return optimizeImageAsset(file);
}

export async function uploadSiteImage(file: File, folder: string, nameHint: string) {
  const prepared = await optimizeImageAsset(file);

  if (!isSupabaseConfigured || !supabase) {
    return {
      url: prepared.inlineUrl,
      mode: 'inline' as const,
      warning: '',
    };
  }

  const objectPath = `${folder}/${slugify(nameHint) || 'imagem'}-${Date.now()}.${prepared.extension}`;
  const { error } = await supabase.storage.from(SITE_IMAGES_BUCKET).upload(objectPath, prepared.uploadFile, {
    upsert: false,
    cacheControl: '31536000',
    contentType: prepared.uploadFile.type,
  });

  if (error) {
    return {
      url: prepared.inlineUrl,
      mode: 'inline' as const,
      warning:
        'O upload online da imagem falhou. A imagem sera salva no modo compacto para nao travar a publicacao.',
    };
  }

  const { data } = supabase.storage.from(SITE_IMAGES_BUCKET).getPublicUrl(objectPath);

  return {
    url: data.publicUrl,
    mode: 'storage' as const,
    warning: '',
  };
}
