import { StateMachineContext } from "utils/state-machine";

declare global {
  type RoomTaskTransfer = 0;
  type RoomTaskRepair = 1;
  type RoomTaskBuild = 2;
  type RoomTaskController = 3;

  type RoomTaskType = RoomTaskTransfer | RoomTaskRepair | RoomTaskBuild | RoomTaskController;

  type RoomTaskTargetType = AnyStructure | ConstructionSite | Resource | Ruin | Tombstone;

  interface RoomTaskDetails {
    id: string;
    type: RoomTaskType;
    targetId: Id<RoomTaskTargetType>;
    energyNeeded: number;
  }

  interface EnergySource {
    sourceId: Id<Source>;
    containerId?: Id<StructureContainer>;
  }

  type RoomTask = RoomTaskDetails & EnergySource;

  type CreepAssignedRoomTask = {
    creepId: Id<Creep>;
    energyInitialNeeded: number;
    energyNeedClaimed: number;
  }

  interface RoomMemory extends StateMachineContext {
    creepAssignedRoomTasks?: sMap<string, CreepAssignedRoomTask[]>;
  }
}
