import * as React from 'react';

type AppButtonVariant = 'primary' | 'secondary' | 'ghost';
type AppButtonSize = 'sm' | 'md';

export function AppButton({
  className,
  size = 'md',
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
}) {
  return (
    <button
      className={[
        'app-button',
        `app-button-${variant}`,
        `app-button-${size}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
