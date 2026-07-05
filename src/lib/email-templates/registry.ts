import type { ComponentType } from 'react'
import { template as leadNotification } from './lead-notification'
import { template as contactConfirmation } from './contact-confirmation'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'lead-notification': leadNotification,
  'contact-confirmation': contactConfirmation,
}
