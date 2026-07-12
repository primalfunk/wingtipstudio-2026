import titleMark from "../../assets/ui/title-mark.svg";
import batteryIcon from "../../assets/ui/resource-battery.svg";
import fuelIcon from "../../assets/ui/resource-fuel.svg";
import waterIcon from "../../assets/ui/resource-water.svg";
import cashIcon from "../../assets/ui/resource-cash.svg";
import conditionIcon from "../../assets/ui/resource-condition.svg";
import moraleIcon from "../../assets/ui/resource-morale.svg";
import warningCautionIcon from "../../assets/ui/warning-caution.svg";
import warningUrgentIcon from "../../assets/ui/warning-urgent.svg";
import waypointMarker from "../../assets/ui/marker-waypoint.svg";
import destinationMarker from "../../assets/ui/marker-destination.svg";
import { WARNING_FLAGS } from "../constants/gameConstants.js";

const RESOURCE_ICONS = Object.freeze({
  battery: batteryIcon,
  fuel: fuelIcon,
  water: waterIcon,
  cash: cashIcon,
  condition: conditionIcon,
  morale: moraleIcon
});

const TOWN_ACTION_ICONS = Object.freeze({
  talk_to_someone: moraleIcon,
  refuel: fuelIcon,
  refill_water: waterIcon,
  serviced_hookup: batteryIcon,
  repair_rv: conditionIcon,
  rest_up: moraleIcon,
  top_off_fuel: fuelIcon,
  fill_water: waterIcon,
  dump_waste: conditionIcon,
  town_charge: batteryIcon,
  quick_utility_stop: batteryIcon,
  meal_shower: moraleIcon,
  hot_meal: moraleIcon,
  laundry_shower: moraleIcon,
  quick_patch: conditionIcon,
  standard_service: conditionIcon,
  full_inspection: conditionIcon,
  ask_around: moraleIcon,
  settle_in: moraleIcon,
  take_care_of_things: conditionIcon,
  make_something_of_it: moraleIcon,
  keep_it_simple: moraleIcon,
  stay_conserve: waterIcon,
  stay_normal: moraleIcon,
  stay_comfort: moraleIcon,
  service_dump_waste: conditionIcon,
  service_refill_water: waterIcon,
  service_charge_electric: batteryIcon,
  wash_up: waterIcon,
  quiet_evening: moraleIcon,
  quick_check_rv: conditionIcon,
  comfort_setup: moraleIcon,
  conserve_power: batteryIcon,
  reposition_for_sun: batteryIcon,
  easy_utility_reset: batteryIcon,
  read_camp_board: moraleIcon,
  chat_with_travelers: moraleIcon,
  take_in_the_sky: moraleIcon
});

const URGENT_WARNING_FLAGS = new Set([
  WARNING_FLAGS.VERY_LOW_BATTERY,
  WARNING_FLAGS.CRITICALLY_LOW_BATTERY,
  WARNING_FLAGS.MORALE_FRAGILE,
  WARNING_FLAGS.REAL_BREAK_NEEDED,
  WARNING_FLAGS.RV_CONDITION_CRITICAL
]);

export function renderTitleMark() {
  return `
    <div class="title-mark-wrap">
      <img class="title-mark" src="${titleMark}" alt="" aria-hidden="true" />
    </div>
  `;
}

export function renderAssetIcon(src, className = "ui-icon", alt = "") {
  const aria = alt ? `alt="${alt}"` : 'alt="" aria-hidden="true"';
  return `<img class="${className}" src="${src}" ${aria} />`;
}

export function getResourceIcon(resourceKey) {
  return RESOURCE_ICONS[resourceKey] ?? batteryIcon;
}

export function getTownActionIcon(actionId) {
  return TOWN_ACTION_ICONS[actionId] ?? RESOURCE_ICONS[actionId] ?? batteryIcon;
}

export function getWarningIcon(flag) {
  return URGENT_WARNING_FLAGS.has(flag) ? warningUrgentIcon : warningCautionIcon;
}

export function getRouteMarkerIcon(isDestination = false) {
  return isDestination ? destinationMarker : waypointMarker;
}
