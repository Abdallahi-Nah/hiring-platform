// Icônes simples (trait fin) : pas de bibliothèque externe.
const base = {
  viewBox: "0 0 24 24",
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconDashboard = () => (
  <svg {...base}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);
export const IconJobs = () => (
  <svg {...base}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
  </svg>
);
export const IconUsers = () => (
  <svg {...base}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5" />
    <path d="M16 4.5a3.5 3.5 0 010 7M18.5 14.7c1.7.7 2.8 2.4 3 4.8" />
  </svg>
);
export const IconLogout = () => (
  <svg {...base}>
    <path d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4M16 8l4 4-4 4M20 12H9" />
  </svg>
);
export const IconDownload = () => (
  <svg {...base}>
    <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
  </svg>
);
export const IconSearch = () => (
  <svg {...base}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
export const IconRefresh = () => (
  <svg {...base}>
    <path d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5" />
  </svg>
);
export const IconShield = () => (
  <svg {...base}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
export const IconStop = () => (
  <svg {...base}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
export const IconMic = () => (
  <svg {...base}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0014 0M12 18v3" />
  </svg>
);
export const IconUpload = () => (
  <svg {...base}>
    <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
  </svg>
);
export const IconUser = () => (
  <svg {...base}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
  </svg>
);
export const IconBuilding = () => (
  <svg {...base}>
    <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
    <path d="M14 10h5a1 1 0 0 1 1 1v10" />
    <path d="M8 8h2M8 12h2M8 16h2M3 21h18" />
  </svg>
);

export const IconGlobe = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
  </svg>
);

export const IconCalendar = () => (
  <svg {...base}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

export const IconBell = () => (
  <svg {...base}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);

export const IconMail = () => (
  <svg {...base}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

export const IconHeart = ({ filled = false }: { filled?: boolean }) => (
  <svg {...base} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </svg>
);
export const IconChat = () => (
  <svg {...base}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </svg>
);

export const IconMenu = () => (
  <svg {...base} width={22} height={22}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconClose = () => (
  <svg {...base} width={20} height={20}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
