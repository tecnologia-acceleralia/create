import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Upload, Trash2, Copy, Check, FileIcon, FileText, FileImage, FileVideo, FileAudio, FileSpreadsheet, FileCode, FileArchive } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/common';
import { getEventAssets, uploadEventAsset, deleteEventAsset, type EventAsset } from '@/services/event-assets';

interface EventAssetsManagerProps {
  eventId: number;
}

export function EventAssetsManager({ eventId }: EventAssetsManagerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const { data: assets, isLoading } = useQuery<EventAsset[]>({
    queryKey: ['event-assets', eventId],
    queryFn: () => getEventAssets(eventId)
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) => uploadEventAsset(eventId, file, name),
    onSuccess: () => {
      toast.success(t('events.assetUploaded', { defaultValue: 'Archivo subido correctamente' }));
      setSelectedFile(null);
      setAssetName('');
      void queryClient.invalidateQueries({ queryKey: ['event-assets', eventId] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || t('common.error');
      toast.error(message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (assetId: number) => deleteEventAsset(eventId, assetId),
    onSuccess: () => {
      toast.success(t('events.assetDeleted', { defaultValue: 'Archivo eliminado correctamente' }));
      void queryClient.invalidateQueries({ queryKey: ['event-assets', eventId] });
    },
    onError: () => {
      toast.error(t('common.error'));
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Generar nombre sugerido basado en el nombre del archivo
      if (!assetName) {
        const suggestedName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .toLowerCase();
        setAssetName(suggestedName);
      }
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !assetName.trim()) {
      toast.error(t('events.assetNameRequired', { defaultValue: 'Debes seleccionar un archivo y proporcionar un nombre' }));
      return;
    }

    // Validar formato del nombre
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(assetName.trim())) {
      toast.error(
        t('events.assetNameInvalid', {
          defaultValue: 'El nombre solo puede contener letras, números, guiones y guiones bajos'
        })
      );
      return;
    }

    uploadMutation.mutate({ file: selectedFile, name: assetName.trim() });
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast.success(t('events.urlCopied', { defaultValue: 'URL copiada al portapapeles' }));
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleCopyMarker = async (name: string) => {
    const marker = `{{asset:${name}}}`;
    try {
      await navigator.clipboard.writeText(marker);
      toast.success(t('events.markerCopied', { defaultValue: 'Marcador copiado al portapapeles' }));
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };


  const getFileIcon = (mimeType: string, fileName: string): { icon: LucideIcon; color: string } => {
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
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>{t('events.assetsTitle', { defaultValue: 'Recursos del evento' })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4 rounded-lg border border-border/70 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('events.selectFile', { defaultValue: 'Seleccionar archivo' })}</label>
              <Input
                type="file"
                onChange={handleFileSelect}
                className="cursor-pointer"
                accept="*/*"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('events.assetName', { defaultValue: 'Nombre del recurso' })}
                <span className="text-destructive ml-1">*</span>
              </label>
              <Input
                value={assetName}
                onChange={e => setAssetName(e.target.value)}
                placeholder={t('events.assetNamePlaceholder', { defaultValue: 'nombre-del-recurso' })}
                pattern="[a-zA-Z0-9_-]+"
              />
              <p className="text-xs text-muted-foreground">
                {t('events.assetNameHint', {
                  defaultValue: 'Solo letras, números, guiones y guiones bajos. Este nombre se usará en los marcadores.'
                })}
              </p>
            </div>
            <Button onClick={handleUpload} disabled={!selectedFile || !assetName.trim() || uploadMutation.isPending}>
              <Upload className="h-4 w-4 mr-2" />
              {uploadMutation.isPending ? t('common.loading') : t('events.uploadAsset', { defaultValue: 'Subir archivo' })}
            </Button>
          </div>

          {isLoading ? (
            <Spinner />
          ) : assets && assets.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{t('events.uploadedAssets', { defaultValue: 'Archivos subidos' })}</h3>
              <div className="space-y-2">
                {assets.map(asset => {
                  const { icon: FileTypeIcon, color } = getFileIcon(asset.mime_type, asset.original_filename);
                  return (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between rounded-md border border-border/60 bg-card/60 p-3"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileTypeIcon 
                          className="h-5 w-5 flex-shrink-0"
                          style={{ color }}
                          title={asset.mime_type}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" title={asset.name}>
                            {asset.original_filename || asset.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(asset.file_size)}
                          </p>
                        </div>
                      </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyUrl(asset.url)}
                        title={t('events.copyUrl', { defaultValue: 'Copiar URL' })}
                      >
                        {copiedUrl === asset.url ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyMarker(asset.name)}
                        title={t('events.copyMarker', { defaultValue: 'Copiar marcador' })}
                      >
                        {t('events.marker', { defaultValue: 'Marcador' })}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm(t('events.confirmDeleteAsset', { defaultValue: '¿Eliminar este archivo?' }))) {
                            deleteMutation.mutate(asset.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('events.noAssets', { defaultValue: 'No hay archivos subidos' })}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

