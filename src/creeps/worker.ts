import { runStateMachine, StateMachineBuilder } from "../utils/state-machine";

export const CREEP_ROLE_WORKER = "WORKER";

type WorkerStateUnknown = 0;
type WorkerStateMoving = 1;
type WorkerStateBuilding = 2;
type WorkerStateHarvesting = 3;
type WorkerStateTransfering = 4;
type WorkerStateRepairing = 5;

export const WORKER_STATE_UNKNOWN: WorkerStateUnknown = 0;
export const WORKER_STATE_MOVING: WorkerStateMoving = 1;
export const WORKER_STATE_BUILDING: WorkerStateBuilding = 2;
export const WORKER_STATE_HARVESTING: WorkerStateHarvesting = 3;
export const WORKER_STATE_TRANSFERING: WorkerStateTransfering = 4;
export const WORKER_STATE_REPAIRING: WorkerStateRepairing = 5;

export type WorkerStateType =
  | WorkerStateUnknown
  | WorkerStateMoving
  | WorkerStateBuilding
  | WorkerStateHarvesting
  | WorkerStateTransfering
  | WorkerStateRepairing;

export interface WorkerMemory {
  [WORKER_STATE_MOVING]: WorkerMovingMemory;
  [WORKER_STATE_HARVESTING]: WorkerHarvestingMemory;
  [WORKER_STATE_TRANSFERING]: WorkerTransferingMemory;
}

export interface WorkerMovingMemory {
  target: RoomPosition;
  path?: string;
}

export interface WorkerHarvestingMemory {
  targetId: Id<Source>;
}

export interface WorkerTransferingMemory {
  targetId: Id<Structure>;
}

type CreepContext = { creep: Creep, task: {sourceId: Id<Source>, controllerId: Id<Structure>} };

const WorkerStateMachineBuilder = StateMachineBuilder<WorkerStateType, WorkerMemory, CreepContext>;

var workerStateMachine = new WorkerStateMachineBuilder()
  .addState(WORKER_STATE_MOVING, {
    onEnter(memory) {
      memory.path = Room.serializePath(this.creep.pos.findPathTo(memory.target));
    },
    onTick(memory) {
      return this.creep.moveByPath(memory.path!);
    },
    isFinished(memory) {
      return this.creep.pos.inRangeTo(memory.target, 1);
    }
  })
  .addState(WORKER_STATE_HARVESTING, {
    onTick(memory) {
      const target = Game.getObjectById(memory.targetId)!;
      return this.creep.harvest(target);
    },
    isFinished() {
      return this.creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0;
    }
  })
  .addState(WORKER_STATE_TRANSFERING, {
    onTick(memory) {
      const target = Game.getObjectById(memory.targetId)!;
      return this.creep.transfer(target, RESOURCE_ENERGY);
    },
    isFinished(memory) {
      const target = Game.getObjectById(memory.targetId) as StructureExtension;
      return this.creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0 || target.store?.getFreeCapacity(RESOURCE_ENERGY) <= 0;
    },
    onExit() {
      // complete task
    }
  })
  .addTransition(WORKER_STATE_UNKNOWN, WORKER_STATE_MOVING, {
    onTransition() {
      const moveToTarget = Game.getObjectById(this.task.sourceId)!;
      return {target: moveToTarget.pos}
    }
  })
  .addTransition(WORKER_STATE_MOVING, WORKER_STATE_HARVESTING, {
    condition() {
      return this.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0; // and needs it for task
    },
    onTransition() {
      return {targetId: this.task.sourceId};
    }
  })
  .addTransition(WORKER_STATE_HARVESTING, WORKER_STATE_MOVING, {
    condition() {
      return true; // state finished, start moving lol (edge case when close enough, skip this)
    },
    onTransition() {
      const moveToTarget = Game.getObjectById(this.task.controllerId)!;
      return {target: moveToTarget.pos}
    }
  })
  .addTransition(WORKER_STATE_MOVING, WORKER_STATE_TRANSFERING, {
    condition() {
      return this.creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0; // and needs it for transfer task.
    },
    onTransition() {
      return {targetId: this.task.controllerId};
    }
  })
  .addTransition(WORKER_STATE_TRANSFERING, WORKER_STATE_UNKNOWN, {
    condition() {
      return this.creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0;
    }
  })
  .build();

export function runWorkerStateMachine(creep: Creep) {
  const task = {
    sourceId: "884707717df4411",
    controllerId: "e84207717df82e1"
  };

  runStateMachine(workerStateMachine, creep.memory, { creep, task });

  console.log(`${creep.name} is in state ${creep.memory.state}`);
}

export function spawnCreepWorker(spawner: StructureSpawn) {
  if (spawner.spawning) {
    console.log("Spawner already spawning...");
    return;
  }

  if (spawner.store.getUsedCapacity(RESOURCE_ENERGY) <= 250) {
    console.log("Spawner not enough energy...");
    return;
  }

  const bodyParts = [MOVE, MOVE, WORK, CARRY];

  const creepName = `worker-${Game.time}`;
  spawner.spawnCreep(bodyParts, creepName, {
    memory: {
      role: CREEP_ROLE_WORKER,
      state: WORKER_STATE_UNKNOWN
    }
  });
}
