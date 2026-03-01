export type AppView = "tgf" | "member" | "leadership";

export type MenuItem = {
  label: string;
  href: string;
};

export type MenuSection = {
  title?: string;
  items: MenuItem[];
};

function memberBaseMenu(): MenuSection[] {
  return [
    { items: [{ label: "Profil", href: "/app/profile" }] },
    {
      title: "Alap",
      items: [
        { label: "Tagok", href: "/app/tagok" },
        { label: "Akciók", href: "/app/akciok" },
        { label: "Események", href: "/app/esemenyek" },
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
        // ✅ marad /app/ticketek
        { label: "Ticketek", href: "/app/ticketek" },
        { label: "Parkolási rend", href: "/app/parkolas" },
        { label: "Skinek", href: "/app/skinek" },
      ],
    },
    {
      title: "Információ",
      items: [
        { label: "Frakció szabályzat", href: "/app/szabalyzat" },
        { label: "Tagfelvétel", href: "/app/tagfelvetel" },
      ],
    },
  ];
}

export function getMenuFor(view: AppView): MenuSection[] {
  if (view === "tgf") {
    return [
      { items: [{ label: "Profil", href: "/app/profile" }] },
      {
        title: "TGF",
        items: [
          { label: "Helyszín", href: "/app/helyszin" },
          { label: "Skinek", href: "/app/skinek" },
          { label: "Karakter útmutató", href: "/app/karakter-utmutato" },
          { label: "Karaktertörténet", href: "/app/karaktertortenet" },
          // ✅ Ticketek TGF-ben is
          { label: "Ticketek", href: "/app/ticketek" },
          { label: "Frakció szabályzat", href: "/app/szabalyzat" },
        ],
      },
    ];
  }

  if (view === "member") {
    return [
      { items: [{ label: "Profil", href: "/app/profile" }] },
      {
        title: "Alap",
        items: [
          { label: "Tagok", href: "/app/tagok" },
          { label: "Akciók", href: "/app/akciok" },
          { label: "Események", href: "/app/esemenyek" },
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
        items: [
          { label: "Frakció szabályzat", href: "/app/szabalyzat" },
          { label: "Vezetőség", href: "/app/vezetoseg" },
          { label: "Tagfelvétel", href: "/app/tagfelvetel" },
        ],
      },
    ];
  }

  // leadership
  return [
    ...memberBaseMenu(),
    {
      title: "Vezetőség",
      items: [
        { label: "Kezelőpanel", href: "/app/vezetoseg" },
        { label: "Meghívókódok", href: "/app/vezetoseg?tab=invites" },
        { label: "Felhasználók", href: "/app/vezetoseg?tab=users" },
      ],
    },
  ];
}