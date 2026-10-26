import { Countdown } from "./countdown";

export default function ComingSoon() {
  return (
    <main className="page">
      <div className="brand">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5l2.9 5.9 6.6 1-4.8 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.5 9.4l6.6-1z" />
        </svg>
        <span>ruxstar</span>
      </div>

      <section className="hero">
        <p className="eyebrow">Coming soon</p>
        <h1>
          We go live on
          <br />
          <span className="date">30 November</span>
        </h1>
        <Countdown />
        <p className="lede">
          Print, events, coaching, and stays, with the people around you. All in one place.
        </p>
      </section>

      <footer className="foot">© 2026 Ruxstar</footer>
    </main>
  );
}
