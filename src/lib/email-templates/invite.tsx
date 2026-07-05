import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Section, Text } from '@react-email/components'
import { brand, styles } from './_brand'

interface InviteEmailProps { siteName: string; siteUrl: string; confirmationUrl: string }

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidado para o {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.logoWrap}><Img src={brand.logoUrl} width="56" height="56" alt="NexaBot" style={styles.logo} /></Section>
        <Text style={styles.brandName}>{siteName}</Text>
        <Heading style={styles.h1}>Você recebeu um convite</Heading>
        <Text style={styles.text}>
          Você foi convidado a entrar em <Link href={siteUrl} style={styles.link}><strong>{siteName}</strong></Link>. Clique no botão abaixo para aceitar e criar sua conta.
        </Text>
        <Section style={styles.buttonWrap}><Button style={styles.button} href={confirmationUrl}>Aceitar convite</Button></Section>
        <Text style={styles.footer}>Se você não esperava este convite, pode ignorar este e-mail com segurança.</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
