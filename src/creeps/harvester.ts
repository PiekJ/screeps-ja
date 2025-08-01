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

function getMemory<K extends HarvesterState>(creep: Creep, state: K): HarvesterMemory[K] {
  return creep.memory.data;
}

function setState<K extends HarvesterState>(creep: Creep, state: K, data?: HarvesterMemory[K]) {
  creep.memory.state = state;
  creep.memory.data = data;
}

export function performCreepHarvesterTick(creep: Creep): void {
  switch (creep.memory.state as HarvesterState) {
    case HARVESTER_STATE_UNKNOWN:
      break;
    case HARVESTER_STATE_MOVING:
      break;
    case HARVESTER_STATE_HARVESTING:
      break;
    case HARVESTER_STATE_DUMPING_ENERGY:
      break;
    case HARVESTER_STATE_BUILDING:
      break;
  }
}
