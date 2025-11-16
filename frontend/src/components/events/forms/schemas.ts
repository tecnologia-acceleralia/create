import { z } from 'zod';

export const phaseSchema = z
  .object({
    name: z.string().min(3),
    description: z.string().optional(),
    intro_html: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    view_start_date: z.string().optional(),
    view_end_date: z.string().optional(),
    order_index: z.union([z.number().int().min(0), z.nan()]).optional(),
    is_elimination: z.boolean().optional()
  })
  .superRefine((data, ctx) => {
    if (data.start_date && data.end_date) {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start > end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'events.phaseEndAfterStart',
          path: ['end_date']
        });
      }
    }

    if (data.view_start_date && data.view_end_date) {
      const viewStart = new Date(data.view_start_date);
      const viewEnd = new Date(data.view_end_date);
      if (!Number.isNaN(viewStart.getTime()) && !Number.isNaN(viewEnd.getTime()) && viewStart > viewEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'events.phaseVisibilityInvalid',
          path: ['view_end_date']
        });
      }
    }
  });

export const taskSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  intro_html: z.string().optional(),
  phase_id: z.number().int(),
  delivery_type: z.enum(['text', 'file', 'url', 'video', 'audio', 'zip']).default('file'),
  due_date: z.string().optional(),
  is_required: z.boolean().optional(),
  order_index: z.union([z.number().int().min(0), z.nan()]).optional(),
  max_files: z.union([z.number().int().min(1), z.nan()]).optional(),
  max_file_size_mb: z.union([z.number().int().min(1), z.nan()]).optional(),
  allowed_mime_types: z.string().optional(),
  phase_rubric_id: z.union([z.number().int(), z.nan()]).optional()
});

export const rubricCriterionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  weight: z.union([z.number().min(0), z.nan()]).optional(),
  max_score: z.union([z.number().min(0), z.nan(), z.null()]).optional(),
  order_index: z.union([z.number().int().min(1), z.nan()]).optional()
});

export const rubricSchema = z
  .object({
    rubric_scope: z.enum(['phase', 'project']).default('phase'),
    phase_id: z.union([z.number().int(), z.nan(), z.null()]).optional(),
    name: z.string().min(3),
    description: z.string().optional(),
    scale_min: z.union([z.number(), z.nan()]).optional(),
    scale_max: z.union([z.number(), z.nan()]).optional(),
    model_preference: z.string().optional(),
    criteria: z.array(rubricCriterionSchema).min(1)
  })
  .superRefine((data, ctx) => {
    if (data.rubric_scope === 'phase' && (!data.phase_id || Number.isNaN(data.phase_id))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'events.rubricPhaseRequired',
        path: ['phase_id']
      });
    }
    if (data.rubric_scope === 'project' && data.phase_id && !Number.isNaN(data.phase_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'events.rubricProjectNoPhase',
        path: ['phase_id']
      });
    }
  });

export const eventSchema = z
  .object({
    name: z.string().min(3),
    description: z.string().optional(),
    description_html: z.string().optional(),
    start_date: z.string(),
    end_date: z.string(),
    min_team_size: z.number().min(1),
    max_team_size: z.number().min(1),
    status: z.enum(['draft', 'published', 'archived']),
    video_url: z
      .union([z.string().url(), z.literal('')])
      .optional()
      .transform(value => (value && value !== '' ? value : undefined))
      .pipe(z.string().url().optional()),
    is_public: z.boolean().optional(),
    allow_open_registration: z.boolean().optional(),
    publish_start_at: z.string().optional(),
    publish_end_at: z.string().optional(),
    registration_schema: z.any().optional()
  })
  .superRefine((values, ctx) => {
    if (values.publish_start_at && values.publish_end_at) {
      const start = new Date(values.publish_start_at);
      const end = new Date(values.publish_end_at);
      if (start > end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'events.publishEndAfterStart',
          path: ['publish_end_at']
        });
      }
    }
  });

export type PhaseFormValues = z.infer<typeof phaseSchema>;
export type TaskFormValues = z.infer<typeof taskSchema>;
export type RubricFormValues = z.infer<typeof rubricSchema>;
export type EventFormValues = z.infer<typeof eventSchema>;


