import { ErrorMapper } from "utils/error-mapper";
import { CREEP_ROLE_WORKER, runWorkerStateMachine, spawnCreepWorker } from "./creeps/worker";
import { RoomTaskScheduler } from "./rooms/room-task-scheduler";
import { runRoomStateMachine } from "./rooms/room-planner";

export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);

  const spawner = Game.structures['688c9b63b3ad85005448caf0'] as StructureSpawn;

  runRoomStateMachine(spawner.room);
  RoomTaskScheduler.forRoom(spawner.room).run();

  if (Object.keys(Game.creeps).length < 5) {
    console.log("Need more creeps!");
    spawnCreepWorker(spawner);
  } else {
    console.log("Has enough creeps!");
  }

  for (const creepName in Game.creeps) {
    const creep = Game.creeps[creepName];

    if (creep && !creep.spawning) {
      switch (creep.memory.role) {
        case CREEP_ROLE_WORKER:
          runWorkerStateMachine(creep);
          break;
      }
    }
  }

  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
});
