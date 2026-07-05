import * as React from 'react'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import { brand, styles } from './_brand'
import type { TemplateEntry } from './registry'

interface LeadNotificationProps {
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  source?: string
  message?: string
}

const LeadNotificationEmail = ({ contactName, contactEmail, contactPhone, source, message }: LeadNotificationProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Novo lead capturado pelo NexaBot</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.logoWrap}><Img src={brand.logoUrl} width="56" height="56" alt="NexaBot" style={styles.logo} /></Section>
        <Text style={styles.brandName}>NexaBot</Text>
        <Heading style={styles.h1}>Novo lead recebido</Heading>
        <Text style={styles.text}><strong style={{ color: '#00E5FF' }}>Origem:</strong> {source ?? '—'}</Text>
        <Text style={styles.text}><strong style={{ color: '#00E5FF' }}>Nome:</strong> {contactName ?? '—'}</Text>
        <Text style={styles.text}><strong style={{ color: '#00E5FF' }}>E-mail:</strong> {contactEmail ?? '—'}</Text>
        <Text style={styles.text}><strong style={{ color: '#00E5FF' }}>Telefone:</strong> {contactPhone ?? '—'}</Text>
        {message ? (
          <Text style={{ ...styles.text, borderLeft: '3px solid #00E5FF', paddingLeft: '12px', fontStyle: 'italic' }}>
            "{message}"
          </Text>
        ) : null}
        <Text style={styles.footer}>Abra o Inbox do NexaBot para responder e qualificar este lead.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LeadNotificationEmail,
  subject: (data: Record<string, any>) => `Novo lead${data.source ? ` — ${data.source}` : ''}`,
  displayName: 'Notificação de novo lead',
  previewData: { contactName: 'Maria Silva', contactEmail: 'maria@exemplo.com', contactPhone: '5511999998888', source: 'nexalytix', message: 'Gostaria de saber mais sobre a solução.' },
} satisfies TemplateEntry

export default LeadNotificationEmail
