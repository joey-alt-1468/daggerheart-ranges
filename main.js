// UMD SDK (per <script src="https://unpkg.com/@owlbear-rodeo/sdk@2"></script> in index.html)
const OBR = window.OBR;
const { buildShape, isShape } = OBR;

const NS = "dh-ranges";
const META_KEY = `${NS}/ring`;
const CTX_ID = `${NS}/toggle`;

const DEFAULT_RADII  = [1, 3, 6, 12];
const DEFAULT_COLORS = ["#f2c94c", "#27ae60", "#2d9cdb", "#9b51e0"];

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
    .strokeWidth(3)
    .fillOpacity(0)
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
  const dpi = await OBR.scene.grid.getDpi();     // Pixel pro Feld
  if (!dpi || isNaN(dpi)) throw new Error("Grid DPI nicht verfügbar.");
  const center = token.position;
  const items = radiiSquares.map((sq, idx) =>
    ringItem({ center, radiusPx: dpi * sq, color: colors[idx], attachedTo: token.id })
  );
  await OBR.scene.items.addItems(items);
}

async function toggleForToken(token) {
  const cfg = readConfig();
  const attached = await OBR.scene.items.getItemAttachments([token.id]);
  const hasAny = attached.some(i => i?.metadata?.[META_KEY]);
  if (hasAny) {
    await removeRingsFor(token.id);
    await OBR.notification.show("Ranges entfernt.");
  } else {
    await addRingsFor(token, cfg.radii, cfg.colors);
    await OBR.notification.show("Ranges hinzugefügt.");
  }
}

async function onApplyClick() {
  try {
    const sel = await OBR.player.getSelection();
    if (!sel?.length) { await OBR.notification.show("Bitte zuerst EIN Token auswählen."); return; }
    const [item] = await OBR.scene.items.getItems([sel[0]]);
    if (!item) { await OBR.notification.show("Kein gültiges Item ausgewählt."); return; }
    await toggleForToken(item);
  } catch (e) {
    console.error(e);
    await OBR.notification.show("Fehler beim Anwenden (siehe Console).");
  }
}

async function ensureContextMenu() {
  try {
    await OBR.contextMenu.create({
      id: CTX_ID,
      icons: [{ icon: "/icon.svg", label: "Toggle Ranges" }],
      onClick: async (ctx) => {
        try {
          const token = ctx.items?.[0];
          if (!token) { await OBR.notification.show("Bitte ein Token rechtsklicken."); return; }
          await toggleForToken(token);
        } catch (e) {
          console.error(e);
          await OBR.notification.show("Fehler (siehe Console).");
        }
      },
    });
  } catch { /* schon registriert */ }
}

function wireUI() {
  const applyBtn = document.getElementById("apply");
  const regBtn   = document.getElementById("register");

  if (applyBtn) {
    applyBtn.addEventListener("click", onApplyClick);
  }
  if (regBtn) {
    regBtn.addEventListener("click", async () => {
      await ensureContextMenu();
      await OBR.notification.show("Kontextmenü 'Toggle Ranges' aktiv.");
    });
  }
}

// Reihenfolge: erst DOM da, dann OBR ready → dann UI verdrahten
document.addEventListener("DOMContentLoaded", () => {
  OBR.onReady(async () => {
    wireUI();
    await ensureContextMenu();
    try { await OBR.notification.show("Daggerheart Ranges geladen. Rechtsklick → Toggle Ranges."); } catch {}
  });
});
