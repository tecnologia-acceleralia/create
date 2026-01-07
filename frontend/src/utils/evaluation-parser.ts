/**
 * Utilidades para parsear y extraer información de evaluaciones
 */

export interface CriterionScore {
  criterionName: string;
  score: number;
  weight?: number;
  maxScore?: number;
}

export interface EvaluationBreakdown {
  criteria: CriterionScore[];
  finalScore: number | null;
  calculatedScore: number | null; // Nota calculada a partir de los criterios
}

/**
 * Extrae las notas de cada criterio del comentario de evaluación
 * El formato esperado es:
 * CRITERIO X: [Nombre]
 * Nota: [X puntos]
 */
export function parseCriterionScores(comment: string, rubricCriteria?: Array<{ title: string; weight?: number; maxScore?: number | null }>): CriterionScore[] {
  if (!comment) return [];

  const criteria: CriterionScore[] = [];
  
  // Buscar patrones como "CRITERIO X: [Nombre]" seguido de "Nota: [X puntos]"
  // También puede aparecer como "CRITERIO: [Nombre]" o variaciones
  // El patrón busca "CRITERIO" seguido opcionalmente de un número, dos puntos, el nombre del criterio,
  // y luego en la misma línea o en líneas siguientes busca "Nota:" seguido de un número
  // Usamos un patrón más flexible que busca el criterio y luego la nota en las siguientes líneas
  const lines = comment.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Buscar línea que empiece con "CRITERIO"
    const criterionMatch = line.match(/^CRITERIO\s*(?:\d+)?\s*:?\s*(.+)$/i);
    if (criterionMatch) {
      const criterionName = criterionMatch[1].trim();
      
      // Buscar la nota en las siguientes líneas (hasta 5 líneas después)
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const noteLine = lines[j].trim();
        const noteMatch = noteLine.match(/^Nota\s*:?\s*(\d+(?:\.\d+)?)\s*(?:puntos?)?/i);
        
        if (noteMatch) {
          const score = parseFloat(noteMatch[1]);
          
          if (!isNaN(score)) {
            // Buscar el criterio en la rúbrica para obtener peso y maxScore
            const rubricCriterion = rubricCriteria?.find(c => {
              // Comparar nombres (puede ser multilingüe, así que comparamos de forma flexible)
              const rubricTitle = c.title || '';
              const normalizedCriterionName = criterionName.toLowerCase().trim();
              const normalizedRubricTitle = rubricTitle.toLowerCase().trim();
              
              // Comparación flexible: si uno contiene al otro o son muy similares
              return normalizedRubricTitle.includes(normalizedCriterionName) || 
                     normalizedCriterionName.includes(normalizedRubricTitle) ||
                     normalizedCriterionName === normalizedRubricTitle;
            });
            
            criteria.push({
              criterionName,
              score,
              weight: rubricCriterion?.weight,
              maxScore: rubricCriterion?.maxScore ?? undefined
            });
          }
          break; // Encontramos la nota, pasar al siguiente criterio
        }
      }
    }
  }
  
  return criteria;
}

/**
 * Calcula la nota final como media ponderada de los criterios
 */
export function calculateWeightedScore(criteria: CriterionScore[]): number | null {
  if (criteria.length === 0) return null;
  
  // Si no hay pesos, calcular media simple
  const hasWeights = criteria.some(c => c.weight !== undefined && c.weight !== null);
  
  if (!hasWeights) {
    const sum = criteria.reduce((acc, c) => acc + c.score, 0);
    return sum / criteria.length;
  }
  
  // Calcular media ponderada
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const criterion of criteria) {
    const weight = criterion.weight ?? 1;
    totalWeight += weight;
    weightedSum += criterion.score * weight;
  }
  
  if (totalWeight === 0) return null;
  
  return weightedSum / totalWeight;
}

/**
 * Extrae la nota global del comentario
 */
export function extractFinalScore(comment: string): number | null {
  if (!comment) return null;
  
  const patterns = [
    /NOTA GLOBAL:\s*(\d+(?:\.\d+)?)\s*puntos?/gi,
    /NOTA GLOBAL:\s*(\d+(?:\.\d+)?)/gi,
    /NOTA FINAL:\s*(\d+(?:\.\d+)?)\s*puntos?/gi,
    /NOTA FINAL:\s*(\d+(?:\.\d+)?)/gi
  ];
  
  for (const pattern of patterns) {
    const matches = [...comment.matchAll(pattern)];
    if (matches.length > 0) {
      // Tomar la última coincidencia (debería ser la nota final)
      const lastMatch = matches[matches.length - 1];
      const score = parseFloat(lastMatch[1]);
      if (!isNaN(score)) {
        return score;
      }
    }
  }
  
  return null;
}

/**
 * Parsea el comentario completo y extrae el desglose de notas
 */
export function parseEvaluationBreakdown(
  comment: string,
  rubricCriteria?: Array<{ title: string; weight?: number; maxScore?: number | null }>
): EvaluationBreakdown {
  const criteria = parseCriterionScores(comment, rubricCriteria);
  const finalScore = extractFinalScore(comment);
  const calculatedScore = calculateWeightedScore(criteria);
  
  return {
    criteria,
    finalScore,
    calculatedScore
  };
}

