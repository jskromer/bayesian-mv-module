import { useState, useEffect } from "react";
import { useUser, SignIn, SignInButton, UserButton } from "@clerk/clerk-react";
import BayesianWorkbench from "./BayesianWorkbench.jsx";

const C = {
  bg: "#f5f0e8", surface: "#ebe5d9", card: "#ffffff",
  border: "#d4cbbf", white: "#1a1612", text: "#3d3529",
  textSoft: "#6b5f52", textDim: "#998d7e",
  teal: "#b5632e", tealDim: "rgba(181,99,46,0.08)",
  blue: "#2c6fad", blueDim: "rgba(44,111,173,0.06)",
  amber: "#a67c28", amberDim: "rgba(166,124,40,0.08)",
  violet: "#7c5cbf", violetDim: "rgba(124,92,191,0.06)",
};

/* ───── Auth helpers ───── */
function useAuth() {
  try {
    const { isLoaded, isSignedIn, user } = useUser();
    return { isLoaded, isSignedIn, user, enabled: true };
  } catch {
    return { isLoaded: true, isSignedIn: true, user: null, enabled: false };
  }
}

function AuthGate({ children, onHome }) {
  const { isLoaded, isSignedIn, enabled } = useAuth();

  if (!enabled) return children;
  if (!isLoaded) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14, color: C.textDim, fontFamily: "'IBM Plex Sans', sans-serif" }}>Loading…</div>
    </div>
  );
  if (!isSignedIn) return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans', sans-serif", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ display: "flex", alignItems: "center", padding: "10px 24px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <button onClick={onHome} style={{ background: "none", border: "none", cursor: "pointer", color: C.teal, fontSize: 13, fontWeight: 600, fontFamily: "'IBM Plex Sans'", padding: 0 }}>← Bayesian Module</button>
      </div>
      <div style={{ maxWidth: 440, margin: "80px auto 0", textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 5, color: C.violet, fontWeight: 600, textTransform: "uppercase", marginBottom: 16, fontFamily: "'IBM Plex Mono', monospace" }}>
          Course Access
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.white, margin: "0 0 12px" }}>
          Sign in to continue
        </h2>
        <p style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.65, marginBottom: 32 }}>
          Create a free account or sign in to access the Bayesian workbench.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <SignIn routing="hash" />
        </div>
      </div>
    </div>
  );
  return children;
}

function Home({ onNavigate }) {
  const [hovered, setHovered] = useState(null);
  const { isSignedIn, user, enabled } = useAuth();

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans', sans-serif", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Auth nav */}
      {enabled && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "10px 24px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
          {isSignedIn ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: C.textDim }}>{user?.primaryEmailAddress?.emailAddress}</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          ) : (
            <SignInButton mode="modal">
              <button style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", color: C.violet, fontSize: 12, fontWeight: 600, padding: "6px 16px", fontFamily: "'IBM Plex Sans'" }}>
                Sign In
              </button>
            </SignInButton>
          )}
        </div>
      )}

      {/* Hero */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "80px 32px 72px", background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)` }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: 5, color: C.teal, fontWeight: 600, textTransform: "uppercase", marginBottom: 20, fontFamily: "'IBM Plex Mono', monospace" }}>
            Counterfactual Designs · Bayesian Module
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 700, color: C.white, margin: "0 0 20px", letterSpacing: -0.5, lineHeight: 1.15 }}>
            Same Data. Same Models.<br />Different Inference.
          </h1>
          <p style={{ fontSize: 17, color: C.textSoft, lineHeight: 1.75, maxWidth: 560, margin: "0 auto 32px" }}>
            An interactive companion to the frequentist M&V workbench. See what changes when you
            replace point estimates with posterior distributions — and what stays the same.
          </p>
          <button
            onClick={() => onNavigate("workbench")}
            onMouseEnter={() => setHovered("launch")}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: hovered === "launch" ? "#a05526" : C.teal,
              color: "#fff", border: "none", borderRadius: 8,
              padding: "14px 36px", fontSize: 16, fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            Launch Bayesian Workbench →
          </button>
        </div>
      </div>

      {/* Contrast cards */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 32px 16px" }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: C.teal, fontWeight: 600, textTransform: "uppercase", marginBottom: 16, fontFamily: "'IBM Plex Mono', monospace" }}>
          The Pedagogical Contrast
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "24px 24px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1 }}>
              Frequentist Workbench
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.7, marginBottom: 4 }}>OLS finds the single best-fit line</li>
              <li style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.7, marginBottom: 4 }}>Change point picked by grid search (one winner)</li>
              <li style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.7, marginBottom: 4 }}>Confidence interval: 95% CI around point estimate</li>
              <li style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.7, marginBottom: 4 }}>Savings: 12% ± 3%</li>
            </ul>
            <a href="https://cfdesigns.vercel.app/#/workbench" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: C.amber, textDecoration: "none", marginTop: 12, display: "inline-block" }}>
              Open frequentist workbench →
            </a>
          </div>
          <div style={{ background: C.blueDim, border: `1px solid ${C.blue}`, borderRadius: 10, padding: "24px 24px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1 }}>
              Bayesian Workbench ← You are here
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.7, marginBottom: 4 }}>Posterior gives full distribution over parameters</li>
              <li style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.7, marginBottom: 4 }}>Change point has its own probability distribution</li>
              <li style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.7, marginBottom: 4 }}>Credible interval: 95% probability savings falls here</li>
              <li style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.7, marginBottom: 4 }}>{"Savings: P(savings > 10%) = 87%"}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {[
            { num: "01", label: "Scenario", desc: "Same buildings & data" },
            { num: "02", label: "Priors", desc: "State your beliefs" },
            { num: "03", label: "Posterior", desc: "Data updates beliefs" },
            { num: "04", label: "Predictive", desc: "Uncertainty fan chart" },
            { num: "05", label: "Savings", desc: "Full distribution" },
          ].map(s => (
            <div key={s.num} style={{ textAlign: "center", padding: "16px 8px", background: C.card, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.teal, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>{s.num}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.white, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: C.textDim }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Technical note */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 32px 48px" }}>
        <div style={{ background: "linear-gradient(135deg, #2c2418 0%, #3d3529 100%)", borderRadius: 10, padding: "32px 36px", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#d4a76a", fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>
            Technical Approach
          </div>
          <p style={{ fontSize: 15, color: "#f5f0e8", lineHeight: 1.75, margin: "0 0 12px" }}>
            All inference uses the <strong>Normal-Inverse-Gamma conjugate prior</strong> — the posterior is analytically exact. No MCMC sampling, no Python backend. Drag a slider and the posterior updates instantly.
          </p>
          <p style={{ fontSize: 14, color: "#c4b8a8", lineHeight: 1.7, margin: "0 0 12px" }}>
            Change-point locations are compared via the marginal likelihood, producing a proper posterior probability over candidate change points — not just "the one that minimizes SSE."
          </p>
          <p style={{ fontSize: 13, color: "#998d7e", fontStyle: "italic", margin: 0 }}>
            The only randomness is in the savings step (Monte Carlo posterior samples). Everything else is deterministic given the priors.
          </p>
        </div>
      </div>

      {/* Cross-links */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 32px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <a href="https://cfdesigns.vercel.app" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "20px 24px", cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.teal}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <div style={{ fontSize: 11, color: C.teal, fontWeight: 600, letterSpacing: 2, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>Companion</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>Counterfactual Designs Course</div>
              <div style={{ fontSize: 12, color: C.textSoft, marginTop: 4 }}>The three-dimension framework: Boundary, Model Form, Duration</div>
            </div>
          </a>
          <a href="https://mv-course.vercel.app" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "20px 24px", cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.amber}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <div style={{ fontSize: 11, color: C.amber, fontWeight: 600, letterSpacing: 2, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>Reference</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>IPMVP Translation Guide</div>
              <div style={{ fontSize: 12, color: C.textSoft, marginTop: 4 }}>How Options A–D map to Boundary × Model Form × Duration</div>
            </div>
          </a>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: C.textDim }}>
          Part of <a href="https://counterfactual-designs.com" style={{ color: C.teal, textDecoration: "none" }}>Counterfactual Designs</a>
        </div>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>
          © 2025 Steve Kromer · SKEE · Based on <em>The Role of the M&V Professional</em> (River Publishers)
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const getPage = () => window.location.hash.replace("#/", "") || "home";
  const [page, setPage] = useState(getPage());

  useEffect(() => {
    const handler = () => setPage(getPage());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = (p) => {
    window.location.hash = `#/${p}`;
    setPage(p);
    window.scrollTo(0, 0);
  };

  if (page === "workbench") return <AuthGate onHome={() => navigate("home")}><BayesianWorkbench onBack={() => navigate("home")} /></AuthGate>;
  return <Home onNavigate={navigate} />;
}
