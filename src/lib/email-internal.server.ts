// Internal (server-only) helper to render + enqueue transactional emails
// without going through the JWT-protected /lovable/email/transactional/send route.
import * as React from 'react'
import { render } from 'react-email'
import { TEMPLATES } from './email-templates/registry'

const SITE_NAME = 'omni-nexa-bot'
const SENDER_DOMAIN = 'notify.nexalytix.com.br'
const FROM_DOMAIN = 'notify.nexalytix.com.br'

export async function enqueueTransactionalEmail(opts: {
  templateName: string
  recipientEmail: string
  templateData?: Record<string, any>
  label?: string
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const template = TEMPLATES[opts.templateName]
  if (!template) return { ok: false, error: `unknown_template:${opts.templateName}` }

  const to = template.to ?? opts.recipientEmail
  if (!to) return { ok: false, error: 'missing_recipient' }

  // Skip if recipient is suppressed
  const { data: sup } = await supabaseAdmin
    .from('suppressed_emails')
    .select('email')
    .eq('email', to.toLowerCase())
    .maybeSingle()
  if (sup) return { ok: false, error: 'suppressed' }

  const data = opts.templateData ?? {}
  const element = React.createElement(template.component, data)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject = typeof template.subject === 'function' ? template.subject(data) : template.subject
  const messageId = crypto.randomUUID()

  await supabaseAdmin.from('email_send_log').insert({
    message_id: messageId,
    template_name: opts.templateName,
    recipient_email: to,
    status: 'pending',
  })

  const { error } = await supabaseAdmin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: opts.label ?? opts.templateName,
      queued_at: new Date().toISOString(),
    },
  })

  if (error) {
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: opts.templateName,
      recipient_email: to,
      status: 'failed',
      error_message: error.message,
    })
    return { ok: false, error: error.message }
  }
  return { ok: true, messageId }
}
