type HarvesterStateUnknown = 0;
type HarvesterStateMoving = 1;
type HarvesterStateHarvesting = 2;
type HarvesterStateDumpingEnergy = 3;
type HarvesterStateBuilding = 4;

export const HARVESTER_STATE_UNKNOWN: HarvesterStateUnknown = 0;
export const HARVESTER_STATE_MOVING: HarvesterStateMoving = 1;
export const HARVESTER_STATE_HARVESTING: HarvesterStateHarvesting = 2;
export const HARVESTER_STATE_DUMPING_ENERGY: HarvesterStateDumpingEnergy = 3;
export const HARVESTER_STATE_BUILDING: HarvesterStateBuilding = 4;

type HarvesterState =
  | HarvesterStateUnknown
  | HarvesterStateMoving
  | HarvesterStateHarvesting
  | HarvesterStateDumpingEnergy
  | HarvesterStateBuilding;

interface HarvesterMemory {
  [key: number]: any;
  0: any
}
