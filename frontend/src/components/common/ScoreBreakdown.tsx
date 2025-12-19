import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseEvaluationBreakdown, type CriterionScore } from '@/utils/evaluation-parser';
import { getMultilingualText } from '@/utils/multilingual';
import { safeTranslate } from '@/utils/i18n-helpers';
import { Calculator } from 'lucide-react';

interface ScoreBreakdownProps {
  comment: string;
  rubricCriteria?: Array<{ 
    title: string | { es?: string; ca?: string; en?: string };
    weight?: number;
    maxScore?: number | null;
  }>;
  currentLang?: 'es' | 'ca' | 'en';
  finalScore?: number | null;
}

export function ScoreBreakdown({ comment, rubricCriteria, currentLang = 'es', finalScore }: ScoreBreakdownProps) {
  const { t } = useTranslation();
  
  // Normalizar criterios de rúbrica para el parser
  const normalizedCriteria = useMemo(() => {
    if (!rubricCriteria) return undefined;
    return rubricCriteria.map(c => ({
      title: typeof c.title === 'string' ? c.title : getMultilingualText(c.title, currentLang),
      weight: c.weight,
      maxScore: c.maxScore
    }));
  }, [rubricCriteria, currentLang]);
  
  const breakdown = useMemo(() => {
    return parseEvaluationBreakdown(comment || '', normalizedCriteria);
  }, [comment, normalizedCriteria]);
  
  // Si no hay criterios parseados, no mostrar nada
  if (breakdown.criteria.length === 0) {
    return null;
  }
  
  const displayScore = finalScore ?? breakdown.finalScore ?? breakdown.calculatedScore;
  
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          {safeTranslate(t, 'evaluations.scoreBreakdown', { defaultValue: 'Desglose de Puntuación' })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de criterios */}
        <div className="space-y-3">
          {breakdown.criteria.map((criterion, index) => (
            <div key={index} className="flex items-start justify-between gap-4 p-3 rounded-md border bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{criterion.criterionName}</div>
                {criterion.weight !== undefined && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {safeTranslate(t, 'evaluations.weight', { defaultValue: 'Peso' })}: {criterion.weight}%
                    {criterion.maxScore !== undefined && (
                      <> · {safeTranslate(t, 'evaluations.maxScore', { defaultValue: 'Máx' })}: {criterion.maxScore}</>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-semibold text-lg">{criterion.score.toFixed(2)}</div>
                {criterion.maxScore !== undefined && (
                  <div className="text-xs text-muted-foreground">
                    / {criterion.maxScore}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Cálculo de la nota final */}
        {breakdown.calculatedScore !== null && (
          <div className="pt-3 border-t space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {safeTranslate(t, 'evaluations.calculatedScore', { defaultValue: 'Nota calculada (media ponderada)' })}:
              </span>
              <span className="font-semibold">{breakdown.calculatedScore.toFixed(2)}</span>
            </div>
            {breakdown.finalScore !== null && breakdown.finalScore !== breakdown.calculatedScore && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {safeTranslate(t, 'evaluations.finalScoreFromComment', { defaultValue: 'Nota final (del comentario)' })}:
                </span>
                <span className="font-semibold">{breakdown.finalScore.toFixed(2)}</span>
              </div>
            )}
            {displayScore !== null && (
              <div className="flex items-center justify-between pt-2 border-t font-semibold">
                <span>
                  {safeTranslate(t, 'evaluations.finalScore', { defaultValue: 'Nota Final' })}:
                </span>
                <span className="text-lg text-primary">{displayScore.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

