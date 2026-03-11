import type { ReactNode } from "react";

type PageProps = {
  children: ReactNode;
  wide?: boolean;
  compact?: boolean;
  className?: string;
};

export function LmrPage({ children, wide, compact, className = "" }: PageProps) {
  const sizeClass = wide ? "lmr-page-wide" : compact ? "lmr-page-compact" : "";
  return <div className={`lmr-page ${sizeClass} ${className}`.trim()}>{children}</div>;
}

export function LmrHero({
  kicker,
  title,
  text,
  children,
  align = "center",
}: {
  kicker?: string;
  title: ReactNode;
  text?: ReactNode;
  children?: ReactNode;
  align?: "center" | "left";
}) {
  const alignClass = align === "left" ? "items-start text-left" : "items-center text-center";

  return (
    <section className="lmr-hero">
      <div className={`mx-auto flex max-w-4xl flex-col ${alignClass}`}>
        {kicker ? <p className="lmr-kicker mb-3">{kicker}</p> : null}
        <h1 className="lmr-title">{title}</h1>
        {text ? <p className="lmr-text mt-6 max-w-4xl">{text}</p> : null}
        {children ? <div className="mt-8 w-full">{children}</div> : null}
      </div>
    </section>
  );
}

export function LmrSection({
  title,
  text,
  children,
  className = "",
}: {
  title?: ReactNode;
  text?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`lmr-section lmr-stack ${className}`.trim()}>
      {title ? (
        <div className="lmr-stack-sm">
          <h2 className="lmr-subtitle">{title}</h2>
          <div className="lmr-accent-line" />
          {text ? <p className="lmr-text">{text}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function LmrSoftBlock({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`lmr-section-soft ${className}`.trim()}>{children}</div>;
}

export function LmrCard({
  title,
  text,
  children,
  className = "",
}: {
  title?: ReactNode;
  text?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`lmr-card lmr-stack-sm ${className}`.trim()}>
      {title ? <h3 className="text-lg font-semibold text-white">{title}</h3> : null}
      {text ? <p className="lmr-text">{text}</p> : null}
      {children}
    </div>
  );
}

export function LmrEmpty({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`lmr-empty-state rounded-[22px] px-5 py-8 ${className}`.trim()}>
      {children}
    </div>
  );
}