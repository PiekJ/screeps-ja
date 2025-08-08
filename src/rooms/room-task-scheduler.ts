export const ROOM_TASK_TRANSFER: RoomTaskTransfer = 0;
export const ROOM_TASK_REPAIR: RoomTaskRepair = 1;
export const ROOM_TASK_BUILD: RoomTaskBuild = 2;
export const ROOM_TASK_CONTROLLER: RoomTaskController = 3;

const ROOM_TASK_ORDER = {
  [ROOM_TASK_TRANSFER]: 1,
  [ROOM_TASK_REPAIR]: 2,
  [ROOM_TASK_BUILD]: 3,
  [ROOM_TASK_CONTROLLER]: 0,
};

type RoomTaskTracker = {
  id: string;
  energyInitialNeeded: number;
  totalEnergyNeedClaimed: number;
}

function roomTaskOrderCallback(a: RoomTaskDetails, b: RoomTaskDetails): number {
  return ROOM_TASK_ORDER[a.type] - ROOM_TASK_ORDER[b.type];
}

function isStructureNeedingEnergy(structure: AnyStructure): boolean {
  return (
    (structure.structureType === STRUCTURE_EXTENSION || structure.structureType === STRUCTURE_SPAWN) &&
    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  );
}

function isStructureNeedingRepair(structure: AnyStructure): boolean {
  switch(structure.structureType) {
    case STRUCTURE_ROAD:
    case STRUCTURE_CONTAINER:
      return structure.hits / structure.hitsMax < 0.5;
    case STRUCTURE_RAMPART:
      return structure.structureType === STRUCTURE_RAMPART && structure.hits < 50_000;
    default:
      return false;
  }
}

function calculateRepairCost(structure: AnyStructure): number {
  let hitsToRepair = structure.hitsMax - structure.hits;

  if (structure.structureType === STRUCTURE_RAMPART) {
    // match with "is repair needed".
    hitsToRepair = Math.min(50_000 - structure.hits, hitsToRepair);
  }

  return Math.ceil(hitsToRepair / 100);
}

function calculateBuildCost(constructionSite: ConstructionSite): number {
  return constructionSite.progressTotal - constructionSite.progress;
}

function calculateTransferCost(structure: AnyStructure): number {
  if ("store" in structure) {
    return (structure.store as StoreDefinition).getFreeCapacity(RESOURCE_ENERGY);
  }

  return 0;
}

function toRoomTaskDetails(type: RoomTaskType, targetId: Id<RoomTaskTargetType>, energyNeeded: number): RoomTaskDetails {
  return {
    id: `roomTaskKey(${type},${targetId})`,
    type,
    targetId,
    energyNeeded,
    toString() {
      return `${this.id} needs ${this.energyNeeded} energy`;
    }
  } as RoomTaskDetails;
}

export class RoomTaskScheduler {
  private static roomTaskSchedulerInstances: sMap<string, RoomTaskScheduler> = {};

  private priorityQueue: RoomTaskDetails[] = [];

  private get creepAssignedRoomTasks(): sMap<string, CreepAssignedRoomTask[]> {
    if (!this.room.memory.creepAssignedRoomTasks) {
      this.room.memory.creepAssignedRoomTasks = {};
    }

    return this.room.memory.creepAssignedRoomTasks;
  }

  private constructor(private readonly room: Room) {}

  run() {
    this.priorityQueue = [];
    const roomTaskTracker = this.getRoomTaskTracker();

    const structuresInRoom = this.room.find(FIND_STRUCTURES);
    for (const structure of structuresInRoom) {
      if (isStructureNeedingEnergy(structure)) {
        this.priorityQueueTryPush(
          roomTaskTracker,
          toRoomTaskDetails(ROOM_TASK_TRANSFER, structure.id, calculateTransferCost(structure)));
      }

      if (isStructureNeedingRepair(structure)) {
        this.priorityQueueTryPush(
          roomTaskTracker,
          toRoomTaskDetails(ROOM_TASK_REPAIR, structure.id, calculateRepairCost(structure)));
      }
    }

    const constructionSitesInRoom = this.room.find(FIND_MY_CONSTRUCTION_SITES);

    for (const constructionSite of constructionSitesInRoom) {
      this.priorityQueueTryPush(
        roomTaskTracker,
        toRoomTaskDetails(ROOM_TASK_BUILD, constructionSite.id, calculateBuildCost(constructionSite))
      );
    }

    if ((this.room.controller?.ticksToDowngrade ?? 9999) <= 2000) {
      this.priorityQueueTryPush(
        roomTaskTracker,
        toRoomTaskDetails(ROOM_TASK_CONTROLLER, this.room.controller!.id, 50));
    }

    this.priorityQueue.sort(roomTaskOrderCallback);
    this.priorityQueue.forEach(x => console.log(x));
  }

  private priorityQueueTryPush(roomTaskTracker: sMap<string, RoomTaskTracker>, roomTaskDetails: RoomTaskDetails) {
    const roomTaskTrack = roomTaskTracker[roomTaskDetails.id];
    if (roomTaskTrack) {
      roomTaskDetails.energyNeeded -= roomTaskTrack.totalEnergyNeedClaimed - (roomTaskTrack.energyInitialNeeded - roomTaskDetails.energyNeeded);
    }

    if (roomTaskDetails.energyNeeded > 0) {
      this.priorityQueue.push(roomTaskDetails);
    }
  }

  private getRoomTaskTracker(): sMap<string, RoomTaskTracker> {
    const result: sMap<string, RoomTaskTracker> = {};

    // extract to seperate method
    for (const roomTaskId in this.creepAssignedRoomTasks) {
      const validCreepAssignedRoomTasks = this.creepAssignedRoomTasks[roomTaskId].filter(
        creepAssignedRoomTask => Game.getObjectById(creepAssignedRoomTask.creepId));
      this.creepAssignedRoomTasks[roomTaskId] = validCreepAssignedRoomTasks;

      if (validCreepAssignedRoomTasks.length <= 0) {
        delete this.creepAssignedRoomTasks[roomTaskId];

        continue;
      }
      // ^^ side effect on updating creep assigned room task, when creep dies.

      const roomTaskTrack = {id: roomTaskId, energyInitialNeeded: 0, totalEnergyNeedClaimed: 0} as RoomTaskTracker;
      validCreepAssignedRoomTasks.forEach(creepAssignedRoomTask => {
        if (roomTaskTrack.energyInitialNeeded < creepAssignedRoomTask.energyInitialNeeded) {
          roomTaskTrack.energyInitialNeeded = creepAssignedRoomTask.energyInitialNeeded;
        }

        roomTaskTrack.totalEnergyNeedClaimed += creepAssignedRoomTask.energyNeedClaimed;
      });

      result[roomTaskId] = roomTaskTrack;
    }

    return result;
  }

  getRoomTask(creep: Creep): RoomTask {
    const roomTaskDetails = this.priorityQueue.shift();
    const energySource = { sourceId: "884707717df4411" } as EnergySource;

    const creepEnergyCapacity = creep.store.getCapacity(RESOURCE_ENERGY);

    if (!roomTaskDetails) {
      return {
        ...toRoomTaskDetails(ROOM_TASK_CONTROLLER, this.room.controller!.id, creepEnergyCapacity),
        ...energySource
      };
    }

    if (roomTaskDetails.energyNeeded > creepEnergyCapacity) {
      this.priorityQueue.unshift({
        ...roomTaskDetails,
        energyNeeded: roomTaskDetails.energyNeeded - creepEnergyCapacity
      });
    }

    this.assignCreepToRoomTask(creep.id, creepEnergyCapacity, roomTaskDetails);

    return {...roomTaskDetails, ...energySource, energyNeeded: creepEnergyCapacity};
  }

  private assignCreepToRoomTask(creepId: Id<Creep>, energyNeedClaimed: number, roomTaskDetails: RoomTaskDetails) {
    const creepAssignedRoomTask = {
      creepId,
      energyInitialNeeded: roomTaskDetails.energyNeeded,
      energyNeedClaimed
    } as CreepAssignedRoomTask;

    const creepAssignedRoomTasks = this.creepAssignedRoomTasks[roomTaskDetails.id];
    if (creepAssignedRoomTasks) {
      creepAssignedRoomTasks.push(creepAssignedRoomTask);

      return;
    }

    this.creepAssignedRoomTasks[roomTaskDetails.id] = [creepAssignedRoomTask];
  }

  creepFinishedRoomTask(creep: Creep, roomTaskId: string, forceComplete?: boolean) {
    const creepsAssignedRoomTask = this.creepAssignedRoomTasks[roomTaskId];
    if (!creepsAssignedRoomTask) {
      return;
    }

    if (forceComplete && this.priorityQueue[0]?.id === roomTaskId) {
      // when force complete, check if task is not in queue.
      this.priorityQueue.shift();
    }

    if (creepsAssignedRoomTask.length === 1) {
      delete this.creepAssignedRoomTasks[roomTaskId];
    } else if (creepsAssignedRoomTask.length > 1) {
      // other creeps are still working on the task.
      this.creepAssignedRoomTasks[roomTaskId] = creepsAssignedRoomTask.filter(x => x.creepId !== creep.id);
    }
  }

  static forRoom(room: Room): RoomTaskScheduler {
    if (this.roomTaskSchedulerInstances[room.name]) {
      return this.roomTaskSchedulerInstances[room.name];
    }

    const roomTaskScheduler = new RoomTaskScheduler(room);

    this.roomTaskSchedulerInstances[room.name] = roomTaskScheduler;

    return roomTaskScheduler;
  }
}
