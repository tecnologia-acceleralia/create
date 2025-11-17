import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/common';
import { getEventAssets, type EventAsset } from '@/services/event-assets';

interface AssetMarkerSelectorProps {
  eventId: number;
}

export function AssetMarkerSelector({ eventId }: AssetMarkerSelectorProps) {
  const { t } = useTranslation();
  const [copiedMarker, setCopiedMarker] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string>('');

  const { data: assets, isLoading } = useQuery<EventAsset[]>({
    queryKey: ['event-assets', eventId],
    queryFn: () => getEventAssets(eventId),
    enabled: !!eventId
  });

  const handleCopyMarker = async (name: string) => {
    const marker = `{{asset:${name}}}`;
    try {
      await navigator.clipboard.writeText(marker);
      setCopiedMarker(name);
      toast.success(t('events.markerCopied', { defaultValue: 'Marcador copiado al portapapeles' }));
      setTimeout(() => {
        setCopiedMarker(null);
        setSelectedValue('');
      }, 2000);
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    if (selectedName) {
      handleCopyMarker(selectedName);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Spinner />
      </div>
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <div className="rounded-md border border-border/60 bg-card/60 p-3 text-sm text-muted-foreground">
        {t('events.noAssetsForMarkers', { defaultValue: 'No hay recursos disponibles para generar marcadores' })}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-card/60 p-3">
      <label className="text-sm font-medium text-foreground">
        {t('events.selectMarker', { defaultValue: 'Seleccionar marcador' })}
      </label>
      <div className="flex gap-2">
        <Select
          value={selectedValue}
          onChange={handleSelectChange}
          className="flex-1"
        >
          <option value="">
            {t('events.selectMarkerPlaceholder', { defaultValue: 'Selecciona un recurso...' })}
          </option>
          {assets.map(asset => (
            <option key={asset.id} value={asset.name}>
              {asset.original_filename || asset.name}
            </option>
          ))}
        </Select>
        {assets.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const firstAsset = assets[0];
              if (firstAsset) {
                handleCopyMarker(firstAsset.name);
              }
            }}
            title={t('events.copyFirstMarker', { defaultValue: 'Copiar primer marcador' })}
          >
            {copiedMarker ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('events.markerHint', {
          defaultValue: 'Selecciona un recurso y se copiará el marcador {{asset:nombre}} al portapapeles para pegarlo en el HTML.'
        })}
      </p>
    </div>
  );
}

