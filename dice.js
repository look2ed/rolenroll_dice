// ===============================
// RolEnRoll Dice System Logic – Browser version
// ===============================

let rollHistory = [];

document.addEventListener("DOMContentLoaded", () => {
  // form submit
  const form = document.getElementById("dice-form");
  if (form) form.addEventListener("submit", onSubmit);

  // help panel toggle
  const helpBtn = document.getElementById("help-toggle");
  const manual = document.getElementById("manual-guide");

  if (helpBtn && manual) {
    helpBtn.addEventListener("click", () => {
      const isNowHidden = manual.classList.toggle("hidden");
      helpBtn.setAttribute("aria-expanded", (!isNowHidden).toString());
    });
  }

  // language switching (TH / EN)
  const langButtons = document.querySelectorAll(".lang-btn");
  const pageTH = document.getElementById("manual-th");
  const pageEN = document.getElementById("manual-en");

  function setLang(lang) {
    if (!pageTH || !pageEN) return;

    if (lang === "th") {
      pageTH.classList.remove("hidden");
      pageEN.classList.add("hidden");
    } else {
      pageEN.classList.remove("hidden");
      pageTH.classList.add("hidden");
    }

    langButtons.forEach(btn => {
      const bLang = btn.getAttribute("data-lang");
      if (bLang === lang) btn.classList.add("active");
      else btn.classList.remove("active");
    });
  }

  langButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-lang") || "th";
      setLang(lang);
    });
  });

  // default language = TH
  setLang("th");

  // history panel toggle
  const historyBtn = document.getElementById("history-toggle");
  const historyPanel = document.getElementById("history-panel");
  if (historyBtn && historyPanel) {
    historyBtn.addEventListener("click", () => {
      const isNowHidden = historyPanel.classList.toggle("hidden");
      historyBtn.setAttribute("aria-expanded", (!isNowHidden).toString());
    });
  }

  // initial empty history render
  renderHistory();
});

// ---------- helpers from your Foundry logic ----------

// Keep value between min and max
function clamp(v, min, max) {
  v = Number(v ?? 0);
  if (Number.isNaN(v)) v = 0;
  return Math.max(min, Math.min(max, v));
}

// Build the 6 faces for a single die configuration.
// kind = "normal" | "adv" | "neg"
function buildDieFaces(config = {}) {
  const kind = config.kind ?? "normal";
  const faces = ["1", "", "", "", "", "R"]; // sides 1..6

  if (kind === "adv") {
    let plusCount = config.plusCount ?? 1;
    if (plusCount > 4) {
      alert("Advantage die: max plus faces is 4. Using 4.");
    }
    plusCount = clamp(plusCount, 1, 4);
    for (let i = 0; i < plusCount; i++) {
      faces[1 + i] = "+"; // positions 2–5
    }
  } else if (kind === "neg") {
    let minusCount = config.minusCount ?? 1;
    if (minusCount > 4) {
      alert("Negative die: max minus faces is 4. Using 4.");
    }
    minusCount = clamp(minusCount, 1, 4);
    for (let i = 0; i < minusCount; i++) {
      faces[1 + i] = "-"; // positions 2–5
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
// - "+" / "-" only affect score if basePoints > 0
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

// Simple d6 roll
function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

// ---------- main pool roller with multi-round display ----------

function rollRolenrollPoolBrowser(dice) {
  if (!Array.isArray(dice) || dice.length === 0) {
    dice = Array.from({ length: 5 }, () => ({ kind: "normal" }));
  }

  // rounds[0] = first roll
  // rounds[1] = rerolls from R in round 0
  // rounds[2] = rerolls from R in round 1, etc.
  const rounds = [];

  let current = dice.map(config => ({ config }));
  let safety = 0;

  while (current.length > 0 && safety < 100) {
    safety++;

    const thisRound = [];
    const next = [];

    for (const { config } of current) {
      const value = rollD6();
      const face = faceForRoll(config, value);
      thisRound.push({ config, roll: value, face });

      if (face === "R") {
        // R → another die of the same config in the next round
        next.push({ config: { ...config } });
      }
    }

    rounds.push(thisRound);
    current = next;
  }

  const baseFaces = rounds[0] ? rounds[0].map(r => r.face) : [];
  const rerollFaces = rounds.slice(1).flat().map(r => r.face);
  const allFaces = baseFaces.concat(rerollFaces);

  const scoring = scoreFaces(allFaces);

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

  // ---- Build HTML: one row per round ----
  let html = `
<div class="role-roll-chat">
  <div class="role-roll-header"><strong>Role&amp;Roll Dice Pool</strong></div>
`;

  rounds.forEach((round, idx) => {
    if (!round.length) return;
    const facesHtml = round.map(r => faceToDieHtml(r.face)).join("");

    let label = "";
    if (idx === 0) {
      label = "";
    } else {
      label = `<em>(reroll ${idx})</em>&nbsp;`;
    }

    html += `
  <div class="role-roll-dice-row">
    ${label}${facesHtml}
  </div>
`;
  });

  html += `</div>`;

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

// Render a single die as HTML span
function faceToDieHtml(f) {
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
    extraClass = "role-roll-face-blank"; // blank
  }

  return `<span class="role-roll-die ${extraClass}">${symbol}</span>`;
}

// ---------- parse "Special dice" like /rr (aX / nY) ----------

function parseSpecialDice(str) {
  const configs = [];
  const trimmed = str.trim();
  if (!trimmed) return configs;

  const tokens = trimmed.split(/[, ]+/).map(t => t.trim()).filter(Boolean);

  for (const token of tokens) {
    let m = token.match(/^a(\d+)$/i);
    if (m) {
      const plusCount = parseInt(m[1], 10);
      configs.push({ kind: "adv", plusCount }); // 1 ADV die with plusCount faces
      continue;
    }
    m = token.match(/^n(\d+)$/i);
    if (m) {
      const minusCount = parseInt(m[1], 10);
      configs.push({ kind: "neg", minusCount }); // 1 NEG die with minusCount faces
      continue;
    }

    alert(`Invalid special dice token: "${token}". Use aX or nY, e.g. "a1, n2".`);
    throw new Error("Invalid special dice format");
  }

  return configs;
}

// ---------- history rendering ----------

function renderHistory() {
  const container = document.getElementById("history-list");
  if (!container) return;

  if (!rollHistory.length) {
    container.innerHTML = '<p class="history-empty">No rolls yet.</p>';
    return;
  }

  const html = rollHistory.map(entry => {
    const date = new Date(entry.time);
    const timeStr = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const dateStr = date.toLocaleDateString();

    const specialText = entry.special || "-";

    return `
      <div class="history-item">
        <div class="history-header-line">
          <span class="history-time">${dateStr} ${timeStr}</span>
          <span class="history-total">Total: ${entry.finalTotal}</span>
        </div>
        <div class="history-row">
          <span>Dice: ${entry.totalDice}</span>
          <span>Special: ${specialText}</span>
        </div>
        <div class="history-row">
          <span>Base: ${entry.baseScore}</span>
          <span>R&amp;R: ${entry.rerollCount} (+${entry.rerollPoints})</span>
        </div>
        <div class="history-row">
          <span>Tokens: +${entry.plusTokens} / -${entry.minusTokens}</span>
          <span>Succ/Pen: +${entry.success} / -${entry.penalty}</span>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

// ---------- form handler ----------

function onSubmit(e) {
  e.preventDefault();

  const totalInput =
    document.getElementById("total-dice") ||
    document.getElementById("total"); // fallback

  const specialInput = document.getElementById("special");
  const successInput = document.getElementById("success");
  const penaltyInput = document.getElementById("penalty");

  const total = parseInt(totalInput.value || "0", 10);
  if (isNaN(total) || total <= 0) {
    alert("Please enter a valid total number of dice (at least 1).");
    return;
  }

// Trigger 3D dice roll if available (visual only)
  if (window.roll3dDice) {
    window.roll3dDice(total);
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

  // Roll dice
  const {
    html,
    scoring,
    basedScore,
    rerollPoints,
    rerollCount,
    plusTokens,
    minusTokens
  } = rollRolenrollPoolBrowser(dice);

  // Read success / penalty modifiers
  let success = parseInt(successInput.value || "0", 10);
  let penalty = parseInt(penaltyInput.value || "0", 10);
  if (isNaN(success)) success = 0;
  if (isNaN(penalty)) penalty = 0;
  if (success < 0) success = 0;
  if (penalty < 0) penalty = 0;

  // Dice total from scoring.total, then apply stats
  const diceTotal = scoring.total;
  let finalTotal = diceTotal + success - penalty;
  if (finalTotal < 0) finalTotal = 0;

  // Show dice faces
  const resultDiv = document.getElementById("result");
  if (resultDiv) resultDiv.innerHTML = html;

  // Summary
  const elBase = document.getElementById("based-score");
  if (elBase) elBase.textContent = basedScore;

  const elRrCount = document.getElementById("rr-count");
  if (elRrCount) elRrCount.textContent = rerollCount;

  const elRrPoints = document.getElementById("rr-points");
  if (elRrPoints) elRrPoints.textContent = rerollPoints;

  const elPlus = document.getElementById("plus-tokens");
  if (elPlus) elPlus.textContent = plusTokens;

  const elMinus = document.getElementById("minus-tokens");
  if (elMinus) elMinus.textContent = minusTokens;

  const elSucc = document.getElementById("stat-success");
  if (elSucc) elSucc.textContent = success;

  const elPen = document.getElementById("stat-penalty");
  if (elPen) elPen.textContent = penalty;

  const elTotal = document.getElementById("total-points");
  if (elTotal) elTotal.textContent = finalTotal;

  // ---- Add to history ----
  const entry = {
    time: Date.now(),
    totalDice: total,
    special: (specialInput.value || "").trim(),
    success,
    penalty,
    diceTotal,
    finalTotal,
    baseScore: basedScore,
    rerollPoints,
    rerollCount,
    plusTokens,
    minusTokens
  };

  // latest roll at top
  rollHistory.unshift(entry);
  // optional: limit to last 50 entries
  if (rollHistory.length > 50) rollHistory.length = 50;

  renderHistory();
}
