import type { LucideIcon } from 'lucide-react';
import { FileIcon, FileText, FileImage, FileVideo, FileAudio, FileSpreadsheet, FileCode, FileArchive } from 'lucide-react';

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('No se pudo leer el archivo'));
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Determina el icono y color a mostrar según el tipo de archivo (mime type o extensión).
 * Esta función es compartida entre componentes para mantener consistencia visual.
 * 
 * ⚠️ IMPORTANTE: Esta es la FUENTE DE VERDAD para la lógica de determinación de iconos.
 * Si cambias esta función, DEBES actualizar también backend/src/utils/asset-markers.js::getFileIconType()
 * para mantener consistencia entre frontend y backend.
 *
 * @param mimeType - Tipo MIME del archivo
 * @param fileName - Nombre del archivo (para extraer extensión)
 * @returns Objeto con el icono (componente Lucide) y el color hexadecimal
 */
export function getFileIcon(mimeType: string, fileName: string): { icon: LucideIcon; color: string } {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const mime = mimeType.toLowerCase();

  // PDF - debe ir primero porque algunos PDFs pueden tener mime types genéricos
  if (extension === 'pdf' || mime === 'application/pdf') {
    return { icon: FileText, color: '#dc2626' }; // red-600
  }

  // PowerPoint - verificar extensión primero
  if (extension === 'ppt' || extension === 'pptx' || 
      mime.includes('presentation') || mime.includes('powerpoint')) {
    return { icon: FileText, color: '#ea580c' }; // orange-600
  }

  // Word - verificar extensión primero
  if (extension === 'doc' || extension === 'docx' || 
      mime.includes('word') || mime === 'application/msword') {
    return { icon: FileText, color: '#2563eb' }; // blue-600
  }

  // Excel - verificar extensión primero
  if (extension === 'xls' || extension === 'xlsx' || 
      mime.includes('spreadsheet') || mime.includes('excel')) {
    return { icon: FileSpreadsheet, color: '#16a34a' }; // green-600
  }

  // Imágenes
  if (mime.startsWith('image/')) {
    return { icon: FileImage, color: '#9333ea' }; // purple-600
  }

  // Videos
  if (mime.startsWith('video/')) {
    return { icon: FileVideo, color: '#db2777' }; // pink-600
  }

  // Audio
  if (mime.startsWith('audio/')) {
    return { icon: FileAudio, color: '#4f46e5' }; // indigo-600
  }

  // Archivos comprimidos
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension) ||
      mime.includes('zip') || mime.includes('rar') || mime.includes('tar') || mime.includes('gzip')) {
    return { icon: FileArchive, color: '#ca8a04' }; // yellow-600
  }

  // Código
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml'].includes(extension) ||
      (mime.includes('text/') && ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml'].includes(extension))) {
    return { icon: FileCode, color: '#0891b2' }; // cyan-600
  }

  // Texto plano
  if (extension === 'txt' || mime.startsWith('text/')) {
    return { icon: FileText, color: '#4b5563' }; // gray-600
  }

  // Por defecto
  return { icon: FileIcon, color: '#6b7280' }; // gray-500
}

