import * as React from 'react'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import { brand, styles } from './_brand'

interface ReauthenticationEmailProps { token: string }

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação NexaBot</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.logoWrap}><Img src={brand.logoUrl} width="56" height="56" alt="NexaBot" style={styles.logo} /></Section>
        <Text style={styles.brandName}>NexaBot</Text>
        <Heading style={styles.h1}>Confirme sua identidade</Heading>
        <Text style={styles.text}>Use o código abaixo para confirmar sua identidade:</Text>
        <Text style={styles.code}>{token}</Text>
        <Text style={styles.footer}>Este código expira em breve. Se você não solicitou, ignore este e-mail.</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
