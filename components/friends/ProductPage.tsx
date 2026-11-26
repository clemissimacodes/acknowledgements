"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FRIEND_BADGES,
  SHOP_HANDLE,
  daysKnown,
  daysToFriendiversary,
  eraLabel,
  formatMetOn,
  friendPrice,
  formatPrice,
  friendiversaryLabel,
  RELATIONSHIPS,
  type Friend,
} from "@/lib/friend-types";
import { getPoemPick } from "@/lib/friend-poems";
import { useBag } from "./bag";

type Props = { friend: Friend };

export function ProductPage({ friend }: Props) {
  const bag = useBag();
  const [pick, setPick] = useState(friend.relationship);
  const [swatch, setSwatch] = useState(0);
  const price = friendPrice(friend.metOn);
  const inBag = bag.has(friend.slug);
  const days = daysKnown(friend.metOn);
  const until = daysToFriendiversary(friend.metOn);
  const poem = friend.poem ? getPoemPick(friend.poem) : undefined;
  const options = friend.relationship && !RELATIONSHIPS.includes(friend.relationship as (typeof RELATIONSHIPS)[number])
    ? [friend.relationship, ...RELATIONSHIPS]
    : [...RELATIONSHIPS];

  return (
    <main className="ff-product">
      <p className="ff-crumbs">
        <Link href={`/collections/${SHOP_HANDLE}`}>Home</Link> › {friend.nickname}
      </p>

      <div className="ff-product-grid">
        <aside className="ff-specs">
          <dl>
            {friend.madeOf.length ? (
              <div>
                <dt>Made of</dt>
                <dd>
                  {friend.madeOf.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </dd>
              </div>
            ) : null}
            {friend.care ? (
              <div>
                <dt>Care</dt>
                <dd>{friend.care}</dd>
              </div>
            ) : null}
            {friend.hometown ? (
              <div>
                <dt>Made in</dt>
                <dd>{friend.hometown}</dd>
              </div>
            ) : null}
            {friend.metHow ? (
              <div>
                <dt>Sourced</dt>
                <dd>{friend.metHow}</dd>
              </div>
            ) : null}
          </dl>
          {friend.altUrl ? (
            <figure className="ff-alt">
              <img src={friend.altUrl} alt={`${friend.nickname}, detail`} />
            </figure>
          ) : null}
        </aside>

        <figure className="ff-hero">
          {friend.heroUrl ? (
            <img src={friend.heroUrl} alt={friend.nickname} />
          ) : (
            <span className="ff-card-blank" aria-hidden="true" />
          )}
          {friend.badge !== "none" ? <span className="ff-badge">{FRIEND_BADGES[friend.badge]}</span> : null}
        </figure>

        <section className="ff-buy" aria-label="Details">
          <dl className="ff-buy-rows">
            <div>
              <dt>Item ID</dt>
              <dd>
                <h1 className="ff-title">{friend.nickname}</h1>
                {friend.productName ? <p className="ff-subtitle">{friend.productName}</p> : null}
                <p className="ff-sku">SKU {friend.metOn.replace(/-/g, "")} · {eraLabel(friend.era)}</p>
              </dd>
            </div>

            {friend.favoriteTrait ? (
              <div>
                <dt>Favorite trait</dt>
                <dd className="ff-desc">
                  {friend.favoriteTrait.split(/\n\n+/).map((para, index) => (
                    <p key={index}>{para}</p>
                  ))}
                </dd>
              </div>
            ) : null}

            {friend.favoriteMemory ? (
              <div>
                <dt>Favorite memory</dt>
                <dd className="ff-desc">
                  {friend.favoriteMemory.split(/\n\n+/).map((para, index) => (
                    <p key={index}>{para}</p>
                  ))}
                </dd>
              </div>
            ) : null}

            {friend.description ? (
              <div>
                <dt>Description</dt>
                <dd className="ff-desc">
                  {friend.description.split(/\n\n+/).map((para, index) => (
                    <p key={index}>{para}</p>
                  ))}
                </dd>
              </div>
            ) : null}

            {poem ? (
              <div>
                <dt>Poem</dt>
                <dd className="ff-poem">
                  {poem.href.startsWith("/") ? (
                    <Link href={poem.href} className="ff-poem-title">{poem.title}</Link>
                  ) : (
                    <a href={poem.href} className="ff-poem-title" target="_blank" rel="noreferrer">{poem.title}</a>
                  )}
                  {poem.author ? <p className="ff-poem-by">{poem.author}</p> : null}
                  {poem.lines.map((line, index) => (
                    <p key={index} className="ff-poem-line">{line}</p>
                  ))}
                </dd>
              </div>
            ) : null}

            <div>
              <dt>Provenance</dt>
              <dd className="ff-desc">
                <p className="ff-note">
                  In my possession since {formatMetOn(friend.metOn)} — {days.toLocaleString()} days.
                  {until === 0
                    ? " Friendiversary is today."
                    : ` Friendiversary ${friendiversaryLabel(friend.metOn)}, ${until} day${until === 1 ? "" : "s"} away.`}
                </p>
              </dd>
            </div>

            {options.length ? (
              <div>
                <dt>Relationship</dt>
                <dd>
                  <div className="ff-sizes" role="radiogroup" aria-label="Relationship">
                    {options.map((option) => {
                      const stocked = option === friend.relationship || !friend.relationship;
                      return (
                        <button
                          key={option}
                          type="button"
                          role="radio"
                          aria-checked={pick === option}
                          className={`ff-size${!stocked ? " ff-size-out" : ""}`}
                          onClick={() => stocked && setPick(option)}
                          title={stocked ? undefined : "Sold out"}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {friend.relationship ? (
                    <p className="ff-size-note">Only “{friend.relationship}” is in stock. Other fits sold out.</p>
                  ) : null}
                </dd>
              </div>
            ) : null}

            {friend.colors.length ? (
              <div>
                <dt>Color</dt>
                <dd>
                  <p className="ff-color-name">{friend.colors[swatch]?.name.toUpperCase()}</p>
                  <div className="ff-swatches">
                    {friend.colors.map((color, index) => (
                      <button
                        key={color.hex + index}
                        type="button"
                        className={`ff-swatch${swatch === index ? " ff-swatch-on" : ""}`}
                        style={{ ["--swatch" as string]: color.hex }}
                        aria-label={color.name}
                        aria-pressed={swatch === index}
                        onClick={() => setSwatch(index)}
                      />
                    ))}
                  </div>
                </dd>
              </div>
            ) : null}

            <div>
              <dt>Price</dt>
              <dd>
                <p className="ff-price">
                  <span className="ff-price-sign">$</span>
                  <span className="ff-price-scrawl">{formatPrice(price)}</span>
                  <span className="ff-price-cur">USD</span>
                </p>
                <p className="ff-price-fine">
                  The day we met. Was $0 before that. Not eligible for discounts, ever.
                </p>
              </dd>
            </div>
          </dl>

          <button
            type="button"
            className="ff-pill ff-pill-dark ff-add"
            onClick={() =>
              inBag
                ? bag.setOpen(true)
                : bag.add({
                    slug: friend.slug,
                    nickname: friend.nickname,
                    productName: friend.productName,
                    price,
                    heroUrl: friend.heroUrl,
                  })
            }
          >
            {inBag ? "In your bag — view" : "Add to cart"}
          </button>
          <p className="ff-ship">Ships never. Available for pickup in person, with notice.</p>
        </section>
      </div>

    </main>
  );
}
