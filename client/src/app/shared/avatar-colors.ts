const AVATAR_COLORS = [
  { bg: 'var(--color-primary-container)',       text: 'var(--color-on-primary-container)' },
  { bg: 'var(--color-secondary-container)',     text: 'var(--color-on-secondary-container)' },
  { bg: 'var(--color-tertiary-container)',      text: 'var(--color-on-tertiary-container)' },
  { bg: 'var(--color-error-container)',         text: 'var(--color-on-error-container)' },
  { bg: 'var(--color-surface-container-high)',  text: 'var(--color-on-surface)' },
];

export function getAvatarColor(initials: string): { bg: string; text: string } {
  const code = [...initials].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % 5];
}
