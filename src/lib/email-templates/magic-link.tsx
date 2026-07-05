import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import { brand, styles } from './_brand'

interface MagicLinkEmailProps { siteName: string; confirmationUrl: string }

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso ao {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.logoWrap}><Img src={brand.logoUrl} width="56" height="56" alt="NexaBot" style={styles.logo} /></Section>
        <Text style={styles.brandName}>{siteName}</Text>
        <Heading style={styles.h1}>Seu link de acesso</Heading>
        <Text style={styles.text}>Clique no botão abaixo para entrar no {siteName}. Este link expira em breve.</Text>
        <Section style={styles.buttonWrap}><Button style={styles.button} href={confirmationUrl}>Entrar</Button></Section>
        <Text style={styles.footer}>Se você não solicitou este link, pode ignorar este e-mail.</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
