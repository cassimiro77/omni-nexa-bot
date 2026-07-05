// NexaBot email brand tokens — neon blue / black / gray
export const brand = {
  name: 'NexaBot',
  logoUrl:
    'https://omni-nexa-bot.lovable.app/__l5e/assets-v1/63e7b44d-374f-4264-a489-754fa660251c/nexabot-icon.png',
  siteUrl: 'https://omni-nexa-bot.lovable.app',
}

export const styles = {
  main: {
    backgroundColor: '#0A0A0A',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    margin: 0,
    padding: '40px 0',
  } as const,
  container: {
    backgroundColor: '#111827',
    border: '1px solid #1F2937',
    borderRadius: '12px',
    padding: '32px 28px',
    maxWidth: '520px',
    margin: '0 auto',
  } as const,
  logoWrap: { textAlign: 'center' as const, margin: '0 0 24px' },
  logo: { width: '56px', height: '56px', display: 'inline-block' },
  brandName: {
    color: '#00E5FF',
    fontSize: '13px',
    fontWeight: 600 as const,
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    margin: '8px 0 20px',
  },
  h1: {
    fontSize: '22px',
    fontWeight: 700 as const,
    color: '#FFFFFF',
    margin: '0 0 16px',
    textAlign: 'center' as const,
  },
  text: {
    fontSize: '14px',
    color: '#D1D5DB',
    lineHeight: '1.6',
    margin: '0 0 20px',
  },
  button: {
    backgroundColor: '#00E5FF',
    color: '#0A0A0A',
    fontSize: '14px',
    fontWeight: 600 as const,
    borderRadius: '8px',
    padding: '12px 24px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  buttonWrap: { textAlign: 'center' as const, margin: '24px 0' },
  link: { color: '#00E5FF', textDecoration: 'underline' },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '28px',
    fontWeight: 700 as const,
    color: '#00E5FF',
    letterSpacing: '6px',
    textAlign: 'center' as const,
    backgroundColor: '#0A0A0A',
    border: '1px solid #1F2937',
    borderRadius: '8px',
    padding: '18px',
    margin: '0 0 24px',
  },
  footer: {
    fontSize: '12px',
    color: '#6B7280',
    margin: '24px 0 0',
    textAlign: 'center' as const,
    borderTop: '1px solid #1F2937',
    paddingTop: '16px',
  },
}
