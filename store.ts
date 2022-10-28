import { useLayoutEffect } from "react";
import create, { StateCreator, UseBoundStore, StoreApi, Mutate } from "zustand";
import createContext from "zustand/context";
import { offlineFirstDb } from './libs/offlinefirst-db.client';
import { TodoModel } from './types/TodoModel';

type TodoStore = {
    todos: TodoModel[];
    setTodos: (todos: TodoModel[]) => void;
    addTodo: (todo: TodoModel) => void;
    updateTodo: (todoId: number, todo: Partial<TodoModel>) => void;
}

type ClientGlobalState = TodoStore;

export type ZustandSetState = (
  partial:
    | ClientGlobalState
    | Partial<ClientGlobalState>
    | ((
        state: ClientGlobalState
      ) => ClientGlobalState | Partial<ClientGlobalState>)
) => void;
export type ZustandGetState = () => ClientGlobalState;

let store: UseBoundStore<StoreApi<ClientGlobalState>> | undefined;

const zustandContext = createContext<StoreApi<ClientGlobalState>>();
export const ZustandProvider = zustandContext.Provider;

export const useStore = zustandContext.useStore;


const createTodoSlice = (set: ZustandSetState, get: ZustandGetState) => ({
    todos: [],
    setTodos: (todos) => {
        set({ todos })
    },
    addTodo: async (todo: TodoModel) => {
        const cid = await offlineFirstDb.addOne('todos',{
            ...todo,
            done: 0,
        });
        set({
            todos: [{ ...todo, cid: cid as any }, ...get().todos]
        });
    },
    updateTodo: async (todoId: number, todo: Partial<TodoModel>) => {
        todo.cid = todoId;
        // update todo to react local state
        const cid = await offlineFirstDb.updateOne('todos', todo.cid!, todo);

        // get current todo
        const currentTodo = get().todos.find(t => t.cid === todoId);

        const updatedTodo = {
            ...currentTodo,
            ...todo,
        } as TodoModel;
        // update todo in react state
        const updatedTodos = get().todos.map(t => t.cid === todo.cid ? updatedTodo : t);
        set({
            todos: updatedTodos,
        });
    },
} as TodoStore) ;

export const initializeStore = (preloadedState = {}) => {
  const newLocal = "coverai-persist-store";
  return create<ClientGlobalState>(
    (set: ZustandSetState, get: ZustandGetState, api: any) => ({
      ...createTodoSlice(set, get),
      // ...createPersistStore(set, get),
      // ...createProjectDashboardSlice(set, get),
      ...preloadedState,
    })
  );
};

/*
 * This is called upon any page call(can be abstracted away in _app.tsx by nextjs magic)
 * CSR is enforced when app use next/link to navigate from 1 page to other
 */
export function useCreateStore(initialState: ClientGlobalState) {
  // For SSR & SSG, always use a new store
  if (typeof window === "undefined") {
    console.log("useCreateStore: SSR or SSG ");
    return () => initializeStore(initialState);
  }

  console.log("useCreateStore: CSR");
  // for CSR, alwasy re-use same store.
  let tempStore = store ?? initializeStore(initialState); // force change type to avoid undefined
  store = tempStore;

  // and if initial state changes, then merge states in the next render cycle
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useLayoutEffect(() => {
    if (initialState && store) {
      store.setState({
        ...store.getState(),
        ...initialState,
      });
    }
  }, [initialState]);

  return () => tempStore;
}