// ===============================
// RolEnRoll Dice System Logic (browser version)
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("dice-form");
  form.addEventListener("submit", onSubmit);
});

// Keep value between min and max
function clamp(v, min, max) {
  v = Number(v ?? 0);
  if (Number.isNaN(v)) v = 0;
  return Math.max(min, Math.min(max, v));
}

// Build the 6 faces for a single die configuration.
// All dice start as: ["1", "", "", "", "", "R"]
// kind = "normal" | "adv" | "neg"
// adv: plusCount = 1..4   → "+" on that many blank faces
// neg: minusCount = 1..4  → "-" on that many blank faces
function buildDieFaces(config = {}) {
  const kind = config.kind ?? "normal";
  const faces = ["1", "", "", "", "", "R"]; // index 0..5 (die sides 1..6)

  if (kind === "adv") {
    let plusCount = config.plusCount ?? 1;
    if (plusCount > 4) {
      alert("Advantage die: max plus faces is 4. Using 4.");
    }
    plusCount = clamp(plusCount, 1, 4);
    for (let i = 0; i < plusCount; i++) {
      faces[1 + i] = "+"; // fill positions 2–5
    }
  } else if (kind === "neg") {
    let minusCount = config.minusCount ?? 1;
    if (minusCount > 4) {
      alert("Negative die: max minus faces is 4. Using 4.");
    }
    minusCount = clamp(minusCount, 1, 4);
    for (let i = 0; i < minusCount; i++) {
      faces[1 + i] = "-"; // fill positions 2–5
    }
  }

  return faces;
}

// Convert numeric d6 result (1–6) to face label
function faceForRoll(config, value) {
  const faces = buildDieFaces(config);
  const index = clamp(value, 1, 6) - 1;
  return faces[index];
}

// Score faces using your rules:
// - "1" = 1 point
// - "R" = 1 point + 1 reroll
// - "+" / "-" only change final total if there is at least 1 base point
// - blank = 0
function scoreFaces(faces) {
  let basePoints = 0;
  let plusCount = 0;
  let minusCount = 0;
  let rerollCount = 0;

  for (const f of faces) {
    if (f === "1") {
      basePoints++;
    } else if (f === "R") {
      basePoints++;
      rerollCount++;
    } else if (f === "+") {
      plusCount++;
    } else if (f === "-") {
      minusCount++;
    }
  }

  let total = 0;
  if (basePoints > 0) {
    total = basePoints + plusCount - minusCount;
    if (total < 0) total = 0; // no negative totals
  }

  return { basePoints, plusCount, minusCount, rerollCount, total };
}

// Simple d6
function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

// Roll a pool of RolEnRoll dice with rerolls (browser version)
// dice = array of configs:
//   { kind: "normal" }
//   { kind: "adv", plusCount: 2 }
//   { kind: "neg", minusCount: 1 }
function rollRolenrollPoolBrowser(dice) {
  if (!Array.isArray(dice) || dice.length === 0) {
    dice = Array.from({ length: 5 }, () => ({ kind: "normal" }));
  }

  const baseResults = [];
  const rerollResults = [];

  let pending = dice.map(d => ({ config: { ...d }, isReroll: false }));
  let safety = 0;

  // Each "R" creates another die of the same config
  while (pending.length > 0 && safety < 100) {
    safety++;
    const next = [];

    for (const item of pending) {
      const { config, isReroll } = item;
      const value = rollD6();
      const face = faceForRoll(config, value);
      const rec = { config, roll: value, face, isReroll };

      if (isReroll) {
        rerollResults.push(rec);
      } else {
        baseResults.push(rec);
      }

      if (face === "R") {
        next.push({ config: { ...config }, isReroll: true }); // reroll same die
      }
    }

    pending = next;
  }

  const baseFaces = baseResults.map(r => r.face);
  const rerollFaces = rerollResults.map(r => r.face);
  const allFaces = baseFaces.concat(rerollFaces);

  const scoring = scoreFaces(allFaces);

  // Split base vs reroll for your summary
  const basedScore = baseFaces.reduce(
    (s, f) => s + ((f === "1" || f === "R") ? 1 : 0),
    0
  );
  const rerollPoints = rerollFaces.reduce(
    (s, f) => s + ((f === "1" || f === "R") ? 1 : 0),
    0
  );
  const plusTokens = allFaces.filter(f => f === "+").length;
  const minusTokens = allFaces.filter(f => f === "-").length;
  const rerollCount = allFaces.filter(f => f === "R").length;

  // Build HTML squares for each die face (like your Foundry chat)
  const diceHtml = allFaces.map(f => {
    let symbol = "&nbsp;";
    let extraClass = "";

    if (f === "1") {
      symbol = "●";            // 1 point = dot
      extraClass = "role-roll-face-point";
    } else if (f === "R") {
      symbol = "Ⓡ";            // reroll symbol
      extraClass = "role-roll-face-reroll";
    } else if (f === "+") {
      symbol = "+";            // advantage
      extraClass = "role-roll-face-plus";
    } else if (f === "-") {
      symbol = "−";            // negative
      extraClass = "role-roll-face-minus";
    } else {
      // blank
      extraClass = "role-roll-face-blank";
    }

    return `<span class="role-roll-die ${extraClass}">${symbol}</span>`;
  }).join("");

  const html = `
<div class="role-roll-chat">
  <div class="role-roll-header"><strong>Role&amp;Roll Dice Pool</strong></div>
  <div class="role-roll-dice-row">
    ${diceHtml}
  </div>
</div>`;

  return {
    html,
    scoring,
    basedScore,
    rerollPoints,
    rerollCount,
    plusTokens,
    minusTokens
  };
}

// Parse "Special dice" field: aX / nY just like your /rr command
// e.g. "a1, n2" → [{kind:"adv", plusCount:1}, {kind:"neg", minusCount:2}]
function parseSpecialDice(str) {
  const configs = [];
  const trimmed = str.trim();
  if (!trimmed) return configs;

  const tokens = trimmed.split(/[, ]+/).map(t => t.trim()).filter(Boolean);

  for (const token of tokens) {
    let m = token.match(/^a(\d+)$/i);
    if (m) {
      const plusCount = parseInt(m[1], 10);
      configs.push({ kind: "adv", plusCount });
      continue;
    }
    m = token.match(/^n(\d+)$/i);
    if (m) {
      const minusCount = parseInt(m[1], 10);
      configs.push({ kind: "neg", minusCount });
      continue;
    }

    alert(`Invalid special dice token: "${token}". Use aX or nY, e.g. "a1, n2".`);
    throw new Error("Invalid special dice format");
  }

  return configs;
}

// Handle form submit
function onSubmit(e) {
  e.preventDefault();

  const totalInput = document.getElementById("total-dice");
  const specialInput = document.getElementById("special");

  const total = parseInt(totalInput.value || "0", 10);
  if (isNaN(total) || total <= 0) {
    alert("Please enter a valid total number of dice (at least 1).");
    return;
  }

  const specialConfigs = parseSpecialDice(specialInput.value || "");
  if (specialConfigs.length > total) {
    alert("Number of special dice (a/n) cannot be more than Total dice.");
    return;
  }

  const dice = [...specialConfigs];
  const normalCount = total - specialConfigs.length;
  for (let i = 0; i < normalCount; i++) {
    dice.push({ kind: "normal" });
  }

  if (dice.length > 50) {
    alert("RolEnRoll: Too many dice requested (max 50).");
    return;
  }

  const {
    html,
    scoring,
    basedScore,
    rerollPoints,
    rerollCount,
    plusTokens,
    minusTokens
  } = rollRolenrollPoolBrowser(dice);

  document.getElementById("result").innerHTML = html;

  // Summary
  document.getElementById("based-score").textContent = basedScore;
  document.getElementById("rr-count").textContent = rerollCount;
  document.getElementById("rr-points").textContent = rerollPoints;
  document.getElementById("plus-tokens").textContent = plusTokens;
  document.getElementById("minus-tokens").textContent = minusTokens;
  document.getElementById("total-points").textContent = scoring.total;
}
