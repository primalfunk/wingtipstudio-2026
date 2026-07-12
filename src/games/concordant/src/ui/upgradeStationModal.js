export function showUpgradeStationModal(root, state, onAction) {
  if (!root) {
    return null;
  }

  const overlay = document.createElement("div");
  overlay.className = "overlay upgrade-station-modal";

  const panel = document.createElement("div");
  panel.className = "upgrade-panel";

  const title = document.createElement("div");
  title.className = "upgrade-title";
  title.textContent = "Upgrade Station";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "upgrade-close";
  closeButton.textContent = "Close";
  closeButton.setAttribute("aria-label", "Close upgrade menu");
  closeButton.addEventListener("click", () => {
    if (onAction) {
      onAction("close");
    }
  });

  const currency = document.createElement("div");
  currency.className = "upgrade-currency";

  const tierCap = document.createElement("div");
  tierCap.className = "upgrade-tier";

  const list = document.createElement("div");
  list.className = "upgrade-list";

  const createRow = (label, actionKey, buttonText = "Purchase") => {
    const row = document.createElement("div");
    row.className = "upgrade-row";

    const name = document.createElement("div");
    name.className = "upgrade-name";
    name.textContent = label;

    const level = document.createElement("div");
    level.className = "upgrade-level";

    const gain = document.createElement("div");
    gain.className = "upgrade-gain";

    const cost = document.createElement("div");
    cost.className = "upgrade-cost";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "upgrade-button";
    button.textContent = buttonText;
    button.addEventListener("click", () => {
      if (onAction) {
        onAction(actionKey);
      }
    });

    row.appendChild(name);
    row.appendChild(level);
    row.appendChild(gain);
    row.appendChild(cost);
    row.appendChild(button);

    return { row, level, gain, cost, button };
  };

  const fireRow = createRow("Fire Rate", "fireRate");
  const fireDistanceRow = createRow("Fire Distance", "fireDistance");
  const scanDistanceRow = createRow("Scan Distance", "scanDistance");
  const fuelTankRow = createRow("Fuel Tank", "fuelTank", "Upgrade");
  const hullRow = createRow("Armor Plating", "hull");
  const collectorRow = createRow("Collector", "collector");
  const repairRow = createRow("Repair Armor", "repair");
  const refuelRow = createRow("Refuel", "refuel", "Refuel");

  list.appendChild(fireRow.row);
  list.appendChild(fireDistanceRow.row);
  list.appendChild(scanDistanceRow.row);
  list.appendChild(fuelTankRow.row);
  list.appendChild(hullRow.row);
  list.appendChild(collectorRow.row);
  list.appendChild(repairRow.row);
  list.appendChild(refuelRow.row);

  panel.appendChild(title);
  panel.appendChild(closeButton);
  panel.appendChild(currency);
  panel.appendChild(tierCap);
  panel.appendChild(list);
  overlay.appendChild(panel);
  root.appendChild(overlay);

  const update = (next) => {
    const data = next ?? state;
    currency.textContent = `Resource: ${Math.round(data.currency ?? 0)}`;
    tierCap.textContent = data.tierCap ? `Tier cap (advisory): ${data.tierCap}` : "Tier cap: none";

    fireRow.level.textContent = `Level ${data.upgrades.fireRateLevel}`;
    fireRow.gain.textContent = data.gains?.fireRate ?? "";
    fireRow.cost.textContent = `${data.costs.fireRate}`;
    fireRow.button.disabled = (data.currency ?? 0) < data.costs.fireRate;

    fireDistanceRow.level.textContent = `Level ${data.upgrades.fireDistanceLevel}`;
    fireDistanceRow.gain.textContent = data.gains?.fireDistance ?? "";
    fireDistanceRow.cost.textContent = `${data.costs.fireDistance}`;
    fireDistanceRow.button.disabled = (data.currency ?? 0) < data.costs.fireDistance;

    scanDistanceRow.level.textContent = `Level ${data.upgrades.scanDistanceLevel}`;
    scanDistanceRow.gain.textContent = data.gains?.scanDistance ?? "";
    scanDistanceRow.cost.textContent = data.costs.scanDistance !== null ? `${data.costs.scanDistance}` : "Max reached";
    scanDistanceRow.button.disabled = data.costs.scanDistance === null || (data.currency ?? 0) < data.costs.scanDistance;

    fuelTankRow.level.textContent = `Level ${data.upgrades.fuelTankLevel}`;
    fuelTankRow.gain.textContent = data.gains?.fuelTank ?? "";
    fuelTankRow.cost.textContent = `${data.costs.fuelTank}`;
    fuelTankRow.button.disabled = (data.currency ?? 0) < data.costs.fuelTank;

    hullRow.level.textContent = `Level ${data.upgrades.hullLevel}`;
    hullRow.gain.textContent = data.gains?.hull ?? "";
    hullRow.cost.textContent = `${data.costs.hull}`;
    hullRow.button.disabled = (data.currency ?? 0) < data.costs.hull;

    collectorRow.level.textContent = `Level ${data.upgrades.collectorLevel}`;
    collectorRow.gain.textContent = data.gains?.collector ?? "";
    collectorRow.cost.textContent = `${data.costs.collector}`;
    collectorRow.button.disabled = (data.currency ?? 0) < data.costs.collector;

    const missing = Math.max(0, (data.maxArmor ?? 0) - (data.armor ?? 0));
    repairRow.level.textContent = missing > 0 ? `${missing} missing` : "Fully repaired";
    repairRow.gain.textContent = missing > 0 ? "Restore" : "OK";
    repairRow.cost.textContent = data.costs.repair !== null ? `${data.costs.repair}` : "N/A";
    repairRow.button.disabled = data.costs.repair === null || (data.currency ?? 0) < data.costs.repair;

    const missingFuel = Math.max(0, (data.maxFuel ?? 0) - (data.fuel ?? 0));
    refuelRow.level.textContent = missingFuel > 0 ? `${Math.ceil(missingFuel)} needed` : "Tank full";
    refuelRow.gain.textContent = missingFuel > 0 ? "Refill" : "OK";
    refuelRow.cost.textContent = data.costs.refuel !== null ? `${data.costs.refuel}` : "N/A";
    refuelRow.button.disabled = data.costs.refuel === null || (data.currency ?? 0) < data.costs.refuel;
  };

  update(state);

  function destroy() {
    overlay.remove();
  }

  return {
    update,
    destroy
  };
}
