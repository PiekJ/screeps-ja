import { runStateMachine, StateMachineBuilder } from "../utils/state-machine";

type RoomStateUnknown = -1;
type RoomStateLevel0 = 0;
type RoomStateLevel1 = 1;
type RoomStateLevel2 = 2;

const ROOM_STATE_UNKNOWN: RoomStateUnknown = -1;
const ROOM_STATE_LEVEL_0: RoomStateLevel0 = 0;
const ROOM_STATE_LEVEL_1: RoomStateLevel1 = 1;
const ROOM_STATE_LEVEL_2: RoomStateLevel2 = 2;

type RoomStateType = RoomStateUnknown | RoomStateLevel0 | RoomStateLevel1 | RoomStateLevel2;

type RoomContext = { room: Room };

const RoomStateMachineBuilder = StateMachineBuilder<RoomStateType, never, RoomContext>;

function scanMatrixForRoomPositions(
  roomName: string,
  matrix: LookAtResultMatrix,
  callback: (e: LookAtResult[]) => boolean
): RoomPosition[] {
  const roomPositionResult: RoomPosition[] = [];

  for (const y in matrix) {
    for (const x in matrix[y]) {
      const lookAtResults = matrix[y][x];

      if (callback(lookAtResults)) {
        roomPositionResult.push(new RoomPosition(+x, +y, roomName));
      }
    }
  }

  return roomPositionResult;
}

function getUniquePositionsInRoom(positions: RoomPosition[]): RoomPosition[] {
  const positionMap = new Map<number, RoomPosition>();

  for (const position of positions) {
    const key = (position.x << 6) | position.y;
    positionMap.set(key, position);
  }

  return Array.from(positionMap.values());
}

const roomStateMachine = new RoomStateMachineBuilder()
  .addState(ROOM_STATE_LEVEL_0, {
    onEnter() {
      const spawns = this.room.find(FIND_MY_SPAWNS);
      const sources = this.room.find(FIND_SOURCES);
      const controller = this.room.controller!;
      const roadsBetweenSpawnsAndSources = spawns.map(spawn => [...sources, controller].map(structure => {
        return spawn.pos.findPathTo(structure , {
          maxRooms: 1,
          ignoreCreeps: true,
          ignoreRoads: true,
          ignoreDestructibleStructures: true,
          range: 1
        }).map(pathStep => new RoomPosition(pathStep.x, pathStep.y, this.room.name));
      }).reduce((acc, x) => acc.concat(x), []))
        .reduce((acc, x) => acc.concat(x), []);

      const roadsAroundSpawn = spawns.map(source => this.room.lookAtArea(source.pos.y - 1, source.pos.x - 1, source.pos.y + 1, source.pos.x + 1))
        .map(result => scanMatrixForRoomPositions(
          this.room.name,
          result,
          lookAtResults => lookAtResults.some(
            x => x.type === 'terrain' && x.terrain !== 'wall')))
        .reduce((acc, x) => acc.concat(x), []);

      const roadsToConstruct = getUniquePositionsInRoom([...roadsBetweenSpawnsAndSources, ...roadsAroundSpawn]);

      roadsToConstruct.forEach(road => road.createConstructionSite(STRUCTURE_ROAD));
    }
  })
  .addState(ROOM_STATE_LEVEL_1, {
    onEnter() {}
  })
  .addState(ROOM_STATE_LEVEL_2, {
    onEnter() {}
  })
  .addTransition(ROOM_STATE_UNKNOWN, ROOM_STATE_LEVEL_0)
  .addTransition(ROOM_STATE_LEVEL_0, ROOM_STATE_LEVEL_1, {
    condition() {
      return this.room.controller!.level >= ROOM_STATE_LEVEL_1;
    }
  })
  .addTransition(ROOM_STATE_LEVEL_1, ROOM_STATE_LEVEL_2, {
    condition() {
      return false; //this.room.controller!.level >= ROOM_STATE_LEVEL_2;
    }
  })
  .build();

export function runRoomStateMachine(room: Room) {
  if (room.memory.state === undefined) {
    room.memory.state = ROOM_STATE_UNKNOWN;
  }

  runStateMachine(roomStateMachine, room.memory, { room });

  console.log(`${room.name} is in state ${room.memory.state}`);
}
