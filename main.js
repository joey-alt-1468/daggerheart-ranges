// ESM: SDK von esm.sh laden (stabil in Owlbear)
import OBR, { buildShape, isShape } from "https://esm.sh/@owlbear-rodeo/sdk@2";

const NS = "dh-ranges";
const META_KEY = `${NS}/ring`;
const CTX_ID = `${NS}/toggle`;

// Defaults
const DEFAULT_RADII  = [1, 3, 6, 12]; // in Feldern (Grid)
const DEFAULT_COLORS = ["#f2c94c", "#27ae60", "#2d9cdb", "#9b51e0"]; // gelb/grün/blau/violett
const FILL_OPACITY   = 0.18; // 0..1 – Stärke der Flächenfüllung
const STROKE_WIDTH   = 3;

function readConfig() {
  const r1 = document.getElementById("r1");
  if (r1) {
    return {
      radii: [
        parseInt(document.getElementById("r1").value, 10),
        parseInt(document.getElementById("r2").value, 10),
        parseInt(document.getElementById("r3").value, 10),
        parseInt(document.getElementById("r4").value, 10),
      ],
      colors: [
        document.getElementById("c1").value,
        document.getElementById("c2").value,
        document.getElementById("c3").value,
        document.getElementById("c4").value,
      ],
    };
  }
  return { radii: DEFAULT_RADII, colors: DEFAULT_COLORS };
}

function ringItem({ center, radiusPx, color, attachedTo }) {
  return buildShape()
    .shapeType("CIRCLE")
    .width(radiusPx * 2)
    .height(radiusPx * 2)
    .position({ x: center.x, y: center.y })
    .attachedTo(attachedTo)
    .strokeColor(color)
    .strokeOpacity(1)
    .strokeWidth(STROKE_WIDTH)
    .fillColor(color)          // gleiche Farbe wie der Rand …
    .fillOpacity(FILL_OPACITY) // … aber halbtransparent
    .layer("ATTACHMENT")
    .metadata({ [META_KEY]: true })
    .name("DH Range")
    .build();
}

async function removeRingsFor(tokenId) {
  const attached = await OBR.scene.items.getItemAttachments([tokenId]);
  const ringIds = attached.filter(i => i?.metadata?.[META_KEY] && isShape(i)).map(i => i.id);
  if (ringIds.length) await OBR.scene.items.deleteItems(ringIds);
}

async function addRingsFor(token, radiiSquares, colors) {
  const dpi = await OBR.scene.grid.getDpi(); // Pixel je Feld
  const center = token.position;

  // Größte Zone zuerst zeichnen, dann kleinere obendrauf => klar getrennte Bänder
  const pairs = radiiSquares
    .map((sq, i) => ({ squares: sq, color: colors[i] }))
    .sort((a, b) => b.squares - a.squares); // absteigend

  const items = pairs.map(({ squares, color }) =>
    ringItem({ center, radiusPx: dpi * squares, color, attachedTo: token.id })
  );

  await OBR.scene.items.addItems(items);
}

async function toggleForToken(token) {
  const cfg = readConfig();
  const attached = await OBR.scene.items.getItemAttachments([token.id]);
  const hasAny = attached.some(i => i?.metadata?.[META_KEY]);
  if (hasAny) await removeRingsFor(token.id);
  else await addRingsFor(token, cfg.radii, cfg.colors);
}

async function onApplyClick() {
  const sel = await OBR.player.getSelection();
  if (!sel?.length) { await OBR.notification.show("Bitte zuerst EIN Token auswählen."); return; }
  const [item] = await OBR.scene.items.getItems([sel[0]]);
  if (!item) { await OBR.notification.show("Kein gültiges Token."); return; }
  await toggleForToken(item);
}

async function ensureContextMenu() {
  try {
    await OBR.contextMenu.create({
      id: CTX_ID,
      icons: [{ icon: "/icon.svg", label: "Toggle Ranges" }],
      onClick: async (ctx) => {
        const token = ctx.items?.[0];
        if (!token) { await OBR.notification.show("Bitte ein Token rechtsklicken."); return; }
        await toggleForToken(token);
      },
    });
  } catch {/* schon registriert */}
}

function wireUI() {
  const applyBtn = document.getElementById("apply");
  const regBtn   = document.getElementById("register");
  if (applyBtn) applyBtn.addEventListener("click", onApplyClick);
  if (regBtn)   regBtn.addEventListener("click", async () => {
    await ensureContextMenu();
    await OBR.notification.show("Kontextmenü 'Toggle Ranges' aktiv.");
  });
}

OBR.onReady(async () => {
  wireUI();              // Buttons im Fenster
  await ensureContextMenu(); // Rechtsklick sofort verfügbar
});
