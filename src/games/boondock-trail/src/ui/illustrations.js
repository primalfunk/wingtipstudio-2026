import introSetOut from "../../assets/intro/intro-set-out.webp";
import introLiveDayToDay from "../../assets/intro/intro-live-day-to-day.webp";
import introReadTheBand from "../../assets/intro/intro-read-the-band.webp";
import highDesertToRainCoast from "../../assets/images/high_desert_to_rain_coast.webp";
import mesaToRedwoods from "../../assets/images/mesa_to_redwoods.webp";
import basinToMountainLakes from "../../assets/images/basin_to_mountain_lakes.webp";
import neutralRoad from "../../assets/images/neutral_road.webp";
import roughRoad from "../../assets/images/rough_road.webp";
import ominousRoad from "../../assets/images/ominous_road.webp";
import tailwindRoad from "../../assets/images/tailwind_road.webp";
import easyRoad from "../../assets/images/easy_road.webp";
import dustyRoad from "../../assets/images/dusty_road.webp";
import roadsideEncounter from "../../assets/images/roadside_encounter.webp";
import setupTripSetup from "../../assets/scenes/setup-trip-setup.webp";
import travelMorningReview from "../../assets/scenes/travel-morning-review.webp";
import travelResult from "../../assets/scenes/travel-result.webp";
import eventRoadside from "../../assets/scenes/event-roadside.webp";
import campChoice from "../../assets/scenes/camp-choice.webp";
import townStop from "../../assets/scenes/town-stop.webp";
import daySummary from "../../assets/scenes/day-summary.webp";
import landmarkArrival from "../../assets/scenes/landmark-arrival.webp";
import victoryArrival from "../../assets/endings/victory-arrival.webp";
import failureEnd from "../../assets/endings/failure-end.webp";

const scenes = {
  title: {
    skyTop: "#07152f",
    skyBottom: "#173b72",
    sun: "#ffb64c",
    ridge: "#1783a0",
    ground: "#ff4f7b",
    caption: "A long road, a quiet rig, and enough sun to make every choice matter."
  },
  intro_set_out: {
    imageSrc: introSetOut,
    width: 1280,
    height: 717,
    caption: "The trip begins here, with a long road ahead."
  },
  intro_live_day_to_day: {
    imageSrc: introLiveDayToDay,
    width: 1280,
    height: 717,
    caption: "Each day asks for a few simple tradeoffs."
  },
  intro_read_the_band: {
    imageSrc: introReadTheBand,
    width: 1280,
    height: 717,
    caption: "Read the band before you pick."
  },
  setup: {
    imageSrc: setupTripSetup,
    width: 1280,
    height: 640,
    caption: "Pick your road, your crew, and your starting room."
  },
  setup_rain_coast: {
    imageSrc: highDesertToRainCoast,
    width: 1456,
    height: 816,
    caption: "High desert gives way to a colder rain coast."
  },
  setup_mesa_redwoods: {
    imageSrc: mesaToRedwoods,
    width: 1456,
    height: 816,
    caption: "Open mesa miles give way to cool redwoods."
  },
  setup_basin_lakes: {
    imageSrc: basinToMountainLakes,
    width: 1456,
    height: 816,
    caption: "Cold basin country climbs toward mountain lakes."
  },
  travel: {
    imageSrc: travelMorningReview,
    width: 1280,
    height: 640,
    caption: "Look over the road, read the band, and pick the day's drive."
  },
  travel_result: {
    imageSrc: travelResult,
    width: 1280,
    height: 640,
    caption: "Take in what the drive asked of the trip."
  },
  camp: {
    imageSrc: campChoice,
    width: 1280,
    height: 640,
    caption: "Pick the place that will carry you through the night."
  },
  event: {
    imageSrc: eventRoadside,
    width: 1280,
    height: 640,
    caption: "Small moments on the road can help or hurt."
  },
  event_neutral_road: {
    imageSrc: neutralRoad,
    width: 2176,
    height: 544,
    caption: "The road keeps moving until something pulls your eye."
  },
  event_rough_road: {
    imageSrc: roughRoad,
    width: 2176,
    height: 544,
    caption: "The road turns hard and asks a little more of the RV."
  },
  event_ominous_road: {
    imageSrc: ominousRoad,
    width: 2176,
    height: 544,
    caption: "The road feels wrong before you can say exactly why."
  },
  event_tailwind_road: {
    imageSrc: tailwindRoad,
    width: 2176,
    height: 544,
    caption: "For a little while, the road feels easier."
  },
  event_easy_road: {
    imageSrc: easyRoad,
    width: 2176,
    height: 544,
    caption: "Some stretches let the whole trip breathe."
  },
  event_dusty_road: {
    imageSrc: dustyRoad,
    width: 2176,
    height: 544,
    caption: "Dust and weather can make a simple road feel harder."
  },
  event_roadside_encounter: {
    imageSrc: roadsideEncounter,
    width: 2176,
    height: 544,
    caption: "Sometimes the road becomes about the people in it."
  },
  town: {
    imageSrc: townStop,
    width: 1280,
    height: 640,
    caption: "Town offers a steadier way to rest, for a cost."
  },
  summary: {
    imageSrc: daySummary,
    width: 1280,
    height: 640,
    caption: "Take in what changed before the next day begins."
  },
  landmark: {
    imageSrc: landmarkArrival,
    width: 1280,
    height: 640,
    caption: "Landmarks remind you that the road is truly moving."
  },
  victory: {
    imageSrc: victoryArrival,
    width: 1280,
    height: 640,
    caption: "You made it to the end of the road."
  },
  failure: {
    imageSrc: failureEnd,
    width: 1280,
    height: 640,
    caption: "The road ended early this time. See what went wrong."
  }
};

export function renderSceneIllustration(variant, caption) {
  const scene = scenes[variant] ?? scenes.travel;
  const resolvedCaption =
    caption === undefined || caption === null ? scene.caption : String(caption).trim();
  const captionHtml = resolvedCaption ? `<figcaption>${resolvedCaption}</figcaption>` : "";
  const ariaLabel = resolvedCaption || scene.caption || "";

  if (scene.imageSrc) {
    return `
      <figure class="scene-figure">
        <img
          class="scene-image"
          src="${scene.imageSrc}"
          alt=""
          aria-hidden="true"
          width="${scene.width}"
          height="${scene.height}"
          decoding="async"
        />
        ${captionHtml}
      </figure>
    `;
  }

  return `
    <figure class="scene-figure">
      <svg viewBox="0 0 640 320" class="scene-svg" role="img" aria-label="${ariaLabel}">
        <defs>
          <linearGradient id="sky-${variant}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${scene.skyTop}" />
            <stop offset="100%" stop-color="${scene.skyBottom}" />
          </linearGradient>
        </defs>
        <rect width="640" height="320" fill="url(#sky-${variant})" />
        <circle cx="128" cy="74" r="38" fill="${scene.sun}" opacity="0.95" />
        <path d="M0 205 Q90 162 168 188 T332 177 T640 194 V320 H0 Z" fill="${scene.ridge}" />
        <path d="M0 235 Q122 219 252 236 T640 224 V320 H0 Z" fill="${scene.ground}" />
        <path d="M-20 282 C120 232 250 238 366 258 C470 278 560 274 680 247" stroke="#5ce4ff" stroke-width="20" fill="none" stroke-linecap="round" />
        ${renderVariantAccent(variant)}
        ${renderRv(variant)}
      </svg>
      ${captionHtml}
    </figure>
  `;
}

function renderRv(variant) {
  const tire = variant === "failure" ? "#1b233a" : "#12192d";
  const body = variant === "failure" ? "#8d9bc4" : "#d7e2ff";
  const stripe = variant === "failure" ? "#ff7a92" : "#ff4f7b";
  const panel = variant === "victory" ? "#36e6ff" : "#1ad0ff";
  const frame = variant === "failure" ? "#324879" : "#18336a";
  const windowFill = "#49dbff";
  const doorFill = variant === "failure" ? "#b5c3ea" : "#adc4ff";
  const hubFill = "#9caeff";

  return `
    <g transform="translate(340 175)">
      <rect x="0" y="22" width="148" height="58" rx="10" fill="${body}" stroke="${frame}" stroke-width="3" />
      <path d="M18 18 H88 L112 34 H18 Z" fill="${body}" stroke="${frame}" stroke-width="3" />
      <rect x="22" y="30" width="34" height="20" rx="3" fill="${windowFill}" />
      <rect x="64" y="30" width="28" height="20" rx="3" fill="${windowFill}" />
      <rect x="106" y="42" width="24" height="38" rx="2" fill="${doorFill}" />
      <rect x="12" y="52" width="118" height="8" fill="${stripe}" opacity="0.92" />
      <rect x="46" y="8" width="66" height="14" transform="skewX(-18)" fill="${panel}" stroke="#0e69c5" stroke-width="2" />
      <circle cx="38" cy="84" r="16" fill="${tire}" />
      <circle cx="118" cy="84" r="16" fill="${tire}" />
      <circle cx="38" cy="84" r="7" fill="${hubFill}" />
      <circle cx="118" cy="84" r="7" fill="${hubFill}" />
    </g>
  `;
}

function renderVariantAccent(variant) {
  switch (variant) {
    case "title":
      return `
        <g transform="translate(115 176)">
          <path d="M0 18 L54 0 L76 18" stroke="#31dfcb" stroke-width="4" fill="none" />
          <path d="M18 14 L18 68 M38 8 L38 72 M58 16 L58 62" stroke="#31dfcb" stroke-width="4" />
        </g>
      `;
    default:
      return `
        <g transform="translate(126 198)">
          <path d="M0 0 H82" stroke="#5ce4ff" stroke-width="4" />
          <path d="M20 -18 H98" stroke="#5ce4ff" stroke-width="4" />
          <path d="M44 -36 H118" stroke="#5ce4ff" stroke-width="4" />
        </g>
      `;
  }
}
