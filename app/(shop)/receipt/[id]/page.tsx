import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareReceipt } from "@/components/friends/ShareReceipt";
import { SHOP_HANDLE, SHOP_NAME } from "@/lib/friend-types";
import { getReceipt } from "@/lib/friends";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const receipt = await getReceipt(id);
  if (!receipt) return { title: SHOP_NAME };
  const names = receipt.items.map((item) => item.nickname).join(", ");
  return {
    title: `Receipt ${receipt.id}`,
    description: `Order ${receipt.id}: ${names}. Paid in full, in time.`,
  };
}

function money(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ReceiptPage({ params }: Props) {
  const { id } = await params;
  const receipt = await getReceipt(id);
  if (!receipt) notFound();
  const subtotal = receipt.items.reduce((sum, item) => sum + Number(item.price), 0);
  const when = new Date(receipt.createdAt).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="ff-receipt-page">
      <article className="ff-receipt" aria-label={`Receipt ${receipt.id}`}>
        <header>
          <p className="ff-receipt-brand">{SHOP_NAME.toUpperCase()}</p>
          <p>FRIENDS &amp; FAMILY SALE</p>
          <p className="ff-receipt-rule">* * * * * * * * * * * * * * * *</p>
          <p>ORDER NO. GC-{receipt.id}</p>
          <p>{when.toUpperCase()}</p>
          <p>CASHIER: CLEMENTINE · REGISTER 01</p>
          <p>ITEMS: {receipt.items.length} · PEOPLE: {receipt.items.length}</p>
          <p className="ff-receipt-rule">- - - - - - - - - - - - - - - -</p>
        </header>

        <ul className="ff-receipt-items">
          {receipt.items.map((item) => (
            <li key={item.slug}>
              <span>
                1 × {item.nickname.toUpperCase()}
                {item.productName ? <small>{item.productName}</small> : null}
              </span>
              <span>{item.price ? money(Number(item.price)) : "P.O.R."}</span>
            </li>
          ))}
        </ul>

        <dl className="ff-receipt-totals">
          <div>
            <dt>SUBTOTAL</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          <div>
            <dt>BLACK FRIDAY DISCOUNT</dt>
            <dd>0.00</dd>
          </div>
          <div>
            <dt>SHIPPING</dt>
            <dd>FREE*</dd>
          </div>
          <div className="ff-receipt-grand">
            <dt>TOTAL</dt>
            <dd>${money(subtotal)}</dd>
          </div>
        </dl>

        <p className="ff-receipt-rule">- - - - - - - - - - - - - - - -</p>
        <p className="ff-receipt-paid">AMOUNT CHARGED: 0.00</p>
        <p>YOU SAVED: 0.00 (NOTHING WAS FOR SALE)</p>
        <p>EACH PRICE IS A DATE. YOU KNOW WHICH.</p>
        <p>*NOTHING SHIPS. THEY GO WHERE THEY LIKE.</p>
        <p>LOYALTY POINTS EARNED: ONE PER DAY, ONGOING</p>
        {receipt.note ? (
          <>
            <p className="ff-receipt-rule">- - - - - - - - - - - - - - - -</p>
            <p className="ff-receipt-note">“{receipt.note}”</p>
          </>
        ) : null}
        <p className="ff-receipt-rule">* * * * * * * * * * * * * * * *</p>
        <p>THANK YOU FOR SHOPPING GOOD COMPANY</p>
        <p>THESE ARE REAL PEOPLE. BE NICE TO THEM.</p>
        <p className="ff-receipt-barcode" aria-hidden="true">
          ▌║█║▌│║▌║▌█║▌│║█║▌║▌│█║▌║█
        </p>
        <p className="ff-receipt-url">clemissima.com/receipt/{receipt.id}</p>
      </article>

      <ShareReceipt id={receipt.id} />
      <p className="ff-receipt-back">
        <Link href={`/collections/${SHOP_HANDLE}`}>← Keep shopping</Link>
      </p>
    </main>
  );
}
