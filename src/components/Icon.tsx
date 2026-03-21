import { ReactNode } from 'react';

export type IconName =
  | 'meal'
  | 'plate'
  | 'leaf'
  | 'drink'
  | 'dessert'
  | 'plus'
  | 'clock'
  | 'delivery'
  | 'motoboy'
  | 'whatsapp'
  | 'cart'
  | 'minus'
  | 'trash'
  | 'star'
  | 'phone'
  | 'map'
  | 'card'
  | 'lock'
  | 'sparkles'
  | 'check'
  | 'close'
  | 'edit';

type IconProps = {
  name: IconName;
  className?: string;
};

function SvgIcon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function Icon({ name, className }: IconProps) {
  switch (name) {
    case 'meal':
      return (
        <SvgIcon className={className}>
          <path d="M4 10.5C4 7.462 6.462 5 9.5 5h5C17.538 5 20 7.462 20 10.5v5A3.5 3.5 0 0 1 16.5 19h-9A3.5 3.5 0 0 1 4 15.5v-5Z" />
          <path d="M8 5V3.8a1.8 1.8 0 1 1 3.6 0V5" />
          <path d="M10 11h.01" />
          <path d="M14.5 10h2.5" />
          <path d="M14.5 13h2.5" />
          <path d="M8 14h2" />
        </SvgIcon>
      );
    case 'leaf':
      return (
        <SvgIcon className={className}>
          <path d="M6 16c0-5 4.8-9 12-9 0 7.2-4 12-9 12-1.8 0-3-.8-3-3Z" />
          <path d="M8 16c2-1.2 4-3.8 5.5-7" />
        </SvgIcon>
      );
    case 'plate':
      return (
        <SvgIcon className={className}>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="3.2" />
          <path d="M4 19.5h16" />
        </SvgIcon>
      );
    case 'drink':
      return (
        <SvgIcon className={className}>
          <path d="M8 6h8l-1.2 11.5A2 2 0 0 1 12.81 19h-1.62a2 2 0 0 1-1.99-1.5L8 6Z" />
          <path d="M10.5 6V4h3v2" />
          <path d="M15.5 4 18 2" />
        </SvgIcon>
      );
    case 'dessert':
      return (
        <SvgIcon className={className}>
          <path d="M7 15a5 5 0 0 1 10 0v1.5A1.5 1.5 0 0 1 15.5 18h-7A1.5 1.5 0 0 1 7 16.5V15Z" />
          <path d="M12 6c2.3 0 4 1.7 4 4H8c0-2.3 1.7-4 4-4Z" />
          <path d="M12 6V4" />
          <path d="M9 20h6" />
        </SvgIcon>
      );
    case 'plus':
      return (
        <SvgIcon className={className}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
          <circle cx="12" cy="12" r="9" />
        </SvgIcon>
      );
    case 'clock':
      return (
        <SvgIcon className={className}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </SvgIcon>
      );
    case 'delivery':
      return (
        <SvgIcon className={className}>
          <rect x="3.5" y="8" width="10.5" height="6.5" rx="1.2" />
          <path d="M14 10h2.8l2.2 2.5v2H14" />
          <circle cx="7.25" cy="16.5" r="1.35" />
          <circle cx="16.85" cy="16.5" r="1.35" />
          <path d="M5.2 10.8h3.6" />
        </SvgIcon>
      );
    case 'motoboy':
      return (
        <SvgIcon className={className}>
          <circle cx="7" cy="17" r="2" />
          <circle cx="17" cy="17" r="2" />
          <path d="M9 17h4.5l2.5-4.5h-3.2" />
          <path d="M10 11.5 8.5 9H6" />
          <path d="M13 8.5h2.5l2 2" />
          <path d="M12.5 9.5 10 14h4" />
          <path d="M15.5 10.5h2" />
        </SvgIcon>
      );
    case 'whatsapp':
      return (
        <SvgIcon className={className}>
          <path d="M12 4.75a7.25 7.25 0 0 0-6.28 10.88L5 19.25l3.73-.98A7.25 7.25 0 1 0 12 4.75Z" />
          <path d="M9.2 8.95c.16-.35.31-.4.58-.4h.55c.21 0 .48.05.62.38l.72 1.7c.09.21.07.38-.04.52l-.36.46c-.11.14-.2.25-.08.48.43.81 1.08 1.49 1.9 1.94.22.12.35.06.47-.08l.44-.52c.14-.16.31-.18.5-.1l1.62.69c.23.1.34.23.34.4 0 .44-.18 1.22-.79 1.7-.49.39-1.13.45-1.57.35-.55-.12-1.77-.64-2.92-1.73-1.16-1.1-1.8-2.38-1.98-2.91-.2-.6-.1-1.28.3-1.8.34-.44.75-.69.9-.69Z" />
        </SvgIcon>
      );
    case 'cart':
      return (
        <SvgIcon className={className}>
          <path d="M4 6h2l1.3 7.2A2 2 0 0 0 9.3 15h6.9a2 2 0 0 0 2-1.6L19 8H7.2" />
          <circle cx="10" cy="19" r="1.5" />
          <circle cx="17" cy="19" r="1.5" />
        </SvgIcon>
      );
    case 'minus':
      return (
        <SvgIcon className={className}>
          <path d="M6 12h12" />
          <circle cx="12" cy="12" r="9" />
        </SvgIcon>
      );
    case 'trash':
      return (
        <SvgIcon className={className}>
          <path d="M5 7h14" />
          <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
          <path d="M7 7l.8 11a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7" />
          <path d="M10 10.5v5" />
          <path d="M14 10.5v5" />
        </SvgIcon>
      );
    case 'star':
      return (
        <SvgIcon className={className}>
          <path d="m12 4 2.3 4.7 5.2.8-3.8 3.7.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.7 5.2-.8L12 4Z" />
        </SvgIcon>
      );
    case 'phone':
      return (
        <SvgIcon className={className}>
          <path d="M6.5 4.8c.4-.4 1-.6 1.6-.4l2 .6c.6.2 1 .8 1 1.4l-.1 2c0 .5-.3 1-.8 1.2l-1 .4a12 12 0 0 0 4.7 4.7l.4-1c.2-.5.7-.8 1.2-.8l2-.1c.6 0 1.2.4 1.4 1l.6 2c.2.6 0 1.2-.4 1.6l-1 1c-.9.9-2.3 1.2-3.6.8C10.6 18.3 5.7 13.4 4.7 8.4c-.4-1.3-.1-2.7.8-3.6l1-1Z" />
        </SvgIcon>
      );
    case 'map':
      return (
        <SvgIcon className={className}>
          <path d="M12 20s6-5.2 6-10.2A6 6 0 0 0 6 9.8C6 14.8 12 20 12 20Z" />
          <circle cx="12" cy="10" r="2.2" />
        </SvgIcon>
      );
    case 'card':
      return (
        <SvgIcon className={className}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M4 10h16" />
          <path d="M8 14h3" />
        </SvgIcon>
      );
    case 'lock':
      return (
        <SvgIcon className={className}>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V8a4 4 0 1 1 8 0v2" />
        </SvgIcon>
      );
    case 'sparkles':
      return (
        <SvgIcon className={className}>
          <path d="M12 3.5 13.8 8 18.5 9.8 13.8 11.6 12 16.3 10.2 11.6 5.5 9.8 10.2 8 12 3.5Z" />
          <path d="M18.5 15.5 19.3 17.5 21.5 18.3 19.3 19.1 18.5 21.3 17.7 19.1 15.5 18.3 17.7 17.5 18.5 15.5Z" />
          <path d="M5.5 14.5 6.3 16.3 8.1 17.1 6.3 17.9 5.5 19.7 4.7 17.9 2.9 17.1 4.7 16.3 5.5 14.5Z" />
        </SvgIcon>
      );
    case 'check':
      return (
        <SvgIcon className={className}>
          <path d="m6.5 12.5 3.2 3.2 7.8-8.2" />
        </SvgIcon>
      );
    case 'close':
      return (
        <SvgIcon className={className}>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </SvgIcon>
      );
    case 'edit':
      return (
        <SvgIcon className={className}>
          <path d="m14 5 5 5" />
          <path d="M4 20h4.5L18 10.5 13.5 6 4 15.5V20Z" />
        </SvgIcon>
      );
    default:
      return null;
  }
}
