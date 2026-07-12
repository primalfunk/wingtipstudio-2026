const V2_SPINE_NODE_IDS = Object.freeze([
  "sunward_yard",
  "bracken_roost",
  "driftwood_point",
  "cinder_harbor",
  "pelican_bay",
  "fogglass_grade",
  "mirror_cape",
  "stormglass_head"
]);

const V2_JOURNEY_NODES = Object.freeze([
  {
    id: "sunward_yard",
    name: "Sunward Yard",
    region: "South Reach",
    category: "route_connector",
    locationType: "route_connector",
    siteType: "continue_point",
    quality: "steady",
    solarExposure: "open",
    weatherShelter: "low",
    scenicValue: 1,
    mileMarker: 0,
    hubId: null,
    mapPosition: { x: 92, y: 454, labelAnchor: "start", labelDy: 34 },
    description: "A weathered prep yard where the coastal run begins with the panels already catching light.",
    arrivalText: "Sunward Yard falls behind you and the coastal road finally starts to mean something.",
    connections: [{ to: "bracken_roost", distanceMiles: 396, kind: "forward_spine", forward: true }]
  },
  {
    id: "bracken_roost",
    name: "Bracken Roost",
    region: "South Reach",
    category: "town_hub",
    locationType: "town_hub",
    siteType: "town_hub",
    quality: "steady",
    solarExposure: "mixed",
    weatherShelter: "moderate",
    scenicValue: 2,
    mileMarker: 396,
    hubId: "bracken_roost",
    townId: "bracken_roost",
    mapPosition: { x: 208, y: 420, labelAnchor: "middle", labelDy: -30 },
    description: "A bluff-town first anchor where the coast finally starts to feel inhabited instead of merely crossed.",
    arrivalText:
      "Bracken Roost arrives as the first true town on the coast, part bluff overlook and part road-worn main street.",
    connections: [
      { to: "sunward_yard", distanceMiles: 396, kind: "backtrack_spine", forward: false },
      { to: "driftwood_point", distanceMiles: 561, kind: "forward_spine", forward: true },
      { to: "alder_bench", distanceMiles: 18, kind: "local_branch", forward: false },
      { to: "tideglass_park", distanceMiles: 9, kind: "local_branch", forward: false },
      { to: "quarry_shoulder", distanceMiles: 7, kind: "local_branch", forward: false }
    ]
  },
  {
    id: "alder_bench",
    name: "Alder Bench",
    region: "South Reach",
    category: "premium_boondock",
    locationType: "boondock_site",
    siteType: "premium_boondock",
    quality: "premium",
    solarExposure: "open",
    weatherShelter: "moderate",
    scenicValue: 4,
    mileMarker: null,
    hubId: "bracken_roost",
    description: "A grassy bench above the first salt cliffs where the sky stays broad and the town lights fall away cleanly.",
    arrivalText:
      "Alder Bench feels like the first stop on the trip that might genuinely deserve the effort it took to reach.",
    connections: [{ to: "bracken_roost", distanceMiles: 18, kind: "return_to_hub", forward: true }]
  },
  {
    id: "tideglass_park",
    name: "Tideglass Park",
    region: "South Reach",
    category: "rv_park",
    locationType: "rv_park",
    siteType: "rv_park",
    quality: "steady",
    solarExposure: "partial",
    weatherShelter: "high",
    scenicValue: 1,
    mileMarker: null,
    hubId: "bracken_roost",
    description: "A compact bluffside RV park with reliable hookups and a view that tries harder than the landscaping does.",
    arrivalText: "Tideglass Park offers the kind of practical calm that can make the next leg feel possible again.",
    connections: [{ to: "bracken_roost", distanceMiles: 9, kind: "return_to_hub", forward: true }]
  },
  {
    id: "quarry_shoulder",
    name: "Quarry Shoulder",
    region: "South Reach",
    category: "roadside_fallback",
    locationType: "roadside_stop",
    siteType: "roadside_fallback",
    quality: "rough",
    solarExposure: "mixed",
    weatherShelter: "low",
    scenicValue: 0,
    mileMarker: null,
    hubId: "bracken_roost",
    description: "A scraped shoulder near an old quarry road where you can make the night happen, but not gracefully.",
    arrivalText:
      "Quarry Shoulder is a stop you choose when getting off the road matters more than liking where you landed.",
    connections: [{ to: "bracken_roost", distanceMiles: 7, kind: "return_to_hub", forward: true }]
  },
  {
    id: "driftwood_point",
    name: "Driftwood Point",
    region: "Harbor County",
    category: "town_hub",
    locationType: "town_hub",
    siteType: "town_hub",
    quality: "steady",
    solarExposure: "mixed",
    weatherShelter: "moderate",
    scenicValue: 2,
    mileMarker: 957,
    hubId: "driftwood_point",
    townId: "driftwood_point",
    mapPosition: { x: 332, y: 378, labelAnchor: "middle", labelDy: -30 },
    description: "A harbor town with enough errands, water, and road gossip to reset the trip without swallowing it.",
    arrivalText: "Driftwood Point opens up around the harbor and announces itself as the first real anchor on the coast.",
    connections: [
      { to: "bracken_roost", distanceMiles: 561, kind: "backtrack_spine", forward: false },
      { to: "cinder_harbor", distanceMiles: 578, kind: "forward_spine", forward: true },
      { to: "gullhouse_station", distanceMiles: 12, kind: "local_branch", forward: false },
      { to: "kelpbreak_bluff", distanceMiles: 18, kind: "local_branch", forward: false },
      { to: "reedwater_park", distanceMiles: 9, kind: "local_branch", forward: false }
    ]
  },
  {
    id: "gullhouse_station",
    name: "Gullhouse Station",
    region: "Harbor County",
    category: "gas_station",
    locationType: "service_stop",
    siteType: "gas_station",
    quality: "practical",
    solarExposure: "open",
    weatherShelter: "low",
    scenicValue: 0,
    mileMarker: null,
    hubId: "driftwood_point",
    description: "A roadside forecourt and dump lane tucked behind fish sheds and wind-bent signs.",
    arrivalText: "Gullhouse Station is all hoses, gull noise, and practical help.",
    connections: [{ to: "driftwood_point", distanceMiles: 12, kind: "return_to_hub", forward: true }]
  },
  {
    id: "kelpbreak_bluff",
    name: "Kelpbreak Bluff",
    region: "Harbor County",
    category: "premium_boondock",
    locationType: "boondock_site",
    siteType: "premium_boondock",
    quality: "premium",
    solarExposure: "open",
    weatherShelter: "moderate",
    scenicValue: 4,
    mileMarker: null,
    hubId: "driftwood_point",
    description: "A bluff shelf above the breakers with clear western light and just enough wind break to matter.",
    arrivalText: "Kelpbreak Bluff feels earned: bright sky, open horizon, and the kind of quiet that improves a stay.",
    connections: [{ to: "driftwood_point", distanceMiles: 18, kind: "return_to_hub", forward: true }]
  },
  {
    id: "reedwater_park",
    name: "Reedwater Park",
    region: "Harbor County",
    category: "rv_park",
    locationType: "rv_park",
    siteType: "rv_park",
    quality: "steady",
    solarExposure: "partial",
    weatherShelter: "high",
    scenicValue: 1,
    mileMarker: null,
    hubId: "driftwood_point",
    description: "A tidy park behind the reeds where the hookups are better than the view and sometimes that is enough.",
    arrivalText: "Reedwater Park is calm, practical, and intentionally unromantic.",
    connections: [{ to: "driftwood_point", distanceMiles: 9, kind: "return_to_hub", forward: true }]
  },
  {
    id: "cinder_harbor",
    name: "Cinder Harbor",
    region: "Black Reef",
    category: "town_hub",
    locationType: "town_hub",
    siteType: "town_hub",
    quality: "steady",
    solarExposure: "mixed",
    weatherShelter: "moderate",
    scenicValue: 2,
    mileMarker: 1535,
    hubId: "cinder_harbor",
    townId: "cinder_harbor",
    mapPosition: { x: 444, y: 334, labelAnchor: "middle", labelDy: 34 },
    description: "A black-rock harbor town where the coast gets harsher and the overnight choices get more consequential.",
    arrivalText: "Cinder Harbor feels like a proper working coast town, darker, sharper, and less interested in being easy.",
    connections: [
      { to: "driftwood_point", distanceMiles: 578, kind: "backtrack_spine", forward: false },
      { to: "pelican_bay", distanceMiles: 594, kind: "forward_spine", forward: true },
      { to: "ashfall_bluff", distanceMiles: 16, kind: "local_branch", forward: false },
      { to: "emberlight_park", distanceMiles: 8, kind: "local_branch", forward: false },
      { to: "breakwater_verge", distanceMiles: 6, kind: "local_branch", forward: false }
    ]
  },
  {
    id: "ashfall_bluff",
    name: "Ashfall Bluff",
    region: "Black Reef",
    category: "premium_boondock",
    locationType: "boondock_site",
    siteType: "premium_boondock",
    quality: "premium",
    solarExposure: "open",
    weatherShelter: "moderate",
    scenicValue: 4,
    mileMarker: null,
    hubId: "cinder_harbor",
    description: "A dark bluff shelf over the reef where sunset hits hard and the night feels deliberately chosen.",
    arrivalText:
      "Ashfall Bluff gives you the kind of high-value off-grid stop that can justify a whole hard day of driving.",
    connections: [{ to: "cinder_harbor", distanceMiles: 16, kind: "return_to_hub", forward: true }]
  },
  {
    id: "emberlight_park",
    name: "Emberlight Park",
    region: "Black Reef",
    category: "rv_park",
    locationType: "rv_park",
    siteType: "rv_park",
    quality: "steady",
    solarExposure: "partial",
    weatherShelter: "high",
    scenicValue: 1,
    mileMarker: null,
    hubId: "cinder_harbor",
    description: "A practical harbor park tucked behind breakwater walls where the wind matters less and the lights matter more.",
    arrivalText: "Emberlight Park trades romance for recovery and is honest about the exchange.",
    connections: [{ to: "cinder_harbor", distanceMiles: 8, kind: "return_to_hub", forward: true }]
  },
  {
    id: "breakwater_verge",
    name: "Breakwater Verge",
    region: "Black Reef",
    category: "roadside_fallback",
    locationType: "roadside_stop",
    siteType: "roadside_fallback",
    quality: "rough",
    solarExposure: "mixed",
    weatherShelter: "low",
    scenicValue: 0,
    mileMarker: null,
    hubId: "cinder_harbor",
    description: "A rough verge above the harbor wall where you can stop short, but the place never lets you forget it.",
    arrivalText: "Breakwater Verge is the sort of stop that counts as strategy only if the alternative was worse.",
    connections: [{ to: "cinder_harbor", distanceMiles: 6, kind: "return_to_hub", forward: true }]
  },
  {
    id: "pelican_bay",
    name: "Pelican Bay",
    region: "Dunewake",
    category: "town_hub",
    locationType: "town_hub",
    siteType: "town_hub",
    quality: "steady",
    solarExposure: "mixed",
    weatherShelter: "moderate",
    scenicValue: 2,
    mileMarker: 2129,
    hubId: "pelican_bay",
    townId: "pelican_bay",
    mapPosition: { x: 560, y: 292, labelAnchor: "middle", labelDy: -30 },
    description: "A longer bayfront town where travelers decide whether to linger, stock up, or vanish into the dunes for a night.",
    arrivalText: "Pelican Bay arrives with enough roads and side turns to feel like a proper coastal crossroads.",
    connections: [
      { to: "cinder_harbor", distanceMiles: 594, kind: "backtrack_spine", forward: false },
      { to: "fogglass_grade", distanceMiles: 544, kind: "forward_spine", forward: true },
      { to: "dunewake_flats", distanceMiles: 16, kind: "local_branch", forward: false },
      { to: "marrow_point", distanceMiles: 11, kind: "local_branch", forward: false },
      { to: "saltcedar_park", distanceMiles: 7, kind: "local_branch", forward: false }
    ]
  },
  {
    id: "dunewake_flats",
    name: "Dunewake Flats",
    region: "Dunewake",
    category: "poor_boondock",
    locationType: "boondock_site",
    siteType: "poor_boondock",
    quality: "rough",
    solarExposure: "open",
    weatherShelter: "low",
    scenicValue: 2,
    mileMarker: null,
    hubId: "pelican_bay",
    description: "A broad sandy pullout that looks easy from the road and less so once the wind gets hold of it.",
    arrivalText: "Dunewake Flats is all exposure and compromise, with the view trying to talk you into forgiving the rest.",
    connections: [{ to: "pelican_bay", distanceMiles: 16, kind: "return_to_hub", forward: true }]
  },
  {
    id: "marrow_point",
    name: "Marrow Point",
    region: "Dunewake",
    category: "scenic_stop",
    locationType: "scenic_stop",
    siteType: "scenic_stop",
    quality: "good",
    solarExposure: "mixed",
    weatherShelter: "moderate",
    scenicValue: 3,
    mileMarker: null,
    hubId: "pelican_bay",
    description: "A cliffside overlook with whale signs, thin parking, and very little privacy after noon.",
    arrivalText: "Marrow Point gives you exactly the kind of stop people take photos of and then leave too quickly.",
    connections: [{ to: "pelican_bay", distanceMiles: 11, kind: "return_to_hub", forward: true }]
  },
  {
    id: "saltcedar_park",
    name: "Saltcedar Park",
    region: "Dunewake",
    category: "rv_park",
    locationType: "rv_park",
    siteType: "rv_park",
    quality: "steady",
    solarExposure: "partial",
    weatherShelter: "high",
    scenicValue: 1,
    mileMarker: null,
    hubId: "pelican_bay",
    description: "A compact RV park behind salt-stunted hedges where the shore is audible but mostly out of view.",
    arrivalText: "Saltcedar Park is sheltered, orderly, and more useful than memorable.",
    connections: [{ to: "pelican_bay", distanceMiles: 7, kind: "return_to_hub", forward: true }]
  },
  {
    id: "fogglass_grade",
    name: "Fogglass Grade",
    region: "North Shelf",
    category: "town_hub",
    locationType: "town_hub",
    siteType: "town_hub",
    quality: "steady",
    solarExposure: "mixed",
    weatherShelter: "moderate",
    scenicValue: 2,
    mileMarker: 2673,
    hubId: "fogglass_grade",
    townId: "fogglass_grade",
    mapPosition: { x: 680, y: 242, labelAnchor: "middle", labelDy: 34 },
    description: "A grade-town in the marine layer where weather starts making itself part of your route planning.",
    arrivalText:
      "Fogglass Grade feels like a hill town built around weather boards, pullouts, and people who watch the sky for a living.",
    connections: [
      { to: "pelican_bay", distanceMiles: 544, kind: "backtrack_spine", forward: false },
      { to: "mirror_cape", distanceMiles: 578, kind: "forward_spine", forward: true },
      { to: "lantern_reef", distanceMiles: 17, kind: "local_branch", forward: false },
      { to: "cloudrest_park", distanceMiles: 8, kind: "local_branch", forward: false },
      { to: "mistline_layby", distanceMiles: 6, kind: "local_branch", forward: false }
    ]
  },
  {
    id: "lantern_reef",
    name: "Lantern Reef",
    region: "North Shelf",
    category: "premium_boondock",
    locationType: "boondock_site",
    siteType: "premium_boondock",
    quality: "premium",
    solarExposure: "open",
    weatherShelter: "moderate",
    scenicValue: 4,
    mileMarker: null,
    hubId: "fogglass_grade",
    description: "A cliff shelf above the fog line where a clear evening can still turn into a nearly perfect charging night.",
    arrivalText: "Lantern Reef feels like betting correctly on the weather and getting rewarded for it.",
    connections: [{ to: "fogglass_grade", distanceMiles: 17, kind: "return_to_hub", forward: true }]
  },
  {
    id: "cloudrest_park",
    name: "Cloudrest Park",
    region: "North Shelf",
    category: "rv_park",
    locationType: "rv_park",
    siteType: "rv_park",
    quality: "steady",
    solarExposure: "partial",
    weatherShelter: "high",
    scenicValue: 1,
    mileMarker: null,
    hubId: "fogglass_grade",
    description: "A terraced park on the inland side of the grade where shelter beats scenery on most nights.",
    arrivalText: "Cloudrest Park feels like choosing predictability over romance and being correct to do so.",
    connections: [{ to: "fogglass_grade", distanceMiles: 8, kind: "return_to_hub", forward: true }]
  },
  {
    id: "mistline_layby",
    name: "Mistline Layby",
    region: "North Shelf",
    category: "roadside_fallback",
    locationType: "roadside_stop",
    siteType: "roadside_fallback",
    quality: "rough",
    solarExposure: "mixed",
    weatherShelter: "low",
    scenicValue: 0,
    mileMarker: null,
    hubId: "fogglass_grade",
    description: "A narrow layby above the grade where stopping is possible but never feels like the plan you wanted.",
    arrivalText: "Mistline Layby is the kind of stop that says more about the day than the player would prefer.",
    connections: [{ to: "fogglass_grade", distanceMiles: 6, kind: "return_to_hub", forward: true }]
  },
  {
    id: "mirror_cape",
    name: "Mirror Cape",
    region: "Far North",
    category: "town_hub",
    locationType: "town_hub",
    siteType: "town_hub",
    quality: "good",
    solarExposure: "mixed",
    weatherShelter: "moderate",
    scenicValue: 3,
    mileMarker: 3251,
    hubId: "mirror_cape",
    townId: "mirror_cape",
    mapPosition: { x: 806, y: 182, labelAnchor: "middle", labelDy: -30 },
    description: "A weather-beaten cape town where the road thins, the sky gets meaner, and the best side destinations finally feel remote.",
    arrivalText: "Mirror Cape arrives under harder wind and feels like the last true coastal anchor before the finish.",
    connections: [
      { to: "fogglass_grade", distanceMiles: 578, kind: "backtrack_spine", forward: false },
      { to: "stormglass_head", distanceMiles: 511, kind: "forward_spine", forward: true },
      { to: "anchorlight_park", distanceMiles: 6, kind: "local_branch", forward: false },
      { to: "breakers_reach", distanceMiles: 19, kind: "local_branch", forward: false },
      { to: "tidepool_steps", distanceMiles: 10, kind: "local_branch", forward: false }
    ]
  },
  {
    id: "anchorlight_park",
    name: "Anchorlight Park",
    region: "Far North",
    category: "rv_park",
    locationType: "rv_park",
    siteType: "rv_park",
    quality: "steady",
    solarExposure: "partial",
    weatherShelter: "high",
    scenicValue: 1,
    mileMarker: null,
    hubId: "mirror_cape",
    description: "A steeply terraced park where the hookups are dependable and the sky is usually not.",
    arrivalText: "Anchorlight Park gives you a controlled night when the cape is feeling less generous.",
    connections: [{ to: "mirror_cape", distanceMiles: 6, kind: "return_to_hub", forward: true }]
  },
  {
    id: "breakers_reach",
    name: "Breakers Reach",
    region: "Far North",
    category: "premium_boondock",
    locationType: "boondock_site",
    siteType: "premium_boondock",
    quality: "premium",
    solarExposure: "open",
    weatherShelter: "moderate",
    scenicValue: 4,
    mileMarker: null,
    hubId: "mirror_cape",
    description: "A hard-earned bluff shelf with big western light and just enough grass to keep the cape from feeling hostile.",
    arrivalText: "Breakers Reach is the sort of last-night stop the whole trip quietly hopes for.",
    connections: [{ to: "mirror_cape", distanceMiles: 19, kind: "return_to_hub", forward: true }]
  },
  {
    id: "tidepool_steps",
    name: "Tidepool Steps",
    region: "Far North",
    category: "scenic_stop",
    locationType: "scenic_stop",
    siteType: "scenic_stop",
    quality: "good",
    solarExposure: "mixed",
    weatherShelter: "moderate",
    scenicValue: 3,
    mileMarker: null,
    hubId: "mirror_cape",
    description: "A stepped overlook where the road briefly lets you walk down to the rock pools and remember why you came north.",
    arrivalText: "Tidepool Steps is more pause than destination, but it lands cleanly in the memory.",
    connections: [{ to: "mirror_cape", distanceMiles: 10, kind: "return_to_hub", forward: true }]
  },
  {
    id: "stormglass_head",
    name: "Stormglass Head",
    region: "Far North",
    category: "destination",
    locationType: "destination",
    siteType: "destination",
    quality: "good",
    solarExposure: "open",
    weatherShelter: "low",
    scenicValue: 4,
    mileMarker: 3762,
    hubId: null,
    mapPosition: { x: 920, y: 132, labelAnchor: "end", labelDy: -30 },
    description: "Cold surf, clean horizon, and the end of the authored coastal road.",
    arrivalText: "Stormglass Head stands in front of you at last. The coast has run out of north.",
    connections: [{ to: "mirror_cape", distanceMiles: 511, kind: "backtrack_spine", forward: false }]
  }
]);

export const V2_COASTAL_ROUTE_ID = "coastal_run_v2";

export const V2_TOWN_DEFINITIONS = Object.freeze([
  {
    id: "bracken_roost",
    name: "Bracken Roost",
    subtitle: "The first bluff-town on the coast, where the trip shifts from departure into actual place-making.",
    flavor: "Bracken Roost feels like a town built from a turnout that refused to remain temporary.",
    visitBudget: 2,
    priceMultiplier: 1,
    categoryPriceMultipliers: {
      utility: 1,
      comfort: 1
    },
    quirkTags: ["friendly_showers"],
    serviceIds: ["fill_water", "quick_utility_stop", "ask_around"],
    rumorPoolId: "cedar_spur_pool",
    approachVisual: "town"
  },
  {
    id: "driftwood_point",
    name: "Driftwood Point",
    subtitle: "Harbor errands, water access, and enough road talk to make the next choice feel intentional.",
    flavor:
      "Driftwood Point feels like a working harbor town that tolerates wanderers because it knows they will move on by morning.",
    visitBudget: 2,
    priceMultiplier: 1,
    categoryPriceMultipliers: {
      utility: 1,
      comfort: 1
    },
    quirkTags: ["water_easy", "friendly_showers"],
    serviceIds: ["fill_water", "quick_utility_stop", "meal_shower", "ask_around"],
    rumorPoolId: "cedar_spur_pool",
    approachVisual: "town"
  },
  {
    id: "cinder_harbor",
    name: "Cinder Harbor",
    subtitle: "A darker harbor town where practical recovery and high-value bluff stays sit in real tension.",
    flavor:
      "Cinder Harbor has the mood of a place that works first and poses for postcards only if there is time left over.",
    visitBudget: 2,
    priceMultiplier: 1,
    categoryPriceMultipliers: {
      utility: 1,
      comfort: 1
    },
    quirkTags: ["water_easy"],
    serviceIds: ["fill_water", "quick_utility_stop", "ask_around"],
    rumorPoolId: "rim_market_pool",
    approachVisual: "town"
  },
  {
    id: "pelican_bay",
    name: "Pelican Bay",
    subtitle: "A larger bayfront town where the coast branches into parks, dunes, and practical stops.",
    flavor:
      "Pelican Bay carries the slightly restless energy of a place where every road out of town seems to promise a different kind of evening.",
    visitBudget: 2,
    priceMultiplier: 1,
    categoryPriceMultipliers: {
      utility: 1,
      comfort: 1
    },
    quirkTags: ["good_meals", "water_easy"],
    serviceIds: ["fill_water", "hot_meal", "laundry_shower", "ask_around"],
    rumorPoolId: "rim_market_pool",
    approachVisual: "town"
  },
  {
    id: "fogglass_grade",
    name: "Fogglass Grade",
    subtitle: "A weather-minded grade town where shelter, sky, and the next push north all compete for attention.",
    flavor:
      "Fogglass Grade feels like a place where people casually read the cloud line before they decide where to sleep.",
    visitBudget: 2,
    priceMultiplier: 1,
    categoryPriceMultipliers: {
      utility: 1,
      comfort: 1
    },
    quirkTags: ["friendly_showers"],
    serviceIds: ["fill_water", "quick_utility_stop", "ask_around", "laundry_shower"],
    rumorPoolId: "granite_ferry_pool",
    approachVisual: "town"
  },
  {
    id: "mirror_cape",
    name: "Mirror Cape",
    subtitle: "The last weather-beaten town before the run to the headland.",
    flavor:
      "Mirror Cape feels like a northern road town that has seen enough rigs arrive tired to stop pretending that comfort and direction are trivial things.",
    visitBudget: 2,
    priceMultiplier: 1,
    categoryPriceMultipliers: {
      utility: 1,
      comfort: 1
    },
    quirkTags: ["friendly_showers", "good_meals"],
    serviceIds: ["fill_water", "quick_utility_stop", "hot_meal", "ask_around", "laundry_shower"],
    rumorPoolId: "granite_ferry_pool",
    approachVisual: "town"
  }
]);

const DEFAULT_TOWN_GRAPH_LAYOUT = Object.freeze({
  root: { x: 0.5, y: 0.82 },
  immediate: Object.freeze({}),
  preview: Object.freeze({}),
  maxVisibleBranches: 4
});

export const V2_TOWN_GRAPH_LAYOUTS = Object.freeze({
  bracken_roost: {
    root: { x: 0.5, y: 0.82 },
    immediate: {
      driftwood_point: { x: 0.5, y: 0.28 },
      alder_bench: { x: 0.2, y: 0.5 },
      tideglass_park: { x: 0.5, y: 0.56 },
      quarry_shoulder: { x: 0.8, y: 0.5 }
    },
    preview: {
      gullhouse_station: { x: 0.24, y: 0.1 },
      kelpbreak_bluff: { x: 0.42, y: 0.08 },
      reedwater_park: { x: 0.58, y: 0.08 },
      cinder_harbor: { x: 0.76, y: 0.1 }
    },
    maxVisibleBranches: 4
  },
  driftwood_point: {
    root: { x: 0.5, y: 0.8 },
    immediate: {
      cinder_harbor: { x: 0.54, y: 0.26 },
      gullhouse_station: { x: 0.18, y: 0.46 },
      kelpbreak_bluff: { x: 0.42, y: 0.56 },
      reedwater_park: { x: 0.8, y: 0.46 }
    },
    preview: {
      ashfall_bluff: { x: 0.32, y: 0.08 },
      emberlight_park: { x: 0.52, y: 0.08 },
      breakwater_verge: { x: 0.68, y: 0.12 },
      pelican_bay: { x: 0.84, y: 0.1 }
    },
    maxVisibleBranches: 4
  },
  cinder_harbor: {
    root: { x: 0.48, y: 0.82 },
    immediate: {
      pelican_bay: { x: 0.5, y: 0.24 },
      ashfall_bluff: { x: 0.2, y: 0.44 },
      emberlight_park: { x: 0.48, y: 0.58 },
      breakwater_verge: { x: 0.8, y: 0.46 }
    },
    preview: {
      dunewake_flats: { x: 0.24, y: 0.08 },
      marrow_point: { x: 0.44, y: 0.08 },
      saltcedar_park: { x: 0.6, y: 0.1 },
      fogglass_grade: { x: 0.78, y: 0.08 }
    },
    maxVisibleBranches: 4
  },
  pelican_bay: {
    root: { x: 0.5, y: 0.82 },
    immediate: {
      fogglass_grade: { x: 0.5, y: 0.24 },
      dunewake_flats: { x: 0.18, y: 0.5 },
      marrow_point: { x: 0.46, y: 0.56 },
      saltcedar_park: { x: 0.8, y: 0.46 }
    },
    preview: {
      lantern_reef: { x: 0.26, y: 0.08 },
      cloudrest_park: { x: 0.48, y: 0.08 },
      mistline_layby: { x: 0.62, y: 0.12 },
      mirror_cape: { x: 0.8, y: 0.08 }
    },
    maxVisibleBranches: 4
  },
  fogglass_grade: {
    root: { x: 0.5, y: 0.82 },
    immediate: {
      mirror_cape: { x: 0.52, y: 0.24 },
      lantern_reef: { x: 0.2, y: 0.46 },
      cloudrest_park: { x: 0.48, y: 0.58 },
      mistline_layby: { x: 0.8, y: 0.46 }
    },
    preview: {
      anchorlight_park: { x: 0.24, y: 0.08 },
      breakers_reach: { x: 0.42, y: 0.08 },
      tidepool_steps: { x: 0.58, y: 0.1 },
      stormglass_head: { x: 0.76, y: 0.08 }
    },
    maxVisibleBranches: 4
  },
  mirror_cape: {
    root: { x: 0.5, y: 0.82 },
    immediate: {
      stormglass_head: { x: 0.52, y: 0.22 },
      anchorlight_park: { x: 0.2, y: 0.48 },
      breakers_reach: { x: 0.48, y: 0.58 },
      tidepool_steps: { x: 0.8, y: 0.46 }
    },
    preview: {},
    maxVisibleBranches: 4
  }
});

const V2_GRAPH_BY_ID = Object.freeze(
  Object.fromEntries(V2_JOURNEY_NODES.map((node) => [node.id, node]))
);

const V2_SPINE_NODES = Object.freeze(V2_SPINE_NODE_IDS.map((nodeId) => V2_GRAPH_BY_ID[nodeId]));

export const V2_COASTAL_JOURNEY_GRAPH = Object.freeze({
  id: V2_COASTAL_ROUTE_ID,
  label: "The Long Salt Coast",
  summary:
    "One authored coastal journey with a clear northbound spine of real towns, selective stay clusters, and fewer low-value connector hops.",
  originNodeId: V2_SPINE_NODES[0].id,
  destinationNodeId: V2_SPINE_NODES[V2_SPINE_NODES.length - 1].id,
  totalMiles: V2_SPINE_NODES[V2_SPINE_NODES.length - 1].mileMarker,
  mainSpineNodeIds: V2_SPINE_NODE_IDS,
  nodes: V2_JOURNEY_NODES
});

export const V2_COASTAL_ROUTE_PRESET = Object.freeze({
  id: V2_COASTAL_ROUTE_ID,
  label: "The Long Salt Coast",
  summary:
    "Follow one authored northbound coastal spine, pushing between substantial towns and choosing what kind of stay you want near each hub.",
  startTerrainTint: "#927b56",
  endTerrainTint: "#5f7a84",
  originName: V2_SPINE_NODES[0].name,
  destinationName: V2_SPINE_NODES[V2_SPINE_NODES.length - 1].name,
  totalMiles: V2_COASTAL_JOURNEY_GRAPH.totalMiles,
  startDate: "2032-05-12",
  deadlineAdjustmentDays: 2,
  terrainModifier: 1,
  stops: V2_SPINE_NODES.map((node) => node.name),
  routePoints: V2_SPINE_NODES.map((node, index) => {
    const nextNode = V2_SPINE_NODES[index + 1] ?? null;

    return {
      id: node.id,
      name: node.name,
      mileMarker: node.mileMarker,
      kind:
        index === 0 ? "origin" : index === V2_SPINE_NODES.length - 1 ? "destination" : "waypoint",
      tag: node.category,
      townId: typeof node.townId === "string" ? node.townId : undefined,
      townType: node.category === "town_hub" ? "coastal_hub" : undefined,
      description: node.description,
      arrivalText: node.arrivalText,
      approachVisual: node.category === "town_hub" ? "town" : "roadside_sign",
      nextLegLabel: nextNode ? `${node.name} To ${nextNode.name}` : null,
      nextLegSummary:
        nextNode
          ? `The coast runs from ${node.name} north toward ${nextNode.name}, with the next real hub far enough away that the push itself matters.`
          : "The coast ends here.",
      mapPosition: node.mapPosition ?? null
    };
  }),
  weatherDeck: [
    {
      label: "Cold bright morning over open water",
      sunlightFactor: 0.96,
      forecast: "Clear enough for strong charge before afternoon haze",
      weatherType: "clear",
      solarOutlook: "Strong",
      severity: "normal",
      travelMode: "steady",
      stayMood: "open",
      disruptionRisk: 0.02,
      travelNote: "Clear skies kept the coast readable and gave the panels their best shot.",
      stayNote: "Open sky should make a good site feel even better tonight."
    },
    {
      label: "Low marine layer holding offshore",
      sunlightFactor: 0.82,
      forecast: "Soft charge until the wind opens the sky",
      weatherType: "marine_clouds",
      solarOutlook: "Fair",
      severity: "normal",
      travelMode: "steady",
      stayMood: "mixed",
      disruptionRisk: 0.06,
      travelNote: "Marine clouds softened the charge, but the road still mostly behaved.",
      stayNote: "Low cloud cover can mute the stay until the afternoon wind clears it."
    },
    {
      label: "Rain bands pressing in off the cape",
      sunlightFactor: 0.62,
      forecast: "Weak charge and slower road miles until the showers break",
      weatherType: "rain",
      solarOutlook: "Weak",
      severity: "rough",
      travelMode: "slowed",
      stayMood: "exposed",
      disruptionRisk: 0.18,
      travelNote: "Rain and sidewind took pace out of the day and cut solar recovery.",
      stayNote: "Wet weather makes shelter and utility support matter more tonight."
    },
    {
      label: "Broken sun between cloud bands",
      sunlightFactor: 0.88,
      forecast: "Variable light with enough openings to keep moving",
      weatherType: "broken_clouds",
      solarOutlook: "Fair",
      severity: "normal",
      travelMode: "steady",
      stayMood: "mixed",
      disruptionRisk: 0.08,
      travelNote: "The sky kept changing, but there were enough openings to stay on plan.",
      stayNote: "Patchy light should keep the stop workable if the site has decent exposure."
    },
    {
      label: "Slate squalls marching up the shoreline",
      sunlightFactor: 0.48,
      forecast: "Storm cells may force a shorter leg and very weak charging",
      weatherType: "storm",
      solarOutlook: "Weak",
      severity: "severe",
      travelMode: "delayed",
      stayMood: "exposed",
      disruptionRisk: 0.34,
      travelNote: "Storm weather may force a shorter push and leave electric under pressure.",
      stayNote: "A sheltered stay will matter tonight; exposed sites will feel much harder."
    }
  ],
  eventDeck: [
    {
      id: "harbor_board_tip",
      title: "Harbor Board Tip",
      flavor: "A hand-lettered board suggests a better overlook and a rougher service spur north of town.",
      consequence: "The next town is still the spine, but the stay around it is no longer a trivial choice."
    },
    {
      id: "coastal_pullout",
      title: "Coastal Pullout",
      flavor: "A narrow turnout opens to the water and then vanishes again behind brush and stone.",
      consequence: "The coast still offers reasons to stop short, but now it is a deliberate deviation rather than the default route shape."
    },
    {
      id: "marine_layer_shift",
      title: "Marine Layer Shift",
      flavor: "The cloud line lifts and drops again as the road bends north.",
      consequence: "Solar expectations stay readable, but never fully stable."
    }
  ]
});

export function getV2JourneyGraph() {
  return V2_COASTAL_JOURNEY_GRAPH;
}

export function getV2JourneyNode(nodeId) {
  return typeof nodeId === "string" ? V2_GRAPH_BY_ID[nodeId] ?? null : null;
}

export function getV2SpineNodes() {
  return V2_SPINE_NODES;
}

export function getV2CurrentSpineNode(milesTraveled = 0) {
  const miles = Math.max(0, Number(milesTraveled) || 0);

  return [...V2_SPINE_NODES].reverse().find((node) => node.mileMarker <= miles) ?? V2_SPINE_NODES[0];
}

export function getV2NextSpineNode(milesTraveled = 0) {
  const miles = Math.max(0, Number(milesTraveled) || 0);
  return V2_SPINE_NODES.find((node) => node.mileMarker > miles) ?? null;
}

export function getV2ConnectedDestinations(nodeId) {
  const node = getV2JourneyNode(nodeId);

  if (!node) {
    return [];
  }

  return (node.connections ?? [])
    .filter((connection) => connection.kind !== "backtrack_spine")
    .map((connection) => {
      const destination = getV2JourneyNode(connection.to);

      if (!destination) {
        return null;
      }

      return {
        id: `destination_${destination.id}`,
        nodeId: destination.id,
        label: destination.name,
        subtitle: destination.description,
        distanceMiles: Math.max(1, Number(connection.distanceMiles) || 0),
        locationType: destination.locationType,
        siteType: destination.siteType,
        isAvailable: true,
        source: connection.kind,
        isForward: connection.forward === true,
        region: destination.region
      };
    })
    .filter(Boolean);
}

export function getV2TownGraphLayout(townId) {
  if (typeof townId !== "string") {
    return DEFAULT_TOWN_GRAPH_LAYOUT;
  }

  return V2_TOWN_GRAPH_LAYOUTS[townId] ?? DEFAULT_TOWN_GRAPH_LAYOUT;
}
