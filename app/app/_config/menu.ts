export type AppView = "tgf" | "member" | "leadership";

export type MenuItem = {
  label: string;
  href: string;
};

export type MenuSection = {
  title?: string;
  items: MenuItem[];
};

export type MenuOptions = {
  showEvents?: boolean;
  showLeadership?: boolean;
  showAuditLog?: boolean;
  showDictionary?: boolean;
};

function buildInfoSection(options?: MenuOptions): MenuSection {
  const showDictionary = !!options?.showDictionary;

  return {
    title: "Információk",
    items: [
      { label: "Profil", href: "/app/profile" },
      { label: "Skinek", href: "/app/skinek" },
      { label: "Karaktertörténet", href: "/app/karaktertortenet" },
      ...(showDictionary ? [{ label: "Szótár", href: "/app/szotar" }] : []),
      { label: "Frakció szabályzat", href: "/app/szabalyzat" },
    ],
  };
}

function buildFactionSection(options?: MenuOptions): MenuSection {
  const showEvents = !!options?.showEvents;

  return {
    title: "Frakció",
    items: [
      { label: "Akciók", href: "/app/akciok" },
      ...(showEvents ? [{ label: "Események", href: "/app/esemenyek" }] : []),
      { label: "Tagok", href: "/app/tagok" },
      { label: "Rangok", href: "/app/rangok" },
      { label: "Járművek", href: "/app/jarmuvek" },
      { label: "Parkolási rend", href: "/app/parkolas" },
      { label: "Szereltetés igénylés", href: "/app/szereltetes" },
      { label: "Leadandó", href: "/app/leadando" },
      { label: "Ticketek", href: "/app/ticketek" },
    ],
  };
}

function memberBaseMenu(options?: MenuOptions): MenuSection[] {
  return [buildInfoSection(options), buildFactionSection(options)];
}

export function getMenuFor(view: AppView, options?: MenuOptions): MenuSection[] {
  if (view === "tgf") {
    return [
      {
        title: "Információk",
        items: [
          { label: "Profil", href: "/app/profile" },
          { label: "Skinek", href: "/app/skinek" },
          { label: "Karaktertörténet", href: "/app/karaktertortenet" },
          ...(options?.showDictionary ? [{ label: "Szótár", href: "/app/szotar" }] : []),
          { label: "Frakció szabályzat", href: "/app/szabalyzat" },
        ],
      },
    ];
  }

  if (view === "member") {
    return memberBaseMenu(options);
  }

  return [
    ...memberBaseMenu({ showEvents: true, showDictionary: options?.showDictionary }),
    {
      title: "Vezetőség",
      items: [
        { label: "Kezelőpanel", href: "/app/vezetoseg" },
        ...(options?.showAuditLog ? [{ label: "Audit log", href: "/app/audit-log" }] : []),
      ],
    },
  ];
}