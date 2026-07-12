export class MessageDisplay {
  constructor(element) {
    this.element = element;
    this.messages = [];
    this.maxMessages = 300;
  }

  add(text, tone = "default") {
    const category = this.normalizeTone(tone, text);
    this.messages.push({ text, tone: category });
    if (this.messages.length > this.maxMessages) {
      this.messages.splice(0, this.messages.length - this.maxMessages);
    }
    this.render();
  }

  normalizeTone(tone, text) {
    if (["movement", "combat", "item", "relic", "level", "danger", "system"].includes(tone)) return tone;
    if (tone === "red") return "danger";
    if (tone === "orange" || tone === "blue") return "combat";
    if (tone === "green") return "system";
    if (/travelled/i.test(text)) return "movement";
    if (/combat|attack|hit|miss|damage|guard|flee|defeated|battle/i.test(text)) return "combat";
    if (/picked up|equipped|dropped|inventory/i.test(text)) return "item";
    if (/relic|artifact|reality|exit/i.test(text)) return "relic";
    if (/level|exp|experience|increased/i.test(text)) return "level";
    if (/enemy|danger|game over|lost|death/i.test(text)) return "danger";
    return "system";
  }

  clear() {
    this.messages = [];
    this.render();
  }

  render() {
    this.element.innerHTML = "";
    this.messages.forEach((message, index) => {
      const line = document.createElement("div");
      const ageClass = index < this.messages.length - 8 ? " message-old" : "";
      line.className = `message message-${message.tone}${ageClass}`;
      line.textContent = message.text;
      this.element.append(line);
    });
    this.element.scrollTop = this.element.scrollHeight;
  }
}
