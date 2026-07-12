export class Item {
    constructor(id, name, type, pickUpAble = true, key = null, description = '', metadata = {}) {
      this.id = id;
      this.name = name;
      this.type = type;
      this.key = key;
      this.pickUpAble = pickUpAble;
      this.description = description;
      Object.assign(this, metadata);
    }
  }

const baseItems = {};

export const ITEM_VARIANT_POOLS = {
  reliquary_key: [
    {
      name: "Reliquary Key",
      description: "A corroded key cold enough to numb the hand.",
      rumorName: "Reliquary Key"
    },
    {
      name: "Ash-Ward Key",
      description: "A grey iron key dusted with old ash and prayer-salt.",
      rumorName: "Ash-Ward Key"
    },
    {
      name: "Pilgrim's Black Key",
      description: "A blackened key worn smooth by many frightened hands.",
      rumorName: "Pilgrim's Black Key"
    },
    {
      name: "Sepulcher Key",
      description: "A narrow key whose teeth look more carved than forged.",
      rumorName: "Sepulcher Key"
    }
  ],
  bloodmoss_clump: [
    {
      name: "Bloodmoss Clump",
      description: "A wet red moss that drinks warmth from the air.",
      siteTitle: "Mire of Bloodmoss",
      siteDescription: "Red moss crawls over drowned stones. The air is sweet, wet, and wrong.",
      sealPhrase: "Bloodmoss darkens"
    },
    {
      name: "Sanguine Reed",
      description: "A red reed whose cut stem beads like fresh blood.",
      siteTitle: "Sanguine Reed Fen",
      siteDescription: "Red reeds crowd the black water, bowing together though no wind moves.",
      sealPhrase: "The sanguine reed blackens"
    },
    {
      name: "Wound-Lichen",
      description: "A rubbery scarlet lichen that clings to stone like sealed flesh.",
      siteTitle: "Wound-Lichen Mire",
      siteDescription: "Scarlet lichen webs the drowned stones, pulsing faintly where the marsh breathes.",
      sealPhrase: "Wound-lichen tightens"
    },
    {
      name: "Marrowcap Fungus",
      description: "A pale fungus veined red through the stem, warm at its center.",
      siteTitle: "Marrowcap Bog",
      siteDescription: "Pale fungus crowns the mire in clusters, each cap veined with a dull red glow.",
      sealPhrase: "Marrowcap flesh goes dark"
    }
  ],
  oath_silver: [
    {
      name: "Oath-Silver Ring",
      description: "A tarnished ring that hums when promises are broken.",
      siteTitle: "Oath-Silver Gatehouse",
      siteDescription: "A ruined gatehouse stands under a torn banner. Silver oath-rings hang from hooks where soldiers once swore themselves to dead kings.",
      inspectLabel: "Inspect the Oath-Silver",
      inspectedFlag: "oath_silver_inspected",
      inspectMessage: "You study the oath-rings before touching them. The old vows pull tight when disturbed, but the worst tension can be avoided.",
      inspectEffectMessage: "You mark the ring least bound to the dead king's command.",
      pickupMessage: "An oath-bound shade strikes as you disturb the silver rings.",
      sealPhrase: "oath-silver rings"
    },
    {
      name: "Vow-Marked Chain",
      description: "A short silver chain etched with the names of witnesses.",
      siteTitle: "Gatehouse of Vows",
      siteDescription: "Broken shields lie beneath hooks of silver chain, each link etched with a dead soldier's oath.",
      inspectLabel: "Inspect the Vow-Marked Chain",
      inspectedFlag: "oath_silver_inspected",
      inspectMessage: "You study the silver chain before touching it. The old vows tighten around careless hands.",
      inspectEffectMessage: "You find the link least bound to the dead king's command.",
      pickupMessage: "A vow-bound shade strikes as you disturb the chain.",
      sealPhrase: "the vow-marked chain rings"
    },
    {
      name: "Perjury Coin",
      description: "A silver coin gone black around a stamped, open eye.",
      siteTitle: "Hall of the Perjury Coin",
      siteDescription: "A ruined hall holds blackened silver coins where oathbreakers once paid for mercy.",
      inspectLabel: "Inspect the Perjury Coin",
      inspectedFlag: "oath_silver_inspected",
      inspectMessage: "You study the coin before taking it. The stamped eye seems to judge the shape of your intent.",
      inspectEffectMessage: "You find the coin whose curse has thinned at the edge.",
      pickupMessage: "A judging shade strikes as you disturb the coin.",
      sealPhrase: "the perjury coin rings"
    },
    {
      name: "Witness Nail",
      description: "A silver nail bent as if it once pinned a promise in place.",
      siteTitle: "Witness-Nail Gate",
      siteDescription: "Silver nails stud the old gate beams, each one bent by the weight of an abandoned oath.",
      inspectLabel: "Inspect the Witness Nail",
      inspectedFlag: "oath_silver_inspected",
      inspectMessage: "You study the nails before touching them. Some still hold the anger of witnesses long dead.",
      inspectEffectMessage: "You choose the nail whose witness has nearly gone silent.",
      pickupMessage: "A witness-bound shade strikes as you pull the silver nail free.",
      sealPhrase: "the witness nail rings"
    }
  ],
  cinder_ember: [
    {
      name: "Cinder Ember",
      description: "A coal-bright ember that refuses to cool.",
      siteTitle: "Cinder-Glass Peak",
      siteDescription: "Black glass cuts through the mountain path. A coal-bright ember pulses inside a stone split by old lightning.",
      inspectLabel: "Inspect the Cinder Ember",
      inspectedFlag: "cinder_ember_inspected",
      inspectMessage: "You study the glass around the ember and find the places where it wants to cut.",
      inspectEffectMessage: "The ember can be pried free, but not safely by force alone.",
      pickupMessage: "Cinder-glass slices your hands as you pry the ember free.",
      sealPhrase: "the ember dies white"
    },
    {
      name: "Storm-Cinder Shard",
      description: "A splinter of glassy cinder with lightning trapped in its core.",
      siteTitle: "Storm-Cinder Rise",
      siteDescription: "Black glass forks across the peak where lightning once struck and never fully left.",
      inspectLabel: "Inspect the Storm-Cinder",
      inspectedFlag: "cinder_ember_inspected",
      inspectMessage: "You study the storm-cinder and see where the lightning has cracked its glass shell.",
      inspectEffectMessage: "The shard can be loosened if you avoid the bright fractures.",
      pickupMessage: "Charged glass slices your hands as you pry the shard free.",
      sealPhrase: "the storm-cinder gutters white"
    },
    {
      name: "Glasscoal Heart",
      description: "A black coal heart sealed under glass and beating with dull heat.",
      siteTitle: "Glasscoal Vent",
      siteDescription: "Glass-slick stone rings a cold vent where a black coal heart pulses under the rock.",
      inspectLabel: "Inspect the Glasscoal",
      inspectedFlag: "cinder_ember_inspected",
      inspectMessage: "You study the glasscoal and find the weak seams around its buried heat.",
      inspectEffectMessage: "The heart can be lifted if the glass is worried loose first.",
      pickupMessage: "Glasscoal flakes cut your hands as you lift the heart free.",
      sealPhrase: "the glasscoal heart pales"
    },
    {
      name: "Sunken Firestone",
      description: "A firestone lodged in dark rock, hot only when ignored.",
      siteTitle: "Sunken Firestone Peak",
      siteDescription: "Dark rock folds around a buried firestone that glows only when you look away.",
      inspectLabel: "Inspect the Firestone",
      inspectedFlag: "cinder_ember_inspected",
      inspectMessage: "You study the firestone and map the sharp rock folded around it.",
      inspectEffectMessage: "The stone can be freed with care, though the mountain resists.",
      pickupMessage: "Folded firestone glass cuts your hands as you work it free.",
      sealPhrase: "the firestone cools white"
    }
  ]
};
  
  export const items = {
    'item1': new Item('item1', 'Iron Sword', 'weapon', true),
    'item2': new Item('item2', 'Steel Armor', 'armor', true),
    'item3': new Item('item3', 'Rusty Key', 'key', true),
    'item4': new Item('item4', 'Rusty Lock', 'lock', false, 'item3'),
    'item5': new Item('item5', 'Iron Helmet', 'armor', true),
    'reliquary_key': new Item('reliquary_key', 'Reliquary Key', 'key', true, null, 'A corroded key cold enough to numb the hand.'),
    'ash_crown_relic': new Item('ash_crown_relic', 'Ash-Crown Relic', 'relic', true, null, 'A blackened circlet that seems to remember a dead empire.'),
    'bloodmoss_clump': new Item('bloodmoss_clump', 'Bloodmoss Clump', 'ritual', true, null, 'A wet red moss that drinks warmth from the air.'),
    'oath_silver': new Item('oath_silver', 'Oath-Silver Ring', 'ritual', true, null, 'A tarnished ring that hums when promises are broken.', {
      pickupEffect: {
        id: "oath_guardian",
        tags: ["forced_route", "sacred", "cursed", "relic", "willpower", "fear", "suspicious_object", "relic_trap"],
        damage: 4,
        onceFlag: "oath_guardian_defeated",
        message: "An oath-bound shade strikes as you disturb the silver rings.",
        inspectedFlag: "oath_silver_inspected",
        inspectedReduction: 1,
        rogueInspectedReduction: 0,
        mageInspectedReduction: 0,
        clericInspectedReduction: 0,
        avoidedMessage: "The shade recognizes your preparation and lowers its blade."
      }
    }),
    'cinder_ember': new Item('cinder_ember', 'Cinder Ember', 'ritual', true, null, 'A coal-bright ember that refuses to cool.', {
      pickupEffect: {
        id: "cinder_glass",
        tags: ["forced_route", "fire", "ash", "relic", "arcane", "dangerous_pickup", "relic_trap"],
        damage: 4,
        onceFlag: "cinder_glass_pried_free",
        message: "Cinder-glass slices your hands as you pry the ember free.",
        inspectedFlag: "cinder_ember_inspected",
        inspectedReduction: 0,
        rogueInspectedReduction: 0,
        mageInspectedReduction: 0,
        avoidedMessage: "A brief ward turns the cinder-glass edge aside."
      }
    })
  };

Object.entries(items).forEach(([id, item]) => {
  baseItems[id] = structuredClone(item);
});

function choose(array, rng) {
  return array[Math.floor(rng() * array.length)];
}

export function initializeItemVariants(rng) {
  Object.entries(baseItems).forEach(([id, baseItem]) => {
    Object.keys(items[id]).forEach(key => delete items[id][key]);
    Object.assign(items[id], structuredClone(baseItem));
  });

  Object.entries(ITEM_VARIANT_POOLS).forEach(([itemId, variants]) => {
    const item = items[itemId];
    if (!item) return;
    const variant = choose(variants, rng);
    item.variant = structuredClone(variant);
    item.name = variant.name;
    item.description = variant.description;
    if (item.pickupEffect && variant.pickupMessage) item.pickupEffect.message = variant.pickupMessage;
    if (item.pickupEffect && variant.inspectedFlag) item.pickupEffect.inspectedFlag = variant.inspectedFlag;
  });
}

export function getItemVariant(itemId) {
  return items[itemId]?.variant || {};
}

  export function getItem(itemId) {
    return items[itemId];
  }
  
