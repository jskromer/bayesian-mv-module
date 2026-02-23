# Bayesian M&V Module

Interactive educational tool teaching Bayesian approaches to Measurement & Verification (M&V) baseline modeling. Part of the [Counterfactual Designs](https://counterfactual-designs.com) family.

## Same Data. Same Models. Different Inference.

A companion to the [frequentist M&V workbench](https://mv-course.vercel.app), using the same building datasets and change-point regression models but applying Bayesian inference via the Normal-Inverse-Gamma conjugate prior.

### The Pedagogical Contrast

| Frequentist | Bayesian |
|---|---|
| OLS finds the single best-fit line | Posterior gives full distribution over parameters |
| Change point picked by grid search (one winner) | Change point has its own probability distribution |
| Confidence interval: "95% of repeated intervals contain the truth" | Credible interval: "95% probability the truth is here" |
| Savings: 12% ± 3% | P(savings > 10%) = 87% |

### Interactive Steps

1. **Scenario** — Choose building (heating/cooling/mixed) and model type
2. **Priors** — Set prior beliefs via sliders (the step that doesn't exist in frequentist M&V)
3. **Posterior** — Watch data update beliefs: parameter densities + change-point probability
4. **Predictive** — Fan chart showing 50/80/95% credible bands
5. **Savings** — Full posterior distribution of savings with credible intervals

### Technical Approach

All inference uses the **Normal-Inverse-Gamma conjugate prior** — the posterior is analytically exact. No MCMC sampling, no Python backend. Drag a slider and the posterior updates instantly in the browser.

Change-point locations are compared via marginal likelihood, producing a proper posterior probability over candidate change points.

## Tech Stack

- Vite + React (JSX)
- Custom SVG visualizations
- Pure JavaScript math engine (no external stats libraries)
- Deployed on Vercel

## Related

- [Counterfactual Designs Course](https://cfdesigns.vercel.app) — Three-dimension M&V framework
- [IPMVP Implementation Course](https://mv-course.vercel.app) — Frequentist workbench
- [counterfactual-designs.com](https://counterfactual-designs.com) — Central resource

## Author

Steve Kromer — *The Role of the Measurement and Verification Professional* (River Publishers, 2024)
