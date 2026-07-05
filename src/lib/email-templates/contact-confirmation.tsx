import * as React from 'react'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import { brand, styles } from './_brand'
import type { TemplateEntry } from './registry'

interface ContactConfirmationProps {
  name?: string
  siteName?: string
}

const ContactConfirmationEmail = ({ name, siteName }: ContactConfirmationProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Recebemos sua mensagem — {siteName ?? 'NexaBot'}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.logoWrap}><Img src={brand.logoUrl} width="56" height="56" alt="NexaBot" style={styles.logo} /></Section>
        <Text style={styles.brandName}>{siteName ?? 'NexaBot'}</Text>
        <Heading style={styles.h1}>Recebemos sua mensagem</Heading>
        <Text style={styles.text}>Olá{name ? `, ${name}` : ''}!</Text>
        <Text style={styles.text}>Obrigado pelo contato. Nossa equipe já foi notificada e retornará em breve.</Text>
        <Text style={styles.text}>Se preferir, você pode continuar a conversa direto pelo chat no site.</Text>
        <Text style={styles.footer}>Este é um e-mail automático de confirmação enviado pelo NexaBot.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactConfirmationEmail,
  subject: (data: Record<string, any>) => `Recebemos sua mensagem${data.siteName ? ` — ${data.siteName}` : ''}`,
  displayName: 'Confirmação de contato',
  previewData: { name: 'Maria', siteName: 'Nexalytix' },
} satisfies TemplateEntry

export default ContactConfirmationEmail
