import Link from "next/link";
import { FRIEND_BADGES, priceLabel, type Friend } from "@/lib/friend-types";

type Props = { friends: Friend[] };

export function AlsoLike({ friends }: Props) {
  if (!friends.length) return null;
  return (
    <section className="ff-also" aria-label="You may also like">
      <h2 className="ff-also-title">You may also like</h2>
      <ul className="ff-also-grid">
        {friends.map((f) => (
          <li key={f.id} className="ff-card">
            <Link href={`/products/${f.slug}`}>
              <span className="ff-card-media">
                {f.heroUrl ? (
                  <img className="ff-card-hero" src={f.heroUrl} alt={f.nickname} loading="lazy" decoding="async" />
                ) : (
                  <span className="ff-card-blank" aria-hidden="true" />
                )}
                {f.altUrl ? (
                  <img className="ff-card-alt" src={f.altUrl} alt="" loading="lazy" decoding="async" />
                ) : null}
                {f.badge !== "none" ? <span className="ff-badge">{FRIEND_BADGES[f.badge]}</span> : null}
              </span>
              <span className="ff-card-text">
                <span className="ff-card-name">{f.nickname}</span>
                <span className="ff-card-price">{priceLabel(f.birthday)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
