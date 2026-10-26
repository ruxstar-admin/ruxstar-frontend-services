import { Countdown } from "./countdown";

export default function ComingSoon() {
  return (
    <main className="page">
      <div className="brand">
        <img src="/logo.svg" width={30} height={30} alt="" />
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
