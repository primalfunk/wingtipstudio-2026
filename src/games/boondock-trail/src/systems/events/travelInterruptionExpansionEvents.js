import { COMFORT_POLICIES, DAY_PHASES } from "../../constants/gameConstants.js";

function buildEffects({
  miles = 0,
  battery = 0,
  fuel = 0,
  water = 0,
  cash = 0,
  condition = 0,
  morale = 0,
  pressureRelief = 0,
  pressureStrain = 0,
  policies = null
} = {}) {
  const effects = {};
  const resources = {};
  const passengerPressure = {};

  if (miles !== 0) {
    effects.journey = {
      milesTraveled: miles
    };
  }

  if (battery !== 0) {
    resources.batteryCharge = battery;
  }

  if (fuel !== 0) {
    resources.fuel = fuel;
  }

  if (water !== 0) {
    resources.water = water;
  }

  if (cash !== 0) {
    resources.cash = cash;
  }

  if (condition !== 0) {
    resources.rvCondition = condition;
  }

  if (morale !== 0) {
    resources.passengerMorale = morale;
  }

  const recoveryMomentumDelta = (Number(pressureRelief) || 0) - (Number(pressureStrain) || 0);

  if (recoveryMomentumDelta !== 0) {
    passengerPressure.recoveryMomentum = recoveryMomentumDelta;
  }

  if (Object.keys(resources).length > 0) {
    effects.resources = resources;
  }

  if (Object.keys(passengerPressure).length > 0) {
    effects.passengerPressure = passengerPressure;
  }

  if (policies && typeof policies === "object") {
    effects.policies = policies;
  }

  return effects;
}

function buildRandomOutcome({
  id,
  weight,
  resultText,
  resolvedBodyText,
  effects = {},
  audioTone = "neutral"
}) {
  return {
    id,
    weight,
    resultText,
    resolvedBodyText,
    effects,
    audioTone
  };
}

function buildChoice({
  id,
  label,
  resultText,
  resolvedBodyText,
  effects = {},
  audioTone = "neutral",
  randomOutcomes = null
}) {
  return {
    id,
    label,
    resultText,
    resolvedBodyText,
    effects,
    audioTone,
    ...(Array.isArray(randomOutcomes) && randomOutcomes.length > 0
      ? { randomOutcomes }
      : {})
  };
}

function buildAutomaticEvent({
  id,
  title,
  bodyText,
  category,
  artFamily,
  weight,
  triggerConditions = {},
  effects = {},
  audioTone = "neutral",
  resultText,
  resolvedBodyText,
  randomOutcomes = null
}) {
  return {
    id,
    title,
    bodyText,
    category,
    artFamily,
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    type: "automatic",
    weight,
    triggerConditions,
    effects,
    audioTone,
    resultText,
    resolvedBodyText,
    ...(Array.isArray(randomOutcomes) && randomOutcomes.length > 0
      ? { randomOutcomes }
      : {})
  };
}

function buildChoiceEvent({
  id,
  title,
  bodyText,
  category,
  artFamily,
  weight,
  triggerConditions = {},
  choices
}) {
  return {
    id,
    title,
    bodyText,
    category,
    artFamily,
    phase: DAY_PHASES.TRAVEL_RESOLUTION,
    type: "choice",
    weight,
    triggerConditions,
    choices
  };
}

// Food is not a tracked resource in the current model, so food-like gains are
// translated into morale/comfort gains in the interruption layer.
const roadAndFlowEvents = [
  buildAutomaticEvent({
    id: "shoulder_flagger_delay",
    title: "Shoulder Flagger",
    bodyText: "A lone flagger stops the lane and turns the next few miles into patient crawling.",
    category: "travel",
    artFamily: "rough_road",
    weight: 3,
    effects: buildEffects({ miles: -6 }),
    audioTone: "bad_fail",
    resultText: "The slow flagger stretch costs a few miles.",
    resolvedBodyText:
      "You wait, wave, and inch through the narrowed shoulder while the heat drifts over the hood. When the road finally opens again, a small piece of the day is already gone."
  }),
  buildAutomaticEvent({
    id: "detour_arrow_shuffle",
    title: "Detour Arrow",
    bodyText: "A bent orange arrow sends you down a side road that feels less certain with every mile.",
    category: "travel",
    artFamily: "rough_road",
    weight: 2,
    triggerConditions: {
      minDay: 2
    },
    effects: buildEffects({ miles: -10, fuel: -1 }),
    audioTone: "bad_fail",
    resultText: "The detour takes more road and fuel than it promised.",
    resolvedBodyText:
      "You follow the detour markers until they finally spit you back onto the highway. It gets you through, but not cheaply."
  }),
  buildAutomaticEvent({
    id: "fresh_blacktop_glide",
    title: "Fresh Blacktop",
    bodyText: "The road suddenly turns smooth and dark, and the RV settles into an easy glide.",
    category: "travel",
    artFamily: "easy_road",
    weight: 2,
    effects: buildEffects({ miles: 5 }),
    audioTone: "success",
    resultText: "A smooth stretch gifts you a few easy miles.",
    resolvedBodyText:
      "Fresh blacktop carries the RV forward with almost no complaint. For a while, the road feels like it wants to help."
  }),
  buildChoiceEvent({
    id: "slow_farm_convoy",
    title: "Slow Farm Convoy",
    bodyText: "Tractors and hay wagons fill the lane ahead and turn the horizon into a slow parade.",
    category: "travel",
    artFamily: "rough_road",
    weight: 2,
    triggerConditions: {
      minDay: 2
    },
    choices: [
      buildChoice({
        id: "wait_it_out",
        label: "Wait It Out",
        resultText: "You stay patient and lose a little road.",
        resolvedBodyText:
          "You ease back, keep both hands steady, and let the convoy have its pace. The wait is slow, but clean.",
        effects: buildEffects({ miles: -7 }),
        audioTone: "neutral"
      }),
      buildChoice({
        id: "pass_carefully",
        label: "Pass Carefully",
        resultText: "You look for a clean opening and trust your timing.",
        resolvedBodyText:
          "You judge the gaps, check the shoulder twice, and commit when the lane finally opens. It is the sort of choice that feels longer than it lasts.",
        randomOutcomes: [
          buildRandomOutcome({
            id: "clean_pass",
            weight: 70,
            resultText: "The pass goes cleanly and gives the day a little back.",
            resolvedBodyText:
              "You catch the opening just right and slip past the farm line in one calm move. The road opens back up with a small, satisfying click.",
            effects: buildEffects({ miles: 4 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "rough_shoulder_scrape",
            weight: 30,
            resultText: "You clear the convoy, but the shoulder leaves a small mark on the RV.",
            resolvedBodyText:
              "You make it past, though a ragged edge of gravel clatters harder than you like. Nothing serious gives way, but the RV feels it.",
            effects: buildEffects({ condition: -1 }),
            audioTone: "bad_fail"
          })
        ]
      })
    ]
  }),
  buildAutomaticEvent({
    id: "railroad_hold_crossing",
    title: "Railroad Hold",
    bodyText: "A freight train takes its time across the crossing and asks the whole day to wait with it.",
    category: "travel",
    artFamily: "rough_road",
    weight: 2,
    effects: buildEffects({ miles: -5 }),
    audioTone: "neutral",
    resultText: "The long train costs a few miles.",
    resolvedBodyText:
      "You watch car after car rattle by until the crossing finally lifts. By then the day has thinned a little."
  }),
  buildAutomaticEvent({
    id: "missed_turn_backtrack",
    title: "Missed Turn",
    bodyText: "A turn slips by in heat shimmer and road noise, and you do not catch it until the next shoulder.",
    category: "travel",
    artFamily: "ominous_road",
    weight: 1,
    triggerConditions: {
      minDay: 2
    },
    effects: buildEffects({ miles: -9, fuel: -1 }),
    audioTone: "bad_fail",
    resultText: "A missed turn sends a little road and fuel behind you.",
    resolvedBodyText:
      "You take the next safe place to turn around and retrace the stretch with a small, tired feeling. The road gives the miles back, but not the time."
  }),
  buildAutomaticEvent({
    id: "clear_open_stretch",
    title: "Clear Open Stretch",
    bodyText: "Traffic thins, the shoulders widen, and the miles begin to come in cleanly.",
    category: "travel",
    artFamily: "tailwind_road",
    weight: 2,
    triggerConditions: {
      sunlightMin: 0.8
    },
    effects: buildEffects({ miles: 7 }),
    audioTone: "success",
    resultText: "An easy run of road gives you extra distance.",
    resolvedBodyText:
      "For a while there is nothing to fight: no bottleneck, no wandering line of brake lights, just open lane and good rhythm."
  }),
  buildAutomaticEvent({
    id: "rolling_slow_zone",
    title: "Rolling Slow Zone",
    bodyText: "Cones, rough shoulders, and hesitant traffic keep the whole highway from ever quite getting up to speed.",
    category: "travel",
    artFamily: "rough_road",
    weight: 2,
    effects: buildEffects({ miles: -4 }),
    audioTone: "neutral",
    resultText: "The rolling slow zone trims a little off the day.",
    resolvedBodyText:
      "Nothing stops you outright, but the road never finds its stride. The loss comes in small, annoying spoonfuls."
  }),
  buildChoiceEvent({
    id: "pullout_shortcut_tip",
    title: "Pullout Shortcut Tip",
    bodyText: "At a pullout, a traveler leans in with a shortcut that might be smart or might just be confident.",
    category: "travel",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 3,
      pressureScoreMin: 2
    },
    choices: [
      buildChoice({
        id: "trust_the_tip",
        label: "Trust The Tip",
        resultText: "You decide to gamble on local confidence.",
        resolvedBodyText:
          "You thank them, merge back out, and let the shortcut claim the next part of the day.",
        randomOutcomes: [
          buildRandomOutcome({
            id: "tip_pays_off",
            weight: 50,
            resultText: "The shortcut is real, and the day opens up a little.",
            resolvedBodyText:
              "The cut-through joins the main road again sooner than it should have, and suddenly you are ahead instead of behind.",
            effects: buildEffects({ miles: 8 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "tip_winds_around",
            weight: 50,
            resultText: "The shortcut wanders and costs more than it saves.",
            resolvedBodyText:
              "The route bends through enough side miles to erase the promise. You make it back, but not happily.",
            effects: buildEffects({ miles: -6 }),
            audioTone: "bad_fail"
          })
        ]
      }),
      buildChoice({
        id: "stay_main_road",
        label: "Stay On The Main Road",
        resultText: "You keep the known road under you.",
        resolvedBodyText:
          "You nod, thank them for the thought, and keep the highway you already understand.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildAutomaticEvent({
    id: "long_red_light_town",
    title: "Long Red Light Town",
    bodyText: "A little town strings one red light after another across the road and dares you to stay patient.",
    category: "travel",
    artFamily: "roadside_encounter",
    weight: 2,
    triggerConditions: {
      minDay: 2
    },
    effects: buildEffects({ miles: -3 }),
    audioTone: "neutral",
    resultText: "The stoplight town trims a little off the drive.",
    resolvedBodyText:
      "You roll through the town at the mercy of light timing and delivery trucks. It is not much, but it adds up."
  })
];
const solarAndWeatherEvents = [
  buildAutomaticEvent({
    id: "passing_cloudbank",
    title: "Passing Cloudbank",
    bodyText: "A long shelf of cloud drifts over and flattens the charging light just when it had been feeling generous.",
    category: "energy",
    artFamily: "ominous_road",
    weight: 3,
    triggerConditions: {
      sunlightMin: 0.85
    },
    effects: buildEffects({ battery: -4 }),
    audioTone: "bad_fail",
    resultText: "The clouds cut more charging than you wanted.",
    resolvedBodyText:
      "The light goes dull for long enough that you can feel the lost charge in the gauges. The sky never becomes dramatic, just unhelpful."
  }),
  buildAutomaticEvent({
    id: "clean_cold_morning",
    title: "Clean Cold Morning",
    bodyText: "The air stays crisp, the light stays clear, and the RV seems to like the whole arrangement.",
    category: "recovery",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      minDay: 2,
      sunlightMin: 0.8
    },
    effects: buildEffects({ miles: 3, morale: 2 }),
    audioTone: "success",
    resultText: "A crisp start makes the road feel easier.",
    resolvedBodyText:
      "Everything about the morning feels a little cleaner than usual: the view, the air, even the engine note. It gives the day a gentle lift."
  }),
  buildAutomaticEvent({
    id: "sidewind_gusts",
    title: "Sidewind Gusts",
    bodyText: "Crosswinds keep giving the RV a nudge at exactly the moments you want it to settle.",
    category: "energy",
    artFamily: "dusty_road",
    weight: 2,
    triggerConditions: {
      sunlightMax: 0.7
    },
    effects: buildEffects({ miles: -5 }),
    audioTone: "bad_fail",
    resultText: "The sidewind costs a little steady distance.",
    resolvedBodyText:
      "You keep correcting, easing, and correcting again while the gusts argue with the lane. The miles still happen, just more slowly."
  }),
  buildAutomaticEvent({
    id: "sunbreak_charge",
    title: "Sunbreak Charge",
    bodyText: "The clouds part into a long bright opening, and the roof finally gets the light it has been waiting for.",
    category: "energy",
    artFamily: "tailwind_road",
    weight: 2,
    triggerConditions: {
      sunlightMin: 0.95,
      batteryPercentMax: 75
    },
    effects: buildEffects({ battery: 6 }),
    audioTone: "success",
    resultText: "A clean sunbreak gives the battery a welcome lift.",
    resolvedBodyText:
      "The panels catch a long run of good light and make the most of it. By the time the sky softens again, the battery looks steadier."
  }),
  buildAutomaticEvent({
    id: "warm_tail_breeze",
    title: "Warm Tail Breeze",
    bodyText: "The wind falls in kindly behind you, and even the cabin feels a little less cross for it.",
    category: "recovery",
    artFamily: "tailwind_road",
    weight: 2,
    triggerConditions: {
      sunlightMin: 0.9
    },
    effects: buildEffects({ miles: 4, pressureRelief: 1 }),
    audioTone: "success",
    resultText: "The warm tail breeze makes the drive feel lighter.",
    resolvedBodyText:
      "The RV stops pushing so hard against the day, and the feeling spreads through the whole cabin. It is a small kindness, but a real one."
  }),
  buildAutomaticEvent({
    id: "glare_slowdown",
    title: "Glare Slowdown",
    bodyText: "The light comes off the road too hard and bright, and careful driving takes the edge off your pace.",
    category: "energy",
    artFamily: "easy_road",
    weight: 2,
    triggerConditions: {
      sunlightMin: 0.95
    },
    effects: buildEffects({ miles: -3 }),
    audioTone: "neutral",
    resultText: "Harsh glare asks for a slower hand.",
    resolvedBodyText:
      "You lower the visor, narrow your eyes, and give the road a little more room than you wanted to. The miles come, but cautiously."
  }),
  buildChoiceEvent({
    id: "cool_shade_break",
    title: "Cool Shade Break",
    bodyText: "A pocket of shade appears beside the road, the sort that makes the whole RV imagine stopping.",
    category: "morale",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      sunlightMin: 0.9
    },
    choices: [
      buildChoice({
        id: "stop_briefly",
        label: "Stop Briefly",
        resultText: "You trade a little road for relief.",
        resolvedBodyText:
          "You pull in under the shade, crack the doors, and let everyone breathe for a minute. It costs time, but it feels worth the bargain.",
        effects: buildEffects({ miles: -3, morale: 4 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "keep_moving",
        label: "Keep Moving",
        resultText: "You keep the wheels under the day.",
        resolvedBodyText:
          "You let the shade go by and keep the road in front of you. Sometimes keeping momentum is its own answer.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildAutomaticEvent({
    id: "sudden_drizzle",
    title: "Sudden Drizzle",
    bodyText: "A passing drizzle softens the road, cools the windshield, and rinses a little dust off the roof.",
    category: "energy",
    artFamily: "ominous_road",
    weight: 1,
    triggerConditions: {
      sunlightMin: 0.45,
      sunlightMax: 0.75
    },
    effects: buildEffects({ battery: 2, miles: -2 }),
    audioTone: "neutral",
    resultText: "The light rain costs a little pace and gives back a little charge.",
    resolvedBodyText:
      "The drizzle never becomes real weather, but it freshens the panels and makes the road demand a gentler foot."
  }),
  buildAutomaticEvent({
    id: "heat_haze_crawl",
    title: "Heat Haze Crawl",
    bodyText: "The highway wavers in front of you until even the simple miles feel heavy.",
    category: "morale",
    artFamily: "dusty_road",
    weight: 2,
    triggerConditions: {
      sunlightMin: 0.95,
      minDay: 3
    },
    effects: buildEffects({ miles: -4, morale: -1 }),
    audioTone: "bad_fail",
    resultText: "The heat haze makes the day feel slower and tighter.",
    resolvedBodyText:
      "The horizon shimmers, the cabin warms, and patience gets thinner by the mile. Nobody says much, but everyone feels it."
  }),
  buildAutomaticEvent({
    id: "golden_stretch",
    title: "Golden Stretch",
    bodyText: "For one bright run of road, the wind, the light, and the grade all line up in your favor.",
    category: "energy",
    artFamily: "tailwind_road",
    weight: 1,
    triggerConditions: {
      sunlightMin: 0.98,
      batteryPercentMax: 80
    },
    effects: buildEffects({ battery: 4, miles: 3 }),
    audioTone: "success",
    resultText: "A rare golden stretch helps both the battery and the road.",
    resolvedBodyText:
      "It feels almost arranged: bright roof, easy lane, no resistance worth naming. The RV makes good use of all of it."
  })
];
const rvMaintenanceEvents = [
  buildAutomaticEvent({
    id: "cabinet_burst_rattle",
    title: "Cabinet Burst",
    bodyText: "A cabinet pops loose on a rough bounce and spills its annoyance into the aisle.",
    category: "rv_condition",
    artFamily: "rough_road",
    weight: 2,
    triggerConditions: {
      conditionMax: 85
    },
    effects: buildEffects({ morale: -1 }),
    audioTone: "neutral",
    resultText: "Nothing serious breaks, but the cabin mood slips.",
    resolvedBodyText:
      "You get it shut again, but not before the little mess and the sharp sound have already done their work on everyone's patience."
  }),
  buildChoiceEvent({
    id: "loose_hose_clamp",
    title: "Loose Hose Clamp",
    bodyText: "A small rattle and a faint smell suggest a hose clamp that would rather be checked than ignored.",
    category: "rv_condition",
    artFamily: "roadside_encounter",
    weight: 2,
    triggerConditions: {
      minDay: 3,
      conditionMax: 80
    },
    choices: [
      buildChoice({
        id: "pull_over_and_tighten",
        label: "Pull Over And Tighten It",
        resultText: "You lose a little road, but the worry shrinks.",
        resolvedBodyText:
          "You pull over, find the clamp, and give it the minute it wanted. The stop costs miles, but the RV sounds more settled afterward.",
        effects: buildEffects({ miles: -4, condition: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "keep_going_anyway",
        label: "Keep Going",
        resultText: "You let it ride and hope it stays small.",
        resolvedBodyText:
          "You keep the road under you and let the question trail along behind the engine noise.",
        randomOutcomes: [
          buildRandomOutcome({
            id: "clamp_holds",
            weight: 50,
            resultText: "The clamp holds, and the worry fades back into the road noise.",
            resolvedBodyText:
              "Nothing worse comes of it this time. The moment passes, and the RV keeps its own counsel.",
            effects: buildEffects(),
            audioTone: "neutral"
          }),
          buildRandomOutcome({
            id: "little_water_loss",
            weight: 50,
            resultText: "The problem stays small, but you lose a little water to it.",
            resolvedBodyText:
              "You do not lose much, but by the time you notice, a little water has already gone missing from the day.",
            effects: buildEffects({ water: -2 }),
            audioTone: "bad_fail"
          })
        ]
      })
    ]
  }),
  buildAutomaticEvent({
    id: "battery_balancing_pause",
    title: "Battery Balancing Pause",
    bodyText: "The system wants a small pause to settle itself, and the RV obliges whether you love that or not.",
    category: "energy",
    artFamily: "tailwind_road",
    weight: 1,
    triggerConditions: {
      batteryPercentMin: 85
    },
    effects: buildEffects({ miles: -2 }),
    audioTone: "neutral",
    resultText: "The system pause costs a sliver of road.",
    resolvedBodyText:
      "It is mostly flavor and patience: a small systems moment that asks for a little less hurry than you wanted."
  }),
  buildChoiceEvent({
    id: "tire_pressure_check",
    title: "Tire Pressure Check",
    bodyText: "The thought of tire pressure sneaks in and refuses to leave on its own.",
    category: "rv_condition",
    artFamily: "roadside_encounter",
    weight: 2,
    triggerConditions: {
      minDay: 2
    },
    choices: [
      buildChoice({
        id: "pull_over_to_check",
        label: "Pull Over To Check",
        resultText: "You trade a few miles for peace of mind.",
        resolvedBodyText:
          "You step out, make the quick round, and let the gauges tell you whether the road was whispering true.",
        effects: buildEffects({ miles: -3 }),
        randomOutcomes: [
          buildRandomOutcome({
            id: "check_finds_small_fix",
            weight: 50,
            resultText: "The check catches something small before it becomes a story.",
            resolvedBodyText:
              "One tire needed a little attention, and the stop turns out to have been worth it after all.",
            effects: buildEffects({ condition: 1 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "check_is_just_reassurance",
            weight: 50,
            resultText: "Everything looks fine, and reassurance is all you get.",
            resolvedBodyText:
              "The walkaround finds nothing dramatic. Even so, the calm is worth something.",
            effects: buildEffects(),
            audioTone: "neutral"
          })
        ]
      }),
      buildChoice({
        id: "keep_rolling",
        label: "Keep Rolling",
        resultText: "You decide the road does not get a vote in every worry.",
        resolvedBodyText:
          "You keep the lane and let the thought pass. Not every suspicion deserves a shoulder.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "inverter_beep_confusion",
    title: "Inverter Beep",
    bodyText: "A lonely electronic beep turns one quiet minute into a cabin full of theories.",
    category: "energy",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 3,
      batteryPercentMax: 45
    },
    choices: [
      buildChoice({
        id: "investigate_the_beep",
        label: "Investigate",
        resultText: "You stop to chase the beep down.",
        resolvedBodyText:
          "You ease over, open the cabinet, and spend a few minutes translating one small complaint into plain English.",
        effects: buildEffects({ miles: -3 }),
        randomOutcomes: [
          buildRandomOutcome({
            id: "beep_was_simple",
            weight: 50,
            resultText: "It turns out to be simple, and the cabin unclenches a little.",
            resolvedBodyText:
              "The fix is smaller than the fear was. That alone improves the mood.",
            effects: buildEffects({ morale: 2 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "beep_was_nothing",
            weight: 50,
            resultText: "You learn just enough to stop worrying about it for now.",
            resolvedBodyText:
              "It is not exactly satisfying, but it is reassuring enough to keep moving.",
            effects: buildEffects(),
            audioTone: "neutral"
          })
        ]
      }),
      buildChoice({
        id: "ignore_the_beep",
        label: "Ignore It",
        resultText: "You let the beep keep its mystery, and the cabin likes that choice even less.",
        resolvedBodyText:
          "The road keeps moving, but the unanswered sound rides along with you longer than it should.",
        effects: buildEffects({ morale: -1 }),
        audioTone: "bad_fail"
      })
    ]
  }),
  buildAutomaticEvent({
    id: "loose_awning_strap",
    title: "Loose Awning Strap",
    bodyText: "A strap finds the wind and flaps itself into your attention before you can do much about it.",
    category: "rv_condition",
    artFamily: "rough_road",
    weight: 1,
    triggerConditions: {
      minDay: 2
    },
    effects: buildEffects({ condition: -1 }),
    audioTone: "bad_fail",
    resultText: "The flapping strap costs the RV a little wear.",
    resolvedBodyText:
      "You get it settled when you can, but not before it has already taken a small toll."
  }),
  buildAutomaticEvent({
    id: "sink_trap_slosh",
    title: "Sink Trap Slosh",
    bodyText: "A harmless little slosh turns into one of those interior messes that feels bigger than it is.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      waterPercentMin: 40
    },
    effects: buildEffects({ morale: -1 }),
    audioTone: "neutral",
    resultText: "Nothing serious breaks, but the cabin loses a little grace.",
    resolvedBodyText:
      "It wipes up. Of course it wipes up. That does not make it less irritating."
  }),
  buildChoiceEvent({
    id: "fuse_swap_pullout",
    title: "Fuse Swap",
    bodyText: "A small pullout offers just enough room to tinker with the electrical nag that has been bothering you.",
    category: "energy",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 4,
      batteryPercentMax: 50
    },
    choices: [
      buildChoice({
        id: "check_the_fuse",
        label: "Check The Fuse",
        resultText: "You spend a few miles buying a little reassurance.",
        resolvedBodyText:
          "You pop the panel, swap what needs swapping, and come away feeling slightly more in charge of the day.",
        effects: buildEffects({ miles: -4, morale: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "leave_it_be",
        label: "Leave It Alone",
        resultText: "You choose not to turn the day into a tinkering day.",
        resolvedBodyText:
          "You let the system keep its secrets for a little longer and stay with the road instead.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "roof_rattle_check",
    title: "Roof Rattle",
    bodyText: "Something above gives one suspicious little sound, the kind that can ruin a whole hour if you let it.",
    category: "rv_condition",
    artFamily: "rough_road",
    weight: 1,
    triggerConditions: {
      conditionMax: 75
    },
    choices: [
      buildChoice({
        id: "stop_and_inspect",
        label: "Stop And Inspect",
        resultText: "You pull over and settle the question directly.",
        resolvedBodyText:
          "You climb up, check what can be checked, and refuse to let the noise grow larger in your imagination than it already is.",
        effects: buildEffects({ miles: -4 }),
        randomOutcomes: [
          buildRandomOutcome({
            id: "tiny_fix_found",
            weight: 40,
            resultText: "The stop catches a tiny issue before it turns into anything more.",
            resolvedBodyText:
              "There is just enough to tighten to make the stop worthwhile. The roof sounds friendlier after that.",
            effects: buildEffects({ condition: 1 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "nothing_found",
            weight: 60,
            resultText: "You find nothing obvious, only a little peace of mind.",
            resolvedBodyText:
              "The inspection ends without a dramatic answer. Even so, the mystery feels smaller now.",
            effects: buildEffects(),
            audioTone: "neutral"
          })
        ]
      }),
      buildChoice({
        id: "keep_driving",
        label: "Keep Driving",
        resultText: "You decide not to reward every suspicious sound.",
        resolvedBodyText:
          "You keep moving and let the road decide whether the noise mattered.",
        effects: buildEffects(),
        randomOutcomes: [
          buildRandomOutcome({
            id: "noise_fades",
            weight: 70,
            resultText: "The sound never becomes anything worse.",
            resolvedBodyText:
              "The road smooths, the sound fades, and the worry slowly goes with it.",
            effects: buildEffects(),
            audioTone: "neutral"
          }),
          buildRandomOutcome({
            id: "small_extra_wear",
            weight: 30,
            resultText: "The sound proves minor, but not imaginary.",
            resolvedBodyText:
              "Nothing dramatic happens, though the RV does come through the stretch a little more worn.",
            effects: buildEffects({ condition: -1 }),
            audioTone: "bad_fail"
          })
        ]
      })
    ]
  }),
  buildAutomaticEvent({
    id: "gray_tank_reminder",
    title: "Gray Tank Reminder",
    bodyText: "A smell and a thought arrive together: services will matter before too many more days pass.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 3
    },
    effects: buildEffects({ morale: -1 }),
    audioTone: "neutral",
    resultText: "The reminder does not hurt the trip, but it narrows the cabin a little.",
    resolvedBodyText:
      "Nothing is wrong exactly. It is simply one more road truth asking not to be forgotten."
  })
];
const findsAndSupplyEvents = [
  buildChoiceEvent({
    id: "free_box_stand",
    title: "Free Box Stand",
    bodyText: "A sun-faded FREE sign points at a box and a folding table beside the road.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 2,
    choices: [
      buildChoice({
        id: "look_through_the_box",
        label: "Look Through It",
        resultText: "You stop to see whether the box has any luck in it.",
        resolvedBodyText:
          "You sift through the little roadside offering with low expectations and a hopeful eye.",
        randomOutcomes: [
          buildRandomOutcome({
            id: "snack_find",
            weight: 40,
            resultText: "A decent snack turns up after all.",
            resolvedBodyText:
              "Buried under odds and ends is something simple but welcome. It feels like the road remembered you kindly for a minute.",
            effects: buildEffects({ morale: 1 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "water_find",
            weight: 30,
            resultText: "You find a little spare water worth keeping.",
            resolvedBodyText:
              "The box offers up a small practical win instead of a fun one, which is sometimes the better gift.",
            effects: buildEffects({ water: 1 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "box_is_just_a_box",
            weight: 30,
            resultText: "The box turns out to be only a box.",
            resolvedBodyText:
              "You take a look, smile at the effort, and come away empty-handed. That happens too.",
            effects: buildEffects(),
            audioTone: "neutral"
          })
        ]
      }),
      buildChoice({
        id: "keep_driving_past_box",
        label: "Keep Driving",
        resultText: "You leave the mystery to the next traveler.",
        resolvedBodyText:
          "The box recedes in the mirror, still full of possibility for somebody else.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "orchard_stand_peaches",
    title: "Orchard Stand",
    bodyText: "A little orchard stand glows with local fruit and the sort of optimism that expects you to stop.",
    category: "recovery",
    artFamily: "easy_road",
    weight: 2,
    triggerConditions: {
      cashMin: 8
    },
    choices: [
      buildChoice({
        id: "buy_the_produce",
        label: "Buy Produce",
        resultText: "You spend the cash and come away with the day improved.",
        resolvedBodyText:
          "You buy a bag of whatever looks best and bring it back to the RV like a small bright prize.",
        effects: buildEffects({ cash: -8, morale: 4 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "wave_and_roll_on",
        label: "Wave And Keep Going",
        resultText: "You keep your cash and let the stand keep its charm.",
        resolvedBodyText:
          "You wave, admire the fruit from the lane, and stay with the road instead.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "discount_ice_chest",
    title: "Discount Ice Chest",
    bodyText: "A handwritten sign promises ice, cold drinks, and relief from being exactly this warm.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 6,
      minDay: 2
    },
    choices: [
      buildChoice({
        id: "buy_ice_and_drinks",
        label: "Buy Ice And Drinks",
        resultText: "The stop costs cash and buys back some goodwill.",
        resolvedBodyText:
          "Cold drinks and a little ice do not solve the road, but they do improve the next stretch of it.",
        effects: buildEffects({ cash: -6, morale: 3 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "skip_the_ice",
        label: "Skip It",
        resultText: "You stay disciplined and keep going.",
        resolvedBodyText:
          "You keep the budget intact and let the cooler stay behind with its promise.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "abandoned_picnic_table",
    title: "Abandoned Picnic Table",
    bodyText: "An old picnic table sits in a pocket of shade like a tiny invitation with no one left to claim it.",
    category: "recovery",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      minDay: 2
    },
    choices: [
      buildChoice({
        id: "take_ten_minutes",
        label: "Take Ten Minutes",
        resultText: "You give the day a short pause and come back gentler.",
        resolvedBodyText:
          "The table is crooked but serviceable, and the little pause feels larger than it is.",
        effects: buildEffects({ miles: -3, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "leave_the_table",
        label: "Keep Moving",
        resultText: "You let the table keep its quiet.",
        resolvedBodyText:
          "Some pauses are only beautiful because they stay hypothetical. You drive on.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "community_fridge_find",
    title: "Community Fridge",
    bodyText: "A little roadside fridge and pantry box sits under a painted mutual-aid sign.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 2
    },
    choices: [
      buildChoice({
        id: "take_a_little",
        label: "Take A Little",
        resultText: "You take only what helps and leave grateful.",
        resolvedBodyText:
          "You choose modestly and come away steadier for it. The kindness of strangers stays with the RV after the fridge is gone.",
        effects: buildEffects({ morale: 2, pressureRelief: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "leave_it_for_someone_else",
        label: "Leave It For Someone Else",
        resultText: "You leave the supplies and keep the warmth of the gesture.",
        resolvedBodyText:
          "You decide others may need it more and pull away carrying the goodness of the thing, if not the contents.",
        effects: buildEffects({ morale: 1 }),
        audioTone: "success"
      })
    ]
  }),
  buildChoiceEvent({
    id: "tourist_brochure_rack",
    title: "Tourist Brochure Rack",
    bodyText: "A gas station porch holds one of those brochure racks that promises more possibilities than any day can honestly use.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 2
    },
    choices: [
      buildChoice({
        id: "browse_the_rack",
        label: "Browse The Rack",
        resultText: "You spend a minute looking at roads you are not on.",
        resolvedBodyText:
          "You leaf through bright little promises of overlooks, pie, museums, and roadside wonders, and somehow that helps.",
        effects: buildEffects({ miles: -2 }),
        randomOutcomes: [
          buildRandomOutcome({
            id: "rack_brings_a_smile",
            weight: 50,
            resultText: "The brochures mostly just brighten the mood.",
            resolvedBodyText:
              "Nothing changes except the cabin's face toward the day, which is sometimes enough.",
            effects: buildEffects({ morale: 1 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "rack_is_only_a_pause",
            weight: 50,
            resultText: "It turns into no more than a tiny stop, but not a bad one.",
            resolvedBodyText:
              "The rack sends you back out no wiser than before, only a little more awake to the world beyond the lane.",
            effects: buildEffects(),
            audioTone: "neutral"
          })
        ]
      }),
      buildChoice({
        id: "skip_the_rack",
        label: "Keep Driving",
        resultText: "You stay with the miles already chosen.",
        resolvedBodyText:
          "The brochures can keep their glitter. Today already has enough road in it.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "farm_eggs_cooler",
    title: "Farm Eggs Cooler",
    bodyText: "A cooler at the end of a drive sells eggs on the honor system and trusts you to deserve them.",
    category: "recovery",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      cashMin: 5
    },
    choices: [
      buildChoice({
        id: "buy_the_eggs",
        label: "Buy Eggs",
        resultText: "You pay the cooler and take a small practical win.",
        resolvedBodyText:
          "You leave bills in the box, take the eggs, and feel briefly part of a gentler version of the road.",
        effects: buildEffects({ cash: -5, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "skip_the_cooler",
        label: "Skip It",
        resultText: "You keep the cash and the simple trust behind you.",
        resolvedBodyText:
          "You let the cooler stay where it is, still tidy and full of local optimism.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "old_tool_bucket",
    title: "Old Tool Bucket",
    bodyText: "Outside a shuttered service shed sits a bucket of old tools that might be junk or might still have one good favor left.",
    category: "rv_condition",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      conditionMax: 80
    },
    choices: [
      buildChoice({
        id: "rummage_carefully",
        label: "Rummage Carefully",
        resultText: "You give the bucket a hopeful minute.",
        resolvedBodyText:
          "The bucket smells like dust, oil, and bad ideas. You look anyway.",
        randomOutcomes: [
          buildRandomOutcome({
            id: "tool_is_useful",
            weight: 35,
            resultText: "One of the tools actually helps.",
            resolvedBodyText:
              "Against all odds, you find something that fits the small problem you had in mind.",
            effects: buildEffects({ condition: 1 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "bucket_is_annoying",
            weight: 20,
            resultText: "The bucket gives you nothing but a little extra irritation.",
            resolvedBodyText:
              "You come away dusty, unconvinced, and no better equipped than before.",
            effects: buildEffects({ morale: -1 }),
            audioTone: "bad_fail"
          }),
          buildRandomOutcome({
            id: "bucket_is_nothing",
            weight: 45,
            resultText: "The rummage turns up nothing worth the stop.",
            resolvedBodyText:
              "It was worth a look. It was not worth more than that.",
            effects: buildEffects(),
            audioTone: "neutral"
          })
        ]
      }),
      buildChoice({
        id: "leave_the_bucket",
        label: "Keep Going",
        resultText: "You decide not to make every roadside oddity your project.",
        resolvedBodyText:
          "The bucket keeps its secrets, and the road keeps its momentum.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildAutomaticEvent({
    id: "coin_return_miracle",
    title: "Coin Return Miracle",
    bodyText: "At a vending stop, the coin return hides a tiny lucky surprise.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    effects: buildEffects({ cash: 3 }),
    audioTone: "success",
    resultText: "A tiny bit of luck puts cash back in your pocket.",
    resolvedBodyText:
      "It is only a few dollars, but the road has a way of making even that feel charmed."
  }),
  buildChoiceEvent({
    id: "forgotten_firewood_bundle",
    title: "Forgotten Firewood",
    bodyText: "A neatly tied firewood bundle sits by a pullout as though someone meant to come back for it and never did.",
    category: "recovery",
    artFamily: "easy_road",
    weight: 1,
    choices: [
      buildChoice({
        id: "take_the_bundle",
        label: "Take It",
        resultText: "You tuck the bundle away and feel a little better about later.",
        resolvedBodyText:
          "It may only matter at camp, but even that is enough to lighten the day a bit.",
        effects: buildEffects({ morale: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "leave_it_where_it_is",
        label: "Leave It",
        resultText: "You leave the bundle for whoever was meant to find it.",
        resolvedBodyText:
          "Some gifts feel better left alone. You let this one keep waiting.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  })
];
const socialAndKindnessEvents = [
  buildAutomaticEvent({
    id: "friendly_rver_wave",
    title: "Friendly RVer Wave",
    bodyText: "Another RV passes with the kind of wave that says you are both in the same strange little club.",
    category: "recovery",
    artFamily: "easy_road",
    weight: 2,
    effects: buildEffects({ pressureRelief: 1 }),
    audioTone: "success",
    resultText: "A passing wave softens the road a little.",
    resolvedBodyText:
      "It is only a wave, but it reminds the whole RV that the road is full of other people trying to make the same life work."
  }),
  buildChoiceEvent({
    id: "helpful_mechanic_tip",
    title: "Helpful Mechanic Tip",
    bodyText: "At a stoplight, a mechanic in an old truck points out something small worth checking before it turns rude.",
    category: "rv_condition",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      conditionMax: 85
    },
    choices: [
      buildChoice({
        id: "listen_and_check",
        label: "Listen And Check",
        resultText: "You lose a few miles and gain a little steadiness.",
        resolvedBodyText:
          "You take the advice seriously, make the small check, and come away glad you did.",
        effects: buildEffects({ miles: -3, condition: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "thank_and_move_on",
        label: "Thank Them And Move On",
        resultText: "You take the warning as a kindness and keep going.",
        resolvedBodyText:
          "You thank them for the look-out and decide the road still has your next minute.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "church_lunch_board",
    title: "Church Lunch Board",
    bodyText: "A church sign announces lunch today and manages to make the whole idea feel warm instead of salesy.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 2,
      cashMin: 7
    },
    choices: [
      buildChoice({
        id: "stop_for_lunch",
        label: "Stop In",
        resultText: "The stop costs cash and gives the cabin something gentler back.",
        resolvedBodyText:
          "You go in, eat something simple, and leave feeling as though the day has been treated kindly by strangers.",
        effects: buildEffects({ cash: -7, morale: 5 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "keep_moving_past_lunch",
        label: "Keep Moving",
        resultText: "You let the lunch board bless somebody else's day.",
        resolvedBodyText:
          "The smell and promise stay behind while the road keeps asking for miles.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "veteran_with_hose",
    title: "Veteran With Hose",
    bodyText: "A veteran watering a patch of roadside flowers waves you toward a hose with matter-of-fact generosity.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      waterPercentMax: 65
    },
    choices: [
      buildChoice({
        id: "accept_the_refill",
        label: "Accept The Refill",
        resultText: "You accept the kindness and leave steadier than before.",
        resolvedBodyText:
          "The hose is real, the offer is sincere, and the whole exchange feels like the country remembering how to be decent.",
        effects: buildEffects({ water: 3, morale: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "decline_politely",
        label: "Decline Politely",
        resultText: "You thank them and keep the road under you.",
        resolvedBodyText:
          "You wave, thank them for the offer, and keep moving with the warmth of it anyway.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "travel_story_talker",
    title: "Travel Story Talker",
    bodyText: "At a pullout, someone starts telling the kind of road story that is probably too long and maybe exactly what the cabin needs.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      pressureScoreMax: 3
    },
    choices: [
      buildChoice({
        id: "chat_a_while",
        label: "Chat A While",
        resultText: "The stop costs miles and gives back a little ease.",
        resolvedBodyText:
          "You listen longer than planned, but the road wisdom and harmless ramble do the cabin more good than you expected.",
        effects: buildEffects({ miles: -4, morale: 1, pressureRelief: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "excuse_yourself",
        label: "Excuse Yourself",
        resultText: "You keep the stop short and the day moving.",
        resolvedBodyText:
          "You smile, make a clean exit, and choose the simpler version of the day.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "suspicious_shortcut_guy",
    title: "Suspicious Shortcut Guy",
    bodyText: "A man at a gas pump offers a shortcut with the energy of somebody who really enjoys being believed.",
    category: "travel",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 3,
      pressureScoreMin: 2
    },
    choices: [
      buildChoice({
        id: "follow_the_advice",
        label: "Follow The Advice",
        resultText: "You decide to let the stranger's confidence stand in for proof.",
        resolvedBodyText:
          "You choose to trust the enthusiasm and see where it leads.",
        randomOutcomes: [
          buildRandomOutcome({
            id: "suspicious_tip_was_right",
            weight: 35,
            resultText: "Against the odds, the shortcut is real.",
            resolvedBodyText:
              "The odd advice turns out to be good advice, and the road gives you a rare little surprise.",
            effects: buildEffects({ miles: 10 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "suspicious_tip_was_not_right",
            weight: 65,
            resultText: "The shortcut turns into the sort of story you did not need today.",
            resolvedBodyText:
              "The route wanders exactly the way it looked like it might. You make it back with less faith than before.",
            effects: buildEffects({ miles: -7 }),
            audioTone: "bad_fail"
          })
        ]
      }),
      buildChoice({
        id: "ignore_the_advice",
        label: "Ignore It",
        resultText: "You keep the known road and let the legend stay untested.",
        resolvedBodyText:
          "The highway may be slower, but at least it is honest about itself.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "lemon_from_a_cooler",
    title: "Lemon From A Cooler",
    bodyText: "A cooler with a handwritten sign offers lemons and lemonade with no brand but a lot of charm.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 4
    },
    choices: [
      buildChoice({
        id: "trust_the_handwritten_sign",
        label: "Trust The Sign",
        resultText: "You buy in for a few dollars and hope the charm is real.",
        resolvedBodyText:
          "You leave the money, take the offering, and let the little gamble sweeten the next part of the road.",
        effects: buildEffects({ cash: -4 }),
        randomOutcomes: [
          buildRandomOutcome({
            id: "cooler_lifts_the_mood",
            weight: 50,
            resultText: "The stop turns out to be exactly the small kindness you hoped for.",
            resolvedBodyText:
              "It is cold, bright, and unexpectedly cheering in the heat.",
            effects: buildEffects({ morale: 2 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "cooler_has_a_small_snack",
            weight: 50,
            resultText: "It is not fancy, but it does improve the day a little.",
            resolvedBodyText:
              "The stop gives back something simple and human, which is enough.",
            effects: buildEffects({ morale: 1 }),
            audioTone: "success"
          })
        ]
      }),
      buildChoice({
        id: "keep_driving_past_lemons",
        label: "Keep Going",
        resultText: "You let the handwritten charm stay where it is.",
        resolvedBodyText:
          "Some sweetness can live perfectly well in the rearview mirror.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "kids_selling_bracelets",
    title: "Kids Selling Bracelets",
    bodyText: "Two kids at a roadside folding chair hold up bracelets with the solemn determination of small business owners.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 5
    },
    choices: [
      buildChoice({
        id: "buy_a_bracelet",
        label: "Buy One",
        resultText: "You spend the cash and come away smiling.",
        resolvedBodyText:
          "The bracelet itself is not the point. The whole exchange is.",
        effects: buildEffects({ cash: -5, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "decline_kindly",
        label: "Decline Kindly",
        resultText: "You wave kindly and keep the day moving.",
        resolvedBodyText:
          "They wave back, business undamaged, and the road keeps rolling.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "shared_dump_station_tip",
    title: "Shared Dump Station Tip",
    bodyText: "Another traveler leans over with a dump-station tip delivered in the tone of a person who has earned it the hard way.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 4
    },
    choices: [
      buildChoice({
        id: "take_the_tip",
        label: "Take The Tip",
        resultText: "You make the small detour and feel a little more sorted afterward.",
        resolvedBodyText:
          "The detour is not exciting, but the RV feels more civilized once it is done.",
        effects: buildEffects({ miles: -4, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "stay_on_route",
        label: "Stay On Route",
        resultText: "You thank them and stay with your own plan.",
        resolvedBodyText:
          "You keep the advice in mind and let a future version of yourself decide whether to use it.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "roadside_musician",
    title: "Roadside Musician",
    bodyText: "At a rest stop, someone is making real music for a tiny audience and the open air.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 3
    },
    choices: [
      buildChoice({
        id: "stop_and_tip",
        label: "Stop And Tip",
        resultText: "The music costs a few dollars and buys back a better mood.",
        resolvedBodyText:
          "You listen, tip, and head back to the RV carrying a lighter version of the day.",
        effects: buildEffects({ cash: -3, morale: 3, pressureRelief: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "roll_on_past_music",
        label: "Roll On",
        resultText: "You let the song belong to the stop instead of the day.",
        resolvedBodyText:
          "The melody follows you only for a little while, which is its own sort of gift.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  })
];
const comfortAndFoodEvents = [
  buildChoiceEvent({
    id: "good_coffee_exit",
    title: "Good Coffee Exit",
    bodyText: "A billboard promises very good coffee, and the whole cabin believes it at once.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 2,
    triggerConditions: {
      cashMin: 6,
      minDay: 2
    },
    choices: [
      buildChoice({
        id: "stop_for_coffee",
        label: "Stop For Coffee",
        resultText: "You pay the coffee price and get some of the day back in return.",
        resolvedBodyText:
          "It is good coffee, which is enough to feel briefly miraculous on the road.",
        effects: buildEffects({ cash: -6, morale: 2, pressureRelief: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "skip_the_exit",
        label: "Skip It",
        resultText: "You keep your cash and your forward motion.",
        resolvedBodyText:
          "The sign fades behind you, still making promises to the next tired traveler.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "rest_area_stretch",
    title: "Rest Area Stretch",
    bodyText: "A clean rest area appears at exactly the point where everyone in the RV notices their own knees.",
    category: "morale",
    artFamily: "easy_road",
    weight: 2,
    triggerConditions: {
      minDay: 2
    },
    choices: [
      buildChoice({
        id: "take_five",
        label: "Take Five",
        resultText: "The short stop costs miles and returns patience.",
        resolvedBodyText:
          "You walk a little, stretch a little, and come back to the seats less like prisoners and more like travelers again.",
        effects: buildEffects({ miles: -3, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "keep_the_wheels_turning",
        label: "Keep Rolling",
        resultText: "You keep the road's momentum instead.",
        resolvedBodyText:
          "You pass the rest area by and let the next stop carry the job.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "sunset_pullout_pause",
    title: "Sunset Pullout",
    bodyText: "A pullout catches the whole sky at once and makes even the tiredest person sit up a little.",
    category: "morale",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      minDay: 2,
      pressureScoreMax: 3
    },
    choices: [
      buildChoice({
        id: "stop_and_watch",
        label: "Stop And Enjoy It",
        resultText: "You spend a few miles on beauty and do not regret it.",
        resolvedBodyText:
          "The sky gets the whole cabin quiet in the good way for a minute, which is rarer than it should be.",
        effects: buildEffects({ miles: -3, morale: 3 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "press_on_past_sunset",
        label: "Press On",
        resultText: "You keep the sunset in the corner of the windshield and keep going.",
        resolvedBodyText:
          "Some beauty has to be enjoyed in motion. Today is one of those days.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "warm_bakery_smell",
    title: "Warm Bakery Smell",
    bodyText: "A bakery breathes out onto the road so convincingly that the RV nearly turns itself.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 9
    },
    choices: [
      buildChoice({
        id: "stop_for_bakery",
        label: "Stop In",
        resultText: "It costs money and buys back a great deal of cheer.",
        resolvedBodyText:
          "You come back out with warm paper bags and the kind of smell that makes even the next traffic light feel more forgivable.",
        effects: buildEffects({ cash: -9, morale: 5 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "stay_strong",
        label: "Keep Driving",
        resultText: "You remain admirably sensible and only slightly haunted.",
        resolvedBodyText:
          "The bakery keeps its warm little kingdom, and the RV keeps its budget.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "cold_soda_machine",
    title: "Cold Soda Machine",
    bodyText: "A humming soda machine stands in the shade with all the dignity of a desert oasis.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 2,
    triggerConditions: {
      cashMin: 4,
      sunlightMin: 0.85
    },
    choices: [
      buildChoice({
        id: "buy_drinks",
        label: "Buy Drinks",
        resultText: "The drinks cost little and help more than they should.",
        resolvedBodyText:
          "Cold cans in warm hands improve the next part of the drive in small but undeniable ways.",
        effects: buildEffects({ cash: -4, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "leave_the_machine",
        label: "Keep Moving",
        resultText: "You keep your cash and let the machine hum to itself.",
        resolvedBodyText:
          "The stop remains hypothetical, which is sometimes the cleanest sort of discipline.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "nap_debate_pullout",
    title: "Nap Debate",
    bodyText: "A tired argument breaks out over whether the day wants five more miles or twenty good minutes of not being awake.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 3,
      comfortPolicies: [COMFORT_POLICIES.FRUGAL, COMFORT_POLICIES.BALANCED]
    },
    choices: [
      buildChoice({
        id: "take_the_short_rest",
        label: "Short Rest",
        resultText: "The nap costs miles and gives the cabin back some tenderness.",
        resolvedBodyText:
          "The stop is brief, a little awkward, and exactly what the RV needed.",
        effects: buildEffects({ miles: -5, morale: 3, pressureRelief: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "push_on_anyway",
        label: "Push On",
        resultText: "You keep the day moving and the debate unresolved.",
        resolvedBodyText:
          "The road wins the argument, which does not mean everyone feels good about it.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildAutomaticEvent({
    id: "window_breeze_mood",
    title: "Window Breeze Mood",
    bodyText: "For a little while, the breeze through the window is exactly right and nobody asks it to be more than that.",
    category: "morale",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      sunlightMin: 0.75,
      sunlightMax: 0.95
    },
    effects: buildEffects({ morale: 1 }),
    audioTone: "success",
    resultText: "A good breeze improves the mood of the road.",
    resolvedBodyText:
      "Nothing changes except the air and what it does to people. That is enough."
  }),
  buildChoiceEvent({
    id: "tiny_diner_jackpot",
    title: "Tiny Diner Jackpot",
    bodyText: "A plain little diner turns out to smell too good to dismiss and too lucky to ignore.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 11
    },
    choices: [
      buildChoice({
        id: "stop_and_eat",
        label: "Stop And Eat",
        resultText: "You spend real cash and get a very good road meal in return.",
        resolvedBodyText:
          "The food is better than it has any business being, and the whole RV feels treated well by the world for a change.",
        effects: buildEffects({ cash: -11, morale: 7, pressureRelief: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "drive_past_the_diner",
        label: "Keep Driving",
        resultText: "You stay loyal to your plan and leave the miracle where it is.",
        resolvedBodyText:
          "The diner remains a legend you chose not to test. The day goes on without it.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "overpriced_snack_shack",
    title: "Overpriced Snack Shack",
    bodyText: "The prices are offensive, the smell is convincing, and everybody in the RV notices both at once.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 6,
      pressureScoreMin: 2
    },
    choices: [
      buildChoice({
        id: "pay_too_much_anyway",
        label: "Pay Too Much Anyway",
        resultText: "You give in, grumble about it, and still feel a little better after.",
        resolvedBodyText:
          "The snack is absolutely overpriced and somehow still not a mistake.",
        effects: buildEffects({ cash: -6, morale: 2 }),
        audioTone: "neutral"
      }),
      buildChoice({
        id: "refuse_on_principle",
        label: "Refuse On Principle",
        resultText: "You keep your money and stay mildly annoyed about the whole idea.",
        resolvedBodyText:
          "You reject the prices with dignity, which does not stop the cabin from thinking about snacks for a while.",
        effects: buildEffects({ pressureStrain: 1 }),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "breezy_lunch_bench",
    title: "Breezy Lunch Bench",
    bodyText: "A bench catches a good breeze and quietly suggests that lunch could happen here instead of later.",
    category: "recovery",
    artFamily: "easy_road",
    weight: 1,
    choices: [
      buildChoice({
        id: "pause_for_lunch",
        label: "Pause For Lunch",
        resultText: "You trade a few miles for a better middle of the day.",
        resolvedBodyText:
          "The simple pause turns the afternoon into something the RV can live with more easily.",
        effects: buildEffects({ miles: -3, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "eat_later",
        label: "Eat Later",
        resultText: "You save the stop and keep the road moving.",
        resolvedBodyText:
          "The bench remains one more possible life you did not choose today.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  })
];
const animalsAndSceneryEvents = [
  buildAutomaticEvent({
    id: "deer_at_shoulder",
    title: "Deer At The Shoulder",
    bodyText: "A deer appears near the shoulder and asks for your full attention, whether or not it ever steps into the lane.",
    category: "travel",
    artFamily: "easy_road",
    weight: 2,
    effects: buildEffects({ miles: -3 }),
    audioTone: "neutral",
    resultText: "The slowdown for deer costs a few miles.",
    resolvedBodyText:
      "You ease down and watch carefully until the moment passes. It is the only correct answer, and it still costs time."
  }),
  buildAutomaticEvent({
    id: "hawk_thermals",
    title: "Hawk Thermals",
    bodyText: "A hawk rides the thermals beside the road with an ease that improves the whole view.",
    category: "morale",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      sunlightMin: 0.85
    },
    effects: buildEffects({ morale: 1 }),
    audioTone: "success",
    resultText: "The hawk gives the road a better mood.",
    resolvedBodyText:
      "For a moment, everybody watches the same graceful thing and gets quieter in the good way."
  }),
  buildAutomaticEvent({
    id: "burro_crossing",
    title: "Burro Crossing",
    bodyText: "A few burros turn the road into a negotiation conducted entirely on their terms.",
    category: "recovery",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      minDay: 2
    },
    effects: buildEffects({ miles: -4, morale: 1 }),
    audioTone: "neutral",
    resultText: "The burros cost time and somehow improve the day anyway.",
    resolvedBodyText:
      "They do not hurry for you, and eventually that starts to feel fair. The road resumes with everyone smiling despite themselves."
  }),
  buildChoiceEvent({
    id: "wildflower_shoulder",
    title: "Wildflower Shoulder",
    bodyText: "The shoulder flashes with wildflowers bright enough to interrupt even a practical mood.",
    category: "morale",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      sunlightMin: 0.8
    },
    choices: [
      buildChoice({
        id: "pull_over_for_a_minute",
        label: "Pull Over For A Minute",
        resultText: "You spend a little road on beauty.",
        resolvedBodyText:
          "It only takes a moment, but the flowers reset something small inside the whole RV.",
        effects: buildEffects({ miles: -2, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "keep_driving_past_flowers",
        label: "Keep Driving",
        resultText: "You carry the color in the side window and let that be enough.",
        resolvedBodyText:
          "The flowers keep running beside you until the road decides otherwise.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildAutomaticEvent({
    id: "bird_on_mirror",
    title: "Bird On The Mirror",
    bodyText: "A bird lands on the mirror for a heartbeat and then is gone again.",
    category: "morale",
    artFamily: "easy_road",
    weight: 1,
    effects: buildEffects({ morale: 1 }),
    audioTone: "success",
    resultText: "The tiny moment brightens the cabin.",
    resolvedBodyText:
      "It is almost nothing. That is why it feels so perfect."
  }),
  buildChoiceEvent({
    id: "coyote_watch",
    title: "Coyote Watch",
    bodyText: "A coyote stands out in the open long enough to make the whole RV notice.",
    category: "morale",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      minDay: 3
    },
    choices: [
      buildChoice({
        id: "stop_to_watch",
        label: "Stop To Watch",
        resultText: "You lose a little time and gain a better memory of the day.",
        resolvedBodyText:
          "You pull over, watch quietly, and let the coyote belong to itself while you borrow a minute from the road.",
        effects: buildEffects({ miles: -3, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "continue_past_coyote",
        label: "Continue",
        resultText: "You keep the moment brief and moving.",
        resolvedBodyText:
          "The coyote slips into the mirror and the day goes on.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildAutomaticEvent({
    id: "scenic_bluff_wind",
    title: "Scenic Bluff Wind",
    bodyText: "A high bluff opens to a startling view and a careful, windy stretch of road beside it.",
    category: "recovery",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      sunlightMin: 0.8
    },
    effects: buildEffects({ morale: 1, miles: -2 }),
    audioTone: "neutral",
    resultText: "The stunning bluff gives back a little mood while costing a little pace.",
    resolvedBodyText:
      "You drive carefully through the exposed stretch and come away with a better view inside your head than the day strictly needed to provide."
  }),
  buildAutomaticEvent({
    id: "goose_standoff",
    title: "Goose Standoff",
    bodyText: "A goose decides the shoulder is not enough territory and holds firm on its absurd rights.",
    category: "travel",
    artFamily: "roadside_encounter",
    weight: 1,
    effects: buildEffects({ miles: -2 }),
    audioTone: "neutral",
    resultText: "The goose standoff costs a tiny slice of the day.",
    resolvedBodyText:
      "You wait because geese do not negotiate with reason. Eventually the road is returned to you."
  }),
  buildAutomaticEvent({
    id: "dust_devil_spin",
    title: "Dust Devil",
    bodyText: "A dust devil spins itself across the shoulder with more attitude than size.",
    category: "morale",
    artFamily: "dusty_road",
    weight: 1,
    triggerConditions: {
      sunlightMin: 0.9
    },
    effects: buildEffects({ miles: -2, morale: -1 }),
    audioTone: "neutral",
    resultText: "The little dust storm slows you down and roughens the mood.",
    resolvedBodyText:
      "It is small, strange, and just annoying enough to matter."
  }),
  buildAutomaticEvent({
    id: "butterfly_burst",
    title: "Butterfly Burst",
    bodyText: "A sudden scatter of butterflies lifts off beside the road like the day decided to show off for a second.",
    category: "morale",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      minDay: 2,
      sunlightMin: 0.8
    },
    effects: buildEffects({ morale: 1 }),
    audioTone: "success",
    resultText: "The brief burst of color lifts the cabin mood.",
    resolvedBodyText:
      "No one can keep it for long, which may be why it helps at all."
  })
];
const weirdAmericanaEvents = [
  buildChoiceEvent({
    id: "giant_fiberglass_muffler_man",
    title: "Giant Fiberglass Muffler Man",
    bodyText: "A giant roadside statue appears ahead with all the calm dignity of a thing that knows exactly why it exists.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 2
    },
    choices: [
      buildChoice({
        id: "stop_for_a_photo",
        label: "Stop For A Photo",
        resultText: "You spend a few miles on roadside legend.",
        resolvedBodyText:
          "The photo is silly and perfect. The whole RV feels better for leaning into it.",
        effects: buildEffects({ miles: -3, morale: 3 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "keep_rolling_past_it",
        label: "Keep Rolling",
        resultText: "You salute the giant in spirit and stay on pace.",
        resolvedBodyText:
          "The statue passes into memory without requiring a stop.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildAutomaticEvent({
    id: "mystery_light_on_ridge",
    title: "Mystery Light On The Ridge",
    bodyText: "Far off on a ridge, a strange little light lingers where no obvious road seems to be.",
    category: "recovery",
    artFamily: "ominous_road",
    weight: 1,
    triggerConditions: {
      minDay: 4
    },
    effects: buildEffects({ morale: 1, pressureRelief: 1 }),
    audioTone: "neutral",
    resultText: "The odd light leaves the cabin more intrigued than bothered.",
    resolvedBodyText:
      "No one can explain it, and no one really needs to. The mystery makes the road feel larger."
  }),
  buildAutomaticEvent({
    id: "ufo_bumper_sticker_van",
    title: "UFO Bumper Sticker Van",
    bodyText: "A van covered in impossible amounts of bumper-sticker conviction pulls alongside and then away again.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 3
    },
    effects: buildEffects({ morale: 1 }),
    audioTone: "success",
    resultText: "The sticker van gives everyone something to laugh about.",
    resolvedBodyText:
      "You will not agree on the best sticker, which is part of the fun."
  }),
  buildAutomaticEvent({
    id: "prairie_dog_tollbooth",
    title: "Prairie Dog Tollbooth",
    bodyText: "A prairie dog pops up near a fence post in a way that makes somebody insist it is manning a tollbooth.",
    category: "morale",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      minDay: 2
    },
    effects: buildEffects({ morale: 1 }),
    audioTone: "success",
    resultText: "The ridiculous moment improves the mood for free.",
    resolvedBodyText:
      "No actual toll is paid, though the joke lasts longer than the sighting does."
  }),
  buildChoiceEvent({
    id: "elvis_fuel_stop",
    title: "Elvis Fuel Stop",
    bodyText: "A themed roadside stop leans so hard into Elvis that resisting it begins to feel rude.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 8,
      minDay: 3
    },
    choices: [
      buildChoice({
        id: "buy_the_snack_combo",
        label: "Buy The Snack Combo",
        resultText: "It costs cash and buys a very specific kind of joy.",
        resolvedBodyText:
          "The stop is excessive in exactly the right way, and the snack combo comes back to the RV like a souvenir from a stranger road.",
        effects: buildEffects({ cash: -8, morale: 3 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "keep_moving_past_elvis",
        label: "Keep Moving",
        resultText: "You salute the king from the highway and keep your wallet shut.",
        resolvedBodyText:
          "Not every roadside shrine needs to become your stop today.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "alien_jerky_shack",
    title: "Alien Jerky Shack",
    bodyText: "A jerky shack with extraterrestrial branding appears exactly far enough from anywhere to feel suspiciously committed.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 10,
      minDay: 4
    },
    choices: [
      buildChoice({
        id: "try_the_alien_jerky",
        label: "Try It",
        resultText: "You buy the jerky and accept whatever story follows.",
        resolvedBodyText:
          "The bag itself is half the purchase. The taste is left to fate.",
        effects: buildEffects({ cash: -10, morale: 2 }),
        randomOutcomes: [
          buildRandomOutcome({
            id: "alien_jerky_was_a_hit",
            weight: 50,
            resultText: "Against reason, the alien jerky is actually good.",
            resolvedBodyText:
              "The whole RV is surprised into laughter and approval.",
            effects: buildEffects({ morale: 2 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "alien_jerky_was_not_a_hit",
            weight: 50,
            resultText: "The alien jerky turns out to be more memorable than enjoyable.",
            resolvedBodyText:
              "No one wants a second piece, which is itself a kind of shared experience.",
            effects: buildEffects({ morale: -1 }),
            audioTone: "neutral"
          })
        ]
      }),
      buildChoice({
        id: "skip_the_jerky",
        label: "Skip It",
        resultText: "You let the shack keep its mystery.",
        resolvedBodyText:
          "The best version of some stories is the one you do not test directly.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "reptile_roof_photo",
    title: "Reptile Roof Photo",
    bodyText: "A building ahead is wearing an enormous fiberglass reptile like a perfectly sensible hat.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 3
    },
    choices: [
      buildChoice({
        id: "pull_over_for_a_look",
        label: "Pull Over For A Look",
        resultText: "You spend a little road on roadside absurdity.",
        resolvedBodyText:
          "The photo is worth the stop simply because the world should not get away with this sort of thing unnoticed.",
        effects: buildEffects({ miles: -2, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "continue_past_reptile",
        label: "Continue",
        resultText: "You let the reptile keep its rooftop kingdom.",
        resolvedBodyText:
          "Not every strange landmark needs your direct involvement.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "miracle_brake_for_pie",
    title: "Miracle Brake For Pie",
    bodyText: "A pie sign arrives at just the right level of weakness in the cabin to feel almost supernatural.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 12,
      minDay: 3,
      pressureScoreMin: 1
    },
    choices: [
      buildChoice({
        id: "succumb_to_pie",
        label: "Succumb",
        resultText: "You give in magnificently and everybody benefits.",
        resolvedBodyText:
          "The pie is indulgent, unnecessary, and exactly right for the moment.",
        effects: buildEffects({ cash: -12, morale: 5 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "resist_the_sign",
        label: "Resist",
        resultText: "You keep the cash and carry a small, noble disappointment.",
        resolvedBodyText:
          "The cabin respects the discipline more in theory than in practice.",
        effects: buildEffects({ pressureStrain: 1 }),
        audioTone: "neutral"
      })
    ]
  }),
  buildAutomaticEvent({
    id: "singing_car_wash_sign",
    title: "Singing Car Wash Sign",
    bodyText: "An electronic sign outside a car wash is doing far too much and somehow earns the effort.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    effects: buildEffects({ morale: 1 }),
    audioTone: "success",
    resultText: "The ridiculous sign improves the mood a little.",
    resolvedBodyText:
      "It is not the sort of thing anyone would miss if it did not exist, which is why it feels like a gift."
  }),
  buildAutomaticEvent({
    id: "lost_mascot_suit",
    title: "Lost Mascot Suit",
    bodyText: "Somebody in a mascot suit is standing beside the road in a way that makes no immediate sense and causes no obvious harm.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 4
    },
    effects: buildEffects({ morale: 1 }),
    audioTone: "success",
    resultText: "The inexplicable mascot sighting lifts the cabin mood.",
    resolvedBodyText:
      "No one can explain it. No one needs to. The road is allowed one mystery in a cheap animal suit."
  })
];
const boondockingUtilityEvents = [
  buildChoiceEvent({
    id: "quiet_blm_tip",
    title: "Quiet BLM Tip",
    bodyText: "Another traveler mentions a quiet dispersed spot ahead in the tone of someone sharing real treasure.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 3
    },
    choices: [
      buildChoice({
        id: "mark_it_down_and_detour",
        label: "Take The Tip",
        resultText: "The slight detour costs miles and buys some peace of mind for later.",
        resolvedBodyText:
          "You make a note, drift a little out of the straight line, and come back feeling like the road may have given you something useful.",
        effects: buildEffects({ miles: -4, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "stay_on_route_for_now",
        label: "Stay On Route",
        resultText: "You leave the tip for another day.",
        resolvedBodyText:
          "Useful knowledge is still useful even if you do not cash it in immediately.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "fresh_hose_bib",
    title: "Fresh Hose Bib",
    bodyText: "A clean hose bib and a polite little sign offer exactly the kind of practical temptation road life teaches you to notice.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      waterPercentMax: 70
    },
    choices: [
      buildChoice({
        id: "top_off_politely",
        label: "Top Off Politely",
        resultText: "You stop for a quick refill and come away steadier.",
        resolvedBodyText:
          "It only takes a minute to top off enough water to make the day feel less narrow.",
        effects: buildEffects({ water: 2, miles: -2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "skip_the_hose_bib",
        label: "Skip It",
        resultText: "You leave the hose bib for another traveler.",
        resolvedBodyText:
          "The stop stays available in theory, which will have to do for now.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "shade_ramada_pullin",
    title: "Shade Ramada",
    bodyText: "A roadside ramada offers a little square of mercy against the full heat of the day.",
    category: "morale",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      sunlightMin: 0.9
    },
    choices: [
      buildChoice({
        id: "stop_under_the_ramada",
        label: "Stop For A Few Minutes",
        resultText: "The pause costs miles and gives back some composure.",
        resolvedBodyText:
          "The shade is thin but real, and the whole RV treats it like a little blessing.",
        effects: buildEffects({ miles: -3, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "keep_rolling_through_heat",
        label: "Continue",
        resultText: "You decide the day can stay unbroken.",
        resolvedBodyText:
          "The ramada passes behind you, still holding its small patch of mercy for someone else.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "solar_nerd_encounter",
    title: "Solar Nerd Encounter",
    bodyText: "At a stop, another traveler brightens visibly at the sight of your panels and launches into genuine, charmingly specific advice.",
    category: "energy",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      batteryPercentMax: 65,
      minDay: 3
    },
    choices: [
      buildChoice({
        id: "hear_them_out",
        label: "Hear Them Out",
        resultText: "You spend a few miles on community and possible optimization.",
        resolvedBodyText:
          "The advice is detailed, sincere, and maybe even useful. The whole exchange feels oddly nourishing.",
        effects: buildEffects({ miles: -3, morale: 1 }),
        randomOutcomes: [
          buildRandomOutcome({
            id: "tip_helped_charge",
            weight: 50,
            resultText: "One of the suggestions actually helps the battery right away.",
            resolvedBodyText:
              "You try the simplest adjustment first, and the battery responds better than expected.",
            effects: buildEffects({ battery: 3 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "tip_was_just_good_company",
            weight: 50,
            resultText: "The advice is more companionable than transformative, but that still counts.",
            resolvedBodyText:
              "Even if the system changes little, it feels good to have met someone who speaks this particular language of the road.",
            effects: buildEffects(),
            audioTone: "neutral"
          })
        ]
      }),
      buildChoice({
        id: "smile_and_move_on",
        label: "Smile And Move On",
        resultText: "You keep the stop brief and the road uncomplicated.",
        resolvedBodyText:
          "You thank them kindly and protect the next few miles from becoming a technical seminar.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "water_jug_swap",
    title: "Water Jug Swap",
    bodyText: "Another traveler offers a spare jug the way road people do when they have decided a stranger is part of the same weather.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      waterPercentMax: 50
    },
    choices: [
      buildChoice({
        id: "accept_the_jug",
        label: "Accept",
        resultText: "You take the help and feel steadier for it.",
        resolvedBodyText:
          "The jug is not huge, but the gesture is. That matters too.",
        effects: buildEffects({ water: 2, morale: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "decline_the_jug",
        label: "Decline",
        resultText: "You thank them and keep to your own plan.",
        resolvedBodyText:
          "You leave the kindness where it was offered and carry it with you anyway.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildAutomaticEvent({
    id: "dump_queue_delay",
    title: "Dump Queue",
    bodyText: "A little queue forms at a dump station and turns practicality into a slow, mildly comic ritual.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 4
    },
    effects: buildEffects({ miles: -4, morale: 1 }),
    audioTone: "neutral",
    resultText: "The queue costs time and leaves the RV a little more at ease afterward.",
    resolvedBodyText:
      "The wait is not thrilling, but it does buy peace of mind once it is done."
  }),
  buildChoiceEvent({
    id: "propane_advice_debate",
    title: "Propane Advice Debate",
    bodyText: "Two campers are comparing propane strategies with the intensity of philosophers and wave you into the argument.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 3
    },
    choices: [
      buildChoice({
        id: "stop_and_compare_notes",
        label: "Compare Notes",
        resultText: "The chat costs miles and lowers the strain a little.",
        resolvedBodyText:
          "You do not leave with a universal truth, but you do leave feeling less alone in the practical absurdities of this kind of travel.",
        effects: buildEffects({ miles: -3, pressureRelief: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "keep_the_discussion_moving",
        label: "Continue",
        resultText: "You leave the propane theology to others.",
        resolvedBodyText:
          "The debate continues without you while the highway asks for the next choice instead.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildAutomaticEvent({
    id: "solar_reflection_trick",
    title: "Solar Reflection Trick",
    bodyText: "A particularly bright stretch of light bounces around the RV in just the sort of way the roof likes best.",
    category: "energy",
    artFamily: "tailwind_road",
    weight: 1,
    triggerConditions: {
      sunlightMin: 0.95,
      batteryPercentMax: 70
    },
    effects: buildEffects({ battery: 3 }),
    audioTone: "success",
    resultText: "The bright stretch gives the battery a small lift.",
    resolvedBodyText:
      "The roof catches the good light cleanly, and the battery thanks you in its own quiet language."
  }),
  buildChoiceEvent({
    id: "hidden_picnic_ramada",
    title: "Hidden Picnic Ramada",
    bodyText: "A hidden ramada and picnic table appear off the shoulder like a tiny secret the road decided to share.",
    category: "recovery",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      minDay: 2
    },
    choices: [
      buildChoice({
        id: "pause_in_the_hidden_spot",
        label: "Pause There",
        resultText: "You spend a few miles and get some of the day back in return.",
        resolvedBodyText:
          "The stop is plain, shaded, and somehow exactly right.",
        effects: buildEffects({ miles: -3, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "keep_the_wheels_turning_hidden",
        label: "Keep Moving",
        resultText: "You leave the hidden spot to the next lucky traveler.",
        resolvedBodyText:
          "The ramada slips back into being someone else's discovery.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "volunteer_refill_day",
    title: "Volunteer Refill Day",
    bodyText: "A little town has set up a volunteer refill table, cheerful and practical in equal measure.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      waterPercentMax: 60,
      minDay: 3
    },
    choices: [
      buildChoice({
        id: "accept_the_community_refill",
        label: "Accept",
        resultText: "You take the refill and leave feeling steadier than before.",
        resolvedBodyText:
          "The water helps, but the human warmth around it helps too.",
        effects: buildEffects({ water: 3, morale: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "pass_by_the_refill_table",
        label: "Pass By",
        resultText: "You keep moving and leave the refill for others.",
        resolvedBodyText:
          "The offer stays behind, still kind even unanswered.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  })
];
const riskAndConversionEvents = [
  buildChoiceEvent({
    id: "bargain_fuel_rumor",
    title: "Bargain Fuel Rumor",
    bodyText: "A rumor drifts your way about cheaper fuel just far enough off-route to be dangerous.",
    category: "travel",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 3,
      pressureScoreMin: 1
    },
    choices: [
      buildChoice({
        id: "detour_for_the_bargain",
        label: "Detour For It",
        resultText: "You chase the bargain and let the road judge the decision.",
        resolvedBodyText:
          "It is the sort of choice that feels either clever or foolish with very little middle ground.",
        randomOutcomes: [
          buildRandomOutcome({
            id: "fuel_rumor_was_real",
            weight: 50,
            resultText: "The rumor pays off with a small fuel win.",
            resolvedBodyText:
              "Against the odds, the bargain is real enough to matter.",
            effects: buildEffects({ fuel: 1 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "fuel_rumor_wastes_time",
            weight: 50,
            resultText: "The rumor wastes time and gives back nothing.",
            resolvedBodyText:
              "The supposed bargain turns out to be old, wrong, or simply gone. All that remains is the lost time.",
            effects: buildEffects({ miles: -5 }),
            audioTone: "bad_fail"
          })
        ]
      }),
      buildChoice({
        id: "ignore_the_rumor",
        label: "Ignore It",
        resultText: "You keep the known road under you.",
        resolvedBodyText:
          "The bargain may be real for somebody else. Today it is only a rumor.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "hard_sell_souvenir_stop",
    title: "Hard Sell Souvenir Stop",
    bodyText: "A souvenir stop puts more effort into selling kitsch than any reasonable place should.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 7
    },
    choices: [
      buildChoice({
        id: "buy_something_silly",
        label: "Buy Something Silly",
        resultText: "You spend the cash and get a laugh out of it.",
        resolvedBodyText:
          "The souvenir is probably unnecessary. The shared amusement is less so.",
        effects: buildEffects({ cash: -7, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "escape_quickly",
        label: "Escape Quickly",
        resultText: "You keep both your money and your standards.",
        resolvedBodyText:
          "You make a clean exit before the stop turns persuasive.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "questionable_free_camp_sign",
    title: "Questionable Free Camp Sign",
    bodyText: "A hand-painted sign promises free camping with the sort of certainty that invites doubt.",
    category: "recovery",
    artFamily: "ominous_road",
    weight: 1,
    triggerConditions: {
      minDay: 4
    },
    choices: [
      buildChoice({
        id: "investigate_the_sign",
        label: "Investigate",
        resultText: "You give the sign a chance to mean something.",
        resolvedBodyText:
          "You follow the arrow far enough to find out whether it was a real invitation or just roadside theater.",
        randomOutcomes: [
          buildRandomOutcome({
            id: "camp_sign_was_good",
            weight: 40,
            resultText: "The sign leads to a genuinely comforting little find.",
            resolvedBodyText:
              "For once, the hand-painted promise is honest. The discovery brightens the rest of the day.",
            effects: buildEffects({ morale: 3 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "camp_sign_costs_time",
            weight: 30,
            resultText: "The sign mostly costs time and leaves you no better off.",
            resolvedBodyText:
              "The route wanders into nothing much, and the road asks to be taken seriously again.",
            effects: buildEffects({ miles: -4 }),
            audioTone: "bad_fail"
          }),
          buildRandomOutcome({
            id: "camp_sign_was_nothing",
            weight: 30,
            resultText: "The sign turns out to be only a curiosity.",
            resolvedBodyText:
              "Nothing terrible, nothing wonderful, just another oddity on the side of the road.",
            effects: buildEffects(),
            audioTone: "neutral"
          })
        ]
      }),
      buildChoice({
        id: "stay_on_plan",
        label: "Stay On Plan",
        resultText: "You choose the known day over the speculative one.",
        resolvedBodyText:
          "The sign stays mysterious and the highway stays honest.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "lottery_dust_dream",
    title: "Lottery Dust Dream",
    bodyText: "A lottery sign catches the cabin at exactly the wrong moment to make jokes about improbable rescue.",
    category: "morale",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 5,
      pressureScoreMin: 2
    },
    choices: [
      buildChoice({
        id: "buy_a_ticket",
        label: "Buy A Ticket",
        resultText: "You pay for five dollars' worth of fantasy.",
        resolvedBodyText:
          "You buy the ticket knowing full well what it probably is: a tiny paid story about sudden good luck.",
        effects: buildEffects({ cash: -5 }),
        randomOutcomes: [
          buildRandomOutcome({
            id: "ticket_hits_small",
            weight: 5,
            resultText: "Against all good sense, the ticket actually pays.",
            resolvedBodyText:
              "It is not a life-changing win, but it is enough to make the whole RV howl in disbelief.",
            effects: buildEffects({ cash: 25 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "ticket_is_dust",
            weight: 95,
            resultText: "The ticket stays exactly what it probably was.",
            resolvedBodyText:
              "No miracle arrives, only the brief comic pleasure of having imagined one.",
            effects: buildEffects(),
            audioTone: "neutral"
          })
        ]
      }),
      buildChoice({
        id: "keep_driving_no_ticket",
        label: "Keep Driving",
        resultText: "You leave the dream at the counter.",
        resolvedBodyText:
          "The joke remains a joke, and the cash remains yours.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "buy_local_honey",
    title: "Buy Local Honey",
    bodyText: "A roadside cooler offers local honey in jars that seem to glow all on their own.",
    category: "recovery",
    artFamily: "easy_road",
    weight: 1,
    triggerConditions: {
      cashMin: 8
    },
    choices: [
      buildChoice({
        id: "buy_a_jar",
        label: "Buy A Jar",
        resultText: "You spend the cash and bring sweetness back to the RV.",
        resolvedBodyText:
          "The jar is small, sticky, and somehow capable of improving the whole day a little.",
        effects: buildEffects({ cash: -8, morale: 4 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "skip_the_honey",
        label: "Skip It",
        resultText: "You leave the honey for a sweeter budget day.",
        resolvedBodyText:
          "The jars keep their amber shine without you.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "windshield_squeegee_kid",
    title: "Windshield Squeegee Kid",
    bodyText: "At a stop, a kid with a squeegee and serious work ethic offers a cleaner view for a tiny tip.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 3,
      sunlightMin: 0.85
    },
    choices: [
      buildChoice({
        id: "tip_for_the_squeegee",
        label: "Tip Them",
        resultText: "You spend a little and get a better view of the day.",
        resolvedBodyText:
          "The windshield clears, the exchange is kind, and the road in front of you feels slightly more welcoming.",
        effects: buildEffects({ cash: -3, morale: 1 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "decline_the_offer",
        label: "Decline",
        resultText: "You wave thanks and keep the stop brief.",
        resolvedBodyText:
          "The offer stays friendly even unanswered, and the light stays where it was.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "yard_sale_tool_temptation",
    title: "Yard Sale Tool Temptation",
    bodyText: "A yard sale out by the road has one odd tool that looks useless until it suddenly does not.",
    category: "rv_condition",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 6,
      conditionMax: 85
    },
    choices: [
      buildChoice({
        id: "buy_the_odd_tool",
        label: "Buy The Tool",
        resultText: "You spend a little and trust your own hopeful instincts.",
        resolvedBodyText:
          "The tool is strange, cheap, and maybe exactly what the RV needed once in its life.",
        effects: buildEffects({ cash: -6 }),
        randomOutcomes: [
          buildRandomOutcome({
            id: "tool_is_surprisingly_useful",
            weight: 40,
            resultText: "The odd tool turns out to be useful after all.",
            resolvedBodyText:
              "It solves a small annoyance with satisfying certainty. That is more than most yard-sale tools can say.",
            effects: buildEffects({ condition: 1 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "tool_is_just_charming",
            weight: 60,
            resultText: "The tool is mostly a charm purchase, but not a regretted one.",
            resolvedBodyText:
              "Maybe it never earns its cost. The little story around it still does.",
            effects: buildEffects({ morale: 1 }),
            audioTone: "neutral"
          })
        ]
      }),
      buildChoice({
        id: "pass_the_tool_by",
        label: "Pass",
        resultText: "You leave the temptation where it belongs.",
        resolvedBodyText:
          "The tool remains somebody else's strange bargain.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "roadside_donation_kettle",
    title: "Roadside Donation Kettle",
    bodyText: "A donation kettle and a handwritten cause board catch you at a soft enough moment to matter.",
    category: "recovery",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      cashMin: 3
    },
    choices: [
      buildChoice({
        id: "donate_a_little",
        label: "Donate",
        resultText: "You give a little and feel better than the math would predict.",
        resolvedBodyText:
          "The cash leaves your hand and the day feels a little more human for it.",
        effects: buildEffects({ cash: -3, morale: 2 }),
        audioTone: "success"
      }),
      buildChoice({
        id: "keep_driving_past_kettle",
        label: "Continue",
        resultText: "You keep the cash and the road's momentum.",
        resolvedBodyText:
          "Some days generosity takes other forms. Today it becomes a quiet nod from the lane.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildChoiceEvent({
    id: "billboard_dare",
    title: "Billboard Dare",
    bodyText: "A billboard makes an absurd promise with such confidence that the whole RV starts arguing about whether to believe it.",
    category: "travel",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      minDay: 3,
      pressureScoreMin: 2
    },
    choices: [
      buildChoice({
        id: "follow_the_dare",
        label: "Follow It",
        resultText: "You let the billboard have its chance.",
        resolvedBodyText:
          "The promise is too silly to trust and too tempting not to test.",
        randomOutcomes: [
          buildRandomOutcome({
            id: "billboard_surprisingly_pays",
            weight: 30,
            resultText: "The billboard gamble unexpectedly delivers something decent.",
            resolvedBodyText:
              "Against reason, the stop actually turns out worth remembering for kind reasons instead of foolish ones.",
            effects: buildEffects({ morale: 3 }),
            audioTone: "success"
          }),
          buildRandomOutcome({
            id: "billboard_only_costs_time",
            weight: 70,
            resultText: "The billboard's promise collapses into lost time.",
            resolvedBodyText:
              "The grand promise turns out to be marketing with a shoulder. The miles do not admire the joke.",
            effects: buildEffects({ miles: -4 }),
            audioTone: "bad_fail"
          })
        ]
      }),
      buildChoice({
        id: "stay_sensible",
        label: "Stay Sensible",
        resultText: "You keep the ad where it belongs: beside the road, not in charge of it.",
        resolvedBodyText:
          "The billboard can keep its own nonsense. You keep the lane.",
        effects: buildEffects(),
        audioTone: "neutral"
      })
    ]
  }),
  buildAutomaticEvent({
    id: "lucky_service_window",
    title: "Lucky Service Window",
    bodyText: "A roadside air station and helpful attendant line up at exactly the moment the RV can make use of them.",
    category: "rv_condition",
    artFamily: "roadside_encounter",
    weight: 1,
    triggerConditions: {
      conditionMax: 80,
      minDay: 3
    },
    effects: buildEffects({ condition: 1 }),
    audioTone: "success",
    resultText: "A lucky little service break gives the RV back a bit of strength.",
    resolvedBodyText:
      "Nothing dramatic, just the right small help at the right small moment. The sort of luck a road trip learns to respect."
  })
];

export const travelInterruptionExpansionEvents = [
  ...roadAndFlowEvents,
  ...solarAndWeatherEvents,
  ...rvMaintenanceEvents,
  ...findsAndSupplyEvents,
  ...socialAndKindnessEvents,
  ...comfortAndFoodEvents,
  ...animalsAndSceneryEvents,
  ...weirdAmericanaEvents,
  ...boondockingUtilityEvents,
  ...riskAndConversionEvents
];
