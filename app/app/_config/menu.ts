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
};

function memberBaseMenu(options?: MenuOptions): MenuSection[] {
  const showEvents = !!options?.showEvents;

  return [
    { items: [{ label: "Profil", href: "/app/profile" }] },
    {
      title: "Alap",
      items: [
        { label: "Tagok", href: "/app/tagok" },
        { label: "Akciók", href: "/app/akciok" },
        ...(showEvents ? [{ label: "Események", href: "/app/esemenyek" }] : []),
      ],
    },
    {
      title: "Frakció",
      items: [
        { label: "Rangok", href: "/app/rangok" },
        { label: "Járművek", href: "/app/jarmuvek" },
        { label: "Szereltetés igénylés", href: "/app/szereltetes" },
        { label: "Leadandó", href: "/app/leadando" },
        { label: "Karaktertörténet", href: "/app/karaktertortenet" },
        { label: "Ticketek", href: "/app/ticketek" },
        { label: "Parkolási rend", href: "/app/parkolas" },
        { label: "Skinek", href: "/app/skinek" },
      ],
    },
    {
      title: "Információ",
      items: [{ label: "Frakció szabályzat", href: "/app/szabalyzat" }],
    },
  ];
}

export function getMenuFor(view: AppView, options?: MenuOptions): MenuSection[] {
  if (view === "tgf") {
    return [
      { items: [{ label: "Profil", href: "/app/profile" }] },
      {
        title: "TGF",
        items: [
          { label: "Helyszín", href: "/app/helyszin" },
          { label: "Skinek", href: "/app/skinek" },
          { label: "Karaktertörténet", href: "/app/karaktertortenet" },
          { label: "Frakció szabályzat", href: "/app/szabalyzat" },
        ],
      },
    ];
  }

  if (view === "member") {
    return memberBaseMenu(options);
  }

  const sections: MenuSection[] = [
    ...memberBaseMenu({ showEvents: true }),
    {
      title: "Vezetőség",
      items: [{ label: "Kezelőpanel", href: "/app/vezetoseg" }],
    },
  ];

  if (options?.showAuditLog) {
    sections.push({
      title: "Admin",
      items: [{ label: "Audit log", href: "/app/audit-log" }],
    });
  }

  return sections;
}
