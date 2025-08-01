export function transferStructure(creep: Creep, structure: Structure): ScreepsReturnCode {
  const result = creep.transfer(structure, RESOURCE_ENERGY);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(structure, { visualizePathStyle: { stroke: "#ffaa00" } });
  }

  return result;
}

export function repairStructure(creep: Creep, structure: Structure): CreepActionReturnCode | ERR_NOT_ENOUGH_RESOURCES {
  const result = creep.repair(structure);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(structure, { visualizePathStyle: { stroke: "#ffaa00" } });
  }

  return result;
}

export function buildStructure(
  creep: Creep,
  constructionSite: ConstructionSite
): CreepActionReturnCode | ERR_NOT_ENOUGH_RESOURCES | ERR_RCL_NOT_ENOUGH {
  const result = creep.build(constructionSite);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(constructionSite, { visualizePathStyle: { stroke: "#ffaa00" } });
  }

  return result;
}

export function harvestStructure(
  creep: Creep,
  source: Source
): CreepActionReturnCode | ERR_NOT_FOUND | ERR_NOT_ENOUGH_RESOURCES {
  const result = creep.harvest(source);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
  }

  return result;
}

export function signController(
  creep: Creep,
  controller: StructureController,
  text: string
): OK | ERR_BUSY | ERR_INVALID_TARGET | ERR_NOT_IN_RANGE {
  const result = creep.signController(controller, text);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(controller, { visualizePathStyle: { stroke: "#ff0000" } });
  }

  return result;
}

export function recycleCreep(creep: Creep, spawner: StructureSpawn): ScreepsReturnCode {
  const result = spawner.recycleCreep(creep);

  if (spawner.recycleCreep(creep) === ERR_NOT_IN_RANGE) {
    creep.moveTo(spawner, { visualizePathStyle: { stroke: "#ffaa00" } });
  }

  return result;
}

export function withdrawStructure(creep: Creep, structure: Structure | Tombstone | Ruin): ScreepsReturnCode {
  const result = creep.withdraw(structure, RESOURCE_ENERGY);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(structure, { visualizePathStyle: { stroke: "#ffaa00" } });
  }

  return result;
}
