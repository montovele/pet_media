import { z } from 'zod'
import type { ActivityCategory } from '../../../types/content'

export const activityCategoryLabels: Record<ActivityCategory, string> = {
  walk: 'Paseo',
  travel: 'Viaje',
  food: 'Comida',
  wellness: 'Bienestar',
  culture: 'Cultura',
  other: 'Otro',
}

export const activityFormSchema = z.object({
  animalId: z.string().uuid('Selecciona un animal.'),
  title: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres.').max(120),
  description: z.string().trim().max(500),
  date: z.iso.date('Selecciona una fecha válida.'),
  locationName: z.string().trim().max(180),
  category: z.enum(['walk', 'travel', 'food', 'wellness', 'culture', 'other']),
})