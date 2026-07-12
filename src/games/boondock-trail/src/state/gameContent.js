import {
  CAMPSITE_TYPES,
  COMFORT_POLICIES,
  DEFAULT_STARTING_VALUES,
  HOOKUP_CASH_COST,
  TRAVEL_MODES
} from "../constants/gameConstants.js";
import {
  V2_COASTAL_ROUTE_PRESET,
  V2_TOWN_DEFINITIONS
} from "./v2JourneyGraph.js";

const legacyRoutePresets = [
  {
    id: "rain_coast",
    label: "High Desert to Rain Coast",
    summary: "Start in bright desert, cross cool timber, and end where the coast turns cold and gray.",
    startTerrainTint: "#b97b41",
    endTerrainTint: "#6f8ca1",
    originName: "Mojave Yard",
    destinationName: "Cape Flattery",
    totalMiles: 4260,
    startDate: "2032-06-18",
    deadlineAdjustmentDays: 1,
    terrainModifier: 1,
    stops: [
      "Mojave Yard",
      "Black Mesa Fork",
      "Cedar Spur",
      "Blue Timber",
      "Cape Flattery"
    ],
    routePoints: [
      {
        id: "mojave_yard",
        name: "Mojave Yard",
        mileMarker: 0,
        kind: "origin",
        tag: "origin",
        description: "A sun-washed yard where the rig waits full of first-day promise.",
        nextLegLabel: "Desert Departure",
        nextLegSummary: "Long bright miles run toward Black Mesa Fork, with one rough wash crossing along the way.",
        mapPosition: { x: 120, y: 500, labelAnchor: "start", labelDy: 34 }
      },
      {
        id: "black_mesa_fork",
        name: "Black Mesa Fork",
        mileMarker: 1240,
        kind: "waypoint",
        tag: "junction",
        routeChoiceId: "black_mesa_fork",
        description: "An old junction sign where the westbound road stops pretending there is only one sensible line.",
        arrivalText: "At Black Mesa Fork, the road finally asks which kind of miles you want next.",
        approachVisual: "roadside_sign",
        nextLegLabel: "Mesa Service Cutoff",
        nextLegSummary: "The signed cutoff is shorter and rougher, with Cedar Spur waiting if you need it.",
        mapPosition: { x: 390, y: 414, labelAnchor: "middle", labelDy: -30 }
      },
      {
        id: "cedar_spur",
        name: "Cedar Spur",
        mileMarker: 2060,
        kind: "waypoint",
        tag: "service",
        townId: "cedar_spur",
        townType: "service_town",
        approachVisual: "town",
        description: "A small town stop with pumps, water, and a little shade.",
        arrivalText: "Cedar Spur feels like a welcome stop after the dry miles.",
        nextLegLabel: "Timber Pass",
        nextLegSummary: "The road leaves the pumps behind and starts climbing through cooler timber.",
        nextLegModifiers: {
          travelMilesAdjustment: 12,
          fuelDeltaAdjustment: -1,
          conditionDeltaAdjustment: -1,
          eventCategoryWeights: {
            travel: 0.2,
            recovery: 0.2
          },
          overnightLocationType: "service_edge",
          overnightQuirkNotes: [
            "The Cedar Spur line stays closer to lit pullouts and paid support than the bench road does."
          ],
          overnightModifierPatch: {
            hookupSupportAdjustment: 1,
            cashDeltaAdjustment: -2
          }
        },
        mapPosition: { x: 505, y: 338, labelAnchor: "middle", labelDy: -30 }
      },
      {
        id: "blue_timber",
        name: "Blue Timber",
        mileMarker: 3110,
        kind: "waypoint",
        tag: "timber",
        description: "Tall trees and softer light where the trip begins to lean west.",
        arrivalText: "Blue Timber is where the road starts to smell like the coast ahead.",
        nextLegLabel: "Salt-Wind Run",
        nextLegSummary: "The last long road runs toward cold wind and thinner sun.",
        mapPosition: { x: 700, y: 258, labelAnchor: "middle", labelDy: 34 }
      },
      {
        id: "cape_flattery",
        name: "Cape Flattery",
        mileMarker: 4260,
        kind: "destination",
        tag: "destination",
        description: "Cold water, hard wind, and the end of the road.",
        arrivalText: "Cape Flattery stands before you at last. The road is done.",
        mapPosition: { x: 875, y: 168, labelAnchor: "end", labelDy: -30 }
      }
    ],
    weatherDeck: [
      {
        label: "Thin haze over dry heat",
        sunlightFactor: 1,
        forecast: "Clear at dawn, wind by afternoon"
      },
      {
        label: "Bright sky and hard crosswind",
        sunlightFactor: 0.95,
        forecast: "Cooler air by evening"
      },
      {
        label: "Marine cloud pushing inland",
        sunlightFactor: 0.72,
        forecast: "Soft light, weak charge until noon"
      }
    ],
    eventDeck: [
      {
        id: "cedar_spur_services",
        title: "Sign For Cedar Spur",
        flavor:
          "A faded sign points to water, diesel, and a few plug-in spots fifteen miles off the road.",
        consequence: "The side road could help, but it will cost time and cash."
      },
      {
        id: "dust_devil",
        title: "Dust Devil On The Shoulder",
        flavor:
          "A hot gust throws dust across the road and coats the roof panels.",
        consequence: "You can clean them at camp, but it will take a little time."
      },
      {
        id: "shaded_pullout",
        title: "Shady Pullout",
        flavor:
          "A ranger sign points to a cool pullout with weak sun and a steady breeze.",
        consequence: "It would feel better there, but charging would be worse."
      }
    ]
  },
  {
    id: "mesa_redwoods",
    label: "Mesa to Redwoods",
    summary: "Open miles, changing weather, and a cool redwood finish under deep shade.",
    startTerrainTint: "#b55f42",
    endTerrainTint: "#4f7b63",
    originName: "Painted Mesa",
    destinationName: "Del Norte Grove",
    totalMiles: 3920,
    startDate: "2032-08-03",
    deadlineAdjustmentDays: 1,
    terrainModifier: 1.02,
    stops: [
      "Painted Mesa",
      "Ash Creek",
      "Bitter Ridge Junction",
      "Rim Market",
      "Fogline Camp",
      "Del Norte Grove"
    ],
    routePoints: [
      {
        id: "painted_mesa",
        name: "Painted Mesa",
        mileMarker: 0,
        kind: "origin",
        tag: "origin",
        description: "An open mesa start with strong sun, wide sky, and very little shade.",
        nextLegLabel: "Mesa Drop",
        nextLegSummary: "The early road stays bright and open before it drops toward the creek.",
        mapPosition: { x: 100, y: 330, labelAnchor: "start", labelDy: -30 }
      },
      {
        id: "ash_creek",
        name: "Ash Creek",
        mileMarker: 880,
        kind: "waypoint",
        tag: "water",
        landmarkStopId: "ash_creek",
        description: "A creek crossing that breaks the mesa road at last.",
        arrivalText: "Ash Creek gives the long open road its first clean pause.",
        approachVisual: "creek_crossing",
        nextLegLabel: "Bitter Ridge Climb",
        nextLegSummary: "The road rises from the creek toward a junction where convenience and quiet part ways.",
        mapPosition: { x: 294, y: 312, labelAnchor: "middle", labelDy: 34 }
      },
      {
        id: "bitter_ridge_junction",
        name: "Bitter Ridge Junction",
        mileMarker: 1180,
        kind: "waypoint",
        tag: "junction",
        routeChoiceId: "bitter_ridge_junction",
        description: "A ridge junction where the road either stays busy and useful or slips into the quieter back line.",
        arrivalText: "At Bitter Ridge Junction, you need to choose whether the next stretch should be practical or quiet.",
        approachVisual: "roadside_sign",
        nextLegLabel: "Ridge Service Road",
        nextLegSummary: "The straighter ridge road runs toward Rim Market, busier traffic, and a cleaner resupply window.",
        mapPosition: { x: 372, y: 304, labelAnchor: "middle", labelDy: -30 }
      },
      {
        id: "rim_market",
        name: "Rim Market",
        mileMarker: 1800,
        kind: "waypoint",
        tag: "service",
        townId: "rim_market",
        townType: "market_town",
        approachVisual: "town",
        description: "A ridge market where the road briefly feels easier.",
        arrivalText: "Rim Market gives the trip a useful middle stop.",
        nextLegLabel: "Fog Shelf",
        nextLegSummary: "The light softens, and the road begins to slow.",
        nextLegModifiers: {
          travelMilesAdjustment: 10,
          fuelDeltaAdjustment: -1,
          moraleDeltaAdjustment: -1,
          eventCategoryWeights: {
            travel: 0.3,
            recovery: 0.2
          },
          overnightLocationType: "service_edge",
          overnightQuirkNotes: [
            "The market road keeps paid support close, but it is rarely the cheap line."
          ],
          overnightModifierPatch: {
            hookupSupportAdjustment: 1,
            cashDeltaAdjustment: -4
          }
        },
        mapPosition: { x: 520, y: 282, labelAnchor: "middle", labelDy: -30 }
      },
      {
        id: "fogline_camp",
        name: "Fogline Camp",
        mileMarker: 2870,
        kind: "waypoint",
        tag: "camp",
        landmarkStopId: "fogline_camp",
        description: "A cool camp at the edge of the fog where the trip starts to feel coastal.",
        arrivalText: "Fogline Camp marks the start of the cooler final stretch.",
        approachVisual: "camp_pullout",
        nextLegLabel: "Redwood Approach",
        nextLegSummary: "The last road has less sky above it and asks for more patience.",
        mapPosition: { x: 710, y: 224, labelAnchor: "middle", labelDy: 34 }
      },
      {
        id: "del_norte_grove",
        name: "Del Norte Grove",
        mileMarker: 3920,
        kind: "destination",
        tag: "destination",
        description: "A redwood finish under deep green shade.",
        arrivalText: "Del Norte Grove gathers the trip into cool, deep shade.",
        mapPosition: { x: 870, y: 124, labelAnchor: "end", labelDy: -30 }
      }
    ],
    weatherDeck: [
      {
        label: "Clear heat under a high sun",
        sunlightFactor: 1,
        forecast: "Cloud band late in the day"
      },
      {
        label: "Gray shelf moving west",
        sunlightFactor: 0.66,
        forecast: "Brief rain near noon"
      },
      {
        label: "Filtered coastal light",
        sunlightFactor: 0.8,
        forecast: "Cool air, partial charge"
      }
    ],
    eventDeck: [
      {
        id: "campground_board_update",
        title: "Campground Note",
        flavor:
          "The ranger board says some shady sites flood after dark if the fog turns to mist.",
        consequence: "A sunny ridge would be safer, but warmer."
      },
      {
        id: "free_water_spigot",
        title: "Free Water",
        flavor:
          "A county yard has free water, but the road in is rough and dusty.",
        consequence: "You could fill up cheap, but the RV would take some wear."
      },
      {
        id: "tourist_traffic",
        title: "Tourist Traffic",
        flavor:
          "A line of sightseers is crowding the next ridge road and slowing everyone down.",
        consequence: "If you push too hard, folks will get worn out."
      }
    ]
  },
  {
    id: "basin_lakes",
    label: "Basin to Mountain Lakes",
    summary: "A colder climb with thin light, high country air, and less time to spare.",
    startTerrainTint: "#9f8c68",
    endTerrainTint: "#5f88a8",
    originName: "Dry Basin",
    destinationName: "Mirror Lake",
    totalMiles: 3580,
    startDate: "2032-09-11",
    deadlineAdjustmentDays: 0,
    terrainModifier: 1.08,
    stops: [
      "Dry Basin",
      "Juniper Cut",
      "Granite Ferry",
      "Switchback Fork",
      "Pine Shelf",
      "Mirror Lake"
    ],
    routePoints: [
      {
        id: "dry_basin",
        name: "Dry Basin",
        mileMarker: 0,
        kind: "origin",
        tag: "origin",
        description: "A cold open basin where your supplies matter from the first morning.",
        nextLegLabel: "Juniper Climb",
        nextLegSummary: "The first road climbs out of the basin and starts to press the day.",
        mapPosition: { x: 132, y: 168, labelAnchor: "start", labelDy: -30 }
      },
      {
        id: "juniper_cut",
        name: "Juniper Cut",
        mileMarker: 820,
        kind: "waypoint",
        tag: "pass",
        landmarkStopId: "juniper_cut",
        description: "A cut through low juniper where the climb first changes its shape.",
        arrivalText: "Juniper Cut is where the real climb begins to show itself.",
        approachVisual: "pass_cut",
        nextLegLabel: "Ferry Road",
        nextLegSummary: "The road bends toward the ferry, where a rough turn could still save miles.",
        mapPosition: { x: 326, y: 196, labelAnchor: "middle", labelDy: -30 }
      },
      {
        id: "granite_ferry",
        name: "Granite Ferry",
        mileMarker: 1660,
        kind: "waypoint",
        tag: "ferry",
        townId: "granite_ferry",
        townType: "ferry_town",
        approachVisual: "town",
        description: "A granite ferry crossing near the middle of the trip.",
        arrivalText: "Granite Ferry gives the climb a hard, clear midpoint.",
        nextLegLabel: "Switchback Decision",
        nextLegSummary: "Past the ferry, the road splits between a shorter shelf line and a longer easier grade.",
        mapPosition: { x: 522, y: 190, labelAnchor: "middle", labelDy: 34 }
      },
      {
        id: "switchback_fork",
        name: "Switchback Fork",
        mileMarker: 1880,
        kind: "waypoint",
        tag: "junction",
        routeChoiceId: "switchback_fork",
        description: "A mountain fork where one sign promises shorter miles and another promises saner grades.",
        arrivalText: "At Switchback Fork, the climb asks whether you want saved miles or a cleaner grade.",
        approachVisual: "roadside_sign",
        nextLegLabel: "Pine Shelf Shortline",
        nextLegSummary: "The shortline climbs onto the shelf quickly and trades easy camp options for saved miles.",
        mapPosition: { x: 590, y: 180, labelAnchor: "middle", labelDy: 34 }
      },
      {
        id: "pine_shelf",
        name: "Pine Shelf",
        mileMarker: 2640,
        kind: "waypoint",
        tag: "shelf",
        landmarkStopId: "pine_shelf",
        description: "A high shelf where the road finally begins to lean toward the lakes.",
        arrivalText: "Pine Shelf makes it plain that the mountain stretch is fully underway.",
        approachVisual: "shelf_overlook",
        nextLegLabel: "Lake Approach",
        nextLegSummary: "The last road is colder still, and timing matters more than speed.",
        nextLegModifiers: {
          sunlightFactorAdjustment: -0.12,
          eventCategoryWeights: {
            energy: 0.4,
            travel: 0.2
          },
          overnightLocationType: "roadside",
          overnightQuirkNotes: [
            "The shelf line stays exposed and cold even after the pinch point loosens."
          ],
          overnightModifierPatch: {
            restQualityShift: -1,
            moraleDeltaAdjustment: -1
          }
        },
        mapPosition: { x: 700, y: 140, labelAnchor: "middle", labelDy: -30 }
      },
      {
        id: "mirror_lake",
        name: "Mirror Lake",
        mileMarker: 3580,
        kind: "destination",
        tag: "destination",
        description: "A mountain lake finish with colder air and shorter light.",
        arrivalText: "Mirror Lake comes into view, and the long climb is finally done.",
        mapPosition: { x: 850, y: 74, labelAnchor: "end", labelDy: 34 }
      }
    ],
    weatherDeck: [
      {
        label: "Cold morning, bright sun",
        sunlightFactor: 0.92,
        forecast: "A cold night ahead"
      },
      {
        label: "Patchy cloud over the pass",
        sunlightFactor: 0.74,
        forecast: "A short clear break after lunch"
      },
      {
        label: "Thin smoke haze",
        sunlightFactor: 0.62,
        forecast: "Weak light until the wind shifts"
      }
    ],
    eventDeck: [
      {
        id: "cold_front_alert",
        title: "Cold Front",
        flavor:
          "A hand-lettered board warns that the next lake camp could drop below freezing before dawn.",
        consequence: "A warmer cabin may matter more than usual tonight."
      },
      {
        id: "rough_ferry_approach",
        title: "Rough Ferry Approach",
        flavor:
          "The road to the ferry is rough and slow, but it can save miles.",
        consequence: "You could save time, but the RV would take wear."
      },
      {
        id: "helpful_camp_host",
        title: "Helpful Camp Host",
        flavor: "A camp host offers a better site map if you stop and ask before dusk.",
        consequence: "A short stop now could make the whole night easier."
      }
    ]
  }
];

export const routeChoiceDefinitions = [
  {
    id: "black_mesa_fork",
    name: "Black Mesa Fork",
    subtitle: "One line saves time and reaches services. The other keeps to the quieter bench road.",
    description:
      "The junction makes the tradeoff plain: shorter rough miles toward Cedar Spur, or a longer bench road with calmer pullouts and fewer practical backups.",
    options: [
      {
        id: "cedar_spur_cutoff",
        label: "Take The Cedar Spur Cutoff",
        kicker: "Faster | Rougher | Services",
        detail:
          "Shorter miles and a real town stop, but the exposed cutoff is harder on the rig and thinner on comfort.",
        effectSummary: "Quicker route, more wear, better access to practical help.",
        resultText:
          "You swing onto the Cedar Spur cutoff, trading a cleaner road for saved miles and a real service town.",
        nextLegLabel: "Mesa Service Cutoff",
        nextLegSummary:
          "Shorter rough miles angle toward Cedar Spur and the last reliable pumps before timber.",
        nextLegModifiers: {
          travelMilesAdjustment: 32,
          fuelDeltaAdjustment: -1,
          waterDeltaAdjustment: -1,
          conditionDeltaAdjustment: -3,
          moraleDeltaAdjustment: -1,
          sunlightFactorAdjustment: 0.05,
          eventCategoryWeights: {
            travel: 0.6,
            rv_condition: 1.1,
            recovery: -0.2
          },
          overnightLocationType: "service_edge",
          overnightQuirkNotes: [
            "This cutoff stays closer to service pullouts and lit stops than the bench road does."
          ],
          overnightModifierPatch: {
            hookupSupportAdjustment: 1,
            cashDeltaAdjustment: -4
          }
        },
        totalMiles: 4260,
        routePoints: [
          {
            id: "cedar_spur",
            name: "Cedar Spur",
            mileMarker: 2060,
            kind: "waypoint",
            tag: "service",
            townId: "cedar_spur",
            townType: "service_town",
            approachVisual: "town",
            description: "A small town stop with pumps, water, and a little shade.",
            arrivalText: "Cedar Spur feels like a welcome stop after the dry miles.",
            nextLegLabel: "Timber Pass",
            nextLegSummary: "The road leaves the pumps behind and starts climbing through cooler timber.",
            nextLegModifiers: {
              travelMilesAdjustment: 12,
              fuelDeltaAdjustment: -1,
              conditionDeltaAdjustment: -1,
              eventCategoryWeights: {
                travel: 0.2,
                recovery: 0.2
              },
              overnightLocationType: "service_edge",
              overnightQuirkNotes: [
                "The Cedar Spur line stays closer to lit pullouts and paid support than the bench road does."
              ],
              overnightModifierPatch: {
                hookupSupportAdjustment: 1,
                cashDeltaAdjustment: -2
              }
            },
            mapPosition: { x: 505, y: 338, labelAnchor: "middle", labelDy: -30 }
          },
          {
            id: "blue_timber",
            name: "Blue Timber",
            mileMarker: 3110,
            kind: "waypoint",
            tag: "timber",
            description: "Tall trees and softer light where the trip begins to lean west.",
            arrivalText: "Blue Timber is where the road starts to smell like the coast ahead.",
            nextLegLabel: "Salt-Wind Run",
            nextLegSummary: "The last long road runs toward cold wind and thinner sun.",
            mapPosition: { x: 700, y: 258, labelAnchor: "middle", labelDy: 34 }
          },
          {
            id: "cape_flattery",
            name: "Cape Flattery",
            mileMarker: 4260,
            kind: "destination",
            tag: "destination",
            description: "Cold water, hard wind, and the end of the road.",
            arrivalText: "Cape Flattery stands before you at last. The road is done.",
            mapPosition: { x: 875, y: 168, labelAnchor: "end", labelDy: -30 }
          }
        ]
      },
      {
        id: "cottonwood_bench_road",
        label: "Stay On The Cottonwood Bench Road",
        kicker: "Longer | Calmer | Sparse",
        detail:
          "A quieter scenic bench road with better boondock pullouts, but fewer services and a longer run before timber.",
        effectSummary: "Longer miles, less wear, weaker support, better camp prospects.",
        resultText:
          "You stay on the bench road, giving up time for a calmer line and better odds of a decent quiet camp.",
        nextLegLabel: "Cottonwood Bench Road",
        nextLegSummary:
          "The road bends wide and quiet along the bench, with more pullouts and fewer useful signs.",
        nextLegModifiers: {
          travelMilesAdjustment: -28,
          fuelDeltaAdjustment: -2,
          waterDeltaAdjustment: -1,
          conditionDeltaAdjustment: 1,
          moraleDeltaAdjustment: 1,
          sunlightFactorAdjustment: -0.06,
          eventCategoryWeights: {
            recovery: 0.7,
            travel: -0.2,
            rv_condition: -0.3
          },
          overnightLocationType: "scenic_pullout",
          overnightQuirkNotes: [
            "This quieter bench road has better odds of a readable boondock pullout before timber."
          ],
          overnightModifierPatch: {
            restQualityShift: 1,
            moraleDeltaAdjustment: 1,
            solarFactorAdjustment: -0.05
          }
        },
        totalMiles: 4400,
        routePoints: [
          {
            id: "cottonwood_bend",
            name: "Cottonwood Bend",
            mileMarker: 2240,
            kind: "waypoint",
            tag: "camp",
            landmarkStopId: "cottonwood_bend",
            description: "A wind-shaped bend with quiet pullouts and a thinner practical margin than the cutoff offers.",
            arrivalText: "Cottonwood Bend proves the bench road is quieter, wider, and less useful all at once.",
            approachVisual: "camp_pullout",
            nextLegLabel: "Blue Timber Bench",
            nextLegSummary: "The bench road stays quiet and gently rolling before it finally turns back toward timber.",
            nextLegModifiers: {
              travelMilesAdjustment: -12,
              fuelDeltaAdjustment: -1,
              conditionDeltaAdjustment: 1,
              moraleDeltaAdjustment: 1,
              eventCategoryWeights: {
                recovery: 0.5,
                morale: 0.3
              },
              overnightLocationType: "scenic_pullout",
              overnightQuirkNotes: [
                "The bench road keeps offering better quiet pull-ins than the service cutoff does."
              ],
              overnightModifierPatch: {
                conditionDeltaAdjustment: 1,
                restQualityShift: 1,
                moraleDeltaAdjustment: 1
              }
            },
            mapPosition: { x: 505, y: 448, labelAnchor: "middle", labelDy: 34 }
          },
          {
            id: "blue_timber",
            name: "Blue Timber",
            mileMarker: 3220,
            kind: "waypoint",
            tag: "timber",
            description: "Blue Timber arrives from the quieter side, with the coast still a long way off but already in the air.",
            arrivalText: "Blue Timber feels calmer from this side of the road, as if the bench miles prepared for it.",
            nextLegLabel: "Salt-Wind Run",
            nextLegSummary: "The last long road runs toward cold wind and thinner sun.",
            mapPosition: { x: 700, y: 300, labelAnchor: "middle", labelDy: 34 }
          },
          {
            id: "cape_flattery",
            name: "Cape Flattery",
            mileMarker: 4400,
            kind: "destination",
            tag: "destination",
            description: "Cold water, hard wind, and the end of the road.",
            arrivalText: "Cape Flattery stands before you at last. The road is done.",
            mapPosition: { x: 875, y: 168, labelAnchor: "end", labelDy: -30 }
          }
        ]
      }
    ]
  }
  ,
  {
    id: "bitter_ridge_junction",
    name: "Bitter Ridge Junction",
    subtitle: "The busy ridge road keeps services close. The back line trades them away for calmer nights.",
    description:
      "From here the route either leans into market traffic and formal stops, or slips onto a lonelier line with better pull-ins and fewer ways to bail yourself out.",
    options: [
      {
        id: "rim_market_road",
        label: "Stay On The Rim Market Road",
        kicker: "Faster | Services | Pricier",
        detail:
          "A straighter ridge road toward Rim Market and formal camp access, with more traffic and more chances to spend cash.",
        effectSummary: "Quicker miles, better support, more traffic and spending pressure.",
        resultText:
          "You stay on the market road, betting that traffic and prices are worth the steadier services.",
        nextLegLabel: "Ridge Service Road",
        nextLegSummary:
          "The straighter ridge road runs toward Rim Market, busier traffic, and a cleaner resupply window.",
        nextLegModifiers: {
          travelMilesAdjustment: 2,
          fuelDeltaAdjustment: -1,
          conditionDeltaAdjustment: -2,
          moraleDeltaAdjustment: -1,
          sunlightFactorAdjustment: 0.04,
          eventCategoryWeights: {
            travel: 1,
            recovery: -0.1
          },
          overnightLocationType: "service_edge",
          overnightQuirkNotes: [
            "The market road still offers one cleaner service-edge night, but the paid support is thinner and pricier than the signs make it sound."
          ],
          overnightModifierPatch: {
            hookupSupportAdjustment: -4,
            cashDeltaAdjustment: -8
          }
        },
        totalMiles: 3975,
        routePoints: [
          {
            id: "ridge_turnout",
            name: "Ridge Turnout",
            mileMarker: 1600,
            kind: "waypoint",
            tag: "turnout",
            description: "A narrow turnout past the busiest service stretch where the market road starts feeling more exposed again.",
            arrivalText: "Ridge Turnout marks the point where the easy plug-in corridor gives way to a more ordinary roadside night.",
            approachVisual: "roadside_sign",
            nextLegLabel: "Rim Market Approach",
            nextLegSummary: "The market is still ahead, but the road stops acting like a service strip and starts asking for a steadier approach.",
            nextLegModifiers: {
              travelMilesAdjustment: 5,
              fuelDeltaAdjustment: 0,
              conditionDeltaAdjustment: -1,
              moraleDeltaAdjustment: 0,
              eventCategoryWeights: {
                travel: 0.3,
                recovery: -0.1
              },
              overnightLocationType: "roadside",
              overnightQuirkNotes: [
                "Past the turnout, the market road no longer behaves like a plug-in corridor, but the pull-in is just good enough to brace one rattling problem before morning."
              ],
              overnightModifierPatch: {
                conditionDeltaAdjustment: 8,
                restQualityShift: 1,
                moraleDeltaAdjustment: 3
              }
            },
            mapPosition: { x: 440, y: 302, labelAnchor: "middle", labelDy: -30 }
          },
          {
            id: "rim_market",
            name: "Rim Market",
            mileMarker: 1800,
            kind: "waypoint",
            tag: "service",
            townId: "rim_market",
            townType: "market_town",
            approachVisual: "town",
            description: "A ridge market where the road briefly feels easier.",
            arrivalText: "Rim Market gives the trip a useful middle stop.",
            nextLegLabel: "Fog Shelf",
            nextLegSummary: "The light softens, and the road begins to slow.",
            nextLegModifiers: {
              travelMilesAdjustment: -6,
              fuelDeltaAdjustment: -1,
              conditionDeltaAdjustment: -1,
              moraleDeltaAdjustment: -1,
              eventCategoryWeights: {
                travel: 0.5,
                recovery: -0.1
              },
              overnightLocationType: "roadside",
              overnightQuirkNotes: [
                "Past the market, the road stops offering easy plug-in nights and starts asking more of whatever shape the RV is already in."
              ],
              overnightModifierPatch: {
                hookupSupportAdjustment: 0,
                cashDeltaAdjustment: -6
              }
            },
            mapPosition: { x: 520, y: 282, labelAnchor: "middle", labelDy: -30 }
          },
          {
            id: "fogline_camp",
            name: "Fogline Camp",
            mileMarker: 2870,
            kind: "waypoint",
            tag: "camp",
            landmarkStopId: "fogline_camp",
            description: "A cool camp at the edge of the fog where the trip starts to feel coastal.",
            arrivalText: "Fogline Camp marks the start of the cooler final stretch.",
            approachVisual: "camp_pullout",
            nextLegLabel: "Redwood Approach",
            nextLegSummary: "The last road has less sky above it and asks for more patience.",
            nextLegModifiers: {
              travelMilesAdjustment: -12,
              fuelDeltaAdjustment: -1,
              conditionDeltaAdjustment: -1,
              moraleDeltaAdjustment: -1,
              eventCategoryWeights: {
                travel: 0.5,
                morale: 0.25,
                recovery: -0.15
              }
            },
            mapPosition: { x: 710, y: 224, labelAnchor: "middle", labelDy: 34 }
          },
          {
            id: "del_norte_grove",
            name: "Del Norte Grove",
            mileMarker: 3920,
            kind: "destination",
            tag: "destination",
            description: "A redwood finish under deep green shade.",
            arrivalText: "Del Norte Grove gathers the trip into cool, deep shade.",
            mapPosition: { x: 870, y: 124, labelAnchor: "end", labelDy: -30 }
          }
        ]
      },
      {
        id: "hollow_creek_line",
        label: "Take The Hollow Creek Line",
        kicker: "Longer | Calmer | Better Camps",
        detail:
          "A lonelier back line that skips the market but gives you quieter pull-ins and a steadier night if you stop short.",
        effectSummary: "Longer miles, fewer services, lower strain, better camp quality.",
        resultText:
          "You slip onto the Hollow Creek line, accepting the longer run in exchange for quieter pull-ins and a softer camp road.",
        nextLegLabel: "Hollow Creek Line",
        nextLegSummary:
          "The back line bends away from traffic, trading easy services for quieter pullouts and a slower approach west.",
        nextLegModifiers: {
          travelMilesAdjustment: -26,
          fuelDeltaAdjustment: -2,
          waterDeltaAdjustment: -1,
          conditionDeltaAdjustment: 1,
          moraleDeltaAdjustment: 1,
          sunlightFactorAdjustment: -0.08,
          eventCategoryWeights: {
            recovery: 0.8,
            morale: 0.4,
            travel: -0.2
          },
          overnightLocationType: "scenic_pullout",
          overnightQuirkNotes: [
            "The Hollow Creek line has better odds of a decent boondock pull-in before the redwoods."
          ],
          overnightModifierPatch: {
            restQualityShift: 1,
            moraleDeltaAdjustment: 1,
            solarFactorAdjustment: 0.02
          }
        },
        totalMiles: 4040,
        routePoints: [
          {
            id: "hollow_creek_camp",
            name: "Hollow Creek Camp",
            mileMarker: 2060,
            kind: "waypoint",
            tag: "camp",
            landmarkStopId: "hollow_creek_camp",
            description: "A quieter camp turnoff where the back line starts to feel worth the lost convenience.",
            arrivalText: "Hollow Creek Camp makes the lonelier road feel like a choice instead of a mistake.",
            approachVisual: "camp_pullout",
            nextLegLabel: "Redwood Back Line",
            nextLegSummary: "The road stays quiet, shaded in places, and noticeably less interested in hurry.",
            nextLegModifiers: {
              travelMilesAdjustment: -10,
              fuelDeltaAdjustment: -1,
              conditionDeltaAdjustment: 1,
              moraleDeltaAdjustment: 1,
              eventCategoryWeights: {
                recovery: 0.5,
                morale: 0.3
              },
              overnightLocationType: "scenic_pullout",
              overnightQuirkNotes: [
                "The back line keeps offering better improvised camps than the market road does."
              ],
              overnightModifierPatch: {
                restQualityShift: 1,
                moraleDeltaAdjustment: 1
              }
            },
            mapPosition: { x: 492, y: 348, labelAnchor: "middle", labelDy: 34 }
          },
          {
            id: "redwood_notch",
            name: "Redwood Notch",
            mileMarker: 3110,
            kind: "waypoint",
            tag: "timber",
            description: "A narrow timber notch where the back line finally rejoins the colder air rolling in from the coast.",
            arrivalText: "Redwood Notch shows that the back line really did carry you into greener country.",
            nextLegLabel: "Redwood Approach",
            nextLegSummary: "The last road has less sky above it and asks for more patience.",
            mapPosition: { x: 694, y: 280, labelAnchor: "middle", labelDy: 34 }
          },
          {
            id: "del_norte_grove",
            name: "Del Norte Grove",
            mileMarker: 4040,
            kind: "destination",
            tag: "destination",
            description: "A redwood finish under deep green shade.",
            arrivalText: "Del Norte Grove gathers the trip into cool, deep shade.",
            mapPosition: { x: 870, y: 124, labelAnchor: "end", labelDy: -30 }
          }
        ]
      }
    ]
  }
  ,
  {
    id: "switchback_fork",
    name: "Switchback Fork",
    subtitle: "One sign points to the shorter shelf line. The other points to a longer easier grade.",
    description:
      "The mountain is offering a clean trade: save miles on the exposed shelf road, or take the longer meadow grade and give the RV a better chance to stay calm.",
    options: [
      {
        id: "pine_shelf_shortline",
        label: "Keep The Pine Shelf Shortline",
        kicker: "Shorter | Exposed | Technical",
        detail:
          "The shelf route saves miles, but it is tighter, windier, and keeps the mountain asking questions.",
        effectSummary: "Shorter route, more wear, weaker camp support, more road trouble.",
        resultText:
          "You keep the short shelf line, trusting that saved miles are worth the tighter grades and thinner pullouts.",
        nextLegLabel: "Pine Shelf Shortline",
        nextLegSummary:
          "The shortline climbs onto the shelf quickly and trades easy camp options for saved miles.",
        nextLegModifiers: {
          travelMilesAdjustment: 26,
          fuelDeltaAdjustment: -1,
          conditionDeltaAdjustment: -3,
          moraleDeltaAdjustment: -1,
          sunlightFactorAdjustment: 0.03,
          eventCategoryWeights: {
            travel: 0.7,
            rv_condition: 1.2,
            recovery: -0.3
          },
          overnightLocationType: "roadside",
          overnightQuirkNotes: [
            "The short shelf line offers fewer forgiving pullouts if you stop before the lakes."
          ],
          overnightModifierPatch: {
            restQualityShift: -1,
            moraleDeltaAdjustment: -1
          }
        },
        totalMiles: 3580,
        routePoints: [
          {
            id: "pine_shelf",
            name: "Pine Shelf",
            mileMarker: 2640,
            kind: "waypoint",
            tag: "shelf",
            landmarkStopId: "pine_shelf",
            description: "A high shelf where the road finally begins to lean toward the lakes.",
            arrivalText: "Pine Shelf makes it plain that the mountain stretch is fully underway.",
            approachVisual: "shelf_overlook",
            nextLegLabel: "Lake Approach",
            nextLegSummary: "The last road is colder still, and timing matters more than speed.",
            nextLegModifiers: {
              sunlightFactorAdjustment: -0.12,
              eventCategoryWeights: {
                energy: 0.4,
                travel: 0.2
              },
              overnightLocationType: "roadside",
              overnightQuirkNotes: [
                "The shelf line stays exposed and cold even after the pinch point loosens."
              ],
              overnightModifierPatch: {
                restQualityShift: -1,
                moraleDeltaAdjustment: -1
              }
            },
            mapPosition: { x: 700, y: 140, labelAnchor: "middle", labelDy: -30 }
          },
          {
            id: "mirror_lake",
            name: "Mirror Lake",
            mileMarker: 3580,
            kind: "destination",
            tag: "destination",
            description: "A mountain lake finish with colder air and shorter light.",
            arrivalText: "Mirror Lake comes into view, and the long climb is finally done.",
            mapPosition: { x: 850, y: 74, labelAnchor: "end", labelDy: 34 }
          }
        ]
      },
      {
        id: "alder_meadow_grade",
        label: "Drop To The Alder Meadow Grade",
        kicker: "Longer | Easier Grade | Lonely",
        detail:
          "The meadow road takes longer but eases the climb and opens up quieter places to stop.",
        effectSummary: "Longer route, less wear, better pullouts, fewer services.",
        resultText:
          "You drop onto the meadow grade, giving up the shortline for a steadier climb and better odds of a decent quiet stop.",
        nextLegLabel: "Alder Meadow Grade",
        nextLegSummary:
          "The meadow road runs longer but gentler, with more room to stop before the final climb.",
        nextLegModifiers: {
          travelMilesAdjustment: -22,
          fuelDeltaAdjustment: -2,
          waterDeltaAdjustment: -1,
          conditionDeltaAdjustment: 2,
          moraleDeltaAdjustment: 1,
          sunlightFactorAdjustment: -0.04,
          eventCategoryWeights: {
            recovery: 0.7,
            rv_condition: -0.2,
            travel: -0.1
          },
          overnightLocationType: "scenic_pullout",
          overnightQuirkNotes: [
            "The meadow grade has quieter clearings and easier boondock pull-ins than the shelf road."
          ],
          overnightModifierPatch: {
            restQualityShift: 1,
            moraleDeltaAdjustment: 1,
            solarFactorAdjustment: 0.04
          }
        },
        totalMiles: 3720,
        routePoints: [
          {
            id: "alder_meadow",
            name: "Alder Meadow",
            mileMarker: 2840,
            kind: "waypoint",
            tag: "camp",
            landmarkStopId: "alder_meadow",
            description: "A quieter meadow bench where the longer grade finally feels like it is paying you back.",
            arrivalText: "Alder Meadow gives the longer line something the short shelf road never really does: room.",
            approachVisual: "camp_pullout",
            nextLegLabel: "Lake Grade",
            nextLegSummary: "The climb stays gentler than the shelf route, but it still asks for patience.",
            nextLegModifiers: {
              travelMilesAdjustment: -8,
              conditionDeltaAdjustment: 1,
              moraleDeltaAdjustment: 1,
              eventCategoryWeights: {
                recovery: 0.4,
                morale: 0.2
              },
              overnightLocationType: "scenic_pullout",
              overnightQuirkNotes: [
                "The meadow grade keeps offering better improvised camps than the shortline does."
              ],
              overnightModifierPatch: {
                restQualityShift: 1,
                moraleDeltaAdjustment: 1
              }
            },
            mapPosition: { x: 700, y: 214, labelAnchor: "middle", labelDy: 34 }
          },
          {
            id: "mirror_lake",
            name: "Mirror Lake",
            mileMarker: 3720,
            kind: "destination",
            tag: "destination",
            description: "A mountain lake finish with colder air and shorter light.",
            arrivalText: "Mirror Lake comes into view, and the long climb is finally done.",
            mapPosition: { x: 850, y: 74, labelAnchor: "end", labelDy: 34 }
          }
        ]
      }
    ]
  }
];

export const passengerSetPresets = [
  {
    id: "family_three",
    label: "Family Of Three",
    summary: "One practical adult, one restless teen, and one younger helper who usually keeps the peace."
  },
  {
    id: "retired_pair",
    label: "Steady Pair",
    summary: "Two steady planners who stay calm by day but handle poor sleep badly."
  },
  {
    id: "friends_loop",
    label: "Friend Group",
    summary: "A cheerful group that keeps spirits high until the road starts to feel rough."
  }
];

export const startingConditionPresets = [
  {
    id: "gentle_start",
    label: "Gentle Start",
    summary: "Good supplies, good time, and room to bounce back from a bad day.",
    deadlineDays: 14,
    resources: {
      batteryCharge: 82,
      batteryCapacity: 100,
      fuel: 90,
      fuelCapacity: 100,
      water: 84,
      waterCapacity: 100,
      cash: 1500,
      rvCondition: 90,
      passengerMorale: 85
    }
  },
  {
    id: "standard",
    label: "Road Ready",
    summary: "A fair starting point with some room to spare, but not much.",
    deadlineDays: 12,
    resources: {
      ...DEFAULT_STARTING_VALUES
    }
  },
  {
    id: "tight_margin",
    label: "Tight Start",
    summary: "Lower supplies, less time, and very little room for mistakes.",
    deadlineDays: 10,
    resources: {
      batteryCharge: 56,
      batteryCapacity: 100,
      fuel: 62,
      fuelCapacity: 100,
      water: 58,
      waterCapacity: 100,
      cash: 820,
      rvCondition: 74,
      passengerMorale: 68
    }
  }
];

export const drivingStyleOptions = [
  {
    id: TRAVEL_MODES.SOLAR_FIRST,
    label: "Easy Day",
    description: "A gentler day with more room to recover and settle in well.",
    narrative:
      "You leave more breathing room in the day, making the road easier on the group and the overnight that follows.",
    driveHours: 8,
    travelRule: {
      fuelUse: 7,
      conditionWear: 2,
      solarAccess: 1.18,
      energyPressure: 1,
      travelMoraleDelta: 1,
      interruptionCountAdjustment: -1,
      travelEventChanceAdjustment: -0.02,
      overnightRestShift: 1,
      waterUseAdjustment: -1,
      wasteAdjustment: -1,
      mileageEfficiency: 0.94,
      tripScoreSupport: 1,
      countsAsHardDay: false
    },
    placeholderEffects: {
      dailyMilesDriven: 384,
      dailyBatteryDelta: 6,
      dailyFuelDelta: -7,
      dailyWaterDelta: 0,
      dailyMoraleDelta: 0,
      dailyConditionDelta: -2,
      dailyCashDelta: 0
    }
  },
  {
    id: TRAVEL_MODES.BALANCED,
    label: "Balanced Day",
    description: "A steady day that keeps the trip moving without leaning too hard on the group.",
    narrative:
      "You keep a practical rhythm, asking the day to move along without turning it into a grind.",
    driveHours: 10,
    travelRule: {
      fuelUse: 11,
      conditionWear: 4,
      solarAccess: 1,
      energyPressure: 2,
      travelMoraleDelta: 0,
      interruptionCountAdjustment: 0,
      travelEventChanceAdjustment: 0,
      overnightRestShift: 0,
      waterUseAdjustment: 0,
      wasteAdjustment: 0,
      mileageEfficiency: 0.82,
      tripScoreSupport: 0,
      countsAsHardDay: false
    },
    placeholderEffects: {
      dailyMilesDriven: 480,
      dailyBatteryDelta: 2,
      dailyFuelDelta: -11,
      dailyWaterDelta: 0,
      dailyMoraleDelta: 0,
      dailyConditionDelta: -4,
      dailyCashDelta: 0
    }
  },
  {
    id: TRAVEL_MODES.PUSH_MILES,
    label: "Push Day",
    description: "A demanding push that puts more strain on comfort, morale, and the stop that follows.",
    narrative:
      "You ask more of the road day than the trip always wants to give back, trading comfort and recovery for forward pressure.",
    driveHours: 11,
    travelRule: {
      fuelUse: 13,
      conditionWear: 5,
      solarAccess: 0.82,
      energyPressure: 4,
      travelMoraleDelta: -2,
      interruptionCountAdjustment: 1,
      travelEventChanceAdjustment: 0.02,
      overnightRestShift: -1,
      waterUseAdjustment: 7,
      wasteAdjustment: 6,
      mileageEfficiency: 0.9,
      tripScoreSupport: -1,
      countsAsHardDay: true
    },
    placeholderEffects: {
      dailyMilesDriven: 528,
      dailyBatteryDelta: -4,
      dailyFuelDelta: -13,
      dailyWaterDelta: 0,
      dailyMoraleDelta: -1,
      dailyConditionDelta: -5,
      dailyCashDelta: 0
    }
  }
];

export const travelModeOptions = drivingStyleOptions;

export const comfortPolicyOptions = [
  {
    id: COMFORT_POLICIES.FRUGAL,
    label: "Frugal",
    description: "Keep discretionary use low and live leanly on the road.",
    summary: "Uses less battery and water, but adds pressure if you stay this lean too long.",
    placeholderEffects: {
      dailyMilesDriven: 0,
      dailyBatteryDelta: 4,
      dailyFuelDelta: 0,
      dailyWaterDelta: -3,
      dailyMoraleDelta: -4,
      dailyConditionDelta: 0,
      dailyCashDelta: 0
    }
  },
  {
    id: COMFORT_POLICIES.BALANCED,
    label: "Balanced",
    description: "Use the basics without turning the RV into either a hardship or a splurge.",
    summary: "A middle road for resources, morale, and nightly recovery.",
    placeholderEffects: {
      dailyMilesDriven: 0,
      dailyBatteryDelta: 0,
      dailyFuelDelta: 0,
      dailyWaterDelta: -7,
      dailyMoraleDelta: 0,
      dailyConditionDelta: 0,
      dailyCashDelta: 0
    }
  },
  {
    id: COMFORT_POLICIES.COMFORTABLE,
    label: "Comfort-First",
    description: "Spend more battery and water to keep life inside the RV easier.",
    summary: "Higher day-to-day use, but better morale, recovery, and less strain buildup.",
    placeholderEffects: {
      dailyMilesDriven: 0,
      dailyBatteryDelta: -7,
      dailyFuelDelta: 0,
      dailyWaterDelta: -11,
      dailyMoraleDelta: 4,
      dailyConditionDelta: 0,
      dailyCashDelta: 0
    }
  }
];

const settingExplanationSpecs = {
  travelMode: {
    displayName: "Day Tone",
    generalExplanation:
      "This sets how demanding or forgiving the travel day feels, and how much strain it carries into the stop that follows.",
    closingLine:
      "A gentler day helps recovery and steadiness. A harder push can still help you move, but it usually costs comfort, morale, and overnight quality.",
    optionDescriptions: {
      [TRAVEL_MODES.SOLAR_FIRST]:
        "A gentler day with more room to recover. Easier on the riders, friendlier to solar and strain, and better at setting up a good night after.",
      [TRAVEL_MODES.BALANCED]:
        "A steady middle ground. Keeps the trip moving without letting every road day turn into a grind.",
      [TRAVEL_MODES.PUSH_MILES]:
        "A demanding push. More pressure, more disruption risk, and less room for the group or the stop to absorb the day cleanly."
    }
  },
  comfortPolicy: {
    displayName: "Living Policy",
    generalExplanation:
      "This is your standing road-living policy: how leanly or comfortably you mean to live while the trip is underway.",
    closingLine:
      "A frugal plan protects stores, while a comfort-first plan protects patience and recovery. Either way, you keep paying for the policy over time.",
    optionDescriptions: {
      [COMFORT_POLICIES.FRUGAL]:
        "Lower discretionary battery and water use, but more strain if the lean policy runs for too many days.",
      [COMFORT_POLICIES.BALANCED]:
        "A steady middle path for day use, morale, and overnight recovery.",
      [COMFORT_POLICIES.COMFORTABLE]:
        "Higher usage, but better morale and a softer night after a hard day."
    }
  }
};

export const campsiteOptions = [
  {
    id: CAMPSITE_TYPES.OPEN_SUN,
    label: "Open Sun",
    tradeoff: "Best charging, least shelter.",
    detail: "A wide site with full sun and almost nowhere to hide from heat or wind.",
    availability: {
      locationTypes: ["campground", "service_edge", "roadside", "scenic_pullout"]
    },
    rules: {
      solarFactor: 1.15,
      waterDelta: 0,
      hookupSupport: 0,
      hookupCashDelta: 0,
      moraleDelta: -1,
      conditionDelta: 0,
      restQualityShift: -1,
      shelter: "open"
    },
    placeholderEffects: {
      dailyMilesDriven: 0,
      dailyBatteryDelta: 8,
      dailyFuelDelta: 0,
      dailyWaterDelta: 0,
      dailyMoraleDelta: -2,
      dailyConditionDelta: 0,
      dailyCashDelta: 0
    }
  },
  {
    id: CAMPSITE_TYPES.PARTIAL_SHADE,
    label: "Partial Shade",
    tradeoff: "Some charging, some shelter.",
    detail: "A mixed site with morning sun and softer light later on.",
    availability: {
      locationTypes: ["campground", "service_edge", "roadside", "scenic_pullout"]
    },
    rules: {
      solarFactor: 0.85,
      waterDelta: 0,
      hookupSupport: 0,
      hookupCashDelta: 0,
      moraleDelta: 1,
      conditionDelta: 0,
      restQualityShift: 0,
      shelter: "mixed"
    },
    placeholderEffects: {
      dailyMilesDriven: 0,
      dailyBatteryDelta: 3,
      dailyFuelDelta: 0,
      dailyWaterDelta: 0,
      dailyMoraleDelta: 1,
      dailyConditionDelta: 0,
      dailyCashDelta: 0
    }
  },
  {
    id: CAMPSITE_TYPES.FULL_SHADE,
    label: "Deep Shade",
    tradeoff: "Best shelter, weakest charging.",
    detail: "A cool site under thick trees where the cabin can rest, even if the battery cannot.",
    availability: {
      locationTypes: ["campground", "roadside", "scenic_pullout"]
    },
    rules: {
      solarFactor: 0.3,
      waterDelta: 0,
      hookupSupport: 0,
      hookupCashDelta: 0,
      moraleDelta: 3,
      conditionDelta: 0,
      restQualityShift: 1,
      shelter: "sheltered"
    },
    placeholderEffects: {
      dailyMilesDriven: 0,
      dailyBatteryDelta: -4,
      dailyFuelDelta: 0,
      dailyWaterDelta: 0,
      dailyMoraleDelta: 4,
      dailyConditionDelta: 0,
      dailyCashDelta: 0
    }
  },
  {
    id: CAMPSITE_TYPES.PAID_HOOKUP,
    label: "Plug-In Site",
    tradeoff: "A steadier night for cash.",
    detail: "A simple paid site with power, water, and fewer worries before morning.",
    availability: {
      locationTypes: ["campground", "service_edge"]
    },
    rules: {
      solarFactor: 0.45,
      waterDelta: 4,
      hookupSupport: 14,
      hookupCashDelta: -HOOKUP_CASH_COST,
      moraleDelta: 4,
      conditionDelta: 0,
      restQualityShift: 1,
      shelter: "hookup"
    },
    placeholderEffects: {
      dailyMilesDriven: 0,
      dailyBatteryDelta: 18,
      dailyFuelDelta: 0,
      dailyWaterDelta: 0,
      dailyMoraleDelta: 5,
      dailyConditionDelta: 0,
      dailyCashDelta: -HOOKUP_CASH_COST
    }
  }
];

export const campEveningActionDefinitions = [
  {
    id: "stay_conserve",
    label: "Conserve Supplies",
    category: "stay_style",
    iconId: "morale",
    budgetCost: 1,
    description: "Use less water and power, knowing the cabin may feel tighter by morning.",
    effectSummary: "Uses fewer supplies, but the mood may dip",
    resultText: "You keep the night lean. The supplies last better, but the cabin feels tighter by morning.",
    overnightModifiers: {
      loadAdjustment: -3,
      waterDeltaAdjustment: 3,
      wasteDeltaAdjustment: -3,
      moraleDeltaAdjustment: -3,
      restQualityShift: -1,
      passengerPressure: {
        recentFrugalDays: 1
      }
    },
    effects: {
      policies: {
        comfortPolicy: COMFORT_POLICIES.FRUGAL
      }
    },
    availability: {
      requiresSelectedCampsite: true,
      oncePerNight: true
    }
  },
  {
    id: "stay_normal",
    label: "Keep Things Normal",
    category: "stay_style",
    iconId: "morale",
    budgetCost: 1,
    description: "Keep the night simple and balanced, with ordinary use of the RV.",
    effectSummary: "Steady rest, ordinary supply use",
    resultText: "You keep the night ordinary: enough comfort, enough restraint, and no big swing either way.",
    overnightModifiers: {
      passengerPressure: {
        recoveryMomentum: 1
      }
    },
    effects: {
      policies: {
        comfortPolicy: COMFORT_POLICIES.BALANCED
      }
    },
    availability: {
      requiresSelectedCampsite: true,
      oncePerNight: true
    }
  },
  {
    id: "stay_comfort",
    label: "Make It Comfortable",
    category: "stay_style",
    iconId: "morale",
    budgetCost: 1,
    description: "Let everyone settle in more comfortably, with more water and power use.",
    effectSummary: "Better rest, higher supply use",
    resultText: "You let everyone use the RV like a home for the night. It helps, but the tanks and battery notice.",
    overnightModifiers: {
      loadAdjustment: 3,
      waterDeltaAdjustment: -4,
      wasteDeltaAdjustment: 4,
      moraleDeltaAdjustment: 12,
      restQualityShift: 1,
      passengerPressure: {
        poorRestStreak: -1,
        recoveryMomentum: 1
      }
    },
    effects: {
      policies: {
        comfortPolicy: COMFORT_POLICIES.COMFORTABLE
      }
    },
    availability: {
      requiresSelectedCampsite: true,
      oncePerNight: true
    }
  },
  {
    id: "service_dump_waste",
    label: "Dump Waste Tank",
    category: "service",
    iconId: "condition",
    budgetCost: 1,
    description: "Empty most of the waste tank while service access is close by.",
    effectSummary: "Clears most waste, costs a little time",
    resultText: "The waste tank is handled before it can shape the next leg.",
    effects: {
      resources: {
        waste: -80
      }
    },
    availability: {
      requiresService: "wasteDump",
      oncePerNight: true
    }
  },
  {
    id: "service_refill_water",
    label: "Refill Fresh Water",
    category: "service",
    iconId: "water",
    budgetCost: 1,
    description: "Top up fresh water before low supplies start shaping the trip.",
    effectSummary: "Adds fresh water, costs a little time",
    resultText: "The fresh tank comes back into a more comfortable range.",
    effects: {
      resources: {
        water: 50
      }
    },
    availability: {
      requiresService: "waterFill",
      oncePerNight: true
    }
  },
  {
    id: "service_charge_electric",
    label: "Recharge Battery",
    category: "service",
    iconId: "battery",
    budgetCost: 1,
    description: "Use available power to put charge back into the house battery.",
    effectSummary: "Adds power, but uses practical time",
    resultText: "The battery has more breathing room for the next stretch.",
    effects: {
      resources: {
        batteryCharge: 35
      }
    },
    availability: {
      requiresService: "electricHookup",
      oncePerNight: true
    }
  }
];

export const campRumorDefinitions = [
  {
    id: "camp_clear_morning",
    label: "Clear Morning Ahead",
    text: "The camp board suggests the next stretch often opens clean and easy if you get moving with the light.",
    effectSummary: "Better odds of an easy stretch on the next leg.",
    eventWeightAdjustments: {
      clear_open_stretch: 2,
      warm_tail_breeze: 1,
      headwind_crossing: -1
    }
  },
  {
    id: "camp_rough_grade_notice",
    label: "Rough Grade Notice",
    text: "Someone has underlined a warning about the next grade rattling anything that is already halfway loose.",
    effectSummary: "Rough-road trouble is a little more likely on the next leg.",
    eventWeightAdjustments: {
      washboard_rattle: 2,
      rolling_slow_zone: 1,
      shoulder_flagger_delay: 1
    }
  },
  {
    id: "camp_water_tip",
    label: "Water Ahead",
    text: "A note by the map says there is still a working water stop ahead if you keep your eyes open for it.",
    effectSummary: "Better odds of finding water on the next leg.",
    eventWeightAdjustments: {
      free_water_spigot: 2,
      fresh_hose_bib: 2,
      volunteer_refill_day: 1
    }
  },
  {
    id: "camp_scenic_pause",
    label: "Worth The Stop",
    text: "A traveler has marked a pullout worth the pause if tomorrow's miles do not get too tight too early.",
    effectSummary: "Better odds of a gentle scenic stop on the next leg.",
    eventWeightAdjustments: {
      scenic_turnout: 2,
      rest_area_stretch: 1,
      sunset_pullout_pause: 1
    }
  }
];

export const campRumorPools = Object.freeze({
  campground: ["camp_clear_morning", "camp_water_tip", "camp_scenic_pause"],
  service_edge: ["camp_clear_morning", "camp_rough_grade_notice", "camp_water_tip"],
  roadside: ["camp_rough_grade_notice", "camp_scenic_pause"],
  scenic_pullout: ["camp_scenic_pause", "camp_clear_morning"]
});

export const townActionOptions = [
  {
    id: "refuel",
    label: "Fill The Tank",
    cost: 28,
    detail: "Top off the tank before fuel turns into tomorrow's trouble.",
    effectSummary: "Up to +26 fuel",
    resultText: "The tank sits in a safer place now, but the stop costs both cash and the day.",
    effects: {
      fuel: 26,
      cash: -28
    }
  },
  {
    id: "refill_water",
    label: "Fill The Water",
    cost: 18,
    detail: "Fill the water while it is simple and close at hand.",
    effectSummary: "Up to +28 water",
    resultText: "Fresh water makes the next stretch feel less tight.",
    effects: {
      water: 28,
      cash: -18
    }
  },
  {
    id: "serviced_hookup",
    label: "Plug In For The Night",
    cost: 42,
    detail: "Pay for power and a steadier place to rest.",
    effectSummary: "Up to +18 battery, +6 water, +3 morale",
    resultText: "The plug-in gives the RV a steady charge and helps people settle.",
    effects: {
      batteryCharge: 18,
      water: 6,
      passengerMorale: 3,
      cash: -42
    }
  },
  {
    id: "repair_rv",
    label: "Fix The RV",
    cost: 58,
    detail: "Fix the parts most likely to turn into tomorrow's trouble.",
    effectSummary: "Up to +14 RV",
    resultText: "The RV leaves town in better shape than it came in.",
    effects: {
      rvCondition: 14,
      cash: -58
    }
  },
  {
    id: "rest_up",
    label: "Warm Meal And Rest",
    cost: 22,
    detail: "Pay for a quieter stop, a better meal, and a little breathing room.",
    effectSummary: "Up to +12 morale",
    resultText: "A calmer evening does more for everyone than another hard night on the road.",
    effects: {
      passengerMorale: 12,
      cash: -22
    }
  }
];

export const townServiceDefinitions = [
  {
    id: "top_off_fuel",
    label: "Top Off Fuel",
    category: "fuel",
    iconId: "fuel",
    baseCost: 28,
    budgetCost: 1,
    description: "Bring the tank back into a safer range before the next stretch decides for you.",
    effectSummary: "Up to +26 fuel",
    resultText: "Fuel settles into a safer range for the road ahead.",
    effects: {
      resources: {
        fuel: 26
      }
    },
    availability: {
      fuelMissingMin: 6
    }
  },
  {
    id: "fill_water",
    label: "Refill Fresh Water",
    category: "water",
    iconId: "water",
    baseCost: 18,
    budgetCost: 1,
    description: "Fill the water while it is easy, close, and not yet urgent.",
    effectSummary: "Tops up fresh water and costs a little time",
    resultText: "Fresh water makes the next run feel less tight.",
    effects: {
      resources: {
        water: 50
      }
    },
    availability: {
      waterMissingMin: 6
    }
  },
  {
    id: "dump_waste",
    label: "Dump Waste Tank",
    category: "service",
    iconId: "condition",
    baseCost: 16,
    budgetCost: 1,
    description: "Empty the waste tank before it turns into the whole trip's problem.",
    effectSummary: "Empties most of the waste tank and costs a little time",
    resultText: "The waste tank is handled, and the cabin stops orbiting that problem.",
    effects: {
      resources: {
        waste: -80
      }
    },
    availability: {
      oncePerVisit: true
    }
  },
  {
    id: "town_charge",
    label: "Recharge Battery",
    category: "service",
    iconId: "battery",
    baseCost: 22,
    budgetCost: 1,
    description: "Use town power long enough to put the house battery back in a safer range.",
    effectSummary: "Adds practical charge and costs a little time",
    resultText: "The battery has more room for the next stretch.",
    effects: {
      resources: {
        batteryCharge: 45
      }
    },
    availability: {
      batteryMissingMin: 8
    }
  },
  {
    id: "quick_utility_stop",
    label: "Quick Utility Stop",
    category: "utility",
    iconId: "battery",
    baseCost: 26,
    budgetCost: 1,
    description: "A practical stop for a little power, a little water, and one less thing to juggle.",
    effectSummary: "Quick charge and small water refill",
    resultText: "A practical utility stop steadies the basics.",
    effects: {
      resources: {
        batteryCharge: 25,
        water: 20
      }
    },
    availability: {
      anyMissing: ["battery", "water"],
      batteryMissingMin: 8,
      waterMissingMin: 8
    }
  },
  {
    id: "meal_shower",
    label: "Meal + Shower",
    category: "comfort",
    iconId: "morale",
    baseCost: 20,
    budgetCost: 1,
    description: "A hot meal, clean towels, and a little time to feel human again.",
    effectSummary: "+8 morale, ease strain",
    resultText: "A proper meal and a little clean comfort lighten the mood.",
    effects: {
      resources: {
        passengerMorale: 8
      },
      passengerPressure: {
        recoveryMomentum: 1,
        poorRestStreak: -1
      }
    },
    availability: {
      moraleBelowPercent: 98
    }
  },
  {
    id: "hot_meal",
    label: "Hot Meal",
    category: "comfort",
    iconId: "morale",
    baseCost: 14,
    budgetCost: 1,
    description: "A simple sit-down meal that steadies the cabin more than the road can.",
    effectSummary: "+6 morale",
    resultText: "The food is simple, hot, and exactly enough to help.",
    effects: {
      resources: {
        passengerMorale: 6
      },
      passengerPressure: {
        recoveryMomentum: 1
      }
    },
    availability: {
      moraleBelowPercent: 99
    }
  },
  {
    id: "laundry_shower",
    label: "Shower + Laundry",
    category: "comfort",
    iconId: "morale",
    baseCost: 16,
    budgetCost: 1,
    description: "Soap, clean clothes, and a little order put back into the day.",
    effectSummary: "+5 morale, ease poor-rest strain",
    resultText: "Clean towels and clean clothes make the RV feel kinder again.",
    effects: {
      resources: {
        passengerMorale: 5
      },
      passengerPressure: {
        recoveryMomentum: 1,
        poorRestStreak: -1
      }
    },
    availability: {
      moraleBelowPercent: 100
    }
  },
  {
    id: "quick_patch",
    label: "Quick Patch",
    category: "repair",
    iconId: "condition",
    baseCost: 18,
    budgetCost: 1,
    description: "A cheap practical patch for the thing most likely to become tomorrow's trouble.",
    effectSummary: "+6 RV",
    resultText: "A small patch buys the RV a little breathing room.",
    effects: {
      resources: {
        rvCondition: 6
      }
    },
    availability: {
      conditionBelowPercent: 99
    }
  },
  {
    id: "standard_service",
    label: "Standard Service",
    category: "repair",
    iconId: "condition",
    baseCost: 34,
    budgetCost: 1,
    description: "A dependable once-over that fixes the wear most likely to spread.",
    effectSummary: "+12 RV",
    resultText: "The RV leaves the bay sounding steadier than it arrived.",
    effects: {
      resources: {
        rvCondition: 12
      }
    },
    availability: {
      conditionBelowPercent: 98
    }
  },
  {
    id: "full_inspection",
    label: "Full Inspection",
    category: "repair",
    iconId: "condition",
    baseCost: 58,
    budgetCost: 2,
    description: "A deeper inspection that costs real money but gives the whole rig a stronger reset.",
    effectSummary: "+18 RV, +2 morale",
    resultText: "A full inspection catches more than the obvious and steadies the whole rig.",
    effects: {
      resources: {
        rvCondition: 18,
        passengerMorale: 2
      },
      passengerPressure: {
        recoveryMomentum: 1
      }
    },
    availability: {
      conditionBelowPercent: 100
    }
  },
  {
    id: "ask_around",
    label: "Ask Around",
    category: "advice",
    iconId: "morale",
    baseCost: 0,
    budgetCost: 1,
    description: "Listen for the sort of local tip that can tilt the next leg a little one way or another.",
    effectSummary: "One next-leg rumor or road tip",
    resultText: "A local road tip gives the next leg a little shape.",
    effects: {
      passengerPressure: {
        recoveryMomentum: 1
      }
    },
    availability: {
      oncePerVisit: true
    }
  }
];

export const townRumorDefinitions = [
  {
    id: "cedar_spur_clear_run",
    label: "Clear Run West Of Town",
    text:
      "A mechanic says the westbound road usually opens up after the ridge, if you stay on the cleaner line.",
    effectSummary: "Easier road ahead — better odds of clean, fast miles.",
    eventWeightAdjustments: {
      clear_open_stretch: 3,
      fresh_blacktop_glide: 2,
      warm_tail_breeze: 1
    },
    legModifierPatch: {
      moraleDeltaAdjustment: 1
    }
  },
  {
    id: "cedar_spur_water_tip",
    label: "Water Ahead",
    text:
      "Someone by the spigot mentions two easy refill spots on the next stretch if you keep your eyes open.",
    effectSummary: "Two easy refills on the next leg if you watch for them.",
    eventWeightAdjustments: {
      free_water_spigot: 3,
      fresh_hose_bib: 3,
      volunteer_refill_day: 2
    },
    legModifierPatch: {}
  },
  {
    id: "rim_market_scenic_tip",
    label: "Scenic Pullout Tip",
    text:
      "The cashier circles a prettier side overlook on a brochure and swears it is worth the stop if the day feels tense.",
    effectSummary: "Scenic stops ahead — a good leg to ease off the pace.",
    eventWeightAdjustments: {
      scenic_turnout: 2,
      sunset_pullout_pause: 3,
      hidden_picnic_ramada: 2,
      wildflower_shoulder: 2
    },
    legModifierPatch: {
      moraleDeltaAdjustment: 2
    }
  },
  {
    id: "rim_market_kind_strangers",
    label: "Friendly Stops Ahead",
    text:
      "A woman at the register says the next county is full of travelers who still wave, share water, and mean it.",
    effectSummary: "Warm roadside encounters likely on the next leg.",
    eventWeightAdjustments: {
      friendly_rver_wave: 3,
      veteran_with_hose: 2,
      water_jug_swap: 2,
      helpful_mechanic_tip: 2
    },
    legModifierPatch: {
      moraleDeltaAdjustment: 1
    }
  },
  {
    id: "granite_ferry_service_window",
    label: "Roadside Service Window",
    text:
      "A ferry hand says the next long stretch has one particularly useful pullout with air, tools, and somebody who knows what they are doing.",
    effectSummary: "Roadside repair help likely on the next leg.",
    eventWeightAdjustments: {
      lucky_service_window: 4,
      helpful_mechanic_tip: 3,
      solar_nerd_encounter: 2
    },
    legModifierPatch: {}
  },
  {
    id: "granite_ferry_blm_tip",
    label: "Quiet BLM Tip",
    text:
      "Another traveler leans in with a note about a quiet BLM spot and a couple of sensible pull-ins farther up the road.",
    effectSummary: "Better dispersed camping ahead — quieter rest likely.",
    eventWeightAdjustments: {
      quiet_blm_tip: 4,
      hidden_picnic_ramada: 2,
      rest_area_stretch: 2
    },
    legModifierPatch: {}
  }
];

const legacyTownDefinitions = [
  {
    id: "cedar_spur",
    name: "Cedar Spur",
    subtitle: "Pumps, water, and a strip of shade under old tin roofing.",
    flavor:
      "Cedar Spur feels like the sort of practical road town that knows exactly what travelers need and nothing more.",
    visitBudget: 1,
    priceMultiplier: 1,
    categoryPriceMultipliers: {
      fuel: 0.9,
      water: 0.85,
      utility: 0.95
    },
    quirkTags: ["fuel_cheaper", "water_easy"],
    serviceIds: [
      "top_off_fuel",
      "fill_water",
      "dump_waste",
      "town_charge",
      "quick_utility_stop",
      "meal_shower",
      "standard_service",
      "ask_around"
    ],
    rumorPoolId: "cedar_spur_pool",
    approachVisual: "town"
  },
  {
    id: "rim_market",
    name: "Rim Market",
    subtitle: "A bright ridge stop with decent food and a little tourist markup.",
    flavor:
      "Rim Market has coffee, postcards, and the sort of practical help that always costs a little more than you wanted.",
    visitBudget: 2,
    priceMultiplier: 1.1,
    categoryPriceMultipliers: {
      comfort: 1.05,
      repair: 0.92
    },
    quirkTags: ["good_meals", "tourist_markup", "repair_pricy"],
    serviceIds: [
      "top_off_fuel",
      "fill_water",
      "dump_waste",
      "hot_meal",
      "quick_patch",
      "ask_around"
    ],
    serviceOverrides: {
      top_off_fuel: {
        label: "Smaller Fuel Top-Off",
        effects: {
          resources: {
            fuel: 18
          }
        }
      },
      hot_meal: {
        effects: {
          resources: {
            passengerMorale: 5
          }
        }
      },
      quick_patch: {
        label: "Targeted Patch",
        effects: {
          resources: {
            rvCondition: 9
          }
        }
      },
      ask_around: {
        label: "Scenic Tip",
        description: "Ask the counter for the sort of local tip that only makes sense after you have seen the road."
      }
    },
    rumorPoolId: "rim_market_pool",
    approachVisual: "town"
  },
  {
    id: "granite_ferry",
    name: "Granite Ferry",
    subtitle: "A ferry town with tools, soap, and people who know the next road.",
    flavor:
      "Granite Ferry is practical in the old-fashioned way: fewer promises, more hoses, bolts, and directions that might actually help.",
    visitBudget: 2,
    priceMultiplier: 0.98,
    categoryPriceMultipliers: {
      repair: 0.92,
      comfort: 0.95
    },
    quirkTags: ["friendly_showers", "repair_fair"],
    serviceIds: [
      "top_off_fuel",
      "fill_water",
      "dump_waste",
      "town_charge",
      "laundry_shower",
      "quick_patch",
      "full_inspection",
      "ask_around"
    ],
    serviceOverrides: {
      top_off_fuel: {
        label: "Fuel At The Ferry"
      },
      ask_around: {
        label: "Local Advice",
        description: "Ask the ferry hands what the next long stretch is really like."
      }
    },
    rumorPoolId: "granite_ferry_pool",
    approachVisual: "town"
  }
];

export const townRumorPools = Object.freeze({
  cedar_spur_pool: ["cedar_spur_clear_run", "cedar_spur_water_tip"],
  rim_market_pool: ["rim_market_scenic_tip", "rim_market_kind_strangers"],
  granite_ferry_pool: ["granite_ferry_service_window", "granite_ferry_blm_tip"]
});

export const landmarkStopActionDefinitions = [
  {
    id: "inspect_first",
    label: "Inspect First",
    category: "obstacle",
    iconId: "condition",
    budgetCost: 1,
    description: "Take a careful look before you commit the rig to the obstacle.",
    effectSummary: "Gain a better read on the obstacle",
    resultText: "A short inspection gives the obstacle cleaner edges before you choose.",
    effects: {
      passengerPressure: {
        recoveryMomentum: 1
      }
    },
    stateChanges: {
      setFlags: ["obstacle_inspected"]
    },
    availability: {
      oncePerVisit: true,
      blocksFlags: ["obstacle_resolved"]
    }
  },
  {
    id: "wait_a_bit",
    label: "Wait A Bit",
    category: "obstacle",
    iconId: "battery",
    budgetCost: 1,
    description: "Hold long enough for the place to give you a slightly better window.",
    effectSummary: "Safer, but not free",
    resultText: "A little patience changes the obstacle more than force would have.",
    effects: {},
    stateChanges: {
      setFlags: ["obstacle_resolved", "obstacle_waited"]
    },
    availability: {
      oncePerVisit: true,
      blocksFlags: ["obstacle_resolved"]
    }
  },
  {
    id: "proceed_carefully",
    label: "Proceed Carefully",
    category: "obstacle",
    iconId: "condition",
    budgetCost: 1,
    description: "Take the careful line and accept the slower, more deliberate move through.",
    effectSummary: "Moderate risk, better after inspection",
    resultText: "A careful approach gets the rig through with mixed grace.",
    effects: {},
    stateChanges: {
      setFlags: ["obstacle_resolved"]
    },
    availability: {
      oncePerVisit: true,
      blocksFlags: ["obstacle_resolved"]
    }
  },
  {
    id: "attempt_now",
    label: "Attempt Now",
    category: "obstacle",
    iconId: "morale",
    budgetCost: 1,
    description: "Take the obstacle immediately and hope momentum is enough.",
    effectSummary: "Fast if it works, rough if it does not",
    resultText: "The obstacle answers right away when you push it.",
    effects: {},
    stateChanges: {
      setFlags: ["obstacle_resolved"]
    },
    availability: {
      oncePerVisit: true,
      blocksFlags: ["obstacle_resolved"]
    }
  },
  {
    id: "reroute",
    label: "Reroute",
    category: "obstacle",
    iconId: "fuel",
    budgetCost: 1,
    description: "Take the longer way around and pay in supplies instead of wear.",
    effectSummary: "Safer on the rig, costs fuel and daylight",
    resultText: "The bypass works, but it asks for its own price.",
    effects: {},
    stateChanges: {
      setFlags: ["obstacle_resolved", "obstacle_rerouted"]
    },
    availability: {
      oncePerVisit: true,
      blocksFlags: ["obstacle_resolved"]
    }
  },
  {
    id: "pay_for_help",
    label: "Pay For Help",
    category: "obstacle",
    iconId: "cash",
    budgetCost: 1,
    description: "Put cash into local help and let somebody else reduce the guesswork.",
    effectSummary: "Costs cash, reduces risk",
    resultText: "Paid help turns the obstacle into something more manageable.",
    effects: {},
    stateChanges: {
      setFlags: ["obstacle_resolved", "obstacle_helped"]
    },
    availability: {
      oncePerVisit: true,
      blocksFlags: ["obstacle_resolved"]
    }
  },
  {
    id: "trust_local_advice",
    label: "Trust Local Advice",
    category: "obstacle",
    iconId: "morale",
    budgetCost: 1,
    description: "Take the line somebody local recommends and live with that trust.",
    effectSummary: "Grounded local call, modest next-leg edge",
    resultText: "You trust the local line and let the place teach you how it wants to be crossed.",
    effects: {},
    stateChanges: {
      setFlags: ["obstacle_resolved", "obstacle_local_advice"]
    },
    availability: {
      oncePerVisit: true,
      blocksFlags: ["obstacle_resolved"]
    }
  },
  {
    id: "check_the_line",
    label: "Check The Line",
    category: "practical",
    iconId: "condition",
    budgetCost: 1,
    description: "Walk the edge once and look for the cleaner, calmer way out of the stop.",
    effectSummary: "+1 RV, ease strain a little",
    resultText: "A quick careful walk steadies both the rig and the mood before you roll on.",
    effects: {
      resources: {
        rvCondition: 1
      },
      passengerPressure: {
        recoveryMomentum: 1
      }
    },
    availability: {
      oncePerVisit: true
    }
  },
  {
    id: "small_water_refill",
    label: "Take A Small Water Refill",
    category: "utility",
    iconId: "water",
    budgetCost: 1,
    description: "Take a modest refill while the water is easy, close, and worth trusting.",
    effectSummary: "+6 water",
    resultText: "A modest refill takes some pressure off the next stretch.",
    effects: {
      resources: {
        water: 6
      }
    },
    availability: {
      waterMissingMin: 5
    }
  },
  {
    id: "pause_by_water",
    label: "Pause By The Water",
    category: "comfort",
    iconId: "morale",
    budgetCost: 1,
    description: "Let the place do a little work on the cabin before the next road starts asking again.",
    effectSummary: "+3 morale",
    resultText: "A short pause by the water gives everybody a little more room to breathe.",
    effects: {
      resources: {
        passengerMorale: 3
      },
      passengerPressure: {
        recoveryMomentum: 1
      }
    },
    availability: {
      oncePerVisit: true
    }
  },
  {
    id: "ask_the_road",
    label: "Ask About The Road Ahead",
    category: "advice",
    iconId: "morale",
    budgetCost: 1,
    description: "Listen for the kind of local warning or tip that can tilt the next leg a little.",
    effectSummary: "One next-leg road tip",
    resultText: "A local tip gives the next stretch a little more shape before you leave.",
    effects: {
      passengerPressure: {
        recoveryMomentum: 1
      }
    },
    grantsRumor: true,
    availability: {
      oncePerVisit: true
    }
  },
  {
    id: "inspect_road_edge",
    label: "Inspect The Road Edge",
    category: "practical",
    iconId: "condition",
    budgetCost: 1,
    description: "Look over the grade, shoulder, or cut before the next miles make the choice for you.",
    effectSummary: "+2 RV",
    resultText: "A careful look catches the small things most likely to turn ugly later.",
    effects: {
      resources: {
        rvCondition: 2
      }
    },
    availability: {
      oncePerVisit: true
    }
  },
  {
    id: "tighten_things_up",
    label: "Tighten Things Up",
    category: "practical",
    iconId: "condition",
    budgetCost: 1,
    description: "Give the RV a short practical once-over before the rougher road starts its own inspection.",
    effectSummary: "+4 RV",
    resultText: "A few minutes with the rig now leave less for the road to discover later.",
    effects: {
      resources: {
        rvCondition: 4
      }
    },
    availability: {
      conditionBelowPercent: 100
    }
  },
  {
    id: "take_in_the_view",
    label: "Take In The View",
    category: "comfort",
    iconId: "morale",
    budgetCost: 1,
    description: "Stand still long enough to remember the road is passing through a real place.",
    effectSummary: "+3 morale",
    resultText: "The stop gives back a little calm before the road asks for more of you.",
    effects: {
      resources: {
        passengerMorale: 3
      },
      passengerPressure: {
        recoveryMomentum: 1
      }
    },
    availability: {
      oncePerVisit: true
    }
  },
  {
    id: "read_the_board",
    label: "Read The Board",
    category: "advice",
    iconId: "morale",
    budgetCost: 1,
    description: "Read the notices, warnings, and traveler notes for anything useful before you move on.",
    effectSummary: "One next-leg road tip",
    resultText: "A weathered note gives the next stretch a little more shape.",
    effects: {
      passengerPressure: {
        recoveryMomentum: 1
      }
    },
    grantsRumor: true,
    availability: {
      oncePerVisit: true
    }
  },
  {
    id: "stretch_and_reset",
    label: "Stretch And Reset",
    category: "comfort",
    iconId: "morale",
    budgetCost: 1,
    description: "Shake the drive out of your legs and the tightest edge out of the cabin.",
    effectSummary: "+2 morale, ease poor-rest strain",
    resultText: "A quiet reset leaves the cabin a little softer before the night closes in.",
    effects: {
      resources: {
        passengerMorale: 2
      },
      passengerPressure: {
        recoveryMomentum: 1,
        poorRestStreak: -1
      }
    },
    availability: {
      oncePerVisit: true
    }
  },
  {
    id: "quiet_utility_refill",
    label: "Quiet Utility Refill",
    category: "utility",
    iconId: "battery",
    budgetCost: 1,
    description: "Take the small practical refill the place offers and leave the next leg a little less tight.",
    effectSummary: "+4 battery, +4 water",
    resultText: "A quiet utility stop steadies two things before the next miles begin.",
    effects: {
      resources: {
        batteryCharge: 4,
        water: 4
      }
    },
    availability: {
      anyMissing: ["battery", "water"],
      batteryMissingMin: 4,
      waterMissingMin: 4
    }
  }
];

export const landmarkRumorDefinitions = [
  {
    id: "wash_water_ahead",
    label: "Water Ahead",
    text: "A faded note says the next stretch still has one decent refill if you keep your eyes open.",
    effectSummary: "Better odds of finding water on the next leg.",
    eventWeightAdjustments: {
      free_water_spigot: 2,
      fresh_hose_bib: 2,
      volunteer_refill_day: 1
    }
  },
  {
    id: "wash_clear_run",
    label: "Clear Run After The Wash",
    text: "A trucker says the road usually opens up cleanly once you are out of the wash and back on the higher line.",
    effectSummary: "Better odds of an easier travel stretch on the next leg.",
    eventWeightAdjustments: {
      clear_open_stretch: 2,
      warm_tail_breeze: 1,
      rolling_slow_zone: -1
    }
  },
  {
    id: "creek_shade_tip",
    label: "Shade Up Ahead",
    text: "Someone by the creek mentions a better pullout ahead if the day gets too hot and sharp.",
    effectSummary: "Better odds of a gentler comfort stop on the next leg.",
    eventWeightAdjustments: {
      cool_shade_break: 2,
      rest_area_stretch: 1,
      hidden_picnic_ramada: 1
    }
  },
  {
    id: "camp_clear_start",
    label: "Clear Start",
    text: "A penciled note says the morning road often starts cleaner than it ends if you leave with the light.",
    effectSummary: "Better odds of a smoother opening stretch next leg.",
    eventWeightAdjustments: {
      clear_open_stretch: 2,
      fresh_blacktop_glide: 1,
      headwind_crossing: -1
    }
  },
  {
    id: "camp_quiet_site_tip",
    label: "Quiet Site Ahead",
    text: "A traveler has marked a calmer stop farther on where the cabin can breathe a little.",
    effectSummary: "Better odds of a calm stop on the next leg.",
    eventWeightAdjustments: {
      quiet_blm_tip: 2,
      hidden_picnic_ramada: 2,
      sunset_pullout_pause: 1
    }
  },
  {
    id: "pass_wind_warning",
    label: "Wind Across The Grade",
    text: "A hand on the rail warns that the next high stretch catches sidewind harder than it looks from here.",
    effectSummary: "Sidewind and headwind are more likely on the next leg.",
    eventWeightAdjustments: {
      sidewind_gusts: 2,
      headwind_crossing: 1,
      warm_tail_breeze: -1
    },
    legModifierPatch: {
      fuelDeltaAdjustment: -1,
      moraleDeltaAdjustment: -1
    }
  },
  {
    id: "pass_rough_grade",
    label: "Rough Grade Ahead",
    text: "Someone has scratched a note about the next grade rattling anything already halfway loose.",
    effectSummary: "Rough road ahead: the RV will take some extra wear.",
    eventWeightAdjustments: {
      washboard_rattle: 2,
      rolling_slow_zone: 1,
      lucky_service_window: 1
    },
    legModifierPatch: {
      conditionDeltaAdjustment: -3,
      fuelDeltaAdjustment: -1
    }
  },
  {
    id: "shelf_scenic_pull",
    label: "Worth The Pullout",
    text: "A lookout note says the next scenic pull is worth the small delay if the cabin is feeling pinched.",
    effectSummary: "Scenic stops ahead — good for morale on the next leg.",
    eventWeightAdjustments: {
      scenic_turnout: 2,
      sunset_pullout_pause: 2,
      wildflower_shoulder: 1
    },
    legModifierPatch: {
      moraleDeltaAdjustment: 2
    }
  },
  {
    id: "shelf_careful_line",
    label: "Careful Line",
    text: "A penciled warning says the shelf narrows in one place and rewards a calmer line more than a faster one.",
    effectSummary: "Slow going on the next leg — easier on the rig if you ease off.",
    eventWeightAdjustments: {
      rolling_slow_zone: 2,
      shoulder_flagger_delay: 1,
      clear_open_stretch: -1
    },
    legModifierPatch: {
      conditionDeltaAdjustment: -2,
      travelMilesAdjustment: 10
    }
  },
  {
    id: "rough_road_ahead",
    label: "Rough Miles Ahead",
    text: "A note warns of loose surface and broken edges on the next long stretch.",
    effectSummary: "Rough road: the RV will take extra wear on the next leg.",
    eventWeightAdjustments: {
      rough_shoulder_crumble: 3,
      pothole_rattle: 2,
      road_washout_swerve: 2
    },
    legModifierPatch: {
      conditionDeltaAdjustment: -4,
      fuelDeltaAdjustment: -1
    }
  },
  {
    id: "strong_sun_ahead",
    label: "Strong Sun On The Next Stretch",
    text: "The next road runs open and bright with long hours of direct sun.",
    effectSummary: "Strong sun ahead — better solar charging on the next leg.",
    eventWeightAdjustments: {
      warm_tail_breeze: 2,
      clear_open_stretch: 2
    },
    legModifierPatch: {
      sunlightFactorAdjustment: 0.12
    }
  },
  {
    id: "scenic_slow_leg",
    label: "Scenic But Slow",
    text: "A quiet traveler says the next road is beautiful but unhurried.",
    effectSummary: "Scenic miles ahead — morale up, pace a little slower.",
    eventWeightAdjustments: {
      scenic_turnout: 3,
      sunset_pullout_pause: 2,
      wildflower_shoulder: 2
    },
    legModifierPatch: {
      moraleDeltaAdjustment: 3,
      travelMilesAdjustment: 15
    }
  },
  {
    id: "sparse_services_ahead",
    label: "Sparse Services Ahead",
    text: "A weathered note says the next long stretch runs thin on gas, water, and help.",
    effectSummary: "Few services on the next leg — stock up before you leave.",
    eventWeightAdjustments: {
      lucky_service_window: -2,
      helpful_mechanic_tip: -2
    },
    legModifierPatch: {}
  },
  {
    id: "easy_water_ahead",
    label: "Water Easier Ahead",
    text: "A traveler mentions a couple of decent refill spots on the next stretch.",
    effectSummary: "Better odds of finding water on the next leg.",
    eventWeightAdjustments: {
      free_water_spigot: 3,
      fresh_hose_bib: 2,
      volunteer_refill_day: 2
    },
    legModifierPatch: {}
  },
  {
    id: "tricky_crossing_ahead",
    label: "Tricky Crossing Ahead",
    text: "Someone left a note: watch for the low crossing after the ridge. It has washed out before.",
    effectSummary: "Road wear and a possible obstacle on the next leg.",
    eventWeightAdjustments: {
      road_washout_swerve: 3,
      flooded_underpass_wait: 2,
      rough_shoulder_crumble: 2
    },
    legModifierPatch: {
      conditionDeltaAdjustment: -2
    }
  },
  {
    id: "good_camp_ahead",
    label: "Better Camp Further On",
    text: "A regulars-only tip: the camp spots get quieter and more useful past the next town.",
    effectSummary: "Better rest quality on the next overnight.",
    eventWeightAdjustments: {
      quiet_blm_tip: 3,
      hidden_picnic_ramada: 2
    },
    legModifierPatch: {}
  }
];

export const landmarkStopDefinitions = [
  {
    id: "sunset_wash",
    name: "Sunset Wash",
    stopKind: "wash",
    subtitle: "Low banks, a little water, and a stony place to look the road over.",
    presentation: "obstacle",
    obstacle: {
      title: "Wash Exit",
      description: "The climb back onto the road is soft and rutted from the last runoff.",
      stakes:
        "You need to choose how to get through it. The wrong line costs condition and rattles the cabin."
    },
    flavor:
      "Sunset Wash feels like the sort of place where the road briefly admits it has moods of its own.",
    visitBudget: 2,
    quirkNotes: [
      "There is enough water here to help a little, not enough to solve tomorrow by itself.",
      "The wash rewards patience more than hurry."
    ],
    actionIds: ["inspect_first", "wait_a_bit", "proceed_carefully", "attempt_now"],
    actionOverrides: {
      inspect_first: {
        label: "Inspect The Wash First",
        description:
          "Walk the wash edge and mark the firmest way out before you commit the tires.",
        effectSummary: "Better read on the crossing",
        resultText:
          "You walk the rut twice, kick at the soft spots, and find the line most likely to hold.",
        effects: {
          resources: {
            rvCondition: 1
          },
          passengerPressure: {
            recoveryMomentum: 1
          }
        }
      },
      wait_a_bit: {
        label: "Let The Wash Dry A Bit",
        description:
          "Hold a little longer and let the soft edge tighten under the sun before you climb out.",
        effectSummary: "-1 water, safe crossing, better road ahead",
        resultText:
          "You let the soft patch bake a little longer, then crawl out over firmer ground with less drama than the wash first promised.",
        effects: {
          resources: {
            water: -1
          },
          passengerPressure: {
            recoveryMomentum: 1
          }
        },
        intelId: "wash_clear_run"
      },
      proceed_carefully: {
        label: "Pick Through Carefully",
        description:
          "Ease onto the best line you can hold and accept the slower climb out.",
        effectSummary: "Safer after an inspection",
        outcomes: [
          {
            id: "wash_clean",
            weight: 5,
            requiresFlags: ["obstacle_inspected"],
            resultText:
              "Because you walked it first, the tires climb the firmer shoulder and the RV comes out with only a little protest.",
            effectSummary: "+1 RV, easier on the cabin",
            effects: {
              resources: {
                rvCondition: 1
              },
              passengerPressure: {
                recoveryMomentum: 1
              }
            }
          },
          {
            id: "wash_rough",
            weight: 2,
            resultText:
              "The rear wheels slip once in the soft patch and the wash reminds everyone that careful is not the same as easy.",
            effectSummary: "-3 RV, -1 morale",
            effects: {
              resources: {
                rvCondition: -3,
                passengerMorale: -1
              }
            }
          }
        ]
      },
      attempt_now: {
        label: "Punch Out Of The Wash",
        description:
          "Take the climb immediately and trust momentum more than patience.",
        effectSummary: "Fast if it works, rough if it does not",
        outcomes: [
          {
            id: "wash_jump_clean",
            weight: 1,
            requiresFlags: ["obstacle_inspected"],
            resultText:
              "You hit the line you already picked and bounce onto firm road before the wash can argue.",
            effectSummary: "+6 miles, +1 morale",
            effects: {
              journey: {
                milesTraveled: 6
              },
              resources: {
                passengerMorale: 1
              }
            },
            intelId: "wash_clear_run"
          },
          {
            id: "wash_bang",
            weight: 4,
            resultText:
              "The wash bucks the rig hard on the way out and everybody feels the choice the moment it is made.",
            effectSummary: "-5 RV, -2 morale",
            effects: {
              resources: {
                rvCondition: -5,
                passengerMorale: -2
              }
            }
          }
        ]
      }
    },
    rumorPoolId: "wash_pool",
    approachVisual: "wash_crossing"
  },
  {
    id: "ash_creek",
    name: "Ash Creek",
    stopKind: "creek",
    subtitle: "A creek crossing cool enough to make the whole day feel briefly different.",
    presentation: "obstacle",
    obstacle: {
      title: "Creek Crossing",
      description: "The water is shallow enough, but the bank is slick where other tires have torn it up.",
      stakes:
        "A good entry keeps the crossing readable. A sloppy one costs wear and patience."
    },
    flavor:
      "Ash Creek gives the road a cleaner pause than most stops, with water, shade, and just enough room to listen before moving on.",
    visitBudget: 2,
    quirkNotes: [
      "The water helps a little even when the day still has miles left in it.",
      "People tend to linger here a minute longer than they planned."
    ],
    actionIds: ["inspect_first", "wait_a_bit", "proceed_carefully", "trust_local_advice"],
    actionOverrides: {
      inspect_first: {
        label: "Walk The Creek Edge",
        description:
          "Pace the bank once, find the firmer stones, and pick the least slippery entry.",
        effectSummary: "Better read on the slick bank",
        resultText:
          "You pace the bank, find the firmer stones, and spot where the tires are most likely to stay honest.",
        effects: {
          resources: {
            rvCondition: 1
          }
        }
      },
      wait_a_bit: {
        label: "Wait For The Mud To Settle",
        description:
          "Give the churned bank a little time to quit shining and decide it has done enough moving for one day.",
        effectSummary: "-1 battery, calm crossing",
        resultText:
          "You wait long enough for the churned bank to settle, then take the crossing once it feels less eager to slide.",
        effects: {
          resources: {
            batteryCharge: -1
          },
          passengerPressure: {
            recoveryMomentum: 1
          }
        }
      },
      proceed_carefully: {
        label: "Ease Across Carefully",
        description:
          "Take the crossing slowly and let the front tires tell you whether the bank means what it looks like.",
        effectSummary: "Better after you walk it first",
        outcomes: [
          {
            id: "creek_clean",
            weight: 5,
            requiresFlags: ["obstacle_inspected"],
            resultText:
              "The careful entry pays off and the RV comes up the far bank cleaner than most crossings manage.",
            effectSummary: "+1 morale, no damage",
            effects: {
              resources: {
                passengerMorale: 1
              },
              passengerPressure: {
                recoveryMomentum: 1
              }
            }
          },
          {
            id: "creek_slip",
            weight: 2,
            resultText:
              "The bank gives a little under the tires and the crossing turns muddier and more tedious than you wanted.",
            effectSummary: "-2 RV, -1 morale",
            effects: {
              resources: {
                rvCondition: -2,
                passengerMorale: -1
              }
            }
          }
        ]
      },
      trust_local_advice: {
        label: "Take The Fisherman's Line",
        description:
          "Use the line a local points out and trust that somebody who crosses here often is worth listening to.",
        effectSummary: "+1 morale, next-leg pullout tip",
        resultText:
          "You follow the line a local points out and come through the crossing cleaner than the bank first made it look.",
        effects: {
          resources: {
            passengerMorale: 1
          },
          passengerPressure: {
            recoveryMomentum: 1
          }
        },
        intelId: "creek_shade_tip"
      }
    },
    rumorPoolId: "creek_pool",
    approachVisual: "creek_crossing"
  },
  {
    id: "fogline_camp",
    name: "Fogline Camp",
    stopKind: "camp",
    subtitle: "Posted notes, cool air, and a camp place that feels like a real pause in the route.",
    flavor:
      "Fogline Camp feels more settled than most roadside places, as if travelers have been teaching one another how to use it for years.",
    visitBudget: 2,
    quirkNotes: [
      "Posted notes matter a little more here than at a plain pullout.",
      "A small practical refill is possible if you keep your expectations modest."
    ],
    actionIds: ["read_the_board", "stretch_and_reset", "quiet_utility_refill", "ask_the_road"],
    actionOverrides: {
      read_the_board: {
        effects: {
          passengerPressure: {
            recoveryMomentum: 1
          }
        }
      },
      stretch_and_reset: {
        effects: {
          resources: {
            passengerMorale: 2
          },
          passengerPressure: {
            recoveryMomentum: 1,
            poorRestStreak: -1
          }
        }
      },
      quiet_utility_refill: {
        effects: {
          resources: {
            batteryCharge: 2,
            water: 2
          }
        }
      },
      ask_the_road: {
        label: "Note A Campsite Tip",
        description: "Listen for the sort of campsite or road note that makes the next leg feel less blind."
      }
    },
    rumorPoolId: "camp_pullout_pool",
    approachVisual: "camp_pullout"
  },
  {
    id: "juniper_cut",
    name: "Juniper Cut",
    stopKind: "pass",
    subtitle: "A wind-exposed cut where the climb stops looking simple.",
    presentation: "obstacle",
    obstacle: {
      title: "Windy Grade",
      description: "The cut pinches the climb and the sidewind catches you harder than it first appears.",
      stakes:
        "You need a plan for the grade. The wrong one costs energy, condition, or both."
    },
    flavor:
      "Juniper Cut feels like a place where people lower their voices, look over the grade, and decide how much confidence they actually brought with them.",
    visitBudget: 2,
    quirkNotes: [
      "The place gives better caution than comfort.",
      "A quick look here can save the road from discovering something first."
    ],
    actionIds: ["inspect_first", "wait_a_bit", "proceed_carefully", "pay_for_help"],
    actionOverrides: {
      inspect_first: {
        label: "Scout The Grade On Foot",
        description:
          "Walk the first steep stretch and see where the wind is likely to shove hardest.",
        effectSummary: "Better read on the climb",
        resultText:
          "A short walk tells you where the gusts are crossing and which part of the shoulder deserves the least trust.",
        effects: {
          resources: {
            rvCondition: 1
          }
        }
      },
      wait_a_bit: {
        label: "Let The Gusts Pass",
        description:
          "Sit tight until the crosswind eases off its worst habits, then take the grade in a calmer window.",
        effectSummary: "-2 battery, safer window",
        resultText:
          "You wait out the sharpest gusts and take the climb once the cut feels a little less eager to shove back.",
        effects: {
          resources: {
            batteryCharge: -2
          },
          passengerPressure: {
            recoveryMomentum: 1
          }
        }
      },
      proceed_carefully: {
        label: "Take The Grade In Low Gear",
        description:
          "Keep it slow, keep it deliberate, and let the grade know you are not here to impress it.",
        effectSummary: "Safer after scouting, still costs energy",
        outcomes: [
          {
            id: "pass_clean",
            weight: 5,
            requiresFlags: ["obstacle_inspected"],
            resultText:
              "Because you walked it first, the RV stays composed through the worst shove and clears the cut without much complaint.",
            effectSummary: "-2 battery, +1 RV",
            effects: {
              resources: {
                batteryCharge: -2,
                rvCondition: 1
              }
            }
          },
          {
            id: "pass_dragged",
            weight: 2,
            resultText:
              "The climb still takes more out of the rig than you wanted and the wind gets one ugly say in the middle of it.",
            effectSummary: "-4 battery, -3 RV, -1 morale",
            effects: {
              resources: {
                batteryCharge: -4,
                rvCondition: -3,
                passengerMorale: -1
              }
            }
          }
        ]
      },
      pay_for_help: {
        label: "Pay A Road Hand To Spot You",
        description:
          "Put money into local guidance and let somebody else read the wind and edge while you focus on the climb.",
        effectSummary: "-$45, safe crossing, grade warning ahead",
        resultText:
          "A road hand walks the worst part of the grade with you and gets the rig over it without asking the suspension to improvise.",
        effects: {
          resources: {
            cash: -45,
            rvCondition: 1
          }
        },
        intelId: "pass_wind_warning"
      }
    },
    rumorPoolId: "pass_pool",
    approachVisual: "pass_cut"
  },
  {
    id: "pine_shelf",
    name: "Pine Shelf",
    stopKind: "shelf",
    subtitle: "A high shelf road stop with more sky than guardrail and a long look ahead.",
    presentation: "obstacle",
    obstacle: {
      title: "Shelf Road Pinch",
      description: "One narrow section asks more trust from the shoulder than the shoulder really deserves.",
      stakes:
        "You can take it, back away, or use a local line, but you do need to choose."
    },
    flavor:
      "Pine Shelf feels exposed in the mountain way: not hostile, exactly, but unwilling to pretend the road is wider than it is.",
    visitBudget: 2,
    quirkNotes: [
      "The view helps, but the road still wants a respectful line.",
      "Traveler notes here tend to be short and worth reading."
    ],
    actionIds: ["inspect_first", "proceed_carefully", "reroute", "trust_local_advice"],
    actionOverrides: {
      inspect_first: {
        label: "Read The Chalk Marks",
        description:
          "Study the shoulder, the chalk, and the pullout spacing before you decide how brave to be.",
        effectSummary: "Better read on the pinch point",
        resultText:
          "The chalk marks and tire scuffs make the narrowest part of the shelf easier to read than it first looked.",
        effects: {
          resources: {
            rvCondition: 1
          }
        }
      },
      proceed_carefully: {
        label: "Hug The Inside Line",
        description:
          "Take the shelf slowly, stay tight to the rock, and let the outside edge keep its distance.",
        effectSummary: "Better after inspection, rough if you misread it",
        outcomes: [
          {
            id: "shelf_clean",
            weight: 5,
            requiresFlags: ["obstacle_inspected"],
            resultText:
              "The inside line holds and the RV threads the pinch point with more control than grace, which is enough.",
            effectSummary: "+1 RV, steady nerves",
            effects: {
              resources: {
                rvCondition: 1
              },
              passengerPressure: {
                recoveryMomentum: 1
              }
            }
          },
          {
            id: "shelf_scrape",
            weight: 2,
            resultText:
              "The shoulder makes one bad offer on the way through and the rig comes out a little more worn and a lot less romantic about shelf roads.",
            effectSummary: "-4 RV, -2 morale",
            effects: {
              resources: {
                rvCondition: -4,
                passengerMorale: -2
              }
            }
          }
        ]
      },
      reroute: {
        label: "Take The Lower Bypass",
        description:
          "Drop to the lower forest road and spend supplies instead of pushing the rig through the pinch point.",
        effectSummary: "+10 miles, -4 fuel, -1 water, spare the RV",
        resultText:
          "You take the lower forest road, spend more fuel than you wanted, and rejoin beyond the shelf without scraping the rig through the narrowest part.",
        effects: {
          journey: {
            milesTraveled: 10
          },
          resources: {
            fuel: -4,
            water: -1
          }
        }
      },
      trust_local_advice: {
        label: "Trust The Pullout Advice",
        description:
          "Follow the pullout order a local driver recommends and let somebody else's experience shorten the guesswork.",
        effectSummary: "+1 morale, safe line, next-leg scenic tip",
        resultText:
          "You follow the pullout order a local swears by and thread the narrowest section without forcing the shoulder to make promises.",
        effects: {
          resources: {
            passengerMorale: 1
          }
        },
        intelId: "shelf_scenic_pull"
      }
    },
    rumorPoolId: "shelf_pool",
    approachVisual: "shelf_overlook"
  },
  {
    id: "cottonwood_bend",
    name: "Cottonwood Bend",
    stopKind: "camp",
    subtitle: "A quieter bench-road pullout where the road feels calmer and the support feels thinner.",
    flavor:
      "Cottonwood Bend feels like a place people choose on purpose when they are willing to trade convenience for a more readable night.",
    visitBudget: 2,
    quirkNotes: [
      "The place is better at quiet than utility.",
      "The bench road feels wider here than the service cutoff ever does."
    ],
    actionIds: ["take_in_the_view", "stretch_and_reset", "inspect_road_edge", "ask_the_road"],
    actionOverrides: {
      ask_the_road: {
        label: "Ask About Bench Pullouts",
        description:
          "Listen for the sort of local note that tells you where this quieter road still offers a decent place to stop."
      }
    },
    rumorPoolId: "camp_pullout_pool",
    approachVisual: "camp_pullout"
  },
  {
    id: "hollow_creek_camp",
    name: "Hollow Creek Camp",
    stopKind: "camp",
    subtitle: "A cool back-line camp where the lonelier road briefly feels generous.",
    flavor:
      "Hollow Creek Camp feels like the kind of stop that rewards travelers who gave up the easy services on purpose.",
    visitBudget: 2,
    quirkNotes: [
      "The camp is better than the road leading to it would suggest.",
      "Traveler notes here tend to matter more than formal signs."
    ],
    actionIds: ["read_the_board", "stretch_and_reset", "quiet_utility_refill", "take_in_the_view"],
    rumorPoolId: "camp_pullout_pool",
    approachVisual: "camp_pullout"
  },
  {
    id: "alder_meadow",
    name: "Alder Meadow",
    stopKind: "meadow",
    subtitle: "A broad meadow shoulder where the longer grade finally offers some room to breathe.",
    flavor:
      "Alder Meadow feels like the payoff for taking the easier grade: less urgency, more room, and a little less mountain in your face for an hour.",
    visitBudget: 2,
    quirkNotes: [
      "The meadow is kinder than the shelf road would have been.",
      "It is still a mountain stop, just a less pinched one."
    ],
    actionIds: ["take_in_the_view", "stretch_and_reset", "check_the_line", "ask_the_road"],
    actionOverrides: {
      ask_the_road: {
        label: "Ask About The Meadow Grade",
        description:
          "Listen for the small local note that says where the gentler road stays gentle and where it still turns mean."
      }
    },
    rumorPoolId: "camp_pullout_pool",
    approachVisual: "camp_pullout"
  }
];

export const authoredTravelObstacleTriggers = [
  {
    id: "rain_coast_sunset_wash",
    routePresetId: "rain_coast",
    segmentId: "mojave_yard_to_black_mesa_fork",
    landmarkStopId: "sunset_wash",
    progress: 0.58
  }
];

export const landmarkRumorPools = Object.freeze({
  wash_pool: ["wash_water_ahead", "wash_clear_run", "rough_road_ahead", "tricky_crossing_ahead"],
  creek_pool: ["wash_water_ahead", "creek_shade_tip", "easy_water_ahead", "scenic_slow_leg"],
  camp_pullout_pool: ["camp_clear_start", "camp_quiet_site_tip", "good_camp_ahead", "sparse_services_ahead"],
  pass_pool: ["pass_wind_warning", "pass_rough_grade", "strong_sun_ahead", "rough_road_ahead"],
  shelf_pool: ["shelf_scenic_pull", "shelf_careful_line", "scenic_slow_leg", "sparse_services_ahead"]
});

const TOWN_ADVICE_GROUPS = [
  {
    category: "practical",
    speakers: [
      "A clerk by the counter says",
      "Someone at the pump says",
      "A traveler with a paper cup says",
      "The store owner says",
      "A road worker says",
      "A woman by the spigot says"
    ],
    lines: [
      "Fill water where you can. Pride is lighter than a dry tank.",
      "You can make up miles. You cannot make up daylight.",
      "If the wind turns against you, let it win a little.",
      "Folks who rush at noon usually regret it by supper.",
      "A road that looks easy in the morning may still wear you thin by dusk.",
      "You do not save time by pretending the RV is younger than it is.",
      "Top off when it feels unnecessary. That is usually the right time.",
      "A quiet engine is worth listening to.",
      "The best stop is often the one before you start needing it.",
      "If everybody says the road is fine, ask when they were last on it.",
      "Keep one eye on the sky and the other on your temper.",
      "The sun can empty a good plan faster than a bad road can.",
      "If you find shade, treat it like luck.",
      "Out here, a cool morning can talk you into foolish distances.",
      "Take the easier hour when it offers itself.",
      "A hot day asks more of your water than your courage.",
      "If the rig starts sounding proud of itself, slow down.",
      "Never pass a spigot just because you feel optimistic.",
      "The map shows distance. It does not show mood.",
      "Long bright miles can be harder than rough short ones.",
      "Look for the next stop first. One good stretch at a time gets you there.",
      "Town helps most before trouble gets big. Stop while you still have choices.",
      "Save some cash for the road ahead. Spend it where it keeps the trip moving.",
      "When more than one worry shows up, slow down and fix what you can first.",
      "Leave room for a bad mile. The road is kinder when you are not already empty.",
      "Some roads want speed. Some roads want manners.",
      "Never laugh at a warning just because it rhymes.",
      "If you have a choice between pride and shade, take shade.",
      "Every route has an hour when it asks whether you meant it.",
      "A decent breakfast can carry a whole crew farther than optimism can.",
      "There is no trophy for arriving tired.",
      "A day that begins with sweeping usually ends better.",
      "Good shade, honest fuel, and level ground rarely travel together.",
      "If the gravel changes color, pay attention.",
      "People who say they do not need a checklist usually need two.",
      "The right speed is the one that leaves room for surprise.",
      "Plenty of people lose an afternoon trying to save ten minutes.",
      "There is nothing wrong with calling today good enough.",
      "A working fan can make saints of ordinary people.",
      "You do not really know your supplies until the second hot day.",
      "The longest mile is usually the one just before you decide to stop.",
      "The road is kinder to people who can change their minds early.",
      "Half the trip is learning what not to worry about."
    ]
  },
  {
    category: "weather",
    speakers: [
      "Someone checking the sky says",
      "A rancher in line says",
      "A woman on the porch says",
      "An old driver tells you",
      "A cashier glancing outside says"
    ],
    lines: [
      "High clouds at breakfast can mean strange light by supper.",
      "The sky tells on itself if you watch long enough.",
      "A blue morning can still turn mean by three.",
      "The road keeps its own weather.",
      "Mountain shade comes fast when it comes.",
      "If the wind smells cold before noon, trust it.",
      "Heat on the horizon makes liars of long views.",
      "The desert forgives less than the map does.",
      "Clouds that look decorative at noon may stop being decorative by evening.",
      "The first cool breath of day is usually not the last word.",
      "Some air feels harmless until you climb into it.",
      "A still afternoon can be the strangest kind.",
      "Rain that never reaches you still changes the road ahead.",
      "Evening light makes a lot of bad ideas look noble.",
      "When the sky goes pale and wide, save your strength.",
      "If the horizon looks polished, expect glare.",
      "A small town diner will tell you the weather twice if it likes you."
    ]
  },
  {
    category: "rv_life",
    speakers: [
      "A campground host says",
      "A mechanic wiping their hands says",
      "Someone at the laundry room says",
      "A tired father says",
      "A woman folding a map says"
    ],
    lines: [
      "Every old RV has a favorite complaint.",
      "Cabin rattles are only a problem when they stop.",
      "Someone always says they know a shortcut. Let them go first.",
      "The first day is for finding out what you forgot.",
      "Everybody packs one thing too many and two things too few.",
      "A clean mug in the sink means you are still doing all right.",
      "The road teaches people how much noise they make.",
      "You learn a lot about folks from how they close a cabinet.",
      "No trip starts with the right number of blankets.",
      "Every traveler has one drawer they should have fixed two states ago.",
      "A loose spoon can sound like the end of the world in a small cabin.",
      "Most road wisdom was invented after somebody ignored a smell.",
      "If the fridge holds, morale holds.",
      "It takes about three days to learn what not to put on the counter.",
      "A good campsite can improve a whole argument.",
      "A camp chair set out before sunset is a sign of wisdom.",
      "The best repairs are the ones no one has to describe dramatically.",
      "A road note scribbled in pencil is often the truest kind.",
      "Around here, folks trust whoever asks where the shade falls in the morning.",
      "If everyone in the cabin goes quiet at once, something is either beautiful or wrong.",
      "Most campsites improve after one good laugh.",
      "You can hear your own bad habits better on the road.",
      "Some stops are for supplies. Some are for becoming the sort of people who keep going."
    ]
  },
  {
    category: "roadside_people",
    speakers: [
      "A local near the diner says",
      "Someone by the ice chest says",
      "A cashier says",
      "A traveler in the shade says",
      "A woman with a coffee cup says",
      "A man in a dusty cap says"
    ],
    lines: [
      "Met a couple last spring who argued all the way to the coast and called it a perfect trip.",
      "Saw a man trading peaches for jumper cables two towns back.",
      "There was a woman here last week who swore her dog could smell bad fuel.",
      "A family rolled through yesterday singing like they had not seen trouble in years.",
      "Someone camped north of here said the stars looked close enough to accuse them.",
      "An old fellow at the pump said he only travels where the coffee tastes worried.",
      "Passed through a place once where everybody had a ladder tied to the roof for some reason.",
      "A boy in the next county tried to pay for ice with smooth stones. Nearly worked.",
      "There was a retired teacher here yesterday labeling her spice jars with a ruler.",
      "A man came by asking if anyone had seen a lawn chair with sentimental value.",
      "One traveler claimed he had been following the same pair of cranes for four days.",
      "A woman out west told me she plans every stop around pie and shade, in that order.",
      "Some brothers came through here playing cards with a map they did not trust.",
      "There was a grandmother here who packed three flashlights and forgot her shoes.",
      "A quiet couple left this morning before sunrise and took the peace with them.",
      "A man told me the coast starts in your lungs before it starts in the air.",
      "A cashier told me never to trust a beautiful road with no birds on it.",
      "I heard of a campground cat that only slept under well-maintained engines.",
      "An old woman in a visor once told me that bad coffee means you are close to weather.",
      "Roadside peaches improve in proportion to how dusty the stand looks.",
      "If a place sells postcards and fan belts, it knows what it is doing.",
      "Most strangers on the road are only two details away from becoming stories.",
      "You can tell a lot about a town by what it locks up.",
      "A place with faded bunting and cold soda usually has at least one good answer.",
      "The nicest people on the road are often carrying something awkward.",
      "A paper map makes even bad news feel respectable.",
      "Every trip has one stop that becomes bigger in memory than it ever was in life.",
      "Nobody remembers the exact mile marker, only the feeling of reaching it.",
      "A bent road sign can still be giving perfect advice.",
      "A place can be lonely and still feel full of witnesses."
    ]
  },
  {
    category: "rumor",
    speakers: [
      "Someone leaning on the rail says",
      "A park host says",
      "An old woman by the register says",
      "A driver watching the road says",
      "A quiet local says"
    ],
    lines: [
      "They say there is a stretch of road west of here where every song on the radio turns sad.",
      "I heard of a campground where nobody could remember why they had stopped.",
      "There is said to be a wash out there that steals more hats than tires.",
      "They say if your first sunset is red enough, the trip will ask for patience.",
      "Someone claimed the next town moves a little every year.",
      "I once heard of a park host who could predict trouble from the way a screen door shut.",
      "Some people say the best route is the one that leaves you enough daylight to forgive it.",
      "I was told there is a ridge out there where every traveler suddenly remembers an old apology.",
      "They say one of the service roads loops back on boastful people.",
      "There are folks who believe a tailwind on the first morning always asks for something later.",
      "There is a rumor that one of the desert pullouts improves every story told in it.",
      "The west is full of roads that seem personal until you meet the next car."
    ]
  },
  {
    category: "quiet_town",
    speakers: [
      "You look around",
      "For now",
      "The town square seems to say"
    ],
    lines: [
      "The place is quiet. Nobody looks interested in talking.",
      "No one seems to be lingering here just now.",
      "For the moment, everyone has somewhere else to be.",
      "You look around, but no one is in the mood for a chat.",
      "The town has gone briefly inward.",
      "There is no one to speak to right now."
    ]
  }
];

export const townAdviceOptions = buildTownAdviceOptions(TOWN_ADVICE_GROUPS);

export const routePresets = Object.freeze([V2_COASTAL_ROUTE_PRESET]);

export const townDefinitions = Object.freeze([
  ...legacyTownDefinitions,
  ...V2_TOWN_DEFINITIONS
]);

export const defaultSetupSelection = Object.freeze({
  routePresetId: V2_COASTAL_ROUTE_PRESET.id,
  passengerSetId: passengerSetPresets[0].id,
  startingConditionId: startingConditionPresets[1].id
});

export function getRoutePreset(routePresetId) {
  return routePresets[0];
}

export function getPassengerSet(passengerSetId) {
  return (
    passengerSetPresets.find((entry) => entry.id === passengerSetId) ?? passengerSetPresets[0]
  );
}

export function getStartingCondition(startingConditionId) {
  return (
    startingConditionPresets.find((entry) => entry.id === startingConditionId) ??
    startingConditionPresets[1]
  );
}

export function getDrivingStyleOption(drivingStyle) {
  return drivingStyleOptions.find((entry) => entry.id === drivingStyle) ?? drivingStyleOptions[1];
}

export function getTravelModeOption(travelMode) {
  return getDrivingStyleOption(travelMode);
}

export function getComfortPolicyOption(comfortPolicy) {
  const resolvedPolicy =
    comfortPolicy === COMFORT_POLICIES.INDULGENT
      ? COMFORT_POLICIES.COMFORTABLE
      : comfortPolicy;

  return (
    comfortPolicyOptions.find((entry) => entry.id === resolvedPolicy) ??
    comfortPolicyOptions[1]
  );
}

export function getSettingExplanation(settingId) {
  if (settingId === "travelMode") {
    const spec = settingExplanationSpecs.travelMode;

    return {
      id: "travelMode",
      displayName: spec.displayName,
      generalExplanation: spec.generalExplanation,
      closingLine: spec.closingLine,
      options: travelModeOptions.map((entry) => ({
        id: entry.id,
        label: entry.label,
        description: spec.optionDescriptions[entry.id] ?? entry.description
      }))
    };
  }

  if (settingId === "comfortPolicy") {
    const spec = settingExplanationSpecs.comfortPolicy;

    return {
      id: "comfortPolicy",
      displayName: spec.displayName,
      generalExplanation: spec.generalExplanation,
      closingLine: spec.closingLine,
      options: comfortPolicyOptions.map((entry) => ({
        id: entry.id,
        label: entry.label,
        description: spec.optionDescriptions[entry.id] ?? entry.summary
      }))
    };
  }

  return null;
}

export function getCampsiteOption(campsiteType) {
  return (
    campsiteOptions.find((entry) => entry.id === campsiteType) ?? campsiteOptions[0]
  );
}

const DEFAULT_CAMPSITE_RULES = Object.freeze({
  solarFactor: 0.85,
  waterDelta: 0,
  hookupSupport: 0,
  hookupCashDelta: 0,
  moraleDelta: 0,
  conditionDelta: 0,
  restQualityShift: 0,
  shelter: "mixed"
});

export function getCampsiteRules(campsiteType) {
  return {
    ...DEFAULT_CAMPSITE_RULES,
    ...(getCampsiteOption(campsiteType).rules ?? {})
  };
}

export function getCampsiteLabel(campsiteType) {
  return getCampsiteOption(campsiteType).label;
}

export function getAvailableCampsiteOptionsForLocation(locationType) {
  return campsiteOptions.filter((entry) => {
    const locationTypes = entry.availability?.locationTypes ?? [];
    return locationTypes.includes(locationType);
  });
}

export function listCampEveningActionDefinitions() {
  return [...campEveningActionDefinitions];
}

export function getCampEveningActionDefinition(actionId) {
  return campEveningActionDefinitions.find((entry) => entry.id === actionId) ?? null;
}

export function getCampRumorDefinition(rumorId) {
  return campRumorDefinitions.find((entry) => entry.id === rumorId) ?? null;
}

export function getCampRumorPool(locationType) {
  return campRumorPools[locationType] ?? [];
}

export function getTownActionOption(townActionId) {
  return (
    townActionOptions.find((entry) => entry.id === townActionId) ?? townActionOptions[0]
  );
}

export function getTownServiceDefinition(serviceId) {
  return townServiceDefinitions.find((entry) => entry.id === serviceId) ?? null;
}

export function getTownDefinition(townId) {
  return townDefinitions.find((entry) => entry.id === townId) ?? null;
}

export function getRouteChoiceDefinition(choiceId) {
  return routeChoiceDefinitions.find((entry) => entry.id === choiceId) ?? null;
}

export function getRouteChoiceDefinitionForRoutePoint(routePoint) {
  if (!routePoint || typeof routePoint !== "object") {
    return null;
  }

  return getRouteChoiceDefinition(routePoint.routeChoiceId);
}

export function getTownDefinitionForRoutePoint(routePoint) {
  if (!routePoint || typeof routePoint !== "object") {
    return null;
  }

  return getTownDefinition(routePoint.townId);
}

export function hasTownAtRoutePoint(routePoint) {
  return getTownDefinitionForRoutePoint(routePoint) !== null;
}

export function getTownRumorDefinition(rumorId) {
  return townRumorDefinitions.find((entry) => entry.id === rumorId) ?? null;
}

export function getTownRumorPool(poolId) {
  return townRumorPools[poolId] ?? [];
}

export function getLandmarkStopActionDefinition(actionId) {
  return landmarkStopActionDefinitions.find((entry) => entry.id === actionId) ?? null;
}

export function getLandmarkStopDefinition(stopId) {
  return landmarkStopDefinitions.find((entry) => entry.id === stopId) ?? null;
}

export function getAuthoredTravelObstacleForSegment(routePresetId, segmentId) {
  return (
    authoredTravelObstacleTriggers.find(
      (entry) => entry.routePresetId === routePresetId && entry.segmentId === segmentId
    ) ?? null
  );
}

export function getLandmarkStopDefinitionForRoutePoint(routePoint) {
  if (!routePoint || typeof routePoint !== "object") {
    return null;
  }

  return getLandmarkStopDefinition(routePoint.landmarkStopId);
}

export function hasLandmarkStopAtRoutePoint(routePoint) {
  return getLandmarkStopDefinitionForRoutePoint(routePoint) !== null;
}

export function getLandmarkRumorDefinition(rumorId) {
  return landmarkRumorDefinitions.find((entry) => entry.id === rumorId) ?? null;
}

export function getLandmarkRumorPool(poolId) {
  return landmarkRumorPools[poolId] ?? [];
}

export function getInteractiveRouteStopForRoutePoint(routePoint) {
  const routeChoice = getRouteChoiceDefinitionForRoutePoint(routePoint);

  if (routeChoice) {
    return {
      stopType: "route_choice",
      stopId: routeChoice.id,
      pointId: routePoint?.id ?? null,
      name: routeChoice.name,
      subtitle: routeChoice.subtitle,
      flavor: routeChoice.description,
      visitBudget: 1,
      approachVisual: routePoint?.approachVisual ?? null
    };
  }

  const town = getTownDefinitionForRoutePoint(routePoint);

  if (town) {
    return {
      stopType: "town",
      stopId: town.id,
      pointId: routePoint?.id ?? null,
      name: town.name,
      subtitle: town.subtitle,
      flavor: town.flavor,
      visitBudget: town.visitBudget,
      approachVisual: routePoint?.approachVisual ?? town.approachVisual ?? "town"
    };
  }

  const landmarkStop = getLandmarkStopDefinitionForRoutePoint(routePoint);

  if (landmarkStop) {
    return {
      stopType: "landmark",
      stopId: landmarkStop.id,
      pointId: routePoint?.id ?? null,
      name: landmarkStop.name,
      subtitle: landmarkStop.subtitle,
      flavor: landmarkStop.flavor,
      visitBudget: landmarkStop.visitBudget,
      approachVisual: routePoint?.approachVisual ?? landmarkStop.approachVisual ?? null
    };
  }

  return null;
}

export function getTownAdviceOption(adviceId) {
  return townAdviceOptions.find((entry) => entry.id === adviceId) ?? townAdviceOptions[0];
}

function buildTownAdviceOptions(groups) {
  return groups.flatMap((group) =>
    group.lines.map((entry, index) => {
      const advice = typeof entry === "string" ? entry : entry.advice;
      const contextTags =
        typeof entry === "string"
          ? [group.category]
          : Array.isArray(entry.contextTags) && entry.contextTags.length > 0
            ? entry.contextTags
            : [group.category];

      return {
        id: `${group.category}_${String(index + 1).padStart(2, "0")}`,
        category: group.category,
        contextTags,
        speaker: `${group.speakers[index % group.speakers.length]}:`,
        advice
      };
    })
  );
}

export function getWeatherAtDay(routeOrId, dayNumber) {
  const route = typeof routeOrId === "string" ? getRoutePreset(routeOrId) : routeOrId;

  if (!Array.isArray(route.weatherDeck) || route.weatherDeck.length === 0) {
    return normalizeWeatherEntry({
      label: "mild",
      sunlightFactor: 1,
      forecast: "No sky note yet."
    });
  }

  return normalizeWeatherEntry(route.weatherDeck[(Math.max(1, dayNumber) - 1) % route.weatherDeck.length]);
}

export function buildForecastDeck(routeOrId, dayNumber) {
  const route = typeof routeOrId === "string" ? getRoutePreset(routeOrId) : routeOrId;

  return [1, 2]
    .map((offset) => getWeatherAtDay(route, dayNumber + offset))
    .filter(Boolean)
    .map((entry) => ({
      label: entry.label,
      forecast: entry.forecast,
      sunlightFactor: entry.sunlightFactor,
      weatherType: entry.weatherType,
      solarOutlook: entry.solarOutlook,
      severity: entry.severity,
      travelMode: entry.travelMode,
      stayMood: entry.stayMood,
      disruptionRisk: entry.disruptionRisk
    }));
}

function normalizeWeatherEntry(entry = {}) {
  const sunlightFactor = clampNumber(entry.sunlightFactor, 0.35, 1.15, 1);
  const weatherType = typeof entry.weatherType === "string" ? entry.weatherType : inferWeatherType(sunlightFactor);
  const severity = typeof entry.severity === "string" ? entry.severity : inferWeatherSeverity(weatherType);
  const solarOutlook =
    typeof entry.solarOutlook === "string" ? entry.solarOutlook : inferSolarOutlook(sunlightFactor, weatherType);

  return {
    label: typeof entry.label === "string" ? entry.label : "Mild coastal weather",
    sunlightFactor,
    forecast: typeof entry.forecast === "string" ? entry.forecast : "No sky note yet.",
    weatherType,
    severity,
    solarOutlook,
    travelMode:
      typeof entry.travelMode === "string"
        ? entry.travelMode
        : severity === "severe"
          ? "delayed"
          : severity === "rough"
            ? "slowed"
            : "steady",
    stayMood:
      typeof entry.stayMood === "string"
        ? entry.stayMood
        : weatherType === "clear"
          ? "open"
          : weatherType === "storm"
            ? "exposed"
            : "mixed",
    disruptionRisk: clampNumber(entry.disruptionRisk, 0, 1, severity === "severe" ? 0.35 : 0.08),
    travelNote:
      typeof entry.travelNote === "string"
        ? entry.travelNote
        : buildDefaultTravelNote(weatherType, solarOutlook),
    stayNote:
      typeof entry.stayNote === "string"
        ? entry.stayNote
        : buildDefaultStayNote(weatherType, solarOutlook)
  };
}

function inferWeatherType(sunlightFactor) {
  if (sunlightFactor >= 0.98) {
    return "clear";
  }
  if (sunlightFactor >= 0.84) {
    return "marine_clouds";
  }
  if (sunlightFactor >= 0.72) {
    return "overcast";
  }
  if (sunlightFactor >= 0.58) {
    return "rain";
  }
  return "storm";
}

function inferWeatherSeverity(weatherType) {
  if (weatherType === "storm") {
    return "severe";
  }
  if (weatherType === "rain" || weatherType === "overcast") {
    return "rough";
  }
  return "normal";
}

function inferSolarOutlook(sunlightFactor, weatherType) {
  if (weatherType === "storm" || sunlightFactor <= 0.62) {
    return "Weak";
  }
  if (sunlightFactor >= 0.94 && weatherType === "clear") {
    return "Strong";
  }
  return "Fair";
}

function buildDefaultTravelNote(weatherType, solarOutlook) {
  if (weatherType === "clear") {
    return "Clear skies kept the road readable and the panels working well.";
  }
  if (weatherType === "marine_clouds") {
    return "Marine clouds softened the day without fully stealing the charge.";
  }
  if (weatherType === "overcast") {
    return "Flat gray light kept the day moving, but it dulled the panels.";
  }
  if (weatherType === "rain") {
    return "Rain slowed the rhythm and cut charging into the weaker range.";
  }
  if (weatherType === "storm") {
    return "Storm weather forced a more careful day and left solar recovery thin.";
  }

  return `Solar outlook stayed ${solarOutlook.toLowerCase()} while the road held steady.`;
}

function buildDefaultStayNote(weatherType, solarOutlook) {
  if (weatherType === "clear") {
    return "Clear skies should help this stop feel open and productive.";
  }
  if (weatherType === "marine_clouds") {
    return "Low cloud cover may blunt charging until the air opens up.";
  }
  if (weatherType === "overcast") {
    return "The place may feel flatter tonight, with only fair panel recovery.";
  }
  if (weatherType === "rain") {
    return "Wet weather reduces comfort and makes utility support matter more.";
  }
  if (weatherType === "storm") {
    return "Storm conditions make shelter count and can turn a weak site into a hard one.";
  }

  return `Solar outlook is ${solarOutlook.toLowerCase()} for this stop.`;
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, numeric));
}

export function buildPendingEvents(routeOrId, dayNumber) {
  const route = typeof routeOrId === "string" ? getRoutePreset(routeOrId) : routeOrId;

  if (!Array.isArray(route.eventDeck) || route.eventDeck.length === 0) {
    return [];
  }

  return [0, 1]
    .map((offset) => route.eventDeck[(Math.max(1, dayNumber) - 1 + offset) % route.eventDeck.length])
    .filter(Boolean)
    .map((entry) => structuredClone(entry));
}
