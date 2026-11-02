import { Brand } from "../components/Brand";
import { Icon, type IconName } from "../components/Icon";
import { ProductShot } from "../components/ProductShot";
import { Link, navigate, scrollToId } from "../lib/router";
import { useWallet } from "../lib/wallet";

const REPO = "https://github.com/Kingvic300/lockstep";

const COMPARE = {
  without: [
    "Your wallet shows three raw contract calls you cannot read.",
    "A swap fills at a bad price and the next step still runs.",
    "Step two fails after step one already moved your funds.",
    "A relayer can hold your signed transaction and submit it later.",
  ],
  with: [
    "You see the outcome in plain words before you sign.",
    "Minimum received and maximum spent are part of the signature.",
    "Any failure rolls back every step. Balances end where they began.",
    "A signed deadline means nothing runs after the time you set.",
  ],
};

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "plus", title: "Add your steps", body: "Pick contracts and functions. Lockstep reads each contract's interface, so every argument gets a typed field." },
  { icon: "lock", title: "Set the guarantees", body: "Say what must be true at the end: receive at least, spend at most, and a deadline." },
  { icon: "activity", title: "Dry run it", body: "Simulate the whole batch against the live network. See the result and the fee before signing." },
  { icon: "check", title: "Sign once", body: "One signature covers every step and every check. All of it lands, or none of it does." },
];

const FEATURES: { icon: IconName; title: string; body: string; wide?: boolean }[] = [
  {
    icon: "lock",
    title: "Signed postconditions",
    body: "Balance checks live inside the arguments you sign. No wallet, relayer or front-end can strip them out.",
    wide: true,
  },
  {
    icon: "releases",
    title: "Up to 16 steps, one transaction",
    body: "Swap, deposit, stake and claim in a single atomic invocation instead of four separate transactions.",
    wide: true,
  },
  { icon: "activity", title: "Dry runs", body: "Every batch can be simulated from your account before you sign." },
  { icon: "controls", title: "Any contract", body: "Works with any Soroban contract and any standard token." },
  { icon: "wallet", title: "Holds nothing", body: "Lockstep keeps no funds and no state. Every call runs with your own authorization." },
  { icon: "github", title: "Open source", body: "Apache-2.0. Read it, fork it, or contribute through Drips Wave." },
];

const FAQ = [
  {
    q: "Is this a router or an aggregator?",
    a: "No. Lockstep does not choose routes or prices. You choose the steps. Lockstep runs them in order and enforces the outcome you signed.",
  },
  {
    q: "Can Lockstep move my funds on its own?",
    a: "No. It holds no funds and has no admin. Each step runs with your authorization, and your signature covers the exact steps, checks and deadline.",
  },
  {
    q: "What happens if a guarantee fails?",
    a: "The contract returns an error and the network rolls back every change in the transaction. You pay only the network fee.",
  },
  {
    q: "Which wallets work?",
    a: "Freighter, LOBSTR and Albedo today. The signature covers one authorization tree rooted at Lockstep, which simulation builds for you.",
  },
  {
    q: "Is it audited?",
    a: "Not yet. Version 0.1 is open source with unit tests. An audit through the Stellar Community Fund Audit Bank is on the roadmap.",
  },
];

export function Landing() {
  const { address, enterDemo } = useWallet();
  const appLink = address ? "/app" : "/connect";
  const demo = () => {
    enterDemo();
    navigate("/app");
  };

  return (
    <div className="mk">
      <div className="announce">
        Open source and live on Stellar testnet.{" "}
        <a href={REPO} target="_blank" rel="noreferrer">
          Read the contract
        </a>
      </div>
      <header className="mk-nav">
        <div className="nav-card">
          <div className="row tight">
            <Brand />
            <span className="nav-tag">v0.1</span>
          </div>
          <nav className="nav-pills" aria-label="Sections">
            <button className="mk-navlink" onClick={() => scrollToId("why")}>
              Why
            </button>
            <button className="mk-navlink" onClick={() => scrollToId("how")}>
              How it works
            </button>
            <button className="mk-navlink" onClick={() => scrollToId("dev")}>
              Developers
            </button>
            <button className="mk-navlink" onClick={() => scrollToId("faq")}>
              FAQ
            </button>
          </nav>
          <div className="row tight nav-right">
            <button className="nav-text hide-sm" onClick={demo}>
              Live demo
            </button>
            <Link to={appLink} className="btn primary">
              {address ? "Open app" : "Launch app"}
            </Link>
          </div>
        </div>
      </header>

      <section className="mk-hero">
        <div className="hero-grid-bg" aria-hidden="true" />
        <div className="mk-inner hero-layout">
          <div className="hero-copy">
            <a className="badge" href={REPO} target="_blank" rel="noreferrer">
              <span className="badge-dot" /> Atomic batches for Stellar Soroban
            </a>
            <h1>Sign the outcome, not the steps.</h1>
            <p className="mk-lede">
              Lockstep runs several Soroban contract calls in one transaction, then checks your balances before anything is
              final. Every step lands, or none of them do.
            </p>
            <div className="row">
              <Link to={appLink} className="btn primary big">
                Build a batch <Icon name="releases" size={18} />
              </Link>
              <button className="btn ghost big" onClick={demo}>
                Explore the live demo
              </button>
            </div>
            <p className="hero-meta">The demo uses sample data. No wallet needed to try it.</p>
          </div>
          <ProductShot />
        </div>
      </section>

      <section className="mk-strip">
        <div className="mk-inner strip-row">
          <span className="strip-label">Made for</span>
          {["Multi-hop swaps", "Zap into vaults", "Batch payouts", "Rebalancing", "Wallet developers"].map((x) => (
            <span key={x} className="strip-item">
              {x}
            </span>
          ))}
        </div>
      </section>

      <section id="why" className="mk-section" aria-labelledby="why-title">
        <div className="mk-inner">
          <div className="sec-head">
            <span className="eyebrow">Why Lockstep</span>
            <h2 id="why-title">Wallets show you calls. You care about results.</h2>
            <p className="sec-lede">
              A Soroban transaction holds one contract invocation. Multi-step flows either split into several transactions or
              trust a router you cannot inspect. Lockstep keeps them atomic and makes the result part of what you sign.
            </p>
          </div>
          <div className="compare">
            <div className="compare-col without">
              <h3>Without Lockstep</h3>
              <ul>
                {COMPARE.without.map((x) => (
                  <li key={x}>
                    <Icon name="x" size={16} /> {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="compare-col with">
              <h3>With Lockstep</h3>
              <ul>
                {COMPARE.with.map((x) => (
                  <li key={x}>
                    <Icon name="check" size={16} /> {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mk-section soft" aria-labelledby="how-title">
        <div className="mk-inner">
          <div className="sec-head">
            <span className="eyebrow">How it works</span>
            <h2 id="how-title">From a list of calls to one guaranteed result.</h2>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="step-card">
                <div className="step-top">
                  <span className="step-icon">
                    <Icon name={s.icon} size={20} />
                  </span>
                  <span className="step-n">Step {i + 1}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="mk-section" aria-labelledby="feat-title">
        <div className="mk-inner">
          <div className="sec-head">
            <span className="eyebrow">Features</span>
            <h2 id="feat-title">Small contract. Strong guarantees.</h2>
          </div>
          <div className="bento">
            {FEATURES.map((f) => (
              <article key={f.title} className={f.wide ? "bento-card wide" : "bento-card"}>
                <span className="bento-icon">
                  <Icon name={f.icon} size={20} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="dev" className="mk-section soft" aria-labelledby="dev-title">
        <div className="mk-inner dev-grid">
          <div>
            <span className="eyebrow">For developers</span>
            <h2 id="dev-title">One function. Four arguments.</h2>
            <p className="sec-lede">
              Call <code>execute</code> with the caller, a list of calls, a list of balance checks and a deadline. Simulation
              builds the authorization tree, so the user signs once.
            </p>
            <ul className="role-list">
              <li>
                <strong>calls</strong>
                <span>Contract, function and arguments for each step. Up to 16.</span>
              </li>
              <li>
                <strong>checks</strong>
                <span>Token, account and minimum change in balance. Negative means a spend cap.</span>
              </li>
              <li>
                <strong>deadline</strong>
                <span>Ledger time after which the batch is refused.</span>
              </li>
            </ul>
          </div>
          <div className="code-card">
            <div className="code-tabs">
              <span className="on">batch.ts</span>
            </div>
            <pre>
              <code>
                <span className="c">{"// Swap 100 XLM, require at least 95 USDC back"}</span>
                {"\n"}
                <span className="k">const</span> calls = [{"{"} contract: <span className="v">POOL</span>, func:{" "}
                <span className="s">"swap"</span>, args: [me, xlm, usdc, <span className="s">100n</span>] {"}"}];
                {"\n"}
                <span className="k">const</span> checks = [{"\n"}
                {"  "}
                {"{"} token: <span className="v">USDC</span>, account: me, min_delta: <span className="s">95_0000000n</span> {"}"},
                {"\n"}
                {"  "}
                {"{"} token: <span className="v">XLM</span>, account: me, min_delta: <span className="s">-100_0000000n</span> {"}"},
                {"\n"}];{"\n\n"}
                <span className="k">await</span> lockstep.execute({"{"} caller: me, calls, checks,{"\n"}
                {"  "}deadline: now + <span className="s">600</span> {"}"});
              </code>
            </pre>
          </div>
        </div>
      </section>

      <section id="faq" className="mk-section" aria-labelledby="faq-title">
        <div className="mk-inner faq-grid">
          <div className="sec-head left">
            <span className="eyebrow">FAQ</span>
            <h2 id="faq-title">Questions, answered.</h2>
            <p className="sec-lede">
              Something else? Open an issue on{" "}
              <a href={REPO} target="_blank" rel="noreferrer">
                GitHub
              </a>
              .
            </p>
          </div>
          <div className="faq-list">
            {FAQ.map((f) => (
              <details key={f.q} className="faq">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-inner">
        <div className="cta-card">
          <div className="cta-glow" aria-hidden="true" />
          <h2>Stop signing steps. Start signing results.</h2>
          <p>Build your first batch on testnet in a couple of minutes.</p>
          <div className="row center">
            <Link to={appLink} className="btn white big">
              Launch app
            </Link>
            <button className="btn glass big" onClick={demo}>
              Explore the demo
            </button>
          </div>
        </div>
      </section>

      <footer className="mk-foot">
        <div className="mk-inner foot-row">
          <Brand />
          <span>Open source under Apache-2.0. Built on Stellar Soroban.</span>
          <div className="row tight">
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href={`${REPO}/blob/main/WAVE_ISSUES.md`} target="_blank" rel="noreferrer">
              Contribute
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
