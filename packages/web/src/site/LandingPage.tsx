import { Link as RouterLink } from 'react-router-dom';
import {
  AppBar, Box, Button, Card, CardActionArea, Container, Divider, Stack, Toolbar, Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FactoryIcon from '@mui/icons-material/Factory';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import SpeedIcon from '@mui/icons-material/Speed';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { t } from '../copy/index.ts';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { BrandMark } from '../components/BrandMark.tsx';

const PATHS = [
  { to: '/app/plan', Icon: FactoryIcon, title: 'path1Title', body: 'path1Body', link: 'path1Link' },
  { to: '/app/report', Icon: VerifiedUserIcon, title: 'path2Title', body: 'path2Body', link: 'path2Link' },
  { to: '/app/machines', Icon: SpeedIcon, title: 'path3Title', body: 'path3Body', link: 'path3Link' },
] as const;

const STATS = [
  { value: 'stat1Value', label: 'stat1Label' },
  { value: 'stat2Value', label: 'stat2Label' },
  { value: 'stat3Value', label: 'stat3Label' },
] as const;

const STEPS = [
  { n: '01', title: 'how1Title', body: 'how1Body' },
  { n: '02', title: 'how2Title', body: 'how2Body' },
  { n: '03', title: 'how3Title', body: 'how3Body' },
] as const;

const MODEL = [
  { letter: 'A', title: 'modelATitle', body: 'modelABody' },
  { letter: 'L', title: 'modelLTitle', body: 'modelLBody' },
  { letter: 'E', title: 'modelETitle', body: 'modelEBody' },
] as const;

/**
 * The product's front door: a mission hero, path selection by role, the
 * evidence, then a single call to action.
 *
 * The pattern this follows nominates a client-logo strip as the trust signal.
 * There are no clients yet, and inventing logos would be a fabricated
 * endorsement, so the sourced research figures carry that job instead — the
 * more honest signal for a product whose claim is that its numbers have
 * provenance.
 */
export function LandingPage() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <AppBar position="sticky">
        <Container maxWidth="lg" disableGutters>
          <Toolbar sx={{ gap: 2 }}>
            <Box component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', minHeight: 48 }}>
              <BrandMark />
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>{t('appName')}</Typography>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <ThemeToggle />
            <Button component={RouterLink} to="/app" variant="contained" endIcon={<ArrowForwardIcon />}>
              {t('heroCta')}
            </Button>
          </Toolbar>
        </Container>
      </AppBar>

      <Container maxWidth="lg" sx={{ pb: 8 }}>
        {/* Hero */}
        <Box sx={{ py: { xs: 6, md: 10 } }}>
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.12em' }}>
            {t('heroKicker')}
          </Typography>
          <Typography
            variant="h2"
            component="h1"
            sx={{ mt: 2, mb: 2.5, maxWidth: '18ch', fontWeight: 400, letterSpacing: '-0.02em' }}
          >
            {t('heroTitle')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '60ch', mb: 4 }}>
            {t('heroBody')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
            <Button component={RouterLink} to="/app" size="large" variant="contained" endIcon={<ArrowForwardIcon />}>
              {t('heroCta')}
            </Button>
            <Button href="#how" size="large" variant="outlined">{t('heroCtaSecondary')}</Button>
          </Stack>
        </Box>

        <Divider />

        {/* Path selection — "I am a…" */}
        <Box component="section" id="who" sx={{ py: { xs: 5, md: 7 } }}>
          <Typography variant="h4" component="h2" sx={{ mb: 1 }}>{t('whoTitle')}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '64ch', mb: 4 }}>
            {t('whoLede')}
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
            {PATHS.map(({ to, Icon, title, body, link }) => (
              <Card key={to}>
                <CardActionArea component={RouterLink} to={to} sx={{ p: 3, height: '100%', alignItems: 'flex-start' }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.dark', mb: 2 }}>
                    <Icon aria-hidden="true" />
                  </Box>
                  <Typography variant="subtitle1" component="h3" sx={{ mb: 1 }}>{t(title)}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t(body)}</Typography>
                  <Typography variant="button" sx={{ color: 'primary.main' }}>{t(link)} →</Typography>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </Box>

        <Divider />

        {/* The problem, with the evidence */}
        <Box component="section" id="problem" sx={{ py: { xs: 5, md: 7 } }}>
          <Typography variant="h4" component="h2" sx={{ mb: 1 }}>{t('problemTitle')}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '64ch', mb: 4 }}>
            {t('problemBody')}
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
            {STATS.map(({ value, label }) => (
              <Card key={value}>
                <Box sx={{ p: 3 }}>
                  <Typography variant="h3" sx={{ color: 'primary.main', mb: 1.5, fontWeight: 400 }}>
                    {t(value)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">{t(label)}</Typography>
                </Box>
              </Card>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, fontFamily: 'Roboto Mono, monospace' }}>
            {t('statsSource')}
          </Typography>
        </Box>

        <Divider />

        {/* How it works */}
        <Box component="section" id="how" sx={{ py: { xs: 5, md: 7 } }}>
          <Typography variant="h4" component="h2" sx={{ mb: 1 }}>{t('howTitle')}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '64ch', mb: 4 }}>
            {t('howLede')}
          </Typography>
          <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
            {STEPS.map(({ n, title, body }) => (
              <Box key={n}>
                <Typography
                  variant="overline"
                  sx={{ color: 'primary.main', borderTop: 2, borderColor: 'primary.main', pt: 1.5, display: 'block' }}
                >
                  {n}
                </Typography>
                <Typography variant="subtitle1" component="h3" sx={{ mt: 1.5, mb: 1 }}>{t(title)}</Typography>
                <Typography variant="body2" color="text.secondary">{t(body)}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider />

        {/* The ALE model */}
        <Box component="section" id="model" sx={{ py: { xs: 5, md: 7 } }}>
          <Typography variant="h4" component="h2" sx={{ mb: 1 }}>{t('modelTitle')}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '64ch', mb: 4 }}>
            {t('tagline')}
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
            {MODEL.map(({ letter, title, body }) => (
              <Card key={letter}>
                <Box sx={{ p: 3 }}>
                  <Typography variant="h4" sx={{ color: 'primary.main', mb: 1.5 }}>{letter}</Typography>
                  <Typography variant="subtitle1" component="h3" sx={{ mb: 1 }}>{t(title)}</Typography>
                  <Typography variant="body2" color="text.secondary">{t(body)}</Typography>
                </Box>
              </Card>
            ))}
          </Box>
        </Box>

        <Divider />

        {/* The guardrail */}
        <Box component="section" id="guardrails" sx={{ py: { xs: 5, md: 7 } }}>
          <Card sx={{ maxWidth: '80ch', borderLeft: 4, borderLeftColor: 'error.main' }}>
            <Box sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
                <WarningAmberIcon color="error" aria-hidden="true" />
                <Typography variant="h6" component="h2">{t('guardTitle')}</Typography>
              </Stack>
              <Typography variant="body1" color="text.secondary">{t('guardBody')}</Typography>
            </Box>
          </Card>
        </Box>

        {/* Call to action */}
        <Card sx={{ textAlign: 'center', p: { xs: 3, md: 5 } }}>
          <Typography variant="h5" component="h2" sx={{ mb: 1 }}>{t('landingCtaTitle')}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>{t('landingCtaBody')}</Typography>
          <Button component={RouterLink} to="/app" size="large" variant="contained" endIcon={<ArrowForwardIcon />}>
            {t('heroCta')}
          </Button>
        </Card>

        <Typography
          variant="caption"
          color="text.secondary"
          component="footer"
          sx={{ display: 'block', mt: 6, pt: 3, borderTop: 1, borderColor: 'divider', fontFamily: 'Roboto Mono, monospace', lineHeight: 1.8 }}
        >
          ALE INSIGHT v1 — ANTICIPATE · LEAD · EVOLVE<br />
          Seeded with three fictional demo factories. Risk scores are role-level and marked as estimated
          in the product; they are not measurements taken from a factory floor.<br />
          Research figures are carried from the project documents and re-verified during phase 0.
        </Typography>
      </Container>
    </Box>
  );
}
