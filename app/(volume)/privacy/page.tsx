export const metadata = {
  title: "Privacy",
  description: "What this small website keeps and why.",
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <h1>A small privacy note</h1>
      <section>
        <h2>Sunday Posties</h2>
        <p>
          Your name, social profile, and mailing address are kept privately so
          Clementine can verify the recipient and mail your postie. They are not
          published or sold.
        </p>
      </section>
      <section>
        <h2>Wishes and introductions</h2>
        <p>
          Dandelion wishes and tiny introductions are saved so the site can
          display its shared little world. A wish is automatically labeled with
          the approximate city and country supplied by the website host; raw IP
          addresses are not attached to wishes. Wish details may be visible to
          people who have contributed a wish.
        </p>
      </section>
      <section>
        <h2>Visits</h2>
        <p>
          The site keeps the page visited, time, referring website, device
          category, approximate city/country supplied by the host, and a
          one-way hash of the IP address. Raw IP addresses are not stored.
          Visit records are automatically deleted after 30 days.
        </p>
      </section>
      <section>
        <h2>Clemi Tracker</h2>
        <p>
          The tracker reads location fields from Clementine’s Google Calendar
          with read-only permission. An event happening now may publish its city
          and country. Past locations become private drafts and appear on the
          public map only after Clementine approves them. Event titles,
          attendees, descriptions, event IDs, and exact addresses are not
          stored or published.
        </p>
      </section>
      <section id="cia-records">
        <h2>CIA records, sourcing, and corrections</h2>
        <p>
          The Clementine Intelligence Agency publishes only owner-reviewed
          records with links to original or credible public sources, retrieval
          dates, and confidence labels. Automated checks are limited to a short
          list of official pricing pages and can create private draft alerts,
          but can never approve or publish them. The archive avoids private
          individuals, sensitive personal data, speculation, copied full pages,
          and humiliating rankings. Short quotations are attributed and linked
          to their original context. Citrus photographs are owner-authored;
          location and device metadata (including EXIF) must be removed before
          publication. Clementine may correct or withdraw a file while keeping
          its earlier approved revision private for accountability. Use the
          envelope on the home page to request a correction, removal, or source
          review.
        </p>
      </section>
      <p>
        To ask for your information to be corrected or deleted, email
        Clementine using the envelope on the home page.
      </p>
    </main>
  );
}
