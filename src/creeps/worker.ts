import { runStateMachine, StateMachineBuilder } from "../utils/state-machine";
import {
  ROOM_TASK_BUILD,
  ROOM_TASK_CONTROLLER,
  ROOM_TASK_REPAIR,
  ROOM_TASK_TRANSFER,
  RoomTaskScheduler
} from "../rooms/room-task-scheduler";

export const CREEP_ROLE_WORKER = "WORKER";

type WorkerStateUnknown = -1;
type WorkerStateMoving = 1;
type WorkerStateBuilding = 2;
type WorkerStateHarvesting = 3;
type WorkerStateTransfering = 4;
type WorkerStateRepairing = 5;
type WorkerStateWithdrawing = 6;
type WorkerStateWaitingForRoomTask = 7;

const WORKER_STATE_UNKNOWN: WorkerStateUnknown = -1;
const WORKER_STATE_MOVING: WorkerStateMoving = 1;
const WORKER_STATE_BUILDING: WorkerStateBuilding = 2;
const WORKER_STATE_HARVESTING: WorkerStateHarvesting = 3;
const WORKER_STATE_TRANSFERING: WorkerStateTransfering = 4;
const WORKER_STATE_REPAIRING: WorkerStateRepairing = 5;
const WORKER_STATE_WITHDRAWING: WorkerStateWithdrawing = 6;
const WORKER_STATE_WAITING_FOR_ROOM_TASK: WorkerStateWaitingForRoomTask = 7;

type WorkerStateType =
  | WorkerStateUnknown
  | WorkerStateMoving
  | WorkerStateBuilding
  | WorkerStateHarvesting
  | WorkerStateTransfering
  | WorkerStateRepairing
  | WorkerStateWithdrawing
  | WorkerStateWaitingForRoomTask;

interface WorkerMemory {
  [WORKER_STATE_MOVING]: WorkerMovingMemory;
  [WORKER_STATE_HARVESTING]: WorkerHarvestingMemory;
  [WORKER_STATE_TRANSFERING]: WorkerTransferingMemory;
  [WORKER_STATE_REPAIRING]: WorkerRepairingMemory;
  [WORKER_STATE_BUILDING]: WorkerBuildingMemory;
  [WORKER_STATE_WITHDRAWING]: WorkerWithdrawingMemory;
}

interface WorkerMovingMemory {
  target: RoomPosition;
  targetId: Id<RoomTaskTargetType | Source>;
  lastPosition?: RoomPosition;
  path?: string;
}

interface WorkerHarvestingMemory {
  targetId: Id<Source>;
}

interface WorkerTransferingMemory {
  targetId: Id<AnyStructure>;
}

interface WorkerRepairingMemory {
  targetId: Id<AnyStructure>;
}

interface WorkerBuildingMemory {
  targetId: Id<ConstructionSite>;
}

interface WorkerWithdrawingMemory {
  targetId: Id<StructureContainer>;
}

type CreepContext = { creep: Creep, roomTask: RoomTask };

const WorkerStateMachineBuilder = StateMachineBuilder<WorkerStateType, WorkerMemory, CreepContext>;

const workerStateMachine = new WorkerStateMachineBuilder()
  .addState(WORKER_STATE_MOVING, {
    onEnter(memory) {
      memory.path = Room.serializePath(this.creep.pos.findPathTo(memory.target.x, memory.target.y, {
        range: 1,
        maxRooms: 1
      }));
    },
    onTick(memory) {
      if (memory.lastPosition && this.creep.pos.isEqualTo(memory.lastPosition.x, memory.lastPosition.y)) {
        console.log(`${this.creep.name} recalculate path`);
        memory.path = Room.serializePath(this.creep.pos.findPathTo(memory.target.x, memory.target.y, {
          range: 1,
          maxRooms: 1
        }));
      }

      memory.lastPosition = this.creep.pos;
      return this.creep.moveByPath(memory.path!)
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
      finishRoomTask(this.creep);
    }
  })
  .addState(WORKER_STATE_REPAIRING, {
    onTick(memory) {
      const target = Game.getObjectById(memory.targetId)!;
      return this.creep.repair(target);
    },
    isFinished(memory) {
      const target = Game.getObjectById(memory.targetId)!;
      return this.creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0 || target.hits >= target.hitsMax;
    },
    onExit() {
      finishRoomTask(this.creep);
    }
  })
  .addState(WORKER_STATE_BUILDING, {
    onTick(memory) {
      const target = Game.getObjectById(memory.targetId);
      if (target) {
        return this.creep.build(target);
      }
      return 0;
    },
    isFinished(memory) {
      const target = Game.getObjectById(memory.targetId);
      return this.creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0 || !target;
    },
    onExit() {
      finishRoomTask(this.creep);
    }
  })
  .addState(WORKER_STATE_WITHDRAWING, {
    onTick(memory) {
      const target = Game.getObjectById(memory.targetId)!;
      return this.creep.withdraw(target, RESOURCE_ENERGY);
    },
    isFinished() {
      return this.creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0;
    }
  })
  .addState(WORKER_STATE_WAITING_FOR_ROOM_TASK, {
    onExit() {
      this.roomTask = requestRoomTask(this.creep);
    }
  })
  .addTransition(WORKER_STATE_MOVING, WORKER_STATE_HARVESTING, {
    condition(memory) {
      const source = Game.getObjectById(this.roomTask.sourceId)!;
      return this.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && source.pos.isEqualTo(memory.target.x, memory.target.y);
    },
    onTransition() {
      return {targetId: this.roomTask.sourceId};
    }
  })
  .addTransition(WORKER_STATE_MOVING, WORKER_STATE_WITHDRAWING, {
    condition(memory) {
      const container = Game.getObjectById(this.roomTask.containerId!)!;
      return this.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && container.pos.isEqualTo(memory.target.x, memory.target.y);
    },
    onTransition() {
      return {targetId: this.roomTask.containerId!};
    }
  })
  .addTransition(WORKER_STATE_HARVESTING, WORKER_STATE_MOVING, {
    onTransition() {
      const moveToTarget = Game.getObjectById(this.roomTask.targetId)!;
      console.log(this.creep.name);
      return { target: moveToTarget.pos, targetId: this.roomTask.targetId };
    }
  })
  .addTransition(WORKER_STATE_WITHDRAWING, WORKER_STATE_MOVING, {
    onTransition() {
      const moveToTarget = Game.getObjectById(this.roomTask.targetId)!;
      return { target: moveToTarget.pos, targetId: this.roomTask.targetId };
    }
  })
  .addTransition(WORKER_STATE_MOVING, WORKER_STATE_TRANSFERING, {
    condition() {
      return this.creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0 && (this.roomTask.type === ROOM_TASK_TRANSFER || this.roomTask.type === ROOM_TASK_CONTROLLER);
    },
    onTransition() {
      return {targetId: this.roomTask.targetId as Id<AnyStructure>};
    }
  })
  .addTransition(WORKER_STATE_MOVING, WORKER_STATE_BUILDING, {
    condition() {
      return this.creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0 && this.roomTask.type === ROOM_TASK_BUILD;
    },
    onTransition() {
      return {targetId: this.roomTask.targetId as Id<ConstructionSite>};
    }
  })
  .addTransition(WORKER_STATE_MOVING, WORKER_STATE_REPAIRING, {
    condition() {
      return this.creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0 && this.roomTask.type === ROOM_TASK_REPAIR;
    },
    onTransition() {
      return {targetId: this.roomTask.targetId as Id<AnyStructure>};
    }
  })
  .addTransition(WORKER_STATE_UNKNOWN, WORKER_STATE_WAITING_FOR_ROOM_TASK)
  .addTransition(WORKER_STATE_TRANSFERING, WORKER_STATE_WAITING_FOR_ROOM_TASK)
  .addTransition(WORKER_STATE_BUILDING, WORKER_STATE_WAITING_FOR_ROOM_TASK)
  .addTransition(WORKER_STATE_REPAIRING, WORKER_STATE_WAITING_FOR_ROOM_TASK)
  .addTransition(WORKER_STATE_WAITING_FOR_ROOM_TASK, WORKER_STATE_MOVING, { // optimise transitions based on if creep should move, or is already at destination. Most of the time it has to move.
    onTransition() {
      if (this.creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
        const moveToTarget = Game.getObjectById(this.roomTask.targetId)!;
        return { target: moveToTarget.pos, targetId: this.roomTask.targetId };
      }

      if (this.roomTask.containerId) {
        const moveToTarget = Game.getObjectById(this.roomTask.containerId)!;
        return { target: moveToTarget.pos, targetId: this.roomTask.containerId };
      }

      const moveToTarget = Game.getObjectById(this.roomTask.sourceId)!;
      return { target: moveToTarget.pos, targetId: this.roomTask.sourceId };
    }
  })
  .build();

function requestRoomTask(creep: Creep): RoomTask {
  return RoomTaskScheduler.forRoom(creep.room).getRoomTask(creep);
}

function finishRoomTask(creep: Creep) {
  if (!creep.memory.roomTask) {
    console.log(`${creep.id} tried to finish room task, but did not have any?`);
    return;
  }

  RoomTaskScheduler.forRoom(creep.room).creepFinishedRoomTask(creep, creep.memory.roomTask.id);
}

export function runWorkerStateMachine(creep: Creep) {
  runStateMachine(workerStateMachine, creep.memory, {
    creep,
    get roomTask() {
      return this.creep.memory.roomTask ?? (() => {
        console.log(`${creep.name} is in invalid state, no room task but expected one.`);
        return { } as RoomTask;
      })();
    },
    set roomTask(roomTask: RoomTask) {
      this.creep.memory.roomTask = roomTask;
    }
  });

  console.log(`${creep.name} (ttl: ${creep.ticksToLive}) is in state ${creep.memory.state} (room task: ${creep.memory.roomTask?.id})`);
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
      state: WORKER_STATE_WAITING_FOR_ROOM_TASK
    }
  });
}
