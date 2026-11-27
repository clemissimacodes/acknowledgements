"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import {
  DIARY_PATH,
  FRIEND_BADGES,
  SHOP_HANDLE,
  collectionLabel,
  friendPrice,
  formatPrice,
  type Friend,
  type FriendCard,
  type FriendColor,
} from "@/lib/friend-types";
import { colorsForFriend } from "@/lib/friend-colors";
import { AlsoLike } from "./AlsoLike";
import { VoiceGift } from "./VoiceGift";
import { useBag } from "./bag";

type Props = { friend: Friend; alsoLike?: FriendCard[] };

export function ProductPage({ friend, alsoLike = [] }: Props) {
  const bag = useBag();
  const colors = useMemo<FriendColor[]>(() => {
    if (friend.colors.length) return friend.colors.slice(0, 3);
    return colorsForFriend(friend.slug, friend.madeOf);
  }, [friend.colors, friend.slug, friend.madeOf]);
  const [color, setColor] = useState<FriendColor>(colors[0] ?? { name: "Bone White", hex: "#efe6d8" });
  const price = friendPrice(friend.birthday);
  const inBag = bag.has(friend.slug);
  const songTitle = friend.anthemTitle || (friend.anthemUrl ? "Their song" : "");
  const hasPairs = Boolean(friend.poemTitle || friend.anthemUrl);

  return (
    <main className="ff-product">
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
            <figure className="ff-character">
              {friend.heroUrl ? (
                <img
                  src={friend.heroUrl}
                  alt={friend.nickname}
                  fetchPriority="high"
                  decoding="async"
                />
              ) : (
                <span className="ff-card-blank" aria-hidden="true" />
              )}
              {friend.badge !== "none" ? (
                <span className="ff-badge">{FRIEND_BADGES[friend.badge]}</span>
              ) : null}
            </figure>
          </aside>

          <div className="ff-photo-col" aria-label={`${friend.nickname} photos`}>
            {(friend.altUrl || friend.extraUrl) ? (
              <>
                {friend.altUrl ? (
                  <figure className="ff-photo">
                    <img
                      src={friend.altUrl}
                      alt={`${friend.nickname}, photo 2`}
                      loading="eager"
                      decoding="async"
                    />
                  </figure>
                ) : null}
                {friend.extraUrl ? (
                  <figure className="ff-photo">
                    <img
                      src={friend.extraUrl}
                      alt={`${friend.nickname}, photo 3`}
                      loading="lazy"
                      decoding="async"
                    />
                  </figure>
                ) : null}
              </>
            ) : (
              <figure className="ff-photo ff-photo-empty" aria-hidden="true">
                <span className="ff-card-blank" />
              </figure>
            )}
          </div>

          <section className="ff-buy" aria-label="Details">
            <dl className="ff-buy-rows">
              <div>
                <dt>Item ID</dt>
                <dd>
                  <h1 className="ff-title">{friend.nickname}</h1>
                  {friend.productName ? <p className="ff-subtitle">{friend.productName}</p> : null}
                </dd>
              </div>

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

              {hasPairs ? (
                <div>
                  <dt>Pairs well with</dt>
                  <dd className="ff-poem">
                    <div className="ff-pairs-inline">
                      {friend.poemTitle ? (
                        <p>
                          <span className="ff-pairs-label">Poem</span>
                          {friend.poemUrl ? (
                            <a href={friend.poemUrl} className="ff-poem-title" target="_blank" rel="noreferrer">
                              {friend.poemTitle}
                            </a>
                          ) : (
                            <span className="ff-poem-title">{friend.poemTitle}</span>
                          )}
                          {friend.poemPoet ? <span className="ff-pairs-by"> · {friend.poemPoet}</span> : null}
                        </p>
                      ) : null}
                      {friend.anthemUrl ? (
                        <p>
                          <span className="ff-pairs-label">Song</span>
                          <a href={friend.anthemUrl} className="ff-poem-title" target="_blank" rel="noreferrer">
                            {songTitle}
                          </a>
                          {friend.anthemArtist ? (
                            <span className="ff-pairs-by"> · {friend.anthemArtist}</span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
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

              <div>
                <dt>Size</dt>
                <dd>
                  <p className="ff-size-one">One size fits all</p>
                </dd>
              </div>

              {colors.length ? (
                <div>
                  <dt>Color</dt>
                  <dd>
                    <p className="ff-color-name">{color.name}</p>
                    <svg className="ff-swatch-defs" aria-hidden="true" width="0" height="0">
                      <defs>
                        <filter
                          id="ff-crayon"
                          x="-40%"
                          y="-60%"
                          width="180%"
                          height="220%"
                          colorInterpolationFilters="sRGB"
                        >
                          <feTurbulence
                            type="fractalNoise"
                            baseFrequency="1.15 0.32"
                            numOctaves="4"
                            seed="4"
                            stitchTiles="stitch"
                            result="grain"
                          />
                          <feDisplacementMap
                            in="SourceGraphic"
                            in2="grain"
                            scale="3.2"
                            xChannelSelector="R"
                            yChannelSelector="G"
                            result="warped"
                          />
                          <feTurbulence
                            type="fractalNoise"
                            baseFrequency="1.6 0.45"
                            numOctaves="3"
                            seed="11"
                            stitchTiles="stitch"
                            result="speckle"
                          />
                          <feColorMatrix
                            in="speckle"
                            type="matrix"
                            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.85 -0.18"
                            result="speckleAlpha"
                          />
                          <feComposite in="warped" in2="speckleAlpha" operator="in" result="chalk" />
                          <feGaussianBlur in="chalk" stdDeviation="0.35" />
                        </filter>
                      </defs>
                    </svg>
                    <div className="ff-swatches" role="radiogroup" aria-label="Color">
                      {colors.map((swatch) => {
                        const on = color.hex === swatch.hex;
                        return (
                          <button
                            key={swatch.hex}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            aria-label={swatch.name}
                            className={`ff-swatch${on ? " ff-swatch-on" : ""}`}
                            style={{ "--swatch": swatch.hex } as CSSProperties}
                            onClick={() => setColor(swatch)}
                          >
                            <span className="ff-swatch-stroke" aria-hidden="true" />
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
                    In stock: 1 of 1, original
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
                            colorName: color.name,
                            colorHex: color.hex,
                          })
                    }
                  >
                    {inBag ? "In your bag — view" : "Add to bag"}
                  </button>
                </dd>
              </div>

              {friend.voiceUrl ? (
                <div className="ff-buy-voice">
                  <dt>A note</dt>
                  <dd>
                    <VoiceGift
                      url={friend.voiceUrl}
                      durationMs={friend.voiceDurationMs}
                      nickname={friend.nickname}
                      slug={friend.slug}
                    />
                  </dd>
                </div>
              ) : null}

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
    </main>
  );
}
