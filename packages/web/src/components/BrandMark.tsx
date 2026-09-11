import { Box } from '@mui/material';

/**
 * The product mark: three ascending bars for the three risk bands, which is the
 * one idea the whole product is built on.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: size, height: size, flex: 'none',
        display: 'grid', placeItems: 'center',
        borderRadius: 2,
        bgcolor: 'primary.main', color: 'primary.contrastText',
      }}
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 16 16" fill="none">
        <rect x="1" y="9" width="3.4" height="6" rx="1" fill="currentColor" opacity="0.55" />
        <rect x="6.3" y="5.5" width="3.4" height="9.5" rx="1" fill="currentColor" opacity="0.8" />
        <rect x="11.6" y="1" width="3.4" height="14" rx="1" fill="currentColor" />
      </svg>
    </Box>
  );
}
