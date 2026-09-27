/**
 * Pictogrammes Chesspirit dessinés sur mesure (grille 24×24, trait 1,75).
 * Aucune bibliothèque d'icônes générique.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Icon({ children, title, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="6.2" />
    <path d="m15.2 15.2 5.3 5.3" />
    <path d="M10.5 7.6v5.8M7.6 10.5h5.8" strokeWidth={1.2} opacity={0.55} />
  </Icon>
);

/** Silhouette de pion : l'icône « compte ». */
export const IconAccount = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="7.2" r="3.3" />
    <path d="M9.2 12.2h5.6M8.2 20.5c.8-3 1.9-5.6 3.8-8.3 1.9 2.7 3 5.3 3.8 8.3ZM6.5 20.5h11" />
  </Icon>
);

export const IconBag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 8.5h13l-1.1 11.2a1.5 1.5 0 0 1-1.5 1.3H8.1a1.5 1.5 0 0 1-1.5-1.3Z" />
    <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
  </Icon>
);

export const IconMenu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h11M4 17h16" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const IconChevron = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const IconArrow = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12h15.5M14 6.5l5.5 5.5-5.5 5.5" />
  </Icon>
);

export const IconCalendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    <path d="M8 13.5h2v2H8z" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconPin = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21Z" />
    <path d="M10 9.8h4M12 7.8v4" strokeWidth={1.4} />
  </Icon>
);

/** Pendule d'échecs. */
export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="8" width="19" height="11.5" rx="1.5" />
    <circle cx="8" cy="13.7" r="3" />
    <circle cx="16" cy="13.7" r="3" />
    <path d="M8 13.7V12M16 13.7l1.2-1M6.5 8V6.2h3V8M14.5 8V5.2h3V8" />
  </Icon>
);

export const IconTrophy = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0Z" />
    <path d="M7.5 6H4.5a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4M12 14v3.5M8.5 20.5h7l-1-3h-5Z" />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
  </Icon>
);

export const IconUpload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14" />
  </Icon>
);

export const IconQr = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="0.6" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="0.6" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="0.6" />
    <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 19h1.5M19 14h1.5" />
  </Icon>
);

export const IconCamera = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8h3l1.7-2.5h6.6L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.6" />
  </Icon>
);

export const IconPhone = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6.5" y="2.8" width="11" height="18.4" rx="2" />
    <path d="M10.5 18h3" />
  </Icon>
);

export const IconMail = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
  </Icon>
);

/** Bulle de discussion (WhatsApp), dessin neutre. */
export const IconChat = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.5-4.4a8.4 8.4 0 1 1 15.5-4.5Z" />
    <path d="M9.2 9.3c.3 2.4 2.5 4.8 5.5 5.4" />
  </Icon>
);

export const IconGlobe = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5S9.6 5.9 12 3.5Z" />
  </Icon>
);

export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 4.5 6v5.4c0 4.6 3.1 8.1 7.5 9.6 4.4-1.5 7.5-5 7.5-9.6V6Z" />
    <path d="m8.8 12 2.3 2.3 4.2-4.3" />
  </Icon>
);

export const IconUsers = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19.5c.6-3.3 2.6-5.5 5.5-5.5s4.9 2.2 5.5 5.5" />
    <circle cx="16.8" cy="9" r="2.4" />
    <path d="M16 13.8c2.4 0 4 1.8 4.5 4.6" />
  </Icon>
);

export const IconBoard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
    <path d="M3.5 12h17M12 3.5v17" />
    <path d="M3.5 3.5h8.5v8.5H3.5zM12 12h8.5v8.5H12z" fill="currentColor" stroke="none" opacity={0.25} />
  </Icon>
);

export const IconPrint = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 8V3.5h10V8M7 16.5H4.5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H17" />
    <path d="M7 13h10v7.5H7z" />
  </Icon>
);

export const IconEdit = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16Z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
);

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2" />
  </Icon>
);

export const IconLogout = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4.5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h8M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" />
  </Icon>
);

export const IconSpark = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2Z" />
  </Icon>
);

export const IconFlip = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4v14.5M7 18.5l-3-3M7 18.5l3-3M17 20V5.5M17 5.5l-3 3M17 5.5l3 3" />
  </Icon>
);

export const IconFirst = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 5v14M18 6l-7 6 7 6" />
  </Icon>
);
export const IconPrev = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 6-7 6 7 6" />
  </Icon>
);
export const IconNext = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 7 6-7 6" />
  </Icon>
);
export const IconLast = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 5v14M6 6l7 6-7 6" />
  </Icon>
);
