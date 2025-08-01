export interface StateMachineContext {
  state: number;
  memory?: any;
}

export type MemoryForState<S, M> = S extends keyof M ? M[S] : never;

export interface StateId<S> {
  id: S
}

export interface StateHandler<S, M> {
  onEnter?: (memory: MemoryForState<S, M>) => void | any;
  onExit?: (memory: MemoryForState<S, M>) => void | any;
  onTick?: (memory: MemoryForState<S, M>) => void | any;
  isFinished?: (memory: MemoryForState<S, M>) => boolean;
}

export type State<S, M> = StateId<S> & StateHandler<S, M>;

export interface TransitionKey<S1, S2> {
  from: S1;
  to: S2;
}

export interface TransitionHandler<S1, S2, M> {
  condition?: (memory: MemoryForState<S1, M>) => boolean;
  onTransition?: (memory: MemoryForState<S1, M>) => MemoryForState<S2, M>;
}

export type Transition<S1, S2, M> = TransitionKey<S1, S2> & TransitionHandler<S1, S2, M>;

export type StateMachineConfig<S, M> = {
  states: Map<S, State<S, M>>;
  transitions: Array<Transition<S, S, M>>;
};

export class StateMachineBuilder<S, M, C> {
  private states: Map<S, State<S, M>> = new Map<S, State<S, M>>();
  private transitions: Array<Transition<S, S, M>> = [];

  addState<S1 extends S>(
    id: S1,
    handlers: StateHandler<S1, M> & ThisType<C>,
  ): StateMachineBuilder<S, M, C> {
    this.states.set(id, { id, ...handlers } as State<S, M>);
    return this;
  }

  addTransition<S1 extends S, S2 extends S>(
    from: S1,
    to: S2,
    handlers: TransitionHandler<S1, S2, M> & ThisType<C>
  ): StateMachineBuilder<S, M, C> {
    this.transitions.push({ from, to, ...handlers } as Transition<S, S, M>);
    return this;
  }

  build(): StateMachineConfig<S, M> {
    return { states: this.states, transitions: this.transitions };
  }
}

export function runStateMachine<S, M, C>(
  config: StateMachineConfig<S, M>,
  stateMachineContext: StateMachineContext,
  runContext: C): void {
  const currentState = config.states.get(stateMachineContext.state as S);

  currentState?.onTick?.call(runContext, stateMachineContext.memory);

  if (currentState?.isFinished?.call(runContext, stateMachineContext.memory) ?? true) {
    const applicableTransitions = config.transitions.filter(t => t.from === stateMachineContext.state);

    for (const transition of applicableTransitions) {
      if (transition.condition?.call(runContext, stateMachineContext.memory) ?? true) {
        currentState?.onExit?.call(runContext, stateMachineContext.memory);
        const newStateMemory = transition.onTransition?.call(runContext, stateMachineContext.memory);
        stateMachineContext.state = transition.to as number;
        stateMachineContext.memory = newStateMemory;
        config.states.get(transition.to)?.onEnter?.call(runContext, stateMachineContext.memory);
        break;
      }
    }
  }
}
