/**
 * Bayesian M&V Engine
 * 
 * Conjugate Normal-Inverse-Gamma inference for change-point regression.
 * All posteriors are analytically exact — no MCMC, runs instantly in browser.
 * 
 * Prior:  β|σ² ~ N(μ₀, σ²Λ₀⁻¹),  σ² ~ IG(a₀, b₀)
 * Posterior: β|σ²,y ~ N(μₙ, σ²Λₙ⁻¹),  σ²|y ~ IG(aₙ, bₙ)
 * Predictive: y*|y ~ t_{2aₙ}(x*ᵀμₙ, bₙ/aₙ · (1 + x*ᵀΛₙ⁻¹x*))
 */

// ──────────────────────────────────────────────────────────────
// Matrix utilities (small matrices only — max 3×3 for 5P model)
// ──────────────────────────────────────────────────────────────

function matMul(A, B) {
  const m = A.length, n = B[0].length, k = B.length;
  const C = Array.from({ length: m }, () => Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      for (let l = 0; l < k; l++)
        C[i][j] += A[i][l] * B[l][j];
  return C;
}

function matVecMul(A, v) {
  return A.map(row => row.reduce((s, a, j) => s + a * v[j], 0));
}

function vecDot(a, b) {
  return a.reduce((s, ai, i) => s + ai * b[i], 0);
}

function matTranspose(A) {
  const m = A.length, n = A[0].length;
  return Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => A[i][j]));
}

function matAdd(A, B) {
  return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}

function matScale(A, s) {
  return A.map(row => row.map(v => v * s));
}

function matInvert(M) {
  const n = M.length;
  const aug = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-14) return null;
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= f * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}

function matDet(M) {
  const n = M.length;
  if (n === 1) return M[0][0];
  if (n === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
  if (n === 3) {
    return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
         - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
         + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  }
  // LU decomposition for larger (shouldn't need for M&V)
  let det = 1;
  const A = M.map(r => [...r]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++)
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    if (maxRow !== i) { [A[i], A[maxRow]] = [A[maxRow], A[i]]; det *= -1; }
    if (Math.abs(A[i][i]) < 1e-14) return 0;
    det *= A[i][i];
    for (let k = i + 1; k < n; k++) {
      const f = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) A[k][j] -= f * A[i][j];
    }
  }
  return det;
}

function identityMatrix(n) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
}

// ──────────────────────────────────────────────────────────────
// Special functions
// ──────────────────────────────────────────────────────────────

/** Log-gamma via Lanczos approximation */
function logGamma(z) {
  if (z <= 0) return Infinity;
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  let x = coef[0];
  for (let i = 1; i < g + 2; i++) x += coef[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Student-t PDF */
function studentTPDF(x, nu, mu = 0, scale = 1) {
  const z = (x - mu) / scale;
  const logP = logGamma((nu + 1) / 2) - logGamma(nu / 2)
    - 0.5 * Math.log(nu * Math.PI) - Math.log(scale)
    - ((nu + 1) / 2) * Math.log(1 + z * z / nu);
  return Math.exp(logP);
}

/** Student-t CDF (numerical integration via Simpson's rule) */
function studentTCDF(x, nu, mu = 0, scale = 1) {
  const z = (x - mu) / scale;
  // Use regularized incomplete beta function
  const t = nu / (nu + z * z);
  if (z >= 0) {
    return 1 - 0.5 * regIncBeta(nu / 2, 0.5, t);
  } else {
    return 0.5 * regIncBeta(nu / 2, 0.5, t);
  }
}

/** Student-t quantile (inverse CDF) via bisection */
function studentTQuantile(p, nu, mu = 0, scale = 1) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return mu;
  let lo = mu - 50 * scale, hi = mu + 50 * scale;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCDF(mid, nu, mu, scale) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Regularized incomplete beta function */
function regIncBeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Continued fraction (Lentz's method)
  const lnBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta);
  
  if (x < (a + 1) / (a + b + 2)) {
    return front * betaCF(a, b, x) / a;
  } else {
    return 1 - front * betaCF(b, a, 1 - x) / b;
  }
}

function betaCF(a, b, x) {
  const maxIter = 200, eps = 1e-14;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

/** Inverse-Gamma PDF */
function invGammaPDF(x, a, b) {
  if (x <= 0) return 0;
  return Math.exp(a * Math.log(b) - logGamma(a) - (a + 1) * Math.log(x) - b / x);
}

/** Normal PDF */
function normalPDF(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

// ──────────────────────────────────────────────────────────────
// Bayesian Linear Regression (Conjugate NIG)
// ──────────────────────────────────────────────────────────────

/**
 * Build the design matrix for a given model type and change-point(s)
 */
export function buildDesignMatrix(temps, modelType, cp1 = null, cp2 = null) {
  switch (modelType) {
    case "3PH":
      return temps.map(t => [1, Math.max(0, cp1 - t)]);
    case "3PC":
      return temps.map(t => [1, Math.max(0, t - cp1)]);
    case "5P":
      return temps.map(t => [1, Math.max(0, cp1 - t), Math.max(0, t - cp2)]);
    default: // 2P
      return temps.map(t => [1, t]);
  }
}

/**
 * Compute posterior parameters for conjugate NIG regression.
 * 
 * @param {number[][]} X - Design matrix (n × p)
 * @param {number[]} y - Response vector (n)
 * @param {number[]} mu0 - Prior mean for β (p)
 * @param {number[][]} Lambda0 - Prior precision for β (p × p)
 * @param {number} a0 - Prior shape for σ²
 * @param {number} b0 - Prior scale for σ²
 * @returns {object} Posterior parameters
 */
export function bayesianRegression(X, y, mu0, Lambda0, a0, b0) {
  const n = y.length;
  const p = X[0].length;
  const Xt = matTranspose(X);
  const XtX = matMul(Xt, X.map(row => row.map((v, j) => [v]))).map(row =>
    row.map(v => v[0] !== undefined ? v[0] : v)
  );
  // Recompute XtX properly
  const XtX2 = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < p; j++)
      for (let k = 0; k < p; k++)
        XtX2[j][k] += X[i][j] * X[i][k];

  const Xty = Array(p).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < p; j++)
      Xty[j] += X[i][j] * y[i];

  // Posterior precision
  const LambdaN = matAdd(Lambda0, XtX2);
  const LambdaN_inv = matInvert(LambdaN);
  if (!LambdaN_inv) return null;

  // Posterior mean
  const Lambda0_mu0 = matVecMul(Lambda0, mu0);
  const sum = Lambda0_mu0.map((v, j) => v + Xty[j]);
  const muN = matVecMul(LambdaN_inv, sum);

  // Posterior shape
  const aN = a0 + n / 2;

  // Posterior scale
  const yty = vecDot(y, y);
  const mu0_L0_mu0 = vecDot(mu0, matVecMul(Lambda0, mu0));
  const muN_LN_muN = vecDot(muN, matVecMul(LambdaN, muN));
  const bN = b0 + 0.5 * (yty + mu0_L0_mu0 - muN_LN_muN);

  // Log marginal likelihood
  const logDetLambda0 = Math.log(Math.abs(matDet(Lambda0)));
  const logDetLambdaN = Math.log(Math.abs(matDet(LambdaN)));
  const logML = -n / 2 * Math.log(2 * Math.PI)
    + 0.5 * logDetLambda0 - 0.5 * logDetLambdaN
    + a0 * Math.log(b0) - aN * Math.log(bN)
    + logGamma(aN) - logGamma(a0);

  // OLS for comparison
  const XtX_inv = matInvert(XtX2);
  const betaOLS = XtX_inv ? matVecMul(XtX_inv, Xty) : muN;
  const yHat = X.map(xi => vecDot(xi, betaOLS));
  const residuals = y.map((yi, i) => yi - yHat[i]);
  const SSres = residuals.reduce((s, r) => s + r * r, 0);
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const SStot = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);

  return {
    muN, LambdaN, LambdaN_inv, aN, bN, logML,
    n, p,
    // OLS comparison
    betaOLS,
    R2: 1 - SSres / SStot,
    cvRMSE_OLS: (Math.sqrt(SSres / (n - p)) / yMean) * 100,
  };
}

/**
 * Compute posterior over change-point locations via marginal likelihood.
 * Returns array of { cp, logML, posterior } for each candidate.
 */
export function changePointPosterior(temps, y, modelType, priors, cpStep = 0.5) {
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const results = [];

  if (modelType === "3PH" || modelType === "3PC") {
    for (let cp = tMin + 3; cp <= tMax - 3; cp += cpStep) {
      const X = buildDesignMatrix(temps, modelType, cp);
      const { mu0, Lambda0, a0, b0 } = buildPriorParams(priors, X[0].length);
      const post = bayesianRegression(X, y, mu0, Lambda0, a0, b0);
      if (post) results.push({ cp, logML: post.logML, post });
    }
  } else if (modelType === "5P") {
    for (let cph = tMin + 4; cph <= tMax - 10; cph += 1) {
      for (let cpc = cph + 6; cpc <= tMax - 4; cpc += 1) {
        const X = buildDesignMatrix(temps, modelType, cph, cpc);
        const { mu0, Lambda0, a0, b0 } = buildPriorParams(priors, X[0].length);
        const post = bayesianRegression(X, y, mu0, Lambda0, a0, b0);
        if (post) results.push({ cp: cph, cp2: cpc, logML: post.logML, post });
      }
    }
  }

  if (results.length === 0) return [];

  // Normalize log marginal likelihoods to posterior probabilities
  const maxLogML = Math.max(...results.map(r => r.logML));
  const unnorm = results.map(r => Math.exp(r.logML - maxLogML));
  const Z = unnorm.reduce((a, b) => a + b, 0);
  results.forEach((r, i) => { r.posterior = unnorm[i] / Z; });

  return results;
}

/**
 * Build prior parameters from user-facing sliders.
 * 
 * @param {object} priors - User-set prior parameters
 *   - baseload: prior mean for β₀
 *   - slope: prior mean for β₁ (and β₂ for 5P)
 *   - strength: prior precision multiplier (higher = stronger prior)
 *   - noiseA: prior shape for σ²
 *   - noiseB: prior scale for σ²
 * @param {number} p - Number of parameters
 */
function buildPriorParams(priors, p) {
  const mu0 = p === 2
    ? [priors.baseload, priors.slope]
    : [priors.baseload, priors.slope, priors.slope2 || priors.slope];

  // Prior precision: diagonal, scaled by strength
  const lambda = priors.strength;
  const Lambda0 = identityMatrix(p).map(row => row.map(v => v * lambda));

  return { mu0, Lambda0, a0: priors.noiseA, b0: priors.noiseB };
}

// ──────────────────────────────────────────────────────────────
// Posterior summaries for visualization
// ──────────────────────────────────────────────────────────────

/**
 * Marginal posterior density for a single β parameter.
 * β_j | y ~ t_{2aₙ}(μₙⱼ, bₙ/aₙ · [Λₙ⁻¹]ⱼⱼ)
 */
export function parameterPosterior(post, paramIndex, nPoints = 200) {
  const nu = 2 * post.aN;
  const mu = post.muN[paramIndex];
  const scale = Math.sqrt((post.bN / post.aN) * post.LambdaN_inv[paramIndex][paramIndex]);
  
  // Generate density over ±4 standard deviations
  const range = 4 * scale;
  const points = [];
  for (let i = 0; i < nPoints; i++) {
    const x = mu - range + (2 * range * i) / (nPoints - 1);
    points.push({ x, density: studentTPDF(x, nu, mu, scale) });
  }

  // Credible intervals
  const ci95 = [
    studentTQuantile(0.025, nu, mu, scale),
    studentTQuantile(0.975, nu, mu, scale),
  ];
  const ci80 = [
    studentTQuantile(0.10, nu, mu, scale),
    studentTQuantile(0.90, nu, mu, scale),
  ];

  return { points, mean: mu, ci95, ci80, nu, scale };
}

/**
 * Posterior density for σ² ~ IG(aₙ, bₙ)
 */
export function sigmaPosterior(post, nPoints = 200) {
  const a = post.aN, b = post.bN;
  const mode = b / (a + 1);
  const mean = a > 1 ? b / (a - 1) : mode * 2;
  const range = mean * 3;
  
  const points = [];
  for (let i = 1; i < nPoints; i++) {
    const x = (range * i) / nPoints;
    points.push({ x, density: invGammaPDF(x, a, b) });
  }
  return { points, mode, mean: a > 1 ? mean : null };
}

/**
 * Prior density for a single β parameter.
 * Under NIG prior: β_j marginally ~ t_{2a₀}(μ₀ⱼ, b₀/a₀ · [Λ₀⁻¹]ⱼⱼ)
 */
export function parameterPrior(priors, paramIndex, p, nPoints = 200) {
  const { mu0, Lambda0, a0, b0 } = buildPriorParams(priors, p);
  const Lambda0_inv = matInvert(Lambda0);
  if (!Lambda0_inv) return null;

  const nu = 2 * a0;
  const mu = mu0[paramIndex];
  const scale = Math.sqrt((b0 / a0) * Lambda0_inv[paramIndex][paramIndex]);
  
  const range = 4 * scale;
  const points = [];
  for (let i = 0; i < nPoints; i++) {
    const x = mu - range + (2 * range * i) / (nPoints - 1);
    points.push({ x, density: studentTPDF(x, nu, mu, scale) });
  }
  return { points, mean: mu, nu, scale };
}

/**
 * Posterior predictive at a single temperature.
 * y*|y ~ t_{2aₙ}(x*ᵀμₙ, bₙ/aₙ · (1 + x*ᵀΛₙ⁻¹x*))
 */
export function predictiveAtTemp(post, xStar) {
  const nu = 2 * post.aN;
  const mu = vecDot(xStar, post.muN);
  const quadForm = vecDot(xStar, matVecMul(post.LambdaN_inv, xStar));
  const scale = Math.sqrt((post.bN / post.aN) * (1 + quadForm));

  return {
    mean: mu,
    scale,
    nu,
    ci50: [studentTQuantile(0.25, nu, mu, scale), studentTQuantile(0.75, nu, mu, scale)],
    ci80: [studentTQuantile(0.10, nu, mu, scale), studentTQuantile(0.90, nu, mu, scale)],
    ci95: [studentTQuantile(0.025, nu, mu, scale), studentTQuantile(0.975, nu, mu, scale)],
  };
}

/**
 * Generate posterior predictive fan chart data.
 */
export function posteriorPredictiveFan(post, modelType, cp1, cp2, tempMin, tempMax, nPoints = 100) {
  const fan = [];
  for (let i = 0; i < nPoints; i++) {
    const temp = tempMin + (tempMax - tempMin) * i / (nPoints - 1);
    let xStar;
    switch (modelType) {
      case "3PH": xStar = [1, Math.max(0, cp1 - temp)]; break;
      case "3PC": xStar = [1, Math.max(0, temp - cp1)]; break;
      case "5P":  xStar = [1, Math.max(0, cp1 - temp), Math.max(0, temp - cp2)]; break;
      default:    xStar = [1, temp];
    }
    const pred = predictiveAtTemp(post, xStar);
    fan.push({
      temp, mean: pred.mean,
      ci50_lo: pred.ci50[0], ci50_hi: pred.ci50[1],
      ci80_lo: pred.ci80[0], ci80_hi: pred.ci80[1],
      ci95_lo: pred.ci95[0], ci95_hi: pred.ci95[1],
    });
  }
  return fan;
}

/**
 * Compute savings posterior.
 * Given reporting-period temperatures, compute:
 *   Savings = Σ(Counterfactual - Actual)
 * where Counterfactual uses the posterior predictive.
 * 
 * For the distribution, we use Monte Carlo from the posterior (easy with NIG).
 */
export function savingsPosterior(post, modelType, cp1, cp2, reportingData, nSamples = 5000) {
  const p = post.muN.length;
  
  // Sample from posterior: σ² ~ IG(aₙ, bₙ), β|σ² ~ N(μₙ, σ²Λₙ⁻¹)
  const samples = [];
  for (let s = 0; s < nSamples; s++) {
    // Sample σ² from Inverse-Gamma via Gamma
    const sigma2 = sampleInvGamma(post.aN, post.bN);
    
    // Sample β from N(μₙ, σ²Λₙ⁻¹)
    const beta = sampleMVN(post.muN, matScale(post.LambdaN_inv, sigma2));
    
    // Compute total savings for this sample
    let totalSavings = 0;
    for (const d of reportingData) {
      let xStar;
      switch (modelType) {
        case "3PH": xStar = [1, Math.max(0, cp1 - d.temp)]; break;
        case "3PC": xStar = [1, Math.max(0, d.temp - cp1)]; break;
        case "5P":  xStar = [1, Math.max(0, cp1 - d.temp), Math.max(0, d.temp - cp2)]; break;
        default:    xStar = [1, d.temp];
      }
      const counterfactual = vecDot(xStar, beta);
      totalSavings += counterfactual - d.actual;
    }
    samples.push(totalSavings);
  }

  samples.sort((a, b) => a - b);

  const mean = samples.reduce((a, b) => a + b, 0) / nSamples;
  const ci95 = [samples[Math.floor(nSamples * 0.025)], samples[Math.floor(nSamples * 0.975)]];
  const ci80 = [samples[Math.floor(nSamples * 0.10)], samples[Math.floor(nSamples * 0.90)]];
  const median = samples[Math.floor(nSamples * 0.5)];

  // Histogram bins
  const binCount = 50;
  const sMin = samples[0], sMax = samples[nSamples - 1];
  const binWidth = (sMax - sMin) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    x: sMin + (i + 0.5) * binWidth,
    lo: sMin + i * binWidth,
    hi: sMin + (i + 1) * binWidth,
    count: 0,
  }));
  for (const s of samples) {
    const idx = Math.min(Math.floor((s - sMin) / binWidth), binCount - 1);
    bins[idx].count++;
  }
  const maxCount = Math.max(...bins.map(b => b.count));
  bins.forEach(b => { b.density = b.count / (nSamples * binWidth); });

  return { samples, mean, median, ci95, ci80, bins, maxCount };
}

// ──────────────────────────────────────────────────────────────
// Random sampling utilities
// ──────────────────────────────────────────────────────────────

function sampleNormal() {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleGamma(shape, scale = 1) {
  // Marsaglia and Tsang's method
  if (shape < 1) {
    return sampleGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x, v;
    do {
      x = sampleNormal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v * scale;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
}

function sampleInvGamma(a, b) {
  return b / sampleGamma(a, 1);
}

function sampleMVN(mu, Sigma) {
  // Cholesky decomposition
  const n = mu.length;
  const L = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = Sigma[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-15)) : s / L[j][j];
    }
  }
  // z ~ N(0, I), then μ + Lz ~ N(μ, Σ)
  const z = Array.from({ length: n }, () => sampleNormal());
  return mu.map((m, i) => m + L[i].reduce((s, l, j) => s + l * z[j], 0));
}

// ──────────────────────────────────────────────────────────────
// OLS for comparison (same as existing workbench)
// ──────────────────────────────────────────────────────────────

export function fitOLS(X, y) {
  const n = y.length, p = X[0].length;
  const XtX = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < p; j++)
      for (let k = 0; k < p; k++)
        XtX[j][k] += X[i][j] * X[i][k];
  const Xty = Array(p).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < p; j++)
      Xty[j] += X[i][j] * y[i];

  const inv = matInvert(XtX);
  if (!inv) return null;

  const beta = matVecMul(inv, Xty);
  const yHat = X.map(xi => vecDot(xi, beta));
  const residuals = y.map((yi, i) => yi - yHat[i]);
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const SSres = residuals.reduce((s, r) => s + r * r, 0);
  const SStot = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
  const MSE = SSres / (n - p);
  const RMSE = Math.sqrt(MSE);

  return {
    beta, yHat, residuals,
    R2: 1 - SSres / SStot,
    cvRMSE: (RMSE / yMean) * 100,
    NMBE: (residuals.reduce((a, b) => a + b, 0) / ((n - p) * yMean)) * 100,
    RMSE,
    // Confidence intervals
    se: beta.map((_, j) => Math.sqrt(MSE * inv[j][j])),
  };
}

export function fitOLSWithCP(temps, energy, modelType) {
  const tMin = Math.min(...temps), tMax = Math.max(...temps);
  
  if (modelType === "3PH") {
    let best = null, bestSS = Infinity;
    for (let cp = tMin + 3; cp <= tMax - 3; cp += 0.5) {
      const X = buildDesignMatrix(temps, "3PH", cp);
      const r = fitOLS(X, energy);
      if (r && r.R2 > 0 && vecDot(r.residuals, r.residuals) < bestSS && r.beta[1] > 0) {
        bestSS = vecDot(r.residuals, r.residuals);
        best = { ...r, cp };
      }
    }
    return best;
  }
  if (modelType === "3PC") {
    let best = null, bestSS = Infinity;
    for (let cp = tMin + 3; cp <= tMax - 3; cp += 0.5) {
      const X = buildDesignMatrix(temps, "3PC", cp);
      const r = fitOLS(X, energy);
      if (r && r.R2 > 0 && vecDot(r.residuals, r.residuals) < bestSS && r.beta[1] > 0) {
        bestSS = vecDot(r.residuals, r.residuals);
        best = { ...r, cp };
      }
    }
    return best;
  }
  if (modelType === "5P") {
    let best = null, bestSS = Infinity;
    for (let cph = tMin + 4; cph <= tMax - 10; cph += 1) {
      for (let cpc = cph + 6; cpc <= tMax - 4; cpc += 1) {
        const X = buildDesignMatrix(temps, "5P", cph, cpc);
        const r = fitOLS(X, energy);
        if (r && r.R2 > 0 && vecDot(r.residuals, r.residuals) < bestSS && r.beta[1] > 0 && r.beta[2] > 0) {
          bestSS = vecDot(r.residuals, r.residuals);
          best = { ...r, cph, cpc };
        }
      }
    }
    return best;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// Default / smart priors
// ──────────────────────────────────────────────────────────────

/**
 * Generate sensible default priors based on the dataset.
 * This gives learners a reasonable starting point.
 */
export function defaultPriors(temps, energy, modelType) {
  const yMean = energy.reduce((a, b) => a + b, 0) / energy.length;
  const ySD = Math.sqrt(energy.reduce((s, e) => s + (e - yMean) ** 2, 0) / energy.length);
  const tRange = Math.max(...temps) - Math.min(...temps);

  return {
    baseload: Math.round(yMean * 0.5), // rough guess: half the mean
    slope: Math.round(ySD / tRange * 2),  // rough: how much energy changes per degree
    slope2: Math.round(ySD / tRange * 2), // for 5P
    strength: 0.001, // weak prior — let data dominate
    noiseA: 3,       // weakly informative
    noiseB: Math.round(ySD * ySD), // center near observed variance
  };
}
