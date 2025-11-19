import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Upload, Trash2, Copy, Check, FileIcon, FileText, FileImage, FileVideo, FileAudio, FileSpreadsheet, FileCode, FileArchive, AlertCircle, CheckCircle2, RefreshCw, Search, X, FileCheck, ExternalLink, Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Spinner } from '@/components/common';
import { getEventAssets, uploadEventAsset, deleteEventAsset, updateEventAsset, validateEventAssets, checkMarkers, type EventAsset, type AssetValidationResult, type InvalidMarker } from '@/services/event-assets';

interface EventAssetsManagerProps {
  readonly eventId: number;
}

export function EventAssetsManager({ eventId }: EventAssetsManagerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState('');
  const [assetDescription, setAssetDescription] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Map<number, boolean>>(new Map());
  const [assetToOverwrite, setAssetToOverwrite] = useState<EventAsset | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [markersDialogOpen, setMarkersDialogOpen] = useState(false);
  const [invalidMarkers, setInvalidMarkers] = useState<InvalidMarker[]>([]);
  const [editingAsset, setEditingAsset] = useState<EventAsset | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data: assets, isLoading } = useQuery<EventAsset[]>({
    queryKey: ['event-assets', eventId],
    queryFn: () => getEventAssets(eventId)
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, name, description, overwrite }: { file: File; name: string; description?: string; overwrite?: boolean }) => 
      uploadEventAsset(eventId, file, name, overwrite || false, description),
    onSuccess: () => {
      toast.success(t('events.assetUploaded', { defaultValue: 'Archivo subido correctamente' }));
      setSelectedFile(null);
      setAssetName('');
      setAssetDescription('');
      setAssetToOverwrite(null);
      void queryClient.invalidateQueries({ queryKey: ['event-assets', eventId] });
      // Limpiar validación después de subir
      setValidationResults(new Map());
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || t('common.error');
      toast.error(message);
    }
  });

  const validateMutation = useMutation({
    mutationFn: () => validateEventAssets(eventId),
    onSuccess: (results: AssetValidationResult[]) => {
      const resultsMap = new Map<number, boolean>();
      for (const result of results) {
        resultsMap.set(result.id, result.exists);
      }
      setValidationResults(resultsMap);
      
      const missingCount = results.filter(r => !r.exists).length;
      if (missingCount === 0) {
        toast.success(t('events.allAssetsValid', { defaultValue: 'Todos los recursos están presentes en S3' }));
      } else {
        toast.warning(
          t('events.someAssetsMissing', { 
            count: missingCount,
            defaultValue: `Se encontraron ${missingCount} recurso(s) faltante(s) en S3` 
          })
        );
      }
    },
    onError: () => {
      toast.error(t('events.validationError', { defaultValue: 'Error al validar los recursos' }));
    }
  });

  const checkMarkersMutation = useMutation({
    mutationFn: () => checkMarkers(eventId),
    onSuccess: (result) => {
      setInvalidMarkers(result.invalidMarkers);
      setMarkersDialogOpen(true);
      
      if (result.totalInvalid === 0) {
        toast.success(t('events.allMarkersValid', { defaultValue: 'Todos los marcadores son correctos' }));
      } else {
        toast.warning(
          t('events.invalidMarkersFound', { 
            count: result.totalInvalid,
            defaultValue: `Se encontraron ${result.totalInvalid} marcador(es) incorrecto(s)` 
          })
        );
      }
    },
    onError: () => {
      toast.error(t('events.checkMarkersError', { defaultValue: 'Error al comprobar los marcadores' }));
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ assetId, data }: { assetId: number; data: { name?: string; description?: string | null } }) =>
      updateEventAsset(eventId, assetId, data),
    onSuccess: () => {
      toast.success(t('events.assetUpdated', { defaultValue: 'Recurso actualizado correctamente' }));
      setEditingAsset(null);
      setEditName('');
      setEditDescription('');
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
          .normalize('NFD')
          .replaceAll(/[\u0300-\u036f]/g, '')
          .replaceAll(/[^a-zA-Z0-9._-]/g, '_')
          .replaceAll(/_+/g, '_')
          .replaceAll(/^_+|_+$/g, '')
          .toLowerCase();
        setAssetName(suggestedName);
      }
      // Generar descripción sugerida basada en el nombre del archivo
      if (!assetDescription) {
        const suggestedDescription = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[_-]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ')
          .trim();
        setAssetDescription(suggestedDescription);
      }
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !assetName.trim()) {
      toast.error(t('events.assetNameRequired', { defaultValue: 'Debes seleccionar un archivo y proporcionar un nombre' }));
      return;
    }

    // Normalizar el nombre (eliminar acentos) antes de validar y enviar
    const normalizedName = assetName
      .normalize('NFD')
      .replaceAll(/[\u0300-\u036f]/g, '')
      .trim();
    
    // Validar formato del nombre
    const nameRegex = /^[a-zA-Z0-9._-]+$/;
    if (!nameRegex.test(normalizedName)) {
      toast.error(
        t('events.assetNameInvalid', {
          defaultValue: 'El nombre solo puede contener letras, números, guiones, puntos y guiones bajos'
        })
      );
      return;
    }

    // Verificar si existe un asset con ese nombre para sobreescribir
    const existingAsset = assets?.find(a => a.name === normalizedName);
    const overwrite = existingAsset !== undefined;

    if (overwrite && !assetToOverwrite) {
      // Si existe pero no se ha seleccionado explícitamente para sobreescribir, preguntar
      if (!confirm(t('events.confirmOverwrite', { 
        defaultValue: `Ya existe un recurso con el nombre "${normalizedName}". ¿Deseas sobreescribirlo?` 
      }))) {
        return;
      }
      setAssetToOverwrite(existingAsset);
    }

    uploadMutation.mutate({ 
      file: selectedFile, 
      name: normalizedName,
      description: assetDescription.trim() || undefined,
      overwrite: overwrite || assetToOverwrite?.name === normalizedName
    });
  };

  const handleValidate = () => {
    validateMutation.mutate();
  };

  const handleReupload = (asset: EventAsset) => {
    setAssetToOverwrite(asset);
    setAssetName(asset.name);
    setAssetDescription(asset.description || '');
    // Abrir el selector de archivos
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setSelectedFile(file);
      }
    };
    input.click();
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

  const handleOpenEditDialog = (asset: EventAsset) => {
    setEditingAsset(asset);
    setEditName(asset.name);
    setEditDescription(asset.description || '');
  };

  const handleCloseEditDialog = () => {
    setEditingAsset(null);
    setEditName('');
    setEditDescription('');
  };

  const handleSaveEdit = () => {
    if (!editingAsset) return;

    // Normalizar el nombre (eliminar acentos)
    const normalizedName = editName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // Validar formato del nombre
    const nameRegex = /^[a-zA-Z0-9._-]+$/;
    if (!nameRegex.test(normalizedName)) {
      toast.error(
        t('events.assetNameInvalid', {
          defaultValue: 'El nombre solo puede contener letras, números, guiones, puntos y guiones bajos'
        })
      );
      return;
    }

    updateMutation.mutate({
      assetId: editingAsset.id,
      data: {
        name: normalizedName !== editingAsset.name ? normalizedName : undefined,
        description: editDescription.trim() || null
      }
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Filtrar assets por nombre de archivo o marcador
  const filteredAssets = assets?.filter(asset => {
    if (!searchFilter.trim()) {
      return true;
    }
    const searchLower = searchFilter.toLowerCase();
    const fileName = (asset.original_filename || asset.name).toLowerCase();
    const marker = `{{asset:${asset.name}}}`.toLowerCase();
    return fileName.includes(searchLower) || marker.includes(searchLower);
  }) || [];


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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>{t('events.assetsTitle', { defaultValue: 'Recursos del evento' })}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkMarkersMutation.mutate()}
              disabled={checkMarkersMutation.isPending || isLoading}
            >
              {checkMarkersMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
                  {t('common.loading')}
                </>
              ) : (
                <>
                  <FileCheck className="h-4 w-4 mr-2" />
                  {t('events.checkMarkers', { defaultValue: 'Comprobar marcadores' })}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidate}
              disabled={validateMutation.isPending || isLoading || !assets || assets.length === 0}
            >
              {validateMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
                  {t('common.loading')}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('events.validateAssets', { defaultValue: 'Validar recursos' })}
                </>
              )}
            </Button>
          </div>
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
              />
              <p className="text-xs text-muted-foreground">
                {t('events.assetNameHint', {
                  defaultValue: 'Solo letras, números, guiones, puntos y guiones bajos. Los acentos se eliminarán automáticamente. Este nombre se usará en los marcadores.'
                })}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('events.assetDescription', { defaultValue: 'Descripción' })}
              </label>
              <Input
                value={assetDescription}
                onChange={e => setAssetDescription(e.target.value)}
                placeholder={t('events.assetDescriptionPlaceholder', { defaultValue: 'Texto descriptivo que se mostrará en lugar de la URL' })}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {t('events.assetDescriptionHint', {
                  defaultValue: 'Texto que se mostrará cuando se use el marcador en lugar de la URL completa. Si se deja vacío, se usará el nombre del archivo.'
                })}
              </p>
            </div>
            {assetToOverwrite && (
              <div className="rounded-md bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800">
                {t('events.overwritingAsset', { 
                  name: assetToOverwrite.name,
                  defaultValue: `Sobreescribiendo recurso: ${assetToOverwrite.name}` 
                })}
              </div>
            )}
            <Button onClick={handleUpload} disabled={!selectedFile || !assetName.trim() || uploadMutation.isPending}>
              <Upload className="h-4 w-4 mr-2" />
              {uploadMutation.isPending 
                ? t('common.loading') 
                : (assetToOverwrite 
                  ? t('events.overwriteAsset', { defaultValue: 'Sobreescribir archivo' })
                  : t('events.uploadAsset', { defaultValue: 'Subir archivo' }))
              }
            </Button>
          </div>

          {isLoading ? (
            <Spinner />
          ) : assets && assets.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('events.uploadedAssets', { defaultValue: 'Archivos subidos' })}</h3>
                {assets.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {filteredAssets.length} / {assets.length}
                  </span>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('events.searchAssets', { defaultValue: 'Buscar por nombre de archivo o marcador...' })}
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={t('common.clear', { defaultValue: 'Limpiar búsqueda' })}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {filteredAssets.length === 0 && searchFilter ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {t('events.noAssetsFound', { defaultValue: 'No se encontraron recursos que coincidan con la búsqueda' })}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAssets.map(asset => {
                  const { icon: FileTypeIcon, color } = getFileIcon(asset.mime_type, asset.original_filename);
                  return (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between rounded-md border border-border/60 bg-card/60 p-3"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span title={asset.mime_type} className="flex-shrink-0">
                          <FileTypeIcon 
                            className="h-5 w-5"
                            style={{ color }}
                          />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate" title={asset.name}>
                              {asset.description || asset.original_filename || asset.name}
                            </p>
                            {validationResults.has(asset.id) && (
                              validationResults.get(asset.id) ? (
                                <span title={t('events.assetExists', { defaultValue: 'Recurso encontrado en S3' })}>
                                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" aria-label={t('events.assetExists', { defaultValue: 'Recurso encontrado en S3' })} />
                                </span>
                              ) : (
                                <span title={t('events.assetMissing', { defaultValue: 'Recurso no encontrado en S3' })}>
                                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" aria-label={t('events.assetMissing', { defaultValue: 'Recurso no encontrado en S3' })} />
                                </span>
                              )
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(asset.file_size)}
                              {validationResults.has(asset.id) && !validationResults.get(asset.id) && (
                                <span className="text-red-600 ml-2">
                                  {t('events.missingInS3', { defaultValue: '(Faltante en S3)' })}
                                </span>
                              )}
                            </p>
                            <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                              {`{{asset:${asset.name}}}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {validationResults.has(asset.id) && !validationResults.get(asset.id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReupload(asset)}
                          title={t('events.reuploadAsset', { defaultValue: 'Re-subir archivo' })}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEditDialog(asset)}
                        title={t('common.edit', { defaultValue: 'Editar' })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyUrl(asset.url)}
                        title={t('events.copyUrl', { defaultValue: 'Copiar URL' })}
                      >
                        {copiedUrl === asset.url ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            {t('events.url', { defaultValue: 'URL' })}
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            {t('events.url', { defaultValue: 'URL' })}
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyMarker(asset.name)}
                        title={t('events.copyMarker', { defaultValue: 'Copiar marcador' })}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {t('events.marker', { defaultValue: 'Marcador' })}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(asset.url, '_blank', 'noopener,noreferrer')}
                        title={t('events.viewAsset', { defaultValue: 'Ver recurso' })}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t('events.view', { defaultValue: 'Ver' })}
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
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('events.noAssets', { defaultValue: 'No hay archivos subidos' })}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={markersDialogOpen} onOpenChange={setMarkersDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('events.markersCheckResults', { defaultValue: 'Resultados de comprobación de marcadores' })}
            </DialogTitle>
            <DialogDescription>
              {invalidMarkers.length === 0
                ? t('events.allMarkersValidDesc', { defaultValue: 'Todos los marcadores son correctos y referencian recursos existentes.' })
                : t('events.invalidMarkersDesc', { 
                    count: invalidMarkers.length,
                    defaultValue: `Se encontraron ${invalidMarkers.length} marcador(es) que referencian recursos que no existen.` 
                  })
              }
            </DialogDescription>
          </DialogHeader>
          
          {invalidMarkers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mb-4" />
              <p className="text-sm text-muted-foreground">
                {t('events.noInvalidMarkers', { defaultValue: 'No se encontraron marcadores incorrectos.' })}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {invalidMarkers.map((marker, index) => (
                <div
                  key={`${marker.type}-${marker.id}-${index}`}
                  className="rounded-md border border-red-200 bg-red-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-red-800 uppercase">
                          {marker.type === 'phase' && t('events.phase', { defaultValue: 'Fase' })}
                          {marker.type === 'task' && t('events.task', { defaultValue: 'Tarea' })}
                          {marker.type === 'event' && t('events.event', { defaultValue: 'Evento' })}
                        </span>
                      </div>
                      {marker.type === 'phase' && (
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          {marker.name}
                        </p>
                      )}
                      {marker.type === 'task' && (
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {marker.title}
                          </p>
                          <p className="text-xs text-gray-600">
                            {t('events.inPhase', { 
                              phase: marker.phaseName,
                              defaultValue: `En fase: ${marker.phaseName}` 
                            })}
                          </p>
                        </div>
                      )}
                      {marker.type === 'event' && (
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          {marker.name}
                        </p>
                      )}
                      <div className="mt-2 pt-2 border-t border-red-200">
                        <p className="text-xs text-gray-600 mb-1">
                          {t('events.invalidMarker', { defaultValue: 'Marcador incorrecto:' })}
                        </p>
                        <code className="text-sm font-mono bg-red-100 text-red-900 px-2 py-1 rounded">
                          {marker.marker}
                        </code>
                        <p className="text-xs text-gray-600 mt-2">
                          {t('events.missingAsset', { 
                            asset: marker.assetName,
                            defaultValue: `Recurso faltante: ${marker.assetName}` 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setMarkersDialogOpen(false)}>
              {t('common.close', { defaultValue: 'Cerrar' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingAsset !== null} onOpenChange={handleCloseEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('events.editAsset', { defaultValue: 'Editar recurso' })}
            </DialogTitle>
            <DialogDescription>
              {t('events.editAssetDescription', { defaultValue: 'Modifica el nombre del marcador y la descripción del recurso.' })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('events.assetName', { defaultValue: 'Nombre del recurso' })}
                <span className="text-destructive ml-1">*</span>
              </label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder={t('events.assetNamePlaceholder', { defaultValue: 'nombre-del-recurso' })}
              />
              <p className="text-xs text-muted-foreground">
                {t('events.assetNameHint', {
                  defaultValue: 'Solo letras, números, guiones, puntos y guiones bajos. Los acentos se eliminarán automáticamente. Este nombre se usará en los marcadores.'
                })}
              </p>
              {editingAsset && (
                <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                  {t('events.markerPreview', { defaultValue: 'Marcador:' })} {`{{asset:${editName}}}`}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('events.assetDescription', { defaultValue: 'Descripción' })}
              </label>
              <Input
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder={t('events.assetDescriptionPlaceholder', { defaultValue: 'Texto descriptivo que se mostrará en lugar de la URL' })}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {t('events.assetDescriptionHint', {
                  defaultValue: 'Texto que se mostrará cuando se use el marcador en lugar de la URL completa. Si se deja vacío, se usará el nombre del archivo.'
                })}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditDialog}>
              {t('common.cancel', { defaultValue: 'Cancelar' })}
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending || !editName.trim()}>
              {updateMutation.isPending ? t('common.loading') : t('common.save', { defaultValue: 'Guardar' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

