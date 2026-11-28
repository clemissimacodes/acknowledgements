import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReturnButton } from "@/components/bad-company/ReturnButton";
import { BAD_BADGES, BAD_DIARY_PATH, BAD_PATH, badPriceLabel, getEnemyBySlug, listEnemies } from "@/lib/bad-company";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const enemy = await getEnemyBySlug((await params).slug);
  if (!enemy) return {};
  return { title: enemy.productName ? `${enemy.nickname} — ${enemy.productName}` : enemy.nickname };
}

export default async function BadProduct({ params }: Props) {
  const { slug } = await params;
  const [enemy, all] = await Promise.all([getEnemyBySlug(slug), listEnemies()]);
  if (!enemy) notFound();
  const others = all.filter((e) => e.slug !== enemy.slug).slice(0, 4);
  const price = badPriceLabel(enemy.price);
  const numeric = price.startsWith("$");

  return (
    <main className="ff-product">
      <p className="ff-crumbs">
        <Link href={BAD_PATH}>Clearance</Link>
        <span className="ff-crumb-sep" aria-hidden="true">&gt;</span>
        <em>{enemy.nickname}</em>
      </p>

      <div className="ff-product-grid">
        <aside className="ff-specs">
          <dl>
            {enemy.madeOf.length ? (
              <div>
                <dt>Made of</dt>
                <dd>
                  {enemy.madeOf.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </dd>
              </div>
            ) : null}
            {enemy.care ? (
              <div>
                <dt>Care</dt>
                <dd>{enemy.care}</dd>
              </div>
            ) : null}
            {enemy.hometown ? (
              <div>
                <dt>Made in</dt>
                <dd>{enemy.hometown}</dd>
              </div>
            ) : null}
            {enemy.metHow ? (
              <div>
                <dt>How we met</dt>
                <dd>{enemy.metHow}, unfortunately</dd>
              </div>
            ) : null}
          </dl>
          <figure className="ff-character bc-card-media">
            {enemy.heroUrl ? (
              <img src={enemy.heroUrl} alt={enemy.nickname} decoding="async" />
            ) : (
              <span className="ff-card-blank" aria-hidden="true" />
            )}
            {enemy.badge !== "none" ? <span className="ff-badge">{BAD_BADGES[enemy.badge]}</span> : null}
          </figure>
        </aside>

        <div className="ff-photo-col" aria-hidden="true">
          <figure className="ff-photo ff-photo-empty bc-card-media">
            <span className="ff-card-blank" />
            <span className="bc-card-initial">{enemy.nickname.charAt(0).toUpperCase()}</span>
          </figure>
        </div>

        <section className="ff-buy" aria-label="Details">
          <dl className="ff-buy-rows">
            <div>
              <dt>Item ID</dt>
              <dd>
                <h1 className="ff-title">{enemy.nickname}</h1>
                {enemy.productName ? <p className="ff-subtitle">{enemy.productName}</p> : null}
              </dd>
            </div>

            {enemy.worstMemory ? (
              <div>
                <dt>Worst memory</dt>
                <dd className="ff-desc">
                  {enemy.worstMemory.split(/\n\n+/).map((para, index) => (
                    <p key={index}>{para}</p>
                  ))}
                </dd>
              </div>
            ) : null}

            {enemy.pairsBadlyWith ? (
              <div>
                <dt>Pairs badly with</dt>
                <dd className="ff-desc">
                  <p>{enemy.pairsBadlyWith}</p>
                </dd>
              </div>
            ) : null}

            {enemy.discontinued ? (
              <div>
                <dt>Discontinued</dt>
                <dd className="ff-desc">
                  <p>{enemy.discontinued}</p>
                </dd>
              </div>
            ) : null}

            <div>
              <dt>Size</dt>
              <dd>
                <p className="ff-size-one">Too big for their britches</p>
              </dd>
            </div>

            {enemy.condition ? (
              <div>
                <dt>Condition</dt>
                <dd>
                  <p className="ff-color-name">{enemy.condition}</p>
                </dd>
              </div>
            ) : null}

            <div>
              <dt>Price</dt>
              <dd>
                {numeric ? (
                  <p className="ff-price">
                    <span className="bc-was">Priceless</span>
                    <span className="ff-price-sign">$</span>
                    <span className="ff-price-scrawl">{price.replace(/^\$\s*|\s*USD$/g, "")}</span>
                    <span className="ff-price-cur">USD</span>
                  </p>
                ) : (
                  <p className="bc-price-text">{price}</p>
                )}
              </dd>
            </div>

            <div className="ff-buy-cta">
              <dt aria-hidden="true" />
              <dd>
                <p className="ff-stock">
                  <strong>Final Sale</strong>
                  <br />
                  In stock: 1 of 1, regrettably
                </p>
                <ReturnButton />
              </dd>
            </div>

            <div>
              <dt>Details</dt>
              <dd>
                <details className="ff-acc">
                  <summary>Fit guide</summary>
                  <p>
                    Runs small in generosity, large in ego. Does not fit into my life. Has been tried on several
                    times, against my better judgment.
                  </p>
                </details>
                <details className="ff-acc">
                  <summary>Shipping &amp; returns</summary>
                  <p>
                    Ships immediately, to anywhere but here. Returns are not accepted. I tried. They kept showing
                    up at brunch.
                  </p>
                </details>
                <details className="ff-acc">
                  <summary>Why there is a price</summary>
                  <p>
                    Bad Company is the clearance rack behind Good Company. The price is what they are worth to me,
                    or what they still owe me, whichever is funnier. <Link href={BAD_DIARY_PATH}>Read the studio diary.</Link>
                  </p>
                </details>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {others.length ? (
        <section className="ff-also" aria-label="You may also dislike">
          <h2 className="ff-also-title">You may also dislike</h2>
          <ul className="ff-also-grid">
            {others.map((e) => (
              <li key={e.slug} className="ff-card">
                <Link href={`${BAD_PATH}/${e.slug}`}>
                  <span className="ff-card-media bc-card-media">
                    {e.heroUrl ? (
                      <img className="ff-card-hero" src={e.heroUrl} alt={e.nickname} loading="lazy" />
                    ) : (
                      <>
                        <span className="ff-card-blank" aria-hidden="true" />
                        <span className="bc-card-initial" aria-hidden="true">
                          {e.nickname.charAt(0).toUpperCase()}
                        </span>
                      </>
                    )}
                    {e.badge !== "none" ? <span className="ff-badge">{BAD_BADGES[e.badge]}</span> : null}
                  </span>
                  <span className="ff-card-text">
                    <span className="ff-card-name">{e.nickname}</span>
                    <span className="ff-card-price bc-now">{badPriceLabel(e.price)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
