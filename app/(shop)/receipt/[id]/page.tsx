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
          <p>BY CLEMISSIMA</p>
          <p>190 N 10TH ST OF MY HEART</p>
          <p>EVERYWHERE, USA</p>
          <p className="ff-receipt-rule">* * * * * * * * * * * * * * * *</p>
          <p>ORDER NO. FF-{receipt.id}</p>
          <p>{when.toUpperCase()}</p>
          <p className="ff-receipt-rule">- - - - - - - - - - - - - - - -</p>
        </header>

        <ul className="ff-receipt-items">
          {receipt.items.map((item) => (
            <li key={item.slug}>
              <span>
                1 × {item.nickname.toUpperCase()}
                {item.productName ? <small>{item.productName}</small> : null}
                <small>ONE OF ONE · FINAL SALE</small>
              </span>
              <span>{money(Number(item.price))}</span>
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
            <dd>N/A</dd>
          </div>
          <div>
            <dt>TAX</dt>
            <dd>EMOTIONAL</dd>
          </div>
          <div className="ff-receipt-grand">
            <dt>TOTAL</dt>
            <dd>${money(subtotal)}</dd>
          </div>
        </dl>

        <p className="ff-receipt-rule">- - - - - - - - - - - - - - - -</p>
        <p className="ff-receipt-paid">PAID IN FULL — IN TIME</p>
        <p>TENDER: YEARS</p>
        <p>CHANGE DUE: NONE, KEEP IT</p>
        {receipt.note ? (
          <>
            <p className="ff-receipt-rule">- - - - - - - - - - - - - - - -</p>
            <p className="ff-receipt-note">“{receipt.note}”</p>
          </>
        ) : null}
        <p className="ff-receipt-rule">* * * * * * * * * * * * * * * *</p>
        <p>THANK YOU FOR SHOPPING</p>
        <p>NO RETURNS. NO EXCHANGES. NO RESTOCKS.</p>
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
