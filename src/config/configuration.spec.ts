import configuration from './configuration';

function restoreEnvironmentVariable(
  name: string,
  originalValue: string | undefined,
): void {
  if (originalValue === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = originalValue;
}

describe('media configuration', () => {
  const originalDownloadEnabled = process.env.MEDIA_DOWNLOAD_ENABLED;
  const originalRetentionDays = process.env.MEDIA_RETENTION_DAYS;

  afterEach(() => {
    restoreEnvironmentVariable(
      'MEDIA_DOWNLOAD_ENABLED',
      originalDownloadEnabled,
    );
    restoreEnvironmentVariable('MEDIA_RETENTION_DAYS', originalRetentionDays);
  });

  it('preserves media downloads and disables retention by default', () => {
    delete process.env.MEDIA_DOWNLOAD_ENABLED;
    delete process.env.MEDIA_RETENTION_DAYS;

    const config = configuration();

    expect(config.mediaDownloadEnabled).toBe(true);
    expect(config.mediaRetentionDays).toBe(0);
  });

  it('disables media downloads and configures automatic retention', () => {
    process.env.MEDIA_DOWNLOAD_ENABLED = 'false';
    process.env.MEDIA_RETENTION_DAYS = '7';

    const config = configuration();

    expect(config.mediaDownloadEnabled).toBe(false);
    expect(config.mediaRetentionDays).toBe(7);
  });

  it('normalizes invalid or negative retention values to zero', () => {
    process.env.MEDIA_RETENTION_DAYS = '-10';
    expect(configuration().mediaRetentionDays).toBe(0);

    process.env.MEDIA_RETENTION_DAYS = 'invalid';
    expect(configuration().mediaRetentionDays).toBe(0);
  });
});
