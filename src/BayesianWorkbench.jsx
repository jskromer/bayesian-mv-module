import { useState, useMemo, useRef, useCallback } from "react";
import {
  bayesianRegression, buildDesignMatrix, changePointPosterior,
  parameterPosterior, parameterPrior, sigmaPosterior,
  posteriorPredictiveFan, savingsPosterior, defaultPriors,
  fitOLSWithCP, fitOLS,
} from "./bayesEngine.js";

// ─── PALETTE (warm cream, matching CFdesigns) ─────────────────
const C = {
  bg: "#f5f0e8", surface: "#ebe5d9", card: "#ffffff",
  border: "#d4cbbf", text: "#3d3529", white: "#1a1612",
  textSoft: "#6b5f52", textDim: "#998d7e",
  teal: "#b5632e", tealDim: "rgba(181,99,46,0.08)",
  rose: "#c0392b", roseDim: "rgba(192,57,43,0.06)",
  blue: "#2c6fad", blueDim: "rgba(44,111,173,0.06)",
  amber: "#a67c28", amberDim: "rgba(166,124,40,0.08)",
  violet: "#7c5cbf", violetDim: "rgba(124,92,191,0.06)",
  // Bayesian-specific accents
  posterior: "#2c6fad",     // blue for posterior
  prior: "#998d7e",         // gray for prior
  ols: "#c0392b",           // red for OLS comparison
  ci50: "rgba(44,111,173,0.35)",
  ci80: "rgba(44,111,173,0.20)",
  ci95: "rgba(44,111,173,0.10)",
};

const FONT = "'IBM Plex Sans', sans-serif";
const MONO = "'IBM Plex Mono', monospace";

// ─── DATASETS (same as existing workbench) ────────────────────
const DATASETS = {
  heating: {
    name: "Office — Heating Dominant",
    desc: "50,000 sq ft office in Chicago. Monthly gas (therms). Strong heating dependency.",
    unit: "therms", fuel: "Natural Gas",
    suggestedModel: "3PH",
    data: [
      { month: "Jan-22", temp: 26, energy: 4820 }, { month: "Feb-22", temp: 30, energy: 4410 },
      { month: "Mar-22", temp: 40, energy: 3280 }, { month: "Apr-22", temp: 52, energy: 1950 },
      { month: "May-22", temp: 62, energy: 820 },  { month: "Jun-22", temp: 72, energy: 480 },
      { month: "Jul-22", temp: 77, energy: 450 },  { month: "Aug-22", temp: 75, energy: 460 },
      { month: "Sep-22", temp: 66, energy: 610 },  { month: "Oct-22", temp: 54, energy: 1750 },
      { month: "Nov-22", temp: 40, energy: 3350 }, { month: "Dec-22", temp: 28, energy: 4650 },
      { month: "Jan-23", temp: 24, energy: 5010 }, { month: "Feb-23", temp: 28, energy: 4700 },
      { month: "Mar-23", temp: 38, energy: 3500 }, { month: "Apr-23", temp: 50, energy: 2100 },
      { month: "May-23", temp: 60, energy: 900 },  { month: "Jun-23", temp: 70, energy: 510 },
      { month: "Jul-23", temp: 78, energy: 440 },  { month: "Aug-23", temp: 76, energy: 455 },
      { month: "Sep-23", temp: 64, energy: 680 },  { month: "Oct-23", temp: 52, energy: 1870 },
      { month: "Nov-23", temp: 38, energy: 3550 }, { month: "Dec-23", temp: 26, energy: 4850 },
    ],
  },
  cooling: {
    name: "Retail — Cooling Dominant",
    desc: "25,000 sq ft retail in Houston. Monthly electricity (kWh). Strong cooling dependency.",
    unit: "kWh", fuel: "Electricity",
    suggestedModel: "3PC",
    data: [
      { month: "Jan-22", temp: 52, energy: 18200 }, { month: "Feb-22", temp: 56, energy: 18500 },
      { month: "Mar-22", temp: 63, energy: 19800 }, { month: "Apr-22", temp: 70, energy: 22400 },
      { month: "May-22", temp: 78, energy: 27600 }, { month: "Jun-22", temp: 84, energy: 32100 },
      { month: "Jul-22", temp: 88, energy: 35400 }, { month: "Aug-22", temp: 89, energy: 36200 },
      { month: "Sep-22", temp: 82, energy: 30800 }, { month: "Oct-22", temp: 72, energy: 23500 },
      { month: "Nov-22", temp: 60, energy: 19200 }, { month: "Dec-22", temp: 53, energy: 18300 },
      { month: "Jan-23", temp: 50, energy: 18000 }, { month: "Feb-23", temp: 54, energy: 18400 },
      { month: "Mar-23", temp: 61, energy: 19500 }, { month: "Apr-23", temp: 72, energy: 23200 },
      { month: "May-23", temp: 80, energy: 29100 }, { month: "Jun-23", temp: 86, energy: 33800 },
      { month: "Jul-23", temp: 90, energy: 36800 }, { month: "Aug-23", temp: 91, energy: 37500 },
      { month: "Sep-23", temp: 84, energy: 31900 }, { month: "Oct-23", temp: 70, energy: 22800 },
      { month: "Nov-23", temp: 62, energy: 19600 }, { month: "Dec-23", temp: 55, energy: 18450 },
    ],
  },
  mixed: {
    name: "School — Mixed Heating & Cooling",
    desc: "75,000 sq ft K-8 school in Nashville. Monthly electricity (kWh). Both loads visible.",
    unit: "kWh", fuel: "Electricity",
    suggestedModel: "5P",
    data: [
      { month: "Jan-22", temp: 38, energy: 62000 }, { month: "Feb-22", temp: 42, energy: 58500 },
      { month: "Mar-22", temp: 52, energy: 48000 }, { month: "Apr-22", temp: 60, energy: 42500 },
      { month: "May-22", temp: 70, energy: 41000 }, { month: "Jun-22", temp: 78, energy: 52000 },
      { month: "Jul-22", temp: 82, energy: 58000 }, { month: "Aug-22", temp: 81, energy: 57500 },
      { month: "Sep-22", temp: 74, energy: 48000 }, { month: "Oct-22", temp: 62, energy: 42000 },
      { month: "Nov-22", temp: 48, energy: 50000 }, { month: "Dec-22", temp: 40, energy: 60000 },
      { month: "Jan-23", temp: 36, energy: 64000 }, { month: "Feb-23", temp: 40, energy: 60500 },
      { month: "Mar-23", temp: 50, energy: 49500 }, { month: "Apr-23", temp: 62, energy: 42200 },
      { month: "May-23", temp: 72, energy: 42500 }, { month: "Jun-23", temp: 80, energy: 55000 },
      { month: "Jul-23", temp: 84, energy: 60000 }, { month: "Aug-23", temp: 83, energy: 59000 },
      { month: "Sep-23", temp: 76, energy: 50000 }, { month: "Oct-23", temp: 60, energy: 41800 },
      { month: "Nov-23", temp: 46, energy: 52000 }, { month: "Dec-23", temp: 38, energy: 62500 },
    ],
  },
};

const MODEL_TYPES = {
  "3PH": { name: "3-Parameter Heating", formula: "E = β₀ + β₁·(Tcp − T)⁺", params: ["β₀ (baseload)", "β₁ (heating slope)"] },
  "3PC": { name: "3-Parameter Cooling", formula: "E = β₀ + β₁·(T − Tcp)⁺", params: ["β₀ (baseload)", "β₁ (cooling slope)"] },
  "5P":  { name: "5-Parameter", formula: "E = β₀ + β₁·(Tcp_h−T)⁺ + β₂·(T−Tcp_c)⁺", params: ["β₀ (baseload)", "β₁ (heating slope)", "β₂ (cooling slope)"] },
};

const STEPS = ["Scenario", "Priors", "Posterior", "Predictive", "Savings"];

// ─── SHARED UI COMPONENTS ─────────────────────────────────────
const P = ({ children, style }) => <p style={{ fontSize: 15, color: C.textSoft, lineHeight: 1.7, margin: "0 0 16px", fontFamily: FONT, ...style }}>{children}</p>;
const Em = ({ children }) => <em style={{ color: C.text, fontStyle: "normal", fontWeight: 600 }}>{children}</em>;
const Btn = ({ children, onClick, disabled, secondary }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: disabled ? C.surface : secondary ? C.card : C.teal,
    color: disabled ? C.textDim : secondary ? C.teal : "#fff",
    border: `1px solid ${disabled ? C.border : secondary ? C.teal : C.teal}`,
    borderRadius: 6, padding: "10px 24px", fontSize: 14, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", fontFamily: FONT,
    opacity: disabled ? 0.6 : 1, transition: "all 0.2s",
  }}>{children}</button>
);
const Card = ({ children, style }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "28px 32px", marginBottom: 20, ...style }}>{children}</div>
);
const Label = ({ children, color }) => (
  <div style={{ fontSize: 11, letterSpacing: 4, color: color || C.teal, fontWeight: 600, textTransform: "uppercase", marginBottom: 12, fontFamily: MONO }}>{children}</div>
);

// ─── DENSITY PLOT (SVG) ───────────────────────────────────────
function DensityPlot({ priorData, posteriorData, olsValue, olsSE, label, width = 500, height = 200 }) {
  const pad = { top: 15, right: 20, bottom: 40, left: 20 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  // Combine all x ranges
  const allPoints = [...(priorData?.points || []), ...(posteriorData?.points || [])];
  if (allPoints.length === 0) return null;

  const xMin = Math.min(...allPoints.map(p => p.x));
  const xMax = Math.max(...allPoints.map(p => p.x));
  const yMax = Math.max(...allPoints.map(p => p.density)) * 1.15;

  const sx = v => pad.left + ((v - xMin) / (xMax - xMin)) * w;
  const sy = v => pad.top + h - (v / yMax) * h;

  const makePath = (pts) => {
    if (!pts || pts.length === 0) return "";
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x)},${sy(p.density)}`).join(" ");
  };
  const makeArea = (pts) => {
    if (!pts || pts.length === 0) return "";
    return makePath(pts) + ` L${sx(pts[pts.length - 1].x)},${sy(0)} L${sx(pts[0].x)},${sy(0)} Z`;
  };

  const ticks = [];
  const range = xMax - xMin;
  const step = Math.pow(10, Math.floor(Math.log10(range / 5)));
  const candidates = [step, step * 2, step * 5];
  const best = candidates.find(s => range / s <= 7) || candidates[2];
  for (let v = Math.ceil(xMin / best) * best; v <= xMax; v += best) ticks.push(v);

  return (
    <svg width={width} height={height} style={{ fontFamily: MONO, overflow: "visible" }}>
      {/* Grid */}
      {ticks.map(t => <line key={t} x1={sx(t)} x2={sx(t)} y1={pad.top} y2={pad.top + h} stroke="#e8e3db" strokeDasharray="3 3" />)}

      {/* Prior area */}
      {priorData && <path d={makeArea(priorData.points)} fill={C.prior} fillOpacity={0.15} />}
      {priorData && <path d={makePath(priorData.points)} fill="none" stroke={C.prior} strokeWidth={1.5} strokeDasharray="6 4" />}

      {/* Posterior area */}
      {posteriorData && <path d={makeArea(posteriorData.points)} fill={C.posterior} fillOpacity={0.2} />}
      {posteriorData && <path d={makePath(posteriorData.points)} fill="none" stroke={C.posterior} strokeWidth={2.5} />}

      {/* Credible interval shading */}
      {posteriorData?.ci95 && (
        <rect x={sx(posteriorData.ci95[0])} y={pad.top} width={sx(posteriorData.ci95[1]) - sx(posteriorData.ci95[0])} height={h} fill={C.ci95} />
      )}

      {/* OLS point estimate */}
      {olsValue != null && (
        <>
          <line x1={sx(olsValue)} x2={sx(olsValue)} y1={pad.top} y2={pad.top + h} stroke={C.ols} strokeWidth={2} strokeDasharray="4 3" />
          <text x={sx(olsValue)} y={pad.top - 3} textAnchor="middle" fill={C.ols} fontSize={9} fontWeight={600}>OLS</text>
        </>
      )}

      {/* Posterior mean */}
      {posteriorData && (
        <line x1={sx(posteriorData.mean)} x2={sx(posteriorData.mean)} y1={pad.top} y2={pad.top + h} stroke={C.posterior} strokeWidth={1.5} strokeDasharray="2 2" />
      )}

      {/* Axes */}
      <line x1={pad.left} x2={pad.left + w} y1={pad.top + h} y2={pad.top + h} stroke={C.border} />
      {ticks.map(t => (
        <g key={`t${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={pad.top + h} y2={pad.top + h + 4} stroke={C.textDim} />
          <text x={sx(t)} y={pad.top + h + 16} textAnchor="middle" fill={C.textDim} fontSize={10}>
            {Math.abs(t) >= 1000 ? `${(t / 1000).toFixed(1)}k` : t % 1 === 0 ? t : t.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Label */}
      <text x={pad.left + w / 2} y={pad.top + h + 32} textAnchor="middle" fill={C.textSoft} fontSize={11} fontFamily={FONT}>{label}</text>
    </svg>
  );
}

// ─── CHANGE-POINT POSTERIOR BAR CHART ──────────────────────────
function CPPosteriorChart({ cpResults, olsCP, width = 500, height = 180 }) {
  const pad = { top: 15, right: 20, bottom: 40, left: 45 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  if (!cpResults || cpResults.length === 0) return null;

  // Aggregate probabilities into integer bins for readability
  const binMap = {};
  cpResults.forEach(r => {
    const bin = Math.round(r.cp);
    binMap[bin] = (binMap[bin] || 0) + r.posterior;
  });
  const bins = Object.entries(binMap)
    .map(([cp, prob]) => ({ cp: Number(cp), prob }))
    .sort((a, b) => a.cp - b.cp);

  const xMin = bins[0].cp - 1;
  const xMax = bins[bins.length - 1].cp + 1;
  const yMax = Math.max(...bins.map(b => b.prob)) * 1.15;

  const sx = v => pad.left + ((v - xMin) / (xMax - xMin)) * w;
  const sy = v => pad.top + h - (v / yMax) * h;
  const barW = Math.max(2, w / bins.length * 0.7);

  const ticks = bins.filter((_, i) => i % Math.max(1, Math.floor(bins.length / 10)) === 0);

  return (
    <svg width={width} height={height} style={{ fontFamily: MONO, overflow: "visible" }}>
      {/* Bars */}
      {bins.map(b => (
        <rect key={b.cp} x={sx(b.cp) - barW / 2} y={sy(b.prob)} width={barW} height={sy(0) - sy(b.prob)}
          fill={C.posterior} fillOpacity={0.7} rx={1} />
      ))}

      {/* OLS change point */}
      {olsCP != null && (
        <>
          <line x1={sx(olsCP)} x2={sx(olsCP)} y1={pad.top} y2={pad.top + h} stroke={C.ols} strokeWidth={2} strokeDasharray="4 3" />
          <text x={sx(olsCP)} y={pad.top - 3} textAnchor="middle" fill={C.ols} fontSize={9} fontWeight={600}>OLS: {olsCP.toFixed(0)}°F</text>
        </>
      )}

      {/* Axes */}
      <line x1={pad.left} x2={pad.left + w} y1={pad.top + h} y2={pad.top + h} stroke={C.border} />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + h} stroke={C.border} />
      {ticks.map(b => (
        <g key={b.cp}>
          <line x1={sx(b.cp)} x2={sx(b.cp)} y1={pad.top + h} y2={pad.top + h + 4} stroke={C.textDim} />
          <text x={sx(b.cp)} y={pad.top + h + 16} textAnchor="middle" fill={C.textDim} fontSize={10}>{b.cp}°</text>
        </g>
      ))}

      {/* Y axis label */}
      <text x={12} y={pad.top + h / 2} textAnchor="middle" fill={C.textSoft} fontSize={10} fontFamily={FONT}
        transform={`rotate(-90, 12, ${pad.top + h / 2})`}>P(change point)</text>

      {/* X label */}
      <text x={pad.left + w / 2} y={pad.top + h + 32} textAnchor="middle" fill={C.textSoft} fontSize={11} fontFamily={FONT}>Temperature (°F)</text>
    </svg>
  );
}

// ─── FAN CHART (posterior predictive) ──────────────────────────
function FanChart({ fanData, scatterData, olsLine, xLabel, yLabel, width = 650, height = 380 }) {
  const pad = { top: 20, right: 30, bottom: 50, left: 70 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  if (!fanData || fanData.length === 0) return null;

  const allY = [...fanData.map(f => f.ci95_hi), ...fanData.map(f => f.ci95_lo), ...scatterData.map(d => d.energy)];
  const xMin = Math.min(...fanData.map(f => f.temp), ...scatterData.map(d => d.temp)) - 2;
  const xMax = Math.max(...fanData.map(f => f.temp), ...scatterData.map(d => d.temp)) + 2;
  const yMin = Math.min(...allY) * 0.9;
  const yMax = Math.max(...allY) * 1.1;

  const sx = v => pad.left + ((v - xMin) / (xMax - xMin)) * w;
  const sy = v => pad.top + h - ((v - yMin) / (yMax - yMin)) * h;

  const makeAreaPath = (data, loKey, hiKey) => {
    const upper = data.map(d => `${sx(d.temp)},${sy(d[hiKey])}`).join(" L");
    const lower = data.slice().reverse().map(d => `${sx(d.temp)},${sy(d[loKey])}`).join(" L");
    return `M${upper} L${lower} Z`;
  };

  const meanLine = fanData.map((d, i) => `${i === 0 ? "M" : "L"}${sx(d.temp)},${sy(d.mean)}`).join(" ");

  // Ticks
  const makeTicks = (min, max, count) => {
    const range = max - min;
    const step = Math.pow(10, Math.floor(Math.log10(range / count)));
    const cands = [step, step * 2, step * 5, step * 10];
    const best = cands.find(s => range / s <= count + 2) || cands[3];
    const ticks = [];
    for (let v = Math.ceil(min / best) * best; v <= max; v += best) ticks.push(v);
    return ticks;
  };
  const xTicks = makeTicks(xMin, xMax, 8);
  const yTicks = makeTicks(yMin, yMax, 6);

  return (
    <svg width={width} height={height} style={{ fontFamily: MONO, overflow: "visible" }}>
      {/* Grid */}
      {xTicks.map(t => <line key={`gx${t}`} x1={sx(t)} x2={sx(t)} y1={pad.top} y2={pad.top + h} stroke="#e8e3db" strokeDasharray="3 3" />)}
      {yTicks.map(t => <line key={`gy${t}`} x1={pad.left} x2={pad.left + w} y1={sy(t)} y2={sy(t)} stroke="#e8e3db" strokeDasharray="3 3" />)}

      {/* Credible bands */}
      <path d={makeAreaPath(fanData, "ci95_lo", "ci95_hi")} fill={C.ci95} />
      <path d={makeAreaPath(fanData, "ci80_lo", "ci80_hi")} fill={C.ci80} />
      <path d={makeAreaPath(fanData, "ci50_lo", "ci50_hi")} fill={C.ci50} />

      {/* OLS line */}
      {olsLine && olsLine.length > 1 && (
        <polyline points={olsLine.map(d => `${sx(d.temp)},${sy(d.energy)}`).join(" ")}
          fill="none" stroke={C.ols} strokeWidth={2} strokeDasharray="6 4" />
      )}

      {/* Posterior mean */}
      <path d={meanLine} fill="none" stroke={C.posterior} strokeWidth={2.5} />

      {/* Data points */}
      {scatterData.map((d, i) => (
        <circle key={i} cx={sx(d.temp)} cy={sy(d.energy)} r={5} fill={C.teal} fillOpacity={0.85} stroke="#fff" strokeWidth={1.5} />
      ))}

      {/* Axes */}
      <line x1={pad.left} x2={pad.left + w} y1={pad.top + h} y2={pad.top + h} stroke={C.border} />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + h} stroke={C.border} />
      {xTicks.map(t => (
        <g key={`xt${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={pad.top + h} y2={pad.top + h + 5} stroke={C.textDim} />
          <text x={sx(t)} y={pad.top + h + 18} textAnchor="middle" fill={C.textDim} fontSize={11}>{t}</text>
        </g>
      ))}
      {yTicks.map(t => (
        <g key={`yt${t}`}>
          <line x1={pad.left - 5} x2={pad.left} y1={sy(t)} y2={sy(t)} stroke={C.textDim} />
          <text x={pad.left - 10} y={sy(t) + 4} textAnchor="end" fill={C.textDim} fontSize={11}>
            {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : t}
          </text>
        </g>
      ))}
      <text x={pad.left + w / 2} y={pad.top + h + 40} textAnchor="middle" fill={C.textSoft} fontSize={12} fontFamily={FONT}>{xLabel}</text>
      <text x={16} y={pad.top + h / 2} textAnchor="middle" fill={C.textSoft} fontSize={12} fontFamily={FONT}
        transform={`rotate(-90, 16, ${pad.top + h / 2})`}>{yLabel}</text>

      {/* Legend */}
      <g transform={`translate(${pad.left + w - 180}, ${pad.top + 5})`}>
        <rect width={175} height={72} fill={C.card} fillOpacity={0.9} rx={4} stroke={C.border} />
        <line x1={10} x2={30} y1={14} y2={14} stroke={C.posterior} strokeWidth={2.5} />
        <text x={36} y={18} fill={C.text} fontSize={10}>Posterior mean</text>
        <line x1={10} x2={30} y1={30} y2={30} stroke={C.ols} strokeWidth={2} strokeDasharray="4 3" />
        <text x={36} y={34} fill={C.text} fontSize={10}>OLS best fit</text>
        <rect x={10} y={42} width={20} height={8} fill={C.ci50} />
        <text x={36} y={50} fill={C.text} fontSize={10}>50 / 80 / 95% CI</text>
        <rect x={10} y={54} width={20} height={8} fill={C.ci95} />
      </g>
    </svg>
  );
}

// ─── HISTOGRAM (savings posterior) ────────────────────────────
function HistogramChart({ bins, ci95, ci80, mean, median, width = 550, height = 220, unit }) {
  const pad = { top: 15, right: 20, bottom: 40, left: 20 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  if (!bins || bins.length === 0) return null;

  const xMin = bins[0].lo;
  const xMax = bins[bins.length - 1].hi;
  const yMax = Math.max(...bins.map(b => b.count)) * 1.15;

  const sx = v => pad.left + ((v - xMin) / (xMax - xMin)) * w;
  const sy = v => pad.top + h - (v / yMax) * h;
  const barW = w / bins.length;

  return (
    <svg width={width} height={height} style={{ fontFamily: MONO, overflow: "visible" }}>
      {/* CI shading */}
      {ci95 && <rect x={sx(ci95[0])} y={pad.top} width={sx(ci95[1]) - sx(ci95[0])} height={h} fill={C.ci95} />}
      {ci80 && <rect x={sx(ci80[0])} y={pad.top} width={sx(ci80[1]) - sx(ci80[0])} height={h} fill={C.ci80} />}

      {/* Bars */}
      {bins.map((b, i) => (
        <rect key={i} x={sx(b.lo) + 0.5} y={sy(b.count)} width={Math.max(1, barW - 1)} height={sy(0) - sy(b.count)}
          fill={C.posterior} fillOpacity={0.7} />
      ))}

      {/* Mean line */}
      {mean != null && (
        <>
          <line x1={sx(mean)} x2={sx(mean)} y1={pad.top} y2={pad.top + h} stroke={C.posterior} strokeWidth={2} strokeDasharray="4 3" />
          <text x={sx(mean)} y={pad.top - 3} textAnchor="middle" fill={C.posterior} fontSize={9} fontWeight={600}>mean</text>
        </>
      )}

      {/* Zero line */}
      {xMin < 0 && xMax > 0 && (
        <line x1={sx(0)} x2={sx(0)} y1={pad.top} y2={pad.top + h} stroke={C.ols} strokeWidth={1.5} strokeDasharray="3 3" />
      )}

      {/* Axis */}
      <line x1={pad.left} x2={pad.left + w} y1={pad.top + h} y2={pad.top + h} stroke={C.border} />
      {[0.25, 0.5, 0.75].map(f => {
        const v = xMin + (xMax - xMin) * f;
        return (
          <g key={f}>
            <line x1={sx(v)} x2={sx(v)} y1={pad.top + h} y2={pad.top + h + 4} stroke={C.textDim} />
            <text x={sx(v)} y={pad.top + h + 16} textAnchor="middle" fill={C.textDim} fontSize={10}>
              {Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}
            </text>
          </g>
        );
      })}
      <text x={pad.left + w / 2} y={pad.top + h + 32} textAnchor="middle" fill={C.textSoft} fontSize={11} fontFamily={FONT}>
        Total savings ({unit})
      </text>
    </svg>
  );
}

// ─── SLIDER ───────────────────────────────────────────────────
function PriorSlider({ label, value, min, max, step, onChange, description, format }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FONT }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.posterior, fontFamily: MONO }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: C.teal }} />
      <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, fontFamily: FONT }}>{description}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN WORKBENCH COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function BayesianWorkbench({ onBack }) {
  const [step, setStep] = useState(0);
  const [datasetKey, setDatasetKey] = useState(null);
  const [modelType, setModelType] = useState(null);
  const [priors, setPriors] = useState(null);
  const [computed, setComputed] = useState(null);

  const dataset = datasetKey ? DATASETS[datasetKey] : null;

  // Initialize priors when dataset/model selected
  const initPriors = (dsKey, mt) => {
    const ds = DATASETS[dsKey];
    const temps = ds.data.map(d => d.temp);
    const energy = ds.data.map(d => d.energy);
    setPriors(defaultPriors(temps, energy, mt));
  };

  // Run Bayesian inference
  const runInference = () => {
    if (!dataset || !modelType || !priors) return;
    const temps = dataset.data.map(d => d.temp);
    const energy = dataset.data.map(d => d.energy);

    // Bayesian: posterior over change-points
    const cpResults = changePointPosterior(temps, energy, modelType, priors);
    if (cpResults.length === 0) return;

    // Best change-point (MAP)
    const bestCP = cpResults.reduce((a, b) => a.posterior > b.posterior ? a : b);
    const post = bestCP.post;

    // OLS for comparison
    const ols = fitOLSWithCP(temps, energy, modelType);

    // Parameter posteriors
    const paramPosts = post.muN.map((_, i) => parameterPosterior(post, i));
    const paramPriors = post.muN.map((_, i) => parameterPrior(priors, i, post.p));

    // Posterior predictive fan
    const tMin = Math.min(...temps) - 3;
    const tMax = Math.max(...temps) + 3;
    const cp1 = bestCP.cp;
    const cp2 = bestCP.cp2 || null;
    const fan = posteriorPredictiveFan(post, modelType, cp1, cp2, tMin, tMax);

    // OLS prediction line
    const olsLine = [];
    if (ols) {
      for (let t = tMin; t <= tMax; t += 0.5) {
        const X = buildDesignMatrix([t], modelType, ols.cp || ols.cph, ols.cpc);
        olsLine.push({ temp: t, energy: X[0].reduce((s, v, j) => s + v * ols.beta[j], 0) });
      }
    }

    // Generate reporting period data (synthetic savings)
    const savingsPct = 12;
    const reportingTemps = [30, 38, 48, 58, 66, 76, 82, 80, 72, 60, 44, 32];
    const reportingData = reportingTemps.map((temp, i) => {
      const X = buildDesignMatrix([temp], modelType, cp1, cp2);
      const predicted = X[0].reduce((s, v, j) => s + v * post.muN[j], 0);
      const actual = predicted * (1 - savingsPct / 100) + (Math.random() - 0.5) * predicted * 0.03;
      return { month: `Month ${i + 1}`, temp, actual: Math.round(actual), predicted: Math.round(predicted) };
    });

    // Savings posterior
    const savingsPost = savingsPosterior(post, modelType, cp1, cp2, reportingData, 5000);

    setComputed({
      cpResults, bestCP, post, ols,
      paramPosts, paramPriors,
      fan, olsLine, reportingData, savingsPost,
      cp1, cp2,
    });
  };

  // ─── STEP RENDERERS ──────────────────────────────────────────

  const renderScenario = () => (
    <>
      <Label>Step 1 · Choose Your Building</Label>
      <h2 style={{ fontSize: 24, color: C.white, margin: "0 0 8px", fontWeight: 700 }}>Scenario & Model</h2>
      <P>Same buildings, same data as the frequentist workbench. The only thing that changes is <Em>how we reason about uncertainty</Em>.</P>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {Object.entries(DATASETS).map(([key, ds]) => (
          <div key={key} onClick={() => { setDatasetKey(key); setModelType(ds.suggestedModel); initPriors(key, ds.suggestedModel); }}
            style={{
              background: datasetKey === key ? C.tealDim : C.card,
              border: `2px solid ${datasetKey === key ? C.teal : C.border}`,
              borderRadius: 8, padding: "20px 16px", cursor: "pointer", transition: "all 0.2s",
            }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 6 }}>{ds.name}</div>
            <div style={{ fontSize: 12, color: C.textSoft, lineHeight: 1.5 }}>{ds.desc}</div>
            <div style={{ fontSize: 11, color: C.teal, marginTop: 8, fontFamily: MONO }}>
              Suggested: {MODEL_TYPES[ds.suggestedModel].name}
            </div>
          </div>
        ))}
      </div>

      {dataset && (
        <Card>
          <div style={{ fontSize: 13, color: C.textSoft, marginBottom: 12 }}>Model type:</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(MODEL_TYPES).map(([key, m]) => (
              <button key={key} onClick={() => { setModelType(key); initPriors(datasetKey, key); }}
                style={{
                  background: modelType === key ? C.teal : C.card,
                  color: modelType === key ? "#fff" : C.text,
                  border: `1px solid ${modelType === key ? C.teal : C.border}`,
                  borderRadius: 6, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: FONT,
                }}>
                {m.name}
                <div style={{ fontSize: 11, fontFamily: MONO, marginTop: 2, opacity: 0.8 }}>{m.formula}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        {dataset ? (
          <a href="https://cfdesigns.vercel.app/#/workbench" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: C.amber, textDecoration: "none", fontFamily: FONT }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
            onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
            Compare: open this building in the frequentist workbench →
          </a>
        ) : <div />}
        <Btn onClick={() => setStep(1)} disabled={!dataset || !modelType}>Set priors →</Btn>
      </div>
    </>
  );

  const renderPriors = () => {
    if (!priors || !dataset) return null;
    const temps = dataset.data.map(d => d.temp);
    const energy = dataset.data.map(d => d.energy);
    const yMean = energy.reduce((a, b) => a + b, 0) / energy.length;
    const yMax = Math.max(...energy);

    return (
      <>
        <Label color={C.violet}>Step 2 · Set Your Priors</Label>
        <h2 style={{ fontSize: 24, color: C.white, margin: "0 0 8px", fontWeight: 700 }}>What Do You Believe Before Seeing Data?</h2>
        <P>This is the step that doesn't exist in frequentist M&V. Bayesian inference requires you to <Em>state your prior beliefs</Em> — then the data updates them. Try making the prior strong (high confidence) vs. weak (vague) and watch how it affects the posterior.</P>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <Card>
            <Label>Prior Beliefs</Label>
            <PriorSlider label="Baseload (β₀)" value={priors.baseload} min={0} max={Math.round(yMax * 1.5)} step={Math.round(yMax / 100)}
              onChange={v => setPriors({ ...priors, baseload: v })}
              description="Expected base energy use when heating/cooling load is zero"
              format={v => `${v.toLocaleString()} ${dataset.unit}`} />
            <PriorSlider label="Slope (β₁)" value={priors.slope} min={0} max={Math.round(yMax / 10)} step={1}
              onChange={v => setPriors({ ...priors, slope: v })}
              description="Expected energy change per degree of temperature difference"
              format={v => `${v} ${dataset.unit}/°F`} />
            {modelType === "5P" && (
              <PriorSlider label="Cooling Slope (β₂)" value={priors.slope2 || priors.slope} min={0} max={Math.round(yMax / 10)} step={1}
                onChange={v => setPriors({ ...priors, slope2: v })}
                description="Expected cooling energy change per degree above cooling change point"
                format={v => `${v} ${dataset.unit}/°F`} />
            )}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8 }}>
              <PriorSlider label="Prior Strength (precision)" value={priors.strength} min={0.0001} max={0.1} step={0.0001}
                onChange={v => setPriors({ ...priors, strength: v })}
                description="Low = vague (let data dominate). High = confident (resist the data)."
                format={v => v < 0.001 ? "Weak (vague)" : v < 0.01 ? "Moderate" : "Strong (informative)"} />
              <PriorSlider label="Noise Shape (a₀)" value={priors.noiseA} min={1} max={20} step={0.5}
                onChange={v => setPriors({ ...priors, noiseA: v })}
                description="Higher = more confident about noise level"
                format={v => v.toFixed(1)} />
              <PriorSlider label="Noise Scale (b₀)" value={priors.noiseB} min={Math.round(yMax * 0.01)} max={Math.round(yMax * yMax * 0.1)} step={Math.round(yMax * 0.01)}
                onChange={v => setPriors({ ...priors, noiseB: v })}
                description="Centers the prior on expected residual variance"
                format={v => v.toLocaleString()} />
            </div>
          </Card>

          <Card>
            <Label>Your Data (to be observed)</Label>
            <P style={{ fontSize: 13 }}>These {dataset.data.length} observations will update your priors into posteriors.</P>
            <svg width={400} height={250} style={{ fontFamily: MONO }}>
              {/* Simple scatter preview */}
              {(() => {
                const pad = { top: 10, right: 15, bottom: 35, left: 55 };
                const w = 400 - pad.left - pad.right, h = 250 - pad.top - pad.bottom;
                const tMin = Math.min(...temps) - 3, tMax = Math.max(...temps) + 3;
                const eMin = Math.min(...energy) * 0.85, eMax = Math.max(...energy) * 1.1;
                const sx = v => pad.left + ((v - tMin) / (tMax - tMin)) * w;
                const sy = v => pad.top + h - ((v - eMin) / (eMax - eMin)) * h;
                return (
                  <>
                    {dataset.data.map((d, i) => (
                      <circle key={i} cx={sx(d.temp)} cy={sy(d.energy)} r={4} fill={C.teal} fillOpacity={0.8} stroke="#fff" strokeWidth={1} />
                    ))}
                    <line x1={pad.left} x2={pad.left + w} y1={pad.top + h} y2={pad.top + h} stroke={C.border} />
                    <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + h} stroke={C.border} />
                    <text x={pad.left + w / 2} y={pad.top + h + 25} textAnchor="middle" fill={C.textDim} fontSize={11} fontFamily={FONT}>Temperature (°F)</text>
                    <text x={14} y={pad.top + h / 2} textAnchor="middle" fill={C.textDim} fontSize={11} fontFamily={FONT}
                      transform={`rotate(-90, 14, ${pad.top + h / 2})`}>{dataset.unit}</text>
                  </>
                );
              })()}
            </svg>
          </Card>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <Btn secondary onClick={() => setStep(0)}>← Scenario</Btn>
          <Btn onClick={() => { runInference(); setStep(2); }}>Update with data →</Btn>
        </div>
      </>
    );
  };

  const renderPosterior = () => {
    if (!computed) return null;
    const { paramPosts, paramPriors, cpResults, bestCP, post, ols } = computed;
    const paramNames = MODEL_TYPES[modelType].params;

    return (
      <>
        <Label color={C.posterior}>Step 3 · Posterior Distributions</Label>
        <h2 style={{ fontSize: 24, color: C.white, margin: "0 0 8px", fontWeight: 700 }}>Data Meets Beliefs</h2>
        <P>The prior (gray dashed) shows what you believed. The posterior (blue filled) shows what the data taught you. The red dashed line is the frequentist OLS point estimate — notice it falls near the posterior mean, but the Bayesian approach gives you the <Em>full shape of uncertainty</Em>.</P>

        {/* Parameter posteriors */}
        <Card>
          <Label>Parameter Posteriors</Label>
          <div style={{ display: "grid", gridTemplateColumns: paramNames.length > 2 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 16 }}>
            {paramPosts.map((pp, i) => (
              <div key={i}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{paramNames[i]}</div>
                <DensityPlot
                  priorData={paramPriors[i]}
                  posteriorData={pp}
                  olsValue={ols ? ols.beta[i] : null}
                  label={paramNames[i]}
                  width={paramNames.length > 2 ? 280 : 360}
                  height={180}
                />
                <div style={{ fontSize: 11, color: C.textDim, fontFamily: MONO, marginTop: 4 }}>
                  Posterior mean: {pp.mean.toFixed(1)} · 95% CI: [{pp.ci95[0].toFixed(1)}, {pp.ci95[1].toFixed(1)}]
                </div>
                {ols && <div style={{ fontSize: 11, color: C.ols, fontFamily: MONO }}>OLS: {ols.beta[i].toFixed(1)} ± {ols.se[i].toFixed(1)}</div>}
              </div>
            ))}
          </div>
        </Card>

        {/* Change-point posterior */}
        <Card>
          <Label>Change-Point Posterior</Label>
          <P style={{ fontSize: 13 }}>
            Frequentist: <Em>"The change point IS {(ols?.cp || ols?.cph || 0).toFixed(0)}°F"</Em> (grid search picks one winner).
            <br />
            Bayesian: <Em>"Here's the probability distribution over all possible change points."</Em>
          </P>
          <CPPosteriorChart
            cpResults={cpResults}
            olsCP={ols?.cp || ols?.cph}
            width={600}
            height={200}
          />
          {modelType === "5P" && bestCP.cp2 && (
            <div style={{ fontSize: 12, color: C.textSoft, marginTop: 8, fontFamily: MONO }}>
              MAP heating CP: {bestCP.cp.toFixed(0)}°F · MAP cooling CP: {bestCP.cp2.toFixed(0)}°F
            </div>
          )}
        </Card>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <Btn secondary onClick={() => setStep(1)}>← Priors</Btn>
          <Btn onClick={() => setStep(3)}>Posterior predictive →</Btn>
        </div>
      </>
    );
  };

  const renderPredictive = () => {
    if (!computed) return null;
    return (
      <>
        <Label color={C.amber}>Step 4 · Posterior Predictive</Label>
        <h2 style={{ fontSize: 24, color: C.white, margin: "0 0 8px", fontWeight: 700 }}>The Counterfactual Envelope</h2>
        <P>The fan shows what the model predicts at each temperature, with uncertainty bands. Darker bands = more probable. The Bayesian bands incorporate <Em>both parameter uncertainty and noise</Em> — they're wider when priors are vague, narrower when informative.</P>

        <Card>
          <FanChart
            fanData={computed.fan}
            scatterData={dataset.data}
            olsLine={computed.olsLine}
            xLabel="Temperature (°F)"
            yLabel={`Energy (${dataset.unit})`}
            width={700}
            height={400}
          />
        </Card>

        <Card style={{ background: C.surface }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 2 }}>50% Credible</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.posterior }}>Darkest band</div>
              <div style={{ fontSize: 12, color: C.textSoft }}>Half of predictions fall here</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 2 }}>80% Credible</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.posterior }}>Middle band</div>
              <div style={{ fontSize: 12, color: C.textSoft }}>4 in 5 predictions fall here</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 2 }}>95% Credible</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.posterior }}>Lightest band</div>
              <div style={{ fontSize: 12, color: C.textSoft }}>Analogous to freq. 95% CI</div>
            </div>
          </div>
        </Card>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <Btn secondary onClick={() => setStep(2)}>← Posterior</Btn>
          <Btn onClick={() => setStep(4)}>Savings distribution →</Btn>
        </div>
      </>
    );
  };

  const renderSavings = () => {
    if (!computed || !computed.savingsPost) return null;
    const { savingsPost, reportingData } = computed;
    const totalActual = reportingData.reduce((s, d) => s + d.actual, 0);
    const pctSavings = (savingsPost.mean / (totalActual + savingsPost.mean)) * 100;
    const pctCI = [
      (savingsPost.ci95[0] / (totalActual + savingsPost.ci95[0])) * 100,
      (savingsPost.ci95[1] / (totalActual + savingsPost.ci95[1])) * 100,
    ];

    return (
      <>
        <Label color={C.rose}>Step 5 · Savings Distribution</Label>
        <h2 style={{ fontSize: 24, color: C.white, margin: "0 0 8px", fontWeight: 700 }}>Savings as a Full Distribution</h2>
        <P>Frequentist M&V gives you <Em>"12% savings ± 3% at 95% confidence"</Em>. Bayesian M&V gives you <Em>the entire probability distribution of savings</Em> — you can read off any credible interval, compute the probability savings exceed a threshold, or report the full posterior to your client.</P>

        <Card>
          <HistogramChart
            bins={savingsPost.bins}
            ci95={savingsPost.ci95}
            ci80={savingsPost.ci80}
            mean={savingsPost.mean}
            median={savingsPost.median}
            width={600}
            height={240}
            unit={dataset.unit}
          />
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <Card style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Posterior Mean</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.posterior, fontFamily: MONO }}>
              {savingsPost.mean.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span style={{ fontSize: 14 }}>{dataset.unit}</span>
            </div>
            <div style={{ fontSize: 13, color: C.textSoft }}>≈ {pctSavings.toFixed(1)}% savings</div>
          </Card>
          <Card style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>95% Credible Interval</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: MONO }}>
              [{savingsPost.ci95[0].toLocaleString(undefined, { maximumFractionDigits: 0 })}, {savingsPost.ci95[1].toLocaleString(undefined, { maximumFractionDigits: 0 })}]
            </div>
            <div style={{ fontSize: 13, color: C.textSoft }}>[{pctCI[0].toFixed(1)}%, {pctCI[1].toFixed(1)}%]</div>
          </Card>
          <Card style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>P(savings &gt; 0)</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: savingsPost.mean > 0 ? "#2d7d46" : C.ols, fontFamily: MONO }}>
              {((savingsPost.samples.filter(s => s > 0).length / savingsPost.samples.length) * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: 13, color: C.textSoft }}>Probability of real savings</div>
          </Card>
        </div>

        <Card style={{ background: `linear-gradient(135deg, #2c2418 0%, #3d3529 100%)` }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#d4a76a", fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>
            The Bayesian Advantage
          </div>
          <P style={{ color: "#f5f0e8", fontSize: 15 }}>
            A frequentist confidence interval says "if we repeated this experiment many times, 95% of intervals would contain the true value."
            A Bayesian credible interval says "given the data and our prior beliefs, there is a 95% probability the true savings falls in this range."
            The second statement is what clients actually want to know.
          </P>
        </Card>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <Btn secondary onClick={() => setStep(3)}>← Predictive</Btn>
          <a href="https://cfdesigns.vercel.app/#/workbench" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: C.amber, textDecoration: "none", fontFamily: FONT }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
            onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
            Compare in frequentist workbench →
          </a>
          <Btn secondary onClick={() => { setStep(0); setComputed(null); }}>Start over</Btn>
        </div>
      </>
    );
  };

  // ─── RENDER ──────────────────────────────────────────────────
  const renderers = [renderScenario, renderPriors, renderPosterior, renderPredictive, renderSavings];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: FONT, color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Nav bar */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.teal, cursor: "pointer", fontSize: 13, padding: 0, fontFamily: FONT, fontWeight: 600 }}>
            ← Bayesian Home
          </button>
          <span style={{ color: C.border }}>|</span>
          <a href="https://cfdesigns.vercel.app" style={{ color: C.textDim, fontSize: 12, textDecoration: "none", fontFamily: FONT }}
            onMouseEnter={e => e.currentTarget.style.color = C.teal}
            onMouseLeave={e => e.currentTarget.style.color = C.textDim}>
            CF Designs
          </a>
          <a href="https://cfdesigns.vercel.app/#/workbench" style={{ color: C.textDim, fontSize: 12, textDecoration: "none", fontFamily: FONT }}
            onMouseEnter={e => e.currentTarget.style.color = C.amber}
            onMouseLeave={e => e.currentTarget.style.color = C.textDim}>
            Frequentist Workbench
          </a>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => i <= step ? setStep(i) : null}
              style={{
                background: i === step ? C.teal : i < step ? C.tealDim : "transparent",
                color: i === step ? "#fff" : i < step ? C.teal : C.textDim,
                border: `1px solid ${i <= step ? C.teal : C.border}`,
                borderRadius: 4, padding: "4px 14px", fontSize: 12, fontWeight: 600,
                cursor: i <= step ? "pointer" : "default", fontFamily: FONT,
                opacity: i > step ? 0.5 : 1,
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 850, margin: "0 auto", padding: "32px 32px 80px" }}>
        {renderers[step]()}
      </div>
    </div>
  );
}
