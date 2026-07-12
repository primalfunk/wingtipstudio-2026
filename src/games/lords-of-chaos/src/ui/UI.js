import { MessageDisplay } from "./MessageDisplay.js";
import { MapVisualizer } from "../render/MapVisualizer.js";

export class UI {
  constructor(words) {
    this.words = words;
    this.root = document.querySelector(".game");
    this.title = document.querySelector(".title-screen");
    this.nameInput = document.querySelector("#player-name");
    this.startButton = document.querySelector("#start-button");
    this.helpButton = document.querySelector("#help-button");
    this.titleHelpButton = document.querySelector("#help-button-title");
    this.helpOverlay = document.querySelector("#help-overlay");
    this.helpClose = document.querySelector("#help-close");
    this.introOverlay = document.querySelector("#intro-overlay");
    this.introContinue = document.querySelector("#intro-continue");
    this.tutorialToast = document.querySelector("#tutorial-toast");
    this.tutorialDismiss = document.querySelector("#tutorial-dismiss");
    this.tutorialText = this.tutorialToast?.querySelector("p");
    this.roomText = document.querySelector("#room-text");
    this.objectiveStatus = document.querySelector("#objective-status");
    this.stats = document.querySelector("#stats");
    this.inventory = document.querySelector("#inventory");
    this.inventoryTitle = document.querySelector("#inventory-title");
    this.equipment = document.querySelector("#equipment");
    this.actionButton = document.querySelector("#action-button");
    this.useButton = document.querySelector("#use-button");
    this.guardButton = document.querySelector("#guard-button");
    this.fleeButton = document.querySelector("#flee-button");
    this.directionButtons = [...document.querySelectorAll("[data-dir]")];
    this.messages = new MessageDisplay(document.querySelector("#messages"));
    this.mapVisualizer = new MapVisualizer(document.querySelector("#map"));
    this.itemCategoryMap = this.parseItemCategories();
    this.tutorialTimeout = null;
  }

  bind(game) {
    this.game = game;
    this.startButton.addEventListener("click", () => {
      this.title.hidden = true;
      this.root.hidden = false;
      this.mapVisualizer.resize();
      game.startGame(this.nameInput.value.trim() || "PLAYER");
    });
    this.helpButton.addEventListener("click", () => this.showHelp());
    this.titleHelpButton.addEventListener("click", () => this.showHelp());
    this.helpClose.addEventListener("click", () => this.hideHelp());
    this.helpOverlay.addEventListener("click", (event) => {
      if (event.target === this.helpOverlay) this.hideHelp();
    });
    this.introContinue.addEventListener("click", () => game.continueFromIntro());
    this.introOverlay.addEventListener("click", (event) => {
      if (event.target === this.introOverlay) game.continueFromIntro();
    });
    this.tutorialDismiss.addEventListener("click", () => this.hideTutorialPrompt());
    this.directionButtons.forEach((button) => {
      button.addEventListener("click", () => game.movePlayer(button.dataset.dir));
    });
    this.actionButton.addEventListener("click", () => this.handleAction());
    this.guardButton.addEventListener("click", () => game.combatGuard());
    this.fleeButton.addEventListener("click", () => game.combatFlee());
    window.addEventListener("keydown", (event) => {
      const isTextEntry = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (isTextEntry && event.key !== "Escape") return;
      if (!this.helpOverlay.hidden && event.key === "Escape") {
        event.preventDefault();
        this.hideHelp();
        return;
      }
      if (event.key === "?" || event.key === "h" || event.key === "H") {
        event.preventDefault();
        this.showHelp();
        return;
      }
      if (!this.introOverlay.hidden) {
        event.preventDefault();
        game.continueFromIntro();
        return;
      }
      const direction = { ArrowUp: "n", ArrowDown: "s", ArrowLeft: "w", ArrowRight: "e", w: "n", W: "n", s: "s", S: "s", a: "w", A: "w", d: "e", D: "e" }[event.key];
      if (direction) {
        event.preventDefault();
        game.movePlayer(direction);
      }
      if (event.code === "Space") {
        event.preventDefault();
        this.handleAction();
      }
      if (event.key === "g" || event.key === "G") {
        event.preventDefault();
        game.combatGuard();
      }
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        game.combatFlee();
      }
      if (event.key.toLowerCase() === "r") game.restartGame();
    });
    window.addEventListener("resize", () => this.mapVisualizer.resize());
    new ResizeObserver(() => this.mapVisualizer.resize()).observe(document.querySelector("#map"));
    this.mapVisualizer.resize();
  }

  parseItemCategories() {
    const map = new Map();
    for (const [category, items] of Object.entries(this.words.objects)) {
      const letter = { tools: "T", weapons: "W", armor: "A", artifacts: "K" }[category];
      if (letter) items.forEach((item) => map.set(item, letter));
    }
    return map;
  }

  showIntro(level) {
    this.messages.clear();
    this.messages.add("You have been transported into the Chaos dimension by the Lords of Chaos!", "green");
    this.messages.add("In this realm, everything is familiar, but nothing makes sense.", "green");
    this.messages.add("Find the artifact of your reality. When you have it, the way out will call to you.", "green");
    this.messages.add(`--------The Chaos Realm (Level ${level})---------`);
  }

  showIntroOverlay() {
    this.introOverlay.hidden = false;
    this.introContinue.focus();
  }

  hideIntroOverlay() {
    this.introOverlay.hidden = true;
  }

  showHelp() {
    this.helpOverlay.hidden = false;
    this.helpClose.focus();
  }

  hideHelp() {
    this.helpOverlay.hidden = true;
  }

  showTutorialPrompt(text) {
    if (!this.tutorialToast || !this.tutorialText) return;
    this.tutorialText.innerHTML = text;
    this.tutorialToast.hidden = false;
    clearTimeout(this.tutorialTimeout);
    this.tutorialTimeout = setTimeout(() => this.hideTutorialPrompt(), 6200);
  }

  hideTutorialPrompt() {
    clearTimeout(this.tutorialTimeout);
    if (this.tutorialToast) this.tutorialToast.hidden = true;
  }

  sync(game) {
    this.renderRoom(game);
    this.renderStats(game);
    this.renderInventory(game);
    this.renderAction(game);
    this.renderMovement(game);
    this.renderObjective(game);
  }

  renderRoom(game) {
    const room = game.player.currentRoom;
    const region = (room.region ?? "unknown area").replaceAll("_", " ");
    const notices = [];
    const pickableItems = room.decorations.filter((item) => this.itemCategoryMap.has(item));
    if (pickableItems.length) notices.push(...pickableItems.map((item) => ({ text: item, type: "item" })));
    if (room.enemies.length === 1) notices.push({ text: `Enemy presence: ${room.enemies[0].name}`, type: "danger" });
    if (room.enemies.length > 1) notices.push({ text: `${room.enemies.length} enemies present`, type: "danger" });
    if (room.decorations.some((item) => item.startsWith("reality "))) notices.push({ text: "Reality artifact detected", type: "relic" });
    if (room.isTarget && game.player.gotRelic) notices.push({ text: "Revealed exit", type: "relic" });
    this.roomText.innerHTML = `
      <h2>${room.name}</h2>
      <div class="room-region">${region}</div>
      <p class="room-body">You find yourself in ${this.article(room.name)}${room.name.toLowerCase()} ${this.regionPhrase(region)}. ${room.atmo} ${room.color}.</p>
      <div class="nearby">
        <div class="nearby-title">Nearby</div>
        ${notices.length ? `<ul>${notices.map((notice) => `<li class="notice-${notice.type}">${notice.text}</li>`).join("")}</ul>` : `<p>No immediate threats or useful objects detected.</p>`}
      </div>
    `;
  }

  renderStats(game) {
    const p = game.player;
    const hpRatio = p.hp / p.maxHp;
    const hpState = hpRatio < 0.3 ? "danger" : hpRatio < 0.6 ? "warning" : "normal";
    this.stats.innerHTML = `
      <div class="stat-group">
        <h3>Core</h3>
        ${this.statRow("Name", p.name)}
        ${this.statRow("Level", p.level)}
        ${this.statRow("EXP", p.exp)}
        <div class="stat-row hp-${hpState}"><span>HP</span><strong>${p.hp}/${p.maxHp}</strong></div>
        ${this.statRow("MP", `${p.mp}/${p.maxMp}`)}
      </div>
      <div class="stat-group">
        <h3>Combat</h3>
        ${this.statRow("ATK", p.atk)}
        ${this.statRow("DEF", p.defn)}
        ${this.statRow("INT", p.int)}
        ${this.statRow("WIS", p.wis)}
        ${this.statRow("CON", p.con)}
        ${this.statRow("EVA", p.eva)}
      </div>
      <div class="stat-group">
        <h3>Map</h3>
        ${this.statRow("Region", (p.currentRoom.region ?? "Unknown").replaceAll("_", " "))}
        ${this.statRow("Coords", `${p.x}, ${p.y}`)}
        ${this.statRow("Lit", `${game.mapLitPercent().toFixed(2)}%`)}
      </div>
    `;
  }

  statRow(label, value) {
    return `<div class="stat-row"><span>${label}</span><strong>${value}</strong></div>`;
  }

  renderInventory(game) {
    this.inventory.innerHTML = "";
    this.inventoryTitle.textContent = `Inventory ${game.player.inventory.items.length} / ${game.player.inventory.maxSize}`;
    if (!game.player.inventory.items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Empty";
      this.inventory.append(empty);
    }
    game.player.inventory.items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item;
      button.title = "Drop item";
      button.addEventListener("click", () => game.dropItem(item));
      this.inventory.append(button);
    });
    this.equipment.innerHTML = `
      <span><b>Weapon</b>${game.player.equippedWeapon ? `${game.player.equippedWeapon} (+${game.player.weaponBonus} ATK)` : "None"}</span>
      <span><b>Armor</b>${game.player.equippedArmor ? `${game.player.equippedArmor} (+${game.player.armorBonus} DEF)` : "None"}</span>
    `;
  }

  renderAction(game) {
    if (game.state === "combat") {
      const canAct = Boolean(game.combat?.playerTurn);
      this.actionButton.hidden = false;
      this.actionButton.disabled = !canAct;
      this.actionButton.textContent = canAct ? "Attack" : "Enemy...";
      this.guardButton.hidden = false;
      this.guardButton.disabled = !canAct;
      this.fleeButton.hidden = false;
      this.fleeButton.disabled = !canAct;
      this.useButton.hidden = true;
      return;
    }
    const hasEnemy = game.player.currentRoom.enemies.length > 0;
    const hasItem = game.player.currentRoom.decorations.some((item) => this.itemCategoryMap.has(item) || item.startsWith("reality "));
    this.actionButton.hidden = false;
    this.actionButton.disabled = game.state !== "explore" || (!hasEnemy && !hasItem);
    this.actionButton.textContent = hasEnemy ? "Attack" : hasItem ? "Pick Up" : "Wait";
    this.guardButton.hidden = true;
    this.fleeButton.hidden = true;
    this.useButton.hidden = false;
    this.useButton.disabled = true;
    this.useButton.title = "Use actions will be added as item behaviors expand.";
  }

  renderMovement(game) {
    this.directionButtons.forEach((button) => {
      const direction = button.dataset.dir;
      const available = game.state === "explore" && Boolean(game.player.currentRoom.connections[direction]);
      button.disabled = !available;
      button.setAttribute("aria-disabled", String(!available));
    });
  }

  renderObjective(game) {
    const room = game.player.currentRoom;
    const visibleEnemies = game.enemyManager.enemies.filter((enemy) => enemy.currentRoom.lit > 0);
    const currentEnemies = room.enemies.length;
    const nearbyEnemies = visibleEnemies.filter((enemy) => enemy.currentRoom !== room);
    let danger = "No visible danger";
    let dangerClass = "safe";
    if (currentEnemies) {
      danger = currentEnemies === 1 ? "Enemy in current room" : `${currentEnemies} enemies in current room`;
      dangerClass = "danger";
    } else if (nearbyEnemies.length) {
      danger = "Enemy nearby";
      dangerClass = "warning";
    }
    const objective = game.player.gotRelic ? "Objective: Reach the exit." : "Objective: Find the reality artifact.";
    const hint = game.player.gotRelic ? this.objectiveHint(game) : "Explore, watch the map, and look for useful gear.";
    this.objectiveStatus.innerHTML = `
      <div class="objective-line"><span>Objective</span><strong>${objective}</strong></div>
      <div class="objective-line"><span>Guidance</span><strong>${hint}</strong></div>
      <div class="objective-line danger-${dangerClass}"><span>Danger</span><strong>${danger}</strong></div>
    `;
  }

  objectiveHint(game) {
    const target = [...game.gameMap.rooms.values()].find((room) => room.isTarget);
    if (!target) return "The exit has not stabilized.";
    const dx = target.x - game.player.x;
    const dy = target.y - game.player.y;
    if (dx === 0 && dy === 0) return "You are at the exit.";
    const horizontal = dx > 0 ? "east" : dx < 0 ? "west" : "";
    const vertical = dy > 0 ? "south" : dy < 0 ? "north" : "";
    return `The exit calls from the ${[vertical, horizontal].filter(Boolean).join(" / ")}.`;
  }

  handleAction() {
    if (this.game.state === "combat" && this.actionButton.textContent === "Attack") this.game.combatAttack();
    else if (this.actionButton.textContent === "Attack") this.game.attack();
    else if (this.actionButton.textContent === "Pick Up") this.game.pickUpOrEquip();
  }

  draw(game) {
    this.mapVisualizer.draw(game);
  }

  article(word) {
    return /^[aeiou]/i.test(word) ? "an " : "a ";
  }

  regionPhrase(region) {
    if (region === "passing through") return "while passing through";
    return `in ${this.article(region)}${region}`;
  }

  listWithArticles(items) {
    const parts = items.map((item) => `${this.article(item)}${item}`);
    if (parts.length <= 1) return parts[0] ?? "";
    return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  }
}
