import { StateMachineContext } from "utils/state-machine";

declare global {
  interface CreepMemory extends StateMachineContext {
    role: string;

  }
}
