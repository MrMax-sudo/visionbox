/**
 * imageCompress.ts — Redimensiona e otimiza imagens no cliente antes do envio.
 * Evita erro 413 Request Entity Too Large e melhora o desempenho mobile.
 */
export async function comprimirImagem(
  file: File,
  maxDimension = 1024,
  qualidade = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
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
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Gera JPEG otimizado
        const base64Otimizado = canvas.toDataURL('image/jpeg', qualidade);
        resolve(base64Otimizado);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
