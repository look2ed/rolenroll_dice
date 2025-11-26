document.getElementById("dice-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const totalInput = document.getElementById("total");
  const specialInput = document.getElementById("special");

  const total = parseInt(totalInput.value || "0", 10);
  if (isNaN(total) || total <= 0) {
    alert("Please enter a valid total number of dice (at least 1).");
    return;
  }

  const { adv, neg } = parseSpecialDice(specialInput.value || "");

  // limit advantage & negative dice to 4 each (your previous rule)
  if (adv > 4 || neg > 4) {
    alert("Positive (a) and Negative (n) special dice are limited to 4 each.");
    return;
  }

  // special dice must not exceed total dice
  if (adv + neg > total) {
    alert("The sum of special dice (a + n) cannot be more than the total dice.");
    return;
  }

  const normal = total - adv - neg;

  const {
    resultHtml,
    baseScore,
    rerollPoints,
    rCount,
    plusTokens,
    minusTokens
  } = rollRoleAndRollDice({ normal, adv, neg });

  document.getElementById("result").innerHTML = resultHtml;

  const totalPoints = baseScore + rerollPoints; // tokens don't change score

  document.getElementById("based-score").textContent = baseScore;
  document.getElementById("rr-count").textContent = rCount;
  document.getElementById("rr-points").textContent = rerollPoints;
  document.getElementById("plus-tokens").textContent = plusTokens;
  document.getElementById("minus-tokens").textContent = minusTokens;
  document.getElementById("total-points").textContent = totalPoints;
});

/**
 * Parse the "Special dice" field.
 * Format: aX for positive dice, nY for negative dice.
 * Examples: "a1, n1", "a2 n1", "a1,a1,n2"
 */
function parseSpecialDice(str) {
  let adv = 0;
  let neg = 0;

  const trimmed = str.trim();
  if (!trimmed) return { adv, neg };

  const tokens = trimmed.split(/[, ]+/).map(t => t.trim()).filter(Boolean);

  for (const token of tokens) {
    const m = token.match(/^([an])(\d+)$/i);
    if (!m) {
      alert(
        `Invalid special dice token: "${token}".\n` +
        'Use format like: "a1, n1" (a = positive, n = negative).'
      );
      throw new Error("Invalid special dice format");
    }
    const type = m[1].toLowerCase();
    const num = parseInt(m[2], 10);

    if (type === "a") adv += num;
    else if (type === "n") neg += num;
  }

  return { adv, neg };
}

/**
 * Define faces for each type of die.
 * You can change these arrays later to match the exact Role&Roll system.
 *
 * Rules we implement now:
 *  - "."  → 1 point
 *  - "Ⓡ" → 1 point + 1 extra reroll die
 *  - "+"  → 0 point, +1 token
 *  - "-"  → 0 point, -1 token
 *  - " " (blank) → 0 point
 */
const FACE_SETS = {
  normal: [
    { symbol: "·", basePoints: 1, isR: false, plusTokens: 0, minusTokens: 0 },
    { symbol: "·", basePoints: 1, isR: false, plusTokens: 0, minusTokens: 0 },
    { symbol: "Ⓡ", basePoints: 1, isR: true,  plusTokens: 0, minusTokens: 0 },
    { symbol: "+", basePoints: 0, isR: false, plusTokens: 1, minusTokens: 0 },
    { symbol: "-", basePoints: 0, isR: false, plusTokens: 0, minusTokens: 1 },
    { symbol: " ", basePoints: 0, isR: false, plusTokens: 0, minusTokens: 0 }
  ],
  // For now use same faces for positive/negative.
  // Later you can customize these to bias towards + or - if needed.
  positive: [
    { symbol: "·", basePoints: 1, isR: false, plusTokens: 0, minusTokens: 0 },
    { symbol: "·", basePoints: 1, isR: false, plusTokens: 0, minusTokens: 0 },
    { symbol: "Ⓡ", basePoints: 1, isR: true,  plusTokens: 0, minusTokens: 0 },
    { symbol: "+", basePoints: 0, isR: false, plusTokens: 1, minusTokens: 0 },
    { symbol: "+", basePoints: 0, isR: false, plusTokens: 1, minusTokens: 0 },
    { symbol: " ", basePoints: 0, isR: false, plusTokens: 0, minusTokens: 0 }
  ],
  negative: [
    { symbol: "·", basePoints: 1, isR: false, plusTokens: 0, minusTokens: 0 },
    { symbol: "·", basePoints: 1, isR: false, plusTokens: 0, minusTokens: 0 },
    { symbol: "Ⓡ", basePoints: 1, isR: true,  plusTokens: 0, minusTokens: 0 },
    { symbol: "-", basePoints: 0, isR: false, plusTokens: 0, minusTokens: 1 },
    { symbol: "-", basePoints: 0, isR: false, plusTokens: 0, minusTokens: 1 },
    { symbol: " ", basePoints: 0, isR: false, plusTokens: 0, minusTokens: 0 }
  ]
};

/**
 * Roll dice, handle R rerolls, and build the HTML + summary.
 */
function rollRoleAndRollDice({ normal, adv, neg }) {
  const baseRolls = [];    // initial roll
  const rerollRolls = [];  // all rerolls (including chains)
  const rerollQueue = [];  // { pool: "normal" | "positive" | "negative" }

  function rollDie(pool, isReroll) {
    const faces = FACE_SETS[pool];
    const face = faces[Math.floor(Math.random() * faces.length)];
    const roll = {
      pool,
      isReroll,
      symbol: face.symbol,
      basePoints: face.basePoints,
      isR: face.isR,
      plusTokens: face.plusTokens,
      minusTokens: face.minusTokens
    };

    if (isReroll) {
      rerollRolls.push(roll);
    } else {
      baseRolls.push(roll);
    }

    if (face.isR) {
      // each R grants one extra reroll die of the same pool
      rerollQueue.push({ pool });
    }
  }

  // Initial rolls
  for (let i = 0; i < normal; i++) rollDie("normal", false);
  for (let i = 0; i < adv; i++)    rollDie("positive", false);
  for (let i = 0; i < neg; i++)    rollDie("negative", false);

  // Process rerolls (including chains)
  while (rerollQueue.length > 0) {
    const { pool } = rerollQueue.shift();
    rollDie(pool, true);
  }

  // Group rolls by pool + reroll flag for display
  const pools = ["normal", "positive", "negative"];
  const poolLabels = {
    normal: "Normal",
    positive: "Positive",
    negative: "Negative"
  };

  const baseByPool = { normal: [], positive: [], negative: [] };
  const rerollByPool = { normal: [], positive: [], negative: [] };

  for (const r of baseRolls) baseByPool[r.pool].push(r);
  for (const r of rerollRolls) rerollByPool[r.pool].push(r);

  // Build HTML for dice faces
  let resultHtml = "";

  for (const pool of pools) {
    const base = baseByPool[pool];
    const rer = rerollByPool[pool];
    if (!base.length && !rer.length) continue;

    resultHtml += `<div class="pool-block">`;
    resultHtml += `<div class="pool-title">${poolLabels[pool]} dice</div>`;

    if (base.length) {
      resultHtml += `<div class="dice-row">`;
      resultHtml += base.map(r => renderDie(r, false)).join("");
      resultHtml += `</div>`;
    }

    if (rer.length) {
      resultHtml += `<div class="pool-subtitle">(reroll)</div>`;
      resultHtml += `<div class="dice-row">`;
      resultHtml += rer.map(r => renderDie(r, true)).join("");
      resultHtml += `</div>`;
    }

    resultHtml += `</div>`;
  }

  // Calculate scores
  let baseScore = 0;
  let rerollPoints = 0;
  let rCount = 0;
  let plusTokens = 0;
  let minusTokens = 0;

  function accumulate(rolls, isReroll) {
    for (const r of rolls) {
      if (isReroll) {
        rerollPoints += r.basePoints;
      } else {
        baseScore += r.basePoints;
      }
      if (r.isR) rCount += 1;
      plusTokens += r.plusTokens;
      minusTokens += r.minusTokens;
    }
  }

  accumulate(baseRolls, false);
  accumulate(rerollRolls, true);

  return {
    resultHtml,
    baseScore,
    rerollPoints,
    rCount,
    plusTokens,
    minusTokens
  };
}

/**
 * Render a single die as a little square with the face symbol.
 */
function renderDie(roll, isReroll) {
  const classes = ["die"];
  if (roll.isR) classes.push("die-r");
  if (roll.plusTokens) classes.push("die-plus");
  if (roll.minusTokens) classes.push("die-minus");
  if (isReroll) classes.push("die-reroll");

  const symbol = roll.symbol === " " ? "" : roll.symbol;
  return `<span class="${classes.join(" ")}">${symbol}</span>`;
}
