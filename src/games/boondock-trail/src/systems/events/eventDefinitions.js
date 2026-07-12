import {
  CAMPSITE_TYPES,
  COMFORT_POLICIES,
  DAY_PHASES,
  TRAVEL_MODES,
  WARNING_FLAGS
} from "../../constants/gameConstants.js";
import { travelInterruptionExpansionEvents } from "./travelInterruptionExpansionEvents.js";

const rawEventDefinitions = [
  {
    id: "quiet_dawn_reset",
    title: "Soft Morning",
    bodyText:
      "The morning comes on softly, the kettle works, and nobody begins the day in a bad mood.",
    category: "recovery",
    artFamily: "easy_road",
    phase: DAY_PHASES.MORNING_REVIEW,
    type: "automatic",
    weight: 3,
    triggerConditions: {
      minDay: 2,
      batteryPercentMin: 25,
      recoveryMomentumMin: 1
    },
    effects: {
      resources: {
        passengerMorale: 3
      }
    },
    audioTone: "success",
    resultText: "A calm morning helped everyone settle before the drive.",
    resolvedBodyText:
      "The morning starts with warm mugs and a little less edge in the cabin. By the time the RV is ready to move, everyone feels more like a team again."
  },
  {
    id: "breakfast_tension",
    title: "Hard Breakfast",
    bodyText:
      "The cabin feels too small after a rough night. Someone asks if today has to feel this hard as well.",
    category: "morale",
    artFamily: "ominous_road",
    phase: DAY_PHASES.MORNING_REVIEW,
    type: "choice",
    weight: 3,
    triggerConditions: {
      minDay: 2,
      pressureScoreMin: 3
    },
    choices: [
      {
        id: "promise_relief",
        label: "Promise An Easier Night",
        resultText: "You promise that tonight will feel easier than this.",
        resolvedBodyText:
          "You answer gently and promise a softer stop tonight. The promise steadies the table, and people carry that hope into the day.",
        effects: {
          resources: {
            passengerMorale: 2
          },
          policies: {
            comfortPolicy: COMFORT_POLICIES.COMFORTABLE
          }
        },
        audioTone: "success"
      },
      {
        id: "hold_the_line",
        label: "Keep Today Lean",
        resultText: "You keep the day lean, and things feel a little tighter.",
        resolvedBodyText:
          "You keep breakfast brief and the plan lean. Nobody argues, but the cabin stays tight and a little sore.",
        effects: {
          resources: {
            passengerMorale: -2
          }
        },
        audioTone: "bad_fail"
      }
    ]
  },
  {
    id: "service_bay_tip",
    title: "Loose Step",
    bodyText:
      "A mechanic hears the RV steps rattle and says they sound a little loose.",
    category: "rv_condition",
    artFamily: "roadside_encounter",
    phase: DAY_PHASES.MORNING_REVIEW,
    type: "choice",
    weight: 2,
    triggerConditions: {
      minDay: 2,
      conditionMax: 65
    },
    choices: [
      {
        id: "pay_for_quick_tighten",
        label: "Tighten It Now",
        resultText: "It costs a little now, but the step feels safer after that.",
        resolvedBodyText:
          "The mechanic puts a wrench on the steps, gives them a quick tighten, and sends you on your way. It is a small stop, but the RV feels a little more trustworthy afterward.",
        effects: {
          resources: {
            cash: -18,
            rvCondition: 6
          }
        },
        audioTone: "success"
      },
      {
        id: "wave_and_go",
        label: "Say Thanks And Go",
        resultText: "You trust the RV for one more day.",
        resolvedBodyText:
          "You thank them, close the door, and decide to trust the rig a little longer. The loose sound stays with you as the day gets going.",
        effects: {
          resources: {
            rvCondition: -1
          }
        },
        audioTone: "bad_fail"
      }
    ]
  },
  {
    id: "bad_sleep_rider",
    title: "Bad Sleep",
    bodyText:
      "Someone comes to breakfast with tired eyes and says the night kept waking them up.",
    category: "morale",
    artFamily: "roadside_encounter",
    presentation: "human_trouble",
    phase: DAY_PHASES.MORNING_REVIEW,
    type: "choice",
    weight: 3,
    triggerConditions: {
      minDay: 2,
      poorRestStreakMin: 1
    },
    choices: [
      {
        id: "promise_softer_camp",
        label: "Promise A Softer Night",
        resultText: "You promise to give tonight more care.",
        resolvedBodyText:
          "You hear the tiredness in their voice and promise to make tonight easier if you can. It does not fix the lost sleep, but it helps them feel less alone with it.",
        effects: {
          resources: {
            passengerMorale: 2
          },
          policies: {
            comfortPolicy: COMFORT_POLICIES.COMFORTABLE
          }
        },
        audioTone: "success"
      },
      {
        id: "keep_the_morning_moving",
        label: "Keep The Morning Moving",
        resultText: "You keep the morning short, and the tired mood lingers.",
        resolvedBodyText:
          "You keep the morning moving because the road still needs miles. The tiredness stays in the cabin and makes the first stretch feel longer.",
        effects: {
          resources: {
            passengerMorale: -2
          }
        },
        audioTone: "bad_fail"
      }
    ]
  },
  {
    id: "weather_board_warning",
    title: "Cloud Warning",
    bodyText:
      "The roadside board says clouds may hang on into tomorrow. That matters when the battery is already on your mind.",
    category: "energy",
    artFamily: "ominous_road",
    phase: DAY_PHASES.MORNING_REVIEW,
    type: "choice",
    weight: 3,
    triggerConditions: {
      minDay: 2,
      forecastSunlightMax: 0.75
    },
    choices: [
      {
        id: "lean_conservative",
        label: "Play It Safe",
        resultText: "You save a little for tomorrow, even if today feels tighter.",
        resolvedBodyText:
          "You take the warning seriously and ask less of the day. It feels cautious, but it gives tomorrow more room.",
        effects: {
          policies: {
            travelMode: TRAVEL_MODES.SOLAR_FIRST,
            comfortPolicy: COMFORT_POLICIES.FRUGAL
          },
          resources: {
            passengerMorale: -1
          }
        },
        audioTone: "neutral"
      },
      {
        id: "stick_to_plan",
        label: "Keep The Plan",
        resultText: "You read the sky note and keep the plan as it is.",
        resolvedBodyText:
          "You read the board, look at the sky, and decide not to let one warning steer the whole day. The plan holds.",
        effects: {},
        audioTone: "neutral"
      }
    ]
  },
  {
    id: "road_work_bottleneck",
    title: "Road Work",
    bodyText:
      "Fresh cones and flaggers turn the open road into a long, slow wait.",
    category: "travel",
    artFamily: "rough_road",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    type: "automatic",
    weight: 4,
    triggerConditions: {},
    effects: {
      journey: {
        milesTraveled: -8
      },
      resources: {
        fuel: -1
      }
    },
    audioTone: "bad_fail",
    resultText: "The delay costs a little road and wears on the day.",
    resolvedBodyText:
      "You idle through the one-lane stretch and watch a good piece of the day burn off in place. When the road finally opens, it already feels later than it should."
  },
  {
    id: "scenic_turnout",
    title: "Scenic Turnout",
    bodyText:
      "The road opens onto a long valley, and everyone feels the tug to stop for a minute.",
    category: "travel",
    artFamily: "easy_road",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    type: "choice",
    weight: 2,
    triggerConditions: {
      minDay: 2
    },
    choices: [
      {
        id: "pull_over",
        label: "Pull Over",
        resultText: "The stop costs a few miles, but it lightens the cabin.",
        resolvedBodyText:
          "You ease into the turnout, stretch your legs, and let the valley do its quiet work. When you pull back out, the road feels a little less close and everyone sits easier.",
        effects: {
          journey: {
            milesTraveled: -6
          },
          resources: {
            passengerMorale: 4
          }
        },
        audioTone: "success"
      },
      {
        id: "keep_rolling",
        label: "Keep Driving",
        resultText: "You keep the wheels turning and leave the view behind.",
        resolvedBodyText:
          "You give the view a glance and keep both hands on the wheel. The turnout slips behind you, and the cabin stays a little quieter than it was before.",
        effects: {},
        audioTone: "neutral"
      }
    ]
  },
  {
    id: "washboard_rattle",
    title: "Rough Road",
    bodyText:
      "The washboard stretch chatters through the cabinets and shakes every loose thing twice.",
    category: "rv_condition",
    artFamily: "rough_road",
    showPrompt: true,
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    type: "automatic",
    weight: 3,
    triggerConditions: {
      conditionMax: 85
    },
    effects: {
      resources: {
        rvCondition: -4
      }
    },
    audioTone: "bad_fail",
    resultText: "The rough stretch takes a little more out of the RV.",
    resolvedBodyText:
      "Nothing breaks outright, but the RV comes out of the stretch feeling older. By the time the road smooths again, the whole rig sounds tired."
  },
  {
    id: "panel_rinse_pullout",
    title: "Dusty Panels",
    bodyText:
      "A roadside hose appears just when the roof panels are wearing a skin of dust.",
    category: "energy",
    artFamily: "dusty_road",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    type: "choice",
    weight: 3,
    triggerConditions: {
      batteryPercentMax: 60,
      sunlightMin: 0.9
    },
    choices: [
      {
        id: "rinse_panels",
        label: "Rinse The Panels",
        resultText: "You lose a little road and give the roof a fairer chance.",
        resolvedBodyText:
          "You pull in, climb up, and rinse the grit away while the light is still worth catching. The stop takes a little road time, but the roof finally gets to do its job again.",
        effects: {
          journey: {
            milesTraveled: -4
          },
          resources: {
            batteryCharge: 3
          }
        },
        audioTone: "success"
      },
      {
        id: "stay_on_the_road",
        label: "Keep Driving",
        resultText: "You stay on the road and let the dusty panels do what they can.",
        resolvedBodyText:
          "You keep rolling and leave the dust where it is. The panels still work, just not as cleanly as they might have.",
        effects: {},
        audioTone: "neutral"
      }
    ]
  },
  {
    id: "headwind_crossing",
    title: "Headwind",
    bodyText:
      "A hard headwind leans on the RV and makes even the easy miles feel stubborn.",
    category: "energy",
    artFamily: "dusty_road",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    type: "automatic",
    weight: 3,
    triggerConditions: {
      sunlightMax: 0.75
    },
    effects: {
      journey: {
        milesTraveled: -6
      },
      resources: {
        fuel: -1,
        batteryCharge: -2
      }
    },
    audioTone: "bad_fail",
    resultText: "The wind costs miles and pulls a little more from the day.",
    resolvedBodyText:
      "The wind stays on you mile after mile, and the whole day feels heavier for it. You still make progress, but it costs more than the road seems worth."
  },
  {
    id: "free_water_spigot",
    title: "Free Water",
    bodyText:
      "A county yard still has a hose set out. The turn-in is ugly, but the water is real.",
    category: "recovery",
    artFamily: "roadside_encounter",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    type: "choice",
    weight: 3,
    triggerConditions: {
      waterPercentMax: 60
    },
    choices: [
      {
        id: "take_the_fill",
        label: "Fill Water",
        resultText: "You trade a little time and wear for a fuller tank.",
        resolvedBodyText:
          "You make the rough turn, drag the hose over, and take the fill while it is there to take. It is not a graceful stop, but the fuller tank feels worth the trouble.",
        effects: {
          journey: {
            milesTraveled: -4
          },
          resources: {
            water: 10,
            rvCondition: -1
          }
        },
        audioTone: "neutral"
      },
      {
        id: "pass_the_turn",
        label: "Keep Going",
        resultText: "You pass it by and hope the next stop is kinder.",
        resolvedBodyText:
          "You look at the yard, judge the turn-in, and keep going. The thought of that free water rides along with you for a while.",
        effects: {},
        audioTone: "neutral"
      }
    ]
  },
  {
    id: "heat_sick_rider",
    title: "Heat-Sick Rider",
    bodyText:
      "The cabin gets too warm, and someone in the back goes quiet and pale.",
    category: "morale",
    artFamily: "roadside_encounter",
    showPrompt: true,
    presentation: "human_trouble",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    type: "choice",
    weight: 3,
    triggerConditions: {
      minDay: 2,
      sunlightMin: 0.9,
      comfortPolicies: [COMFORT_POLICIES.FRUGAL, COMFORT_POLICIES.BALANCED]
    },
    choices: [
      {
        id: "stop_for_air_and_water",
        label: "Stop For Air And Water",
        resultText: "You lose a few miles, but the rider steadies.",
        resolvedBodyText:
          "You pull over, open the door, and pass around water until the color comes back. The stop costs daylight, but the whole cabin breathes easier afterward.",
        effects: {
          journey: {
            milesTraveled: -5
          },
          resources: {
            water: -2,
            passengerMorale: 2
          }
        },
        audioTone: "success"
      },
      {
        id: "keep_rolling_gently",
        label: "Keep Rolling Gently",
        resultText: "You keep moving, and the worry stays in the RV.",
        resolvedBodyText:
          "You ease the pace but keep the wheels moving. No one says much after that, and the worry stays in the sound of the road.",
        effects: {
          journey: {
            milesTraveled: -2
          },
          resources: {
            passengerMorale: -4
          }
        },
        audioTone: "bad_fail"
      }
    ]
  },
  {
    id: "roadside_pie_sign",
    title: "Pie Sign",
    bodyText:
      "A hand-painted pie sign appears at exactly the wrong time to be tempting.",
    category: "morale",
    artFamily: "roadside_encounter",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    type: "choice",
    weight: 2,
    triggerConditions: {
      cashMin: 12,
      pressureScoreMin: 2
    },
    choices: [
      {
        id: "buy_the_slice",
        label: "Buy Pie",
        resultText: "It costs cash, but it lifts the whole mood.",
        resolvedBodyText:
          "You give in, pull over, and come back with pie, coffee, and a little laughter. It is not a necessary stop, but the whole RV feels lighter for it.",
        effects: {
          resources: {
            cash: -8,
            passengerMorale: 5,
            water: 1
          }
        },
        audioTone: "success"
      },
      {
        id: "keep_the_budget",
        label: "Save The Cash",
        resultText: "You save the cash and leave the pie behind.",
        resolvedBodyText:
          "You keep the budget ahead of the craving and roll on past the sign. No one makes a scene, but the loss is felt anyway.",
        effects: {
          resources: {
            passengerMorale: -1
          }
        },
        audioTone: "bad_fail"
      }
    ]
  },
  {
    id: "tailwind_window",
    title: "Tailwind",
    bodyText:
      "For once, the wind falls in behind you instead of leaning on the nose of the RV.",
    category: "travel",
    artFamily: "tailwind_road",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    type: "automatic",
    weight: 2,
    triggerConditions: {
      sunlightMin: 0.95
    },
    effects: {
      journey: {
        milesTraveled: 8
      },
      resources: {
        fuel: 1
      }
    },
    audioTone: "success",
    resultText: "The good wind gives you a few easy miles and saves a little fuel.",
    resolvedBodyText:
      "For a while the RV seems to glide instead of push. The road opens up, the miles come easier, and the gauges do not fall as fast as usual."
  },
  ...travelInterruptionExpansionEvents,
  {
    id: "sunny_ridge_pad",
    title: "Sunny Ridge",
    bodyText:
      "A ranger mentions a bare ridge pullout with clear sky and almost no shelter.",
    category: "energy",
    artFamily: "easy_road",
    phase: DAY_PHASES.CAMP_DECISION,
    type: "choice",
    weight: 3,
    triggerConditions: {
      batteryPercentMax: 55,
      overnightLocationTypes: ["roadside", "scenic_pullout"]
    },
    choices: [
      {
        id: "claim_ridge_pad",
        label: "Take The Ridge",
        resultText: "You trade a little ease for better charging.",
        resolvedBodyText:
          "You take the bare ridge and give the panels the cleanest sky you can find. It is windier and less pleasant up there, but the roof has room to work.",
        effects: {
          policies: {
            selectedCampsiteType: CAMPSITE_TYPES.OPEN_SUN
          },
          resources: {
            passengerMorale: -1
          }
        },
        audioTone: "neutral"
      },
      {
        id: "keep_looking",
        label: "Keep Looking",
        resultText: "You keep looking and hope the next site feels better than this one.",
        resolvedBodyText:
          "You leave the ridge behind and keep hunting for a place that feels kinder. It may cost you the better sun, but the search feels worth it.",
        effects: {},
        audioTone: "neutral"
      }
    ]
  },
  {
    id: "small_camp_cut",
    title: "Small Cut",
    bodyText:
      "While setting up camp, someone catches their hand on a sharp latch.",
    category: "morale",
    artFamily: "roadside_encounter",
    presentation: "human_trouble",
    phase: DAY_PHASES.CAMP_DECISION,
    type: "choice",
    weight: 2,
    triggerConditions: {
      minDay: 2
    },
    choices: [
      {
        id: "stop_and_clean_it",
        label: "Stop And Clean It",
        resultText: "You spend a little water and settle everyone down.",
        resolvedBodyText:
          "You stop the setup, clean the cut, and wait until everyone has taken a breath. It is small trouble, but it is handled like it matters.",
        effects: {
          resources: {
            water: -1,
            passengerMorale: 1
          }
        },
        audioTone: "success"
      },
      {
        id: "rush_the_rest",
        label: "Rush The Rest",
        resultText: "You hurry through camp, and the mood frays.",
        resolvedBodyText:
          "You patch it quickly and hurry the rest of camp. The job gets done, but the cabin feels sharper for a while.",
        effects: {
          resources: {
            passengerMorale: -2
          }
        },
        audioTone: "bad_fail"
      }
    ]
  },
  {
    id: "fairgrounds_discount_hookup",
    title: "Cheap Plug-In",
    bodyText:
      "The fairgrounds board says one plug-in spot is cheaper tonight because the water post is fussy, not broken.",
    category: "recovery",
    artFamily: "roadside_encounter",
    phase: DAY_PHASES.CAMP_DECISION,
    type: "choice",
    weight: 3,
    triggerConditions: {
      warningsAny: [WARNING_FLAGS.HOOKUP_RECOMMENDED],
      overnightLocationTypes: ["campground", "service_edge"]
    },
    choices: [
      {
        id: "take_discount_slot",
        label: "Take The Cheap Plug-In",
        resultText: "You take the plug-in and get a cheaper, steadier night.",
        resolvedBodyText:
          "You take the cheaper spot, fussy water post and all, and the campsite still gives you the help you needed. By evening it feels like a good bargain.",
        effects: {
          policies: {
            selectedCampsiteType: CAMPSITE_TYPES.PAID_HOOKUP
          },
          resources: {
            cash: 8
          }
        },
        audioTone: "success"
      },
      {
        id: "stay_off_grid",
        label: "Skip The Plug-In",
        resultText: "You keep the cash, but the worry stays with you.",
        resolvedBodyText:
          "You read the board, keep your cash, and decide to make do without the plug-in. The worry stays in the back of your mind as camp settles.",
        effects: {},
        audioTone: "neutral"
      }
    ]
  },
  {
    id: "cottonwood_shade",
    title: "Cottonwood Shade",
    bodyText:
      "A stand of cottonwoods gives real relief from the heat, but cuts off the sky.",
    category: "morale",
    artFamily: "easy_road",
    phase: DAY_PHASES.CAMP_DECISION,
    type: "choice",
    weight: 2,
    triggerConditions: {
      sunlightMin: 0.9,
      recentPushMilesDaysMin: 1,
      overnightLocationTypes: ["campground", "roadside", "scenic_pullout"]
    },
    choices: [
      {
        id: "take_deep_shade",
        label: "Take The Shade",
        resultText: "People will sleep better, even if the battery does not.",
        resolvedBodyText:
          "You tuck the RV under the cottonwoods and feel the heat leave the cabin a little at a time. The shade costs you sky, but people finally get a cooler place to rest.",
        effects: {
          policies: {
            selectedCampsiteType: CAMPSITE_TYPES.FULL_SHADE
          },
          resources: {
            passengerMorale: 2
          }
        },
        audioTone: "success"
      },
      {
        id: "keep_the_solar_window",
        label: "Keep The Sun",
        resultText: "You stay in the sun and accept a warmer evening.",
        resolvedBodyText:
          "You stay where the roof can drink in the last of the light and accept the heat that comes with it. The battery benefits more than the cabin does.",
        effects: {
          policies: {
            selectedCampsiteType: CAMPSITE_TYPES.OPEN_SUN
          }
        },
        audioTone: "neutral"
      }
    ]
  },
  {
    id: "gravel_pad_with_view",
    title: "Quiet Gravel Spot",
    bodyText:
      "The next pullout is level, quiet, and open to a long view of the water.",
    category: "recovery",
    artFamily: "easy_road",
    phase: DAY_PHASES.CAMP_DECISION,
    type: "automatic",
    weight: 2,
    triggerConditions: {
      minDay: 2,
      recoveryMomentumMin: 1,
      overnightLocationTypes: ["roadside", "scenic_pullout"]
    },
    effects: {
      resources: {
        passengerMorale: 2
      }
    },
    audioTone: "success",
    resultText: "A good site and a good view took some strain out of the day.",
    resolvedBodyText:
      "The gravel is level, the air is quiet, and the long view gives everyone something wider to look at than the inside of the RV. By supper, some of the day's strain has eased."
  },
  {
    id: "phantom_inverter_light",
    title: "Stray Light",
    bodyText:
      "Something in the cabin stays on all night and quietly drains the battery.",
    category: "energy",
    artFamily: "ominous_road",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    type: "automatic",
    weight: 3,
    triggerConditions: {
      batteryPercentMax: 40,
      comfortPolicies: [COMFORT_POLICIES.COMFORTABLE, COMFORT_POLICIES.INDULGENT]
    },
    effects: {
      resources: {
        batteryCharge: -3
      }
    },
    audioTone: "bad_fail",
    resultText: "Something small used more battery than you wanted.",
    resolvedBodyText:
      "Sometime in the night, a small light or hidden draw keeps sipping power while everyone sleeps. Morning comes with less charge than you expected and no easy way to blame just one thing."
  },
  {
    id: "too_tired_to_help",
    title: "Too Tired",
    bodyText:
      "By morning, someone is too worn out to help much with the usual chores.",
    category: "morale",
    artFamily: "roadside_encounter",
    presentation: "human_trouble",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    type: "automatic",
    weight: 3,
    triggerConditions: {
      minDay: 2,
      pressureScoreMin: 4
    },
    effects: {
      resources: {
        passengerMorale: -3
      }
    },
    audioTone: "bad_fail",
    resultText: "The morning starts slower, and everyone feels worn down.",
    resolvedBodyText:
      "The chores still get done, but they take longer with one person quiet and worn down. The RV starts the day late, and the cabin feels thinner than it did yesterday."
  },
  {
    id: "marine_layer_lingers",
    title: "Lingering Clouds",
    bodyText:
      "The clouds stay longer than promised, so the morning charge comes in weak.",
    category: "energy",
    artFamily: "ominous_road",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    type: "automatic",
    weight: 3,
    triggerConditions: {
      warningsAny: [WARNING_FLAGS.POOR_CHARGING_CONDITIONS]
    },
    effects: {
      resources: {
        batteryCharge: -2
      }
    },
    audioTone: "bad_fail",
    resultText: "The weak light leaves the morning battery lower.",
    resolvedBodyText:
      "By dawn the roof is still under a dull blanket of cloud, and the first good charge never quite arrives. The morning feels slower because the battery starts lower than you hoped."
  },
  {
    id: "quiet_card_game",
    title: "Card Game",
    bodyText:
      "The night settles down. Someone finds a deck of cards, and the cabin finally loosens up.",
    category: "morale",
    artFamily: "easy_road",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    type: "automatic",
    weight: 2,
    triggerConditions: {
      minDay: 2
    },
    effects: {
      resources: {
        passengerMorale: 3
      }
    },
    audioTone: "success",
    resultText: "A quiet evening lifts the mood without costing much.",
    resolvedBodyText:
      "A deck of cards appears, rules are bent as needed, and the cabin finally sounds more like teasing than strain. The night passes lightly, and that matters."
  },
  {
    id: "camp_host_extension",
    title: "Extra Plug-In Time",
    bodyText:
      "The camp host says you can pay a little more for extra power and water tonight.",
    category: "recovery",
    artFamily: "roadside_encounter",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    type: "choice",
    weight: 2,
    triggerConditions: {
      campsiteTypes: [CAMPSITE_TYPES.PAID_HOOKUP],
      overnightLocationTypes: ["campground", "service_edge"]
    },
    choices: [
      {
        id: "buy_more_stability",
        label: "Buy More Time",
        resultText: "You spend a little more, and morning looks steadier for it.",
        resolvedBodyText:
          "You pay for the extra time and let the plug-in do more work overnight. Morning looks steadier because you spent the money early.",
        effects: {
          resources: {
            cash: -6,
            batteryCharge: 5,
            water: 4
          }
        },
        audioTone: "success"
      },
      {
        id: "leave_it_basic",
        label: "Keep It Simple",
        resultText: "You keep the simple plug-in and save the rest of the cash.",
        resolvedBodyText:
          "You thank the host and stick with the regular stay. You keep more cash, even if the night gives you less help.",
        effects: {},
        audioTone: "neutral"
      }
    ]
  },
  {
    id: "hose_clamp_drip",
    title: "Hose Drip",
    bodyText:
      "Somewhere in the dark, a hose clamp starts to drip.",
    category: "rv_condition",
    artFamily: "ominous_road",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    type: "automatic",
    weight: 2,
    triggerConditions: {
      conditionMax: 70
    },
    effects: {
      resources: {
        water: -4,
        rvCondition: -2
      }
    },
    audioTone: "bad_fail",
    resultText: "A small leak costs water and shows the RV's age.",
    resolvedBodyText:
      "The drip is small enough to miss in the dark, but not small enough to do no harm. By morning there is less water on board and one more reminder that the RV has seen some miles."
  }
];

function flavorEvent({
  id,
  title,
  phase,
  category = "morale",
  tone = "mundane-weird",
  impact = "none",
  bodyText,
  resultText,
  resolvedBodyText,
  effects = {},
  choices = null,
  weight = 2,
  triggerConditions = {}
}) {
  return {
    id,
    title,
    bodyText,
    category,
    artFamily: tone === "uncanny" ? "ominous_road" : tone === "absurd" ? "neutral_something" : "roadside_encounter",
    phase,
    type: Array.isArray(choices) ? "choice" : "automatic",
    weight,
    triggerConditions,
    effects,
    choices,
    tags: {
      tone,
      impact
    },
    audioTone: impact === "minor" ? "neutral" : "neutral",
    resultText,
    resolvedBodyText
  };
}

const flavorEventDefinitions = [
  flavorEvent({
    id: "exit_17_spoon_museum",
    title: "Spoon Museum Sign",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "absurd",
    bodyText: "A hand-painted sign insists the World's Third-Largest Spoon Museum is only nine miles off route. A smaller sign underneath says, \"Closed Tuesdays and emotionally.\"",
    resultText: "The spoon museum remains a mystery.",
    resolvedBodyText: "Nobody can decide whether the sign was advertising a museum, a warning, or a private joke. The RV keeps moving, and the conversation lasts longer than the sign did."
  }),
  flavorEvent({
    id: "rest_area_vending_prophecy",
    title: "Vending Machine Advice",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "uncanny",
    bodyText: "At a rest area, a vending machine displays only the words TAKE THE LONG WAY. It still refuses to sell pretzels.",
    resultText: "The machine keeps its own counsel.",
    resolvedBodyText: "You do not take advice from snack equipment, at least not officially. Still, the message rides in the cabin for a few miles."
  }),
  flavorEvent({
    id: "traffic_cone_convention",
    title: "Cone Convention",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "absurd",
    bodyText: "A roadside lot is filled with traffic cones arranged in neat rows, as if waiting for a keynote speaker. No people are visible.",
    resultText: "The cone convention passes without incident.",
    resolvedBodyText: "The cones remain orderly and unreadable. You leave them to their agenda."
  }),
  flavorEvent({
    id: "billboard_apologizes",
    title: "Apologetic Billboard",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "A billboard says SORRY ABOUT THE LAST TEN MILES. Under it, someone has painted SAME.",
    resultText: "The road apologizes, sort of.",
    resolvedBodyText: "The apology does not fix the pavement, but it does make everyone laugh once. Sometimes that is the whole gift."
  }),
  flavorEvent({
    id: "tiny_parade_of_one",
    title: "One-Person Parade",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "social",
    bodyText: "A person in a sash walks along the shoulder waving like the whole county showed up. A paper crown sits at a dangerous angle.",
    resultText: "You pass a parade with excellent attendance per capita.",
    resolvedBodyText: "Everyone waves back because it feels rude not to. The parade continues behind you, undefeated."
  }),
  flavorEvent({
    id: "wrong_town_welcome",
    title: "Wrong Welcome",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "A town sign welcomes you to a place that is clearly not on the map. The population number has been painted over three times.",
    resultText: "The map and the sign disagree politely.",
    resolvedBodyText: "You keep the official route and let the sign have its version of events. The road is full of local truths."
  }),
  flavorEvent({
    id: "payphone_ringing",
    title: "Ringing Payphone",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "uncanny",
    bodyText: "An old payphone rings beside a closed service station. Nobody in the RV says anything for a full mile.",
    resultText: "The call goes unanswered.",
    resolvedBodyText: "You leave the ringing behind. It becomes one of those things nobody mentions until much later."
  }),
  flavorEvent({
    id: "motel_pool_no_motel",
    title: "Pool Without Motel",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "uncanny",
    bodyText: "A blue motel pool sits beside the road with no motel attached. The ladder is polished bright.",
    resultText: "The freestanding pool stays where it is.",
    resolvedBodyText: "It is too strange to be useful and too clean to be abandoned. You keep driving before it starts feeling like an invitation."
  }),
  flavorEvent({
    id: "map_pin_argument",
    title: "Map Pin Argument",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "The navigation pin jumps to the other side of the road and then back again, like it is pacing. The real road remains unimpressed.",
    resultText: "The map calms down.",
    resolvedBodyText: "You give the screen a minute to collect itself. It returns to normal with no apology."
  }),
  flavorEvent({
    id: "historic_marker_blank",
    title: "Blank Historic Marker",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "A historic marker has no text, just a title: SOMETHING HAPPENED HERE. Nobody can argue with it.",
    resultText: "History keeps its privacy.",
    resolvedBodyText: "The marker offers no dates, names, or useful context. It may be the most honest marker of the trip."
  }),
  flavorEvent({
    id: "rest_area_clock_wall",
    title: "Clock Wall",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "uncanny",
    bodyText: "A rest area wall holds six clocks, all labeled LOCAL TIME, all different. One is running backward.",
    resultText: "Time keeps several opinions.",
    resolvedBodyText: "You trust the RV clock because it is the least theatrical option. The wall of clocks gets no vote."
  }),
  flavorEvent({
    id: "roadside_free_nothing",
    title: "Free Nothing",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "absurd",
    bodyText: "A cardboard sign says FREE NOTHING. Beneath it sits an empty table, carefully dusted.",
    resultText: "You decline the generous offer.",
    resolvedBodyText: "The table has already given everything it had. There is a purity to it."
  }),
  flavorEvent({
    id: "overly_specific_exit",
    title: "Specific Exit",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "An exit sign promises COFFEE, ICE, REGRET, 2 MILES. Nobody asks which business sells the regret.",
    resultText: "You stay on the main road.",
    resolvedBodyText: "The sign vanishes in the mirror. The RV remains regret-neutral for now."
  }),
  flavorEvent({
    id: "gas_pump_poem",
    title: "Pump Poem",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "A pump screen displays a four-line poem about asphalt before asking if you want a receipt. The poem is better than expected.",
    resultText: "The pump chooses art.",
    resolvedBodyText: "No one knows who wrote it. The receipt, if there is one, cannot compete."
  }),
  flavorEvent({
    id: "detour_sign_loop",
    title: "Circular Detour",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "absurd",
    bodyText: "Two detour signs point at each other across the road. They seem confident and mutually unhelpful.",
    resultText: "You trust neither sign.",
    resolvedBodyText: "The RV continues straight through the argument. Both signs look disappointed."
  }),
  flavorEvent({
    id: "coffee_shop_scale_model",
    title: "Scale Model Road",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "Through a cafe window, you see a tiny model of the same road you are driving. The model has traffic too.",
    resultText: "The miniature road keeps moving.",
    resolvedBodyText: "Everyone leans toward the window as you pass. For a second the real road feels like the copy."
  }),
  flavorEvent({
    id: "roadwork_sign_poetry",
    title: "Roadwork Haiku",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "A roadwork sign flashes SLOW / LOOSE GRAVEL / WE ALL TRY. It may be a warning, but it feels personal.",
    resultText: "The sign says enough.",
    resolvedBodyText: "You slow down because of the gravel, and maybe a little because of the poem."
  }),
  flavorEvent({
    id: "mystery_exit_music",
    title: "Exit Music",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "uncanny",
    bodyText: "For twenty seconds, the radio picks up a station playing only applause. Then the signal disappears.",
    resultText: "The applause fades.",
    resolvedBodyText: "No one knows what you did to deserve it. Everyone accepts it anyway."
  }),
  flavorEvent({
    id: "souvenir_rock_receipts",
    title: "Rock Receipts",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "absurd",
    bodyText: "A souvenir stand advertises AUTHENTIC LOCAL ROCKS WITH RECEIPTS. The rocks sit in little bags, looking properly documented.",
    resultText: "The certified rocks remain unsold to you.",
    resolvedBodyText: "The idea of a rock needing paperwork carries the conversation for several miles."
  }),
  flavorEvent({
    id: "bridge_height_argument",
    title: "Bridge Height Argument",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "Two bridge signs list different clearances six inches apart. The RV is nowhere near either number, but everyone still ducks.",
    resultText: "The bridge lets you pass.",
    resolvedBodyText: "No harm comes of it. The ducking was not useful, but it was unanimous."
  }),
  flavorEvent({
    id: "restroom_key_legend",
    title: "Legendary Key",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "A clerk hands someone a restroom key attached to a wooden paddle the size of a canoe oar. It has clearly seen things.",
    resultText: "The key returns from its mission.",
    resolvedBodyText: "The paddle bangs against every doorway on the way there and back. It is less a keychain than a public announcement."
  }),
  flavorEvent({
    id: "shoulder_chair_meeting",
    title: "Chair Meeting",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "absurd",
    bodyText: "Three lawn chairs sit in a circle on the shoulder with nobody in them. One chair has a clipboard.",
    resultText: "The meeting adjourns without you.",
    resolvedBodyText: "You pass quietly, as if interrupting would be rude. The empty chairs keep their minutes."
  }),
  flavorEvent({
    id: "too_many_welcome_flags",
    title: "Too Many Flags",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "social",
    bodyText: "A roadside stand waves so many WELCOME flags that it begins to feel less like hospitality and more like a weather system.",
    resultText: "The welcome is received.",
    resolvedBodyText: "You do feel welcome, if slightly outnumbered. The flags continue working hard behind you."
  }),
  flavorEvent({
    id: "billboard_missing_middle",
    title: "Missing Middle",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "A billboard reads WHEN LIFE GIVES YOU     MAKE     . The missing words might be doing the best work.",
    resultText: "The billboard leaves room for interpretation.",
    resolvedBodyText: "Everyone offers a different version. None of them improve the original."
  }),
  flavorEvent({
    id: "camp_spoon_drawer",
    title: "One Spoon Too Many",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "absurd",
    bodyText: "At camp, the drawer contains one more spoon than it did this morning. Nobody admits responsibility.",
    resultText: "The spoon count changes without explanation.",
    resolvedBodyText: "You decide not to investigate. Some mysteries are load-bearing."
  }),
  flavorEvent({
    id: "neighbor_levels_table",
    title: "Leveling Debate",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "social",
    bodyText: "A nearby camper spends ten full minutes leveling a folding table. The table holds one napkin and nothing else.",
    resultText: "The table reaches perfection.",
    resolvedBodyText: "The commitment is hard not to respect. The napkin has never had a better night."
  }),
  flavorEvent({
    id: "campground_wifi_name",
    title: "Wi-Fi Name",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "mundane-weird",
    bodyText: "The strongest Wi-Fi network is named PLEASE_STOP_GUESSING. It has no password prompt, just silence.",
    resultText: "The network keeps its boundary.",
    resolvedBodyText: "You do not connect. The network seems grateful."
  }),
  flavorEvent({
    id: "lantern_shadow_math",
    title: "Lantern Math",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "uncanny",
    bodyText: "The lantern throws a shadow that seems too tall for anything nearby. Someone moves the lantern and the shadow politely adjusts.",
    resultText: "The lantern behaves well enough.",
    resolvedBodyText: "Nobody calls it strange out loud. That seems to help."
  }),
  flavorEvent({
    id: "camp_host_whispers_rules",
    title: "Whispered Rules",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "mundane-weird",
    bodyText: "The camp host whispers the quiet hours rule with the intensity of state secrets. The rule is 10 PM.",
    resultText: "Quiet hours remain classified.",
    resolvedBodyText: "You nod like you have been trusted with something delicate. In a way, you have."
  }),
  flavorEvent({
    id: "picnic_table_wobble",
    title: "Table With Opinions",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "mundane-weird",
    bodyText: "The picnic table wobbles only when someone mentions tomorrow. When the subject changes, it settles down.",
    resultText: "The table declines planning.",
    resolvedBodyText: "You keep dinner conversation in the present tense. The table approves."
  }),
  flavorEvent({
    id: "site_number_argument",
    title: "Site Number",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "absurd",
    bodyText: "Your site marker says 12 on one side and 21 on the other. Both numbers seem equally certain.",
    resultText: "The site keeps both identities.",
    resolvedBodyText: "You park between the two truths and call it close enough."
  }),
  flavorEvent({
    id: "camp_map_too_honest",
    title: "Honest Camp Map",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "mundane-weird",
    bodyText: "The camp map labels one loop PRETTY GOOD and another loop WHERE THE LIGHT BUZZES. You appreciate the candor.",
    resultText: "The map tells it straight.",
    resolvedBodyText: "Even if the map is crude, it has the rare confidence of experience."
  }),
  flavorEvent({
    id: "folding_chair_victory",
    title: "Chair Victory",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "social",
    bodyText: "A folding chair opens correctly on the first try. Everyone notices because that almost never happens.",
    resultText: "The chair gives you one clean win.",
    resolvedBodyText: "It is not much, but it is clean, immediate success. The evening takes the compliment."
  }),
  flavorEvent({
    id: "overnight_cabinet_click",
    title: "Cabinet Click",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "uncanny",
    bodyText: "In the middle of the night, one cabinet clicks shut even though it was already shut. Nobody gets up to check.",
    resultText: "The cabinet makes its point.",
    resolvedBodyText: "By morning, it looks ordinary. That is somehow not comforting."
  }),
  flavorEvent({
    id: "fridge_hums_in_key",
    title: "Fridge In Key",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "The fridge hums in the same key as a song someone cannot remember. It stops whenever anyone gets close.",
    resultText: "The fridge keeps the tune.",
    resolvedBodyText: "The forgotten song stays just out of reach. Breakfast comes with a soundtrack nobody can prove."
  }),
  flavorEvent({
    id: "dream_about_turn_signal",
    title: "Turn Signal Dream",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "absurd",
    bodyText: "Someone dreams the RV turn signal is still clicking. In the morning, everyone agrees the dream had a strong beat.",
    resultText: "The dream contributes rhythm.",
    resolvedBodyText: "No one knows what it means. It is probably better that way."
  }),
  flavorEvent({
    id: "blanket_border_dispute",
    title: "Blanket Border",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "social",
    bodyText: "A quiet blanket border dispute resolves itself when everyone is too tired to negotiate. Peace holds until morning.",
    resultText: "The blanket treaty survives the night.",
    resolvedBodyText: "No one got everything they wanted, which is how you know it was a real treaty."
  }),
  flavorEvent({
    id: "water_tank_gurgle_sentence",
    title: "Tank Sentence",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "uncanny",
    bodyText: "The water tank gurgles in a rhythm that almost sounds like a sentence. Nobody asks it to repeat itself.",
    resultText: "The tank remains unclear.",
    resolvedBodyText: "It may have been plumbing. It may have been advice. Either way, morning arrives."
  }),
  flavorEvent({
    id: "moonlight_receipt",
    title: "Moonlight Receipt",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "Moonlight falls across an old receipt on the floor, highlighting only the word RETURN. It is from a store three states back.",
    resultText: "The receipt has opinions.",
    resolvedBodyText: "You throw it away in the morning. It has made its case."
  }),
  flavorEvent({
    id: "pillow_migration",
    title: "Pillow Migration",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "absurd",
    bodyText: "By morning, every loose pillow has migrated to the front passenger seat. Nobody remembers moving them.",
    resultText: "The pillows gather up front.",
    resolvedBodyText: "The arrangement looks deliberate, almost managerial. You break up the meeting before breakfast."
  }),
  flavorEvent({
    id: "heater_click_applause",
    title: "Heater Applause",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "The heater clicks three times after successfully starting, like it expects applause. It receives a sleepy nod.",
    resultText: "The heater takes a bow.",
    resolvedBodyText: "Reliable heat is allowed to be proud of itself. Nobody says this out loud."
  }),
  flavorEvent({
    id: "morning_sock_mystery",
    title: "Sock Mystery",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "mundane-weird",
    bodyText: "A single clean sock appears on the dashboard by morning. It belongs to everyone and no one.",
    resultText: "The sock joins the trip.",
    resolvedBodyText: "You put it with the laundry and pretend that is an answer."
  }),
  flavorEvent({
    id: "roadside_compliment_window",
    title: "Window Compliment",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "social",
    impact: "minor",
    bodyText: "At a stoplight, someone in the next lane gives the RV a sincere thumbs-up. The timing is so earnest that it lands.",
    effects: { resources: { passengerMorale: 1 } },
    resultText: "A small compliment lifts the cabin.",
    resolvedBodyText: "It is a tiny thing, but the cabin takes it. The road feels briefly kinder."
  }),
  flavorEvent({
    id: "coffee_lid_betrayal",
    title: "Coffee Lid",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    impact: "minor",
    bodyText: "A coffee lid refuses to seat correctly until the moment everyone stops watching. The victory is hollow but real.",
    effects: { resources: { passengerMorale: -1 } },
    resultText: "The coffee lid costs a little patience.",
    resolvedBodyText: "No real harm is done. Still, the lid knows what it did."
  }),
  flavorEvent({
    id: "unexpected_good_restroom",
    title: "Good Restroom",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    impact: "minor",
    bodyText: "A roadside restroom is clean, stocked, and absolutely normal. This feels suspiciously luxurious.",
    effects: { resources: { passengerMorale: 2 } },
    resultText: "A normal restroom improves the day.",
    resolvedBodyText: "Nobody expected much, which makes competence feel like a gift. The cabin mood rises a notch."
  }),
  flavorEvent({
    id: "tiny_water_favor",
    title: "Tiny Water Favor",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "social",
    impact: "minor",
    bodyText: "A clerk points out a safe spigot for topping a bottle or two. It is not a refill, just a small courtesy.",
    effects: { resources: { water: 2 } },
    resultText: "A tiny water favor helps a little.",
    resolvedBodyText: "The amount is small, but the kindness is easy to carry. The tanks do not change much; the day does."
  }),
  flavorEvent({
    id: "wrong_playlist_peace",
    title: "Wrong Playlist",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "absurd",
    impact: "minor",
    bodyText: "The wrong playlist comes on, and for once nobody changes it. The song is terrible in a useful way.",
    effects: { resources: { passengerMorale: 1 } },
    resultText: "A bad song somehow helps.",
    resolvedBodyText: "The cabin accepts the song as a public service. Morale improves against everyone's better judgment."
  }),
  flavorEvent({
    id: "receipt_printer_scream",
    title: "Printer Scream",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "absurd",
    impact: "minor",
    bodyText: "A receipt printer emits a sound far too dramatic for the paper it produces. Everyone flinches.",
    effects: { resources: { passengerMorale: -1 } },
    resultText: "The printer startles the cabin.",
    resolvedBodyText: "The receipt is ordinary, which makes the noise worse. The mood dips for a minute and then recovers."
  }),
  flavorEvent({
    id: "shade_line_luck",
    title: "Shade Line",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    impact: "minor",
    bodyText: "For a few miles, the road lines up with a perfect strip of shade. It feels like finding a cool side of the day.",
    effects: { resources: { electric: 1 } },
    resultText: "A little shade steadies the rig.",
    resolvedBodyText: "It is not enough to change the trip, but it softens the edge of the drive."
  }),
  flavorEvent({
    id: "dashboard_button_argument",
    title: "Button Argument",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "mundane-weird",
    impact: "minor",
    bodyText: "Two people disagree about what an unlabeled dashboard button does. Pressing it changes nothing anyone can identify.",
    effects: { resources: { passengerMorale: -1 } },
    resultText: "The button wins the argument.",
    resolvedBodyText: "The button keeps its secret. The cabin loses a small amount of patience to pure uncertainty."
  }),
  flavorEvent({
    id: "dust_writes_hi",
    title: "Dust Message",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "uncanny",
    impact: "minor",
    bodyText: "Dust on the rear window looks exactly like the word HI. It probably says nothing. Probably.",
    effects: { resources: { passengerMorale: 1 } },
    resultText: "The dust says hello.",
    resolvedBodyText: "Nobody wipes it off right away. The greeting stays until the next bump blurs it."
  }),
  flavorEvent({
    id: "camp_neighbor_laugh",
    title: "Neighbor Laugh",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "social",
    impact: "minor",
    bodyText: "A nearby campsite erupts in laughter at exactly the moment your group goes quiet. It is contagious.",
    effects: { resources: { passengerMorale: 1 } },
    resultText: "Nearby laughter lightens the evening.",
    resolvedBodyText: "You never learn the joke. That does not stop it from helping."
  }),
  flavorEvent({
    id: "camp_stove_clicks_forever",
    title: "Stove Clicks",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "mundane-weird",
    impact: "minor",
    bodyText: "The stove clicks a few extra times after lighting, as if clearing its throat. Dinner still happens.",
    effects: { resources: { passengerMorale: -1 } },
    resultText: "The stove adds a little tension.",
    resolvedBodyText: "It works, but not with grace. Everyone keeps one ear on it for a while."
  }),
  flavorEvent({
    id: "campground_coin_find",
    title: "Lucky Coin",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "mundane-weird",
    impact: "minor",
    bodyText: "Someone finds a coin from a year nobody in the group can immediately place. This becomes more interesting than it should.",
    effects: { resources: { passengerMorale: 1 } },
    resultText: "A small find lifts the camp mood.",
    resolvedBodyText: "The coin is not valuable, but it gives the evening a tiny shared puzzle."
  }),
  flavorEvent({
    id: "overnight_good_pillow",
    title: "Good Pillow Night",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "mundane-weird",
    impact: "minor",
    bodyText: "Against all odds, every pillow seems to be in the right place tonight. Nobody wants to question it.",
    effects: { resources: { passengerMorale: 2 } },
    resultText: "A better sleep lifts the cabin.",
    resolvedBodyText: "The night does not become magical; it just works. That is more than enough."
  }),
  flavorEvent({
    id: "overnight_distant_generator",
    title: "Distant Generator",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "mundane-weird",
    impact: "minor",
    bodyText: "Somewhere far off, a generator pulses just out of rhythm with sleep. It is not loud, only persistent.",
    effects: { resources: { passengerMorale: -1 } },
    resultText: "A distant generator wears on the night.",
    resolvedBodyText: "By morning, everyone has heard it and nobody can imitate it correctly. The mood is a little thinner."
  }),
  flavorEvent({
    id: "overnight_cool_breeze",
    title: "Cool Breeze",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "mundane-weird",
    impact: "minor",
    bodyText: "A cool breeze finds the RV at the exact hour it is needed. The night stops feeling so boxed in.",
    effects: { resources: { passengerMorale: 1, electric: 1 } },
    resultText: "A lucky breeze helps the night.",
    resolvedBodyText: "The breeze is small, but it saves a little comfort and a little patience."
  }),
  flavorEvent({
    id: "roadside_mystery_button_choice",
    title: "Mystery Button",
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    tone: "absurd",
    impact: "choice",
    bodyText: "A rest-area kiosk has one big button labeled PRESS FOR LOCAL CONTEXT. It may be helpful. It may be a prank.",
    choices: [
      {
        id: "press_for_context",
        label: "Press It",
        resultText: "The kiosk prints a map fragment and emits a proud little chime.",
        resolvedBodyText: "The map fragment is barely useful, but the chime is excellent. The stop costs a sliver of time and improves the cabin mood.",
        effects: { resources: { passengerMorale: 1, electric: -1 } },
        audioTone: "success"
      },
      {
        id: "leave_button_alone",
        label: "Leave It Alone",
        resultText: "You leave the button to someone with a stronger calling.",
        resolvedBodyText: "The kiosk remains mysterious. The trip continues without local context.",
        effects: {},
        audioTone: "neutral"
      }
    ]
  }),
  flavorEvent({
    id: "camp_questionable_guestbook",
    title: "Guestbook",
    phase: DAY_PHASES.CAMP_DECISION,
    tone: "uncanny",
    impact: "choice",
    bodyText: "A camp guestbook sits in a weatherproof box. Every entry says, \"Pretty quiet tonight,\" in different handwriting.",
    choices: [
      {
        id: "sign_the_guestbook",
        label: "Sign It",
        resultText: "You add your own quiet entry and close the box.",
        resolvedBodyText: "Writing in the book feels silly until it feels grounding. The evening settles a little.",
        effects: { resources: { passengerMorale: 1 } },
        audioTone: "success"
      },
      {
        id: "skip_the_guestbook",
        label: "Skip It",
        resultText: "You leave the guestbook to its pattern.",
        resolvedBodyText: "The box clicks shut. Nobody minds moving on.",
        effects: {},
        audioTone: "neutral"
      }
    ]
  }),
  flavorEvent({
    id: "overnight_mystery_beep_choice",
    title: "Mystery Beep",
    phase: DAY_PHASES.OVERNIGHT_RESOLUTION,
    tone: "mundane-weird",
    impact: "choice",
    bodyText: "A single beep sounds after everyone has settled in. It does not repeat, which somehow makes it more annoying.",
    choices: [
      {
        id: "check_the_beep",
        label: "Check It",
        resultText: "You find nothing obvious, but everyone sleeps easier afterward.",
        resolvedBodyText: "The check costs a little rest, but it removes the question from the room. That is worth something.",
        effects: { resources: { passengerMorale: 1, electric: -1 } },
        audioTone: "neutral"
      },
      {
        id: "ignore_the_beep",
        label: "Ignore It",
        resultText: "You ignore the beep and let the mystery keep one corner of the night.",
        resolvedBodyText: "Nothing else happens. Somehow that does not make it less irritating.",
        effects: { resources: { passengerMorale: -1 } },
        audioTone: "neutral"
      }
    ]
  })
];

const DISALLOWED_CATEGORIES = new Set(["rv_condition"]);
const DISALLOWED_TRIGGER_KEYS = new Set(["cashMin", "conditionMax", "fuelMissingMin"]);
const DISALLOWED_RESOURCE_KEYS = new Set(["fuel", "cash", "rvCondition"]);

const EXPLICIT_REMOVALS = new Set([
  "service_bay_tip",
  "washboard_rattle"
]);

const EXPLICIT_REWRITES = Object.freeze({
  road_work_bottleneck: (event) => ({
    ...event,
    effects: {
      journey: {
        milesTraveled: -8
      },
      resources: {
        electric: -1
      }
    },
    resultText: "The delay costs a little road and leaves the battery under a little more pressure.",
    resolvedBodyText:
      "You idle through the one-lane stretch and watch a good piece of the day burn off in place. When the road finally opens, it already feels later than it should, and the electric picture is a little tighter."
  }),
  scenic_turnout: (event) => ({
    ...event,
    choices: event.choices.map((choice) =>
      choice.id === "pull_over"
        ? {
            ...choice,
            effects: {
              journey: {
                milesTraveled: -6
              },
              resources: {
                hiddenMorale: 2,
                tripScore: 2
              }
            },
            resultText: "The stop costs a few miles, but it gives the trip something back.",
            resolvedBodyText:
              "You ease into the turnout, stretch your legs, and let the valley do its quiet work. When you pull back out, the road feels less close and the stop lands as one of the better moments of the trip."
          }
        : choice
    )
  }),
  headwind_crossing: (event) => ({
    ...event,
    effects: {
      journey: {
        milesTraveled: -6
      },
      resources: {
        electric: -2,
        hiddenMorale: -1
      }
    },
    resultText: "The wind costs miles and leaves electric feeling thinner than it should.",
    resolvedBodyText:
      "The wind stays on you mile after mile, and the whole day feels heavier for it. You still make progress, but the road takes more out of the trip than it gives back."
  }),
  free_water_spigot: (event) => ({
    ...event,
    choices: event.choices.map((choice) =>
      choice.id === "take_the_fill"
        ? {
            ...choice,
            resultText: "You trade a little time for a fuller tank and a messier stop.",
            resolvedBodyText:
              "You make the rough turn, drag the hose over, and take the fill while it is there to take. It is not graceful, but the fuller tank is real and the stop leaves behind a little cleanup pressure.",
            effects: {
              journey: {
                milesTraveled: -4
              },
              resources: {
                water: 10,
                waste: 1
              }
            }
          }
        : choice
    )
  }),
  heat_sick_rider: (event) => ({
    ...event,
    choices: event.choices.map((choice) => {
      if (choice.id === "stop_for_air_and_water") {
        return {
          ...choice,
          effects: {
            journey: {
              milesTraveled: -5
            },
            resources: {
              water: -2,
              hiddenMorale: 2
            }
          }
        };
      }

      if (choice.id === "keep_rolling_gently") {
        return {
          ...choice,
          effects: {
            journey: {
              milesTraveled: -2
            },
            resources: {
              hiddenMorale: -3
            }
          }
        };
      }

      return choice;
    })
  }),
  roadside_pie_sign: (event) => ({
    ...event,
    triggerConditions: {
      pressureScoreMin: 2
    },
    choices: [
      {
        id: "take_the_break",
        label: "Take The Break",
        resultText: "The stop costs daylight, but it lifts the trip.",
        resolvedBodyText:
          "You give in, pull over, and let the pie sign become a real stop instead of a joke. It is not efficient, but it gives the cabin a little laughter and the day comes back warmer.",
        effects: {
          journey: {
            milesTraveled: -4
          },
          resources: {
            hiddenMorale: 4,
            tripScore: 1,
            water: 1
          }
        },
        audioTone: "success"
      },
      {
        id: "keep_rolling",
        label: "Keep Rolling",
        resultText: "You leave the sign behind and keep the day moving.",
        resolvedBodyText:
          "You keep the wheels turning and leave the pie sign as a passing temptation. Nobody makes a scene, but the missed softness stays in the cabin for a while.",
        effects: {
          resources: {
            hiddenMorale: -1
          }
        },
        audioTone: "neutral"
      }
    ]
  }),
  tailwind_window: (event) => ({
    ...event,
    effects: {
      journey: {
        milesTraveled: 8
      },
      resources: {
        electric: 2,
        tripScore: 1
      }
    },
    resultText: "The good wind gives you easy miles and a cleaner electric picture.",
    resolvedBodyText:
      "For a while the RV seems to glide instead of push. The road opens up, the miles come easier, and the whole travel day feels unusually well-aligned."
  }),
  fairgrounds_discount_hookup: (event) => ({
    ...event,
    title: "Open Utility Slot",
    bodyText:
      "The fairgrounds host says one plug-in spot is open tonight if you want a steadier utility reset.",
    choices: [
      {
        id: "take_open_slot",
        label: "Take The Plug-In",
        resultText: "You take the utility help and give the night a steadier floor.",
        resolvedBodyText:
          "You take the open slot and let the stay be practical on purpose. By evening it feels like the right kind of unglamorous decision.",
        effects: {
          policies: {
            selectedCampsiteType: CAMPSITE_TYPES.PAID_HOOKUP
          },
          resources: {
            electric: 4,
            water: 3,
            waste: -6
          }
        },
        audioTone: "success"
      },
      {
        id: "stay_off_grid",
        label: "Skip The Plug-In",
        resultText: "You stay off-grid and keep the night simpler, if riskier.",
        resolvedBodyText:
          "You pass on the plug-in and let the night stay more improvised. The choice keeps the trip feeling rougher around the edges.",
        effects: {},
        audioTone: "neutral"
      }
    ]
  }),
  camp_host_extension: (event) => ({
    ...event,
    title: "Extra Utility Window",
    bodyText:
      "The host says the site can stay on a little longer tonight if you need a steadier reset.",
    choices: [
      {
        id: "take_more_stability",
        label: "Take The Extra Time",
        resultText: "Morning looks steadier after the extra utility window.",
        resolvedBodyText:
          "You take the extra time and let the plug-in do more work overnight. Morning arrives with the systems in a calmer place.",
        effects: {
          resources: {
            electric: 5,
            water: 4,
            waste: -5
          }
        },
        audioTone: "success"
      },
      {
        id: "leave_it_basic",
        label: "Keep It Simple",
        resultText: "You leave the site as-is and accept a thinner morning reset.",
        resolvedBodyText:
          "You thank the host and keep the site simple. The night still helps, just not as much as it could have.",
        effects: {},
        audioTone: "neutral"
      }
    ]
  }),
  hose_clamp_drip: (event) => ({
    ...event,
    title: "Night Drip",
    category: "recovery",
    triggerConditions: {},
    effects: {
      resources: {
        water: -4,
        hiddenMorale: -1
      }
    },
    resultText: "A small overnight drip costs water and leaves the morning feeling thinner.",
    resolvedBodyText:
      "The drip is small enough to miss in the dark, but not small enough to do no harm. By morning there is less water on board and less patience in the cabin."
  })
});

function buildV2EventCatalog(definitions) {
  return definitions
    .map((definition) => normalizeEventDefinition(definition))
    .filter(Boolean);
}

function normalizeEventDefinition(definition) {
  if (!definition || EXPLICIT_REMOVALS.has(definition.id)) {
    return null;
  }

  const explicitRewrite = EXPLICIT_REWRITES[definition.id];
  const candidate = explicitRewrite ? explicitRewrite(cloneEventDefinition(definition)) : cloneEventDefinition(definition);

  if (!explicitRewrite && eventHasDisallowedDependencies(candidate)) {
    return null;
  }

  const sanitized = sanitizeEventDefinition(candidate);

  if (!sanitized || eventHasDisallowedDependencies(sanitized)) {
    return null;
  }

  return sanitized;
}

function sanitizeEventDefinition(definition) {
  if (!definition || DISALLOWED_CATEGORIES.has(definition.category)) {
    return null;
  }

  return {
    ...definition,
    triggerConditions: sanitizeTriggerConditions(definition.triggerConditions),
    effects: sanitizeEffects(definition.effects),
    choices: Array.isArray(definition.choices)
      ? definition.choices
          .map((choice) => ({
            ...choice,
            effects: sanitizeEffects(choice.effects),
            randomOutcomes: Array.isArray(choice.randomOutcomes)
              ? choice.randomOutcomes.map((outcome) => ({
                  ...outcome,
                  effects: sanitizeEffects(outcome.effects)
                }))
              : undefined
          }))
      : definition.choices,
    randomOutcomes: Array.isArray(definition.randomOutcomes)
      ? definition.randomOutcomes.map((outcome) => ({
          ...outcome,
          effects: sanitizeEffects(outcome.effects)
        }))
      : definition.randomOutcomes
  };
}

function sanitizeTriggerConditions(triggerConditions = {}) {
  return Object.fromEntries(
    Object.entries(triggerConditions).filter(([key]) => !DISALLOWED_TRIGGER_KEYS.has(key))
  );
}

function sanitizeEffects(effects = {}) {
  return {
    ...effects,
    resources: sanitizeResources(effects.resources),
    journey: effects.journey ? { ...effects.journey } : undefined,
    passengerPressure: effects.passengerPressure ? { ...effects.passengerPressure } : undefined,
    policies: effects.policies ? { ...effects.policies } : undefined
  };
}

function sanitizeResources(resources = {}) {
  return Object.fromEntries(
    Object.entries(resources).filter(([key]) => !DISALLOWED_RESOURCE_KEYS.has(key))
  );
}

function eventHasDisallowedDependencies(definition) {
  if (!definition || DISALLOWED_CATEGORIES.has(definition.category)) {
    return true;
  }

  if (hasDisallowedTriggerKeys(definition.triggerConditions)) {
    return true;
  }

  if (effectsHaveDisallowedResources(definition.effects)) {
    return true;
  }

  if (Array.isArray(definition.choices)) {
    return definition.choices.some(
      (choice) =>
        effectsHaveDisallowedResources(choice.effects) ||
        (Array.isArray(choice.randomOutcomes) &&
          choice.randomOutcomes.some((outcome) => effectsHaveDisallowedResources(outcome.effects)))
    );
  }

  if (Array.isArray(definition.randomOutcomes)) {
    return definition.randomOutcomes.some((outcome) => effectsHaveDisallowedResources(outcome.effects));
  }

  return false;
}

function hasDisallowedTriggerKeys(triggerConditions = {}) {
  return Object.keys(triggerConditions).some((key) => DISALLOWED_TRIGGER_KEYS.has(key));
}

function effectsHaveDisallowedResources(effects = {}) {
  return Object.keys(effects?.resources ?? {}).some((key) => DISALLOWED_RESOURCE_KEYS.has(key));
}

function cloneEventDefinition(definition) {
  return JSON.parse(JSON.stringify(definition));
}

export const eventDefinitions = buildV2EventCatalog([
  ...rawEventDefinitions,
  ...flavorEventDefinitions
]);
