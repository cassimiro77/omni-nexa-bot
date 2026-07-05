import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import { brand, styles } from './_brand'

interface RecoveryEmailProps { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefina sua senha no {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.logoWrap}><Img src={brand.logoUrl} width="56" height="56" alt="NexaBot" style={styles.logo} /></Section>
        <Text style={styles.brandName}>{siteName}</Text>
        <Heading style={styles.h1}>Redefinir sua senha</Heading>
        <Text style={styles.text}>Recebemos um pedido para redefinir a senha da sua conta no {siteName}. Clique no botão abaixo para escolher uma nova senha.</Text>
        <Section style={styles.buttonWrap}><Button style={styles.button} href={confirmationUrl}>Redefinir senha</Button></Section>
        <Text style={styles.footer}>Se você não pediu a redefinição, ignore este e-mail. Sua senha continuará a mesma.</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
