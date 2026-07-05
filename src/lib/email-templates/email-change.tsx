import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Section, Text } from '@react-email/components'
import { brand, styles } from './_brand'

interface EmailChangeEmailProps { siteName: string; oldEmail: string; email: string; newEmail: string; confirmationUrl: string }

export const EmailChangeEmail = ({ siteName, oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme a troca de e-mail no {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.logoWrap}><Img src={brand.logoUrl} width="56" height="56" alt="NexaBot" style={styles.logo} /></Section>
        <Text style={styles.brandName}>{siteName}</Text>
        <Heading style={styles.h1}>Confirmar troca de e-mail</Heading>
        <Text style={styles.text}>
          Você solicitou trocar o e-mail da sua conta no {siteName} de{' '}
          <Link href={`mailto:${oldEmail}`} style={styles.link}>{oldEmail}</Link> para{' '}
          <Link href={`mailto:${newEmail}`} style={styles.link}>{newEmail}</Link>.
        </Text>
        <Section style={styles.buttonWrap}><Button style={styles.button} href={confirmationUrl}>Confirmar troca</Button></Section>
        <Text style={styles.footer}>Se você não fez este pedido, proteja sua conta imediatamente.</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
