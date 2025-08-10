import OBR, { buildShape, isShape } from "https://unpkg.com/@owlbear-rodeo/sdk@2?module";

const NS = "dh-ranges";
const META_KEY = `${NS}/ring`;
const CTX_ID = `${NS}/toggle`;

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

async function getSelectedItem() {
  const ids = await OBR.player.getSelection();
  if (!ids?.length) return undefined;
  const [item] = await OBR.scene.items.getItems([ids[0]]);
  return item;
}

async function removeRingsFor(tokenId) {
  const attached = await OBR.scene.items.getItemAttachments([tokenId]);
  const ringIds = attached.filter(i => i.metadata?.[META_KEY] && isShape(i)).map(i => i.id);
  if (ringIds.length) await OBR.scene.items.deleteItems(ringIds);
}

async function addRingsFor(token, radiiSquares, colors) {
  const dpi = await OBR.scene.grid.getDpi(); // Pixel je Feld
  const center = token.position;
  const items = radiiSquares.map((sq, idx) =>
    ringItem({
      center,
      radiusPx: dpi * sq,
      color: colors[idx],
      attachedTo: token.id
    })
  );
  await OBR.scene.items.addItems(items);
}

async function toggleForSelection(cfg) {
  const token = await getSelectedItem();
  if (!token) {
    await OBR.notification.show("Bitte zuerst ein Token auswählen.");
    return;
  }
  const attached = await OBR.scene.items.getItemAttachments([token.id]);
  const hasAny = attached.some(i => i.metadata?.[META_KEY]);
  if (hasAny) {
    await removeRingsFor(token.id);
  } else {
    await addRingsFor(token, cfg.radii, cfg.colors);
  }
}

function readConfig() {
  return {
    radii: [
      parseInt(document.getElementById("r1").value, 10),
      parseInt(document.getElementById("r2").value, 10),
      parseInt(document.getElementById("r3").value, 10),
      parseInt(document.getElementById("r4").value, 10)
    ],
    colors: [
      document.getElementById("c1").value,
      document.getElementById("c2").value,
      document.getElementById("c3").value,
      document.getElementById("c4").value
    ]
  };
}

async function initUI() {
  document.getElementById("apply").addEventListener("click", () => toggleForSelection(readConfig()));
  document.getElementById("register").addEventListener("click", async () => {
    await OBR.contextMenu.create({
      id: CTX_ID,
      icons: [{ icon: "/icon.svg", label: "Toggle Ranges" }],
      onClick: async (ctx) => {
        if (!ctx.items.length) return;
        const token = ctx.items[0];
        const cfg = readConfig();
        const attached = await OBR.scene.items.getItemAttachments([token.id]);
        const hasAny = attached.some(i => i.metadata?.[META_KEY]);
        if (hasAny) {
          await removeRingsFor(token.id);
        } else {
          await addRingsFor(token, cfg.radii, cfg.colors);
        }
      }
    });
    await OBR.notification.show("Kontextmenü 'Toggle Ranges' hinzugefügt.");
  });
}

// Nur im Owlbear-Kontext initialisieren
OBR.onReady(() => {
  const fb = document.getElementById("fallback");
  if (fb) fb.style.display = "none";
  initUI();
});
