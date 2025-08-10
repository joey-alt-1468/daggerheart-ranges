import OBR, { buildShape, isShape } from "https://esm.sh/@owlbear-rodeo/sdk@2";

const NS = "dh-ranges";
const META_KEY = `${NS}/ring`;
const CTX_ID = `${NS}/toggle`;

const DEFAULT_RADII     = [1, 3, 6, 12];
const DEFAULT_COLORS    = ["#f2c94c", "#27ae60", "#2d9cdb", "#9b51e0"];
const DEFAULT_OPACITIES = [0.18, 0.18, 0.18, 0.18];
const STROKE_WIDTH      = 3;

function readConfig() {
  const hasUI = !!document.getElementById("r1");
  if (hasUI) {
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
      opacities: [
        parseFloat(document.getElementById("o1").value),
        parseFloat(document.getElementById("o2").value),
        parseFloat(document.getElementById("o3").value),
        parseFloat(document.getElementById("o4").value),
      ]
    };
  }
  return {
    radii: DEFAULT_RADII,
    colors: DEFAULT_COLORS,
    opacities: DEFAULT_OPACITIES
  };
}

function ringItem({ center, radiusPx, color, fillOpacity }) {
  return buildShape()
    .shapeType("CIRCLE")
    .width(radiusPx * 2)
    .height(radiusPx * 2)
    .position({ x: center.x, y: center.y })
    .strokeColor(color)
    .strokeOpacity(1)
    .strokeWidth(STROKE_WIDTH)
    .fillColor(color)
    .fillOpacity(isFinite(fillOpacity) ? fillOpacity : 0.18)
    .layer("MAP") // Ganz unten unter Tokens
    .locked(true)
    .visible(true)
    .disableHit(true) // Keine Klicks blockieren
    .metadata({ [META_KEY]: true })
    .name("DH Range")
    .build();
}

async function removeRings() {
  const all = await OBR.scene.items.getItems();
  const ringIds = all.filter(i => i?.metadata?.[META_KEY] && isShape(i)).map(i => i.id);
  if (ringIds.length) await OBR.scene.items.deleteItems(ringIds);
}

async function addRingsFor(token, radiiSquares, colors, opacities) {
  const dpi = await OBR.scene.grid.getDpi();
  const center = token.position;

  const pairs = radiiSquares
    .map((sq, i) => ({
      squares: sq,
      color: colors[i],
      opacity: opacities[i]
    }))
    .sort((a, b) => b.squares - a.squares);

  const items = pairs.map(({ squares, color, opacity }) =>
    ringItem({ center, radiusPx: dpi * squares, color, fillOpacity: opacity })
  );

  const added = await OBR.scene.items.addItems(items);

  await OBR.scene.items.updateItems(
    added.map(it => it.id),
    (prev) => ({
      ...prev,
      locked: true,
      selectable: false,
      disableHit: true
    })
  );
}

async function toggleForToken(token) {
  const cfg = readConfig();
  const all = await OBR.scene.items.getItems();
  const hasAny = all.some(i => i?.metadata?.[META_KEY]);
  if (hasAny) await removeRings();
  else await addRingsFor(token, cfg.radii, cfg.colors, cfg.opacities);
}

async function onApplyClick() {
  const sel = await OBR.player.getSelection();
  if (!sel?.length) {
    await OBR.notification.show("Bitte zuerst EIN Token auswählen.");
    return;
  }
  const [item] = await OBR.scene.items.getItems([sel[0]]);
  if (!item) {
    await OBR.notification.show("Kein gültiges Token.");
    return;
  }
  await toggleForToken(item);
}

async function ensureContextMenu() {
  try {
    await OBR.contextMenu.create({
      id: CTX_ID,
      icons: [{ icon: "/icon.svg", label: "Toggle Ranges" }],
      onClick: async (ctx) => {
        const token = ctx.items?.[0];
        if (!token) {
          await OBR.notification.show("Bitte ein Token rechtsklicken.");
          return;
        }
        await toggleForToken(token);
      },
    });
  } catch {}
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
  wireUI();
  await ensureContextMenu();
});
