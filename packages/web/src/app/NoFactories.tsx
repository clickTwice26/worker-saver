import { useState } from 'react';
import { Alert, Box, Button, Card, Container, TextField, Typography } from '@mui/material';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import { api, ApiRequestError } from '../api/client.ts';
import { t } from '../copy/index.ts';
import { BrandMark } from '../components/BrandMark.tsx';
import { DemoFill, DEV_TOOLS, pickOne, randomInt } from '../components/DemoFill.tsx';

/**
 * First run.
 *
 * The product ships with a knowledge base and no customer data, so a fresh
 * install lands here rather than on a dashboard of invented numbers.
 */
export function NoFactories({ onCreated }: { onCreated: (id: number) => void }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [productMix, setProductMix] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Plausible-but-clearly-fictional names, for development only. */
  const fillDemo = () => {
    const places = ['Ashulia', 'Savar', 'Narayanganj', 'Gazipur', 'Chattogram', 'Mirpur'];
    const suffixes = ['Apparel Works', 'Knit Composite', 'Denim Mills', 'Garments', 'Textiles'];
    const mixes = ['Woven outerwear', 'Knitwear, composite unit', 'Denim & garment washing', 'Sportswear'];
    const place = pickOne(places)!;
    setName(`${place} ${pickOne(suffixes)!} ${randomInt(2, 99)}`);
    setLocation(`${place}, Dhaka`);
    setProductMix(pickOne(mixes)!);
    setError(null);
  };

  const submit = async () => {
    if (!name.trim()) { setError('Give the factory a name.'); return; }
    setBusy(true);
    setError(null);
    try {
      const factory = await api.createFactory({
        name: name.trim(),
        location: location.trim(),
        productMix: productMix.trim(),
      });
      onCreated(factory.id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <BrandMark size={36} />
        <Typography variant="h6">{t('appName')}</Typography>
      </Box>

      <Card>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 1 }}>
            <Typography variant="h6" component="h1">{t('setupFactoryTitle')}</Typography>
            {DEV_TOOLS ? <DemoFill onFill={fillDemo} /> : null}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('setupFactoryIntro')}
          </Typography>

          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label={t('factoryName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              size="small"
            />
            <TextField label={t('factoryLocation')} value={location} onChange={(e) => setLocation(e.target.value)} size="small" />
            <TextField label={t('factoryProductMix')} value={productMix} onChange={(e) => setProductMix(e.target.value)} size="small" />
            <Button
              variant="contained"
              startIcon={<AddBusinessIcon />}
              disabled={busy}
              onClick={() => void submit()}
              sx={{ alignSelf: 'flex-start' }}
            >
              {busy ? t('creating') : t('createFactory')}
            </Button>
          </Box>
        </Box>
      </Card>
    </Container>
  );
}
