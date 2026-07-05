import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Section, Text } from '@react-email/components'
import { brand, styles } from './_brand'

interface SignupEmailProps { siteName: string; siteUrl: string; recipient: string; confirmationUrl: string }

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail no {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.logoWrap}><Img src={brand.logoUrl} width="56" height="56" alt="NexaBot" style={styles.logo} /></Section>
        <Text style={styles.brandName}>{siteName}</Text>
        <Heading style={styles.h1}>Confirme seu e-mail</Heading>
        <Text style={styles.text}>
          Obrigado por se cadastrar em <Link href={siteUrl} style={styles.link}>{siteName}</Link>.
        </Text>
        <Text style={styles.text}>
          Confirme o endereço <Link href={`mailto:${recipient}`} style={styles.link}>{recipient}</Link> clicando no botão abaixo:
        </Text>
        <Section style={styles.buttonWrap}><Button style={styles.button} href={confirmationUrl}>Verificar e-mail</Button></Section>
        <Text style={styles.footer}>Se você não criou esta conta, pode ignorar este e-mail com segurança.</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
