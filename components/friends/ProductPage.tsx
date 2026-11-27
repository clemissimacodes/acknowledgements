"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DIARY_PATH,
  FRIEND_BADGES,
  SHOP_HANDLE,
  collectionLabel,
  friendPrice,
  formatPrice,
  RELATIONSHIPS,
  spotifyTrackId,
  type Friend,
} from "@/lib/friend-types";
import { AlsoLike } from "./AlsoLike";
import { FriendVoiceBridge } from "./FriendVoice";
import { useBag } from "./bag";
import { ProductSoundtrack } from "./ProductSoundtrack";
import type { FriendCard } from "@/lib/friend-types";

type Props = { friend: Friend; alsoLike?: FriendCard[] };

export function ProductPage({ friend, alsoLike = [] }: Props) {
  const bag = useBag();
  const [pick, setPick] = useState(friend.relationship);
  const price = friendPrice(friend.birthday);
  const inBag = bag.has(friend.slug);
  const options = friend.relationship && !RELATIONSHIPS.includes(friend.relationship as (typeof RELATIONSHIPS)[number])
    ? [friend.relationship, ...RELATIONSHIPS]
    : [...RELATIONSHIPS];
  const trackId = spotifyTrackId(friend.anthemUrl);

  return (
    <main className="ff-product">
      <FriendVoiceBridge
        url={friend.voiceUrl}
        durationMs={friend.voiceDurationMs}
        label={`Voice memo about ${friend.nickname}`}
      />
      <ProductSoundtrack trackId={trackId}>
        <p className="ff-crumbs">
          <Link href={`/collections/${SHOP_HANDLE}`}>Home</Link>
          <span className="ff-crumb-sep" aria-hidden="true">&gt;</span>
          <em>{friend.nickname}</em>
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
                  <dt>How we met</dt>
                  <dd>{friend.metHow}</dd>
                </div>
              ) : null}
            </dl>
            {friend.altUrl || friend.extraUrl ? (
              <div className="ff-alt-stack">
                {friend.altUrl ? (
                  <figure className="ff-alt">
                    <img src={friend.altUrl} alt={`${friend.nickname}, photo 2`} />
                  </figure>
                ) : null}
                {friend.extraUrl ? (
                  <figure className="ff-alt">
                    <img src={friend.extraUrl} alt={`${friend.nickname}, photo 3`} />
                  </figure>
                ) : null}
              </div>
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

              {friend.review ? (
                <div>
                  <dt>Review</dt>
                  <dd className="ff-desc ff-review">
                    {friend.review.split(/\n\n+/).map((para, index) => (
                      <p key={index}>{para}</p>
                    ))}
                    <p className="ff-review-by">— Clementine Shao, founder</p>
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

              {friend.poemTitle ? (
                <div>
                  <dt>Pairs well with</dt>
                  <dd className="ff-poem">
                    {friend.poemUrl ? (
                      <a href={friend.poemUrl} className="ff-poem-title" target="_blank" rel="noreferrer">
                        {friend.poemTitle}
                      </a>
                    ) : (
                      <span className="ff-poem-title">{friend.poemTitle}</span>
                    )}
                    {friend.poemPoet ? <p className="ff-poem-by">{friend.poemPoet}</p> : null}
                  </dd>
                </div>
              ) : null}

              {friend.collection ? (
                <div>
                  <dt>Collection</dt>
                  <dd className="ff-desc">
                    <p>{collectionLabel(friend.collection)}</p>
                  </dd>
                </div>
              ) : null}

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
                  </dd>
                </div>
              ) : null}

              <div>
                <dt>Price</dt>
                <dd>
                  {price ? (
                    <p className="ff-price">
                      <span className="ff-price-sign">$</span>
                      <span className="ff-price-scrawl">{formatPrice(price)}</span>
                      <span className="ff-price-cur">USD</span>
                    </p>
                  ) : (
                    <p className="ff-price ff-price-por">Price upon request</p>
                  )}
                </dd>
              </div>

              <div className="ff-buy-cta">
                <dt aria-hidden="true" />
                <dd>
                  <p className="ff-stock">
                    <strong>Not for Sale</strong>
                    <br />
                    In stock: 1 (on hold by Clementine Shao)
                  </p>
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
                    {inBag ? "In your bag — view" : "Add to bag"}
                  </button>
                </dd>
              </div>

              <div>
                <dt>Details</dt>
                <dd>
                  <details className="ff-acc">
                    <summary>Fit guide</summary>
                    <p>
                      Friend: I will pick you up from the airport. Family: I will pick you up from the airport at
                      5 a.m. and not bring it up again. Each listing comes in exactly one of these, and it is not
                      adjustable.
                    </p>
                  </details>
                  <details className="ff-acc">
                    <summary>What happens at checkout</summary>
                    <p>
                      Nothing is charged and nothing ships. Checking out makes a receipt for the people in your
                      bag that you can share. All sales are final because this one already was.
                    </p>
                  </details>
                  <details className="ff-acc">
                    <summary>Shipping &amp; returns</summary>
                    <p>
                      Shipping is free, in the sense that nothing ships; they go where they like. Returns are not
                      possible because nothing was bought. Exchanges are not offered. I wouldn&rsquo;t anyway.
                    </p>
                  </details>
                  <details className="ff-acc">
                    <summary>Why there is a price</summary>
                    <p>
                      Good Company is a Black Friday sale where every product is a real person in my life. The
                      price is a date, read as dollars. Which date is the kind of thing you know if you know them.{" "}
                      <Link href={DIARY_PATH}>Read the studio diary.</Link>
                    </p>
                  </details>
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <AlsoLike friends={alsoLike} />
      </ProductSoundtrack>
    </main>
  );
}
