type PoemSheetProps = {
  title: string;
  dedication?: string;
  lines: string[];
  companion?: {
    src: string;
    alt: string;
    credit: string;
    href: string;
  };
};

export function PoemSheet({
  title,
  dedication,
  lines,
  companion,
}: PoemSheetProps) {
  return (
    <article className="poem-sheet">
      {companion ? (
        <figure className="poem-companion">
          <a href={companion.href} target="_blank" rel="noreferrer">
            <img src={companion.src} alt={companion.alt} />
          </a>
          <figcaption>{companion.credit}</figcaption>
        </figure>
      ) : null}
      <h1>{title}</h1>
      {dedication ? <p className="poem-for">for {dedication}</p> : null}
      <div className="poem-lines">
        {lines.map((line, index) => (
          <p
            key={`${index}-${line}`}
            className={line.length ? "poem-line" : "poem-line is-blank"}
          >
            {line.length ? line : "\u00a0"}
          </p>
        ))}
      </div>
    </article>
  );
}
