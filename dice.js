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

  // limit advantage & negative dice to 4 each
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

  const { logText, totalValue } = rollRoleAndRollDice({ normal, adv, neg });

  document.getElementById("result").innerHTML = logText;
  document.getElementById("total-result").textContent = totalValue;
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
 * MAIN ROLLING LOGIC
 * Replace the faces below with your real Role&Roll dice faces.
 *
 * normalFaces   = normal dice
 * positiveFaces = special positive dice (advantage)
 * negativeFaces = special negative dice (negative)
 */
function rollRoleAndRollDice({ normal, adv, neg }) {
  // TODO: replace these arrays with the actual Role&Roll faces
  const normalFaces   = [0, 1, 1, 2, "Ⓡ", "."];      // example only
  const positiveFaces = [1, 1, 2, 2, 3, "Ⓡ", "."];   // example only
  const negativeFaces = [-1, -1, -2, -2, "Ⓡ", "."];  // example only

  let total = 0;
  let logParts = [];

  function rollFrom(faces, count, label) {
    for (let i = 0; i < count; i++) {
      const face = faces[Math.floor(Math.random() * faces.length)];
      logParts.push(`${label} ${i + 1}: ${formatFace(face)}`);

      if (typeof face === "number") {
        total += face;
      }
      // if face is "Ⓡ" or ".", handle extra effects if needed
      // (e.g., reroll, special success, etc.)
    }
  }

  if (normal > 0) rollFrom(normalFaces, normal, "Normal");
  if (adv > 0)    rollFrom(positiveFaces, adv, "Positive");
  if (neg > 0)    rollFrom(negativeFaces, neg, "Negative");

  return {
    logText: logParts.join("\n"),
    totalValue: total,
  };
}

function formatFace(face) {
  if (face === "Ⓡ") {
    return `<span class="r-symbol">Ⓡ</span>`;
  }
  return String(face);
}
