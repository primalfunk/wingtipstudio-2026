export const ELEVATOR_SHAFT_COLORS = {
  main: 0x79f2c0,
  industrial: 0xff9b42,
  security: 0xb66bff,
  core: 0xff3b3b,
  service: 0x8ff0ff,
  relay: 0xc6ff52,
  spine: 0xffd447,
  null: 0xf3d9ff
};

export function getElevatorShaftColor(shaftOrLift, fallback = 0x79f2c0) {
  if (!shaftOrLift) {
    return fallback;
  }
  if (shaftOrLift.color !== undefined) {
    return shaftOrLift.color;
  }
  return ELEVATOR_SHAFT_COLORS[shaftOrLift.shaftType] ?? fallback;
}
