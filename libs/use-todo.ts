import { useEffect, useState } from "react";
import { TodoModel } from "../types/TodoModel";
import { offlineFirstDb } from "./offlinefirst-db.client";


export const useTodo = () => {
    const [todos, setTodos] = useState<TodoModel[]>([]);
    const [loading, setLoading] = useState(false);

    // const getTodos = async () => {
    //     setLoading(true);
    //     const todos = await db.todos.toArray();
    //     setTodos(todos);
    //     setLoading(false);
    // }

    useEffect(() => {
        // sync react state with browser db
        (async () => {
            const todos = await offlineFirstDb.todos.toArray();
            setTodos(todos);
        })()
    }, []);

    const addTodo = async (todo: TodoModel) => {
        const cid = await offlineFirstDb.addTodo({
            ...todo,
            done: false,
        });
        setTodos([{ ...todo, cid: cid as any }, ...todos]);
    }

    const updateTodo = async (todoId: number, todo: Partial<TodoModel>) => {
        todo.cid = todoId;
        // update todo to react local state
        const cid = await offlineFirstDb.updateTodo(todo.cid!, todo);
        
        // get current todo
        const currentTodo = todos.find(t => t.cid === todoId);

        const updatedTodo = {
            ...currentTodo,
            ...todo,
        } as TodoModel;
        // update todo in react state
        const updatedTodos = todos.map(t => t.cid === todo.cid ? updatedTodo : t);
        setTodos(updatedTodos);
    }


    return {
        todos,
        addTodo,
        updateTodo,
    }
}