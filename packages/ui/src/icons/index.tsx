import * as React from "react";

// Port TSX verbatim de docs/legacy/nimbalodge-app/src/components/icons/Icons.jsx — set d'icônes maison,
// distinct des icônes lucide-react utilisées à l'intérieur des primitives shadcn (pas de conflit,
// les deux coexistent : lucide pour le chrome des composants shadcn, ce set pour la nav/le métier).

type IconProps = React.SVGProps<SVGSVGElement>;

export const IconDashboard = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13" y="3" width="8" height="5" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13" y="10" width="8" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

export const IconBuilding = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M4 21V9l8-5 8 5v12" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

export const IconUsers = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3 20c.6-3.6 3-5.6 6-5.6s5.4 2 6 5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="17.5" cy="7.5" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    <path d="M15.6 14.6c2.6.2 4.4 1.9 4.9 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const IconInvoice = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path
      d="M6 2.5h9l3 3V21a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 21V3a.5.5 0 0 1 .5-.5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M9 9h6M9 13h6M9 17h3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const IconWallet = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <rect x="2.5" y="6" width="19" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M2.5 10.2h19" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="17.3" cy="14.3" r="1.4" fill="currentColor" />
  </svg>
);

export const IconBed = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M2.5 19v-8.5A1.5 1.5 0 0 1 4 9h16a1.5 1.5 0 0 1 1.5 1.5V19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M2.5 19h19M4 9V6.5A1.5 1.5 0 0 1 5.5 5h6A1.5 1.5 0 0 1 13 6.5V9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M13 12h6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const IconReport = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path
      d="M6 2.5h9l3 3V21a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 21V3a.5.5 0 0 1 .5-.5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M9 9.5h6.5M9 12.5h6.5M9 15.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const IconGear = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M19.4 13.5a7.9 7.9 0 0 0 0-3l1.9-1.4-2-3.4-2.2.7a7.8 7.8 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.4a7.8 7.8 0 0 0-2.6 1.5l-2.2-.7-2 3.4L4.6 10.5a7.9 7.9 0 0 0 0 3l-1.9 1.4 2 3.4 2.2-.7c.75.66 1.63 1.17 2.6 1.5l.5 2.4h4l.5-2.4c.97-.33 1.85-.84 2.6-1.5l2.2.7 2-3.4-1.9-1.4Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconTrend = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="m3 16 6-6 4 4 8-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 5h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconWarn = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M12 3 2 20h20L12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M12 10v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="12" cy="17.4" r="1" fill="currentColor" />
  </svg>
);

export const IconLeaf = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M5 19c9 1 14-4 14-14C9 5 4 10 5 19Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const IconPlus = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const IconClose = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const IconChevronDown = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M7 9l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconBurger = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const IconBell = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M6 10a6 6 0 1 1 12 0c0 4 1.4 5.2 1.4 5.2H4.6S6 14 6 10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9.7 18.3a2.4 2.4 0 0 0 4.6 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const IconSearch = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
    <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const IconPrint = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path
      d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2M6 14h12v7H6v-7Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconDownload = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M12 3v13m0 0-4-4m4 4 4-4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconMark = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path
      d="M2.5 19.5 8.5 8l3.6 5.7L15.5 9l6 10.5"
      stroke="#eafff5"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);
