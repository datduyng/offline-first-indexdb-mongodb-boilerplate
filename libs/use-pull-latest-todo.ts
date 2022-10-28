import { useEffect, useState } from "react";
import { useStore } from "../store";
import { TodoModel } from "../types/TodoModel";
import { offlineFirstDb } from "./offlinefirst-db.client";


export const usePullLatestTodo = () => {
    const [todos, setTodos] = useStore(state => [state.todos, state.setTodos]);

    useEffect(() => {
        // sync react state with browser db
        (async () => {
            const todos = await offlineFirstDb.todos
                .toArray();
            setTodos(todos.sort((a, d) => d.lastModified - a.lastModified));
        })()
    }, []);
    return {
        todos,
    }
}