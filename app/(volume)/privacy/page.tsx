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
          display its shared little world. Optional wish details may be visible
          to people who have contributed a wish.
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
        <h2>Clemi Radar</h2>
        <p>
          Radar locations are entered manually, are deliberately approximate,
          and disappear after 12 hours. The previous location is replaced, so
          no location history is retained.
        </p>
      </section>
      <p>
        To ask for your Sunday Posties information to be corrected or deleted,
        email Clementine using the envelope on the home page.
      </p>
    </main>
  );
}
